import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from '../utils/secureStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';

type AuthContextType = {
  accessToken: string | null;
  isLoading: boolean;
  saveTokens: (access: string, refresh: string) => Promise<void>;
  removeKeys: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  accessToken: null,
  isLoading: true,
  saveTokens: async () => {},
  removeKeys: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadKeys();
  }, []);

  const loadKeys = async () => {
    try {
      const token = await SecureStore.getItemAsync('traktAccessToken');
      if (token) {
        setAccessToken(token);
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
      setAccessToken(access);
    } catch (error) {
      console.error('Error saving tokens:', error);
      throw error;
    }
  };

  const removeKeys = async () => {
    try {
      await SecureStore.deleteItemAsync('traktAccessToken');
      await SecureStore.deleteItemAsync('traktRefreshToken');
      await AsyncStorage.clear();
      setAccessToken(null);
    } catch (error) {
      console.error('Error removing keys:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ accessToken, isLoading, saveTokens, removeKeys }}>
      {children}
    </AuthContext.Provider>
  );
};
