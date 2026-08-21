import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from '../utils/secureStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onSessionExpired, onTokenRefreshed } from '../services/api/traktClient';
import { useFollowStore } from '../store/followStore';
import { useLibraryStore } from '../store/useLibraryStore';
import { resetFetchState } from '../services/library/fetchers';
import { clearMyTraktSlug } from '../services/api/myIdentity';
import { useFeedStore } from '../features/feed/store/feedStore';
import { clearFeedPublishIdentity } from '../features/feed/services/feedPublish';
import {
  invalidateFeedCache,
  invalidateVisibleUserIds,
  invalidateIdentityScopedFeedCaches,
} from '../features/feed/services/feedApi';
import { invalidateMySupabaseUserId, invalidateBlockedUserIds } from '../features/feed/services/userBlocks';
import { recordPerfMark } from '../utils/perfLog';

type AuthContextType = {
  accessToken: string | null;
  isGuest: boolean;
  isLoading: boolean;
  // create_new: Google-only (Trakt'sız) bir oturum mu, yoksa gerçek bir
  // Trakt bağlantısı mı — `null` yalnızca henüz hiç oturum açılmadığında.
  authProvider: 'trakt' | 'google' | null;
  saveTokens: (access: string, refresh: string) => Promise<void>;
  saveGoogleSession: (sessionToken: string) => Promise<void>;
  loginAsGuest: () => Promise<void>;
  removeKeys: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  accessToken: null,
  isGuest: false,
  isLoading: true,
  authProvider: null,
  saveTokens: async () => {},
  saveGoogleSession: async () => {},
  loginAsGuest: async () => {},
  removeKeys: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authProvider, setAuthProvider] = useState<'trakt' | 'google' | null>(null);

  useEffect(() => {
    loadKeys();
  }, []);

  // traktClient.ts'teki 401 interceptor'ı, refresh token da geçersiz/yoksa
  // SecureStore'daki token'ları sessizce siler — ama bu React state'ini
  // (accessToken) hiç güncellemez. Bu abonelik olmadan: SecureStore boş ama
  // accessToken state'i hâlâ eski (dolu) değerde kalır, (protected)/_layout.tsx
  // kullanıcıyı "giriş yapılmış" sanmaya devam eder, her API isteği yeniden
  // 401 alır — kullanıcı hiçbir açıklama olmadan donmuş bir uygulamayla kalır.
  useEffect(() => {
    return onSessionExpired(() => {
      console.warn('[Auth] Oturum süresi doldu, kullanıcı çıkışa alınıyor.');
      setAccessToken(null);
      setIsGuest(false);
    });
  }, []);

  // Simetrik abonelik: token arka planda SESSİZCE yenilendiğinde de bu
  // state'in haberi olsun — aksi halde `useAuth().accessToken`'ı okuyup
  // Worker'a doğrudan gönderen kod yolları (feed sync, feed privacy) eski/
  // artık geçersiz token'ı göndermeye devam ediyordu (canlı testte bulundu).
  useEffect(() => {
    return onTokenRefreshed((newToken) => {
      setAccessToken(newToken);
    });
  }, []);

  const loadKeys = async () => {
    const startedAt = Date.now();
    try {
      // Paralel: bu iki okuma birbirinden bağımsız, sıralı `await` açılışta
      // gereksiz bir round-trip kadar gecikme ekliyordu.
      const [token, guestStatus, providerRaw] = await Promise.all([
        SecureStore.getItemAsync('traktAccessToken'),
        SecureStore.getItemAsync('traktGuestMode'),
        SecureStore.getItemAsync('traktAuthProvider'),
      ]);

      if (token) {
        setAccessToken(token);
        // Y23'ten önce yazılmış eski bir token'da bu anahtar hiç olmayabilir
        // — `null !== 'google'` zaten `traktClient.ts`'teki varsayılanla
        // (gerçek Trakt oturumu) birebir aynı davranışı üretir.
        setAuthProvider(providerRaw === 'google' ? 'google' : 'trakt');
      }
      if (guestStatus === 'true') {
        setIsGuest(true);
      }
    } catch (error) {
      console.error('Error loading keys:', error);
    } finally {
      setIsLoading(false);
      recordPerfMark('Oturum Başlatma', 'startup', Date.now() - startedAt);
    }
  };

  const saveTokens = async (access: string, refresh: string) => {
    try {
      await SecureStore.setItemAsync('traktAccessToken', access);
      await SecureStore.setItemAsync('traktRefreshToken', refresh);
      await SecureStore.deleteItemAsync('traktGuestMode');
      // Y23: gerçek Trakt token'ları her yazıldığında (ilk giriş VEYA
      // Google-only bir hesabın sonradan Trakt'a bağlanması — bkz.
      // traktClient.ts'teki 'google' dalı) önceki 'google' işareti EZİLİR.
      // Aksi halde bu kullanıcının GERÇEK Trakt oturumu sonradan gerçekten
      // sona erdiğinde interceptor bunu "Trakt'sız kullanıcı, beklenen"
      // sanıp çıkışa atmaz — kullanıcı sessizce bozuk/bayat veriyle kalır.
      await SecureStore.setItemAsync('traktAuthProvider', 'trakt');
      setAccessToken(access);
      setAuthProvider('trakt');
      setIsGuest(false);
    } catch (error) {
      console.error('Error saving tokens:', error);
      throw error;
    }
  };

  /**
   * create_new: Google-only (Trakt hesabı hiç olmayan) bir kayıt/giriş
   * sonrası çağrılır — Worker'ın `mintSessionToken`'ının ürettiği
   * `kaymak_session_v1.` önekli değeri `traktAccessToken` YUVASINA saklar
   * (Worker'ın kendi tasarım niyeti: bu alan TEK bir opak string, gerçek
   * Trakt token'ı ya da Kaymak oturum token'ı — bkz. Worker
   * `resolveCallerWithReason` başlığı). `traktRefreshToken` BİLİNÇLİ OLARAK
   * hiç yazılmaz; `services/api/traktClient.ts`'in Y23 düzeltmesi
   * `traktAuthProvider==='google'` gördüğünde bunu BEKLENEN sayıp tüm
   * oturumu kapatmadan yalnızca ilgili Trakt isteğini başarısız sayar.
   */
  const saveGoogleSession = async (sessionToken: string) => {
    try {
      await SecureStore.setItemAsync('traktAccessToken', sessionToken);
      await SecureStore.deleteItemAsync('traktRefreshToken');
      await SecureStore.setItemAsync('traktAuthProvider', 'google');
      await SecureStore.deleteItemAsync('traktGuestMode');
      setAccessToken(sessionToken);
      setAuthProvider('google');
      setIsGuest(false);
    } catch (error) {
      console.error('Error saving google session:', error);
      throw error;
    }
  };

  const loginAsGuest = async () => {
    try {
      await SecureStore.setItemAsync('traktGuestMode', 'true');
      setIsGuest(true);
    } catch (error) {
      console.error('Error activating guest mode:', error);
    }
  };

  const removeKeys = async () => {
    try {
      await SecureStore.deleteItemAsync('traktAccessToken');
      await SecureStore.deleteItemAsync('traktRefreshToken');
      await SecureStore.deleteItemAsync('traktGuestMode');
      // Y23: bir sonraki oturuma sızmasın — diğer kimlik anahtarlarıyla aynı gerekçe.
      await SecureStore.deleteItemAsync('traktAuthProvider');
      await AsyncStorage.clear();
      // AsyncStorage.clear() yalnızca DİSKTEKİ kopyayı siler — followStore
      // RAM'de bir Zustand singleton'ı olduğundan bir önceki oturumun
      // connectionStates/isFetched'i JS süreci canlı kaldığı sürece (uygulama
      // tamamen kapatılmadan çıkış-giriş yapılırsa) hafızada kalmaya devam
      // eder. `isFetched: true` kalınca yeni oturumda fetchFollowingSlugs
      // tekrar hiç çalışmaz ve önceki hesabın (varsa farklı bir Trakt hesabı)
      // takip durumu yeni oturuma sızar. Çıkışta açıkça sıfırla.
      useFollowStore.getState().reset();
      // 2026-08-21 — kullanıcı canlı testte bulundu ("State Leakage"): Arda
      // (Trakt'a bağlı) çıkış yapıp sekme kapatılmadan Deneme (Google-only)
      // ile giriş yapınca Arda'nın izleme geçmişi/ilerlemesi/listeleri
      // ekranda kalmaya devam ediyordu. Kök neden AYNI sınıf — `useLibraryStore`
      // da RAM'de bir Zustand singleton'ı, `clearAll()` metodu ZATEN vardı ama
      // hiçbir yerden çağrılmıyordu. `resetFetchState()` (services/library/
      // fetchers.ts) AYRICA gerekli: `fetchFreshData`'nın TTL saati de modül
      // seviyesinde — sıfırlanmazsa yeni hesabın ilk senkronu, önceki hesap az
      // önce gerçekten senkronladığı için TTL'i geçerli sanıp TAMAMEN ATLANIRDI,
      // yani `clearAll()` boşalttıktan SONRA bile yeni hesap için hiç dolmazdı.
      useLibraryStore.getState().clearAll();
      resetFetchState();
      // Aynı gerekçe, modül seviyesindeki kimlik önbelleği için (bkz.
      // services/api/myIdentity.ts): temizlenmezse önceki hesabın slug'ı yeni
      // oturuma sızar ve Akış'ta yanlış kişinin aktiviteleri "benim" görünürdü.
      clearMyTraktSlug();
      // Akış da RAM'de bir singleton — temizlenmezse yeni oturumda bir an
      // için ÖNCEKİ hesabın akışı görünürdü.
      useFeedStore.getState().reset();
      clearFeedPublishIdentity();
      invalidateFeedCache();
      // Görünür kullanıcı kümesi de sıfırlanmalı: aksi halde yeni oturumun
      // ilk akış sorgusu ÖNCEKİ hesabın takip listesiyle filtrelenirdi.
      invalidateVisibleUserIds();
      // features/feed/services/userBlocks.ts'teki İKİ modül seviyesi önbellek
      // de aynı gerekçeyle temizlenmeli — bunlar KİMLİĞE bağlı:
      //   • myUserIdCache   → benim Supabase users.id'im
      //   • blockedIdsCache → benim engel kümem
      // Temizlenmezse (uygulama kapatılmadan hesap değiştirilirse) TTL dolana
      // kadar ÖNCEKİ hesabın kimliği yeni oturumda kullanılırdı: "bu kartı ben
      // beğendim mi" (attachIsLikedByMe), hangi yorumda "sil" butonu çıkacağı
      // (useFeedComments.myUserId) ve engel filtresi hep yanlış kişiye göre
      // hesaplanırdı.
      invalidateMySupabaseUserId();
      invalidateBlockedUserIds();
      // K2 denetiminde bulundu: `feedApi.ts`'teki İKİ Map önbelleği
      // (profil aktiviteleri + yapım incelemeleri) buraya hiç bağlanmamıştı.
      // İkisi de `isLikedByMe` taşıyor, yani KİMLİĞE BAĞLI — temizlenmezse
      // hesap değiştirildiğinde 60sn'lik TTL boyunca önceki hesabın beğeni
      // durumu yeni oturumda görünürdü (yukarıdaki üç önbellekle AYNI hata
      // sınıfı, yalnızca daha sonra eklendikleri için gözden kaçmışlar).
      invalidateIdentityScopedFeedCaches();
      setAccessToken(null);
      setAuthProvider(null);
      setIsGuest(false);
    } catch (error) {
      console.error('Error removing keys:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{ accessToken, isGuest, isLoading, authProvider, saveTokens, saveGoogleSession, loginAsGuest, removeKeys }}
    >
      {children}
    </AuthContext.Provider>
  );
};
