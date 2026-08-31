#!/usr/bin/env node
// ==========================================================================
// TEST KOŞUCUSU — `npm test`
// ==========================================================================
// 🔴 HER TEST DOSYASI KENDİ SÜRECİNDE ÇALIŞIR. Bu bir tercih değil,
// ZORUNLULUK: `circuitBreaker`, `tokenBucket`, `memoryCache`, `refreshQueue`,
// `paths` (LazyFetch) ve `db` (arşiv) modül seviyesinde SINGLETON — bu
// bilinçli bir tasarım, orchestrator.js ve db.js başlıklarında yazılı.
// Takımları tek süreçte çalıştırmak şu hataları üretirdi:
//   • L4'te AÇILAN devre, L7 testlerinde hâlâ açık kalır → yanlış "kaldı"
//   • L4'te tüketilen token'lar sonraki takımın kotasını çalar
//   • `paths.js`/`db.js` ilk kökü önbelleklediği için ikinci takım
//     birincinin (silinmiş) geçici köküne yazmaya çalışır
// Alt süreç ayrımı bu sızıntıların HEPSİNİ yapısal olarak imkânsız kılar.
//
// 🔴 HİÇBİR AĞ İSTEĞİ YAPILMAZ, GERÇEK SSD'YE DOKUNULMAZ. Her takım kendi
// geçici kökünü açar (`yardimci.js`), telemetri susturulur. Testler Pi'de
// canlı sunucu çalışırken de güvenle koşturulabilir.
//
// Kullanım:
//   npm test                    tüm takımlar
//   npm run test:lazyfetch      yalnızca LazyFetch (L1-L7+)
//   npm run test:arsiv          yalnızca arşiv (A1+)
//   node tests/calistir.js katalog     tek takım (ad parçası yeter)

const path = require('path');
const { spawnSync } = require('child_process');

// 🔴 KLASÖR AYRIMI KASITLI: `lazyfetch/` ve `arsiv/` iki AYRI sistemdir
// (01_MIMARI.md "cache ≠ arşiv"). Testlerin de aynı sınırı göstermesi,
// birinin kuralının diğerine sızmasını zorlaştırır.
const TAKIMLAR = [
  { ad: 'cekirdek', grup: 'lazyfetch', dosya: 'lazyfetch/cekirdek.test.js', aciklama: 'L1-L5: disk, tek-ucus, disiplin, SWR' },
  { ad: 'supurucu', grup: 'lazyfetch', dosya: 'lazyfetch/supurucu.test.js', aciklama: 'L6: yalnizca cache/ silinir' },
  { ad: 'katalog', grup: 'lazyfetch', dosya: 'lazyfetch/katalog-gecidi.test.js', aciklama: 'L7/L7+: beyaz liste, no-store, denetci' },
  { ad: 'sema', grup: 'arsiv', dosya: 'arsiv/sema.test.js', aciklama: 'A1: sema, kimlik cozumleme, payload' },
  { ad: 'yazici', grup: 'arsiv', dosya: 'arsiv/yazici.test.js', aciklama: 'A2: hiyerarsi acma, tek transaction, rollback' },
  { ad: 'kuyruk', grup: 'arsiv', dosya: 'arsiv/kuyruk.test.js', aciklama: 'A2: kuyruk, eszamanlilik-1, orchestrator kancasi' },
  // 🔴 UCUNCU GRUP: bildirimler. Digerlerinden farkli olarak SUNUCU DEGIL,
  // ISTEMCI kodunu test eder (`features/notifications/` saf katmani) ve bu
  // yuzden `.mjs` + Node'un yerel TypeScript soymasini kullanir — ayrinti
  // ve gerekcesi dosyanin kendi basliginda.
  { ad: 'bildirim', grup: 'bildirimler', dosya: 'bildirimler/planlama.test.mjs', aciklama: 'B1: spoiler saati, secim kurallari, butce' },
  { ad: 'metin', grup: 'bildirimler', dosya: 'bildirimler/metin-havuzu.test.mjs', aciklama: 'B2: mevsimsel pencere, ton tavani, i18n butunlugu' },
  { ad: 'kutu', grup: 'bildirimler', dosya: 'bildirimler/kutu.test.mjs', aciklama: 'B3: defter suzme, dusen/bekleyen ayrimi, tekillestirme' },
  { ad: 'yorgunluk', grup: 'bildirimler', dosya: 'bildirimler/yorgunluk.test.mjs', aciklama: 'B4: toplulastirma, gunluk tavan, oncelik' },
  { ad: 'devam', grup: 'bildirimler', dosya: 'bildirimler/devam.test.mjs', aciklama: 'B5: durtme esigi, sogulma penceresi, aday secimi' },
  { ad: 'istatistik', grup: 'bildirimler', dosya: 'bildirimler/istatistik.test.mjs', aciklama: 'B6: anlik goruntu farki, taban alma, yuvarlama' },
  { ad: 'uzak', grup: 'bildirimler', dosya: 'bildirimler/uzak-havuz.test.mjs', aciklama: 'B7: satir dogrulama, gomulu metni ezememe, beyaz liste' },
];

const filtre = process.argv[2];
const calisacak = filtre
  ? TAKIMLAR.filter((t) => t.ad.includes(filtre) || t.grup === filtre || t.dosya.includes(filtre))
  : TAKIMLAR;

if (!calisacak.length) {
  console.error(`Bilinmeyen takim/grup: "${filtre}"`);
  console.error('Takimlar: ' + TAKIMLAR.map((t) => t.ad).join(', '));
  console.error('Gruplar:  ' + [...new Set(TAKIMLAR.map((t) => t.grup))].join(', '));
  process.exit(2);
}

const basladi = Date.now();
const sonuclar = [];

for (const takim of calisacak) {
  const r = spawnSync(process.execPath, ['--no-warnings', path.join(__dirname, takim.dosya)], { stdio: 'inherit' });
  sonuclar.push({ ...takim, kod: r.status });
}

const basarisiz = sonuclar.filter((s) => s.kod !== 0);

console.log('\n' + '='.repeat(66));
console.log(`TEST OZETI (${((Date.now() - basladi) / 1000).toFixed(1)} sn)`);
console.log('='.repeat(66));
for (const s of sonuclar) {
  console.log(`  ${s.kod === 0 ? '[GECTI]' : '[KALDI]'}  ${(s.grup + '/' + s.ad).padEnd(20)} ${s.aciklama}`);
}
console.log('='.repeat(66));

if (basarisiz.length) {
  console.log(`\n${basarisiz.length} takim BASARISIZ. Yukaridaki "KALANLAR" listelerine bak.\n`);
  process.exit(1);
}
console.log('\nTum takimlar gecti.\n');
