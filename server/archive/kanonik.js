// ==========================================================================
// KANONİK ARŞİV SORGUSU — Paket C (M550) · dış denetim K-1, 2026-10-20 teyidi
// ==========================================================================
// SORUN (yeniden üretildi, R5): arşivin yuvası yalnız DİLİ ayırıyordu
// (`payloads(kaymak_id, provider, endpoint, lang)`), istek sorgusunun geri kalanını değil. Herkese
// açık `/api/trakt-catalog?endpoint=/shows/1388/seasons` (extended YOK) bölümsüz bir sezon listesi
// döndürür ve arşivdeki DOĞRU yükün üstüne yazardı; anlık aktarım da o dizinin bütün bölümlerini
// `runtime/first_aired = NULL` ile Supabase'e taşırdı. Canlıda olmadı (2026-10-20 taraması) ama tek
// bir istek yeterdi.
//
// KURAL: arşive YALNIZ bu sorgularla gelen yanıt yazılır. Önbellek her varyantı tutmaya devam eder
// (kendi anahtarı ayrı); bu dosya yalnız «kalıcı kayda ne girer» sorusunun cevabı.
//
// 🔴 LİSTE ÜRETİCİLERDEN ÇIKARILDI, TAHMİN EDİLMEDİ (Madde 286'nın dersi: kapı üreticiden ıraksarsa
// arşiv sessizce beslenmez). Kaynaklar — biri değişirse BU LİSTE DE değişmeli, test kilitliyor:
//   • istemci  `services/api/shows.ts`, `services/api/movies.ts`, `services/tmdbApi.ts`
//   • gece     `server/archive/backfillSource.js` (`uretFilm` / `uretDizi`)
//   • eksikte  `server/archive/eksikteCek.js` (`cekilecekler`)
const KANONIK = {
  trakt: {
    show_seasons: { extended: ['full,episodes'] },
    show_detail: { extended: ['full'], translations: ['tr', 'en'] },
    movie_detail: { extended: ['full'], translations: ['tr', 'en'] },
    episode_detail: { extended: ['full'], translations: ['tr', 'en'] },
  },
  tmdb: {
    tv_detail: { language: ['tr-TR', 'en-US'] },
    movie_detail: { language: ['tr-TR', 'en-US'] },
  },
};

/**
 * Bu (sağlayıcı, aile, sorgu) üçlüsü arşive yazılabilir mi? Sorguda TAM OLARAK beklenen anahtarlar
 * bulunmalı (fazlası da eksiği de reddedilir), değerler izinli kümeden olmalı. Saf — sınanır.
 * Kanonik tanımı olmayan aile `false` döner (arşivin zaten yazmadığı aileler).
 */
function kanonikMi(provider, family, query) {
  const beklenen = KANONIK[provider] && KANONIK[provider][family];
  if (!beklenen) return false;
  const q = query && typeof query === 'object' ? query : {};
  const dolu = Object.keys(q).filter((k) => q[k] !== undefined && q[k] !== null && q[k] !== '');
  if (dolu.length !== Object.keys(beklenen).length) return false;
  return Object.entries(beklenen).every(([anahtar, izinli]) => typeof q[anahtar] === 'string' && izinli.includes(q[anahtar]));
}

