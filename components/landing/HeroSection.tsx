import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, useWindowDimensions, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { Play, Compass } from 'lucide-react-native';

export default function HeroSection() {
  const router = useRouter();
  const { loginAsGuest } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleGuestLogin = async () => {
    await loginAsGuest();
    router.replace('/(protected)/(tabs)/explore');
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(225, 29, 72, 0.15)', 'transparent']}
        colors={['rgba(59, 130, 246, 0.15)', 'transparent']}
        style={styles.glowEffect}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      
      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>🎉 Yeni Sürüm 2.0 Yayında</Text>
        </View>

        <Text style={[styles.title, isDesktop && styles.titleDesktop]}>
          Medyalarınızı Yönetmenin {'\n'}
          <Text style={styles.highlight}>En Şık</Text> Yolu
        </Text>
        
        <Text style={[styles.subtitle, isDesktop && styles.subtitleDesktop]}>
          Dizilerinizi takip edin, filmlerinizi keşfedin ve izleme alışkanlıklarınızı kusursuz bir arayüzle analiz edin. Tamamen ücretsiz.
        </Text>

        <View style={[styles.buttonContainer, isDesktop && styles.buttonContainerDesktop]}>
          <TouchableOpacity 
            style={styles.primaryButton}
            activeOpacity={0.8}
            onPress={() => router.push('/(public)/settings')}
          >
            <LinearGradient
              colors={['#2563eb', '#1e3a8a']}
              style={styles.primaryGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Play color="#fff" size={20} fill="#fff" style={styles.btnIcon} />
              <Text style={styles.primaryButtonText}>Ücretsiz Başla</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.ghostButton}
            activeOpacity={0.7}
            onPress={handleGuestLogin}
          >
            <Compass color="#2563eb" size={20} style={styles.btnIcon} />
            <Text style={styles.ghostButtonText}>Misafir Olarak İncele</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: Platform.OS === 'web' ? 120 : 80,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  glowEffect: {
    position: 'absolute',
    top: -100,
    width: '200%',
    height: 400,
    borderRadius: 500,
  },
  content: {
    alignItems: 'center',
    maxWidth: 900,
    zIndex: 1,
  },
  badge: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
    marginBottom: 24,
  },
  badgeText: {
    color: '#60a5fa',
    fontWeight: '600',
    fontSize: 14,
  },
  title: {
    fontSize: 42,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 50,
    marginBottom: 20,
    fontFamily: Platform.OS === 'web' ? 'system-ui, -apple-system, sans-serif' : undefined,
  },
  titleDesktop: {
    fontSize: 72,
    lineHeight: 85,
  },
  highlight: {
    color: '#3B82F6',
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
    maxWidth: 600,
  },
  subtitleDesktop: {
    fontSize: 20,
    lineHeight: 30,
  },
  buttonContainer: {
    flexDirection: 'column',
    gap: 16,
    width: '100%',
    maxWidth: 320,
  },
  buttonContainerDesktop: {
    flexDirection: 'row',
    maxWidth: '100%',
    justifyContent: 'center',
  },
  primaryButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  primaryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  btnIcon: {
    marginRight: 8,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  ghostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
  },
  ghostButtonText: {
    color: '#3B82F6',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
