import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { notify } from '../utils/confirmDialog';
import { traktBaglamaNiyetiTuket } from '../services/auth/baglamaNiyeti';
import { traktBagla, GirisYontemiHatasi } from '../services/api/girisYontemi';
import { hesapSecDurumuKoy } from '../store/hesapSecStore';
import { useOturumGecisi } from './useOturumGecisi';
import { girisOturumuAc } from '../services/auth/traktOturumu';
import { KasaHatasi, type TraktGirisi } from '../services/api/traktKasa';
import { girisYontemiHataMetni } from '../utils/girisYontemiHataMetni';

/**
 * Kimlik Faz 5 (M520) · D3 — giriş ekranı Trakt token'ını aldığında: «Trakt'ı bağla»
 * niyeti varsa ve oturum Google-only ise OTURUM AÇMAZ, `/bagla`'yı çağırır.
 *   bağlandı  → oturum yeni Trakt token'ına geçer (D2: Trakt'lı hesap Trakt ile girer)
 *   çakışma   → Hesap Seç ekranı (token'lar yalnız bellekte)
 *   hata      → Google oturumu AYNEN kalır, kişi Ayarlar'a döner
 * Dönüş `true` = token bu kanca tarafından tüketildi; `false` = normal giriş devam etsin.
 */
export function useTraktBaglamaTamamla() {
  const { accessToken, authProvider, isGuest } = useAuth();
  const gecis = useOturumGecisi();
  const router = useRouter();
  const { t } = useTranslation(['settings', 'common']);

  return useCallback(
    async (giris: TraktGirisi): Promise<boolean> => {
      const niyet = await traktBaglamaNiyetiTuket();
      if (!niyet || !accessToken || isGuest || authProvider !== 'google') return false;
      try {
        const sonuc = await traktBagla(accessToken, giris.erisim);
        if (sonuc.durum === 'cakisma') {
          hesapSecDurumuKoy({
            bilet: sonuc.bilet,
            yontem: sonuc.yontem,
            hesaplar: sonuc.hesaplar,
            yeniTrakt: { access: giris.erisim, kasaBileti: giris.kasaBileti },
          });
          router.replace('/(protected)/hesap-sec');
          return true;
        }
        const oturum = await girisOturumuAc(giris.erisim, giris.kasaBileti);
        await gecis(giris.erisim, oturum.kaymakOturum, oturum.userId);
        notify(t('settings:baglandiBaslik'), t('settings:traktBaglandiMetin'));
        router.replace('/(protected)/(tabs)/profile');
      } catch (e) {
        const kod = e instanceof GirisYontemiHatasi || e instanceof KasaHatasi ? e.kod : 'bilinmeyen';
        notify(t('common:error'), girisYontemiHataMetni(t, kod));
        router.replace('/(protected)/account-settings');
      }
      return true;
    },
    [accessToken, authProvider, isGuest, gecis, router, t]
  );
}
