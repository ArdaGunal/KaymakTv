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
const { fetchTakipEdilenler, hedefListesi, hedefAnahtari } = require('./backfillSource');
// 2026-10-29: aktarım turu 400 satır sınırı yüzünden kendi dosyasına taşındı (davranış aynı).
const { aktarimTuru } = require('./backfillAktarim');
const { celiskiHedefleri } = require('./tutarlilik');
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

/**
 * Arşivin kendi bayat dizilerinden gecede en fazla kaç tanesi (§C20).
 * 🆕 Parça E (2026-10-29): 30 → 60. Ölçüldü: 306 devam eden dizide 10 günden
 * bayat 48 birikmişti (en eskisi 12 gün) — 30/gece ve 3/7 gece 522 ile kaçan tur
 * kuyruğu eritemiyordu. +30 hedef ≈ +2-3 dk, `GECELIK_TAVAN` içinde.
 */
const BAYAT_TAVAN = 60;

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
async function runBackfill({
  limit = GECELIK_TAVAN, dil = 'tr',
  // Yalnız test enjeksiyonu — canlıda varsayılanlar.
  kaynakOku = fetchTakipEdilenler, fetcher: verilenFetcher = null, tamamlaFn = tamamla, aktarimFn = aktarimTuru,
} = {}) {
  try {
    if (!isArchiveEnabled()) return { ok: false, reason: 'arsiv_kapali' };
    if (!getLazyFetchStatus().enabled) return { ok: false, reason: 'lazyfetch_kapali' };

    const clientId = process.env.EXPO_PUBLIC_TRAKT_CLIENT_ID;
    if (!clientId) return { ok: false, reason: 'trakt_client_id_yok' };

    const kaynak = await kaynakOku({
      url: process.env.EXPO_PUBLIC_SUPABASE_URL,
      anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    });
    // 🆕 Parça E (2026-10-29): kaynak düşerse tur İPTAL OLMAZ. Eskiden burada
    // `return` vardı ve Supabase'e hiç ihtiyacı olmayan arşiv tazelemesi de
    // atlanıyordu — ölçüldü: 10-24, 10-25, 10-28 «kaynak okunamadi: http 522».
    // Supabase'e muhtaç iki adım (akış, aktarım) atlanır; arşivinkiler sürer.
    if (!kaynak.ok) {
      logSync({ event: 'backfill', provider: 'trakt', detail: `kaynak okunamadi: ${kaynak.reason} — yalniz arsiv tazelemesi` });
    }

    const fetcher = verilenFetcher || createTraktCatalogFetcher(clientId);
    const basladi = Date.now();

    // ── ÖNCELİK 1 · ÇELİŞKİLİ DİZİLER (Parça E, `tutarlilik.js`) ──
    // Özet sezon listesinden fazla bölüm biliyor → yeni bölüm/sezon kesin var.
    const celiskiler = celiskiHedefleri(dil);

    // ── ÖNCELİK 2 · AKIŞ HEDEFLERİ (bugünkü talep) ──
    const hedefler = [...celiskiler, ...(kaynak.ok ? hedefListesi(kaynak.items, dil) : [])];

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
    // ⚠️ `GECELIK_TAVAN=200` ve 2,5 sn aralık aynen duruyor; tavan `BAYAT_TAVAN`.
    const bayatlar = bayatArsivHedefleri(dil, { tavan: BAYAT_TAVAN });
    if (bayatlar.length) {
      hedefler.push(...bayatlar);
    }

    // Aynı hedef birden fazla kaynaktan gelebilir (çelişkili dizi aynı zamanda
    // bayat da olabilir) — İLK geçen, yani yüksek öncelikli kopya kalır.
    const gorulen = new Set();
    const tekil = hedefler.filter((h) => {
      const a = hedefAnahtari(h);
      if (gorulen.has(a)) return false;
      gorulen.add(a);
      return true;
    });
    hedefler.length = 0;
    hedefler.push(...tekil);

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
      ? await tamamlaFn({ hedefler: eksik, fetcher, limit })
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
          + ` | kapsam oncesi %${kapsamYuzde}, celiski ${celiskiler.length}`
        : `akis: eksik YOK, kapsam %${kapsamYuzde} (${kapsanan.length}/${hedefler.length}), beklemede ${beklemede.length}, celiski ${celiskiler.length}`,
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
    // Parça E: aktarım da Supabase'e muhtaç — kaynak düştüyse denenmez.
    let aktarim;
    if (sonuc.durduranSebep === 'ardisik_hata') aktarim = { calisti: false, atlandi: 'akis_freni' };
    else if (!kaynak.ok) aktarim = { calisti: false, atlandi: 'kaynak_okunamadi' };
    else aktarim = await aktarimFn(Math.max(limit - sonuc.denenen, 0), dil, fetcher);

    const sn = ((Date.now() - basladi) / 1000).toFixed(0);
    logSync({ event: 'backfill', provider: 'trakt', detail: `tur bitti (${sn} sn)` });

    return { ok: true, ...sonuc, kapsamYuzde, aktarim, celiski: celiskiler.length, ...(kaynak.ok ? {} : { kaynakHatasi: kaynak.reason }) };
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
  BAYAT_TAVAN,
  KONTROL_ARALIGI_MS,
};
