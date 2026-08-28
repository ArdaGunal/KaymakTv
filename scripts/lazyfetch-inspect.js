#!/usr/bin/env node
// ==========================================================================
// LazyFetch Denetçisi — "SSD'de ne var?" sorusunun cevabı
// ==========================================================================
// NEDEN VAR: cache dosya adları SHA-256 hash'i (key.js). Yani
// `ls $LAZYFETCH_ROOT/cache` çıktısına bakarak neyin indiğini anlamak
// İMKÂNSIZ. Bu araç zarfları açıp içeriği İNSAN DİLİNE çevirir.
//
// Salt-okunur: hiçbir şey silmez, yazmaz, değiştirmez. Sunucu çalışırken
// güvenle kullanılır.
//
// Kullanım (Pi'de, proje kökünde):
//   LAZYFETCH_ROOT=/mnt/SSD1/KaymakTv/LazyFetch node scripts/lazyfetch-inspect.js
//   ... node scripts/lazyfetch-inspect.js --list episode_detail
//   ... node scripts/lazyfetch-inspect.js --find "Breaking Bad"
//   ... node scripts/lazyfetch-inspect.js --check /tv/1396
//
// Ayrıntı: docs/runbook/LAZYFETCH_OPS.md

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const zlib = require('zlib');

const LF = path.join(__dirname, '..', 'server', 'lazyfetch');
const { initLazyFetchPaths, getLazyFetchDir, getLazyFetchStatus } = require(path.join(LF, 'paths'));
const { buildCacheKey } = require(path.join(LF, 'key'));
const { getEnvelopeState, SCHEMA_VERSION } = require(path.join(LF, 'envelope'));

// --------------------------------------------------------------------------
// Zarftan "bu kayıt NE?" bilgisini çıkarır.
// Aile başına farklı alanlar taşıyor — TMDB'nin kendi yanıt şekilleri.
// --------------------------------------------------------------------------
function describe(envelope) {
  if (envelope.isNegative) return '(negatif kayıt — TMDB "bu içerik yok" dedi)';
  const p = envelope.payload;
  if (!p || typeof p !== 'object') return '(boş/tanınmayan içerik)';

  switch (envelope.family) {
    case 'tv_detail':
      return `${p.name || p.original_name || '?'} · ${p.number_of_seasons ?? '?'} sezon · ${p.number_of_episodes ?? '?'} bölüm`;
    case 'movie_detail':
      return `${p.title || p.original_title || '?'} (${(p.release_date || '').slice(0, 4) || '?'})`;
    case 'episode_detail':
      return `S${String(p.season_number ?? '?').padStart(2, '0')}E${String(p.episode_number ?? '?').padStart(2, '0')} — ${p.name || '?'}${p.air_date ? ' · ' + p.air_date : ''}`;
    case 'tv_images':
      return `${(p.posters || []).length} afiş · ${(p.backdrops || []).length} arka plan · ${(p.logos || []).length} logo`;
    case 'tv_videos':
    case 'movie_videos':
      return `${(p.results || []).length} video (fragman vb.)`;
    case 'credits':
    case 'episode_credits':
      return `${(p.cast || []).length} oyuncu · ${(p.crew || []).length} ekip`;
    default:
      return '(bilinmeyen aile)';
  }
}

/** Kayıt hangi diziye/filme ait — arama ve gruplama için. */
function titleOf(envelope) {
  const p = envelope.payload;
  if (!p || typeof p !== 'object') return '';
  return p.name || p.title || p.original_name || p.original_title || '';
}

