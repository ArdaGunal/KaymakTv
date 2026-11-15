import { nativeColor } from '../../constants/mobilePalette';
import React from 'react';
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
import { useIsimEkrani } from '../../hooks/useIsimEkrani';
import { useYeniHesapBirak } from '../../hooks/useYeniHesapBirak';
import { kullaniciAdiHataMetni } from '../../utils/kullaniciAdiHataMetni';
import { AD_EN_COK, gorunenAdHataMetni } from '../../utils/gorunenAd';
import { KULLANICI_ADI_EN_COK } from '../../features/feed/services/profile';

/**
 * İSİM EKRANI — her YENİ hesapta (Trakt ya da Google) ve kurallardan önce açılmış KURAL
 * DIŞI adlı eski hesapta ilk girişte açılır (M492, 2026-10-12). Kullanıcı kararı: «isim
 * koymadan girememesi lazım» · «her ikisinde de gösterilsin». Yönlendiren:
 * `hooks/useAdOnayKapisi.ts` (korumalı düzen), ölçüt Worker'ın `adOnaylandi` alanı.
 *
 * 1.0.1 Dal 1 (K4, 2026-11-15): ana alan GÖRÜNEN AD («Arda Günal») ve zorunlu; altında
 * otomatik `@kullanıcı_adı` önizlenir, istenirse «Değiştir». Kurallar ve kayıt
 * `hooks/useIsimEkrani.ts`'te; bu dosya yalnız çizer. «Atla» YOK.
 * - Kullanıcı adı kuralı (link uyumu) değişmedi: 3–30, İngilizce harf/rakam/`_`.
 * - İlk seçim 14 günlük değiştirme beklemesini BAŞLATMAZ (Worker).
 * - Kimlik Faz 4 (M515, D4): «Zaten hesabın var mı? Giriş yap» metin linki — popup değil;
 *   ne zaman görüneceği `hooks/useYeniHesapBirak.ts`'te.
 */
