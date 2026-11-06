// KaymakTV Sabitleri

export const STORE_URL = 'https://kaymaktv.com';

// BETA APK DAĞITIMI (bkz. app/(public)/download.web.tsx) — Play Store'a
// çıkıldıktan sonra bir ara kaldırılmıştı ama kullanıcı hâlâ aktif olarak
// kullandığını belirtti (2026-08-16), bu yüzden KALICI olarak geri
// eklendi — bir daha "temizlik" gerekçesiyle silinmemeli.
// Barındırma: GitHub Releases, sabit "beta" tag'i (Supabase Storage'ın 50MB
// ücretsiz plan sınırına takıldığı için TERK EDİLDİ — bkz. docs/HISTORY.md).
// Yeni APK GitHub'daki "beta" release'e SÜRÜM NUMARALI adla yüklenir
// (`KaymakTV-2.6.8.apk`); indirme sayfası dosyayı oradan kendisi bulur
// (`services/github.ts` → `betaApkSec`). Sabit `kaymaktv-latest.apk` adresi
// 2026-11-07'de 404 verdiği için KALDIRILDI — kodda dosya adı tutulmaz.
export const GITHUB_RELEASES_URL = 'https://github.com/ArdaGunal/KaymakTv/releases/tag/beta';
