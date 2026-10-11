import React, { useEffect, useState } from 'react';
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
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useUpdateProfile } from '../../hooks/useUpdateProfile';
import { useMyProfile } from '../../hooks/useMyProfile';
import { kullaniciAdiHataMetni } from '../../utils/kullaniciAdiHataMetni';
import { kullaniciAdiSorunu, KULLANICI_ADI_EN_COK } from '../../features/feed/services/profile';

/**
 * İSİM EKRANI — her YENİ hesapta (Trakt ya da Google) ve kurallardan önce açılmış KURAL
 * DIŞI adlı eski hesapta ilk girişte açılır (M492, 2026-10-12). Kullanıcı kararı: «isim
 * koymadan girememesi lazım» · «her ikisinde de gösterilsin» · «isim ekranını düzgünce
 * kuralım». Yönlendiren: `hooks/useAdOnayKapisi.ts` (korumalı düzen), ölçüt Worker'ın
 * `adOnaylandi` alanı (`063 users.ad_onaylandi_at`).
 *
 * - Ad, Worker'ın türettiği otomatik adla ÖNCEDEN dolu gelir; kullanıcı değiştirir ya da
 *   «Devam» der. İkisi de sunucuda ONAY yazar (`adOnayla`); «Atla» YOK.
 * - Kural (link uyumu): 3–30, yalnız İngilizce harf/rakam/`_` — boşluk yok (kullanıcı:
 *   «isimde linklerde sorun olmaması için boşluklu yapmayalım»). Kural dışı eski ad
 *   değiştirilmeden geçilemez.
 * - İlk seçim 14 günlük değiştirme beklemesini BAŞLATMAZ (Worker).
 */
export default function ProfilOlusturScreen() {
  const router = useRouter();
  const { t } = useTranslation(['settings', 'common']);
  const { myUsername, myAvatarUrl } = useAuth();
  const { profile } = useMyProfile();
  const { save, isSaving, error, clearError } = useUpdateProfile();

  // Sunucudaki ad esas (Trakt hesabında yerel kopya yok); gelene kadar yerel kopya.
  const sunucuAdi = profile?.username ?? myUsername ?? '';
  const [username, setUsername] = useState(sunucuAdi);
  const [dokunuldu, setDokunuldu] = useState(false);
  useEffect(() => {
    if (!dokunuldu && sunucuAdi) setUsername(sunucuAdi);
  }, [sunucuAdi, dokunuldu]);
  const [avatarRemoved, setAvatarRemoved] = useState(false);

  const trimmed = username.trim();
  const usernameChanged = trimmed.length > 0 && trimmed !== sunucuAdi.trim();
  // Onaylanacak ad (değişmese de) BUGÜNKÜ kurala uymalı — kural dışı eski ad geçemez.
  const kuralSorunu = trimmed.length > 0 ? kullaniciAdiSorunu(trimmed) : null;
  const invalid = trimmed.length === 0 || kuralSorunu !== null;

  const goToApp = () => router.replace('/(protected)/(tabs)/explore');

  const handleContinue = async () => {
    if (invalid) return;
    const ok = await save({
      username: usernameChanged ? trimmed : undefined,
      avatarUrl: avatarRemoved ? null : undefined,
      adOnayla: true,
    });
    if (ok) goToApp();
  };

  const showAvatar = !!myAvatarUrl && !avatarRemoved;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* M492: Android'de klavye «Devam»ı ve uyarıyı örtüyordu (cihazda görüldü) — içerik kayar. */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollIcerik} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <Text style={styles.title}>{t('settings:profileOnboardingTitle', 'Profilini Tamamla')}</Text>
          <Text style={styles.subtitle}>
            {t(
              'settings:profileOnboardingSubtitleAll',
              'Uygulamada görünecek kullanıcı adını seç. Önerilen adı kullanabilir ya da değiştirebilirsin.'
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
            onChangeText={(v) => {
              setDokunuldu(true);
              setUsername(v);
              // Önceki denemenin uyarısı («alınmış») yeni adda kalmasın (cihazda görüldü).
              clearError();
            }}
            maxLength={KULLANICI_ADI_EN_COK}
            placeholder={t('settings:usernamePlaceholder', 'Kullanıcı adın')}
            placeholderTextColor="#64748b"
            autoCapitalize="none"
            autoCorrect={false}
          />

          {!kuralSorunu && (
            <Text style={localStyles.kuralIpucu}>
              {t('settings:usernameRuleHint', '3–30 karakter · İngilizce harf, rakam ve alt çizgi (_) · boşluk yok')}
            </Text>
          )}
          {kuralSorunu && (
            <Text style={localStyles.kuralUyari}>
              {kullaniciAdiHataMetni(t, kuralSorunu)}
            </Text>
          )}

          {error && (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>
                {kullaniciAdiHataMetni(t, error.code)}
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

        </View>
        </ScrollView>
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
  scrollIcerik: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 24,
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
});

// §S3 (M402) — kullanıcı adı kural uyarısı (Worker `usernameRules.js` göstergesi).
const localStyles = StyleSheet.create({
  kuralUyari: {
    color: '#fbbf24',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
  },
  kuralIpucu: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
  },
});
