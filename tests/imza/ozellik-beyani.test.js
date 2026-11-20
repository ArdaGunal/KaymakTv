// `plugins/withOptionalFeatures.js` -> ozellikleriEkle testi.
//
// Play Console 1.0.1'i «zorunlu donanim ozelligi» (screen.portrait, wifi)
// yuzunden reddetti. Plugin iki ozelligi required=false ile beyan eder.
// Burada: iki satir TEK kez eklenir, ikinci kosuda cogalmaz, mevcut
// required=true olani false'a ceker, baska ozelliklere ve izinlere dokunmaz.
// Prebuild sonrasi gercek android/app/src/main/AndroidManifest.xml varsa onu da denetler.

const fs = require('fs');
const path = require('path');
const { ozellikleriEkle, OZELLIKLER } = require('../../plugins/withOptionalFeatures');

const KOK = path.join(__dirname, '..', '..');
let gecti = 0, kaldi = 0;
const kontrol = (ad, sart) => {
  if (sart) { gecti++; console.log('  ✅ ' + ad); }
  else { kaldi++; console.log('  ❌ ' + ad); }
};

const bul = (m, ad) => (m.manifest['uses-feature'] || []).filter((o) => o.$['android:name'] === ad);

// 1) Bos manifest: iki satir eklenir
const m = {
  manifest: {
    $: { 'xmlns:android': 'http://schemas.android.com/apk/res/android' },
    'uses-permission': [{ $: { 'android:name': 'android.permission.ACCESS_WIFI_STATE' } }],
    application: [{ $: { 'android:name': '.MainApplication' } }],
  },
};
ozellikleriEkle(m);
for (const ad of OZELLIKLER) {
  const b = bul(m, ad);
  kontrol(`${ad} tek kez eklendi`, b.length === 1);
  kontrol(`${ad} required=false`, b[0] && b[0].$['android:required'] === 'false');
}

// 2) Ikinci kosu: cogalmaz
const once = JSON.stringify(m);
ozellikleriEkle(m);
kontrol('idempotent (ikinci kosu fark yaratmiyor)', JSON.stringify(m) === once);
kontrol('toplam uses-feature sayisi 2', m.manifest['uses-feature'].length === 2);

// 3) Izin ve application dokunulmadi
kontrol('ACCESS_WIFI_STATE izni duruyor',
  m.manifest['uses-permission'].length === 1 &&
  m.manifest['uses-permission'][0].$['android:name'] === 'android.permission.ACCESS_WIFI_STATE');
kontrol('application dokunulmadi', m.manifest.application[0].$['android:name'] === '.MainApplication');

// 4) Onceden required=true beyan varsa: false'a cekilir, yeni satir eklenmez; baska ozellik korunur
const m2 = {
  manifest: {
    'uses-feature': [
      { $: { 'android:name': 'android.hardware.wifi', 'android:required': 'true' } },
      { $: { 'android:name': 'android.hardware.camera', 'android:required': 'false' } },
    ],
  },
};
ozellikleriEkle(m2);
kontrol('mevcut wifi beyani false\'a cekildi, cogalmadi',
  bul(m2, 'android.hardware.wifi').length === 1 &&
  bul(m2, 'android.hardware.wifi')[0].$['android:required'] === 'false');
kontrol('baska ozellik (camera) korundu', bul(m2, 'android.hardware.camera').length === 1);
kontrol('portrait eklendi', bul(m2, 'android.hardware.screen.portrait').length === 1);

// 5) Bozuk girdide patlar
let patladi = false;
try { ozellikleriEkle({}); } catch { patladi = true; }
kontrol('bozuk manifestte hata firlatiyor', patladi);

// 6) Prebuild ciktisi varsa gercek manifest
const gercek = path.join(KOK, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
if (fs.existsSync(gercek)) {
  const xml = fs.readFileSync(gercek, 'utf8');
  for (const ad of OZELLIKLER) {
    const satirlar = xml.match(new RegExp(`<uses-feature[^>]*android:name="${ad.replace(/\./g, '\\.')}"[^>]*>`, 'g')) || [];
    kontrol(`gercek manifest: ${ad} tek satir, required=false`,
      satirlar.length === 1 && satirlar[0].includes('android:required="false"'));
  }
  kontrol('gercek manifest: yonelim hala portrait', xml.includes('android:screenOrientation="portrait"'));
} else {
  console.log('  (android/ yok — gercek manifest denetimi atlandi; prebuild sonrasi yeniden kos)');
}

console.log(`\n${kaldi === 0 ? '🎉 TUMU GECTI' : '🔴 BASARISIZ'} — gecen ${gecti}, kalan ${kaldi}`);
process.exit(kaldi === 0 ? 0 : 1);
