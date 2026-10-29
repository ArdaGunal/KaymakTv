// ==========================================================================
// KATALOG ARŞİVİ — Backfill Aktarım Turu (gece kuyruğunun son önceliği)
// ==========================================================================
// 2026-10-29: `backfillSchedule.js` 400 satırı geçince oradan AYNEN taşındı
// (Parça E). Davranış ve gerekçeler değişmedi; çağıran yine `runBackfill`.

const { logSync } = require('./store');
const { hedefListesi, fetchImportHedefleri, tasiBekleyenleri } = require('./backfillSource');
const { eksikleriBul } = require('./backfill');
const { tamamla } = require('./backfillTamamla');

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

module.exports = { aktarimTuru };