export default function ProfilOlusturScreen() {
  const router = useRouter();
  const { t } = useTranslation(['settings', 'common']);
  const ekran = useIsimEkrani();
  const yeniHesap = useYeniHesapBirak();

  const handleContinue = async () => {
    if (await ekran.devam()) router.replace('/(protected)/(tabs)/explore');
  };

  // Sunucu reddi: önce askı nedeni (M613); görünen ad kodları `ad_*`, geri kalanı kullanıcı adı / genel.
  const hata = ekran.error;
  const kodMetni = hata?.code?.startsWith('ad_') ? gorunenAdHataMetni(t, hata.code) : kullaniciAdiHataMetni(t, hata?.code);
  const hataMetni = hata ? hata.askiMetni ?? kodMetni : null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* M492: Android'de klavye «Devam»ı ve uyarıyı örtüyordu (cihazda görüldü) — içerik kayar. */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollIcerik} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <Text style={styles.title}>{t('settings:profileOnboardingTitle', 'Profilini Tamamla')}</Text>
          <Text style={styles.subtitle}>
            {t('settings:profileOnboardingSubtitleIsim', 'Profilinde görünecek adını yaz. Kullanıcı adın bundan oluşur; istersen değiştirebilirsin.')}
          </Text>

          {ekran.avatarUrl ? (
            <View style={styles.avatarWrap}>
              <Image source={{ uri: ekran.avatarUrl }} style={styles.avatar} contentFit="cover" cachePolicy="disk" />
              <TouchableOpacity style={styles.removeAvatarBtn} onPress={ekran.avatariKaldir} hitSlop={8}>
                <XIcon size={14} color={nativeColor('text', "#e2e8f0")} />
                <Text style={styles.removeAvatarText}>{t('settings:removePhoto', 'Fotoğrafı Kaldır')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.avatarWrap}>
              <View style={styles.avatarPlaceholder}>
                <UserCircle2 size={48} color={nativeColor('mutedDeep', "#475569")} />
              </View>
            </View>
          )}

          <TextInput
            style={styles.input}
            value={ekran.gorunenAd}
            onChangeText={ekran.gorunenAdDegisti}
            maxLength={AD_EN_COK * 2}
            placeholder={t('settings:displayNamePlaceholder', 'Adın ve soyadın')}
            placeholderTextColor={nativeColor('mutedDeep', "#64748b")}
            autoCapitalize="words"
            autoCorrect={false}
            accessibilityLabel={t('settings:editDisplayNameTitle', 'Görünen Ad')}
          />
          <Text style={ekran.adSorunu || ekran.gorunmezAyiklandi ? localStyles.kuralUyari : localStyles.kuralIpucu}>
            {ekran.adSorunu
              ? gorunenAdHataMetni(t, ekran.adSorunu)
              : ekran.gorunmezAyiklandi
                ? t('settings:displayNameInvisibleRemoved', 'Görünmeyen karakterler çıkarıldı. Adını yaz ya da kutuyu kendin boşalt.')
                : t('settings:onboardingNameHint', 'Profilinde ve akışta bu ad görünür.')}
          </Text>

          <View style={localStyles.kullaniciAdiKutu}>
            <Text style={localStyles.kullaniciAdiEtiket}>{t('settings:onboardingUsernameLabel', 'Kullanıcı adın')}</Text>
            {ekran.elleDuzenleniyor ? (
              <TextInput
                style={[styles.input, localStyles.kullaniciAdiGirdi]}
                value={ekran.kullaniciAdiGirdisi}
                onChangeText={ekran.kullaniciAdiDegisti}
                maxLength={KULLANICI_ADI_EN_COK}
                placeholder={t('settings:usernamePlaceholder', 'Kullanıcı adın')}
                placeholderTextColor={nativeColor('mutedDeep', "#64748b")}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
              />
            ) : (
              <View style={localStyles.kullaniciAdiSatir}>
                {/* Ad henüz yüklenmediyse tek başına «@» çizilmez (M599'daki kusurun aynısı). */}
                <Text style={localStyles.kullaniciAdiOnizleme} numberOfLines={1}>
                  {ekran.kullaniciAdi ? `@${ekran.kullaniciAdi}` : ''}
                </Text>
                {ekran.oneriBekleniyor && <ActivityIndicator size="small" color={nativeColor('steel', "#60a5fa")} />}
                <TouchableOpacity onPress={ekran.kullaniciAdiDuzenle} hitSlop={8} accessibilityRole="button">
                  <Text style={localStyles.degistir}>{t('settings:onboardingUsernameEdit', 'Değiştir')}</Text>
                </TouchableOpacity>
              </View>
            )}
            {/* Ad yüklenirken (boş) uyarı yanıp sönmesin; «Devam» yine kapalı kalır. */}
            {ekran.kullaniciAdiKuralSorunu && (ekran.elleDuzenleniyor || !!ekran.kullaniciAdi) ? (
              <Text style={localStyles.kuralUyari}>{kullaniciAdiHataMetni(t, ekran.kullaniciAdiKuralSorunu)}</Text>
            ) : ekran.elleDuzenleniyor ? (
              <Text style={localStyles.kuralIpucu}>
                {t('settings:usernameRuleHint', '3–30 karakter · İngilizce harf, rakam ve alt çizgi (_) · boşluk yok')}
              </Text>
            ) : null}
          </View>

          {hataMetni && (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>{hataMetni}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.continueBtn, ekran.devamKapali && styles.disabledBtn]}
            onPress={handleContinue}
            disabled={ekran.devamKapali}
          >
            {ekran.isSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.continueBtnText}>{t('common:continue', 'Devam Et')}</Text>}
          </TouchableOpacity>

          {/* GIRIS-TASARIM-01 (M536): gözden kaçmayan ama ekranı boğmayan bilgi kutusu. Basınca
              az önce açılan boş hesap silinir, Google oturumu kapanır, temiz giriş ekranına dönülür. */}
          {yeniHesap.gorunur && (
            <TouchableOpacity
              style={[localStyles.zatenKutu, (yeniHesap.birakiliyor || ekran.isSaving) && localStyles.zatenKutuPasif]}
              onPress={yeniHesap.birak}
              disabled={yeniHesap.birakiliyor || ekran.isSaving}
              accessibilityRole="button"
            >
              <Text style={localStyles.zatenBaslik}>{t('settings:zatenHesapBaslik')}</Text>
              {yeniHesap.birakiliyor
                ? <ActivityIndicator size="small" color={nativeColor('steel', "#60a5fa")} />
                : <Text style={localStyles.zatenEylem}>{t('settings:zatenHesapEylem')}</Text>}
            </TouchableOpacity>
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
    backgroundColor: nativeColor('surface', '#171717'),
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
    color: nativeColor('text', '#f8fafc'),
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    color: nativeColor('muted', '#94a3b8'),
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
    backgroundColor: nativeColor('raised', '#1e293b'),
  },
  avatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: nativeColor('raised', '#1e293b'),
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
    color: nativeColor('muted', '#94a3b8'),
    fontSize: 12,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: '#fff',
    padding: 14,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: nativeColor('border', '#334155'),
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
    backgroundColor: nativeColor('primary', '#2563eb'),
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

// §S3 (M402) — kural uyarıları; 1.0.1 Dal 1 — `@kullanıcı_adı` önizleme satırı.
const localStyles = StyleSheet.create({
  kuralUyari: {
    color: '#fbbf24',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
  },
  kuralIpucu: {
    color: nativeColor('mutedDeep', '#64748b'),
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
  },
  kullaniciAdiKutu: {
    marginTop: 18,
  },
  kullaniciAdiEtiket: {
    color: nativeColor('muted', '#94a3b8'),
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  kullaniciAdiSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  kullaniciAdiOnizleme: {
    flex: 1,
    color: nativeColor('body', '#cbd5e1'),
    fontSize: 15,
  },
  kullaniciAdiGirdi: {
    paddingVertical: 10,
    fontSize: 15,
  },
  degistir: {
    color: nativeColor('steel', '#60a5fa'),
    fontSize: 14,
    fontWeight: '600',
  },
  zatenKutu: {
    marginTop: 22,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: nativeColor('border', '#334155'),
    backgroundColor: nativeColor('raised', '#1e293b'),
    alignItems: 'center',
    gap: 6,
  },
  zatenKutuPasif: { opacity: 0.6 },
  zatenBaslik: {
    color: nativeColor('body', '#cbd5e1'),
    fontSize: 14,
    textAlign: 'center',
  },
  zatenEylem: {
    color: nativeColor('steel', '#60a5fa'),
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
});
