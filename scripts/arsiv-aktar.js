#!/usr/bin/env node
// ==========================================================================
// A3 ADIM 1 — `cache/` → ARŞİV AKTARIMI (sıfır ağ isteği)
// ==========================================================================
// NEDEN VAR: A2'nin kancası yalnızca SAĞLAYICIYA GİDEN istekte ateşleniyor.
// Yani arşiv, kanca bağlanmadan ÖNCE önbelleğe düşmüş her şeyi kaçırdı — ve
// L8'den sonra (30 gün taze) sağlayıcı çağrısı iyice seyrekleşeceği için
// bu açık kendiliğinden kapanmayacak.
//
// Ama o veri KAYIP DEĞİL: aynı SSD'de, `cache/` altında duruyor. Bu betik
// onu **Trakt'a tek bir istek atmadan** arşive taşır.
//
// 🔴 GÜVENLİK: VARSAYILAN KURU ÇALIŞMA. Arşiv TTL'siz ve silmesiz bir
// depodur — yanlış yazılan veri geri alınamaz. Gerçekten yazmak için
// `--uygula` gerekir.
//
// Kullanım (Pi'de, proje kökünde):
//   LAZYFETCH_ROOT=/mnt/SSD1/KaymakTv/LazyFetch node scripts/arsiv-aktar.js
//   LAZYFETCH_ROOT=... node scripts/arsiv-aktar.js --uygula
//
// ⚠️ Sunucu çalışırken koşturulabilir (WAL) ama arşiv yazma kilidini kısa
// süreliğine tutar; sunucunun kendi arşiv yazımları o an `busy_timeout`'a
// takılıp fail-soft loglanabilir (istek etkilenmez). Düşük trafikte koştur.

// 🆕 (2026-09-02) `.env` OKUNUYOR — `LAZYFETCH_ROOT`'u elle vermeye gerek yok.
//
// Madde 261'de "denetçi dotenv YÜKLEMEZ" diye kayda geçmişti ve her komutta
// `LAZYFETCH_ROOT=...` öneki yazmak gerekiyordu. Bu, uzun komutlar üretiyordu
// ve kullanıcının terminali (RealVNC/SSH) uzun yapıştırmaları KESİYOR —
// Madde 285'te `cmdline.txt` tam bu yüzden bozuldu.
//
// 🔴 Madde 261'in ASIL uyarısı geçerliliğini KORUYOR: bu betiğin log satırı
// KENDİ sürecine aittir, sunucununkini anlatmaz. Değişen tek şey, kökün
// nereden okunduğu.
//
// ⚠️ `dotenv` var olan env değişkenlerini EZMEZ — testler ve ölçüm betiği
// kökü açıkça verdiği için etkilenmez.
try { require('dotenv').config(); } catch (_) { /* dotenv yoksa eski davranis */ }

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const zlib = require('zlib');

const LF = path.join(__dirname, '..', 'server', 'lazyfetch');
const AR = path.join(__dirname, '..', 'server', 'archive');

const { initLazyFetchPaths, getLazyFetchDir, getLazyFetchStatus } = require(path.join(LF, 'paths'));
const { resolveRoute } = require(path.join(LF, 'routeRegistry'));
const db = require(path.join(AR, 'db'));
const { archiveCatalogResponse, DESTEKLENEN_AILELER } = require(path.join(AR, 'writer'));
const { summary } = require(path.join(AR, 'store'));
// 🆕 K4 toplu aktarım (M534) — TMDB `tv_detail`/`movie_detail` de aktarılabilir.
const { TMDB_AILELERI, tmdbYoldanKimlik } = require(path.join(AR, 'tmdbArsiv'));
const { findByExternal } = require(path.join(AR, 'identity'));

