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

let zamanlayici = null;
let sonKosuGunu = null;

/**
 * 🔴 BUGÜN ZATEN KOŞULDU MU? — `sync_log`'dan okunur, bellekten DEĞİL.
 * `sonKosuGunu` her yeniden başlatmada sıfırlanır; pencere içinde üç deploy
 * = üç tur olurdu. `runMirror` her turda `event='mirror'` satırı yazıyor
 * (hiçbir şey yapmasa bile) — o satır günün kalıcı kanıtı.
 */
function bugunAynalandiMi(simdi = new Date()) {
  const db = getDb();
  if (!db) return false;
  try {
    const gunBasi = new Date(simdi.getFullYear(), simdi.getMonth(), simdi.getDate()).getTime();
    const r = db.prepare("SELECT count(*) c FROM sync_log WHERE event = 'mirror' AND at >= ?").get(gunBasi);
    return (r && r.c) > 0;
  } catch (_) {
    // Okuyamıyorsak "koşulmadı" say — bir tur fazla koşmak zararsız
    // (upsert idempotent), hiç koşmamak ise aynayı bayatlatır.
    return false;
  }
}

/**
 * Gece zamanlayıcısını kurar. `server.js` açılışta bir kez çağırır.
 */
function startMirrorSchedule(config = {}) {
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

  const kontrolEt = () => {
    const simdi = new Date();
    const saat = simdi.getHours();
    const gun = simdi.toDateString();
    if (saat < PENCERE_BASI || saat >= PENCERE_SONU) return;
    if (sonKosuGunu === gun) return;
    if (bugunAynalandiMi(simdi)) { sonKosuGunu = gun; return; }
    sonKosuGunu = gun;
    runMirror(config).catch(() => { /* runMirror zaten yutuyor */ });
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
  const acilisKontrolu = setTimeout(kontrolEt, 120 * 1000);
  if (typeof acilisKontrolu.unref === 'function') acilisKontrolu.unref();

  if (typeof zamanlayici.unref === 'function') zamanlayici.unref();

  console.log(`[Ayna] Kuruldu — her gun ${PENCERE_BASI}:00-${PENCERE_SONU}:00.`);
  return zamanlayici;
}

function stopMirrorSchedule() {
  if (zamanlayici) { clearInterval(zamanlayici); zamanlayici = null; }
  sonKosuGunu = null;
}

module.exports = {
  startMirrorSchedule,
  stopMirrorSchedule,
  bugunAynalandiMi,
  PENCERE_BASI,
  PENCERE_SONU,
  KONTROL_ARALIGI_MS,
};
