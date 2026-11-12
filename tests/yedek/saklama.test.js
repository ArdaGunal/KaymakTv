// ==========================================================================
// YEDEK SAKLAMA KURALI (029 · 2026-11-12)
// ==========================================================================
// Kullanici: "yedekler birikmesin … 3 4 ay sonra silinebilir". Bu takim saf karar islevini
// (hangi kopya kalir) ve klasor budamasini (yalniz kendi desenimiz, adi bozuk dosyaya dokunma)
// olcer. Gercek diske dokunmaz: her sey gecici klasorde.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { baslat, PROJE_KOKU } = require('../yardimci');

const T = baslat('YEDEK SAKLAMA (029)', { kokOneki: 'yedek-saklama-' });
const Y = path.join(PROJE_KOKU, 'server', 'yedek');
const s = require(path.join(Y, 'saklama'));
const { DESEN, VARSAYILAN, arsivKurali, lazyfetchEslikci } = require(path.join(Y, 'kurallar'));
const backup = require(path.join(PROJE_KOKU, 'server', 'archive', 'backup'));

const GUN = 24 * 3600 * 1000;
const damga = (t) => t.toISOString().replace(/[:.]/g, '-').slice(0, 19);
const ad = (t) => `katalog-${damga(t)}.db`;
const gun = (iso) => new Date(`${iso}T02:27:09Z`);

// ==================================================================
T.H('Damga cozme — yas dosya ADINDAN');
// ==================================================================
T.ok('katalog-<damga>.db cozuluyor (UTC)', s.damgaCoz('katalog-2026-11-12T02-27-09.db', DESEN.arsiv)?.toISOString() === '2026-11-12T02:27:09.000Z');
T.ok('elle-a3 (kimlik-onarim, ms + Z) cozuluyor',
  s.damgaCoz('elle-a3-oncesi-2026-11-12T02-27-09-123Z.db', DESEN.elle)?.toISOString() === '2026-11-12T02:27:09.123Z');
T.ok('13. ay / 31 Subat / 25. saat -> null',
  s.damgaCoz('katalog-2026-13-01T00-00-00.db', DESEN.arsiv) === null
  && s.damgaCoz('katalog-2026-02-31T00-00-00.db', DESEN.arsiv) === null
  && s.damgaCoz('katalog-2026-02-01T25-00-00.db', DESEN.arsiv) === null);
T.ok('desen disi adlar -> null',
  ['katalog-deneme.db', 'katalog-2026-11-12T02-27-09.db.yeni', 'baska-2026-11-12T02-27-09.db', 'katalog-2026-11-12T02-27-09.dbx']
    .every((x) => s.damgaCoz(x, DESEN.arsiv) === null));

// ==================================================================
T.H('ISO hafta (yil sinirlari)');
// ==================================================================
T.ok('2026-01-01 (Persembe) -> 2026-H01', s.isoHafta(new Date('2026-01-01T12:00:00Z')) === '2026-H01');
T.ok('2027-01-01 (Cuma) -> 2026-H53', s.isoHafta(new Date('2027-01-01T12:00:00Z')) === '2026-H53');
T.ok('2024-12-30 (Pazartesi) -> 2025-H01', s.isoHafta(new Date('2024-12-30T12:00:00Z')) === '2025-H01');
T.ok('2026-11-09 Pzt ve 2026-11-15 Paz ayni hafta, 11-16 sonraki',
  s.isoHafta(gun('2026-11-09')) === s.isoHafta(gun('2026-11-15')) && s.isoHafta(gun('2026-11-16')) !== s.isoHafta(gun('2026-11-15')));

// ==================================================================
T.H('Arsiv kurali: 201 gunluk yedek -> TAM beklenen kume');
// ==================================================================
const simdi = new Date('2026-11-12T03:00:00Z');
const kayitlar = [];
for (let t = gun('2026-04-26'); t <= gun('2026-11-12'); t = new Date(t.getTime() + GUN)) kayitlar.push({ ad: ad(t), t });
const karar = s.saklamaKarari(kayitlar, VARSAYILAN.arsiv, simdi);
const kalan = karar.tutulan.map((x) => x.ad.slice(8, 18)).sort();
const beklenen = ['2026-08-31', '2026-09-30', '2026-10-25', '2026-10-31', '2026-11-01',
  '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12'];
T.ok(`kalan tam olarak 12 kopya (7 gunluk + hafta 11-01, 10-25 + ay 10-31, 09-30, 08-31)`,
  JSON.stringify(kalan) === JSON.stringify(beklenen), kalan.join(' '));
