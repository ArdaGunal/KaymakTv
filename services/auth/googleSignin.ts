import { GoogleSignin } from '@react-native-google-signin/google-signin';

/**
 * Yerel Google Sign-In yapılandırması — TEK yer. Giriş (`hooks/useGoogleNativeSignIn.ts`)
 * ve çıkış (`services/auth/cikisTemizligi.ts`) ikisi de buradan geçer.
 *
 * 🔴 M518 (canlı turda bulundu): yapılandırma eskiden yalnız giriş kancasındaydı. Uygulama
 * açılıp doğrudan Ayarlar'dan çıkış yapılınca `signOut()` → «apiClient is null - call
 * configure() first» → telefon Google hesabını hatırlamaya devam ediyordu (D8 ihlali).
 */
let yapilandirildi = false;

export function googleSigninYapilandir(): void {
  if (yapilandirildi) return;
  GoogleSignin.configure({
    // `webClientId` HER platformda geçiliyor — dönen `idToken`'ın kimliğini
    // (aud) Web client ID'sine sabitliyor, Worker'ın izin verdiği üç aud'dan
    // biri (bkz. src/index.js `verifyGoogleIdToken`). Android'de bir idToken
    // ALABİLMEK için bu alan zorunlu (paketin kendi dokümanı).
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    offlineAccess: false,
  });
  yapilandirildi = true;
}

/** Çıkış: önceki Google oturumu varsa kapatır (sonraki girişte hesap seçici çıkar). */
export async function googleSigninCikis(): Promise<void> {
  googleSigninYapilandir();
  if (GoogleSignin.hasPreviousSignIn()) await GoogleSignin.signOut();
}
