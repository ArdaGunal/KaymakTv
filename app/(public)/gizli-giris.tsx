import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { GoogleSigninButton } from '@react-native-google-signin/google-signin';

import { ChevronLeft, Lock } from '../../components/icons';
import { useGoogleSignIn } from '../../hooks/useGoogleSignIn';
import { useGoogleNativeSignIn } from '../../hooks/useGoogleNativeSignIn';
import { createGoogleOnlyAccount } from '../../services/api/googleAuth';
import { useAuth } from '../../context/AuthContext';
import { logError } from '../../utils/errorLog';

/**
 * 🔒 GİZLİ GOOGLE GİRİŞİ — Faz T bitene kadar perde arkasında
 *
 * ==========================================================================
 * 🗑️ BU DOSYA SİLİNMEK ÜZERE YAZILDI
 * ==========================================================================
 * Google girişi 2026-08-23'te giriş ekranından KALDIRILMIŞTI çünkü
 * Google-only bir kullanıcının izlediklerini kaydedecek bir yer yoktu ve
 * uygulama ona "bozuk" görünüyordu (`GOOGLE_AUTH_MIGRATION.md` §1).
 *
 * Faz T (Tam Bağımsızlık) o veri katmanını kuruyor. O gün Google **normal
 * bir giriş düğmesi** olarak geri gelecek ve bu ekran silinecek. Bugün
 * yalnızca GELİŞTİRME/TEST için, vitrindeki markaya 7 kez basılarak
 * açılıyor (kullanıcı kararı, 2026-09-06).
 *
 * ⚠️ **PERDE, KİLİT DEĞİL.** Worker'ın `create_new` ucu herkese açık;
 * gerçek kilit sunucuda olurdu. Gerekçe `hooks/useSecretTap.ts` başlığında.
 *
 * 🗑️ Silme listesi: bu dosya · `hooks/useSecretTap.ts` · iki vitrindeki
 * `useSecretTap` çağrısı (`index.tsx`, `index.web.tsx`).
 *
 * ==========================================================================
 * 🟢 NEDEN AYRI ROTA — `(public)/settings.tsx`'e EKLENMEDİ
 * ==========================================================================
 * 1. **Kilitlenme tuzağı.** O ekranın `awaitingTraktLink` kapıları bilerek
 *    koşulsuz hâle getirilmişti; Google bloğunu geri koymak o tuzağı da
 *    geri getirirdi (`GOOGLE_AUTH_MIGRATION.md` §3'teki kırmızı uyarı).
 * 2. **`buttonElementId` çakışması.** `useGoogleSignIn` sabit bir DOM id
 *    kullanıyor; giriş ekranıyla Ayarlar aynı anda çizilirse çakışır. Ayrı
 *    rota olunca ikisi asla birlikte mount olmuyor.
 * 3. **Silmesi tek dosya.** Faz T bitince bu dosya gider, giriş ekranına
 *    hiç dokunulmamış olur.
 */

export default function GizliGirisScreen() {
  const isWeb = Platform.OS === 'web';
  return isWeb ? <GizliGirisWeb /> : <GizliGirisNative />;
}

// ── Ortak kabuk ────────────────────────────────────────────────────────────

function Kabuk({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { t } = useTranslation('common');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.replace('/')} style={styles.backButton} activeOpacity={0.8}>
          <ChevronLeft size={18} color="#cbd5e1" />
          <Text style={styles.backText}>{t('goBack', 'Geri')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.center}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Lock size={20} color="#fbbf24" />
          </View>

          <Text style={styles.title}>Google ile Giriş</Text>
          {/* 🔴 UYARI METNİ ÇEVRİLMEDİ — bilerek. Bu ekran son kullanıcıya
              açılmayacak ve i18n anahtarı eklemek, ekran silinince geride
              ölü çeviri bırakırdı. */}
          <Text style={styles.warning}>
            Bu ekran geçicidir ve yalnızca test içindir. Google ile açılan
            hesabın izleme verileri HENÜZ tutulmuyor — Kütüphane ve Takvim boş
            görünecek. Faz T tamamlanınca bu perde kalkacak.
          </Text>

          {children}
        </View>
      </View>
    </SafeAreaView>
  );
}

