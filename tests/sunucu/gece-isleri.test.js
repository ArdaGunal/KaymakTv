// ==========================================================================
// GECE_ISLERI anahtarı (GNL-SERVER taşıması · D1)
// ==========================================================================
// 🔴 İDDİALAR: yalnız TAM '0' kapatır (yazım hatası açık bırakır = Pi'nin bugünkü davranışı) ·
// açıkken beş başlatıcı TAM BİR KEZ ve sırayla · kapalıyken HİÇBİRİ · server.js beş zamanlayıcıyı
// doğrudan çağırmaz, tek kapıdan geçer (biri unutulursa yakalanır) · /api/health `geceIsleri`
// bayrağını gösterir. Ağ YOK, gerçek zamanlayıcı kurulmaz (başlatıcılar sahte).

const path = require('path');
const fs = require('fs');
const { baslat, PROJE_KOKU } = require('../yardimci');

const T = baslat('GECE ISLERI ANAHTARI (D1)', { kokOneki: 'gece-isleri-' });
const { geceIsleriAcikMi, geceIsleriniBaslat } = require(path.join(PROJE_KOKU, 'server', 'geceIsleri'));

const BES = ['supurucu', 'yedek', 'backfill', 'ayna', 'sayac'];

function sahteBaslaticilar() {
  const cagri = [];
  return { cagri, liste: BES.map((ad) => [ad, () => { cagri.push(ad); }]) };
}

(async () => {
  T.H('geceIsleriAcikMi');
  for (const [deger, beklenen] of [[undefined, true], ['', true], ['1', true], ['false', true], ['kapali', true], ['00', true], ['0', false], [' 0 ', false]]) {
    T.ok(`GECE_ISLERI=${JSON.stringify(deger)} -> ${beklenen ? 'acik' : 'KAPALI'}`, geceIsleriAcikMi(deger === undefined ? {} : { GECE_ISLERI: deger }) === beklenen);
  }

  T.H('geceIsleriniBaslat');
  const a = sahteBaslaticilar();
  const ra = geceIsleriniBaslat({ ortam: {}, baslaticilar: a.liste });
  T.ok('Acikken bes baslatici TAM BIR KEZ ve SIRAYLA', a.cagri.join() === BES.join(), a.cagri.join());
  T.ok('Acik rapor: acik=true, kurulan bes', ra.acik === true && ra.kurulan.join() === BES.join());

  const k = sahteBaslaticilar();
  const uyarilar = [];
  const eski = console.warn;
  console.warn = (...x) => { uyarilar.push(x.join(' ')); };
  const rk = geceIsleriniBaslat({ ortam: { GECE_ISLERI: '0' }, baslaticilar: k.liste });
  console.warn = eski;
  T.ok('🔴 Kapaliyken HICBIRI cagrilmaz', k.cagri.length === 0, k.cagri.join());
  T.ok('Kapali rapor: acik=false, kurulan bos', rk.acik === false && rk.kurulan.length === 0);
  T.ok('Kapaliyken tek satir uyari (bes zamanlayicinin adiyla)', uyarilar.length === 1 && uyarilar[0].includes('KAPALI') && BES.every((ad) => uyarilar[0].includes(ad)), uyarilar[0]);

  T.H('server.js baglantisi');
  const sunucu = fs.readFileSync(path.join(PROJE_KOKU, 'server.js'), 'utf8');
  const dogrudan = ['startSweeperSchedule', 'startBackupSchedule', 'startBackfillSchedule', 'startMirrorSchedule', 'startSayacSchedule']
    .filter((ad) => new RegExp(`\\b${ad}\\(`).test(sunucu));
  T.ok('🔴 Bes zamanlayici server.js te DOGRUDAN cagrilmiyor', dogrudan.length === 0, dogrudan.join());
  T.ok('geceIsleriniBaslat server.js te TAM BIR KEZ', (sunucu.match(/geceIsleriniBaslat\(/g) || []).length === 1);
  const blok = (sunucu.match(/geceIsleriniBaslat\(\{[\s\S]*?\n\}\);/) || [''])[0];
  const sira = [...blok.matchAll(/\['(\w+)', (start\w+Schedule)\]/g)].map((m) => m[1]);
  T.ok('🔴 Kapiya bes baslatici da bagli, bugunku sirayla', sira.join() === BES.join(), sira.join());
  T.ok('Isindirma (salt okuma) kapinin DISINDA', sunucu.indexOf('startSupabaseIsitma()') > sunucu.indexOf('geceIsleriniBaslat(') && !blok.includes('Isitma'));
  T.ok('initArchive kapidan ONCE (acilis gorunurlugu)', sunucu.indexOf('initArchive();') < sunucu.indexOf('geceIsleriniBaslat('));

  T.H('/api/health bayragi');
  const { initArchive } = require(path.join(PROJE_KOKU, 'server', 'archive', 'db'));
  initArchive();
  const { saglikRaporu } = require(path.join(PROJE_KOKU, 'server', 'saglik'));
  delete process.env.GECE_ISLERI;
  T.ok('GECE_ISLERI yok -> geceIsleri:true', (await saglikRaporu()).geceIsleri === true);
  process.env.GECE_ISLERI = '0';
  const r0 = await saglikRaporu();
  T.ok('GECE_ISLERI=0 -> geceIsleri:false', r0.geceIsleri === false);
  delete process.env.GECE_ISLERI;
  delete process.env.ARCHIVE_BACKUP_AYNI_AYGIT;
  T.ok('D3: yedekAyniAygit varsayilan false', r0.arsiv.yedekAyniAygit === false);
  process.env.ARCHIVE_BACKUP_AYNI_AYGIT = '1';
  T.ok("D3: ARCHIVE_BACKUP_AYNI_AYGIT=1 -> yedekAyniAygit:true (gozden kacmasin)", (await saglikRaporu()).arsiv.yedekAyniAygit === true);
  delete process.env.ARCHIVE_BACKUP_AYNI_AYGIT;
  require(path.join(PROJE_KOKU, 'server', 'archive', 'db')).closeArchive();

  T.bitir();
})();