/** 1 MB altını KB göster — "0.0 MB" kimseye bir şey anlatmıyor. */
function fmtSize(bytes) {
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function fmtAge(ms) {
  const dk = Math.round(ms / 60000);
  if (dk < 60) return `${dk} dk`;
  const sa = Math.round(dk / 60);
  if (sa < 48) return `${sa} sa`;
  return `${Math.round(sa / 24)} gün`;
}

// --------------------------------------------------------------------------
// ASCII GERİ DÜŞÜŞÜ
// --------------------------------------------------------------------------
// 🔴 GERÇEK BİR SORUNDAN DOĞDU: Pi'ye SSH ile bağlanıldığında çıktı
// `kayÄ±t` / `ğŸ“¦` şeklinde bozuk göründü. Node UTF-8 yazıyor; bozan şey
// terminalin/SSH istemcisinin Latin-1 yorumlaması. Doğru kalıcı çözüm
// terminal tarafında (`LANG=C.UTF-8`), AMA bir teşhis aracı, teşhis
// edilecek ortamda okunaksız olmayı göze alamaz — bu yüzden kendi
// geri düşüşü var.
//
// Otomatik algılama: `LANG`/`LC_ALL` açıkça "utf" demiyorsa ASCII'ye
// düşülür (temkinli yön — bozuk çıktı yerine sade çıktı). `--ascii`
// bayrağı ile zorlanabilir.
const ASCII =
  process.argv.includes('--ascii') ||
  process.env.LAZYFETCH_ASCII === '1' ||
  !/utf-?8/i.test(process.env.LC_ALL || process.env.LC_CTYPE || process.env.LANG || '');

// ASCII modunda hem Türkçe harfler hem işaretler sadeleştirilir. Tek bir
// harita: her çıktı satırı `say()`'den geçtiği için çağrı yerlerinde
// koşul yazmaya gerek kalmıyor.
const SADE = {
  ç: 'c', Ç: 'C', ğ: 'g', Ğ: 'G', ı: 'i', İ: 'I', ö: 'o', Ö: 'O',
  ş: 's', Ş: 'S', ü: 'u', Ü: 'U', '·': '-', '—': '-', '’': "'",
  '│': '|', '┌': '+', '└': '+', '─': '-', '→': '->', '“': '"', '”': '"',
  '📦': '#', '🎬': '*', '💡': '>', '📋': '=', '📭': '-', '🔎': '?', '🔬': '>',
  '⚠️': '!', '⚠': '!', '✅': 'OK', '❌': 'HATA', '⚪': 'o',
  '🟢': '', '🟡': '', '🔴': '', '️': '',
};
const SADE_RE = new RegExp(Object.keys(SADE).join('|'), 'g');

function tr(s) {
  if (!ASCII) return s;
  return String(s).replace(SADE_RE, (c) => SADE[c] ?? c);
}

/** Tüm çıktı buradan geçer — tek noktadan sadeleştirme. */
function say(line = '') {
  console.log(tr(line));
}

const DURUM = ASCII
  ? { fresh: '[TAZE ]', stale: '[BAYAT]', expired: '[DOLDU]' }
  : { fresh: '🟢 taze', stale: '🟡 bayat', expired: '🔴 süresi dolmuş' };

/**
 * Aile satırındaki taze/bayat/dolmuş üçlüsü. ASCII modunda renkli
 * daireler kaybolduğu için sayılar etiketlenir — aksi halde satır
 * sonunda anlamsız bir "3 0 0" kalırdı.
 */
function dagilim(g) {
  return ASCII
    ? `taze:${g.taze} bayat:${g.bayat} doldu:${g.dolmus}`
    : `🟢${g.taze} 🟡${g.bayat} 🔴${g.dolmus}`;
}

// --------------------------------------------------------------------------
async function readEnvelope(file) {
  try {
    const raw = await fsp.readFile(file);
    return JSON.parse(zlib.gunzipSync(raw).toString('utf8'));
  } catch (error) {
    return { __bozuk: error.message };
  }
}

async function collect(cacheDir) {
  const rows = [];
  async function walk(dir) {
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        await walk(full);
      } else if (e.name.endsWith('.json.gz')) {
        const envelope = await readEnvelope(full);
        const stat = await fsp.stat(full).catch(() => null);
        rows.push({ file: full, envelope, size: stat ? stat.size : 0 });
      }
    }
  }
  await walk(cacheDir);
  return rows;
}

