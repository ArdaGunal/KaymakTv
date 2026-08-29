#!/usr/bin/env node
// ==========================================================================
// ARŞİV YAZICI ÖLÇÜMÜ — A2'nin sayıları
// ==========================================================================
// NEDEN VAR: A2'nin stratejisi ("kimliği aç, payload'u tek parça bırak")
// bir dizinin TÜM bölümleri için `entities` + `external_ids` satırı açıyor.
// 10.000 dizide bu milyonlarca satır demek. Bunun Pi'de KABUL EDİLEBİLİR
// olup olmadığı VARSAYILAMAZ — ölçülür (Madde 233).
//
// 🔴 GERÇEK SSD'YE DOKUNMAZ: her koşum kendi geçici arşivini açar.
// Canlı sunucu çalışırken güvenle koşturulabilir.
//
// Kullanım (Pi'de, proje kökünde):
//   node scripts/arsiv-benchmark.js
//   node scripts/arsiv-benchmark.js general-hospital
//   API_URL=http://localhost:4830 node scripts/arsiv-benchmark.js
//
// Veri kaynağı: kendi `/api/trakt-catalog` geçidimiz (yani ölçüm aynı
// zamanda geçidin çalıştığını da doğruluyor).

const fs = require('fs');
const os = require('os');
const path = require('path');

const API_URL = process.env.API_URL || 'http://localhost:4830';
const KOK = fs.mkdtempSync(path.join(os.tmpdir(), 'arsiv-olcum-'));
process.env.ARCHIVE_ROOT = path.join(KOK, 'archive');
process.env.EXPO_PUBLIC_KAYMAK_WORKER_URL = '';

const AR = path.join(__dirname, '..', 'server', 'archive');
const db = require(path.join(AR, 'db'));
const { archiveShowSeasons } = require(path.join(AR, 'writer'));
const { resolveOrCreate, traktIdsToExternal } = require(path.join(AR, 'identity'));
const { transaction } = require(path.join(AR, 'db'));
const { upsertPayload, summary } = require(path.join(AR, 'store'));

const VARSAYILAN = ['breaking-bad', 'the-simpsons', 'general-hospital'];
const slugler = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const hedefler = slugler.length ? slugler : VARSAYILAN;

const ms = (n) => n.toFixed(1) + ' ms';
const mb = (n) => (n / 1048576).toFixed(2) + ' MB';
const kb = (n) => (n / 1024).toFixed(0) + ' KB';

/**
 * Arşiv dosyalarının toplam boyutu (.db + -wal + -shm).
 *
 * 🔴 ÖNCE WAL CHECKPOINT: checkpoint edilmemiş bir `-wal` dosyası, henüz
 * ana veritabanına taşınmamış sayfaları TEKRAR sayar — disk ölçümünü
 * şişirir. İlk taslakta bu yapılmamıştı ve rakam yanıltıcı çıktı.
 */
function arsivBoyutu(kokDizin = path.join(KOK, 'archive')) {
  const h = db.getDb();
  if (h) {
    try { h.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } catch (_) { /* onemli degil */ }
  }
  if (!fs.existsSync(kokDizin)) return 0;
  return fs.readdirSync(kokDizin).reduce((t, f) => t + fs.statSync(path.join(kokDizin, f)).size, 0);
}

/** Temiz, boş bir arşiv açar (karşılaştırmalar aynı koşullardan başlasın). */
function temizArsiv(ad) {
  db.closeArchive();
  const yol = path.join(KOK, ad);
  process.env.ARCHIVE_ROOT = yol;
  const d = db.initArchive();
  if (!d.enabled) throw new Error('temiz arsiv acilamadi: ' + d.reason);
  return yol;
}

