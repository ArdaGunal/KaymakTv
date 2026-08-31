// ==========================================================================
// LAZYFETCH — L6 SÜPÜRÜCÜ TESTLERİ
// ==========================================================================
// 🔴 BU DOSYANIN VAR OLUŞ SEBEBİ TEK BİR İDDİA: süpürücü YALNIZCA `cache/`
// alt ağacına dokunur. `tmp/` (atomik yazmanın çalışma alanı) ve
// `quarantine/` (bozuk kayıtların KANIT deposu) asla silinmez.
//
// Bu, tüm LazyFetch'teki en yıkıcı hata olurdu: `quarantine/` silinirse
// teşhis imkânı yok olur, `tmp/` silinirse yazılmakta olan bir dosya
// kaybolup `rename()` atomikliği bozulur. Testte ikisi de KASTEN 90
// GÜNLÜK yapılıyor — yani yaş elemesine takılmaları GEREKİRDİ; hayatta
// kalmaları, korumanın gerçekten çalıştığının kanıtı.

const fs = require('fs');
const path = require('path');
const { baslat, dosyaYaz, LF } = require('../yardimci');

const T = baslat('SUPURUCU (L6)', { kokOneki: 'lf-supurucu-' });

const sweeper = require(path.join(LF, 'sweeper'));
const paths = require(path.join(LF, 'paths'));

const GUN = 24 * 3600 * 1000;