T.ok('silinen + kalan = 201', karar.tutulan.length + karar.silinecek.length === 201);
T.ok('en cok 15 kopya (7+4+4)', karar.tutulan.length <= 15);
T.ok('120 gunden eski hicbir kopya kalmadi', karar.tutulan.every((x) => (simdi - x.t) / GUN <= 120));
T.ok('nedenler: 11-12 hem son hem hafta hem ay',
  JSON.stringify(karar.tutulan.find((x) => x.ad.includes('2026-11-12')).nedenler) === '["son","hafta","ay"]');

// Aylar ilerledikce: 5 ay boyunca her gun yedek al + buda, sonuc hep sinirda kalmali.
let havuz = [];
let enCok = 0;
let yasliKaldi = false;
for (let t = gun('2026-01-01'); t <= gun('2026-06-30'); t = new Date(t.getTime() + GUN)) {
  havuz.push({ ad: ad(t), t });
  const k = s.saklamaKarari(havuz, VARSAYILAN.arsiv, new Date(t.getTime() + 3600000));
  havuz = k.tutulan.map(({ ad: a, t: tt }) => ({ ad: a, t: tt }));
  enCok = Math.max(enCok, havuz.length);
  if (havuz.some((x) => (t - x.t) / GUN > 120)) yasliKaldi = true;
}
T.ok('6 ay gunluk dongu: hicbir an 15 kopyayi gecmedi', enCok <= 15, `en cok ${enCok}`);
T.ok('6 ay gunluk dongu: hicbir an 120 gunden eski kopya kalmadi', !yasliKaldi);
T.ok('6 ay sonra en eski kopya ~3 ay geride (aylik zincir kuruldu)',
  (gun('2026-06-30') - havuz[havuz.length - 1].t) / GUN >= 85, `${Math.round((gun('2026-06-30') - havuz[havuz.length - 1].t) / GUN)} gun`);

// ==================================================================
T.H('Kenar durumlar');
// ==================================================================
const kesik = [];
for (let i = 10; i < 40; i++) kesik.push({ ad: ad(new Date(simdi - i * GUN)), t: new Date(simdi - i * GUN) });
const kesikKarar = s.saklamaKarari(kesik, VARSAYILAN.arsiv, simdi);
const enYeni7 = kesik.slice(0, 7).map((x) => x.ad);
T.ok('🔴 yedek 10 gun kesildi -> elde kalan en yeni 7 kopya SILINMEDI',
  enYeni7.every((a) => kesikKarar.tutulan.some((x) => x.ad === a)));
const eski = [200, 300, 400].map((g) => ({ ad: ad(new Date(simdi - g * GUN)), t: new Date(simdi - g * GUN) }));
T.ok('🔴 hepsi 120 gunden eski 3 kopya -> sonN onunde, hicbiri silinmez',
  s.saklamaKarari(eski, VARSAYILAN.arsiv, simdi).silinecek.length === 0);
T.ok('🔴 sonN 0 verilse bile en az 1 (son kopya asla silinmez)',
  s.saklamaKarari(eski, { sonN: 0, maxGun: 10 }, simdi).tutulan.length === 1);
T.ok('bos liste -> bos karar', s.saklamaKarari([], VARSAYILAN.arsiv, simdi).tutulan.length === 0);

const elleKayit = [5, 50, 119, 130, 200].map((g) => ({ ad: `elle-x-${damga(new Date(simdi - g * GUN))}.db`, t: new Date(simdi - g * GUN) }));
const elleKarar = s.saklamaKarari(elleKayit, VARSAYILAN.elle, simdi);
T.ok('elle/: 120 gun icindekilerin HEPSI kalir, 130 ve 200 gunluk silinir',
  elleKarar.tutulan.length === 3 && elleKarar.silinecek.length === 2);
const elleEski = [200, 300].map((g) => ({ ad: `elle-x-${damga(new Date(simdi - g * GUN))}.db`, t: new Date(simdi - g * GUN) }));
T.ok('elle/: yalniz eski 2 kopya varsa ikisi de kalir (en yeni 2)', s.saklamaKarari(elleEski, VARSAYILAN.elle, simdi).silinecek.length === 0);

// ==================================================================
T.H('Env kurali');
// ==================================================================
const k1 = arsivKurali({ ARCHIVE_BACKUP_GUNLUK: '10', ARCHIVE_BACKUP_HAFTALIK: 'abc', ARCHIVE_BACKUP_AYLIK: '', ARCHIVE_BACKUP_MAX_GUN: '0' });
T.ok('GUNLUK=10 okunur, gecersiz/bos -> varsayilan, MAX_GUN=0 -> sinirsiz',
  k1.sonN === 10 && k1.haftalik === 4 && k1.aylik === 4 && k1.maxGun === null, JSON.stringify(k1));