async function cek(slug) {
  const url = `${API_URL}/api/trakt-catalog?endpoint=/shows/${slug}/seasons&extended=full,episodes`;
  const t0 = performance.now();
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} — ${url}`);
  const metin = await r.text();
  return { data: JSON.parse(metin), bayt: Buffer.byteLength(metin), sure: performance.now() - t0, hit: r.headers.get('x-lazyfetch') };
}

/**
 * Hiyerarşiyi yazar. `tekTransaction=false` iken `resolveOrCreate`'in
 * KENDİ transaction'ı devreye girer — yani satır başına bir commit.
 *
 * 🔴 ADİL KARŞILAŞTIRMA ŞARTLARI (ilk taslakta üçü de ihlal edilmişti):
 *   1. Her varyant TEMİZ, BOŞ bir arşive yazar (indeks derinliği aynı).
 *   2. AYNI veriyi yazar.
 *   3. Satırlar HENÜZ YOKTUR — yani ikisi de INSERT yolunu ölçer.
 *      İlk ölçümde naif varyant, satırların zaten var olduğu bir
 *      veritabanına yazıp UPDATE yolunu ölçmüştü ve "daha hızlı" çıkmıştı.
 */
function hiyerarsiYaz(seasons, slug, tekTransaction, sinir = Infinity) {
  let sayac = 0;
  const is = () => {
    const dizi = resolveOrCreate({ type: 'show', externalIds: [{ source: 'trakt:slug', source_id: slug }] });
    sayac++;
    for (const sezon of seasons) {
      if (sayac >= sinir) break;
      const sk = traktIdsToExternal('season', sezon.ids);
      if (!sk.length) continue;
      const s = resolveOrCreate({ type: 'season', externalIds: sk, parentId: dizi.kaymak_id, seasonNumber: sezon.number });
      sayac++;
      for (const bolum of sezon.episodes || []) {
        if (sayac >= sinir) break;
        const bk = traktIdsToExternal('episode', bolum.ids);
        if (!bk.length) continue;
        resolveOrCreate({ type: 'episode', externalIds: bk, parentId: s.kaymak_id, seasonNumber: sezon.number, episodeNumber: bolum.number });
        sayac++;
      }
    }
  };

  const t0 = performance.now();
  if (tekTransaction) transaction(is);
  else is();
  return { sure: performance.now() - t0, satir: sayac };
}

(async () => {
  const d = db.initArchive();
  if (!d.enabled) {
    console.error('Arsiv acilamadi: ' + d.reason);
    process.exit(1);
  }
  console.log(`\nArsiv olcumu — gecici kok: ${process.env.ARCHIVE_ROOT}`);
  console.log(`Kaynak: ${API_URL}/api/trakt-catalog\n`);

  const satirlar = [];

  for (const slug of hedefler) {
    let cekim;
    try {
      cekim = await cek(slug);
    } catch (e) {
      console.log(`  ${slug}: ATLANDI (${e.message})`);
      continue;
    }

    const sezonSayisi = cekim.data.length;
    const bolumSayisi = cekim.data.reduce((t, s) => t + ((s.episodes || []).length), 0);
    if (!sezonSayisi) {
      console.log(`  ${slug}: ATLANDI (bos yanit — Trakt [] dondu)`);
      continue;
    }

    const oncekiBoyut = arsivBoyutu();

    // --- İLK YAZIM (tek transaction) ---
    const t0 = performance.now();
    const r1 = archiveShowSeasons({ showId: slug, seasons: cekim.data, lang: 'tr' });
    const ilkSure = performance.now() - t0;

    // --- İKİNCİ YAZIM (idempotent — A2 her yenilemede bunu yapacak) ---
    const t1 = performance.now();
    const r2 = archiveShowSeasons({ showId: slug, seasons: cekim.data, lang: 'tr' });
    const ikinciSure = performance.now() - t1;

    const buyume = arsivBoyutu() - oncekiBoyut;
    const satirSayisi = (r1.seasons || 0) + (r1.episodes || 0) + 1;

    satirlar.push({
      slug, sezonSayisi, bolumSayisi, hamBayt: cekim.bayt,
      ilkSure, ikinciSure, buyume, satirSayisi,
      atlanan: r1.skipped, hit: cekim.hit,
      ikinciYeni: r2.ok,
    });

    console.log(
      `  ${slug.padEnd(20)} ${String(sezonSayisi).padStart(3)} sezon ${String(bolumSayisi).padStart(6)} bolum  ` +
      `${kb(cekim.bayt).padStart(8)}  ilk ${ms(ilkSure).padStart(11)}  tekrar ${ms(ikinciSure).padStart(11)}  disk +${kb(buyume).padStart(8)}`
    );
    if (r1.skipped) console.log(`  ${' '.repeat(20)} ⚠️  ${r1.skipped} kayit kimliksiz/bozuk oldugu icin atlandi`);
  }

  if (!satirlar.length) {
    console.error('\nHicbir olcum yapilamadi.');
    process.exit(1);
  }

  const oz = summary();
  const toplamSatir = satirlar.reduce((t, r) => t + r.satirSayisi, 0);
  const toplamSure = satirlar.reduce((t, r) => t + r.ilkSure, 0);
  const toplamDisk = arsivBoyutu();
  const entityBasina = toplamDisk / Math.max(1, oz.entities);

  console.log('\n' + '='.repeat(74));
  console.log('OZET (WAL checkpoint sonrasi)');
  console.log('='.repeat(74));
  console.log(`  Entity                : ${oz.entities.toLocaleString('tr-TR')}`);
  console.log(`  external_ids          : ${oz.externalIds.toLocaleString('tr-TR')}`);
  console.log(`  Payload               : ${oz.payloads} adet, ${kb(oz.bytes)} (gzip'li)`);
  console.log(`  Toplam arsiv dosyasi  : ${mb(toplamDisk)}`);
  console.log(`  Entity basina disk    : ${entityBasina.toFixed(0)} bayt`);
  console.log(`  Yazim hizi            : ${(toplamSatir / (toplamSure / 1000)).toFixed(0)} entity/sn`);

  // ------------------------------------------------------------------
  // TRANSACTION KARSILASTIRMASI — ADIL KOSULLARDA
  // ------------------------------------------------------------------
  const enBuyuk = satirlar.reduce((a, b) => (b.bolumSayisi > a.bolumSayisi ? b : a));
  const veri = (await cek(enBuyuk.slug)).data;
  const SINIR = 3000; // tamamini iki kez yazmak gereksiz; oran bu boyutta netlesiyor

  temizArsiv('kiyas-tek');
  const tek = hiyerarsiYaz(veri, 'kiyas-tek', true, SINIR);
  const tekDisk = arsivBoyutu(path.join(KOK, 'kiyas-tek'));

  temizArsiv('kiyas-satir');
  const satirBasina = hiyerarsiYaz(veri, 'kiyas-satir', false, SINIR);
  const satirDisk = arsivBoyutu(path.join(KOK, 'kiyas-satir'));

  console.log(`\n  TRANSACTION KARSILASTIRMASI (ayni veri, ayni satir sayisi, IKI TEMIZ arsiv):`);
  console.log(`    Tek transaction   : ${ms(tek.sure).padStart(11)}  ${(tek.satir / (tek.sure / 1000)).toFixed(0).padStart(7)} entity/sn  disk ${kb(tekDisk)}`);
  console.log(`    Satir basina      : ${ms(satirBasina.sure).padStart(11)}  ${(satirBasina.satir / (satirBasina.sure / 1000)).toFixed(0).padStart(7)} entity/sn  disk ${kb(satirDisk)}`);
  const kat = satirBasina.sure / tek.sure;
  console.log(`    -> tek transaction ${kat.toFixed(1)}x ${kat >= 1 ? 'HIZLI' : 'YAVAS'}  (${tek.satir} satir)`);

  // ------------------------------------------------------------------
  // PROJEKSIYON — 🔴 ORTALAMA DEGIL, BOLUM BASINA
  // ------------------------------------------------------------------
  // Ilk taslak uc dizinin entity ORTALAMASINI aliyordu; `general-hospital`
  // (10.833 bolumluk pembe dizi) ortalamayi tek basina 4.000'e cikarip
  // 72 GB gibi anlamsiz bir projeksiyon uretiyordu. Dogru olcu birimi
  // BOLUM BASINA maliyet — dizi sayisi degil, bolum sayisi belirleyici.
  const toplamBolum = satirlar.reduce((t, r) => t + r.bolumSayisi, 0);
  const bolumBasinaDisk = toplamDisk / Math.max(1, toplamBolum);
  const bolumBasinaSure = toplamSure / Math.max(1, toplamBolum);

  console.log('\n  BIRIM MALIYET (projeksiyonun dogru tabani):');
  console.log(`    Bolum basina disk : ${bolumBasinaDisk.toFixed(0)} bayt`);
  console.log(`    Bolum basina sure : ${(bolumBasinaSure * 1000).toFixed(0)} mikrosaniye`);

  console.log('\n  SENARYOLAR:');
  for (const [ad, dizi, bolumOrt] of [
    ['Kucuk  (1.000 dizi x 40 bolum)', 1000, 40],
    ['Orta   (10.000 dizi x 60 bolum)', 10000, 60],
    ['Buyuk  (50.000 dizi x 60 bolum)', 50000, 60],
  ]) {
    const b = dizi * bolumOrt;
    console.log(
      `    ${ad.padEnd(34)} ${(b).toLocaleString('tr-TR').padStart(10)} bolum  ` +
      `~${mb(b * bolumBasinaDisk).padStart(9)}  ~${(b * bolumBasinaSure / 1000 / 60).toFixed(1)} dk yazim`
    );
  }
  console.log('='.repeat(74));
  console.log('\n  NOT: bu sayilar bu makinede olculdu. Pi sayilari FARKLI olur —');
  console.log('  ayni komutu Pi\'de calistir, karar oradaki sayiya gore verilir.\n');

  db.closeArchive();
  fs.rmSync(KOK, { recursive: true, force: true });
})().catch((e) => {
  console.error('Olcum coktu:', e.message);
  try { fs.rmSync(KOK, { recursive: true, force: true }); } catch (_) {}
  process.exit(2);
});