const UYGULA = process.argv.includes('--uygula');
// 🔴 `--yalniz-tmdb`: Trakt zarflarına DOKUNMA. `upsertPayload` tazelik kontrolü
// yapmıyor; Trakt satırlarını önbellekteki ESKİ zarfla yeniden yazmak, gece
// backfill'inin zorla tazelediği arşiv kaydını geriye götürebilirdi (M534).
const YALNIZ_TMDB = process.argv.includes('--yalniz-tmdb');
const AYRINTILI = process.argv.includes('--ayrintili');

const say = (s = '') => console.log(s);

/** `cache/` altındaki tüm zarfları dolaşır. */
async function* zarflar(dir) {
  let girdiler;
  try {
    girdiler = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const g of girdiler) {
    const tam = path.join(dir, g.name);
    if (g.isDirectory()) {
      yield* zarflar(tam);
      continue;
    }
    if (!g.name.endsWith('.json.gz')) continue;
    try {
      const zarf = JSON.parse(zlib.gunzipSync(await fsp.readFile(tam)));
      yield { yol: tam, zarf };
    } catch {
      yield { yol: tam, bozuk: true };
    }
  }
}

/**
 * `query` string'ini (`normalizeQuery` çıktısı: "a=1&b=2") nesneye çevirir.
 * Yazıcı yalnızca dili okuyor, ama sözleşmeyi bozmamak için tamamı çözülür.
 */
function queryCoz(str) {
  if (!str || typeof str !== 'string') return {};
  const o = {};
  for (const parca of str.split('&')) {
    if (!parca) continue;
    const i = parca.indexOf('=');
    if (i < 0) continue;
    o[parca.slice(0, i)] = parca.slice(i + 1);
  }
  return o;
}

