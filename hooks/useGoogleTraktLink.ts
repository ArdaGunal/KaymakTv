import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { checkGoogleAccount, linkGoogleToTrakt, createGoogleOnlyAccount, GoogleCreateNewResult } from '../services/api/googleAuth';

// F8 — Google ile giriş tamamlanınca Trakt yeniden doğrulamasını beklerken
// kimlik kanıtını (ID token + nonce) burada sakla. AsyncStorage kullanılıyor
// çünkü Trakt'ın kendi OAuth akışı web'de TAM SAYFA YÖNLENDİRMESİ yapıyor —
// bir React state/ref bunu hayatta tutamaz. bkz. HISTORY Madde 201.
//
// `settings.tsx`'ten AYRI bir dosyaya çıkarılmasının sebebi AI_RULES §1'in
// 400 satır sınırı — mantığın kendisi (TEK giriş noktası ilkesi) bilinçli
// olarak `settings.tsx`'te YAŞAMAYA devam ediyor, bu yalnızca o dosyanın
// AsyncStorage plakasını taşıyor (bkz. GoogleSignInSection.tsx'in başlığı).
const PENDING_GOOGLE_LINK_KEY = 'settings.pendingGoogleLink';

export function useGoogleTraktLink() {
  // AsyncStorage'daki değer TEK gerçek kaynak (web yönlendirmesinden sağ
  // çıkar); bu state yalnızca EKRANDA doğru mesajı göstermek için — sayfa
  // yeniden yüklenirse aşağıdaki mount effect'i AsyncStorage'tan geri kurar.
  const [awaitingTraktLink, setAwaitingTraktLink] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(PENDING_GOOGLE_LINK_KEY).then((raw) => {
      if (raw) setAwaitingTraktLink(true);
    });
  }, []);

  /**
   * GIS callback'inden çağrılır. `onAlreadyLinked` verilmişse önce Worker'a
   * `check` sorar — hesap zaten bir Trakt hesabına bağlıysa köprü kartını
   * HİÇ GÖSTERMEDEN `onAlreadyLinked()`'i tetikler (çağıran taraf bunu
   * `handleTraktLogin`'e bağlar). ⚠️ Bu HÂLÂ gerçek bir Trakt round-trip'i
   * demektir — Y23 (traktClient.ts'in koşulsuz 401 çıkışı) kapanmadan
   * `sessionToken`'ı `traktAccessToken` yerine KULLANMIYORUZ (bkz. HISTORY
   * Madde 201/205). Kaldırılan tek şey kullanıcıya gösterilen ARA EKRAN.
   * `check` başarısız olursa GÜVENLİ TARAF: her zamanki köprü kartı gösterilir.
   */
  const captureCredential = useCallback(
    async (
      googleIdToken: string,
      nonce: string,
      onAlreadyLinked?: () => void,
      /**
       * 🔴 2026-08-22 canlı testinde bulundu: `check` "linked" dönüyor diye
       * kullanıcı KOŞULSUZ Trakt OAuth'a gönderiliyordu — ama Google-only bir
       * hesap da (`create_new`, Madde 221) `google_sub` taşıdığı için "linked"
       * döner. Sonuç: "Trakt'sız devam et" diyen kullanıcı, BİR SONRAKİ
       * girişinde zorla Trakt'a atılıyordu; hesabının Trakt'ı hiç olmadığı
       * için de o akışı tamamlaması imkânsızdı.
       *
       * Worker artık `traktLinked` döndürüyor; `false` ise Trakt round-trip'i
       * ATLANIR ve `sessionToken` doğrudan kullanılır (Y23 kapandığı için bu
       * artık güvenli — bkz. googleAuth.ts başlığı).
       */
      onGoogleOnlySession?: (sessionToken: string, userId?: string) => void
    ) => {
      await AsyncStorage.setItem(PENDING_GOOGLE_LINK_KEY, JSON.stringify({ googleIdToken, nonce }));

      if (onAlreadyLinked || onGoogleOnlySession) {
        try {
          const check = await checkGoogleAccount(googleIdToken, nonce);
          if (check.status === 'linked') {
            if (!check.traktLinked && onGoogleOnlySession) {
              await AsyncStorage.removeItem(PENDING_GOOGLE_LINK_KEY);
              onGoogleOnlySession(check.sessionToken, check.userId);
              return;
            }
            if (onAlreadyLinked) {
              onAlreadyLinked();
              return;
            }
          }
        } catch (checkError) {
          console.error('[Google Sign-In] check hatasi, kopru ekranina dusuluyor:', checkError);
        }
      }

      setAwaitingTraktLink(true);
    },
    []
  );

  const cancel = useCallback(async () => {
    await AsyncStorage.removeItem(PENDING_GOOGLE_LINK_KEY);
    setAwaitingTraktLink(false);
  }, []);

  /**
   * Trakt token exchange BAŞARILI olduktan SONRA çağrılır. Bekleyen bağlama
   * yoksa no-op. Hata fırlatabilir — çağıran taraf yakalayıp kullanıcıya
   * göstermeli ama bu asla Trakt girişini ENGELLEMEMELİ (kullanıcı Trakt
   * kimliğini az önce kanıtladı, bağlama başarısız olsa bile giriş yapabilmeli).
   */
  const completeIfPending = useCallback(async (traktAccessToken: string) => {
    const raw = await AsyncStorage.getItem(PENDING_GOOGLE_LINK_KEY);
    if (!raw) return;
    await AsyncStorage.removeItem(PENDING_GOOGLE_LINK_KEY);
    setAwaitingTraktLink(false);
    const { googleIdToken, nonce } = JSON.parse(raw);
    await linkGoogleToTrakt(googleIdToken, traktAccessToken, nonce);
  }, []);

  /**
   * create_new: kullanıcı köprü kartında "Trakt'sız Devam Et"i seçtiğinde
   * çağrılır. `completeIfPending`'in ikizi — AYNI bekleyen kimlik kanıtını
   * (`PENDING_GOOGLE_LINK_KEY`) okur ama Trakt'a bağlamak yerine Google-only
   * yeni bir hesap açar (veya, hesap zaten varsa, onu bulur). Dönen
   * `sessionToken`'ı çağıran taraf `AuthContext.saveGoogleSession`'a verir.
   * Tüm sonucu (yalnızca `sessionToken`'ı değil) döner — `status`, çağıranın
   * onboarding ekranına mı (`'created'`) yoksa doğrudan ana sayfaya mı
   * (`'linked'`, yarış durumu) gideceğine karar vermesi için gerekli;
   * `username`/`avatarUrl` de onboarding'in ÖNCEDEN doldurması için.
   */
  const completeWithoutTrakt = useCallback(async (): Promise<GoogleCreateNewResult> => {
    const raw = await AsyncStorage.getItem(PENDING_GOOGLE_LINK_KEY);
    if (!raw) {
      throw new Error('Bekleyen bir Google kimlik doğrulaması yok.');
    }
    const { googleIdToken, nonce } = JSON.parse(raw);
    const result = await createGoogleOnlyAccount(googleIdToken, nonce);
    await AsyncStorage.removeItem(PENDING_GOOGLE_LINK_KEY);
    setAwaitingTraktLink(false);
    return result;
  }, []);

  return { awaitingTraktLink, captureCredential, cancel, completeIfPending, completeWithoutTrakt };
}
