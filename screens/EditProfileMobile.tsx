import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Avatar from '../components/Avatar';
import { useRouter } from 'expo-router';
import { useAppBack } from '../hooks/useAppBack';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Info, Pencil } from '../components/icons';

import { useAuth } from '../context/AuthContext';
import { useMyTraktProfile } from '../hooks/useMyTraktProfile';
import { SettingsHeader } from '../components/settings/SettingsHeader';
import EditBioModal from '../components/modals/EditBioModal';
import { notify } from '../utils/confirmDialog';

const DESKTOP_BREAKPOINT = 768;
/**
 * Profilim — önizleme + **Hakkımda düzenleme** (bizim sistemimiz).
 *
 * Tarihçe: bu ekran bir form idi, Trakt'ın public API'si profil yazmaya izin
 * vermediği için (Madde 134) salt okunur önizlemeye ve trakt.tv'ye yönlendirmeye
 * çevrildi. 2026-09-15'te Hakkımda bizim tablomuza (`043`) taşınıp burada
 * düzenlenebilir oldu; 2026-09-17'de Trakt'a yönlendiren kutu ve buton
 * kaldırıldı (kullanıcı: *"tamamen bizim sistemde olcak bu kısımlar"*).
 *
 * ⚠️ Trakt'lı hesapta görünen ad ve fotoğraf hâlâ Trakt'tan OKUNUYOR ve şu an
 * düzenleme yolu yok — bizim sisteme taşınması ayrı iş (BACKLOG).
 */
export default function EditProfileMobile() {
  const router = useRouter();
  const { isGuest, authProvider } = useAuth();
  const { t } = useTranslation(['media', 'common']);
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;

  const { profile, isLoading: isProfileLoading, refetch: refetchProfile } = useMyTraktProfile();
  const [bioModalVisible, setBioModalVisible] = useState(false);

  // Bu ekranın doğal üstü Profil sekmesi — varsayılan (Keşfet) yerine o veriliyor.
  const navigateBack = useAppBack('/(protected)/(tabs)/profile');

  useEffect(() => {
    if (!isGuest) return;
    notify(t('common:error', 'Hata'), t('common:guestRestrictedMessage', 'Bu işlemi gerçekleştirmek için giriş yapmalısınız.'));
    navigateBack();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGuest]);


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
                <Avatar url={profile.images?.avatar?.full} ad={profile.username} size={96} halka style={styles.avatarBosluk} />
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

              {/* ══════════════════════════════════════════════════════════
                  ✏️ HAKKIMDA — ARTIK BURADA DÜZENLENİYOR (2026-09-15)
                  ══════════════════════════════════════════════════════════
                  Kullanıcı kararı: *"ayarlar yerine profili düzenle
                  seçeneğinde olması daha mantıklı."* Satır Ayarlar'dan
                  (`ProfileUsernameSection`) BURAYA taşındı — profil bilgisi
                  profil ekranında düzenlenir.

                  🔴 ESKİDEN BURASI TRAKT'IN `about`'UNU SALT OKUNUR
                  GÖSTERİYORDU ve altındaki kutu *"yalnızca Trakt.tv üzerinden
                  düzenlenebilir"* diyordu. §C15'ten sonra bu YANLIŞ bir
                  cümleydi: gösterilen metin artık BİZİM bio'muz. Kullanıcı:
                  *"trakt ile bağlı hakkımda kısmını sorunsuz şekilde
                  silebiliriz, artık bizim için spagetti kod."* */}
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.7}
                accessibilityRole="button"
                onPress={() => setBioModalVisible(true)}
              >
                <View style={styles.cardBaslik}>
                  <Text style={styles.label}>{t('media:editProfileAboutLabel', 'Hakkımda')}</Text>
                  <Pencil size={15} color="#a78bfa" />
                </View>
                <Text style={styles.value}>
                  {profile.about || <Text style={styles.valueEmpty}>{t('media:editProfileAboutEmpty', 'Kendinden kısaca bahset')}</Text>}
                </Text>
              </TouchableOpacity>

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
              {authProvider === 'google' && (
                <>
                  <View style={styles.infoBox}>
                    <Info size={16} color="#60a5fa" />
                    <Text style={styles.infoText}>
                      {t(
                        'media:editProfileGoogleOnlyHint',
                        'Kullanıcı adını Ayarlar > Hesap sayfasından değiştirebilirsin. Hakkımda bölümünü yukarıdan düzenleyebilirsin.'
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
              )}
              {/* 🗑️ TRAKT DALI KALDIRILDI (kullanıcı kararı, 2026-09-17).
                  Burada Trakt'lı hesaba *"Görünen adın ve profil fotoğrafın
                  Trakt.tv üzerinden geliyor…"* kutusu ve **"Trakt.tv'de Düzenle"**
                  butonu vardı. Kullanıcı: *"tamamen bizim sistemde olcak bu
                  kısımlar."*
                  ⚠️ BİLİNEN BOŞLUK: Trakt'lı hesabın görünen adı ve fotoğrafı
                  HÂLÂ Trakt'tan okunuyor ve bu butonla birlikte onları
                  düzenlemenin yolu kalmadı. Bizim sisteme taşınması ayrı iş —
                  BACKLOG'da kayıtlı. Hakkımda zaten bizde ve yukarıdaki kartla
                  düzenleniyor. */}
            </>
          )}
        </View>
      </ScrollView>

      {/* 🔁 Kaydedince `refetchProfile` — ekrandaki metin sunucudaki gerçekle
          aynı kalsın. Yerel state'i elle güncellemek iki kaynak yaratırdı. */}
      <EditBioModal
        visible={bioModalVisible}
        onClose={() => setBioModalVisible(false)}
        currentBio={profile?.about ?? null}
        onSaved={() => { void refetchProfile(); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  cardBaslik: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
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
  avatarBosluk: {
    marginBottom: 8,
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
