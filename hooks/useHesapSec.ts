import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import * as SecureStore from '../utils/secureStorage';
import { notify } from '../utils/confirmDialog';
import { girisYontemiHataMetni } from '../utils/girisYontemiHataMetni';
import { hesapSec, GirisYontemiHatasi } from '../services/api/girisYontemi';
import { useHesapSecStore, hesapSecDurumuTemizle } from '../store/hesapSecStore';
import { useOturumGecisi } from './useOturumGecisi';
import { useBekleyenIsOnayi } from './useBekleyenIsOnayi';
import { kurulumKimliginiYenile } from '../services/api/telemetry';

export type HesapSecimi = 'mevcut' | 'diger';

/**
 * Kimlik Faz 5 (M520) · D3 — «Hesap Seç» akışı: seç → 2. uyarı ekranı → kaydırarak onay →
 * Worker (068, tek işlem) → oturum. Sunucunun söylediği sonraki oturum:
 *   yeni_trakt     → az önce alınan Trakt token'ına geç (bağlanan hesap Trakt'lı, D2)
 *   ayni           → kalan BEN isem değişmez; değilsem aynı Trakt token'ı artık kalana çözülür
 *                    → yine de tam geçiş (users.id değişti; kimlik önbellekleri temizlensin)
 *   trakt_ile_gir  → kalan hesabın KENDİ Trakt'ı var (bu oturumda kanıtlanmadı) → çıkış + giriş ekranı
 */
export function useHesapSec() {
  const durum = useHesapSecStore((s) => s.durum);
  const { accessToken, removeKeys } = useAuth();
  const gecis = useOturumGecisi();
  const bekleyenIsOnayi = useBekleyenIsOnayi();
  const router = useRouter();
  const { t } = useTranslation(['settings', 'common']);
  const [secim, setSecim] = useState<HesapSecimi | null>(null);
  const [adim, setAdim] = useState<'sec' | 'uyari'>('sec');
  const [kaydirildi, setKaydirildi] = useState(false);
  const [calisiyor, setCalisiyor] = useState(false);

  const devam = useCallback(() => { if (secim) { setKaydirildi(false); setAdim('uyari'); } }, [secim]);
  const geri = useCallback(() => { setKaydirildi(false); setAdim('sec'); }, []);
  const vazgec = useCallback(() => {
    hesapSecDurumuTemizle();
    router.replace('/(protected)/account-settings');
  }, [router]);

  const onayla = useCallback(async () => {
    if (!durum || !secim || !accessToken || !kaydirildi || calisiyor) return;
    // M525 (d): silme/oturum geçişinden ÖNCE — bekleyen çevrimdışı iş varsa sessizce yanmasın.
    if (!(await bekleyenIsOnayi())) return;
    setCalisiyor(true);
    try {
      const r = await hesapSec(accessToken, durum.bilet, secim);
      // DISCORD-01 (M529): Hesap Seç bir hesabı sildi → kurulum kimliği yenilenir.
      await kurulumKimliginiYenile();
      const yeni = durum.yeniTrakt;
      hesapSecDurumuTemizle();
      if (r.oturum === 'trakt_ile_gir' || (r.oturum === 'yeni_trakt' && !yeni)) {
        await removeKeys();
        notify(t('settings:hesapSecTamamBaslik'), t('settings:hesapSecTraktIleGir'));
        router.replace('/(public)/settings');
        return;
      }
      if (r.oturum === 'yeni_trakt' && yeni) {
        await gecis(yeni.access, yeni.refresh);
      } else if (!r.kalanBenMiyim) {
        const refresh = (await SecureStore.getItemAsync('traktRefreshToken')) ?? '';
        await gecis(accessToken, refresh);
      }
      notify(t('settings:hesapSecTamamBaslik'), t('settings:hesapSecTamamMetin'));
      router.replace('/(protected)/(tabs)/profile');
    } catch (e) {
      const kod = e instanceof GirisYontemiHatasi ? e.kod : 'bilinmeyen';
      notify(t('common:error'), girisYontemiHataMetni(t, kod));
      setCalisiyor(false);
      if (kod === 'durum_degisti' || kod === 'bilet_gecersiz') vazgec();
    }
  }, [durum, secim, accessToken, kaydirildi, calisiyor, removeKeys, gecis, router, t, vazgec, bekleyenIsOnayi]);

  return { durum, secim, setSecim, adim, devam, geri, vazgec, kaydirildi, setKaydirildi, calisiyor, onayla };
}
