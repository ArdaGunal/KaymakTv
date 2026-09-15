// ==========================================================================
// ARŞİV SAYAÇLARI — "bir şey kayboldu mu?" (§C22)
// ==========================================================================
// TEK İŞİ: her gece `entities` · `external_ids` · `payloads` satır sayısını
// ölçüp `sync_log`'a yazmak ve **sayı DÜŞERSE alarm vermek.**
//
// ==========================================================================
// 🔴 NEDEN VAR — ölçülmüş bir olaydan doğdu, varsayımdan değil
// ==========================================================================
// 2026-09-14'te `external_ids`'ten bir satır kayboldu
// (`trakt:episode/14418567`). Mühürlü karar #9 *"`entities` + `external_ids`
// + `payloads`'ta fiziksel DELETE yok"* diyor. Silen kod depoda YOK; taramada
// tek eşleşme silmenin REDDEDİLDİĞİNİ doğrulayan bir test.
//
// 🔑 ASIL MESELE SİLMENİN KENDİSİ DEĞİL: kaybı fark etmemiz **bir gün sonra,
// tesadüfen**, ilgisiz bir borcu (§C16) kovalarken oldu. Kanıtı da koddan
// değil GECE YEDEKLERİNDEN çıkarabildik. Yani arşivin, kaybettiğini
// söyleyebilecek hiçbir organı yoktu.
//
// Bu dosya o organdır. Silmeyi ENGELLEMEZ — engelleyemez de, çünkü kayıp
// koddan gelmedi. Yaptığı şey **kaybı GÖRÜNÜR kılmak**: bir daha olursa
// ertesi sabah `sync_log`'da `error` satırı olarak durur.
//
// ⚠️ Kardeş madde §C16: orada defter YAZAMIYORDU, burada defter KAYBI
// GÖREMİYORDU. §C16 bunun ön koşuluydu — `sync_log.event` CHECK'i
// kalkmadan `event:'sayac'` yazılamazdı (o kısıt aynanın sekiz günlük
// çıktısını yutmuştu).
//
// ==========================================================================
// 🔴 TOPLAM SAYILIYOR, "EMEKLİ OLMAYAN" DEĞİL
// ==========================================================================
// `store.js summary()` `external_ids`'i `retired_at IS NULL` süzgeciyle
// sayıyor — orada doğru, burada FELAKET olurdu: §C20'nin mezar taşı bir
// eşlemeyi emekli ettiğinde o sayı düşer ve sayaç **her kimlik değişiminde
// sahte alarm** verirdi. Mezar taşının bütün amacı satırın DURMASI.
// Buradaki soru "kaç eşleme geçerli" değil, "kaç satır var".
//
// ==========================================================================
// 🔴 DÜŞÜŞ HER ZAMAN ARIZA DEĞİL — AMA HER ZAMAN HABERE DEĞER
// ==========================================================================
// Arşiv eski bir yedekten geri yüklenirse sayılar meşru biçimde düşer.
// Alarm yine de doğrudur: o da bilinmesi gereken bir olaydır. Mesaj bu
// yüzden "bozuldu" demiyor, NE OLDUĞUNU söylüyor.

const { isArchiveEnabled, getDb } = require('./db');
const { logSync } = require('./store');

// Gece haritasındaki BEŞİNCİ iş. Sıra:
//   02:00-03:59  BACKFILL   arşive YAZAR
//   04:00-05:59  SÜPÜRÜCÜ   cache/'ten siler
//   05:00-06:59  YEDEK      VACUUM INTO
//   07:00-08:59  AYNA       arşivi OKUR
//   09:00-10:59  SAYAÇ      (bu dosya) — EN SONA, çünkü gecenin TÜM
//                           yazmaları bittikten sonraki sayı anlamlı olan.
const PENCERE_BASI = 9;
const PENCERE_SONU = 11;
const KONTROL_ARALIGI_MS = 60 * 60 * 1000;

