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
const {
  fetchTakipEdilenler, hedefListesi, fetchImportHedefleri, tasiBekleyenleri,
} = require('./backfillSource');
const { eksikleriBul, bayatArsivHedefleri } = require('./backfill');
const { tamamla } = require('./backfillTamamla');
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

// ==========================================================================
// 📥 AKTARIM TURU — GECE KUYRUĞUNUN ÜÇÜNCÜ VE SON ÖNCELİĞİ (T5.3)
// ==========================================================================
// Kullanıcının mühürlü kuralı (2026-09-11): *"öncelik tıklananlar, en son ise
// listede kalanlar iner… o gün çok şey inmemişse inerler… veriyi
// filtrelemiyoruz."*
//
//   1. TIKLANANLAR   → zaten ANLIK yolda (LazyFetch A2 kancası); gece
//                      kuyruğuna HİÇ düşmez.
//   2. AKIŞ HEDEFLERİ → bugünkü talep (`feed_activities`), ÖNCE işlenir.
//   3. AKTARIM ARTIKLARI → bu tur. KALAN bütçeyle, EN SON.
//
// 🔴 BÜTÇE PAYLAŞILIYOR, EKLENMİYOR. `GECELIK_TAVAN` gecenin TAMAMI için;
// aktarım turu akış turundan ARTANI alır. Ayrı bir tavan vermek, "öncelik
// akışta" kuralını sayılarla çürütür ve SSD'yi iki kat yorardı (2026-09-02
// `EIO`, M285 — bu sayılar GEVŞETİLMEZ).
//
// ══════════════════════════════════════════════════════════════════════════
// 🔴 TAŞIMA İKİ KEZ ÇAĞRILIYOR — ama ASIL İŞİ YAPAN "ÖNCE" OLANI
// ══════════════════════════════════════════════════════════════════════════
// ÖLÇÜLDÜ (2026-09-12, M353 — ilk gerçek tur Pi'de koştu):
//
//   02:00-03:59  BACKFILL → indirilen yapım **Pi arşivine** (SQLite) yazılır
//   07:00-08:59  AYNA     → arşiv **Supabase'e** itilir (`mirror.js`)
//
// `046` bekleyen satırı **Supabase'in** `catalog_external_ids`'ine bakarak
// çözüyor. Yani bu gece indirilen yapım, ayna 07:00'de koşana kadar orada
// YOK — turdan SONRAKİ çağrı kendi gecesinin indirdiklerini **hiçbir zaman
// göremez**. O satırlar ERTESİ gecenin "ÖNCE" çağrısında erir (~19 saat).
//
// ⚠️ Bu bilinçli olarak KABUL EDİLDİ (kullanıcı, 2026-09-12): veri kaybı yok,
// politika bozulmuyor, sıra yalnızca gecikiyor. Aynayı bu pencereye sokmak
// 02:00-04:00'e DÖRDÜNCÜ bir SSD işi eklerdi ve pencere haritasının gerekçesi
// (M285 `EIO`) yeniden tartışılmalıydı. ⛔ "Sonraki çağrı işe yaramıyor,
// silelim" DEME: ayna bir gün bu pencereye taşınırsa tek işe yarayan o olur,
// ve bugün de ücreti tek bir RPC.
//
// `tasinan: 0` HER İKİSİNDE DE HATA DEĞİLDİR.

/**
 * Aktarım artıklarını işler. 🔴 ASLA THROW ETMEZ.
 *
 * @param {number} butce Akış turundan ARTAN hedef sayısı
 * @returns {Promise<Object>} log için özet
 */
