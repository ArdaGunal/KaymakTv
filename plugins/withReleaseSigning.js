const fs = require('fs');
const path = require('path');
const {
  withDangerousMod,
  withAppBuildGradle,
  withGradleProperties,
} = require('@expo/config-plugins');

/**
 * ==========================================================================
 * YEREL RELEASE İMZASI — config plugin (Faz T yan işi, 2026-09-07)
 * ==========================================================================
 *
 * 🔴 ÇÖZDÜĞÜ SORUN: `localapk.bat` → `expo prebuild --clean` + `gradlew
 * assembleRelease` ile üretilen APK, Expo şablonunun varsayılanı yüzünden
 * **DEBUG keystore** ile imzalanıyordu:
 *
 *     release { signingConfig signingConfigs.debug }   // şablonun hâli
 *
 * O anahtarın SHA-1'i (`5E:8F:16:06:…:F6:25`) EAS'ın keystore'undan
 * FARKLI. Google Sign-In paket adı + SHA-1 eşleşmesine baktığı için yerel
 * APK'da giriş **`DEVELOPER_ERROR` (kod 10)** ile reddediliyordu — cihazda
 * "google giriş başarısız(10)" olarak görüldü.
 *
 * ⚠️ NEDEN TEKRAR TEKRAR GELİYORDU: `android/` gitignore'da ve
 * `prebuild --clean` her derlemede o klasörü SIFIRLIYOR. `build.gradle`'a
 * elle yapılan her düzeltme bir sonraki derlemede buharlaşıyordu. Kalıcı
 * çözüm, düzeltmenin prebuild'in KENDİSİNE bağlanması — yani bu dosya.
 *
 * ==========================================================================
 * ⛔ NEDEN DEBUG SHA-1'İNİ CLOUD CONSOLE'A EKLEMEDİK (Seçenek A reddedildi)
 * ==========================================================================
 * O anahtar React Native şablonuyla gelen ve HERKESTE AYNI olan **public**
 * bir anahtardır. Kaydedilseydi, `com.ardagnl.kaymak` paket adıyla ve o
 * bilinen anahtarla APK derleyen herkes bizim OAuth istemcimizle token
 * alabilirdi. Kullanıcı kararı (2026-09-07): *"Faz T ile kullanıcıların
 * kişisel verilerini tutmaya başladığımız bir dönemde bu riski alamam."*
 *
 * ==========================================================================
 * ✅ SEÇİLEN YOL: yerel ve bulut APK'ları TEK KİMLİK
 * ==========================================================================
 * `credentials/release.keystore` = EAS'ın kullandığı keystore'un kopyası.
 * Böylece:
 *   • Cloud Console'da HİÇBİR değişiklik gerekmez — EAS'ın SHA-1'i zaten
 *     kayıtlı ve çalışıyor.
 *   • Yerel ve bulut APK'ları AYNI imzayı taşır, yani biri diğerinin
 *     ÜZERİNE kurulabilir. (Farklı imzalarda Android "uygulama yüklenmedi"
 *     der ve kullanıcı önce kaldırmak zorunda kalır.)
 *
 * 🔒 Keystore ve parolalar git'e GİRMEZ: `.gitignore` zaten `*.keystore`
 * satırını taşıyor, `credentials/` de eklendi.
 *
 * ==========================================================================
 * 🔴 EAS BUILD'DE DEVRE DIŞI
 * ==========================================================================
 * EAS kendi kimlik bilgilerini prebuild'den SONRA kendisi enjekte ediyor.
 * Bu plugin orada çalışsaydı ya çakışır ya da (dosya olmadığı için)
 * derlemeyi düşürürdü. `EAS_BUILD` değişkeni varsa hiçbir şey yapmıyoruz.
 *
 * ⚠️ YEREL'de kimlik bilgisi YOKSA **HATA FIRLATIYORUZ**, sessizce debug'a
 * düşmüyoruz. Sessiz geri düşüş, tam da bu hatanın aylarca fark edilmeden
 * tekrarlamasının sebebiydi.
 */

