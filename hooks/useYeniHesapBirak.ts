import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { notify } from '../utils/confirmDialog';
import { yeniHesabiBirak } from '../features/feed/services/accountDeletion';
import { GOOGLE_GIRIS_ACIK } from '../utils/googleGirisBayragi';
import { kurulumKimliginiYenile } from '../services/api/telemetry';

/**
 * Kimlik Faz 4 (M515) · D4 — isim ekranındaki «Zaten hesabın var mı? Giriş yap».
 *
 * 🆕 M537 — ÖN SORGU KALKTI, KUTU DOĞRUDAN GÖRÜNÜR. Canlı bulgu (2026-10-18, ilk kez giren Google
 * hesabı `Geek_Evreni`): ekran açılınca atılan `/account/yeni-hesap/durum` 10 sn cevapsız kalıp zaman
 * aşımına düştü → kutu bütün oturum boyunca gizlendi (Worker aynı hesap için «bırakılabilir» diyordu).
 * Kullanıcı kararı: «Kullanıcı zaten isim ekranındaysa bu hesap yeni açılmış demektir… doğrudan göster;
 * sunucu yalnız butona basıldığında 1 saat kontrolünü yapsın.» Koşulun TEK yeri artık silme anı
 * (Worker `yeni-hesabi-birak`: onaysız + 1 saatten genç + izsiz; değilse 409 → uyarı, kutu gizlenir).
 * Aşağıdaki eski açıklama (ön sorgu) tarihsel kayıttır.
 *
 * (Eski) Link YALNIZ iki koşulda görünür:
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
  // M537: isim ekranında Google girişi açık ve gerçek bir oturum varsa kutu HEMEN görünür.
  const [reddedildi, setReddedildi] = useState(false);
  const gorunur = GOOGLE_GIRIS_ACIK && !!accessToken && !isGuest && !reddedildi;
  const [birakiliyor, setBirakiliyor] = useState(false);

  const birak = useCallback(async () => {
    if (!accessToken || birakiliyor) return;
    setBirakiliyor(true);
    try {
      await yeniHesabiBirak(accessToken);
    } catch (hata) {
      console.warn('[useYeniHesapBirak] bırakılamadı:', hata);
      // Sunucu reddetti (1 saat geçti / ad onaylandı / iz var) → kutu bu oturumda bir daha görünmez.
      setReddedildi(true);
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
