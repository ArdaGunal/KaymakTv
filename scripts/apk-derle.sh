#!/usr/bin/env bash
# APK derle — TEMİZ JS paketiyle (2026-10-10, C7'de bulundu).
#
# Neden: EXPO_PUBLIC_* değişkenleri JS paketine derleme anında GÖMÜLÜR. Önceki
# derlemenin Metro önbelleği ve Gradle'ın «güncel» saydığı paket eski değeri
# taşır → bayraksız derlenen YAYIN APK'sında ağ izleyici ([AG]) AÇIK kalmıştı.
# Bu betik her derlemede önbelleği ve üretilmiş paketi siler.
#
#   bash scripts/apk-derle.sh          → yayın APK'sı (ölçüm KAPALI)
#   bash scripts/apk-derle.sh --ag     → test APK'sı (EXPO_PUBLIC_AG_IZLE=1)
#   bash scripts/apk-derle.sh --google-test → test APK'sı, Google giriş düğmesi AÇIK
#                                        (EXPO_PUBLIC_GOOGLE_GIRIS_TEST=1, kimlik planı D10)
set -euo pipefail
KOK="$(cd "$(dirname "$0")/.." && pwd)"
cd "$KOK/android"

unset EXPO_PUBLIC_AG_IZLE EXPO_PUBLIC_GOOGLE_GIRIS_TEST
TUR="YAYIN (AG kapali; Google girisi utils/googleGirisBayragi.ts)"; EK=""
case "${1:-}" in
  --ag) export EXPO_PUBLIC_AG_IZLE=1; TUR="TEST (AG acik)"; EK="-AG-TEST" ;;
  --google-test) export EXPO_PUBLIC_GOOGLE_GIRIS_TEST=1; TUR="TEST (Google giris acik — YAYINLANMAZ)"; EK="-GOOGLE-TEST" ;;
  "") ;;
  *) echo "Bilinmeyen secenek: $1" >&2; exit 2 ;;
esac

TMPKOK="${LOCALAPPDATA:-$HOME/AppData/Local}/Temp"
rm -rf "$TMPKOK/metro-cache" "$TMPKOK"/metro-file-map-* "$KOK/node_modules/.cache/metro" \
  app/build/generated/assets/createBundleReleaseJsAndAssets app/build/intermediates/sourcemaps/react/release

JAVA_HOME="${JAVA_HOME_ANDROID:-/c/Program Files/Android/Android Studio/jbr}" \
ANDROID_HOME="${ANDROID_HOME:-$LOCALAPPDATA/Android/Sdk}" \
  ./gradlew assembleRelease -q

APK="app/build/outputs/apk/release/app-release.apk"
SURUM=$(grep -o '"versionName": "[^"]*"' app/build/outputs/apk/release/output-metadata.json | cut -d'"' -f4)
KOD=$(grep -o '"versionCode": [0-9]*' app/build/outputs/apk/release/output-metadata.json | grep -o '[0-9]*$')
# Kolay bulunsun diye kökteki apk/ klasörüne kopyala (.gitignore'da, GitHub'a gitmez).
mkdir -p "$KOK/apk"
HEDEF="$KOK/apk/KaymakTV-$SURUM$EK.apk"
cp "$APK" "$HEDEF"
echo "$TUR · $SURUM (vc $KOD) · $(du -h "$APK" | cut -f1) · $HEDEF"
echo "SHA-256: $(sha256sum "$HEDEF" | cut -d' ' -f1)"
echo "Dogrula: kur + ac → adb logcat -d -s ReactNativeJS | grep -c '\[AG\]'  (yayinda 0 olmali)"
