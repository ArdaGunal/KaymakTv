// ==========================================================================
// KATALOG AYNASI — Gece Zamanlayıcısı (Faz T · T0.3, dosya 2/2)
// ==========================================================================
// TEK İŞİ: `mirror.js`'in turunu her gün BİR KEZ, pencere içinde koşturmak.
//
// 🔴 `backfillSchedule.js` / `backup.js` desenlerinin ÜÇÜNCÜ İKİZİ. Bilerek:
// aynı problemin (günde bir kez, pencere içinde, süreç kapanmasını
// engellemeden, yeniden başlatmaya dayanıklı) zaten çalışan bir çözümü var.
// Dördüncü bir desen icat etmek, dördünün zamanla ıraksaması demekti.
//
// ==========================================================================
// 🔴 PENCERE SEÇİMİ — gece haritasındaki DÖRDÜNCÜ iş
// ==========================================================================
// Pi'de gece artık dört iş var ve hepsi aynı SSD'ye dokunuyor:
//
//   02:00-03:59  BACKFILL   arşive YAZAR + ağa çıkar
//   04:00-05:59  SÜPÜRÜCÜ   cache/'ten SİLER
//   05:00-06:59  YEDEK      VACUUM INTO ile arşivi KOPYALAR
//   07:00-08:59  AYNA       (bu dosya) arşivi OKUR + ağa çıkar
//
// Neden EN SONA konuldu, iki gerekçe:
//   1. Gecenin YENİ verisi aynı sabah aynalanmış olur — backfill 04:00'te
//      biter, ayna 07:00'de onu da alır. Öne alsaydık her gece bir gün
//      gecikirdi ve T0'ın "ayna gecikmesi < 24 saat" ölçütü sıkışırdı.
//   2. `VACUUM INTO` (yedek) kaynak veritabanında okuma kilidi tutuyor.
//      07:00 başlangıcı o pencerenin dışında kalıyor.
//
// ⚠️ Bu işin SSD baskısı diğer üçünden DÜŞÜK: arşivi yalnızca OKUR, hiçbir
// şey yazmaz (tek istisna `meta` tablosundaki tek satırlık imleç). Yazma
// tarafı ağa gidiyor. Yine de pencere ayrımı korundu — 2026-09-02'de sürücü
// `EIO` verip `usb-storage` moduna alınmıştı (Madde 285), pay geniş tutuluyor.
//
// ⚠️ TRAKT'A HİÇ DOKUNMAZ. Backfill'in devre kesici/hız sınırı endişeleri
// burada YOK; tek dış bağımlılık kendi Worker'ımız.

const { isArchiveEnabled, getDb } = require('./db');
const { runMirror } = require('./mirror');

const PENCERE_BASI = 7;
const PENCERE_SONU = 9;

const KONTROL_ARALIGI_MS = 60 * 60 * 1000;

// 🆕 M555 — AYNI SABAH YENİDEN DENEME. 2026-10-21 07:26 turu `supabase_zaman_asimi` ile düştü ve
// zamanlayıcı düşen turu da «bugün koşuldu» saydığı için gün boyu yeniden denenmedi (son 8 turun 4'ü
// düşmüştü). Artık: düşen turdan 20 dk sonra yeniden dene; günde en çok 3 deneme (upsert idempotent,
// imleç yalnız başarıda ilerler — tekrar denemek zararsız, sonsuz döngü ise bant israfı).
const YENIDEN_DENEME_MS = 20 * 60 * 1000;
const GUNLUK_EN_COK_DENEME = 3;

let zamanlayici = null;
let yenidenZamanlayici = null;
let tamamGunu = null;
let calisiyor = false;
const bellekDeneme = new Map(); // gün → bu süreçteki deneme sayısı (kesin üst sınır)

/**
 * 🔴 BUGÜNKÜ AYNA DURUMU — `sync_log`'dan okunur, bellekten DEĞİL (yeniden başlatmaya dayanıklı).
 * `runMirror` başarıda `yazilan=…`, düşüşte `… basarisiz: …` / `exception: …` satırı yazar.
 * @returns {{basarili: boolean, deneme: number}}
 */
function bugunkuAyna(simdi = new Date()) {
  const db = getDb();
  if (!db) return { basarili: false, deneme: 0 };
  try {
    const gunBasi = new Date(simdi.getFullYear(), simdi.getMonth(), simdi.getDate()).getTime();
    const satirlar = db.prepare("SELECT detail FROM sync_log WHERE event = 'mirror' AND at >= ?").all(gunBasi);
    return { basarili: satirlar.some((r) => String(r.detail || '').startsWith('yazilan=')), deneme: satirlar.length };
  } catch (_) {
    // Okuyamıyorsak "koşulmadı" say — bir tur fazla koşmak zararsız (upsert idempotent).
    return { basarili: false, deneme: 0 };
  }
}

/** Bugün BAŞARILI bir tur oldu mu? (M555'ten önce düşen tur da «oldu» sayılıyordu.) */
function bugunAynalandiMi(simdi = new Date()) {
  return bugunkuAyna(simdi).basarili;
}

