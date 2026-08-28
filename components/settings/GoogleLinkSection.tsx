import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GoogleSigninButton } from '@react-native-google-signin/google-signin';
import { CheckCircle2 } from '../icons';
import { SettingsSection } from './SettingsSection';
import { useGoogleSignIn } from '../../hooks/useGoogleSignIn';
import { useGoogleNativeSignIn } from '../../hooks/useGoogleNativeSignIn';
import { useAuth } from '../../context/AuthContext';
import { linkGoogleToTrakt } from '../../services/api/googleAuth';
import { logError } from '../../utils/errorLog';

/**
 * "Google Hesabını Bağla" — Ayarlar ekranındaki hesap bağlama seçeneği.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * NEDEN BURADA, GİRİŞ EKRANINDA DEĞİL (2026-08-23 ürün kararı)
 * ═══════════════════════════════════════════════════════════════════════
 * Google GİRİŞ olarak sunulduğunda, Trakt'ı olmayan bir kullanıcı hesap
 * açabiliyordu — ama dizi/film TAKİBİ yapamıyordu (Kütüphane ve Takvim ona
 * "Trakt'a bağlan" diyor). Lansmanda "uygulama bozuk" izlenimi yaratan
 * buydu. Google artık alternatif bir giriş yöntemi DEĞİL, zaten Trakt'ı
 * olan bir hesaba eklenen ikinci bir anahtar.
 *
 * Tam gerekçe + geri alma yolu: docs/design/GOOGLE_AUTH_MIGRATION.md
 *
 * ⚠️ NEDEN YALNIZCA TRAKT KULLANICISI (misafir DEĞİL): `link_trakt` eylemi
 * Worker'da `traktAccessToken` ZORUNLU kılıyor — misafirin böyle bir token'ı
 * yok. Misafire bu seçeneği göstermenin tek yolu `create_new`'e düşmekti, o
 * da tam olarak kaldırdığımız Google-only hesabı üretirdi. Yani misafir için
 * bu buton ya hiçbir şey yapamaz ya da sorunu geri getirirdi.
 *
 * ⚠️ WEB'de GIS (Google Identity Services) script'iyle çalışıyor. NATIVE'de
 * (iOS/Android) `@react-native-google-signin/google-signin` kullanıyor —
 * "native taraf bilinçli olarak ertelendi" notu HISTORY Madde 246+'da
 * kapandı. İkisi ayrı `onCredential`/buton yolu ama AYNI Worker ucuna
 * (`linkGoogleToTrakt` → `/auth/google` action=`link_trakt`) çıkıyor.
 *
 * ⚠️ BU EKRANDA TRAKT OAUTH'U YOKTUR ve olmamalıdır (bkz.
 * TraktAccountSection'ın başlığı: Trakt'ın kayıtlı redirect URI'si tek bir
 * yola, `/settings`'e bakıyor). Bu bileşen o kuralı İHLAL ETMEZ: Google'ın
 * GIS akışı tam sayfa yönlendirme yapmaz, kimlik kanıtı aynı sayfada
 * callback ile gelir ve kullanıcının Trakt token'ı zaten elimizdedir —
 * yani hiçbir yönlendirme gerekmez, tek bir ağ isteğiyle bağlanır. Native'in
 * `GoogleSignin.signIn()`'i de aynı şekilde sayfa değiştirmeden (native bir
 * sheet/modal içinde) tamamlanır.
 */

// 🔴 GEÇİCİ OLARAK KAPALI (2026-08-27, kullanıcı kararı — HISTORY Madde 248):
// Sistem Trakt'tan bağımsızlığını ilan edene kadar Google bağlama gerçek
// kullanıcılara KAPALI — native taraf bugün eklendi, cihaz testi henüz
// yapılmadı; erken açık bırakmak yanlış/eksik veri yazma riski taşıyor.
// Geliştirici kendi testi için yerelde `true`'ya çevirebilir — ama bu
// satırı `false`'a döndürmeden production'a/commit'e GÖNDERME.
const GOOGLE_LINK_ENABLED = false;

export function GoogleLinkSection() {
  if (!GOOGLE_LINK_ENABLED) return null;

  const { accessToken, isGuest, authProvider } = useAuth();
  const isWeb = Platform.OS === 'web';
  const traktKullanicisi = !isGuest && authProvider === 'trakt' && !!accessToken;

  // 🔴 Kapı DIŞ bileşende, iç hook'lar çağrılmadan ÖNCE. İç bileşene
  // ayrılmasının sebebi: hook'lar koşullu çağrılamaz, ama hook'u koşulsuz
  // çağırıp sonra `null` dönmek GIS'i (web) görünmeyen kullanıcılar için de
  // başlatır — script yüklenir, olmayan bir konteyneri çizmeye çalışır ve
  // gereksiz `loadError` üretir. Bu ayrım o gürültüyü tamamen kesiyor.
  if (!traktKullanicisi || !accessToken) return null;

  return isWeb ? (
    <GoogleLinkSectionInner traktAccessToken={accessToken} />
  ) : (
    <GoogleLinkSectionNative traktAccessToken={accessToken} />
  );
}