// --------------------------------------------------------------------------
function ozet(rows) {
  const now = Date.now();
  const byFamily = new Map();
  let bozuk = 0;
  let negatif = 0;
  let toplamBayt = 0;

  for (const r of rows) {
    toplamBayt += r.size;
    if (r.envelope.__bozuk) { bozuk++; continue; }
    if (r.envelope.isNegative) negatif++;
    const f = r.envelope.family || '(bilinmiyor)';
    if (!byFamily.has(f)) byFamily.set(f, { adet: 0, bayt: 0, taze: 0, bayat: 0, dolmus: 0 });
    const g = byFamily.get(f);
    g.adet++;
    g.bayt += r.size;
    const st = getEnvelopeState(r.envelope, SCHEMA_VERSION, now);
    if (st === 'fresh') g.taze++;
    else if (st === 'stale') g.bayat++;
    else g.dolmus++;
  }

  say(`\n📦 TOPLAM: ${rows.length} kayıt · ${fmtSize(toplamBayt)}`);
  if (negatif) say(`   ${negatif} negatif kayıt ("içerik yok" bilgisi)`);
  if (bozuk) say(`   ⚠️  ${bozuk} okunamayan dosya`);

  say('\n┌─ AİLE BAZINDA ─────────────────────────────────────────────────');
  const sirali = [...byFamily.entries()].sort((a, b) => b[1].adet - a[1].adet);
  const ACIKLAMA = {
    tv_detail: 'dizi künyesi (sezon/bölüm SAYISI, özet, tür)',
    movie_detail: 'film künyesi',
    episode_detail: 'BÖLÜM detayı (başlık, özet, yayın tarihi, kare)',
    episode_credits: 'bölüm kadrosu',
    credits: 'dizi/film kadrosu',
    tv_images: 'dizi görselleri (afiş/arka plan/logo)',
    tv_videos: 'dizi fragmanları',
    movie_videos: 'film fragmanları',
  };
  for (const [f, g] of sirali) {
    const ad = f.replace('tmdb/', '');
    say(
      `│ ${ad.padEnd(18)} ${String(g.adet).padStart(5)} kayıt  ${fmtSize(g.bayt).padStart(9)}   ` +
      dagilim(g)
    );
    if (ACIKLAMA[ad]) say(`│ ${' '.repeat(18)} └─ ${ACIKLAMA[ad]}`);
  }
  say('└────────────────────────────────────────────────────────────────');

  // Bölüm verisi sorusu — kullanıcının en çok merak ettiği şey.
  const bolum = byFamily.get('episode_detail');
  say('\n🎬 SEZON/BÖLÜM DURUMU');
  if (bolum && bolum.adet > 0) {
    say(`   ✅ TMDB bölüm detayı iniyor: ${bolum.adet} bölüm kaydı`);
  } else {
    say('   ⚪ Henüz TMDB bölüm detayı inmemiş (bir bölüm ekranı açılınca iner)');
  }
  say('   ⚠️  Sezon/bölüm LİSTESİ (hangi sezonlar, kaç bölüm) TRAKT\'tan geliyor');
  say('       ve Pi\'yi HİÇ görmüyor → cache\'lenmiyor. Bu, L7 fazının konusu.');
}

function listele(rows, aile) {
  const now = Date.now();
  const filtre = rows.filter((r) => !r.envelope.__bozuk && (r.envelope.family || '').includes(aile));
  if (!filtre.length) {
    say(`\n"${aile}" ailesinde kayıt yok. Aileler: tv_detail, movie_detail, episode_detail, credits, tv_images, tv_videos, movie_videos, episode_credits`);
    return;
  }
  say(`\n📋 ${aile} — ${filtre.length} kayıt\n`);
  filtre
    .sort((a, b) => (b.envelope.fetchedAt || 0) - (a.envelope.fetchedAt || 0))
    .forEach((r) => {
      const st = getEnvelopeState(r.envelope, SCHEMA_VERSION, now);
      const yas = r.envelope.fetchedAt ? fmtAge(now - r.envelope.fetchedAt) : '?';
      say(`  ${DURUM[st] || st}  ${yas.padStart(7)} önce  ${(r.size / 1024).toFixed(1).padStart(6)} KB  ${describe(r.envelope)}`);
    });
}

function ara(rows, terim) {
  const now = Date.now();
  const q = terim.toLocaleLowerCase('tr');
  const bulunan = rows.filter((r) => !r.envelope.__bozuk && titleOf(r.envelope).toLocaleLowerCase('tr').includes(q));
  if (!bulunan.length) {
    say(`\n"${terim}" için kayıt bulunamadı.`);
    say('Not: bölüm/kadro kayıtları dizi adını TAŞIMAZ (TMDB yanıtında yok) — bu arama');
    say('yalnızca dizi/film künyelerini bulur. Belirli bir dizinin TÜM kayıtları için:');
    say('  node scripts/lazyfetch-inspect.js --check /tv/<tmdbId>');
    return;
  }
  say(`\n🔎 "${terim}" — ${bulunan.length} eşleşme\n`);
  bulunan.forEach((r) => {
    const st = getEnvelopeState(r.envelope, SCHEMA_VERSION, now);
    say(`  ${DURUM[st] || st}  [${(r.envelope.family || '').replace('tmdb/', '')}]  ${describe(r.envelope)}`);
  });
}

/**
 * Belirli bir TMDB yolunun cache'te olup olmadığını KESİN olarak söyler —
 * taramaya gerek yok, anahtarı yeniden hesaplayıp dosyaya bakar.
 * "Şu dizi indi mi?" sorusunun kanıta dayalı cevabı.
 */
