import type { TFunction } from 'i18next';
import { useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { GoogleSignin, isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';
import { googleSigninYapilandir } from '../services/auth/googleSignin';

/**
 * Native (iOS/Android) Google Sign-In — `useGoogleSignIn.ts` (web/GIS) ile
 * KARIŞTIRILMASIN, o dosyanın kendi başlığındaki "native taraf bilinçli
 * olarak ertelendi" notu bu hook ile KAPANDI (HISTORY Madde 246+).
 *
 * ⚠️ NEDEN `expo-auth-session/providers/google` DEĞİL: o modül DEPRECATED
 * (bkz. `useGoogleSignIn.ts`'in aynı notu) ve Google'ın klasik yönlendirme
 * akışı artık önerilmiyor. Native'de GIS'in bir karşılığı yok (WebView'da
 * güvenilir çalışmıyor) — Google'ın kendi önerdiği native SDK
 * `@react-native-google-signin/google-signin`.
 *
 * ⚠️ NONCE YOK: bu SDK'nın `signIn()` API'si (v16) `nonce` parametresi
 * SUNMUYOR — web'in aksine dönen `idToken`'ın `nonce` claim'i olmayacak.
 * Worker (`handleAuthGoogle`, 2026-08-27) bu yüzden nonce'u ARTIK zorunlu
 * tutmuyor; `verifyGoogleIdToken` `expectedNonce=undefined` iken replay
 * kontrolünü zaten atlıyordu (kendi tasarımı buna hazırdı). Native'in
 * kaybettiği tek şey nonce replay koruması — imza+süre doğrulaması (asıl
 * güvenlik sınırı) etkilenmiyor.
 *
 * ⚠️ NATIVE MODÜL: bu paket EAS build gerektirir (Expo Go'da ÇALIŞMAZ) —
 * `app.json`'daki config plugin native koda gömülür, yalnızca yeni bir
 * build'de etkili olur. `google-signin`'in kendi config plugin'i iOS'ta
 * `ios.bundleIdentifier` + reversed client ID URL scheme'ini otomatik
 * Info.plist'e yazıyor (bkz. app.json `plugins` girdisi).
 *
 * Cloud Console'daki Android istemci kaydının SHA-1 imza parmak izi
 * (`eas credentials` ile alınabilir) build'i imzalayan sertifikayla
 * EŞLEŞMEZSE `DEVELOPER_ERROR` alınır — bu hook'un tespit edemeyeceği tek
 * dış bağımlılık, cihaz testinde ortaya çıkar.
 */

// Yapılandırma tek yerde (M518): çıkış da aynı istemciyi kullanır.
const ensureConfigured = googleSigninYapilandir;

export type GoogleNativeSignInResult =
  | { ok: true; idToken: string }
  | { ok: false; cancelled: true }
  | { ok: false; cancelled: false; neden: GoogleGirisHataNedeni; kod?: string };

/** Hata NEDENİ kodu — metin değil (M490). Ekrana `googleGirisHataMetni` ile. */
export type GoogleGirisHataNedeni = 'eksik' | 'play_yok' | 'basarisiz';

export function googleGirisHataMetni(t: TFunction, neden: GoogleGirisHataNedeni): string {
  return neden === 'play_yok'
    ? t('common:googlePlayServicesMissing', 'Google Play Hizmetleri bulunamadı veya güncel değil.')
    : t('common:googleSignInFailed', 'Google ile giriş başarısız oldu, tekrar dene.');
}

export function useGoogleNativeSignIn() {
  // Play Services kontrolü yalnızca Android'de anlamlı; iOS'ta no-op'a yakın
  // ama gereksiz bir native köprü çağrısı — atlamak daha temiz.
  const checkedPlayServicesRef = useRef(false);

  const signIn = useCallback(async (): Promise<GoogleNativeSignInResult> => {
    ensureConfigured();
    try {
      if (Platform.OS === 'android' && !checkedPlayServicesRef.current) {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        checkedPlayServicesRef.current = true;
      }

      const response = await GoogleSignin.signIn();
      if (response.type === 'cancelled') {
        return { ok: false, cancelled: true };
      }
      const idToken = response.data.idToken;
      if (!idToken) {
        // SDK teorik olarak null dönebilir (dokümanında belirtiliyor) —
        // "başarılı ama kimlik kanıtı yok" sessizce yutulmamalı.
        return { ok: false, cancelled: false, neden: 'eksik' };
      }
      return { ok: true, idToken };
    } catch (error) {
      if (isErrorWithCode(error)) {
        // Kullanıcının kendi iptali AYRI ele alınıyor (yukarıda,
        // `response.type === 'cancelled'`) — buraya düşen kodlar gerçek
        // hatalar. `DEVELOPER_ERROR` en sık rastlanan: SHA-1/bundle ID
        // yapılandırma sorunu, kullanıcı hatası değil.
        switch (error.code) {
          case statusCodes.SIGN_IN_CANCELLED:
            return { ok: false, cancelled: true };
          case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
            return { ok: false, cancelled: false, neden: 'play_yok', kod: String(error.code) };
          default:
            return { ok: false, cancelled: false, neden: 'basarisiz', kod: String(error.code) };
        }
      }
      return { ok: false, cancelled: false, neden: 'basarisiz' };
    }
  }, []);

  return { signIn };
}
