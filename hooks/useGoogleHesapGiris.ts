import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { createGoogleOnlyAccount } from '../services/api/googleAuth';
import { useAuth } from '../context/AuthContext';
import { logError } from '../utils/errorLog';

/**
 * Google ile giriş — giriş ekranındaki düğmenin mantığı (M501). Eskiden 7
 * dokunuşla açılan gizli ekrandaydı (BACKLOG §G1); kullanıcı 2026-10-12'de
 * perdeyi kaldırdı. Akış AYNEN o ekranınki:
 * `create_new` hesap YOKSA açar, VARSA (google_sub çakışması) mevcut hesaba
 * oturum verir — yani tek düğme hem kayıt hem giriş. Yeni hesap ilk girişte
 * isim ekranını görür (M492, `useAdOnayKapisi`).
 */
export function useGoogleHesapGiris() {
  const { saveGoogleSession } = useAuth();
  const router = useRouter();
  const { t } = useTranslation('common');
  const [durum, setDurum] = useState<'bos' | 'calisiyor'>('bos');
  const [hata, setHata] = useState<string | null>(null);

  const girisYap = async (idToken: string, nonce?: string) => {
    setHata(null);
    setDurum('calisiyor');
    try {
      // Native nonce ÜRETEMİYOR (`useGoogleNativeSignIn.ts` başlığı); Worker o
      // durumda replay kontrolünü atlayıp imza + süre doğruluyor.
      const sonuc = await createGoogleOnlyAccount(idToken, nonce ?? '');
      await saveGoogleSession(sonuc.sessionToken, {
        username: sonuc.username,
        avatarUrl: sonuc.avatarUrl,
      });
      router.replace('/(protected)/(tabs)/explore');
    } catch (error: any) {
      // AI_RULES §2: sessiz başarısızlık YASAK.
      logError('googleGiris.createGoogleOnly', error);
      setHata(t('accountCreateError', 'Hesap oluşturulamadı, tekrar dene.'));
      setDurum('bos');
    }
  };

  return { girisYap, durum, hata, setHata };
}
