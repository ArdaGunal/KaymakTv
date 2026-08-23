import React, { useState } from 'react';
import { View, TouchableOpacity, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import HeroSection from '../../components/landing/HeroSection';
import BentoGrid from '../../components/landing/BentoGrid';
import CallToAction from '../../components/landing/CallToAction';
import Footer from '../../components/landing/Footer';
import LanguagePickerModal from '../../components/settings/LanguagePickerModal';
import { StatusBar } from 'expo-status-bar';
import { Redirect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../hooks/useSettings';
import { Globe } from '../../components/icons';

export default function LandingPage() {
  const { accessToken, isGuest } = useAuth();
  const { currentLanguage, handleChangeLanguage } = useSettings();
  const [langModalVisible, setLangModalVisible] = useState(false);

  if (accessToken || isGuest) {
    return <Redirect href="/(protected)/(tabs)/explore" />;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="light" />

      {/* Sağ üst köşe: Dil butonu */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.langButton}
          onPress={() => setLangModalVisible(true)}
          activeOpacity={0.75}
        >
          <Globe size={14} color="#60a5fa" />
          <Text style={styles.langButtonText}>
            {currentLanguage === 'tr' ? 'TR' : 'EN'}
          </Text>
        </TouchableOpacity>
      </View>

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

      <LanguagePickerModal
        visible={langModalVisible}
        currentLanguage={currentLanguage}
        onSelect={handleChangeLanguage}
        onClose={() => setLangModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  // Üst bar: dil butonu buraya yerleşiyor
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  langButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  langButtonText: {
    color: '#60a5fa',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
});
