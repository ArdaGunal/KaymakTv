import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
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
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <HeroSection />
        <BentoGrid />
        <CallToAction />
        <Footer />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scrollContent: {
    flexGrow: 1,
  },
});
