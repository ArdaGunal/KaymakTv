# credentials/ — yerel release imzası

Bu klasör **git'e girmez** (`.gitignore`). İçinde iki dosya olmalı:

| Dosya | Ne |
|---|---|
| `release.keystore` | EAS'ın kullandığı keystore'un kopyası |
| `keystore.properties` | Parolalar (`keystore.properties.example`'dan kopyala) |

## Neden

`localapk.bat` (`expo prebuild --clean` + `gradlew assembleRelease`) APK'yı
Expo şablonunun varsayılanıyla, yani **herkeste aynı olan public debug
anahtarıyla** imzalıyordu. O anahtarın SHA-1'i EAS'ınkinden farklı olduğu
için Google girişi cihazda **`DEVELOPER_ERROR` (kod 10)** veriyordu.

`plugins/withReleaseSigning.js` bunu prebuild'in içine bağlayarak kalıcı
olarak çözer — `--clean` artık düzeltmeyi silemez.

## Kurulum (bir kez)

```bash
npx eas-cli credentials -p android
```
→ `production` (ya da `preview`) → **Keystore** → **Download**
→ inen dosyayı `credentials/release.keystore` olarak kaydet.

Aynı ekran `Keystore password`, `Key alias`, `Key password` değerlerini de
gösterir; onları `keystore.properties`e yaz.

## Sonuç

Yerel ve EAS APK'ları **aynı imzayı** taşır:

- Google Cloud Console'da **hiçbir değişiklik gerekmez** — EAS'ın SHA-1'i
  zaten kayıtlı ve çalışıyor.
- İki APK birbirinin **üzerine kurulabilir**. Farklı imzalarda Android
  "uygulama yüklenmedi" der ve önce kaldırmak gerekirdi.

## ⚠️ Kurulmazsa ne olur

`expo prebuild` **hata verip durur**. Bu bilinçli: sessizce debug anahtarına
düşmek, düzeltmeye çalıştığımız hatayı geri getirirdi.
