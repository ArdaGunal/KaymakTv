import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { getMyProfile } from '../features/feed/services/profile';
import { googleBagla, GirisYontemiHatasi } from '../services/api/girisYontemi';
import { traktBaglamaNiyetiYaz } from '../services/auth/baglamaNiyeti';
import { hesapSecDurumuKoy } from '../store/hesapSecStore';
import { notify } from '../utils/confirmDialog';
import { girisYontemiHataMetni } from '../utils/girisYontemiHataMetni';
import { useBagliTraktHesabi } from './useBagliTraktHesabi';

/**
 * Kimlik Faz 5 (M520) · D3 — Ayarlar → «Giriş yöntemleri».
 * Durum sunucudan (`googleBagli`/`traktBagli`); oturum türü yedek (Worker eskiyse).
 *  - Google-only → «Trakt'ı bağla»: niyet yazılır, giriş ekranında Trakt OAuth; token oturum
 *    AÇMAZ, `/bagla`'ya gider (`useTraktBaglamaTamamla`).
 *  - Trakt'lı → «Google'ı bağla» (yalnız Google girişi açıkken): ID token → `/bagla`.
 * Çakışma → Hesap Seç ekranı.
 */
export function useGirisYontemleri() {
  const { accessToken, authProvider, isGuest } = useAuth();
  const router = useRouter();
  const { t } = useTranslation(['settings', 'common']);
  const [sunucu, setSunucu] = useState<{ googleBagli: boolean; traktBagli: boolean } | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);
  const traktAdi = useBagliTraktHesabi(authProvider === 'trakt');

  const tazele = useCallback(() => {
    if (!accessToken || isGuest) return;
    getMyProfile(accessToken)
      .then((p) => setSunucu({ googleBagli: p.googleBagli, traktBagli: p.traktBagli }))
      .catch(() => setSunucu(null));
  }, [accessToken, isGuest]);
  useEffect(tazele, [tazele]);

  const traktBagli = sunucu?.traktBagli || authProvider === 'trakt';
  const googleBagli = sunucu?.googleBagli || authProvider === 'google';

  const traktBaglaBaslat = useCallback(async () => {
    await traktBaglamaNiyetiYaz();
    router.push('/(public)/settings');
  }, [router]);

  const googleIleBagla = useCallback(
    async (idToken: string, nonce?: string) => {
      if (!accessToken || calisiyor) return;
      setCalisiyor(true);
      try {
        const s = await googleBagla(accessToken, idToken, nonce);
        if (s.durum === 'cakisma') {
          hesapSecDurumuKoy({ bilet: s.bilet, yontem: s.yontem, hesaplar: s.hesaplar });
          router.push('/(protected)/hesap-sec');
        } else {
          notify(t('settings:baglandiBaslik'), t('settings:googleBaglandiMetin'));
          tazele();
        }
      } catch (e) {
        notify(t('common:error'), girisYontemiHataMetni(t, e instanceof GirisYontemiHatasi ? e.kod : 'bilinmeyen'));
      } finally {
        setCalisiyor(false);
      }
    },
    [accessToken, calisiyor, router, t, tazele]
  );

  return { traktBagli, googleBagli, traktAdi, calisiyor, traktBaglaBaslat, googleIleBagla };
}