function GoogleLinkSectionInner({ traktAccessToken }: { traktAccessToken: string }) {
  const { t } = useTranslation(['settings', 'common']);
  const [durum, setDurum] = useState<'bos' | 'baglaniyor' | 'baglandi'>('bos');
  const [hata, setHata] = useState<string | null>(null);

  const onCredential = async (idToken: string, nonce: string) => {
    setHata(null);
    setDurum('baglaniyor');
    try {
      await linkGoogleToTrakt(idToken, traktAccessToken, nonce);
      setDurum('baglandi');
    } catch (error: any) {
      // AI_RULES §2: sessiz başarısızlık YASAK — kullanıcı butona bastı,
      // ekranda görünür bir sonuç görmek zorunda.
      logError('GoogleLinkSection.link', error);
      setHata(error?.message || t('common:communicationError', 'Bir sorun oluştu.'));
      setDurum('bos');
    }
  };

  const { buttonElementId, loadError } = useGoogleSignIn(onCredential);

  return (
    <SettingsSection title={t('settings:googleLinkTitle', 'Google Hesabı')}>
      <View style={styles.wrap}>
        <Text style={styles.aciklama}>
          {t(
            'settings:googleLinkDescription',
            'Google hesabını bağlarsan, Trakt ile birlikte Google ile de giriş yapabilirsin. Takip verilerin Trakt üzerinden çalışmaya devam eder.'
          )}
        </Text>

        {/* ⛔ BU KONTEYNERİ KOŞULLU HÂLE GETİRMEYİN — Madde 231'in dersi:
            GIS'in çizdiği buton unmount edilirse bir daha ASLA çizilmiyor
            (`useGoogleSignIn`'in çizim denemesi tek seferlik). Durum mesajları
            konteynerin KARDEŞİ olarak eklenir, onu SARMALAMAZ. */}
        <View style={[styles.gisOuter, durum !== 'bos' && styles.gisHidden]}>
          <View nativeID={buttonElementId} style={styles.gisContainer} />
        </View>

        {durum === 'baglaniyor' && (
          <View style={styles.satir}>
            <ActivityIndicator size="small" color="#94a3b8" />
            <Text style={styles.bilgiText}>
              {t('settings:googleLinking', 'Hesabın bağlanıyor…')}
            </Text>
          </View>
        )}

        {durum === 'baglandi' && (
          <View style={styles.basariKutu}>
            <CheckCircle2 size={18} color="#4ade80" />
            <Text style={styles.basariText}>
              {t('settings:googleLinked', 'Google hesabın bağlandı.')}
            </Text>
          </View>
        )}

        {hata && <Text style={styles.hataText}>{hata}</Text>}
        {loadError && durum === 'bos' && <Text style={styles.hataText}>{loadError}</Text>}
      </View>
    </SettingsSection>
  );
}

function GoogleLinkSectionNative({ traktAccessToken }: { traktAccessToken: string }) {
  const { t } = useTranslation(['settings', 'common']);
  const [durum, setDurum] = useState<'bos' | 'baglaniyor' | 'baglandi'>('bos');
  const [hata, setHata] = useState<string | null>(null);
  const { signIn } = useGoogleNativeSignIn();

  const handlePress = async () => {
    setHata(null);
    setDurum('baglaniyor');
    const result = await signIn();
    if (!result.ok) {
      // Kullanıcının kendi iptali (sistem sheet'ini kapatması) bir HATA
      // değil — sessizce başlangıç durumuna dön, kırmızı metin gösterme.
      setDurum('bos');
      if (!result.cancelled) {
        logError('GoogleLinkSection.native.signIn', new Error(result.message));
        setHata(result.message);
      }
      return;
    }
    try {
      // Native'de nonce YOK (bkz. useGoogleNativeSignIn.ts başlığı) —
      // üçüncü argüman bilinçli olarak verilmiyor.
      await linkGoogleToTrakt(result.idToken, traktAccessToken);
      setDurum('baglandi');
    } catch (error: any) {
      // AI_RULES §2: sessiz başarısızlık YASAK — kullanıcı butona bastı,
      // ekranda görünür bir sonuç görmek zorunda.
      logError('GoogleLinkSection.native.link', error);
      setHata(error?.message || t('common:communicationError', 'Bir sorun oluştu.'));
      setDurum('bos');
    }
  };

  return (
    <SettingsSection title={t('settings:googleLinkTitle', 'Google Hesabı')}>
      <View style={styles.wrap}>
        <Text style={styles.aciklama}>
          {t(
            'settings:googleLinkDescription',
            'Google hesabını bağlarsan, Trakt ile birlikte Google ile de giriş yapabilirsin. Takip verilerin Trakt üzerinden çalışmaya devam eder.'
          )}
        </Text>

        {durum === 'bos' && (
          <GoogleSigninButton
            size={GoogleSigninButton.Size.Wide}
            color={GoogleSigninButton.Color.Dark}
            onPress={handlePress}
            style={styles.nativeButton}
          />
        )}

        {durum === 'baglaniyor' && (
          <View style={styles.satir}>
            <ActivityIndicator size="small" color="#94a3b8" />
            <Text style={styles.bilgiText}>
              {t('settings:googleLinking', 'Hesabın bağlanıyor…')}
            </Text>
          </View>
        )}

        {durum === 'baglandi' && (
          <View style={styles.basariKutu}>
            <CheckCircle2 size={18} color="#4ade80" />
            <Text style={styles.basariText}>
              {t('settings:googleLinked', 'Google hesabın bağlandı.')}
            </Text>
          </View>
        )}

        {hata && <Text style={styles.hataText}>{hata}</Text>}
      </View>
    </SettingsSection>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  aciklama: { color: '#94a3b8', fontSize: 13, lineHeight: 19 },
  gisOuter: { alignItems: 'flex-start' },
  gisHidden: { display: 'none' },
  gisContainer: { minHeight: 44 },
  nativeButton: { width: '100%', height: 48, alignSelf: 'flex-start' },
  satir: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bilgiText: { color: '#94a3b8', fontSize: 13 },
  basariKutu: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(74,222,128,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.25)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  basariText: { color: '#4ade80', fontSize: 13, fontWeight: '600', flex: 1 },
  hataText: { color: '#f87171', fontSize: 12 },
});