/** Hesap oluştuktan sonra ortak son adım — iki platform da buradan geçer. */
function useHesapOlustur() {
  const { saveGoogleSession } = useAuth();
  const router = useRouter();
  const [durum, setDurum] = useState<'bos' | 'calisiyor'>('bos');
  const [hata, setHata] = useState<string | null>(null);

  const olustur = async (idToken: string, nonce?: string) => {
    setHata(null);
    setDurum('calisiyor');
    try {
      // Native nonce ÜRETEMİYOR (bkz. `useGoogleNativeSignIn.ts` başlığı);
      // Worker o durumda replay kontrolünü atlayıp imza+süre doğruluyor.
      const sonuc = await createGoogleOnlyAccount(idToken, nonce ?? '');
      await saveGoogleSession(sonuc.sessionToken, {
        username: sonuc.username,
        avatarUrl: sonuc.avatarUrl,
      });
      router.replace('/(protected)/(tabs)/explore');
    } catch (error: any) {
      // AI_RULES §2: sessiz başarısızlık YASAK.
      logError('gizliGiris.createGoogleOnly', error);
      setHata(error?.message || 'Hesap oluşturulamadı.');
      setDurum('bos');
    }
  };

  return { olustur, durum, hata };
}

// ── Web ────────────────────────────────────────────────────────────────────

function GizliGirisWeb() {
  const { olustur, durum, hata } = useHesapOlustur();
  const { buttonElementId, loadError } = useGoogleSignIn((idToken, nonce) => {
    void olustur(idToken, nonce);
  });

  return (
    <Kabuk>
      {/* ⛔ BU KONTEYNERİ KOŞULLU YAPMAYIN — Madde 231'in dersi: GIS'in
          çizdiği buton unmount edilirse bir daha ASLA çizilmiyor. Durum
          mesajları konteynerin KARDEŞİ, sarmalayıcısı değil. */}
      <View style={[styles.gisOuter, durum !== 'bos' && styles.gisHidden]}>
        <View nativeID={buttonElementId} style={styles.gisContainer} />
      </View>

      {durum === 'calisiyor' && <Calisiyor />}
      {hata && <Text style={styles.error}>{hata}</Text>}
      {loadError && durum === 'bos' && <Text style={styles.error}>{loadError}</Text>}
    </Kabuk>
  );
}

// ── Native ─────────────────────────────────────────────────────────────────

function GizliGirisNative() {
  const { olustur, durum, hata } = useHesapOlustur();
  const { signIn } = useGoogleNativeSignIn();
  const [yerelHata, setYerelHata] = useState<string | null>(null);

  const bas = async () => {
    setYerelHata(null);
    const sonuc = await signIn();
    if (!sonuc.ok) {
      // Kullanıcının kendi iptali HATA değil — kırmızı metin gösterme.
      if (!sonuc.cancelled) {
        logError('gizliGiris.native.signIn', new Error(sonuc.message));
        setYerelHata(sonuc.message);
      }
      return;
    }
    await olustur(sonuc.idToken);
  };

  return (
    <Kabuk>
      {durum === 'bos' && (
        <GoogleSigninButton
          size={GoogleSigninButton.Size.Wide}
          color={GoogleSigninButton.Color.Dark}
          onPress={bas}
          style={styles.nativeButton}
        />
      )}
      {durum === 'calisiyor' && <Calisiyor />}
      {(hata || yerelHata) && <Text style={styles.error}>{hata || yerelHata}</Text>}
    </Kabuk>
  );
}

function Calisiyor() {
  return (
    <View style={styles.row}>
      <ActivityIndicator size="small" color="#94a3b8" />
      <Text style={styles.info}>Hesabın oluşturuluyor…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0e131d' },
  topBar: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { color: '#cbd5e1', fontSize: 14, fontWeight: '600' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#111827',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 24,
    gap: 14,
    alignItems: 'center',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(251,191,36,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: '#f8fafc', fontSize: 18, fontWeight: '800' },
  warning: { color: '#94a3b8', fontSize: 13, lineHeight: 19, textAlign: 'center' },

  gisOuter: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  gisHidden: { opacity: 0, height: 0 },
  gisContainer: { minHeight: 44 },
  nativeButton: { width: 240, height: 48 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  info: { color: '#94a3b8', fontSize: 13 },
  error: { color: '#f87171', fontSize: 13, textAlign: 'center' },
});