(async () => {
  initLazyFetchPaths();
  const lfDurum = getLazyFetchStatus();
  if (!lfDurum.enabled) {
    console.error(`\n❌ LazyFetch devre dışı: ${lfDurum.reason}`);
    console.error('   LAZYFETCH_ROOT=/mnt/SSD1/KaymakTv/LazyFetch node scripts/arsiv-aktar.js\n');
    process.exit(1);
  }

  const arDurum = db.initArchive();
  if (!arDurum.enabled) {
    console.error(`\n❌ Arşiv açılamadı: ${arDurum.reason}\n`);
    process.exit(1);
  }

  const cacheDir = getLazyFetchDir('cache');
  say(`\ncache/ : ${cacheDir}`);
  say(`arşiv  : ${arDurum.dbPath}`);
  say(UYGULA ? '\n🔴 UYGULAMA MODU — arşive GERÇEKTEN yazılacak.\n'
             : '\n🔵 KURU ÇALIŞMA — hiçbir şey yazılmayacak. Uygulamak için: --uygula\n');

  const oncesi = summary();

  const sayac = {
    toplam: 0, bozuk: 0, negatif: 0,
    kapsamDisi: 0, yolsuzAtlandi: 0,
    aktarildi: 0, basarisiz: 0,
    tmdbDilsiz: 0, tmdbEslemesiz: 0, tmdbDahaYeniVar: 0,
  };
  const aileBazinda = new Map();
  const yolsuzAileler = new Map();

  for await (const { yol, zarf, bozuk } of zarflar(cacheDir)) {
    sayac.toplam++;
    if (bozuk) { sayac.bozuk++; continue; }

    // Negatif kayıt = "bu içerik yok" bilgisi. Arşiv KATALOG saklar, yokluk
    // bilgisi saklamaz — o önbelleğin işi (routeRegistry NEGATIVE_TTL_MS).
    if (zarf.isNegative) { sayac.negatif++; continue; }

    const { provider, family } = zarf;
    const tmdbMi = provider === 'tmdb' && TMDB_AILELERI.has(family);
    const traktMi = provider === 'trakt' && DESTEKLENEN_AILELER.has(family) && !YALNIZ_TMDB;
    if (!tmdbMi && !traktMi) {
      sayac.kapsamDisi++;
      continue;
    }

    // 🔴🔴 `requestPath` YOKSA AKTARILMAZ — İSTİSNASIZ.
    //
    // İlk sürüm burada bir kestirme deniyordu: yanıt kendi `ids`'ini
    // taşıyorsa (`show_detail`, `movie_detail`, `episode_detail`) yol
    // olmadan da kurtarılabilir sanılmıştı. **GERÇEK ÜRETİMDE HATA ÜRETTİ**
    // (2026-09-02): kimlik kurtarılıyordu ama `requestQuery` de yoktu,
    // yani DİL bilinmiyordu ve `'-'` yazılıyordu. Oysa istemci bu ailelere
    // her zaman `translations=tr` gönderiyor. Sonuç: 523 mükerrer ve
    // YANLIŞ ETİKETLİ satır — Türkçe içerik "dilsiz" diye kaydedildi.
    //
    // Ders: kimliği kurtarmak yetmez, BAĞLAMI da kurtarmak gerekir. Yol
    // yoksa ikisi de yok demektir.
    //
    // ⚠️ Pratik sonuç: A3/1 öncesi yazılmış zarflar aktarılamaz. Kayıp
    // değil — o veriyi canlı kanca zaten arşive yazmıştı. Bu betiğin asıl
    // değeri İLERİYE dönük: arşiv yazımının başarısız olduğu (disk
    // kesintisi, kuyruk taşması) durumlarda önbellekten kurtarma.
    const yolVar = typeof zarf.requestPath === 'string' && zarf.requestPath;

    if (!yolVar) {
      sayac.yolsuzAtlandi++;
      yolsuzAileler.set(family, (yolsuzAileler.get(family) || 0) + 1);
      if (AYRINTILI) say(`  atlandi (eski bicim, istek yolu yok): ${provider}/${family} ${path.basename(yol)}`);
      continue;
    }

    // 🆕 M534 — TMDB'ye özel üç kapı (kuru çalışmada da uygulanır, sayılar dürüst olsun):
    //   1. `language` YOKSA aktarılmaz — 523 yanlış etiketli satır dersinin TMDB karşılığı.
    //   2. Arşivde Trakt eşlemesi (`tmdb:show|movie`) yoksa aktarılmaz — yazıcı yeni varlık açmaz.
    //   3. Arşivde aynı dilde AYNI ya da DAHA YENİ kayıt varsa atlanır (canlı kanca yazmış olabilir).
    if (tmdbMi) {
      const q = queryCoz(zarf.requestQuery);
      if (!q.language) { sayac.tmdbDilsiz++; continue; }
      const kimlik = tmdbYoldanKimlik(family, zarf.requestPath);
      const kaymakId = kimlik && findByExternal(kimlik.source, kimlik.source_id);
      if (!kaymakId) { sayac.tmdbEslemesiz++; continue; }
      const mevcut = db.getDb().prepare(
        "SELECT fetched_at FROM payloads WHERE kaymak_id = ? AND provider = 'tmdb' AND endpoint = ? AND lang = ?"
      ).get(kaymakId, family, q.language.slice(0, 2).toLowerCase());
      if (mevcut && mevcut.fetched_at >= (zarf.fetchedAt || 0)) { sayac.tmdbDahaYeniVar++; continue; }
    }

    const aileAdi = `${provider}/${family}`;
    if (!UYGULA) {
      sayac.aktarildi++;
      aileBazinda.set(aileAdi, (aileBazinda.get(aileAdi) || 0) + 1);
      continue;
    }

    let sonuc;
    try {
      sonuc = await archiveCatalogResponse({
        provider, family, path: zarf.requestPath, query: queryCoz(zarf.requestQuery),
        data: zarf.payload, fetchedAt: zarf.fetchedAt,
      });
    } catch (e) {
      sonuc = { ok: false, reason: e.message };
    }

    if (sonuc && sonuc.ok) {
      sayac.aktarildi++;
      aileBazinda.set(aileAdi, (aileBazinda.get(aileAdi) || 0) + 1);
      if (AYRINTILI) say(`  ✓ ${provider}/${family} ${zarf.requestPath || '(kimlikten)'}`);
    } else {
      sayac.basarisiz++;
      if (AYRINTILI) say(`  ✗ ${provider}/${family}: ${sonuc && sonuc.reason}`);
    }
  }

  say('─'.repeat(64));
  say(`Taranan zarf        : ${sayac.toplam}`);
  say(`  kapsam disi aile  : ${sayac.kapsamDisi}  (tmdb + arsivlenmeyen trakt aileleri)`);
  say(`  negatif kayit     : ${sayac.negatif}  (arsiv yokluk bilgisi saklamaz)`);
  if (YALNIZ_TMDB) say('  (--yalniz-tmdb: Trakt zarflari kapsam disi sayildi)');
  if (sayac.tmdbDilsiz) say(`  TMDB dilsiz        : ${sayac.tmdbDilsiz}  (istekte language yok — yanlis etiket riski, atlandi)`);
  if (sayac.tmdbEslemesiz) say(`  TMDB eslemesiz     : ${sayac.tmdbEslemesiz}  (arsivde Trakt eslemesi yok — yeni varlik acilmaz)`);
  if (sayac.tmdbDahaYeniVar) say(`  TMDB arsivde yeni  : ${sayac.tmdbDahaYeniVar}  (arsivdeki kayit ayni/daha yeni, atlandi)`);
  if (sayac.bozuk) say(`  okunamayan        : ${sayac.bozuk}`);
  say(`${UYGULA ? 'Aktarilan' : 'Aktarilabilir'}       : ${sayac.aktarildi}`);
  if (sayac.basarisiz) say(`  BASARISIZ         : ${sayac.basarisiz}`);

  if (aileBazinda.size) {
    say('\n  Aile bazinda:');
    for (const [a, n] of [...aileBazinda].sort((x, y) => y[1] - x[1])) {
      say(`    ${a.padEnd(20)} ${String(n).padStart(5)}`);
    }
  }

  // 🔴 EN ÖNEMLİ SATIR: aktarılamayanlar SESSİZCE ATLANMAZ, sayılır.
  if (sayac.yolsuzAtlandi) {
    say(`\n  ⚠️  ${sayac.yolsuzAtlandi} kayit ESKI BICIM (istek yolu yok, aktarilamaz):`);
    for (const [a, n] of [...yolsuzAileler].sort((x, y) => y[1] - x[1])) {
      say(`    ${a.padEnd(20)} ${String(n).padStart(5)}`);
    }
    say('    A3/1 ONCESI yazilmis zarflar. Yol yoksa DIL de bilinmiyor —');
    say('    kestirme yapmak yanlis etiketli mukerrer kayit uretir (2026-09-02).');
    say('    KAYIP DEGIL: o veriyi canli kanca zaten arsive yazmisti.');
    say('    Yeni kayitlar requestPath tasiyor; bu sayi kendiliginden dusecek.');
  }

  if (UYGULA) {
    const sonrasi = summary();
    say('\n  ARSIV DEGISIMI:');
    say(`    yapim       : ${oncesi.entities} -> ${sonrasi.entities}  (+${sonrasi.entities - oncesi.entities})`);
    say(`    dis kimlik  : ${oncesi.externalIds} -> ${sonrasi.externalIds}  (+${sonrasi.externalIds - oncesi.externalIds})`);
    say(`    ham yanit   : ${oncesi.payloads} -> ${sonrasi.payloads}  (+${sonrasi.payloads - oncesi.payloads})`);
    if (sonrasi.conflicts > oncesi.conflicts) {
      say(`    ⚠️  ${sonrasi.conflicts - oncesi.conflicts} YENI kimlik cakismasi — sync_log'a bak`);
    }
  } else {
    say('\n  Uygulamak icin ayni komutu --uygula ile calistir.');
  }
  say('─'.repeat(64) + '\n');

  db.closeArchive();
})().catch((e) => {
  console.error('Aktarim coktu:', e.message);
  process.exit(2);
});
