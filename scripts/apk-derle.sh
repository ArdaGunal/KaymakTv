#!/usr/bin/env bash
# APK derle — TEMİZ JS paketiyle (2026-10-10, C7'de bulundu).
#
# Neden: EXPO_PUBLIC_* değişkenleri JS paketine derleme anında GÖMÜLÜR. Önceki
# derlemenin Metro önbelleği ve Gradle'ın «güncel» saydığı paket eski değeri
# taşır → bayraksız derlenen YAYIN APK'sında ağ izleyici ([AG]) AÇIK kalmıştı.
# Bu betik her derlemede önbelleği ve üretilmiş paketi siler.
#
#   bash scripts/apk-derle.sh          → yayın APK'sı (ölçüm KAPALI), yalnız arm (telefon)
#   bash scripts/apk-derle.sh --ag     → test APK'sı (EXPO_PUBLIC_AG_IZLE=1), x86_64 + arm64 (emülatör)
#   bash scripts/apk-derle.sh --google-test → test APK'sı, Google giriş düğmesi AÇIK
#                                        (EXPO_PUBLIC_GOOGLE_GIRIS_TEST=1, kimlik planı D10), x86_64 + arm64
#   bash scripts/apk-derle.sh --aab    → Play paketi (AAB), EXPO_PUBLIC_DAGITIM=play, yalnız arm
#                                        → apk/KaymakTV-<sürüm>.aab · GitHub'a YÜKLENMEZ, Play Console'a yüklenir
#
# 🔴 AD KURALI (2026-11-07, M583): yayın APK'sı `apk/KaymakTV-<versionName>.apk`
# adıyla çıkar ve GitHub «beta» sürümüne AYNI adla yüklenir. kaymaktv.com/download
# dosyayı oradan kendisi bulur (`services/github.ts` → `betaApkSec`: en son `.apk`,
# adında `TEST` geçen ATLANIR). Test paketlerinin eki (`-AG-TEST`, `-GOOGLE-TEST`)
# bu yüzden `TEST` içermek ZORUNDA. Sabit `kaymaktv-latest.apk` adı 404 verdi —
# kullanılmaz. `tests/arayuz/apk-indirme.test.mjs` bu iki dosyayı birlikte denetler.
#
# 📦 MİMARİ (YAYIN_ONCESI_PLAN Adım 2): kalıcı ayar `app.json` → expo-build-properties
# `buildArchs` = armeabi-v7a + arm64-v8a (x86/x86_64 yalnız emülatör, ~40 MB idi). Yayın paketi
# EMÜLATÖRE KURULMAZ; emülatörde test paketi (--ag / --google-test) kullanılır, o x86_64 taşır.
# R8 + kaynak sıkıştırma da app.json'da açık; yayın derlemesi R8 eşlem dosyasını
# (`mapping.txt`) paketin yanına koyar — çökme izini okumak ve Play'e yüklemek için ŞART.
set -euo pipefail
KOK="$(cd "$(dirname "$0")/.." && pwd)"
cd "$KOK/android"

unset EXPO_PUBLIC_AG_IZLE EXPO_PUBLIC_GOOGLE_GIRIS_TEST EXPO_PUBLIC_DAGITIM
# Dagitim kanali (YAYIN_ONCESI_PLAN Adim 1): bu betigin APK'lari yan yuklenir → guncelleme dugmesi
# indirme sayfasini acar. Play paketi (AAB) 'play' ile derlenir (eas.json production ve --aab).
# Her derlemede ACIKCA ayarlanir: Metro onbellegi eski degeri tasimasin.
export EXPO_PUBLIC_DAGITIM=apk
TUR="YAYIN (AG kapali; Google girisi utils/googleGirisBayragi.ts)"; EK=""
GOREV="assembleRelease"; MIMARI=""
case "${1:-}" in
  --ag) export EXPO_PUBLIC_AG_IZLE=1; TUR="TEST (AG acik)"; EK="-AG-TEST" ;;
  --google-test) export EXPO_PUBLIC_GOOGLE_GIRIS_TEST=1; TUR="TEST (Google giris acik — YAYINLANMAZ)"; EK="-GOOGLE-TEST" ;;
  --aab) export EXPO_PUBLIC_DAGITIM=play; TUR="PLAY (AAB, kanal play)"; GOREV="bundleRelease" ;;
  "") ;;
  *) echo "Bilinmeyen secenek: $1" >&2; exit 2 ;;
