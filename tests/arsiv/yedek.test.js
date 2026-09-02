// ==========================================================================
// A2.5 — ARŞİV YEDEĞİ TESTLERİ
// ==========================================================================
// 🔴 NEDEN VAR: 2026-09-02'de SSD `EIO` verdi, arşiv birkaç saat erişilemez
// kaldı ve **tek bir kopyası yoktu.** `backupTo()` A1'de yazılmıştı ve
// hiçbir yerden çağrılmıyordu. Kural (`03_FAZLAR.md`: "`archive/`
// yedeklenir") yazılıydı ama uygulanmamıştı.
//
// 🔴 EN KRİTİK İDDİA: aynı aygıta yedekleme REDDEDİLİR. Diskin kendisini
// kaybetmeye karşı korunmak yedeğin TEK amacı; aynı aygıta yazmak sahte
// güven üretir — yedeksizlikten tehlikelidir.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { baslat, AR } = require('../yardimci');

const T = baslat('ARSIV YEDEGI (A2.5)', { kokOneki: 'ar-yedek-' });

const db = require(path.join(AR, 'db'));
const yedek = require(path.join(AR, 'backup'));
const kimlik = require(path.join(AR, 'identity'));
const depo = require(path.join(AR, 'store'));

(async () => {
  const durum = db.initArchive();
  if (!durum.enabled) {
    T.ok('Arsiv acilamadi - atlaniyor', false, durum.reason);
    T.bitir();
    return;
  }

  // Yedeklenecek gercek veri koy
  const e = kimlik.resolveOrCreate({
    type: 'show',
    externalIds: [{ source: 'trakt:show', source_id: '1388' }, { source: 'tmdb:show', source_id: '1396' }],
    derived: { title: 'Breaking Bad', year: 2008 },
  });
  await depo.upsertPayload({ kaymakId: e.kaymak_id, provider: 'trakt', endpoint: 'show_detail', lang: 'tr', data: { title: 'Breaking Bad', ids: { trakt: 1388 } } });

  // ==================================================================
  T.H('🔴 AYNI AYGITA yedekleme REDDEDILIYOR');
  // ==================================================================
  // Arsiv T.kok altinda; hedefi de oraya verirsek ayni aygit olur.
  const ayniDisk = path.join(T.kok, 'yanlis-yedek');
  const red = await yedek.runBackup({ dir: ayniDisk });
  T.ok('Ayni aygit tespit edildi ve yedek ALINMADI', red.ok === false && red.reason === 'ayni_aygit', red.reason);
  T.ok('Hedef dizine .db YAZILMADI',
    !fs.existsSync(ayniDisk) || fs.readdirSync(ayniDisk).filter((f) => f.endsWith('.db')).length === 0);
  T.ok('Olay sync_log a yazildi (sessiz gecilmedi)',
    db.getDb().prepare("SELECT count(*) c FROM sync_log WHERE event='error' AND detail LIKE '%yedek%'").get().c >= 1);

  // ==================================================================
  T.H('Gecerli hedefe yedek');
  // ==================================================================
  // NOT: bu testte arsiv de hedef de ayni makinede; farkli AYGIT
  // simule edemiyoruz. `ayniAygitMi` kontrolunu atlamak icin dogrudan
  // `db.backupTo` kullanip cevresindeki mantigi ayri olcuyoruz.
  const hedefDizin = fs.mkdtempSync(path.join(os.tmpdir(), 'ar-yedek-hedef-'));
  const dosya = path.join(hedefDizin, 'katalog-deneme.db');
  const b = db.backupTo(dosya);
  T.ok('VACUUM INTO ile yedek alindi', b.ok === true, (b.bytes / 1024).toFixed(1) + ' KB');
  T.ok('Yedek dosyasi diskte', fs.existsSync(dosya) && fs.statSync(dosya).size > 0);

  // 🔴 Yedek GERCEKTEN acilabilir ve veri TAM mi?
  const sqlite = require('node:sqlite');
  const kopya = new sqlite.DatabaseSync(dosya, { readOnly: true });
  T.ok('🔴 Yedek acilabiliyor ve entity verisi TAM',
    kopya.prepare('SELECT count(*) c FROM entities').get().c === db.getDb().prepare('SELECT count(*) c FROM entities').get().c);
  T.ok('🔴 Yedekte payload da TAM',
    kopya.prepare('SELECT count(*) c FROM payloads').get().c === 1);
  T.ok('Yedekteki dis kimlikler korunmus',
    kopya.prepare("SELECT count(*) c FROM external_ids WHERE source='tmdb:show'").get().c === 1);
  kopya.close();

  // ==================================================================
  T.H('Kopya dondurme (rotation)');
  // ==================================================================
  // 10 sahte kopya + alakasiz bir dosya
  for (let i = 0; i < 10; i++) {
    const f = path.join(hedefDizin, `katalog-2026-09-0${i}T00-00-00.db`);
    fs.writeFileSync(f, 'x');
    const t = new Date(Date.now() - (10 - i) * 3600000);
    fs.utimesSync(f, t, t);
  }
  const alakasiz = path.join(hedefDizin, 'ONEMLI-BASKA-DOSYA.db.txt');
  fs.writeFileSync(alakasiz, 'dokunma');
  const baskaDb = path.join(hedefDizin, 'baska-veritabani.db');
  fs.writeFileSync(baskaDb, 'dokunma');

  const silinen = yedek.kopyalariDondur(hedefDizin, 3);
  const kalanKopya = fs.readdirSync(hedefDizin).filter((f) => /^katalog-.+\.db$/.test(f));
  T.ok('Yalnizca 3 kopya birakildi', kalanKopya.length === 3, kalanKopya.length + ' kopya, ' + silinen + ' silindi');
  T.ok('En YENI kopyalar tutuldu', kalanKopya.some((f) => f.includes('katalog-2026-09-09')));
  T.ok('🔴 Kendi deseni DISINDAKI dosyalara DOKUNULMADI',
    fs.existsSync(alakasiz) && fs.existsSync(baskaDb));
  T.ok('keep=0 gibi anlamsiz degerde hicbir sey silinmiyor', yedek.kopyalariDondur(hedefDizin, 0) === 0);

  // ==================================================================
  T.H('Yapilandirma ve dayaniklilik');
  // ==================================================================
  T.ok('Varsayilan 7 kopya', yedek.VARSAYILAN_KOPYA === 7);
  T.ok('Gece penceresi 05:00-07:00 (supurucuden SONRA)',
    yedek.PENCERE_BASI === 5 && yedek.PENCERE_SONU === 7);

  const eskiEnv = process.env.ARCHIVE_BACKUP_DIR;
  process.env.ARCHIVE_BACKUP_DIR = '/ozel/yol';
  T.ok('ARCHIVE_BACKUP_DIR onceligi var', yedek.yedekDizini() === '/ozel/yol');
  delete process.env.ARCHIVE_BACKUP_DIR;
  T.ok('Env yoksa ev dizinine dusuyor (SD kart = BASKA aygit)',
    String(yedek.yedekDizini() || '').includes('kaymak-arsiv-yedek'));
  if (eskiEnv) process.env.ARCHIVE_BACKUP_DIR = eskiEnv;

  const zaman = yedek.startBackupSchedule();
  T.ok('Zamanlayici kuruldu', zaman !== null);
  yedek.stopBackupSchedule();

  // 🔴 Arsiv KAPALIYKEN cokmemeli
  const altSurec = require('child_process').spawnSync(
    process.execPath,
    ['--no-warnings', '-e', `delete process.env.LAZYFETCH_ROOT; delete process.env.ARCHIVE_ROOT;
      const y = require(${JSON.stringify(path.join(AR, 'backup'))});
      y.runBackup().then((r) => {
        if (r !== null) process.exit(1);
        if (y.startBackupSchedule() !== null) process.exit(1);
        process.exit(0);
      }).catch(() => process.exit(1));`],
    { encoding: 'utf8' }
  );
  T.ok('🔴 Arsiv kapaliyken null donuyor, COKMUYOR', altSurec.status === 0,
    altSurec.status === 0 ? '' : (altSurec.stderr || '').split('\n')[0]);

  db.closeArchive();
  fs.rmSync(hedefDizin, { recursive: true, force: true });
  T.bitir();
})();
