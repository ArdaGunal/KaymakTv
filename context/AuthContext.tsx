import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from '../utils/secureStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onSessionExpired } from '../services/api/traktClient';

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
