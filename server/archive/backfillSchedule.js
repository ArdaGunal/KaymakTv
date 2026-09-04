// ==========================================================================
// KATALOG ARŞİVİ — Backfill Gece Zamanlayıcısı (A3/2, dosya 3/3)
// ==========================================================================
// TEK İŞİ: `backfill.js`'in motorunu her gece BİR KEZ, canlı trafiğin en
// düşük olduğu saatte çalıştırmak.
//
// NEDEN VAR: A3/2 elle koşturuldu ve kapsam %100'e çıktı (Madde 288) — ama
// bu bir FOTOĞRAF. Kullanıcılar yeni dizi/film işaretledikçe kapsam düşer.
// Zamanlayıcı olmadan "%100" iddiası bir hafta içinde bayatlar, ve A4'ün
// (bağımsızlık anahtarı) dayandığı sayı tam olarak bu.
//
// 🔴 `backup.js`'in `startBackupSchedule` deseninin İKİZİ. Bilerek: aynı
// problemin (günde bir kez, pencere içinde, süreç kapanmasını engellemeden)
// zaten çalışan bir çözümü var. İkinci bir desen icat etmek, ikisinin
// zamanla ıraksaması demekti.

const { isArchiveEnabled, getDb } = require('./db');
const { logSync } = require('./store');
const { fetchTakipEdilenler, hedefListesi } = require('./backfillSource');
const { tamamla, eksikleriBul } = require('./backfill');
const { getLazyFetchStatus } = require('../lazyfetch/paths');
const { createTraktCatalogFetcher } = require('../lazyfetch/providers/trakt');

// ==========================================================================
// 🔴 PENCERE SEÇİMİ — ÖLÇÜLEREK DEĞİL, ÇAKIŞMA HARİTASINA GÖRE
// ==========================================================================
// Pi'de gece üç iş var ve HEPSİ AYNI SSD'ye dokunuyor:
//
//   02:00-03:59  BACKFILL   (bu dosya)      arşive YAZAR + ağa çıkar
//   04:00-05:59  SÜPÜRÜCÜ   (sweeper.js)    cache/'ten SİLER
//   05:00-06:59  YEDEK      (backup.js)     VACUUM INTO ile arşivi KOPYALAR
//
// Backfill EN BAŞTA çünkü iki gerekçe var:
//   1. Gecenin yeni verisi AYNI GECE yedeklenmiş olur (backfill 04:00'ten
//      önce biter, yedek 05:00'te başlar). Ters sırada yeni veri bir gün
//      yedeksiz kalırdı — Madde 284'te arşivin 40 MB'ı tam olarak böyle
//      yedeksiz kalmıştı.
//   2. `VACUUM INTO` kaynak veritabanında okuma kilidi tutar. Yazımların
//      onunla çakışması `busy_timeout`a takılıp fail-soft loglanır (istek
//      düşmez ama yazım kaybedilir). Pencereleri ayırmak bunu imkânsız
//      kılıyor.
//
// ⚠️ SSD I/O'sunu üst üste bindirmemek ayrı bir gerekçe: sürücü 2026-09-02'de
// `EIO` verdi ve `usb-storage` (BOT) moduna alındı (Madde 285).
const PENCERE_BASI = 2;
const PENCERE_SONU = 4;

const KONTROL_ARALIGI_MS = 60 * 60 * 1000;

/**
 * Bir gecede denenecek EN FAZLA hedef.
 *
 * 🔴 SAYI ÖLÇÜLDÜ (Madde 288): ilk tam tur 171 hedefti ve 468 sn sürdü.
 * Yani 200 hedef ≈ 9 dakika — 02:00-04:00 penceresine rahat sığıyor.
 *
 * Tavanın asıl işi hız değil GÜVENLİK: Supabase listesi bir gün beklenmedik
 * şekilde büyürse (yeni kullanıcı dalgası, veri göçü) zamanlayıcı bütün
 * geceyi Trakt'a istek atarak geçirmesin. Kalanlar ertesi gece alınır —
 * arşiv aceleci bir sistem değil.
 */
const GECELIK_TAVAN = 200;

let zamanlayici = null;
let sonKosuGunu = null;

