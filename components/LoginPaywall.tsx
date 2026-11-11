import { nativeColor, nativeTint } from '../constants/mobilePalette';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Lock } from './icons';

interface LoginPaywallProps {
  message?: string;
  // create_new: Google-only (Trakt'sız) kullanıcılar için "giriş yap"tan
  // farklı bir başlık/buton metni gerekiyor — onlar zaten girişli, yalnızca
  // Trakt hesabını bağlamaları gerekiyor. Verilmezse mevcut misafir metinleri
  // korunur (geriye dönük uyumlu, mevcut çağıranlar hiç değişmez).
  title?: string;
  buttonLabel?: string;
}

export default function LoginPaywall({ message, title, buttonLabel }: LoginPaywallProps) {
  const { t } = useTranslation('common');
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.overlay} />
      <View style={styles.card}>
        <View style={styles.iconContainer}>
          <Lock size={32} color={nativeColor('steel', "#3b82f6")} />
        </View>
        <Text style={styles.title}>{title || t('guestAccess')}</Text>
        <Text style={styles.message}>
          {message || t('guestAccessDesc')}
        </Text>
        <TouchableOpacity
          style={styles.button}
          activeOpacity={0.8}
          onPress={() => router.push('/(public)/settings')}
        >
          <Text style={styles.buttonText}>{buttonLabel || t('signupLogin')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11, 17, 32, 0.88)',
  },
  card: {
    width: Math.min(width * 0.85, 400),
    backgroundColor: nativeColor('surface', '#172033'),
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: nativeColor('border', '#2A364F'),
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: nativeTint('primary', 0.15, 'rgba(59, 130, 246, 0.15)'),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: nativeColor('text', '#ffffff'),
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: nativeColor('muted', '#94a3b8'),
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  button: {
    backgroundColor: nativeColor('primary', '#3b82f6'),
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: nativeColor('text', '#ffffff'),
    fontWeight: 'bold',
    fontSize: 16,
  },
});