T.ok('GUNLUK=0 -> en az 1', arsivKurali({ ARCHIVE_BACKUP_GUNLUK: '0' }).sonN === 1);
T.ok('env yok -> 7/4/4/120', JSON.stringify(arsivKurali({})) === JSON.stringify({ sonN: 7, haftalik: 4, aylik: 4, maxGun: 120 }));
T.ok('runBackup({keep:3}) uyumu: keep sonN olur', arsivKurali({}, 3).sonN === 3);

// ==================================================================
T.H('Klasor budamasi — yalniz kendi desenimiz');
// ==================================================================
const dizin = fs.mkdtempSync(path.join(os.tmpdir(), 'yedek-buda-'));
for (let i = 0; i < 40; i++) fs.writeFileSync(path.join(dizin, ad(new Date(simdi - i * 5 * GUN))), 'x');
const yabanci = ['notlar.txt', 'katalog-deneme.db', 'katalog-2026-13-01T00-00-00.db', 'baska-proje.db', 'katalog-2025-01-01T00-00-00.db.yeni'];
for (const y of yabanci) fs.writeFileSync(path.join(dizin, y), 'dokunma');
fs.mkdirSync(path.join(dizin, ad(new Date(simdi - 500 * GUN))));
const kuru = s.budaDizin(dizin, { desen: DESEN.arsiv, kural: VARSAYILAN.arsiv, simdi, kuru: true });
T.ok('kuru kosu hicbir sey silmez', fs.readdirSync(dizin).length === 46 && kuru.silinen.length > 0, `${kuru.silinen.length} silinecekti`);
const b = s.budaDizin(dizin, { desen: DESEN.arsiv, kural: VARSAYILAN.arsiv, simdi });
T.ok('budama silinecekleri sildi, hata yok', b.silinen.length === kuru.silinen.length && b.hatalar.length === 0);
T.ok('🔴 desen disi / adi bozuk dosyalara DOKUNULMADI', yabanci.every((y) => fs.existsSync(path.join(dizin, y))));
T.ok('🔴 desene uyan KLASORE dokunulmadi', fs.existsSync(path.join(dizin, ad(new Date(simdi - 500 * GUN)))));
T.ok('kalan katalog kopyalari <= 15 ve hepsi <= 120 gun',
  s.kopyalariListele(dizin, DESEN.arsiv).every((x) => (simdi - x.t) / GUN <= 120) && s.kopyalariListele(dizin, DESEN.arsiv).length <= 15);

// Eslikci dosyalar (LazyFetch .sha256/.json) tar ile birlikte gider, kalanlarinki kalir.
const lfDizin = fs.mkdtempSync(path.join(os.tmpdir(), 'yedek-lf-buda-'));
for (let i = 0; i < 30; i++) {
  const kok = `lazyfetch-${damga(new Date(simdi - i * 7 * GUN))}`;
  for (const u of ['.tar', '.sha256', '.json']) fs.writeFileSync(path.join(lfDizin, kok + u), 'x');
}
const lfb = s.budaDizin(lfDizin, { desen: DESEN.lazyfetch, kural: VARSAYILAN.lazyfetch, simdi, eslikci: lazyfetchEslikci });
const kalanTar = fs.readdirSync(lfDizin).filter((f) => f.endsWith('.tar'));
T.ok('lazyfetch: en cok 8 tar kaldi (4 hafta + 4 ay)', kalanTar.length <= 8 && lfb.silinen.length === 30 - kalanTar.length, `${kalanTar.length} tar`);
T.ok('🔴 silinen tar in .sha256 ve .json yan dosyalari da gitti, kalanlarinki duruyor',
  fs.readdirSync(lfDizin).length === kalanTar.length * 3
  && kalanTar.every((t) => fs.existsSync(path.join(lfDizin, t.replace('.tar', '.sha256')))));

// Eski API: kopyalariDondur(dizin, sayi) hala calisiyor (yalniz en yeni N).
const eskiApi = fs.mkdtempSync(path.join(os.tmpdir(), 'yedek-eski-'));
for (let i = 0; i < 5; i++) fs.writeFileSync(path.join(eskiApi, ad(new Date(simdi - i * GUN))), 'x');
T.ok('backup.kopyalariDondur(dizin, 2) -> 3 silindi, en yeni 2 kaldi',
  backup.kopyalariDondur(eskiApi, 2) === 3 && fs.readdirSync(eskiApi).sort().pop() === ad(simdi));

for (const d of [dizin, lfDizin, eskiApi]) fs.rmSync(d, { recursive: true, force: true });
T.bitir();