async function aktarimTuru(butce, dil, fetcher) {
  const ozet = { calisti: false, oncekiTasima: null, sonrakiTasima: null, hedef: 0 };

  // ── 1) Turdan ÖNCE: çözülmüş bekleyenleri erit ──
  const once = await tasiBekleyenleri();
  ozet.oncekiTasima = once;
  if (!once.ok) {
    // Yapılandırma eksikse (sır/URL yok) bu bir HATA DEĞİL, bir DURUM —
    // aktarım hattı henüz kurulmamış olabilir. Loglanır, tur sessizce biter.
    logSync({ event: 'backfill', provider: 'trakt', detail: `aktarim: tasima atlandi (${once.reason})` });
    return ozet;
  }

  // Bekleyen hiç kalmadıysa hedef sormaya gerek yok — çıkış ölçütü bu.
  if (once.kalan === 0) {
    logSync({ event: 'backfill', provider: 'trakt', detail: `aktarim: bekleyen YOK (bu turda ${once.tasinan} eridi)` });
    return ozet;
  }

  if (butce <= 0) {
    logSync({
      event: 'backfill', provider: 'trakt',
      detail: `aktarim: butce yok, ${once.kalan} satir yarina kaldi (bu turda ${once.tasinan} eridi)`,
    });
    return ozet;
  }

  // ── 2) Hedefleri al ──
  // 🔑 Bütçe HEDEF sayısı, YAPIM sayısı değil: dizi 2 hedef (`show_detail` +
  // `show_seasons`), film 1. En kötü durumda hepsi dizi olabilir, o yüzden
  // yapım tavanı bütçenin YARISI istenir — `tamamla`'nın `limit`i zaten son
  // sözü söylüyor, bu yalnızca boşuna büyük liste çekmemek için.
  const liste = await fetchImportHedefleri({ limit: Math.max(1, Math.floor(butce / 2)) });
  if (!liste.ok) {
    logSync({ event: 'backfill', provider: 'trakt', detail: `aktarim: hedef listesi alinamadi (${liste.reason})` });
    return ozet;
  }

  const hedefler = hedefListesi(liste.items, dil);
  ozet.hedef = hedefler.length;
  const { kapsanan, beklemede, eksik } = eksikleriBul(hedefler);

  if (eksik.length) {
    ozet.calisti = true;
    ozet.sonuc = await tamamla({ hedefler: eksik, fetcher, limit: butce });
  }

  // ── 3) Turdan SONRA ──
  // ⚠️ Bu çağrı BU GECE inenleri eritemez (yukarıdaki ayna sırası); araya
  // giren başka bir yol satır çözmüşse yakalar. Ücreti tek RPC.
  const sonra = await tasiBekleyenleri();
  ozet.sonrakiTasima = sonra;

  const s = ozet.sonuc;
  logSync({
    event: 'backfill', provider: 'trakt',
    detail: `aktarim: yapim ${liste.items.length}, hedef ${hedefler.length} `
      + `(kapsanan ${kapsanan.length}, beklemede ${beklemede.length}, eksik ${eksik.length}), `
      + `butce ${butce}`
      + (s ? `, denenen ${s.denenen}, yazilan ${s.yazilan}, bulunamadi ${s.bulunamadi}, basarisiz ${s.basarisiz}` : ', denenen 0')
      + (s && s.durduranSebep ? `, DURDU: ${s.durduranSebep}` : '')
      + ` | tasima once ${once.tasinan}/${once.kalan}`
      + (sonra.ok ? `, sonra ${sonra.tasinan}/${sonra.kalan}` : `, sonra HATA (${sonra.reason})`),
  });

  return ozet;
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

    const fetcher = createTraktCatalogFetcher(clientId);
    const basladi = Date.now();

    // ── ÖNCELİK 2 · AKIŞ HEDEFLERİ (bugünkü talep) ──
    const hedefler = hedefListesi(kaynak.items, dil);

    // ── ÖNCELİK 3 · ARŞİVİN BAYAT DİZİLERİ (§C20, 2026-09-15) ──────────
    // 🔬 ÖLÇÜLDÜ: akış kaynağı yalnızca **38** dizi getiriyor
    // (`feed_activities`), oysa arşivde **210** devam eden dizi var ve
    // **171**inin `show_seasons` yükü 10 günden eski. Yani tazelik kuralı
    // doğru çalışıyordu ama göremediği 171 dizide yaklaşan bölüm tarihleri
    // kalıcı olarak bayatlıyordu — Silo bunlardan biriydi ve ancak ELLE
    // zorlanarak düzeldi (M377–M379).
    //
    // 🔴 SONA EKLENİYOR, başa değil. Bu bir BAKIM işi: gecelik bütçeyi
    // (`GECELIK_TAVAN`) asıl işten — hiç çekilmemiş yapımlar ve aktarımın
    // bekleyen satırları — çalmamalı. Tazeleme hedeflerini `eksikleriBul`
    // içinde sona koyarken verdiğimiz kararın aynısı.
    //
    // ⚠️ SABİTLERE DOKUNULMADI: tavan 30, yani 171 dizi ~6 gecede tam tur,
    // sonra kararlı durumda ~17/gece (171 ÷ 10 günlük eşik).
    // `GECELIK_TAVAN=200` ve 2,5 sn aralık aynen duruyor.
    const bayatlar = bayatArsivHedefleri(dil, { tavan: 30 });
    if (bayatlar.length) {
      hedefler.push(...bayatlar);
    }

    const { kapsanan, beklemede, eksik } = eksikleriBul(hedefler);
    const kapsamYuzde = hedefler.length ? ((kapsanan.length / hedefler.length) * 100).toFixed(1) : '0.0';

    // 🔴 EKSİK YOKSA HİÇBİR ŞEY YAPMA — ve bunu da LOGLA. "Sessizce hiçbir
    // şey yapmadı" ile "çalışmadı" ayırt edilebilir olmalı; Madde 284/286'nın
    // dersi tam olarak bu (fail-soft sessizdir).
    //
    // ⚠️ T5.3: burası ARTIK ERKEN DÖNMÜYOR. Dönseydi akış hedefleri tamken
    // aktarım artıkları HİÇ işlenmezdi — yani 875 satır tam da her şeyin
    // yolunda göründüğü gecelerde beklemeye devam ederdi.
    const sonuc = eksik.length
      ? await tamamla({ hedefler: eksik, fetcher, limit })
      : { denenen: 0, yazilan: 0, bulunamadi: 0, basarisiz: 0, onbellekten: 0, agdanCekilen: 0, zorlaCekilen: 0, yedektenDonen: 0, atlanan: 0, ardisikHata: 0, durduranSebep: null };

    logSync({
      event: 'backfill', provider: 'trakt',
      detail: eksik.length
        ? `akis: denenen ${sonuc.denenen}, yazilan ${sonuc.yazilan}, `
          + `bulunamadi ${sonuc.bulunamadi}, basarisiz ${sonuc.basarisiz}, `
          // 🆕 §C23: `zorla` = önbellek 10 günden eski olduğu için Trakt'a ZORLA
          // gidilen tazeleme hedefi. M387'de bu sayı olmadığı için "onbellekten 30"
          // satırının neyi gizlediği ancak zarflar tek tek açılarak anlaşıldı.
          + `onbellekten ${sonuc.onbellekten}, zorla ${sonuc.zorlaCekilen ?? 0}, kalan ${sonuc.atlanan}`
          + (sonuc.yedektenDonen ? `, yedekten ${sonuc.yedektenDonen}` : '')
          + (sonuc.durduranSebep ? `, DURDU: ${sonuc.durduranSebep}` : '')
          + ` | kapsam oncesi %${kapsamYuzde}`
        : `akis: eksik YOK, kapsam %${kapsamYuzde} (${kapsanan.length}/${hedefler.length}), beklemede ${beklemede.length}`,
    });

    // Ardışık hata freni devreye girdiyse bu operatörün GÖRMESİ gereken bir
    // olaydır — `journalctl`'e de düşsün, yalnızca `sync_log`'a değil.
    if (sonuc.durduranSebep === 'ardisik_hata') {
      console.error(`[Arsiv backfill] ERKEN DURDU — ${sonuc.ardisikHata} ardisik hata. Basarisiz uclar deftere isaretlendi.`);
    }

    // ── ÖNCELİK 3 · AKTARIM ARTIKLARI (kalan bütçeyle, EN SON) ──
    // 🔴 AKIŞ TURU FRENE TAKILDIYSA AKTARIM TURU HİÇ BAŞLAMAZ. Devre kesici
    // eşiğinin altında kalma güvencesi (`ARDISIK_HATA_TAVANI` < 5) TUR
    // BAŞINA sayılıyor; ikinci turu açmak sayacı sıfırdan başlatır ve aynı
    // gece toplam 6 hataya izin verir — yani tam olarak korunmak istenen
    // durumu üretirdi.
    const aktarim = sonuc.durduranSebep === 'ardisik_hata'
      ? { calisti: false, atlandi: 'akis_freni' }
      : await aktarimTuru(Math.max(limit - sonuc.denenen, 0), dil, fetcher);

    const sn = ((Date.now() - basladi) / 1000).toFixed(0);
    logSync({ event: 'backfill', provider: 'trakt', detail: `tur bitti (${sn} sn)` });

    return { ok: true, ...sonuc, kapsamYuzde, aktarim };
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
  aktarimTuru,
  startBackfillSchedule,
  stopBackfillSchedule,
  bugunKosulduMu,
  PENCERE_BASI,
  PENCERE_SONU,
  GECELIK_TAVAN,
  KONTROL_ARALIGI_MS,
};