(async () => {
  paths.isLazyFetchEnabled();

  T.H('Yalnizca cache/ silinir');

  const taze1 = dosyaYaz(T.kok, 'cache/tmdb/tv_detail/aa/1111.json.gz', 1);
  const taze2 = dosyaYaz(T.kok, 'cache/trakt/show_seasons/bb/2222.json.gz', 2);
  // 🆕 L8: 40/45 GUNDU. Yas siniri 30 -> 200 gune cikinca bu dosyalar artik
  // "eski" sayilmiyor — testin kendisi bayatladi (Madde 262'nin notu).
  // Yeni degerler politikanin 180 gunluk penceresinin de OTESINDE.
  const eski1 = dosyaYaz(T.kok, 'cache/tmdb/tv_detail/aa/3333.json.gz', 210);
  const eski2 = dosyaYaz(T.kok, 'cache/trakt/show_seasons/bb/4444.json.gz', 250);
  // Bu UCU de KASTEN 300 gunluk: yas elemesine takilmalari GEREKIRDI.
  const tmpDosya = dosyaYaz(T.kok, 'tmp/yarim-yazim.tmp', 300);
  const karantina = dosyaYaz(T.kok, 'quarantine/1700000000__bozuk.json.gz', 300);
  // 🔴 ARSIV (A1): ayni SSD kokunde ama BASKA bir sistem (01_MIMARI.md
  // "cache != arsiv"). Supurucu buraya dokunursa GERI DONULEMEZ veri kaybi
  // olur - cache'in aksine arsiv yeniden uretilemez. Koruma yapisaldir
  // (sweeper `cache/`ten baslar), ama yapisal korumalar da bozulabilir.
  const arsivDb = dosyaYaz(T.kok, 'archive/katalog.db', 300);
  const arsivWal = dosyaYaz(T.kok, 'archive/katalog.db-wal', 300);

  const r = await sweeper.runSweep();

  T.ok('200 gunden eski cache kayitlari silindi', r.deletedByAge === 2 && !fs.existsSync(eski1) && !fs.existsSync(eski2));
  T.ok('Taze cache kayitlari KORUNDU', fs.existsSync(taze1) && fs.existsSync(taze2));
  T.ok('tmp/ dosyasi 300 GUNLUK olmasina ragmen SILINMEDI', fs.existsSync(tmpDosya));
  T.ok('quarantine/ dosyasi 300 GUNLUK olmasina ragmen SILINMEDI', fs.existsSync(karantina));
  T.ok('tmp/ ve quarantine/ yalnizca SAYILDI', r.orphanTmpFiles === 1 && r.quarantineFiles === 1);
  T.ok('🔴 ARSIV veritabani 300 GUNLUK olmasina ragmen SILINMEDI', fs.existsSync(arsivDb) && fs.existsSync(arsivWal));
  T.ok('Arsiv supurme sayimina bile GIRMIYOR (kapsam disi)', r.scanned === 4);
  T.ok('Aile ayrimi provider/family duzeyinde', r.families === 2, r.families + ' aile');
  T.ok('Taranan dosya sayisi dogru (yalnizca cache/)', r.scanned === 4, r.scanned + ' dosya');

  T.H('Kota elemesi - aile bazinda');

  for (let i = 0; i < 6; i++) dosyaYaz(T.kok, 'cache/tmdb/tv_images/cc/img' + i + '.json.gz', i + 1);
  const r2 = await sweeper.runSweep({ maxEntriesPerFamily: 3 });
  const kalan = fs.readdirSync(path.join(T.kok, 'cache/tmdb/tv_images/cc')).length;
  T.ok('Aile tavana indirildi', kalan === 3 && r2.deletedByQuota === 3, kalan + ' kayit kaldi');
  T.ok('En YENI kayitlar hayatta kaldi (en eski mtime gider)', fs.existsSync(path.join(T.kok, 'cache/tmdb/tv_images/cc/img0.json.gz')));

  T.H('Yapilandirma ve dayaniklilik');

  T.ok(
    'Varsayilanlar: 200 gun yas / 60000 kota / %80 disk alarmi',
    sweeper.DEFAULT_CONFIG.maxAgeMs === 200 * GUN &&
      sweeper.DEFAULT_CONFIG.maxEntriesPerFamily === 60000 &&
      sweeper.DEFAULT_CONFIG.diskAlarmPercent === 80
  );

  // 🔴🔴 L8 ETKILESIM TESTI — BU EKSIKTI VE TAM DA BU YUZDEN TEHLIKELIYDI.
  // Supurucunun yas siniri, katalog omru politikasinin TOPLAM penceresinden
  // (180 gun) KISA olursa, kayitlar tam bayatladiklari an SILINIR: bayat
  // pencere hic yasamaz, SWR hic calismaz, politika sessizce cope gider.
  // Ne supurucu testi ne TTL testi bunu tek basina yakalayabilirdi — cunku
  // ikisi de KENDI sabitini dogru olcuyordu. Kusur ARALARINDAYDI.
  const rr = require(path.join(LF, 'routeRegistry'));
  T.ok(
    '🔴 Supurucu yas siniri, katalog penceresinden UZUN olmali',
    sweeper.DEFAULT_CONFIG.maxAgeMs > rr.KATALOG_TOPLAM_MS,
    `supurucu ${sweeper.DEFAULT_CONFIG.maxAgeMs / GUN} gun > politika ${rr.KATALOG_TOPLAM_MS / GUN} gun`
  );
  T.ok(
    '🔴 Grace tavani, politikanin bayat penceresini kirpmiyor',
    rr.GRACE_CEILING_MS >= rr.KATALOG_TOPLAM_MS - rr.KATALOG_TAZE_MS
  );
  T.ok(
    '🔴 TTL tavani, 30 gunluk tazeligi kirpmiyor',
    rr.TTL_CEILING_MS >= rr.KATALOG_TAZE_MS
  );

  const kullanim = await sweeper.getDiskUsage(path.join(T.kok, 'cache'), 1000, 1);
  T.ok('Disk doluluk olculebiliyor (fs.statfs)', kullanim.available === true, kullanim.available ? '%' + kullanim.usedPercent + ' dolu' : 'yok');

  // 🔴 SSD YOK SENARYOSU: ayri bir surecte, LAZYFETCH_ROOT olmadan.
  // Ayni surecte denenemez cunku paths.js durumu modul seviyesinde onbellekler.
  const altSurec = require('child_process').spawnSync(
    process.execPath,
    ['-e', 'delete process.env.LAZYFETCH_ROOT; require(process.argv[1]).runSweep().then(r => process.exit(r === null ? 0 : 1));', path.join(LF, 'sweeper')],
    { encoding: 'utf8' }
  );
  T.ok('LAZYFETCH_ROOT yokken supurucu null donuyor, COKMUYOR', altSurec.status === 0);

  const zamanlayici = sweeper.startSweeperSchedule();
  T.ok('Zamanlayici kuruldu (her gun 04:00-06:00 penceresi)', zamanlayici !== null);
  sweeper.stopSweeperSchedule();

  T.bitir();
})();