/**
 * 🔴 BUGÜN ZATEN KOŞULDU MU? — `sync_log`'dan okunur, bellekten DEĞİL.
 *
 * `sonKosuGunu` her yeniden başlatmada sıfırlanıyor. Açılış kontrolüyle
 * birlikte bu tek başına yetmezdi: pencere içinde üç deploy = üç tur.
 * `runBackfill` her turda `sync_log`'a `event='backfill'` satırı yazıyor
 * (eksik olmasa bile — "sessizce hiçbir şey yapmadı" ile "çalışmadı"
 * ayırt edilebilsin diye). O satır günün kalıcı kanıtı.
 */
function bugunKosulduMu(simdi = new Date()) {
  const db = getDb();
  if (!db) return false;
  try {
    const gunBasi = new Date(simdi.getFullYear(), simdi.getMonth(), simdi.getDate()).getTime();
    const r = db.prepare("SELECT count(*) c FROM sync_log WHERE event = 'backfill' AND at >= ?").get(gunBasi);
    return (r && r.c) > 0;
  } catch (_) {
    // Okuyamıyorsak "koşulmadı" say — bir tur fazla koşmak, hiç
    // koşmamaktan iyidir (tur zaten eksik yoksa hiçbir şey yapmıyor).
    return false;
  }
}

/**
 * Bir gecelik turu çalıştırır.
 *
 * 🔴 ASLA THROW ETMEZ. Zamanlayıcıdan çağrılıyor; buradan sızan bir hata
 * `unhandledRejection` ile sunucuyu düşürebilirdi. `queue.js`'in
 * "kuyruk hiçbir koşulda çökmemeli" güvencesiyle aynı sözleşme.
 */
async function runBackfill({ limit = GECELIK_TAVAN, dil = 'tr' } = {}) {
  try {
    if (!isArchiveEnabled()) return { ok: false, reason: 'arsiv_kapali' };
    if (!getLazyFetchStatus().enabled) return { ok: false, reason: 'lazyfetch_kapali' };

    const clientId = process.env.EXPO_PUBLIC_TRAKT_CLIENT_ID;
    if (!clientId) return { ok: false, reason: 'trakt_client_id_yok' };

    const kaynak = await fetchTakipEdilenler({
      url: process.env.EXPO_PUBLIC_SUPABASE_URL,
      anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    });
    if (!kaynak.ok) {
      logSync({ event: 'backfill', provider: 'trakt', detail: `kaynak okunamadi: ${kaynak.reason}` });
      return { ok: false, reason: kaynak.reason };
    }

    const hedefler = hedefListesi(kaynak.items, dil);
    const { kapsanan, beklemede, eksik } = eksikleriBul(hedefler);

    // 🔴 EKSİK YOKSA HİÇBİR ŞEY YAPMA — ve bunu da LOGLA. "Sessizce hiçbir
    // şey yapmadı" ile "çalışmadı" ayırt edilebilir olmalı; Madde 284/286'nın
    // dersi tam olarak bu (fail-soft sessizdir).
    const kapsamYuzde = hedefler.length ? ((kapsanan.length / hedefler.length) * 100).toFixed(1) : '0.0';
    if (!eksik.length) {
      logSync({
        event: 'backfill', provider: 'trakt',
        detail: `tur bitti: eksik YOK, kapsam %${kapsamYuzde} (${kapsanan.length}/${hedefler.length}), beklemede ${beklemede.length}`,
      });
      return { ok: true, denenen: 0, yazilan: 0, kapsamYuzde };
    }

    const basladi = Date.now();
    const sonuc = await tamamla({
      hedefler: eksik,
      fetcher: createTraktCatalogFetcher(clientId),
      limit,
    });
    const sn = ((Date.now() - basladi) / 1000).toFixed(0);

    logSync({
      event: 'backfill', provider: 'trakt',
      detail: `tur bitti (${sn} sn): denenen ${sonuc.denenen}, yazilan ${sonuc.yazilan}, `
        + `bulunamadi ${sonuc.bulunamadi}, basarisiz ${sonuc.basarisiz}, `
        + `onbellekten ${sonuc.onbellekten}, kalan ${sonuc.atlanan}`
        + (sonuc.durduranSebep ? `, DURDU: ${sonuc.durduranSebep}` : '')
        + ` | kapsam oncesi %${kapsamYuzde}`,
    });

    // Ardışık hata freni devreye girdiyse bu operatörün GÖRMESİ gereken bir
    // olaydır — `journalctl`'e de düşsün, yalnızca `sync_log`'a değil.
    if (sonuc.durduranSebep === 'ardisik_hata') {
      console.error(`[Arsiv backfill] ERKEN DURDU — ${sonuc.ardisikHata} ardisik hata. Basarisiz uclar deftere isaretlendi.`);
    }

    return { ok: true, ...sonuc, kapsamYuzde };
  } catch (error) {
    // Buraya düşmek bir GÜVENCE: zamanlayıcı sunucuyu düşüremez.
    try {
      logSync({ event: 'backfill', provider: 'trakt', detail: `tur cokmesi: ${error.message}` });
    } catch (_) { /* log da patlarsa sessizce vazgec */ }
    console.error('[Arsiv backfill] Tur coktu:', error.message);
    return { ok: false, reason: error.message };
  }
}