/**
 * Gece zamanlayıcısını kurar. `server.js` açılışta bir kez çağırır.
 * İkinci parametre yalnız testler için (çalıştırıcı, saat, süreler).
 */
function startMirrorSchedule(config = {}, { kosucu = runMirror, saat = () => new Date(), yenidenMs = YENIDEN_DENEME_MS, acilisMs = 120 * 1000 } = {}) {
  if (!isArchiveEnabled()) {
    console.log('[Ayna] Kurulmadi — arsiv devre disi.');
    return null;
  }
  // 🔴 Yapılandırma yoksa SESSİZCE kurma. Her sabah "sir_yok" loglayan bir
  // zamanlayıcı gürültüden başka bir şey değil (backfill'deki aynı gerekçe).
  if (!process.env.EXPO_PUBLIC_KAYMAK_WORKER_URL) {
    console.log('[Ayna] Kurulmadi — EXPO_PUBLIC_KAYMAK_WORKER_URL yok.');
    return null;
  }
  if (!process.env.PI_SYNC_SECRET || process.env.PI_SYNC_SECRET.length < 32) {
    console.log('[Ayna] Kurulmadi — PI_SYNC_SECRET yok veya cok kisa.');
    return null;
  }
  if (zamanlayici) return zamanlayici;

  // `yenidenDeneme`: düşen turun ardından gelen deneme pencere sonunu (09:00) aşabilir — sayıyla sınırlı.
  const kontrolEt = ({ yenidenDeneme = false } = {}) => {
    const simdi = saat();
    const s = simdi.getHours();
    const gun = simdi.toDateString();
    if (!yenidenDeneme && (s < PENCERE_BASI || s >= PENCERE_SONU)) return;
    if (calisiyor || tamamGunu === gun) return;
    const durum = bugunkuAyna(simdi);
    const deneme = Math.max(durum.deneme, bellekDeneme.get(gun) || 0);
    if (durum.basarili || deneme >= GUNLUK_EN_COK_DENEME) { tamamGunu = gun; return; }
    calisiyor = true;
    bellekDeneme.set(gun, deneme + 1);
    Promise.resolve()
      .then(() => kosucu(config))
      .then((r) => {
        if (r && r.ok) { tamamGunu = gun; return; }
        if (deneme + 1 >= GUNLUK_EN_COK_DENEME) {
          console.error(`[Ayna] Bugun ${deneme + 1}. deneme de dustu — yarin pencerede yeniden.`);
          return;
        }
        console.error(`[Ayna] Tur dustu (${(r && r.reason) || '?'}) — ${Math.round(yenidenMs / 60000)} dk sonra yeniden (deneme ${deneme + 2}/${GUNLUK_EN_COK_DENEME}).`);
        if (yenidenZamanlayici) clearTimeout(yenidenZamanlayici);
        yenidenZamanlayici = setTimeout(() => { yenidenZamanlayici = null; kontrolEt({ yenidenDeneme: true }); }, yenidenMs);
        if (typeof yenidenZamanlayici.unref === 'function') yenidenZamanlayici.unref();
      })
      .catch(() => { /* runMirror zaten yutuyor */ })
      .finally(() => { calisiyor = false; });
  };

  zamanlayici = setInterval(kontrolEt, KONTROL_ARALIGI_MS);

  // 🔴 AÇILIŞ KONTROLÜ (Madde 296'nın dersi): `setInterval` ilk kontrolü bir
  // SAAT sonra yapar. Pencere 2 saat, aralık 1 saat — sunucu pencerenin SON
  // saatinde yeniden başlarsa o günün turu HİÇ KOŞMAZ ve ayna sessizce bir
  // gün bayatlar.
  //
  // ⏳ 120 sn: backfill'in 90 sn'sinden uzun, çünkü ayna açılışta tüm
  // payload'ları açıp runtime haritası kuruyor (CPU'lu bir iş) — sunucunun
  // önce isteklere cevap verebilir hale gelmesini bekliyoruz.
  const acilisKontrolu = setTimeout(kontrolEt, acilisMs);
  if (typeof acilisKontrolu.unref === 'function') acilisKontrolu.unref();

  if (typeof zamanlayici.unref === 'function') zamanlayici.unref();

  console.log(`[Ayna] Kuruldu — her gun ${PENCERE_BASI}:00-${PENCERE_SONU}:00, dusen tura ${Math.round(yenidenMs / 60000)} dk sonra yeniden (gunde en cok ${GUNLUK_EN_COK_DENEME}).`);
  return zamanlayici;
}

function stopMirrorSchedule() {
  if (zamanlayici) { clearInterval(zamanlayici); zamanlayici = null; }
  if (yenidenZamanlayici) { clearTimeout(yenidenZamanlayici); yenidenZamanlayici = null; }
  tamamGunu = null;
  calisiyor = false;
  bellekDeneme.clear();
}

module.exports = {
  startMirrorSchedule,
  stopMirrorSchedule,
  bugunAynalandiMi,
  bugunkuAyna,
  YENIDEN_DENEME_MS,
  GUNLUK_EN_COK_DENEME,
  PENCERE_BASI,
  PENCERE_SONU,
  KONTROL_ARALIGI_MS,
};
