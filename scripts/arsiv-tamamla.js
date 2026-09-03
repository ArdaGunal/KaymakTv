#!/usr/bin/env node
// ==========================================================================
// A3 ADIM 2 — SUPABASE KÜTÜPHANESİNDEN ARŞİV EKSİKLERİNİ TAMAMLAMA
// ==========================================================================
// NEDEN VAR: A3/1 (`arsiv-aktar.js`) `cache/`'te ZATEN olanı kurtarıyordu.
// Bu betik HİÇ İSTENMEMİŞ olanı getirir — kullanıcılarımızın takip ettiği
// ama arşive hiç düşmemiş yapımları.
//
// 🔴 GÜVENLİK: VARSAYILAN KURU ÇALIŞMA. Arşiv TTL'siz ve silmesiz bir
// depodur; yanlış yazılan veri geri alınamaz. Yazmak için `--uygula`.
//
// Kullanım (Pi'de, proje kökünde — `.env` otomatik okunur):
//   node scripts/arsiv-tamamla.js                  # kuru: ne eksik?
//   node scripts/arsiv-tamamla.js --uygula --limit 10
//   node scripts/arsiv-tamamla.js --uygula         # tamamı
//
//   --limit N     en fazla N hedef dene (KURU çalışmada da rapor kırpar)
//   --dil tr|en   varsayılan tr (A3/2 kararı: tek dil)
//   --ayrintili   her hedefi tek tek bas
//
// ==========================================================================
// 🔴 DİSK UYARISI — `--limit` NEDEN VAR
// ==========================================================================
// SSD 2026-09-02'de `EIO` verdi ve UAS kapatılıp `usb-storage` (BOT) moduna
// alındı (Madde 285, runbook §0.7). Sürücünün bu YENİ hali henüz uzun süreli
// ağır yazma altında görülmedi. `--limit` tam da bunun içindir: küçük bir
// partiyle koş, `sudo dmesg | grep -c "error -5"` sıfır kalıyor mu bak,
// sonra büyüt. Gece zamanlayıcısına bağlamak BU testten SONRA gelir.
//
// ⚠️ En ağır uç `show_seasons` (ölçüm: ort. 33 KB gzip, en büyüğü 294,5 KB
// — `store.js`) ve yalnızca 31 tane. Filmler (234 hedef) küçük yazımlardır.
// Yani ilk partiyi dizilerden seçmek diski daha iyi sınar.

try { require('dotenv').config(); } catch (_) { /* dotenv yoksa eski davranis */ }

const path = require('path');

const LF = path.join(__dirname, '..', 'server', 'lazyfetch');
const AR = path.join(__dirname, '..', 'server', 'archive');

const { initLazyFetchPaths, getLazyFetchStatus } = require(path.join(LF, 'paths'));
const { createTraktCatalogFetcher } = require(path.join(LF, 'providers', 'trakt'));
const { DEFAULT_CONFIG: DEVRE_CONFIG } = require(path.join(LF, 'circuitBreaker'));
const db = require(path.join(AR, 'db'));
const { summary } = require(path.join(AR, 'store'));
const { fetchTakipEdilenler, hedefListesi, hedefAnahtari } = require(path.join(AR, 'backfillSource'));
const { tamamla, eksikleriBul, ARDISIK_HATA_TAVANI, ISTEKLER_ARASI_MS } = require(path.join(AR, 'backfill'));

const argv = process.argv.slice(2);
const UYGULA = argv.includes('--uygula');
const AYRINTILI = argv.includes('--ayrintili');

function argDeger(ad, varsayilan) {
  const i = argv.indexOf(ad);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : varsayilan;
}

const LIMIT = Number(argDeger('--limit', Infinity));
const DIL = argDeger('--dil', 'tr');

const say = (s = '') => console.log(s);
const tarih = (ms) => (ms ? new Date(ms).toISOString().slice(0, 16).replace('T', ' ') : '-');

