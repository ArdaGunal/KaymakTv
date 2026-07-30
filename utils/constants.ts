// KaymakTV Sabitleri

export const STORE_URL = 'https://kaymaktv.com';

// 🗑️ GEÇİCİ — BETA APK DAĞITIMI (bkz. app/(public)/download.web.tsx)
// Google Play'e yayınlandıktan SONRA bu satır ve o dosya birlikte
// SİLİNMELİDİR — başka hiçbir dosya bu ikisine bağımlı değil, kaldırma
// işlemi bu iki satırdan/dosyadan ibarettir (bkz. docs/HISTORY.md).
// Barındırma: GitHub Releases, sabit "beta" tag'i (Supabase Storage'ın 50MB
// ücretsiz plan sınırına takıldığı için TERK EDİLDİ — bkz. docs/HISTORY.md).
// Yeni bir beta APK'sı yayınlandığında bu dosya, GitHub'daki "beta" release'e
// AYNI dosya adıyla (`kaymaktv-latest.apk`) tekrar yüklenip eskisinin
// üzerine yazılmalı — link URL'si SABİT kalır, kod tarafında değişiklik
// gerekmez.
export const APK_DOWNLOAD_URL = 'https://github.com/ArdaGunal/KaymakTv/releases/download/beta/kaymaktv-latest.apk';
export const GITHUB_RELEASES_URL = 'https://github.com/ArdaGunal/KaymakTv/releases/tag/beta';
