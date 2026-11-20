const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * ==========================================================================
 * ÖRTÜK DONANIM ÖZELLİKLERİNİ İSTEĞE BAĞLI YAP — config plugin (2026-11-20)
 * ==========================================================================
 *
 * 🔴 ÇÖZDÜĞÜ SORUN: Play Console 1.0.1 AAB'sini (vc 14) incelemeye almadı:
 * «Zorunlu donanım özelliği beyanları kullanılabilirliği kısıtlıyor:
 * android.hardware.screen.portrait, android.hardware.wifi». İkisi de
 * manifestte yazılı değil, Play bunları ÖRTÜK (uses-implied-feature) çıkarıyor:
 *   • screen.portrait ← app.json `"orientation": "portrait"` (screenOrientation)
 *   • wifi            ← ACCESS_WIFI_STATE izni (@react-native-community/netinfo
 *                       manifestinden birleşerek geliyor)
 * Örtük özellik varsayılan olarak `required=true` sayılır; yani yatay ekranlı
 * ya da Wi-Fi'sız cihazlar (bazı tabletler, TV kutuları) uygulamayı göremez.
 * 1.0.0'da da aynıydı; Play bu kontrolü sonradan sıkılaştırdı.
 *
 * ✅ ÇÖZÜM: iki özelliği açıkça `android:required="false"` ile beyan etmek.
 * Açık beyan örtük olanı geçersiz kılar. İzinlere ve yönelime DOKUNULMAZ:
 * uygulama dikey kalır, netinfo Wi-Fi durumunu okumaya devam eder.
 *
 * `android/` gitignore'da ve `prebuild --clean` onu her derlemede siler; bu
 * yüzden beyan elle değil prebuild'e bağlı bu plugin'le yazılır
 * (aynı gerekçe: plugins/withReleaseSigning.js).
 *
 * İdempotent: aynı ada sahip bir <uses-feature> varsa yenisi eklenmez,
 * yalnız `required` değeri "false"a çekilir.
 */

const OZELLIKLER = ['android.hardware.screen.portrait', 'android.hardware.wifi'];

/** Saf işlev: manifest nesnesine (xml2js biçimi) iki beyanı ekler. Test edilir. */
function ozellikleriEkle(manifest) {
  if (!manifest || !manifest.manifest) {
    throw new Error('[withOptionalFeatures] AndroidManifest beklenen biçimde değil.');
  }
  const kok = manifest.manifest;
  if (!Array.isArray(kok['uses-feature'])) kok['uses-feature'] = [];
  const liste = kok['uses-feature'];

  for (const ad of OZELLIKLER) {
    const var_ = liste.find((o) => o && o.$ && o.$['android:name'] === ad);
    if (var_) {
      var_.$['android:required'] = 'false';
    } else {
      liste.push({ $: { 'android:name': ad, 'android:required': 'false' } });
    }
  }
  return manifest;
}

module.exports = function withOptionalFeatures(config) {
  return withAndroidManifest(config, (cfg) => {
    cfg.modResults = ozellikleriEkle(cfg.modResults);
    return cfg;
  });
};

// Test için
module.exports.ozellikleriEkle = ozellikleriEkle;
module.exports.OZELLIKLER = OZELLIKLER;
