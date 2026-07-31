import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pencil } from 'lucide-react-native';

import { useAuth } from '../context/AuthContext';
import { useMyTraktProfile } from '../hooks/useMyTraktProfile';
import { useEditProfile } from '../hooks/useEditProfile';
import { SettingsHeader } from '../components/settings/SettingsHeader';
import { confirmAsync, notify } from '../utils/confirmDialog';

const DESKTOP_BREAKPOINT = 768;
const TRAKT_PROFILE_SETTINGS_URL = 'https://trakt.tv/settings/profile';

export default function EditProfileMobile() {
  const router = useRouter();
  const { isGuest } = useAuth();
  const { t } = useTranslation(['media', 'common']);
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;

  const { profile, isLoading: isProfileLoading } = useMyTraktProfile();
  const { name, setName, about, setAbout, isSaving, save } = useEditProfile(profile);

  const navigateBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(protected)/(tabs)/profile');
  };

  useEffect(() => {
    if (!isGuest) return;
    notify(t('common:error', 'Hata'), t('common:guestRestrictedMessage', 'Bu işlemi gerçekleştirmek için giriş yapmalısınız.'));
    navigateBack();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGuest]);

  const handleAvatarPress = async () => {
    const confirmed = await confirmAsync(
      t('media:editProfileAvatarConfirmTitle', 'Fotoğrafı Değiştir'),
      t('media:editProfileAvatarConfirmMessage', 'Profil fotoğrafınızı değiştirmek için Trakt.tv web sitesini ziyaret etmeniz gerekir. Şimdi gidilsin mi?'),
      t('media:editProfileAvatarConfirmButton', "Trakt.tv'ye Git"),
      t('common:cancel', 'İptal')
    );
    if (confirmed) {
      Linking.openURL(TRAKT_PROFILE_SETTINGS_URL).catch((err) => console.error('URL açılamadı:', err));
    }
  };

  const handleSave = async () => {
    const success = await save();
    if (success) navigateBack();
  };

  const avatarUrl = profile?.images?.avatar?.full;
  const initial = profile?.username?.charAt(0).toUpperCase() ?? '?';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, isDesktop && styles.scrollContentDesktop]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <SettingsHeader
            title={t('media:editProfileTitle', 'Profili Düzenle')}
            isDesktop={isDesktop}
            onBack={navigateBack}
          />

          <View style={[styles.content, isDesktop && styles.contentDesktop]}>
            {isProfileLoading || !profile ? (
              <ActivityIndicator size="large" color="#3b82f6" style={styles.loadingIndicator} />
            ) : (
              <>
                <View style={styles.avatarSection}>
                  <View style={styles.avatarWrap}>
                    {avatarUrl ? (
                      <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                    ) : (
                      <View style={styles.avatarFallback}>
                        <Text style={styles.avatarText}>{initial}</Text>
                      </View>
                    )}
                    <TouchableOpacity style={styles.pencilBtn} onPress={handleAvatarPress} activeOpacity={0.85}>
                      <Pencil size={14} color="#fff" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.avatarHint}>
                    {t('media:editProfileAvatarHint', 'Fotoğrafı değiştirmek için dokun')}
                  </Text>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>{t('media:editProfileNameLabel', 'Görünen Ad')}</Text>
                  <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder={t('media:editProfileNamePlaceholder', 'Adınız')}
                    placeholderTextColor="#64748b"
                    editable={!isSaving}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>{t('media:editProfileAboutLabel', 'Hakkında')}</Text>
                  <TextInput
                    style={[styles.input, styles.inputMultiline]}
                    value={about}
                    onChangeText={setAbout}
                    placeholder={t('media:editProfileAboutPlaceholder', 'Kendinizden bahsedin...')}
                    placeholderTextColor="#64748b"
                    multiline
                    numberOfLines={6}
                    textAlignVertical="top"
                    editable={!isSaving}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.saveBtn, isSaving && styles.btnDisabled]}
                  onPress={handleSave}
                  disabled={isSaving}
                  activeOpacity={0.85}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.saveBtnText}>{t('media:editProfileSaveButton', 'Kaydet')}</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 60,
  },
  scrollContentDesktop: {
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 18,
    width: '100%',
  },
  contentDesktop: {
    maxWidth: 480,
    alignSelf: 'center',
    paddingHorizontal: 0,
  },
  loadingIndicator: {
    marginTop: 60,
  },
  avatarSection: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: 'rgba(59,130,246,0.4)',
  },
  avatarFallback: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#1e293b',
    borderWidth: 2,
    borderColor: 'rgba(59,130,246,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#94a3b8',
    fontWeight: '700',
    fontSize: 30,
  },
  pencilBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#3b82f6',
    borderWidth: 2,
    borderColor: '#0B1120',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHint: {
    color: '#64748b',
    fontSize: 12,
  },
  field: {
    gap: 6,
  },
  label: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    width: '100%',
    minHeight: 48,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#f1f5f9',
    fontSize: 15,
  },
  inputMultiline: {
    minHeight: 150,
    lineHeight: 22,
  },
  saveBtn: {
    width: '100%',
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#3b82f6',
    marginTop: 8,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
