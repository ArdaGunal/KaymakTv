import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import HeroSection from '../../components/landing/HeroSection';
import BentoGrid from '../../components/landing/BentoGrid';
import CallToAction from '../../components/landing/CallToAction';
import Footer from '../../components/landing/Footer';
import { StatusBar } from 'expo-status-bar';
import { Redirect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';

export default function LandingPage() {
  const { accessToken, isGuest } = useAuth();

  if (accessToken || isGuest) {
    return <Redirect href="/(protected)/(tabs)/explore" />;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="light" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <HeroSection />
        <BentoGrid />
        <CallToAction />
        <Footer />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
});
