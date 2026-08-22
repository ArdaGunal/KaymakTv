import { useCallback, useEffect, useRef, useState } from 'react';
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
        return;
      }
      // 🔴 `load` DİNLEYİCİSİ TEK BAŞINA YETMEZ: script elemanı DOM'da ama
      // `load` olayı BU DİNLEYİCİ BAĞLANMADAN ÖNCE ateşlenmişse olay bir daha
      // asla gelmez ve promise SONSUZA DEK askıda kalır (buton hiç çizilmez,
      // hata da görünmez). Bu, bileşen unmount/remount olduğunda gerçekleşen
      // gerçek bir yarış. Yoklama (polling) ile ikinci bir çıkış yolu:
      // `google` global'i hazır olur olmaz devam edilir.
      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        clearInterval(poll);
        ok ? resolve() : reject(new Error('GIS scripti yüklenemedi.'));
      };
      const poll = setInterval(() => {
        if ((window as any).google?.accounts?.id) finish(true);
      }, 100);
      // Üst sınır: sonsuz yoklama yok. 10sn sonra dürüstçe hata ver ki
      // kullanıcı sebebini GÖREBİLSİN (AI_RULES §2: sessiz başarısızlık yasak).
      setTimeout(() => finish(!!(window as any).google?.accounts?.id), 10000);
      existing.addEventListener('load', () => finish(true));
      existing.addEventListener('error', () => finish(false));
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
  /**
   * "Konteyner şu an görünür/bağlı olmalı, butonu gerekiyorsa yeniden çiz."
   * Çağıran taraf, konteynerin görünürlüğünü değiştiren bir durum geçişinden
   * sonra (ör. köprü kartı kapandığında) bunu çağırır. İdempotent: konteyner
   * zaten doluysa hiçbir şey yapmaz.
   */
  requestRender: () => void;
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
  // Yeniden çizim tetikleyicisi — `requestRender()` bunu artırır ve aşağıdaki
  // çizim efektini yeniden çalıştırır (bkz. o efektin başlığı).
  const [renderNonce, setRenderNonce] = useState(0);
  const requestRender = useCallback(() => setRenderNonce((n) => n + 1), []);
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
        // 🔴 `renderButton` BURADA ÇAĞRILMIYOR — bilinçli. Bkz. aşağıdaki
        // ikinci efektin başlığı: konteyner bu anda DOM'da olmayabilir ve
        // burada denemek, sessizce atlanan tek seferlik bir deneme olurdu.
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

  // ═══════════════════════════════════════════════════════════════════════
  // 🔴 BUTON ÇİZİMİ AYRI BİR EFEKTTE — 2026-08-22, canlıda YENİDEN ÜRETİLDİ
  // ═══════════════════════════════════════════════════════════════════════
  // ESKİ DAVRANIŞ (kusurluydu): `renderButton`, script yükleyen efektin
  // `.then()`'i içinde, `[]` bağımlılıkla YALNIZCA BİR KEZ çağrılıyordu ve
  // `if (container)` ile konteyner yoksa SESSİZCE atlanıyordu.
  //
  // Somut kırılma (tarayıcıda ölçülerek kanıtlandı): köprü kartı
  // (`awaitingTraktLink`) açıkken `GoogleSignInSection` erken `return`
  // ediyor, yani konteyner DOM'da HİÇ YOK. Kullanıcı "İptal"e bastığında
  // konteyner geri geliyor ama BOŞ — hiçbir şey `renderButton`'ı yeniden
  // tetiklemiyor. Ölçüm: `containerExists: true, containerChildren: 0,
  // gisIframe: false`. Kullanıcının bildirdiği "Google ile giriş kafasına
  // göre görünüp yok oluyor" şikayetinin kök nedeni TAM OLARAK budur.
  //
  // ÇÖZÜM İKİ KATMANLI:
  //  1) `GoogleSignInSection` konteyneri artık ASLA unmount etmiyor (köprü
  //     kartı açıkken yalnızca gizliyor) — kalıcı çözüm.
  //  2) Bu efekt bir GÜVENLİK AĞI: `isReady` değiştiğinde VE her yeniden
  //     çizim tetiklendiğinde konteyneri arar; boşsa doldurur, doluysa
  //     dokunmaz (idempotent). Böylece 1. katman ileride bir refactor'de
  //     bozulsa bile buton kendini onarır.
  useEffect(() => {
    if (Platform.OS !== 'web' || !isReady) return;

    let attempts = 0;
    const tryRender = (): boolean => {
      const google = (window as any).google;
      if (!google?.accounts?.id) return false;
      const container = document.getElementById(buttonElementId);
      if (!container) return false;
      // ZATEN DOLU: tekrar çizmek GIS'in mevcut iframe'ini çoğaltırdı.
      if (container.childElementCount > 0) return true;
      google.accounts.id.renderButton(container, {
        type: 'standard',
        // 2026-08-21 — Trakt butonuyla aynı 'filled_blue' iki butonu ayırt
        // edilemez kılıyordu ("Trakt kabak gibi ortada, Google gizli"
        // geri bildirimi büyük ölçüde ikisinin görsel ağırlığının eşit
        // OLMAMASINDANdı). 'filled_black' koyu temada net bir ikinci
        // birincil seçenek gibi durur.
        theme: 'filled_black',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        // 280: settings.tsx'in `container` dolgusu (24+24) dar telefon
        // genişliklerinde (ör. 320px) 320'lik sabit genişliğin taşmasına
        // yol açabilirdi — 280 daha güvenli bir alt sınır.
        width: 280,
      });
      return true;
    };

    if (tryRender()) return;

    // Konteyner henüz bağlanmamışsa kısa süre yeniden dene (React commit
    // sırası garantili değil). SINIRLI: 20 × 100ms = 2sn, sonsuz döngü yok.
    const timer = setInterval(() => {
      attempts += 1;
      if (tryRender() || attempts >= 20) clearInterval(timer);
    }, 100);
    return () => clearInterval(timer);
  }, [isReady, renderNonce, buttonElementId]);

  return { buttonElementId, isReady, loadError, requestRender };
}
