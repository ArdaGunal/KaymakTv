import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { notify } from '../utils/confirmDialog';
import { yeniHesapBirakilabilir, yeniHesabiBirak } from '../features/feed/services/accountDeletion';
import { GOOGLE_GIRIS_ACIK } from '../utils/googleGirisBayragi';
import { kurulumKimliginiYenile } from '../services/api/telemetry';

/**
 * Kimlik Faz 4 (M515) · D4 — isim ekranındaki «Zaten hesabın var mı? Giriş yap».
 *
 * Link YALNIZ iki koşulda görünür:
 *  1. Google girişi açık (`GOOGLE_GIRIS_ACIK`; bugün yalnız --google-test APK'sı, D10).
 *     Kapalıyken giriş ekranında tek yol Trakt — bırakılan kişi Trakt ile yine YENİ
 *     hesaba düşerdi; link işe yaramaz, zarar verirdi.
 *  2. Worker «bırakılabilir» der (onaysız + 1 saatten genç + elle üretilmiş iz yok).
 *     Kurallardan önce açılmış, adı kural dışı ESKİ hesaplar da bu ekrana gelir —
 *     onlarda link görünmez (sunucu kararı).
 * Basınca Worker siler → çıkış (`removeKeys`: yerel Google oturumu da kapanır, hesap seçici
 * sıfırlanır) → temiz giriş ekranı.
 * 🆕 GIRIS-TASARIM-01 (M536) — ONAY SORUSU KALKTI. Kullanıcı (2026-10-18): «bu bağlantıya bastığı
 * anda `yeni_hesabi_birak` çalışsın». Güvenli: Worker yalnız onaysız + 1 saatten genç + elle
 * üretilmiş izi olmayan hesabı siler (`yeniHesap` 18/18); dolu bir hesap bu yoldan silinemez.
 */
export function useYeniHesapBirak() {
  const { accessToken, isGuest, removeKeys } = useAuth();
  const router = useRouter();
  const { t } = useTranslation(['settings', 'common']);
  const [gorunur, setGorunur] = useState(false);
  const [birakiliyor, setBirakiliyor] = useState(false);

  useEffect(() => {
    if (!GOOGLE_GIRIS_ACIK || !accessToken || isGuest) return;
    let canli = true;
    yeniHesapBirakilabilir(accessToken)
      .then((evet) => canli && setGorunur(evet))
      .catch(() => canli && setGorunur(false));
    return () => { canli = false; };
  }, [accessToken, isGuest]);

  const birak = useCallback(async () => {
    if (!accessToken || birakiliyor) return;
    setBirakiliyor(true);
    try {
      await yeniHesabiBirak(accessToken);
    } catch (hata) {
      console.warn('[useYeniHesapBirak] bırakılamadı:', hata);
      setGorunur(false);
      setBirakiliyor(false);
      notify(t('common:error'), t('settings:yeniHesapBirakHata'));
      return;
    }
    // Sunucuda hesap YOK artık — yerel oturum da kapanır (D8: çıkış denetimi Faz 4d).
    try {
      await removeKeys();
      // DISCORD-01 (M529): hesap silindi → kurulum kimliği de yenilenir.
      await kurulumKimliginiYenile();
    } catch (hata) {
      console.error('[useYeniHesapBirak] çıkış:', hata);
    }
    setBirakiliyor(false);
    router.replace('/settings');
  }, [accessToken, birakiliyor, removeKeys, router, t]);

  return { gorunur, birakiliyor, birak };
}
