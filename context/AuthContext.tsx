import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from '../utils/secureStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onSessionExpired, onTokenRefreshed } from '../services/api/traktClient';
import { useFollowStore } from '../store/followStore';
import { clearMyTraktSlug } from '../services/api/myIdentity';
import { useFeedStore } from '../features/feed/store/feedStore';
import { clearFeedPublishIdentity } from '../features/feed/services/feedPublish';
import { invalidateFeedCache } from '../features/feed/services/feedApi';

type AuthContextType = {
  accessToken: string | null;
  isGuest: boolean;
  isLoading: boolean;
  saveTokens: (access: string, refresh: string) => Promise<void>;
  loginAsGuest: () => Promise<void>;
  removeKeys: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  accessToken: null,
  isGuest: false,
  isLoading: true,
  saveTokens: async () => {},
  loginAsGuest: async () => {},
  removeKeys: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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
    try {
      // Paralel: bu iki okuma birbirinden bağımsız, sıralı `await` açılışta
      // gereksiz bir round-trip kadar gecikme ekliyordu.
      const [token, guestStatus] = await Promise.all([
        SecureStore.getItemAsync('traktAccessToken'),
        SecureStore.getItemAsync('traktGuestMode'),
      ]);

      if (token) {
        setAccessToken(token);
      }
      if (guestStatus === 'true') {
        setIsGuest(true);
      }
    } catch (error) {
      console.error('Error loading keys:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveTokens = async (access: string, refresh: string) => {
    try {
      await SecureStore.setItemAsync('traktAccessToken', access);
      await SecureStore.setItemAsync('traktRefreshToken', refresh);
      await SecureStore.deleteItemAsync('traktGuestMode');
      setAccessToken(access);
      setIsGuest(false);
    } catch (error) {
      console.error('Error saving tokens:', error);
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
      await AsyncStorage.clear();
      // AsyncStorage.clear() yalnızca DİSKTEKİ kopyayı siler — followStore
      // RAM'de bir Zustand singleton'ı olduğundan bir önceki oturumun
      // connectionStates/isFetched'i JS süreci canlı kaldığı sürece (uygulama
      // tamamen kapatılmadan çıkış-giriş yapılırsa) hafızada kalmaya devam
      // eder. `isFetched: true` kalınca yeni oturumda fetchFollowingSlugs
      // tekrar hiç çalışmaz ve önceki hesabın (varsa farklı bir Trakt hesabı)
      // takip durumu yeni oturuma sızar. Çıkışta açıkça sıfırla.
      useFollowStore.getState().reset();
      // Aynı gerekçe, modül seviyesindeki kimlik önbelleği için (bkz.
      // services/api/myIdentity.ts): temizlenmezse önceki hesabın slug'ı yeni
      // oturuma sızar ve Akış'ta yanlış kişinin aktiviteleri "benim" görünürdü.
      clearMyTraktSlug();
      // Akış da RAM'de bir singleton — temizlenmezse yeni oturumda bir an
      // için ÖNCEKİ hesabın akışı görünürdü.
      useFeedStore.getState().reset();
      clearFeedPublishIdentity();
      invalidateFeedCache();
      setAccessToken(null);
      setIsGuest(false);
    } catch (error) {
      console.error('Error removing keys:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ accessToken, isGuest, isLoading, saveTokens, loginAsGuest, removeKeys }}>
      {children}
    </AuthContext.Provider>
  );
};
