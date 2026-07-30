import { Redirect } from 'expo-router';

/**
 * 🗑️ GEÇİCİ — `download.web.tsx`'in ZORUNLU fallback eşleniği.
 *
 * Bu dosya olmadan expo-router (~6.0.24) TÜM uygulamayı şu hatayla çökertir:
 * "The file ./(public)/download.web.tsx does not have a fallback sibling
 * file without a platform extension." — canlıda test edilip bulundu.
 * `docs/ARCHITECTURE.md` § D'deki platform-splitting açıklaması component
 * import'ları (Metro çözümlemesi) için doğru, ama ROTA dosyaları için
 * expo-router HER platform-özel dosyanın yanında sade bir `.tsx` bekliyor.
 *
 * Native'de bu sayfanın gerçek bir karşılığı yok (yalnızca Web sideloading
 * içindir) — `/` (herkese açık karşılama) sayfasına yönlendirir.
 *
 * KALDIRMA: `download.web.tsx` ile BİRLİKTE silinmeli — bkz. o dosyadaki
 * kaldırma talimatı ve `utils/constants.ts`'teki `APK_DOWNLOAD_URL`.
 */
export default function DownloadFallback() {
  return <Redirect href="/" />;
}
