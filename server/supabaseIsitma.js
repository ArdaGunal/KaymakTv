// ==========================================================================
// SUPABASE ISINDIRMA — 4 dakikada bir küçük okuma (HIZ-02 · M573)
// ==========================================================================
// NEDEN: Cloudflare'in Supabase'e YENİ bağlantı kurması 15 dk'dan uzun sessizlikten sonra çoğunlukla
// takılıyor (1–19 sn, 522). Proje çoğu zaman sessiz olduğu için soğuk açan kullanıcı buna denk geliyor.
// ÖLÇÜM (docs/design/SUPABASE_LOG_RAPORU_2026-11-03.md, T2, 48 tur): 4 dk'da bir küçük okuma doğrudan
// yolda ilk isteğin takılmasını 17/18'den 3/30'a, 522'yi 9/18'den 1/30'a indirdi.
// ⚠️ Worker yolunda etkisi KANITLANMADI, deneme olarak açık; özet satırından ölçülür.
// ⚠️ Kök nedeni gidermez, belirtiyi azaltır.
//
// İKİ YOL: doğrudan Supabase (uygulamanın doğrudan okumaları) ve Worker `/isitma` (uygulamanın çoğu isteği).
// Bağlantılar bilerek kalıcı değil: ölçüm her turda yeni bağlantıyla yapıldı.
// 🔴 Anahtar ve sır LOG'A YAZILMAZ; yalnız yol adı, durum, süre.

const https = require('https');

const ARALIK_MS = 4 * 60 * 1000;
const ZAMAN_SINIRI_MS = 30_000;
const YAVAS_MS = 1000;
const OZET_TUR = 15; // ≈ saatte bir

/** SAF — ortamdan hedefleri kurar. Eksik ayar olan yol hiç eklenmez. `ortam` = process.env. */
function hedefleriKur(ortam) {
  const hedefler = [];
  const supabase = (ortam.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  const anon = ortam.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (supabase && anon) {
    hedefler.push({
      ad: 'dogrudan',
      url: `${supabase}/rest/v1/app_settings?select=updated_at&limit=1`,
      method: 'GET',
      headers: { apikey: anon, Authorization: `Bearer ${anon}` },
    });
  }
  const worker = (ortam.EXPO_PUBLIC_KAYMAK_WORKER_URL || '').replace(/\/$/, '');
  const sir = ortam.PI_SYNC_SECRET;
  if (worker && sir) {
    hedefler.push({ ad: 'worker', url: `${worker}/isitma`, method: 'POST', headers: { 'x-kaymak-sync-secret': sir } });
  }
  return hedefler;
}

/** Tek okuma → `{ durum, ms }`. Hiç fırlatmaz; `durum: 0` = ağ hatası ya da zaman aşımı. */
function oku(hedef) {
  return new Promise((coz) => {
    const bas = Date.now();
    const bitir = (durum) => coz({ durum, ms: Date.now() - bas });
    const istek = https.request(hedef.url, {
      method: hedef.method,
      headers: { ...hedef.headers, Connection: 'close' },
      agent: false,
      family: 4,
      timeout: ZAMAN_SINIRI_MS,
    }, (cevap) => {
      cevap.resume();
      cevap.on('end', () => bitir(cevap.statusCode));
      cevap.on('error', () => bitir(0));
    });
    istek.on('timeout', () => istek.destroy());
    istek.on('error', () => bitir(0));
    istek.end();
  });
}

function bosSayac(hedefler) {
  return Object.fromEntries(hedefler.map((h) => [h.ad, { tur: 0, yavas: 0, hata: 0 }]));
}

/** Bir tur: bütün yollar aynı anda. Sayacı günceller; hata ve yavaşlık yalnız sayılır. */
async function turKos(hedefler, sayac, okuFn = oku) {
  await Promise.all(hedefler.map(async (h) => {
    const { durum, ms } = await okuFn(h);
    const s = sayac[h.ad];
    s.tur += 1;
    if (durum < 200 || durum >= 300) s.hata += 1;
    else if (ms >= YAVAS_MS) s.yavas += 1;
  }));
}

/** SAF — Özet satırı. Adım 2 ölçümü `journalctl -u kaymak | grep isitma` ile buradan okunur. */
function ozetMetni(sayac) {
  return Object.entries(sayac).map(([ad, s]) => `${ad} tur=${s.tur} yavas=${s.yavas} hata=${s.hata}`).join(' · ');
}

function startSupabaseIsitma(ortam = process.env) {
  const hedefler = hedefleriKur(ortam);
  if (hedefler.length === 0) {
    console.warn('[isitma] Supabase/Worker ayarı yok, ısındırma kapalı.');
    return null;
  }
  let sayac = bosSayac(hedefler);
  let turSayisi = 0;
  const zamanlayici = setInterval(async () => {
    await turKos(hedefler, sayac);
    turSayisi += 1;
    if (turSayisi % OZET_TUR === 0) {
      console.log(`[isitma] ${ozetMetni(sayac)}`);
      sayac = bosSayac(hedefler);
    }
  }, ARALIK_MS);
  if (typeof zamanlayici.unref === 'function') zamanlayici.unref();
  return zamanlayici;
}

module.exports = { startSupabaseIsitma, hedefleriKur, turKos, ozetMetni, bosSayac, ARALIK_MS };
