import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import { UserCircle2, X as XIcon } from '../../components/icons';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useUpdateProfile } from '../../hooks/useUpdateProfile';

/**
 * Google-only kayıt (`create_new`, HISTORY Madde 221) sonrası GÖSTERİLEN
 * tek seferlik onboarding — yalnızca `settings.tsx`'in `handleContinueWithoutTrakt`
 * dalından, `status:'created'` iken yönlendirilir (bkz. o dosyadaki not).
 *
 * `AuthContext.myUsername`/`myAvatarUrl` bu ekrana gelmeden HEMEN önce
 * `saveGoogleSession`'a Worker'ın türettiği değerlerle yazılmış olur —
 * burası onları ÖNCEDEN doldurur, ağ isteği olmadan (kullanıcı hiç
 * dokunmazsa "Devam Et" hiçbir şey kaydetmeden doğrudan geçer).
 */
export default function ProfilOlusturScreen() {
  const router = useRouter();
  const { t } = useTranslation(['settings', 'common']);
  const { myUsername, myAvatarUrl } = useAuth();
  const { save, isSaving, error } = useUpdateProfile();

  const [username, setUsername] = useState(myUsername ?? '');
  const [avatarRemoved, setAvatarRemoved] = useState(false);

  const trimmed = username.trim();
  const usernameChanged = trimmed.length > 0 && trimmed !== (myUsername ?? '').trim();
  const invalid = trimmed.length === 0 || trimmed.length > 30;

  const goToApp = () => router.replace('/(protected)/(tabs)/explore');

  const handleContinue = async () => {
    if (invalid) return;
    // Hiçbir şey değişmediyse ağ isteği bile atma — türetilen değerler
    // zaten kaydedilmiş durumda (bkz. Worker'ın create_new dalı).
    if (!usernameChanged && !avatarRemoved) {
      goToApp();
      return;
    }
    const ok = await save({
      username: usernameChanged ? trimmed : undefined,
      avatarUrl: avatarRemoved ? null : undefined,
    });
    if (ok) goToApp();
  };

  const showAvatar = !!myAvatarUrl && !avatarRemoved;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.content}>
          <Text style={styles.title}>{t('settings:profileOnboardingTitle', 'Profilini Tamamla')}</Text>
          <Text style={styles.subtitle}>
            {t(
              'settings:profileOnboardingSubtitle',
              'Google hesabınla girdiğin ad ve fotoğraf aşağıda — istersen değiştir, istersen böyle bırak.'
            )}
          </Text>

          {showAvatar ? (
            <View style={styles.avatarWrap}>
              <Image source={{ uri: myAvatarUrl! }} style={styles.avatar} contentFit="cover" cachePolicy="disk" />
              <TouchableOpacity style={styles.removeAvatarBtn} onPress={() => setAvatarRemoved(true)} hitSlop={8}>
                <XIcon size={14} color="#e2e8f0" />
                <Text style={styles.removeAvatarText}>{t('settings:removePhoto', 'Fotoğrafı Kaldır')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.avatarWrap}>
              <View style={styles.avatarPlaceholder}>
                <UserCircle2 size={48} color="#475569" />
              </View>
            </View>
          )}

          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            maxLength={30}
            placeholder={t('settings:usernamePlaceholder', 'Kullanıcı adın')}
            placeholderTextColor="#64748b"
          />

          {error && (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>
                {error.code === 'taken'
                  ? t('settings:usernameTaken', 'Bu kullanıcı adı zaten alınmış, başka bir tane dene.')
                  : error.message}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.continueBtn, (invalid || isSaving) && styles.disabledBtn]}
            onPress={handleContinue}
            disabled={invalid || isSaving}
          >
            {isSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.continueBtnText}>{t('common:continue', 'Devam Et')}</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipBtn} onPress={goToApp} disabled={isSaving}>
            <Text style={styles.skipBtnText}>{t('settings:skipForNow', 'Şimdilik Atla')}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#171717',
  },
  flex: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    color: '#f8fafc',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 28,
  },
  avatarWrap: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#1e293b',
  },
  avatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeAvatarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
  },
  removeAvatarText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: '#fff',
    padding: 14,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  notice: {
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderColor: 'rgba(239,68,68,0.28)',
    paddingVertical: 9,
    paddingHorizontal: 11,
    marginTop: 12,
  },
  noticeText: {
    color: '#fca5a5',
    fontSize: 12,
    lineHeight: 17,
  },
  continueBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  continueBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  disabledBtn: {
    opacity: 0.5,
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  skipBtnText: {
    color: '#94a3b8',
    fontSize: 14,
  },
});
