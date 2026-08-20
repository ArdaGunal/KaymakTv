import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { linkGoogleToTrakt } from '../services/api/googleAuth';

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

  const captureCredential = useCallback(async (googleIdToken: string, nonce: string) => {
    await AsyncStorage.setItem(PENDING_GOOGLE_LINK_KEY, JSON.stringify({ googleIdToken, nonce }));
    setAwaitingTraktLink(true);
  }, []);

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

  return { awaitingTraktLink, captureCredential, cancel, completeIfPending };
}
