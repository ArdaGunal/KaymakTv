// ==========================================================================
// YARIŞ KORUMASI — BAĞLANTI DENETİMİ (M322)
// ==========================================================================
// Çalıştır:  node tests/ilerleme/yaris-baglanti.test.js
//
// 🔴 NEDEN DAVRANIŞ TESTİ DEĞİL, BAĞLANTI DENETİMİ:
// Korumanın mantığı üç satır (`nesil değiştiyse yanıtı at`). O üç satırı
// testte yeniden yazıp doğrulamak hiçbir şey kanıtlamaz. GERÇEK risk,
// korumanın BEŞ mutasyon dalının hepsine bağlanmamış olması — M311'in
// "9 eksik import 66 testi yeşil geçti" dersi tam olarak bu sınıftan.
//
// Bu dosya `progress.ts`'i kaynak olarak okuyup her dalın:
//   1. nesli ARTIRDIĞINI,
//   2. tazelemeyi PLANLADIĞINI (ağ turunu beklemediğini),
//   3. tazelemenin nesil kontrolü YAPTIĞINI
// doğruluyor.
const fs = require('node:fs');
const path = require('node:path');

const KOK = path.resolve(__dirname, '..', '..');
const src = fs.readFileSync(
  path.join(KOK, 'services', 'library', 'mutations', 'progress.ts'), 'utf8');
const satirlar = src.split(/\r?\n/);

let gecti = 0, kaldi = 0;
const bekle = (ad, kosul, ipucu = '') => {
  console.log(`  ${kosul ? '✅' : '⛔'} ${ad}${kosul ? '' : '  → ' + ipucu}`);
  kosul ? gecti++ : kaldi++;
};

// ── Dışa açılan async mutasyonları bloklara ayır ─────────────────────────
const baslar = [];
satirlar.forEach((l, i) => {
  const m = l.match(/^export const ([A-Za-z]+) = async/);
  if (m) baslar.push({ ad: m[1], bas: i });
});
const blok = (ad) => {
  const i = baslar.findIndex((b) => b.ad === ad);
  if (i < 0) return null;
  const son = i + 1 < baslar.length ? baslar[i + 1].bas : satirlar.length;
  return satirlar.slice(baslar[i].bas, son).join('\n');
};

const KAYMAK_DALLARI = [
  'markEpisodeAsWatched',
  'unwatchEpisode',
  'unwatchSeason',
  'markSeasonAsWatched',
  'markEpisodesUpToAsWatched',
];

console.log('\n═══ Her Kaymak dalı yarış korumasına bağlı mı? ═══');
for (const ad of KAYMAK_DALLARI) {
  const g = blok(ad);
  if (!g) { bekle(ad + ' bulundu', false, 'fonksiyon yok'); continue; }
  bekle(`${ad}: nesli artırıyor`, /nesliArtir\(showId\)/.test(g),
    'uçuştaki bayat tazelemeler bayat sayılmaz');
  bekle(`${ad}: tazelemeyi planlıyor`, /tazelemeyiPlanla\(showId\)/.test(g),
    'tazeleme hiç çalışmaz ya da ağ turu beklenir');
  bekle(`${ad}: ağ turunu BEKLEMİYOR`, !/return await kaymakIlerlemeTazele\(showId\);/.test(g),
    'beklerse bayat yanıt ekranı geri düşürür');
}

console.log('\n═══ Koruma mekanizmasının kendisi ═══');
bekle('nesil sayacı tanımlı', /const ilerlemeNesli = new Map<number, number>\(\)/.test(src));
bekle('bekleyen tazeleme haritası tanımlı', /const bekleyenTazeleme = new Map/.test(src));
bekle('gecikme penceresi tanımlı', /TAZELEME_GECIKMESI_MS\s*=\s*\d+/.test(src));
bekle('planlayıcı öncekini İPTAL ediyor (birleştirme)',
  /clearTimeout\(mevcut\)/.test(src), 'her basış ayrı istek üretir, oran sınırı yenir');
bekle('🔴 tazeleme BAYAT YANITI atıyor',
  /ilerlemeNesli\.get\(showId\) \?\? 0\) !== beklenenNesil/.test(src),
  'hatanın kendisi: eski yanıt yeni durumu ezer');
bekle('iyimser durum DİSKE yazılıyor',
  /persistShowProgressMap\(useLibraryStore\.getState\(\)\.showProgressMap\)/.test(src),
  'tazeleme beklenmediği için kalıcılık kaybolur');
bekle('ilerleme yoksa ağ turu BEKLENİYOR (ilk açılış)',
  /if \(!yerel\) return await kaymakIlerlemeTazele\(showId, nesil\)/.test(src),
  'ilk kez açılan dizide kullanıcı boş ekran görür');

console.log(`\n${kaldi ? '⛔ ' + kaldi + ' KALDI' : '🎉 TÜMÜ GEÇTİ'} — geçen ${gecti}, kalan ${kaldi}`);
process.exit(kaldi ? 1 : 0);