// ⚠️ KAPSAM = mühürlü karar #9'un kapsamı. `sync_log` BİLEREK DIŞARIDA:
// şemasının kendi başlığı onun budanabilir olduğunu söylüyor, yani
// düşmesi ihlal değil.
const IZLENEN = ['entities', 'external_ids', 'payloads'];

// `stats.js resetFallbackStats()` `meta`'da `fallback_aile_%` siliyor —
// bu önek ona çarpmıyor (kontrol edildi, 2026-09-15).
const META_ONEKI = 'sayac_';

let zamanlayici = null;
let sonKosuGunu = null;

/** `meta`'daki önceki sayım; yoksa `null`. */
function oncekiOku(db) {
  const onceki = {};
  let varMi = false;
  for (const t of IZLENEN) {
    const r = db.prepare('SELECT value FROM meta WHERE key = ?').get(META_ONEKI + t);
    if (r && r.value !== null && r.value !== undefined) {
      const n = parseInt(r.value, 10);
      if (Number.isFinite(n)) { onceki[t] = n; varMi = true; }
    }
  }
  return varMi ? onceki : null;
}

function guncelOku(db) {
  const simdiki = {};
  for (const t of IZLENEN) {
    simdiki[t] = db.prepare(`SELECT count(*) c FROM ${t}`).get().c;
  }
  return simdiki;
}

/**
 * Bir sayım turu. Zamanlayıcıdan BAĞIMSIZ çağrılabilir (test + elle bakım).
 *
 * 🔴 THROW ETMEZ. Sayaç bir gözlem organı; kendi arızası arşivi durdurmamalı.
 * Ama §C16'nın dersi gereği **sessiz de kalmaz** — patlarsa `console.error`.
 *
 * @returns {{ok: boolean, reason?: string, ilk?: boolean, dusus?: string[],
 *   simdiki?: object, onceki?: object|null, emekli?: number}}
 */
