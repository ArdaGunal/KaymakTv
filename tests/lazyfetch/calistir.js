#!/usr/bin/env node
// ==========================================================================
// LAZYFETCH TEST KOŞUCUSU — `npm run test:lazyfetch`
// ==========================================================================
// 🔴 HER TEST DOSYASI KENDİ SÜRECİNDE ÇALIŞIR. Bu bir tercih değil,
// ZORUNLULUK: `circuitBreaker`, `tokenBucket`, `memoryCache`, `refreshQueue`
// ve `paths` modül seviyesinde SINGLETON (Node'un require cache'i sayesinde
// — bu bilinçli bir tasarım, orchestrator.js başlığında yazılı). Üç takımı
// tek süreçte çalıştırmak şu hataları üretirdi:
//   • L4'te AÇILAN devre, L7 testlerinde hâlâ açık kalır → yanlış "kaldı"
//   • L4'te tüketilen token'lar sonraki takımın kotasını çalar
//   • `paths.js` ilk `LAZYFETCH_ROOT`'u önbelleklediği için ikinci takım
//     birincinin (silinmiş) geçici köküne yazmaya çalışır
// Alt süreç ayrımı bu sızıntıların HEPSİNİ yapısal olarak imkânsız kılar.
//
// 🔴 HİÇBİR AĞ İSTEĞİ YAPILMAZ, GERÇEK SSD'YE DOKUNULMAZ. Her takım kendi
// geçici kökünü açar (`yardimci.js`), telemetri susturulur. Testler Pi'de
// canlı sunucu çalışırken de güvenle koşturulabilir.
//
// Kullanım:
//   npm run test:lazyfetch
//   node tests/lazyfetch/calistir.js            (aynısı)
//   node tests/lazyfetch/calistir.js cekirdek   (yalnızca bir takım)

const path = require('path');
const { spawnSync } = require('child_process');

const TAKIMLAR = [
  { ad: 'cekirdek', dosya: 'cekirdek.test.js', aciklama: 'L1-L5: disk, tek-ucus, disiplin, SWR' },
  { ad: 'supurucu', dosya: 'supurucu.test.js', aciklama: 'L6: yalnizca cache/ silinir' },
  { ad: 'katalog', dosya: 'katalog-gecidi.test.js', aciklama: 'L7/L7+: beyaz liste, no-store, denetci' },
];

const secilen = process.argv[2];
const calisacak = secilen ? TAKIMLAR.filter((t) => t.ad.includes(secilen) || t.dosya.includes(secilen)) : TAKIMLAR;

if (!calisacak.length) {
  console.error('Bilinmeyen takim: "' + secilen + '". Gecerli: ' + TAKIMLAR.map((t) => t.ad).join(', '));
  process.exit(2);
}

const basladi = Date.now();
const sonuclar = [];

for (const takim of calisacak) {
  const r = spawnSync(process.execPath, [path.join(__dirname, takim.dosya)], { stdio: 'inherit' });
  sonuclar.push({ ...takim, kod: r.status });
}

const basarisiz = sonuclar.filter((s) => s.kod !== 0);

console.log('\n' + '='.repeat(62));
console.log('LAZYFETCH TEST OZETI (' + ((Date.now() - basladi) / 1000).toFixed(1) + ' sn)');
console.log('='.repeat(62));
for (const s of sonuclar) {
  console.log('  ' + (s.kod === 0 ? '[GECTI]' : '[KALDI]') + '  ' + s.ad.padEnd(10) + s.aciklama);
}
console.log('='.repeat(62));

if (basarisiz.length) {
  console.log('\n' + basarisiz.length + ' takim BASARISIZ. Yukaridaki "KALANLAR" listelerine bak.\n');
  process.exit(1);
}
console.log('\nTum takimlar gecti.\n');
