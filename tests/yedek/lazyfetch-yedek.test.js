// ==========================================================================
// LAZYFETCH HAFTALIK YEDEGI + TAR (029 §2 · 2026-11-12)
// ==========================================================================
// Gercek kucuk bir cache klasoru -> tek tar + .sha256 + .json. Iddialar: icerik birebir geri
// acilir (sistem `tar`'i ile), yarim `.tar.yeni` yedek sayilmaz, kosu sirasinda silinen dosya turu
// dusurmez, ayni diske yazilmaz, haftada bir kez. Ag yok, gercek diske dokunulmaz.

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { baslat, PROJE_KOKU } = require('../yardimci');

const T = baslat('LAZYFETCH YEDEGI (029)', { kokOneki: 'yedek-lf-' });
const Y = path.join(PROJE_KOKU, 'server', 'yedek');
const tar = require(path.join(Y, 'tar'));
const lf = require(path.join(Y, 'lazyfetchYedek'));
const GUN = 24 * 3600 * 1000;

const yaz = (gorecel, veri) => {
  const tam = path.join(T.kok, gorecel);
  fs.mkdirSync(path.dirname(tam), { recursive: true });
  fs.writeFileSync(tam, veri);
};

(async () => {
  // Gercekci cache: bos dosya, blok sinirlari, buyuk dosya, uzun yol (ustar prefix), quarantine.
  yaz('cache/tmdb/ab/bos.json.gz', Buffer.alloc(0));
  yaz('cache/tmdb/ab/b511.json.gz', crypto.randomBytes(511));
  yaz('cache/tmdb/ab/b512.json.gz', crypto.randomBytes(512));
  yaz('cache/tmdb/cd/b513.json.gz', crypto.randomBytes(513));
  yaz('cache/trakt/ef/buyuk.json.gz', crypto.randomBytes(300 * 1024));
  const uzun = `cache/trakt/${'a'.repeat(60)}/${'b'.repeat(40)}/${'c'.repeat(64)}.json.gz`;
  yaz(uzun, crypto.randomBytes(1000));
  yaz('quarantine/bozuk-1.json', 'bozuk');
  yaz('tmp/yarim.json.gz', 'tmp yedeklenmez');
  yaz('archive/katalog.db', 'arsiv ayri yedekleniyor');

  // ==================================================================
  T.H('Dosya listesi: yalniz cache/ + quarantine/');
  // ==================================================================
  const yollar = await lf.dosyalariTopla(T.kok);
  T.ok('7 dosya (tmp/ ve archive/ YOK)', yollar.length === 7 && !yollar.some((y) => /^(tmp|archive)\//.test(y)), yollar.length);
  T.ok('yollar / ayracli ve sirali (ayni girdi -> ayni tar)', yollar.every((y) => !y.includes('\\')) && JSON.stringify([...yollar].sort()) === JSON.stringify(yollar));

  // ==================================================================
  T.H('Ayni aygit kurali');
  // ==================================================================
  const hedef = path.join(T.kok, 'yedekler', 'lazyfetch');
  const red = await lf.lazyfetchYedekAl({ kaynakKok: T.kok, hedefDizin: hedef, ortam: {} });
  T.ok('🔴 kaynakla ayni diske tar YAZILMAZ (izin yokken)', red.ok === false && red.reason === 'ayni_aygit'
    && fs.readdirSync(hedef).length === 0);
  T.ok('lazyfetch kapaliysa (kok yok) -> lazyfetch_kapali', (await lf.lazyfetchYedekAl({ kaynakKok: null, hedefDizin: hedef })).reason === 'lazyfetch_kapali');

  // ==================================================================
  T.H('Tar + sha256 + json');
  // ==================================================================
  const izin = { ARCHIVE_BACKUP_AYNI_AYGIT: '1' }; // testte ayri disk yok
  const simdi = new Date('2026-11-15T03:00:00Z');
  const r = await lf.lazyfetchYedekAl({ kaynakKok: T.kok, hedefDizin: hedef, simdi, ortam: izin });
  T.ok('yedek alindi', r.ok === true, r.reason || r.dosya);
  const tarYolu = path.join(hedef, r.dosya || 'yok');
  T.ok('ad lazyfetch-<damga>.tar', r.dosya === 'lazyfetch-2026-11-15T03-00-00.tar');
  T.ok('7 dosya, atlanan 0', r.adet === 7 && r.atlanan === 0);
  T.ok('yarim .yeni dosyasi KALMADI', !fs.readdirSync(hedef).some((f) => f.endsWith('.yeni')));
  const sha = await tar.dosyaSha256(tarYolu);
  const shaSatir = fs.readFileSync(tarYolu.replace('.tar', '.sha256'), 'utf8');
  const ozet = JSON.parse(fs.readFileSync(tarYolu.replace('.tar', '.json'), 'utf8'));
  T.ok('.sha256 sha256sum -c bicimi ve dogru', shaSatir === `${sha}  ${r.dosya}\n`);
  T.ok('.json: sha256, adet, bayt dogru', ozet.sha256 === sha && ozet.adet === 7 && ozet.bayt === r.bayt);
  const dogrula = await tar.tarDogrula(tarYolu, { adlar: true });
  T.ok('tarDogrula: saglam, ayni 7 ad (uzun yol prefix ile)', dogrula.ok && JSON.stringify(dogrula.adlar) === JSON.stringify(yollar), dogrula.hata || '');

  // 🔴 GERCEK GERI ACMA: sistem tar'i (sunucuda GNU tar, Windows'ta bsdtar) ile birebir.
  const acilan = fs.mkdtempSync(path.join(os.tmpdir(), 'yedek-lf-ac-'));
  // Goreli ad + cwd: Windows'ta GNU tar `C:\...` yolunu uzak makine (host:yol) saniyor.
  fs.copyFileSync(tarYolu, path.join(acilan, 'yedek.tar'));
  const ac = spawnSync('tar', ['-xf', 'yedek.tar'], { encoding: 'utf8', cwd: acilan });
  if (ac.error && ac.error.code === 'ENOENT') {
    T.ok('sistem tar yok — geri acma atlandi', true, 'tar bulunamadi');
  } else {
    const farkli = yollar.filter((y) => {
      const a = path.join(T.kok, y);
      const b = path.join(acilan, y);
      return !fs.existsSync(b) || !fs.readFileSync(a).equals(fs.readFileSync(b));
    });
    T.ok('🔴 tar -xf ile acilan HER dosya kaynakla bayt bayt ayni', ac.status === 0 && farkli.length === 0,
      ac.status !== 0 ? (ac.stderr || '').split('\n')[0] : farkli.join(','));
  }
  fs.rmSync(acilan, { recursive: true, force: true });

  // ==================================================================
  T.H('Bozulma yakalaniyor');
  // ==================================================================
  const bozuk = path.join(T.kok, 'bozuk.tar');
  const ham = fs.readFileSync(tarYolu);
  const b1 = Buffer.from(ham); b1[10] ^= 0xff; fs.writeFileSync(bozuk, b1);
  T.ok('baslikta tek bayt degisti -> saglama toplami hatasi', (await tar.tarDogrula(bozuk)).ok === false);
  fs.writeFileSync(bozuk, ham.subarray(0, ham.length - 2048));
  T.ok('sonu kesik tar -> yarim dosya hatasi', (await tar.tarDogrula(bozuk)).ok === false);

  // ==================================================================
  T.H('Kosu sirasinda silinen dosya turu dusurmez');
  // ==================================================================
  const kayip = await tar.tarYaz(path.join(T.kok, 'kayip.tar'), T.kok, [...yollar, 'cache/tmdb/zz/silindi.json.gz']);
  T.ok('olmayan dosya atlandi ve sayildi, digerleri yazildi', kayip.adet === 7 && kayip.atlanan === 1);
  T.ok('ustara sigmayan ad atlanir', tar.adBol('x'.repeat(101)) === null && tar.adBol(`${'p'.repeat(150)}/${'n'.repeat(99)}`) !== null);

  // ==================================================================
  T.H('Haftada bir — diskten karar');
  // ==================================================================
  const bosDizin = fs.mkdtempSync(path.join(os.tmpdir(), 'yedek-lf-zaman-'));
  const pazar = new Date(2026, 10, 15, 5, 30); // yerel pazar 05:30
  const persembe = new Date(2026, 10, 12, 5, 30);
  T.ok('hic tar yok -> zamani geldi', lf.lazyfetchZamaniMi(bosDizin, persembe) === true);
  const tarAdi = (t) => `lazyfetch-${t.toISOString().replace(/[:.]/g, '-').slice(0, 19)}.tar`;
  fs.writeFileSync(path.join(bosDizin, tarAdi(new Date(persembe.getTime() - 3 * GUN))), 'x');
  T.ok('3 gunluk tar, persembe -> HAYIR', lf.lazyfetchZamaniMi(bosDizin, persembe) === false);
  T.ok('3 gunluk tar, pazar -> EVET', lf.lazyfetchZamaniMi(bosDizin, new Date(persembe.getTime() + 3 * GUN)) === true);
  fs.writeFileSync(path.join(bosDizin, tarAdi(pazar)), 'x');
  T.ok('🔴 pazar bugun alindiysa (yeniden baslatma) -> HAYIR', lf.lazyfetchZamaniMi(bosDizin, new Date(pazar.getTime() + 3600000)) === false);
  T.ok('8 gun gecti (pazar kacti) -> EVET', lf.lazyfetchZamaniMi(bosDizin, new Date(pazar.getTime() + 8 * GUN)) === true);
  const sadeceYarim = fs.mkdtempSync(path.join(os.tmpdir(), 'yedek-lf-yarim-'));
  fs.writeFileSync(path.join(sadeceYarim, `${tarAdi(pazar)}.yeni`), 'yarim');
  T.ok('🔴 yalniz yarim .tar.yeni varsa yedek YOK sayilir', lf.lazyfetchZamaniMi(sadeceYarim, persembe) === true);
  T.ok('taze .yeni silinmez (belki suruyor)', lf.yarimlariTemizle(sadeceYarim, new Date()) === 0);
  const eskiT = new Date(Date.now() - 2 * GUN);
  fs.utimesSync(path.join(sadeceYarim, `${tarAdi(pazar)}.yeni`), eskiT, eskiT);
  fs.writeFileSync(path.join(sadeceYarim, 'baska.yeni'), 'dokunma');
  fs.utimesSync(path.join(sadeceYarim, 'baska.yeni'), eskiT, eskiT);
  T.ok('1 gunden eski yarim .tar.yeni silinir, desen disi .yeni kalir',
    lf.yarimlariTemizle(sadeceYarim, new Date()) === 1 && fs.existsSync(path.join(sadeceYarim, 'baska.yeni')));

  for (const d of [bosDizin, sadeceYarim]) fs.rmSync(d, { recursive: true, force: true });
  T.bitir();
})().catch((e) => { console.error(e); process.exit(1); });