(async () => {
  if (!['tr', 'en'].includes(DIL)) {
    console.error(`\n❌ --dil yalnizca 'tr' veya 'en' olabilir (verilen: ${DIL})\n`);
    process.exit(1);
  }
  if (!Number.isFinite(LIMIT) && argv.includes('--limit')) {
    console.error('\n❌ --limit bir sayi olmali.\n');
    process.exit(1);
  }

  initLazyFetchPaths();
  const lfDurum = getLazyFetchStatus();
  if (!lfDurum.enabled) {
    console.error(`\n❌ LazyFetch devre disi: ${lfDurum.reason}\n`);
    process.exit(1);
  }

  const arDurum = db.initArchive();
  if (!arDurum.enabled) {
    console.error(`\n❌ Arsiv acilamadi: ${arDurum.reason}\n`);
    process.exit(1);
  }

  const clientId = process.env.EXPO_PUBLIC_TRAKT_CLIENT_ID;
  if (UYGULA && !clientId) {
    console.error('\n❌ EXPO_PUBLIC_TRAKT_CLIENT_ID yok — saglayiciya cikilamaz.\n');
    process.exit(1);
  }

  say(`\narsiv : ${arDurum.dbPath}`);
  say(`dil   : ${DIL}`);
  say(UYGULA ? '\n🔴 UYGULAMA MODU — arsive GERCEKTEN yazilacak, Trakt\'a istek gidecek.\n'
             : '\n🔵 KURU CALISMA — sifir ag istegi, hicbir sey yazilmayacak. Uygulamak icin: --uygula\n');

  // ---- 1) Kaynak: kullanicilarimiz neyi takip ediyor? --------------------
  const kaynak = await fetchTakipEdilenler({
    url: process.env.EXPO_PUBLIC_SUPABASE_URL,
    anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  });

  if (!kaynak.ok) {
    console.error(`\n❌ Supabase okunamadi: ${kaynak.reason}\n`);
    db.closeArchive();
    process.exit(1);
  }

  const diziler = kaynak.items.filter((i) => i.type === 'show').length;
  const filmler = kaynak.items.length - diziler;
  say(`Supabase   : ${kaynak.satir} aktivite -> ${kaynak.items.length} tekil yapim (${diziler} dizi / ${filmler} film)`);

  // ---- 2) Hedefler ve eksik tespiti (sifir ag istegi) --------------------
  const hedefler = hedefListesi(kaynak.items, DIL);
  const { kapsanan, beklemede, eksik } = eksikleriBul(hedefler);

  const kapsamYuzde = hedefler.length ? ((kapsanan.length / hedefler.length) * 100).toFixed(1) : '0.0';
  say(`Hedef uc   : ${hedefler.length}`);
  say(`  arsivde  : ${kapsanan.length}  (%${kapsamYuzde})`);
  say(`  beklemede: ${beklemede.length}  (geri cekilme penceresi acik)`);
  say(`  EKSIK    : ${eksik.length}`);

  const aileSay = (liste) => {
    const m = new Map();
    for (const h of liste) m.set(h.endpoint, (m.get(h.endpoint) || 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]);
  };

  if (eksik.length) {
    say('\n  Eksikler aile bazinda:');
    for (const [a, n] of aileSay(eksik)) say(`    ${a.padEnd(16)} ${String(n).padStart(5)}`);
  }

  if (beklemede.length) {
    say('\n  ⚠️  Beklemedeki hedefler (defterde isaretli, tekrar DENENMEYECEK):');
    for (const h of beklemede.slice(0, AYRINTILI ? beklemede.length : 10)) {
      const d = h.defter || {};
      say(`    ${hedefAnahtari(h).padEnd(38)} deneme=${d.deneme} sonraki=${tarih(d.sonraki_deneme_at)}  ${d.son_hata || ''}`);
    }
    if (!AYRINTILI && beklemede.length > 10) say(`    ... ve ${beklemede.length - 10} tane daha (--ayrintili)`);
  }

  // ⚠️ YALNIZCA KURU CALISMADA. Uygulama modunda bu liste GEREKSIZ: her
  // hedef zaten islenirken tek tek basiliyor, yani ayni sey iki kez yaziliyor
  // ve 181 hedeflik bir kosuda terminali dolduruyor (2026-09-03 ilk canli
  // kosuda goruldu). Kuru calismada ise LISTENIN KENDISI ciktinin amaci.
  if (AYRINTILI && !UYGULA && eksik.length) {
    say('\n  Eksik hedeflerin tamami:');
    for (const h of eksik) say(`    ${hedefAnahtari(h)}`);
  }

  // ---- 3) Kuru calisma burada biter --------------------------------------
  if (!UYGULA) {
    const denenecek = Math.min(eksik.length, LIMIT);
    say('\n' + '─'.repeat(64));
    say(`Uygulanirsa denenecek : ${denenecek}${Number.isFinite(LIMIT) ? ` (--limit ${LIMIT})` : ''}`);
    // Ağ süresi tahmini: yalnızca önbellekte OLMAYANLAR bekler; kuru
    // çalışmada hangisinin önbellekte olduğunu BİLMİYORUZ (bilmek için
    // orchestrator'a gitmek gerekir), o yüzden bu ÜST SINIR.
    const dk = ((denenecek * ISTEKLER_ARASI_MS) / 60000).toFixed(1);
    say(`Tahmini sure (ust sinir): ~${dk} dk  (${ISTEKLER_ARASI_MS} ms/istek)`);
    say(`Ardisik hata freni     : ${ARDISIK_HATA_TAVANI} (devre kesici esigi ${DEVRE_CONFIG.trakt.failureThreshold})`);
    say('\nUygulamak icin ayni komutu --uygula ile calistir.');
    say('🔴 Ilk kez calistiriyorsan --limit 10 ile basla ve dmesg\'i izle.');
    say('─'.repeat(64) + '\n');
    db.closeArchive();
    return;
  }

  // ---- 4) Uygulama -------------------------------------------------------
  const oncesi = summary();
  const basladi = Date.now();

  const sonuc = await tamamla({
    hedefler: eksik,
    fetcher: createTraktCatalogFetcher(clientId),
    limit: LIMIT,
    ilerleme: ({ hedef, durum, kaynak: kynk, hata, ardisikHata }) => {
      if (!AYRINTILI && durum === 'yazildi') return;
      const isaret = durum === 'yazildi' ? '✓' : durum === 'bulunamadi' ? '·' : '✗';
      const ek = durum === 'yazildi' ? `(${kynk})` : hata ? `${hata}${ardisikHata ? ` [ardisik ${ardisikHata}]` : ''}` : '';
      say(`  ${isaret} ${hedefAnahtari(hedef).padEnd(38)} ${ek}`);
    },
  });

  const sonrasi = summary();
  const gecen = ((Date.now() - basladi) / 1000).toFixed(1);

  say('\n' + '─'.repeat(64));
  say(`Denenen        : ${sonuc.denenen}   (${gecen} sn)`);
  say(`  yazilan      : ${sonuc.yazilan}`);
  say(`  bulunamadi   : ${sonuc.bulunamadi}  (saglayici 'yok' dedi — hata degil)`);
  if (sonuc.basarisiz) say(`  BASARISIZ    : ${sonuc.basarisiz}`);
  say(`  agdan cekilen: ${sonuc.agdanCekilen}`);
  say(`  onbellekten  : ${sonuc.onbellekten}  (cache/ tazeydi, aga hic cikilmadi)`);
  if (sonuc.atlanan) say(`  denenmeyen   : ${sonuc.atlanan}`);

  if (sonuc.durduranSebep === 'ardisik_hata') {
    say(`\n  🔴 ERKEN DURDU: ${sonuc.ardisikHata} ardisik hata.`);
    say(`     Bu bir KORUMA — devre kesici (esik ${DEVRE_CONFIG.trakt.failureThreshold}) acilsaydi`);
    say('     canli kullanicilar da katalog verisi alamazdi. Basarisiz uclar');
    say('     deftere isaretlendi, bir sonraki kosumda atlanacak.');
    say("     Trakt'in durumuna bak, sonra tekrar calistir.");
  } else if (sonuc.durduranSebep === 'limit') {
    say(`\n  --limit ${LIMIT} doldu. Kalanlar icin tekrar calistir.`);
  }

  say('\n  ARSIV DEGISIMI:');
  say(`    yapim      : ${oncesi.entities} -> ${sonrasi.entities}  (+${sonrasi.entities - oncesi.entities})`);
  say(`    dis kimlik : ${oncesi.externalIds} -> ${sonrasi.externalIds}  (+${sonrasi.externalIds - oncesi.externalIds})`);
  say(`    ham yanit  : ${oncesi.payloads} -> ${sonrasi.payloads}  (+${sonrasi.payloads - oncesi.payloads})`);
  say(`    disk       : ${(oncesi.bytes / 1048576).toFixed(1)} MB -> ${(sonrasi.bytes / 1048576).toFixed(1)} MB`);
  if (sonrasi.conflicts > oncesi.conflicts) {
    say(`    ⚠️  ${sonrasi.conflicts - oncesi.conflicts} YENI kimlik cakismasi — sync_log'a bak`);
  }
  if (sonrasi.errors > oncesi.errors) {
    say(`    ⚠️  ${sonrasi.errors - oncesi.errors} YENI hata — sync_log'a bak`);
  }
  say('\n  🔴 SIMDI DISKI KONTROL ET:  sudo dmesg | grep -c "error -5"');
  say('─'.repeat(64) + '\n');

  db.closeArchive();
})().catch((e) => {
  console.error('Tamamlama coktu:', e.message);
  process.exit(2);
});