const KEYSTORE_DIZINI = 'credentials';
const KEYSTORE_DOSYASI = 'release.keystore';
const AYAR_DOSYASI = 'keystore.properties';

/** Gradle'a yazılacak özellik adları — build.gradle bunlara bakıyor. */
const P = {
  store: 'KAYMAK_RELEASE_STORE_FILE',
  storePass: 'KAYMAK_RELEASE_STORE_PASSWORD',
  alias: 'KAYMAK_RELEASE_KEY_ALIAS',
  keyPass: 'KAYMAK_RELEASE_KEY_PASSWORD',
};

const easUzerindeMi = () =>
  process.env.EAS_BUILD === 'true' || process.env.EAS_BUILD === '1';

/**
 * Kimlik bilgilerini okur: önce ortam değişkenleri, yoksa
 * `credentials/keystore.properties`.
 *
 * Ortam değişkeni önceliği bilinçli — CI'da dosya bırakmadan derleme
 * yapılabilsin diye.
 */
function kimlikOku(projeKoku) {
  const envden = {
    storePassword: process.env.KAYMAK_RELEASE_STORE_PASSWORD,
    keyAlias: process.env.KAYMAK_RELEASE_KEY_ALIAS,
    keyPassword: process.env.KAYMAK_RELEASE_KEY_PASSWORD,
  };
  if (envden.storePassword && envden.keyAlias && envden.keyPassword) return envden;

  const ayarYolu = path.join(projeKoku, KEYSTORE_DIZINI, AYAR_DOSYASI);
  if (!fs.existsSync(ayarYolu)) return null;

  const okunan = {};
  for (const satir of fs.readFileSync(ayarYolu, 'utf8').split('\n')) {
    const t = satir.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    okunan[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  if (!okunan.storePassword || !okunan.keyAlias || !okunan.keyPassword) return null;
  return okunan;
}

function eksikHatasi(neden) {
  return new Error(
    [
      '',
      '════════════════════════════════════════════════════════════════',
      ' YEREL RELEASE İMZASI YAPILANDIRILMAMIŞ — derleme durduruldu',
      '════════════════════════════════════════════════════════════════',
      ` Sebep: ${neden}`,
      '',
      ' Bu bilinçli bir DURDURMA. Devam etseydik APK, herkeste aynı olan',
      ' PUBLIC debug anahtarıyla imzalanır ve Google girişi DEVELOPER_ERROR',
      ' (kod 10) verirdi — düzeltmeye çalıştığımız hatanın ta kendisi.',
      '',
      ' Kurulum (bir kez):',
      `   1) EAS keystore'unu indir:  npx eas-cli credentials -p android`,
      `      → Keystore → Download → ${KEYSTORE_DIZINI}/${KEYSTORE_DOSYASI}`,
      `   2) Parolaları yaz:          ${KEYSTORE_DIZINI}/${AYAR_DOSYASI}`,
      `      (örnek için ${KEYSTORE_DIZINI}/${AYAR_DOSYASI}.example)`,
      '',
      ' Ayrıntı: plugins/withReleaseSigning.js başlığı',
      '════════════════════════════════════════════════════════════════',
      '',
    ].join('\n')
  );
}

/** 1) Keystore dosyasını `android/app/` içine kopyalar. */
const keystoreyiKopyala = (config) =>
  withDangerousMod(config, [
    'android',
    async (cfg) => {
      if (easUzerindeMi()) return cfg;

      const kok = cfg.modRequest.projectRoot;
      const kaynak = path.join(kok, KEYSTORE_DIZINI, KEYSTORE_DOSYASI);
      if (!fs.existsSync(kaynak)) {
        throw eksikHatasi(`${KEYSTORE_DIZINI}/${KEYSTORE_DOSYASI} bulunamadı`);
      }
      if (!kimlikOku(kok)) {
        throw eksikHatasi(`${KEYSTORE_DIZINI}/${AYAR_DOSYASI} eksik veya alanları boş`);
      }

      const hedef = path.join(cfg.modRequest.platformProjectRoot, 'app', KEYSTORE_DOSYASI);
      fs.mkdirSync(path.dirname(hedef), { recursive: true });
      fs.copyFileSync(kaynak, hedef);
      return cfg;
    },
  ]);

/** 2) Parolaları `android/gradle.properties`e yazar (o dosya da gitignore'da). */
const ozellikleriYaz = (config) =>
  withGradleProperties(config, (cfg) => {
    if (easUzerindeMi()) return cfg;

    const kimlik = kimlikOku(cfg.modRequest.projectRoot);
    if (!kimlik) throw eksikHatasi('parolalar okunamadı');

    const yaz = (key, value) => {
      const mevcut = cfg.modResults.find((x) => x.type === 'property' && x.key === key);
      if (mevcut) mevcut.value = value;
      else cfg.modResults.push({ type: 'property', key, value });
    };

    yaz(P.store, KEYSTORE_DOSYASI);
    yaz(P.storePass, kimlik.storePassword);
    yaz(P.alias, kimlik.keyAlias);
    yaz(P.keyPass, kimlik.keyPassword);
    return cfg;
  });

/**
 * SAF — `build.gradle` metnini yamalar. Ayrı fonksiyon çünkü buradaki metin
 * cerrahisi en kırılgan kısım: yanlış yeri değiştirirsek DEBUG build'in
 * imzası bozulur ve bunu ancak cihazda fark ederdik. Testi
 * `tests/imza/gradle-yama.test.js`.
 */
function yamalaGradleMetni(src) {
  if (src.includes('signingConfigs.release')) return src; // zaten yamalı

  // 3a) signingConfigs bloğuna `release` ekle
  const imzaBlogu =
    `    signingConfigs {\n        release {\n` +
    `            storeFile file(${P.store})\n` +
    `            storePassword ${P.storePass}\n` +
    `            keyAlias ${P.alias}\n` +
    `            keyPassword ${P.keyPass}\n` +
    `        }\n`;

  if (!src.includes('    signingConfigs {\n')) {
    throw new Error('[withReleaseSigning] `signingConfigs {` bulunamadı — şablon değişmiş olabilir.');
  }
  src = src.replace('    signingConfigs {\n', imzaBlogu);

  // 3b) buildTypes.release'in imzasını değiştir.
  // 🔴 SADECE release bloğundakini: `buildTypes`ten SONRAKİ ilk
  // `signingConfigs.debug` DEBUG build'e ait ve ONA DOKUNULMAZ. Yanlış
  // olanı değiştirirsek debug derlemesi bozulur ve bunu ancak cihazda
  // fark ederdik.
  const bt = src.indexOf('    buildTypes {');
  if (bt === -1) throw new Error('[withReleaseSigning] `buildTypes {` bulunamadı.');
  const rel = src.indexOf('        release {', bt);
  if (rel === -1) throw new Error('[withReleaseSigning] release buildType bulunamadı.');

  const hedef = 'signingConfig signingConfigs.debug';
  const i = src.indexOf(hedef, rel);
  if (i === -1) {
    throw new Error('[withReleaseSigning] release bloğunda debug imzası bulunamadı — şablon değişmiş olabilir.');
  }
  return src.slice(0, i) + 'signingConfig signingConfigs.release' + src.slice(i + hedef.length);
}

/** 3) `build.gradle`e release signingConfig ekler ve release build'i ona bağlar. */
const gradleYamala = (config) =>
  withAppBuildGradle(config, (cfg) => {
    if (easUzerindeMi()) return cfg;
    cfg.modResults.contents = yamalaGradleMetni(cfg.modResults.contents);
    return cfg;
  });

module.exports = function withReleaseSigning(config) {
  return gradleYamala(ozellikleriYaz(keystoreyiKopyala(config)));
};

// Test için: saf yama fonksiyonu ve özellik adları.
module.exports.yamalaGradleMetni = yamalaGradleMetni;
module.exports.OZELLIKLER = P;
