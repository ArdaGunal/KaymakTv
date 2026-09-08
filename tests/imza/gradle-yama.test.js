// `plugins/withReleaseSigning.js` -> yamalaGradleMetni testi.
//
// 🔴 NEDEN AYRI TEST: burada metin cerrahisi var. Yanlis yeri degistirirsek
// DEBUG build'in imzasi bozulur ve bunu ancak cihazda fark ederiz.
// Test GERCEK android/app/build.gradle'a karsi kosuyor (varsa).

const fs = require('fs');
const path = require('path');
const { yamalaGradleMetni, OZELLIKLER } = require('../../plugins/withReleaseSigning');

const KOK = path.join(__dirname, '..', '..');
let gecti = 0, kaldi = 0;
const kontrol = (ad, sart) => {
  if (sart) { gecti++; console.log('  ✅ ' + ad); }
  else { kaldi++; console.log('  ❌ ' + ad); }
};

// Expo sablonunun ilgili kismi (gercek dosya yoksa bu kullanilir)
const SABLON = `android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Caution! In production, you need to generate your own keystore file.
            signingConfig signingConfigs.debug
            minifyEnabled enableProguardInReleaseBuilds
        }
    }
}
`;

const gercekYol = path.join(KOK, 'android', 'app', 'build.gradle');
const gercekVar = fs.existsSync(gercekYol);
const kaynak = gercekVar ? fs.readFileSync(gercekYol, 'utf8') : SABLON;

console.log(gercekVar
  ? '=== GERCEK android/app/build.gradle uzerinde ==='
  : '=== sablon uzerinde (android/ henuz uretilmemis) ===');

const y = yamalaGradleMetni(kaynak);

kontrol('release signingConfig eklendi', y.includes('signingConfigs {\n        release {'));
kontrol('storeFile ozellik adiyla baglandi', y.includes(`storeFile file(${OZELLIKLER.store})`));
kontrol('parola ozellikleri baglandi',
  y.includes(OZELLIKLER.storePass) && y.includes(OZELLIKLER.alias) && y.includes(OZELLIKLER.keyPass));

// 🔴 EN KRITIK IKI KONTROL
const btIdx = y.indexOf('    buildTypes {');
const debugBlok = y.slice(y.indexOf('        debug {', btIdx), y.indexOf('        release {', btIdx));
const releaseBlok = y.slice(y.indexOf('        release {', btIdx));

kontrol('🔴 DEBUG build hala debug imzasini kullaniyor (DOKUNULMADI)',
  debugBlok.includes('signingConfig signingConfigs.debug'));
kontrol('🔴 RELEASE build artik release imzasini kullaniyor',
  releaseBlok.includes('signingConfig signingConfigs.release') &&
  !releaseBlok.includes('signingConfig signingConfigs.debug'));

kontrol('debug signingConfig tanimi korundu (storeFile debug.keystore)',
  y.includes("storeFile file('debug.keystore')"));

// Idempotent: ikinci kez yamalamak hicbir sey degistirmemeli
kontrol('idempotent (ikinci yama fark yaratmiyor)', yamalaGradleMetni(y) === y);

// Bozuk girdide GURULTUYLE patlamali, sessizce gecmemeli
const patlar = (metin) => { try { yamalaGradleMetni(metin); return false; } catch { return true; } };
kontrol('signingConfigs yoksa hata firlatiyor', patlar('android {\n    buildTypes {\n    }\n}\n'));
kontrol('buildTypes yoksa hata firlatiyor',
  patlar("android {\n    signingConfigs {\n        debug {\n            storeFile file('debug.keystore')\n        }\n    }\n}\n"));

console.log(`\n${kaldi === 0 ? '🎉 TUMU GECTI' : '🔴 BASARISIZ'} — gecen ${gecti}, kalan ${kaldi}`);
process.exit(kaldi === 0 ? 0 : 1);
