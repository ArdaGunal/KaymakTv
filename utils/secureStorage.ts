import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * A platform-aware wrapper around SecureStore.
 * SecureStore does not work on the Web since there's no native keychain.
 * On Web, this falls back to localStorage.
 * WARNING: localStorage is not encrypted and is vulnerable to XSS.
 */

export const getItemAsync = async (key: string): Promise<string | null> => {
  if (Platform.OS === 'web') {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn('localStorage is not available', e);
      return null;
    }
  } else {
    return await SecureStore.getItemAsync(key);
  }
};

export const setItemAsync = async (key: string, value: string): Promise<void> => {
  if (Platform.OS === 'web') {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn('localStorage is not available', e);
    }
  } else {
    await SecureStore.setItemAsync(key, value);
  }
};

export const deleteItemAsync = async (key: string): Promise<void> => {
  if (Platform.OS === 'web') {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('localStorage is not available', e);
    }
  } else {
    await SecureStore.deleteItemAsync(key);
  }
};