esac
# Test paketleri emulatorde kosar (x86_64); app.json'daki arm listesini yalniz bu derleme icin ezer.
if [ -n "$EK" ]; then MIMARI="-PreactNativeArchitectures=x86_64,arm64-v8a"; fi

TMPKOK="${LOCALAPPDATA:-$HOME/AppData/Local}/Temp"
rm -rf "$TMPKOK/metro-cache" "$TMPKOK"/metro-file-map-* "$KOK/node_modules/.cache/metro" \
  app/build/generated/assets/createBundleReleaseJsAndAssets app/build/intermediates/sourcemaps/react/release \
  app/build/outputs/mapping/release

JAVA_HOME="${JAVA_HOME_ANDROID:-/c/Program Files/Android/Android Studio/jbr}" \
ANDROID_HOME="${ANDROID_HOME:-$LOCALAPPDATA/Android/Sdk}" \
  ./gradlew "$GOREV" $MIMARI -q

mkdir -p "$KOK/apk"
ESLEM="app/build/outputs/mapping/release/mapping.txt"
eslemKopyala() { # $1 = hedef paket yolu (uzantisiz)
  if [ -f "$ESLEM" ]; then cp "$ESLEM" "$1-mapping.txt"; echo "R8 eslem dosyasi: $1-mapping.txt (Play Console'a da yuklenir)";
  else echo "UYARI: R8 eslem dosyasi yok ($ESLEM) — R8 kapali mi? app.json expo-build-properties" >&2; fi
}

if [ "$GOREV" = "bundleRelease" ]; then
  # AAB'de output-metadata.json yok; surum prebuild'in yazdigi build.gradle'dan okunur (kaynagi app.json).
  SURUM=$(grep -o 'versionName "[^"]*"' app/build.gradle | cut -d'"' -f2)
  KOD=$(grep -o 'versionCode [0-9]*' app/build.gradle | grep -o '[0-9]*$')
  AAB="app/build/outputs/bundle/release/app-release.aab"
  HEDEF_AAB="$KOK/apk/KaymakTV-$SURUM.aab"
  cp "$AAB" "$HEDEF_AAB"
  echo "$TUR · $SURUM (vc $KOD) · $(du -h "$AAB" | cut -f1) · $HEDEF_AAB"
  echo "SHA-256: $(sha256sum "$HEDEF_AAB" | cut -d' ' -f1)"
  eslemKopyala "$KOK/apk/KaymakTV-$SURUM"
  echo "Play paketi: GitHub'a YUKLENMEZ. Play Console → uygulama paketi + eslem dosyasi. versionCode daha once yuklenenden BUYUK olmali."
  exit 0
fi

APK="app/build/outputs/apk/release/app-release.apk"
SURUM=$(grep -o '"versionName": "[^"]*"' app/build/outputs/apk/release/output-metadata.json | cut -d'"' -f4)
KOD=$(grep -o '"versionCode": [0-9]*' app/build/outputs/apk/release/output-metadata.json | grep -o '[0-9]*$')
# Kolay bulunsun diye kökteki apk/ klasörüne kopyala (.gitignore'da, GitHub'a gitmez).
HEDEF="$KOK/apk/KaymakTV-$SURUM$EK.apk"
cp "$APK" "$HEDEF"
echo "$TUR · $SURUM (vc $KOD) · $(du -h "$APK" | cut -f1) · $HEDEF"
echo "SHA-256: $(sha256sum "$HEDEF" | cut -d' ' -f1)"
echo "Dogrula: kur + ac → adb logcat -d -s ReactNativeJS | grep -c '\[AG\]'  (yayinda 0 olmali)"
if [ -z "$EK" ]; then
  eslemKopyala "$KOK/apk/KaymakTV-$SURUM"
  echo "Yayin: GitHub 'beta' surumune AYNI adla yukle → $(basename "$HEDEF")  (kaymaktv.com/download en son yukleneni bulur)"
  echo "Bu paket yalniz arm: EMULATORE KURULMAZ (emulator icin --ag)"
else
  echo "TEST paketi: GitHub'a YUKLENMEZ (indirme sayfasi adinda TEST gecen paketi zaten secmez)"
fi
