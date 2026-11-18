import { useCallback, useRef } from 'react';
import { useFeedStore } from '../store/feedStore';
import { gorunenAktiviteKimlikleri } from '../services/gorunurlukSorgusu';
import { invalidateFeedCache, invalidateUserFeedActivitiesCache } from '../services/feedApi';
import { dogrulanacakKimlikler, dusenKimlikler } from '../utils/gorunurlukDogrulama';
import { useOneGelince } from './useOneGelince';

/**
 * Akıştaki kartların görünürlüğünü öne gelişte ve ağa dönüşte sunucuyla eşitler (Moderasyon Faz 6 · MD06).
 *
 * NEDEN AYRI: `useFeed`'in öne geliş yakalaması (M470) yalnız taze 1. sayfanın kapsadığı aralığı
 * düzeltir; kaydırılıp yüklenmiş eski kartlar dokunulmadan kalır. Moderatörün gizlediği kart o
 * aralıktaysa ekranda kalırdı. Burada listedeki BÜTÜN gerçek kimlikler sorulur.
 *
 * Disk kopyası (`kaynak === 'disk'`) sorulmaz: ağdan gelen ilk sayfa (`setFirstPage`) onu zaten
 * bütünüyle değiştirir. Çevrimdışı açılışta disk kopyası doğrulanamaz — bilinen sınır (FAZ_6.md).
 */
export function useAkisGorunurlukDogrulama(etkin: boolean): () => Promise<number> {
  const ucusta = useRef(false);

  const dogrula = useCallback(async (): Promise<number> => {
    const store = useFeedStore.getState();
    if (ucusta.current || !store.isHydrated || store.kaynak !== 'ag') return 0;
    const sorulan = dogrulanacakKimlikler(store.activities.map((a) => a.id));
    if (sorulan.length === 0) return 0;

    ucusta.current = true;
    try {
      const donen = await gorunenAktiviteKimlikleri(sorulan);
      const dusen = new Set(dusenKimlikler(sorulan, donen));
      if (dusen.size === 0) return 0;
      useFeedStore.getState().removeActivitiesWhere((a) => dusen.has(a.id));
      // Profil ve akış önbellekleri de aynı kartı taşıyor olabilir: bir sonraki açılışta sunucudan okunsun.
      invalidateFeedCache();
      invalidateUserFeedActivitiesCache();
      return dusen.size;
    } catch (error) {
      // Sorgu düştüyse HİÇBİR kart düşmez (yarım sonuçla görünür kart silinmesin).
      console.warn('[Feed] Görünürlük doğrulaması başarısız:', error);
      return 0;
    } finally {
      ucusta.current = false;
    }
  }, []);

  useOneGelince(() => void dogrula(), etkin);
  return dogrula;
}