function sayimYap() {
  const db = getDb();
  if (!db) return { ok: false, reason: 'arsiv_kapali' };

  try {
    const simdiki = guncelOku(db);
    const onceki = oncekiOku(db);
    const emekli = db
      .prepare('SELECT count(*) c FROM external_ids WHERE retired_at IS NOT NULL')
      .get().c;

    // ── DÜŞÜŞ VAR MI ────────────────────────────────────────────────────
    const dusus = [];
    if (onceki) {
      for (const t of IZLENEN) {
        if (onceki[t] === undefined) continue;
        if (simdiki[t] < onceki[t]) {
          dusus.push(`${t} ${onceki[t]} -> ${simdiki[t]} (${simdiki[t] - onceki[t]})`);
        }
      }
    }

    // 🔴 ALARM ÖNCE YAZILIYOR. Normal `sayac` satırı da yazılacak ama sıra
    // önemli: alarm yazımı patlarsa bile normal satır turu tamamlamasın diye
    // değil — tam tersi, alarm KAYBOLMASIN diye önce o gidiyor.
    if (dusus.length) {
      logSync({
        event: 'error',
        detail:
          'SAYAC DUSUSU: ' + dusus.join(' | ')
          + ' — arsivde fiziksel silme YOK (muhurlu karar #9). '
          + 'Yedekten geri yukleme yapildiysa bu beklenen bir dususttur; '
          + 'yapilmadiysa bir satir kaybolmus demektir (§C22).',
      });
      console.error('[Arsiv sayac] 🔴 DUSUS: ' + dusus.join(' | '));
    }

    // ── NORMAL KAYIT ────────────────────────────────────────────────────
    // Düşüş olmasa BİLE yazılıyor. "Sessizce hiçbir şey yapmadı" ile
    // "çalışmadı" ayırt edilebilmeli — §C16'nın tam da bu satırda
    // başarısız olduğu ironisi kayıtlara geçti.
    const parcalar = IZLENEN.map((t) => {
      if (!onceki || onceki[t] === undefined) return `${t} ${simdiki[t]}`;
      const d = simdiki[t] - onceki[t];
      return `${t} ${simdiki[t]} (${d >= 0 ? '+' : ''}${d})`;
    });
    logSync({
      event: 'sayac',
      detail:
        (onceki ? 'sayac: ' : 'sayac: ILK SAYIM (taban) — ')
        + parcalar.join(' | ') + ` | emekli ${emekli}`,
    });

    // ── TABANI GÜNCELLE ─────────────────────────────────────────────────
    const yaz = db.prepare(
      'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    );
    for (const t of IZLENEN) yaz.run(META_ONEKI + t, String(simdiki[t]));
    yaz.run(META_ONEKI + 'at', String(Date.now()));

    return { ok: true, ilk: !onceki, dusus, simdiki, onceki, emekli };
  } catch (error) {
    console.error(`[Arsiv sayac] 🔴 Tur patladi: ${error.message}`);
    return { ok: false, reason: error.message };
  }
}

/**
 * 🔴 BUGÜN SAYILDI MI? — `sync_log`'dan okunur, bellekten DEĞİL.
 * `sonKosuGunu` her yeniden başlatmada sıfırlanır; pencere içinde üç deploy
 * üç tur olurdu. (`mirrorSchedule.bugunAynalandiMi` ile aynı gerekçe.)
 */
function bugunSayildiMi(simdi = new Date()) {
  const db = getDb();
  if (!db) return false;
  try {
    const gunBasi = new Date(simdi.getFullYear(), simdi.getMonth(), simdi.getDate()).getTime();
    const r = db
      .prepare("SELECT count(*) c FROM sync_log WHERE event = 'sayac' AND at >= ?")
      .get(gunBasi);
    return (r && r.c) > 0;
  } catch (_) {
    // Okuyamıyorsak "sayılmadı" say — fazladan bir sayım zararsız (yalnızca
    // okuma + tek satır), hiç saymamak ise organı kör bırakır.
    return false;
  }
}

/** Gece zamanlayıcısını kurar. `server.js` açılışta bir kez çağırır. */
function startSayacSchedule() {
  if (!isArchiveEnabled()) {
    console.log('[Arsiv sayac] Kurulmadi — arsiv devre disi.');
    return null;
  }
  if (zamanlayici) return zamanlayici;

  const kontrolEt = () => {
    const simdi = new Date();
    const saat = simdi.getHours();
    const gun = simdi.toDateString();
    if (saat < PENCERE_BASI || saat >= PENCERE_SONU) return;
    if (sonKosuGunu === gun) return;
    if (bugunSayildiMi(simdi)) { sonKosuGunu = gun; return; }
    sonKosuGunu = gun;
    sayimYap();
  };

  zamanlayici = setInterval(kontrolEt, KONTROL_ARALIGI_MS);

  // 🔴 AÇILIŞ KONTROLÜ (Madde 296): `setInterval` ilk kontrolü bir SAAT
  // sonra yapar. Pencere 2 saat, aralık 1 saat — sunucu pencerenin SON
  // saatinde yeniden başlarsa o günün sayımı HİÇ koşmazdı.
  //
  // ⏳ 30 sn: aynanın 120 sn'sinden kısa, çünkü bu iş üç `count(*)`ten
  // ibaret — ağa çıkmıyor, payload açmıyor, CPU harcamıyor.
  const acilisKontrolu = setTimeout(kontrolEt, 30 * 1000);
  if (typeof acilisKontrolu.unref === 'function') acilisKontrolu.unref();
  if (typeof zamanlayici.unref === 'function') zamanlayici.unref();

  console.log(`[Arsiv sayac] Kuruldu — her gun ${PENCERE_BASI}:00-${PENCERE_SONU}:00.`);
  return zamanlayici;
}

function stopSayacSchedule() {
  if (zamanlayici) { clearInterval(zamanlayici); zamanlayici = null; }
  sonKosuGunu = null;
}

module.exports = {
  sayimYap,
  bugunSayildiMi,
  startSayacSchedule,
  stopSayacSchedule,
  IZLENEN,
  META_ONEKI,
  PENCERE_BASI,
  PENCERE_SONU,
  KONTROL_ARALIGI_MS,
};
