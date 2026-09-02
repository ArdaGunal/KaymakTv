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

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const zlib = require('zlib');

const LF = path.join(__dirname, '..', 'server', 'lazyfetch');
const AR = path.join(__dirname, '..', 'server', 'archive');

const { initLazyFetchPaths, getLazyFetchDir, getLazyFetchStatus } = require(path.join(LF, 'paths'));
const { resolveRoute } = require(path.join(LF, 'routeRegistry'));
const db = require(path.join(AR, 'db'));
const { archiveCatalogResponse, archiveSimplePayload, DESTEKLENEN_AILELER } = require(path.join(AR, 'writer'));
const { summary } = require(path.join(AR, 'store'));

const UYGULA = process.argv.includes('--uygula');
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
    if (provider !== 'trakt' || !DESTEKLENEN_AILELER.has(family)) {
      sayac.kapsamDisi++;
      continue;
    }

    // 🔴 ASIL SORUN BURADA. Zarf, A3'ten ÖNCE yazıldıysa `requestPath`
    // taşımıyor (dosya adı geri döndürülemez bir hash). `show_seasons`
    // yanıtı da dizinin kendi `ids`'ini taşımadığı için o kayıtların hangi
    // diziye ait olduğu BİLİNEMEZ — Trakt'a sormadan aktarılamazlar.
    //
    // Kendi `ids`'ini TAŞIYAN aileler (`show_detail`, `movie_detail`,
    // `episode_detail`) yol olmadan da kurtarılabilir.
    const yolVar = typeof zarf.requestPath === 'string' && zarf.requestPath;
    const kendiKimligi = zarf.payload && !Array.isArray(zarf.payload) && zarf.payload.ids;

    if (!yolVar && !kendiKimligi) {
      sayac.yolsuzAtlandi++;
      yolsuzAileler.set(family, (yolsuzAileler.get(family) || 0) + 1);
      if (AYRINTILI) say(`  atlandi (yol yok, kimlik yok): ${provider}/${family} ${path.basename(yol)}`);
      continue;
    }

    if (!UYGULA) {
      sayac.aktarildi++;
      aileBazinda.set(family, (aileBazinda.get(family) || 0) + 1);
      continue;
    }

    const query = queryCoz(zarf.requestQuery);
    let sonuc;
    try {
      if (yolVar) {
        sonuc = await archiveCatalogResponse({
          provider, family, path: zarf.requestPath, query,
          data: zarf.payload, fetchedAt: zarf.fetchedAt,
        });
      } else {
        // Yol yok ama yanıt kendini tanıtıyor — tipi aileden çıkar.
        const tip = family === 'movie_detail' ? 'movie' : family === 'episode_detail' ? 'episode' : 'show';
        sonuc = await archiveSimplePayload({
          type: tip, endpoint: family, data: zarf.payload,
          lang: query.translations || query.language || '-',
          fetchedAt: zarf.fetchedAt,
        });
      }
    } catch (e) {
      sonuc = { ok: false, reason: e.message };
    }

    if (sonuc && sonuc.ok) {
      sayac.aktarildi++;
      aileBazinda.set(family, (aileBazinda.get(family) || 0) + 1);
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
  if (sayac.bozuk) say(`  okunamayan        : ${sayac.bozuk}`);
  say(`${UYGULA ? 'Aktarilan' : 'Aktarilabilir'}       : ${sayac.aktarildi}`);
  if (sayac.basarisiz) say(`  BASARISIZ         : ${sayac.basarisiz}`);

  if (aileBazinda.size) {
    say('\n  Aile bazinda:');
    for (const [a, n] of [...aileBazinda].sort((x, y) => y[1] - x[1])) {
      say(`    ${a.padEnd(20)} ${String(n).padStart(5)}`);
    }
  }

  // 🔴 EN ÖNEMLİ SATIR: kurtarılamayanlar.
  if (sayac.yolsuzAtlandi) {
    say(`\n  ⚠️  ${sayac.yolsuzAtlandi} kayit KURTARILAMADI (istek yolu yok, yanit da kendini tanitmiyor):`);
    for (const [a, n] of [...yolsuzAileler].sort((x, y) => y[1] - x[1])) {
      say(`    ${a.padEnd(20)} ${String(n).padStart(5)}`);
    }
    say('    Bunlar A3 kancasindan ONCE yazilmis zarflar. Yeni kayitlar');
    say('    `requestPath` tasiyor; bu sayi zamanla kendiliginden dusecek.');
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
