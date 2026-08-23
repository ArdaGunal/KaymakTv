import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Info } from '../components/icons';

import { useAuth } from '../context/AuthContext';
import { useMyTraktProfile } from '../hooks/useMyTraktProfile';
import { SettingsHeader } from '../components/settings/SettingsHeader';
import { notify } from '../utils/confirmDialog';

const DESKTOP_BREAKPOINT = 768;
const TRAKT_PROFILE_SETTINGS_URL = 'https://trakt.tv/settings/profile';

/**
 * Profil önizlemesi — **SALT OKUNUR** (bkz. docs/HISTORY.md Madde 134).
 *
 * Bu ekran eskiden düzenlenebilir bir formdu (TextInput'lar + Kaydet). Ama
 * Trakt'ın public API'si profil ayarlarını YAZMAYA İZİN VERMİYOR: `/users/settings`
 * için yalnızca `GET` belgelenmiş; `PUT` Trakt'ın kendi web uygulamasına ait
 * first-party bir uç nokta ve üçüncü parti anahtarla her zaman `401` dönüyor
 * (canlı olarak doğrulandı). Kullanıcıyı "kaydettim ama olmuyor" döngüsünde
 * bırakmamak için form kaldırıldı; artık bilgiler sergileniyor ve düzenleme
 * için trakt.tv'ye yönlendiriliyor.
 */
export default function EditProfileMobile() {
  const router = useRouter();
  const { isGuest, authProvider } = useAuth();
  const { t } = useTranslation(['media', 'common']);
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;

  const { profile, isLoading: isProfileLoading } = useMyTraktProfile();

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

  const openTraktSettings = () => {
    Linking.openURL(TRAKT_PROFILE_SETTINGS_URL).catch((err) => console.error('URL açılamadı:', err));
  };

  const avatarUrl = profile?.images?.avatar?.full;
  const initial = profile?.username?.charAt(0).toUpperCase() ?? '?';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, isDesktop && styles.scrollContentDesktop]}
        showsVerticalScrollIndicator={false}
      >
        <SettingsHeader
          title={t('media:editProfileTitle', 'Profilim')}
          isDesktop={isDesktop}
          onBack={navigateBack}
        />

        <View style={[styles.content, isDesktop && styles.contentDesktop]}>
          {isProfileLoading || !profile ? (
            <ActivityIndicator size="large" color="#3b82f6" style={styles.loadingIndicator} />
          ) : (
            <>
              <View style={styles.avatarSection}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarText}>{initial}</Text>
                  </View>
                )}
                <Text style={styles.displayName} numberOfLines={1}>
                  {profile.name || profile.username}
                </Text>
                <Text style={styles.handle} numberOfLines={1}>
                  @{profile.username}
                </Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.label}>{t('media:editProfileNameLabel', 'Görünen Ad')}</Text>
                <Text style={styles.value}>
                  {profile.name || <Text style={styles.valueEmpty}>{t('media:editProfileEmpty', 'Belirtilmemiş')}</Text>}
                </Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.label}>{t('media:editProfileAboutLabel', 'Hakkında')}</Text>
                <Text style={styles.value}>
                  {profile.about || <Text style={styles.valueEmpty}>{t('media:editProfileEmpty', 'Belirtilmemiş')}</Text>}
                </Text>
              </View>

              {/* 🔴 2026-08-22 — Google-only kullanıcı (`create_new`, Madde 221)
                  için bu blok YANLIŞ TEŞHİS koyuyordu: "yalnızca Trakt.tv'de
                  düzenlenebilir" diyor ve `trakt.tv/settings/profile`'a
                  yönlendiriyordu — ama bu kullanıcının Trakt hesabı HİÇ YOK,
                  o sayfada onunla ilgili hiçbir şey bulunmaz. Kullanıcı bunu
                  "profili düzenle kısmı Trakt'a bağlanmış görünüyor, kafa
                  karıştırıcı" diye bildirdi. Gerçek düzenleme yolu zaten var
                  — Ayarlar'daki "Kullanıcı Adı" satırı (bkz.
                  `components/settings/ProfileUsernameSection.tsx`, Madde
                  227) — burada YENİDEN İNŞA ETMEK yerine oraya yönlendiriyoruz. */}
              {authProvider === 'google' ? (
                <>
                  <View style={styles.infoBox}>
                    <Info size={16} color="#60a5fa" />
                    <Text style={styles.infoText}>
                      {t(
                        'media:editProfileGoogleOnlyHint',
                        'Kullanıcı adını Ayarlar > Hesap sayfasından değiştirebilirsin.'
                      )}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.traktBtn}
                    onPress={() => router.push('/(protected)/account')}
                    activeOpacity={0.85}
                  >
                    <ExternalLink size={17} color="#fff" />
                    <Text style={styles.traktBtnText}>{t('common:goToSettings')}</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={styles.infoBox}>
                    <Info size={16} color="#60a5fa" />
                    <Text style={styles.infoText}>
                      {t(
                        'media:editProfileTraktOnlyHint',
                        'Profil bilgileri yalnızca Trakt.tv üzerinden düzenlenebilir.'
                      )}
                    </Text>
                  </View>

                  <TouchableOpacity style={styles.traktBtn} onPress={openTraktSettings} activeOpacity={0.85}>
                    <ExternalLink size={17} color="#fff" />
                    <Text style={styles.traktBtnText}>
                      {t('media:editProfileOpenTrakt', "Trakt.tv'de Düzenle")}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          )}
        </View>
      </ScrollView>
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
    gap: 14,
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
    gap: 4,
    marginBottom: 10,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: 'rgba(59,130,246,0.4)',
    marginBottom: 8,
  },
  avatarFallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#1e293b',
    borderWidth: 2,
    borderColor: 'rgba(59,130,246,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  avatarText: {
    color: '#94a3b8',
    fontWeight: '700',
    fontSize: 34,
  },
  displayName: {
    color: '#f8fafc',
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  handle: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '500',
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6,
  },
  label: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  value: {
    color: '#f1f5f9',
    fontSize: 15,
    lineHeight: 21,
  },
  valueEmpty: {
    color: '#64748b',
    fontStyle: 'italic',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(96,165,250,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.18)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 2,
  },
  infoText: {
    flex: 1,
    color: '#93c5fd',
    fontSize: 12.5,
    lineHeight: 17,
  },
  traktBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: '#3b82f6',
    marginTop: 4,
    ...({ cursor: 'pointer' } as any),
  },
  traktBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
