import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Sparkles } from 'lucide-react-native';

export default function CallToAction() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(59,130,246,0.08)', 'rgba(11,17,32,0)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Decorative glow */}
      <View style={styles.glowOrb} />

      <View style={[styles.card, isDesktop && styles.cardDesktop]}>
        <View style={styles.iconBadge}>
          <Sparkles size={22} color="#fbbf24" />
        </View>

        <Text style={[styles.title, isDesktop && styles.titleDesktop]}>
          İzleme Alışkanlıklarınızı {'\n'}Baştan Yaratın
        </Text>

        <Text style={[styles.subtitle, isDesktop && styles.subtitleDesktop]}>
          Hemen KaymakTV'ye katılın, binlerce içerik arasından{'\n'}
          size özel dünyayı yaratmaya başlayın.
        </Text>

        <TouchableOpacity
          style={styles.button}
          activeOpacity={0.82}
          onPress={() => router.push('/(public)/settings')}
        >
          <LinearGradient
            colors={['#2563eb', '#1d4ed8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.buttonGradient}
          >
            <Text style={styles.buttonText}>Hemen Ücretsiz Katıl →</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: 64,
    paddingHorizontal: 20,
    alignItems: 'center',
    position: 'relative',
  },
  glowOrb: {
    position: 'absolute',
    top: '10%',
    left: '50%',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(59,130,246,0.06)',
    transform: [{ translateX: -150 }],
  },
  card: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#172033',
    borderRadius: 24,
    padding: 36,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.15)',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.12,
    shadowRadius: 40,
    elevation: 12,
  },
  cardDesktop: {
    maxWidth: 680,
    padding: 56,
  },
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(251,191,36,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.2)',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#f8fafc',
    textAlign: 'center',
    marginBottom: 14,
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  titleDesktop: {
    fontSize: 36,
    lineHeight: 48,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 15,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 36,
  },
  subtitleDesktop: {
    fontSize: 17,
    lineHeight: 28,
  },
  button: {
    borderRadius: 14,
    overflow: 'hidden',
    width: '100%',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  buttonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 40,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