async function kontrol(cacheDir, tmdbPath) {
  const AILELER = [
    ['tv_detail', (p) => /^\/tv\/\d+$/.test(p)],
    ['movie_detail', (p) => /^\/movie\/\d+$/.test(p)],
    ['tv_images', (p) => /^\/tv\/\d+\/images$/.test(p)],
    ['tv_videos', (p) => /^\/tv\/\d+\/videos$/.test(p)],
    ['movie_videos', (p) => /^\/movie\/\d+\/videos$/.test(p)],
    ['episode_detail', (p) => /^\/tv\/\d+\/season\/\d+\/episode\/\d+$/.test(p)],
    ['credits', (p) => /^\/(tv|movie)\/\d+\/credits$/.test(p)],
    ['episode_credits', (p) => /^\/tv\/\d+\/season\/\d+\/episode\/\d+\/credits$/.test(p)],
  ];

  // Kullanıcı `/tv/1396` verdiyse o dizinin TÜM akrabalarını da dene.
  const tvMatch = /^\/tv\/(\d+)$/.exec(tmdbPath);
  const adaylar = tvMatch
    ? [tmdbPath, `${tmdbPath}/images`, `${tmdbPath}/videos`, `${tmdbPath}/credits`]
    : [tmdbPath];

  say(`\n🔬 "${tmdbPath}" kontrolü\n`);
  for (const aday of adaylar) {
    const aile = AILELER.find(([, test]) => test(aday));
    if (!aile) {
      say(`  ${aday.padEnd(32)} → ⚪ cache'lenmeyen uç (PASSTHRU — beyaz listede değil)`);
      continue;
    }
    // Dil parametresi anahtarın parçası: istemci hem tr-TR hem en-US isteyebilir.
    let bulundu = false;
    for (const lang of ['tr-TR', 'en-US', null]) {
      const query = lang ? { language: lang } : {};
      const { relativePath } = buildCacheKey({ provider: 'tmdb', family: aile[0], path: aday, query });
      const full = path.join(cacheDir, relativePath);
      if (!fs.existsSync(full)) continue;
      const envelope = await readEnvelope(full);
      const st = getEnvelopeState(envelope, SCHEMA_VERSION);
      say(`  ${aday.padEnd(32)} → ${DURUM[st] || st}  [${lang || 'dilsiz'}]  ${describe(envelope)}`);
      bulundu = true;
    }
    if (!bulundu) say(`  ${aday.padEnd(32)} → ⚪ cache'te YOK (henüz istenmemiş)`);
  }
  say('\n  ⚪ "YOK" kötü bir şey değil — o ekran henüz hiç açılmamış demektir.');
}

/**
 * Git Bash (MSYS) `--check /tv/1396` argümanını
 * `/C:/Program Files/Git/tv/1396`'ya çevirir — Windows'ta test edeni
 * yanıltan gerçek bir tuzak (Pi'de/Linux'ta olmaz). Bilinen TMDB
 * segmentinden İTİBAREN keserek her iki ortamda da doğru çalışırız.
 * `--check tv/1396` (baştaki eğik çizgisiz) yazımı da desteklenir.
 */
function normalizeTmdbPath(raw) {
  const m = /\/(tv|movie)\/\d+.*$/.exec(raw);
  if (m) return m[0];
  return raw.startsWith('/') ? raw : '/' + raw;
}

// --------------------------------------------------------------------------
async function main() {
  const durum = initLazyFetchPaths();
  if (!durum.enabled) {
    console.error(`\n❌ LazyFetch devre dışı: ${getLazyFetchStatus().reason}`);
    console.error('   LAZYFETCH_ROOT tanımlayıp tekrar dene:');
    console.error('   LAZYFETCH_ROOT=/mnt/SSD1/KaymakTv/LazyFetch node scripts/lazyfetch-inspect.js\n');
    process.exit(1);
  }
  const cacheDir = getLazyFetchDir('cache');

  const args = process.argv.slice(2);
  const bayrak = (ad) => {
    const i = args.indexOf(ad);
    return i >= 0 ? args[i + 1] : null;
  };

  const check = bayrak('--check');
  if (check) return kontrol(cacheDir, normalizeTmdbPath(check));

  const rows = await collect(cacheDir);
  if (!rows.length) {
    say('\n📭 Cache boş — henüz hiçbir şey inmemiş.');
    say('   Uygulamada bir dizi/film ekranı aç, sonra tekrar bak.\n');
    return;
  }

  const list = bayrak('--list');
  const find = bayrak('--find');
  if (list) return listele(rows, list);
  if (find) return ara(rows, find);

  ozet(rows);
  say('\n💡 Daha derine:');
  say('   --list episode_detail   bölüm kayıtlarını tek tek gör');
  say('   --find "Breaking Bad"   ada göre ara');
  say('   --check /tv/1396        belirli bir dizi indi mi (kesin cevap)\n');
}

main().catch((e) => {
  console.error('Denetçi çöktü:', e.message);
  process.exit(2);
});