/**
 * Gece zamanlayıcısını kurar. `server.js` açılışta bir kez çağırır.
 * Arşiv kapalıysa hiç kurulmaz (`backup.js`/`sweeper.js` ile aynı desen).
 */
function startBackfillSchedule(config = {}) {
  if (!isArchiveEnabled()) {
    console.log('[Arsiv backfill] Kurulmadi — arsiv devre disi.');
    return null;
  }
  // 🔴 Supabase yapılandırması yoksa SESSİZCE kurma. Her gece "kaynak
  // okunamadi" loglayan bir zamanlayıcı, gürültüden başka bir şey değil.
  if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    console.log('[Arsiv backfill] Kurulmadi — Supabase yapilandirmasi eksik.');
    return null;
  }
  if (zamanlayici) return zamanlayici;

  const kontrolEt = () => {
    const simdi = new Date();
    const saat = simdi.getHours();
    const gun = simdi.toDateString();
    if (saat < PENCERE_BASI || saat >= PENCERE_SONU) return;
    if (sonKosuGunu === gun) return;
    if (bugunKosulduMu(simdi)) { sonKosuGunu = gun; return; }
    sonKosuGunu = gun;
    runBackfill(config).catch(() => { /* runBackfill zaten yutuyor */ });
  };

  zamanlayici = setInterval(kontrolEt, KONTROL_ARALIGI_MS);

  // ==================================================================
  // 🔴 AÇILIŞ KONTROLÜ — bkz. `backup.js` (Madde 296)
  // ==================================================================
  // `setInterval` ilk kontrolü bir SAAT sonra yapar. Pencere 2 saat,
  // aralık 1 saat: sunucu pencerenin SON SAATİNDE yeniden başlarsa o
  // günün turu HİÇ KOŞMAZ. Backfill'de sonucu daha sinsi: kapsam sessizce
  // düşer ve A4'ün dayandığı sayı bayatlar — kimse fark etmez.
  //
  // ⏳ 90 sn gecikme: sunucu önce isteklere cevap verebilir hale gelsin
  // (backfill ağa çıkıyor ve arşive yazıyor).
  const acilisKontrolu = setTimeout(kontrolEt, 90 * 1000);
  if (typeof acilisKontrolu.unref === 'function') acilisKontrolu.unref();

  // Süreç kapanmasını engellemesin (sweeper.js/backup.js'teki aynı gerekçe).
  if (typeof zamanlayici.unref === 'function') zamanlayici.unref();

  console.log(`[Arsiv backfill] Kuruldu — her gun ${PENCERE_BASI}:00-${PENCERE_SONU}:00, gecelik tavan ${config.limit || GECELIK_TAVAN} hedef.`);
  return zamanlayici;
}

function stopBackfillSchedule() {
  if (zamanlayici) { clearInterval(zamanlayici); zamanlayici = null; }
  sonKosuGunu = null;
}

module.exports = {
  runBackfill,
  startBackfillSchedule,
  stopBackfillSchedule,
  bugunKosulduMu,
  PENCERE_BASI,
  PENCERE_SONU,
  GECELIK_TAVAN,
  KONTROL_ARALIGI_MS,
};
