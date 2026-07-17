import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

export default function CallToAction() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0B1120', '#172033']}
        style={styles.gradientBg}
      />
      <View style={[styles.content, isDesktop && styles.contentDesktop]}>
        <Text style={styles.title}>İzleme Alışkanlıklarınızı Baştan Yaratın</Text>
        <Text style={styles.subtitle}>
          Hemen KaymakTV'ye katılın, binlerce içerik arasından size özel dünyayı yaratmaya başlayın.
        </Text>
        
        <TouchableOpacity 
          style={styles.button}
          activeOpacity={0.8}
          onPress={() => router.push('/(public)/settings')}
        >
          <Text style={styles.buttonText}>Hemen Ücretsiz Katıl</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: 100,
    paddingHorizontal: 24,
    alignItems: 'center',
    position: 'relative',
  },
  gradientBg: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.5,
  },
  content: {
    alignItems: 'center',
    maxWidth: 600,
  },
  contentDesktop: {
    maxWidth: 800,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 18,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: 40,
  },
  button: {
    backgroundColor: '#ffffff',
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 100,
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  buttonText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