// ── KAPI SAYACI (M551 · Madde 286 güvencesi) ────────────────────────────────────────────────────
// SORUN: kapı reddettiğinde yanıt yalnız önbelleğe girer ve HİÇBİR iz kalmaz. İstemcinin GERÇEK bir
// çağrısı listeyle ıraksarsa arşiv sessizce beslenmez — Madde 286'nın aynısı. Bu sayaç, yayından
// hemen sonra «gerçek çağrılar kapıdan geçiyor mu?» sorusunu `/api/health` ile cevaplar.
//
// 🔒 Herkese açık uca çıkar: istek sorgusu YANSITILMAZ. Biçimde yalnız kanonik anahtar adları ve
// izinli değerler görünür; bilinmeyen anahtar yalnız SAYI, bilinmeyen değer `?`. Bellekte, süreç
// başından beri (yeniden başlatmada sıfırlanır). Arşive YAZMAZ (Paket D: işlem dışı yazım yok).
const KANONIK_ANAHTARLAR = new Set();
const IZINLI_DEGERLER = new Set();
for (const aileler of Object.values(KANONIK)) {
  for (const beklenen of Object.values(aileler)) {
    for (const [anahtar, izinli] of Object.entries(beklenen)) {
      KANONIK_ANAHTARLAR.add(anahtar);
      izinli.forEach((d) => IZINLI_DEGERLER.add(d));
    }
  }
}
const MAX_GUNLUK_SATIRI = 50; // süreç başına; değer başına yeni satır açılamasın

let sayac;
let gunluguYazilanlar;
function kapiSayaciniSifirla() {
  sayac = { gecen: 0, reddedilen: 0, aileler: Object.create(null) };
  gunluguYazilanlar = new Set();
}
kapiSayaciniSifirla();

/** Reddedilen sorgunun güvenli özeti: `extended=full · translations=? · +1 bilinmeyen` (saf). */
function sorguBicimi(query) {
  const q = query && typeof query === 'object' ? query : {};
  const parcalar = [];
  let bilinmeyen = 0;
  for (const anahtar of Object.keys(q).sort()) {
    const deger = q[anahtar];
    if (deger === undefined || deger === null || deger === '') continue;
    if (!KANONIK_ANAHTARLAR.has(anahtar)) { bilinmeyen += 1; continue; }
    const gorunen = Array.isArray(deger) ? `[${deger.length}]` : (IZINLI_DEGERLER.has(deger) ? deger : '?');
    parcalar.push(`${anahtar}=${gorunen}`);
  }
  if (bilinmeyen) parcalar.push(`+${bilinmeyen} bilinmeyen`);
  return parcalar.length ? parcalar.join(' · ') : '(bos)';
}

/**
 * Kapının kararını sayar. Kanonik tanımı OLMAYAN aile sayılmaz: arşivin zaten yazmadığı
 * aileler (trend, arama…) «ret» değil, kapsam dışı. ASLA throw etmez (sıcak yoldan çağrılır).
 */
function kapiKaydet(provider, family, query, gecti) {
  try {
    if (!(KANONIK[provider] && KANONIK[provider][family])) return;
    const ad = `${provider}/${family}`;
    const aile = sayac.aileler[ad] || (sayac.aileler[ad] = { gecen: 0, reddedilen: 0, sonRet: null });
    if (gecti) {
      sayac.gecen += 1;
      aile.gecen += 1;
      return;
    }
    sayac.reddedilen += 1;
    aile.reddedilen += 1;
    const bicim = sorguBicimi(query);
    aile.sonRet = { at: new Date().toISOString(), bicim };
    const iz = `${ad} ${bicim}`;
    if (!gunluguYazilanlar.has(iz) && gunluguYazilanlar.size < MAX_GUNLUK_SATIRI) {
      gunluguYazilanlar.add(iz);
      console.warn(`[arsiv] kanonik degil, arsive yazilmadi (yalniz onbellek): ${iz}`);
    }
  } catch (_) { /* sayaç, isteği bozamaz */ }
}

/** `/api/health` için kopya — çağıran değiştiremez. */
function kapiDurumu() {
  const aileler = {};
  for (const [ad, a] of Object.entries(sayac.aileler)) aileler[ad] = { ...a, sonRet: a.sonRet ? { ...a.sonRet } : null };
  return { gecen: sayac.gecen, reddedilen: sayac.reddedilen, aileler };
}

module.exports = { kanonikMi, KANONIK, kapiKaydet, kapiDurumu, sorguBicimi, kapiSayaciniSifirla };
