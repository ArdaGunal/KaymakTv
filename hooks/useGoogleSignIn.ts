import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

// F8 — Google Identity Services (GIS) entegrasyonu.
//
// ⚠️ `expo-auth-session/providers/google` KULLANILMADI — o modül DEPRECATED
// (bkz. node_modules/expo-auth-session/build/providers/Google.d.ts).
// Google'ın kendi güncel dokümanı da klasik yönlendirme (`id_token`)
// akışının artık ÖNERİLMEDİĞİNİ, GIS kullanılmasını söylüyor (HISTORY
// Madde 199). Ayrıca klasik akış `nonce`'u ELLE üretip TAM SAYFA
// YÖNLENDİRMESİ boyunca saklamayı gerektirirdi — `expo-auth-session`'ın
// `AuthRequest`'inde hiç `nonce` desteği yok, elle yazmak riskliydi.
// GIS'te (`google.accounts.id`) `nonce` birinci sınıf desteklenen bir alan
// ve callback SAYFA YENİDEN YÜKLENMEDEN aynı JS bağlamında tetikleniyor —
// saklama sorunu da kendiliğinden yok.
//
// 🔴 YALNIZCA WEB. Google Cloud Console'daki iOS/Android client ID'leri hâlâ
// yer tutucu (bkz. .env) — native taraf bilinçli olarak ertelendi. Bu hook
// `Platform.OS !== 'web'` durumunda hiçbir şey yapmaz.

const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
const GIS_SCRIPT_ID = 'google-identity-services';

/** Kriptografik olarak rastgele bir nonce — yalnızca web'de çağrılıyor, `window.crypto` her tarayıcıda var. */
const generateNonce = (): string => {
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

const loadGisScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(GIS_SCRIPT_ID);
    if (existing) {
      // Zaten yüklenmiş veya yükleniyor — `google` global'i hazır olana kadar bekle.
      if ((window as any).google?.accounts?.id) {
        resolve();
      } else {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('GIS scripti yüklenemedi.')));
      }
      return;
    }
    const script = document.createElement('script');
    script.id = GIS_SCRIPT_ID;
    script.src = GIS_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('GIS scripti yüklenemedi.'));
    document.head.appendChild(script);
  });
};

interface UseGoogleSignInResult {
  /** Butonun render edileceği DOM elemanının `nativeID`'si — `<View nativeID={buttonElementId} />`. */
  buttonElementId: string;
  isReady: boolean;
  loadError: string | null;
}

/**
 * `onCredential(idToken, nonce)` — kullanıcı Google hesabını seçtiğinde bir
 * kez çağrılır. `nonce`'un AYNEN geri verilmesinin sebebi: çağıran taraf
 * (`app/(public)/settings.tsx`) bunu `googleIdToken` ile BİRLİKTE saklayıp
 * `/auth/google`'a göndermek zorunda — Worker'daki `verifyGoogleIdToken`
 * `expectedNonce` parametresiyle bunu tekrar oynatmaya (replay) karşı
 * doğruluyor (bkz. Worker `HISTORY.md` Madde 201).
 */
export function useGoogleSignIn(onCredential: (idToken: string, nonce: string) => void): UseGoogleSignInResult {
  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const buttonElementId = 'kaymak-google-signin-button';
  // `onCredential` her render'da yeni bir referans olabilir (çağıran taraf
  // inline fonksiyon geçiyorsa) — GIS callback'ini yalnızca BİR KEZ
  // `initialize` ile bağlıyoruz, güncel fonksiyonu bir ref üzerinden okuyoruz.
  const onCredentialRef = useRef(onCredential);
  onCredentialRef.current = onCredential;

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const clientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    if (!clientId) {
      setLoadError('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID tanımlı değil.');
      return;
    }

    let cancelled = false;
    const nonce = generateNonce();

    loadGisScript()
      .then(() => {
        if (cancelled) return;
        const google = (window as any).google;
        google.accounts.id.initialize({
          client_id: clientId,
          nonce,
          callback: (response: { credential: string }) => {
            onCredentialRef.current(response.credential, nonce);
          },
        });
        const container = document.getElementById(buttonElementId);
        if (container) {
          google.accounts.id.renderButton(container, {
            type: 'standard',
            theme: 'filled_blue',
            size: 'large',
            text: 'continue_with',
            shape: 'rectangular',
            width: 320,
          });
        }
        setIsReady(true);
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error?.message || 'Google Sign-In yüklenemedi.');
      });

    return () => {
      cancelled = true;
    };
    // `clientId`/`buttonElementId` oturum boyunca sabit — yalnızca mount'ta çalışsın.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { buttonElementId, isReady, loadError };
}
