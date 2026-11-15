import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { kullaniciAdiOnerisiAl } from '../features/feed/services/profile';
import { logError } from '../utils/errorLog';

/** Kullanıcı yazmayı bıraktıktan sonra bekleme — her tuşta Worker'a istek gitmesin (kullanıcı, 2026-11-15). */
export const ONERI_GECIKMESI_MS = 300;

/** Bir önerinin AİT OLDUĞU istek: yenileme turu + oturum + görünen ad. */
type Sonuc = { anahtar: string; ad: string | null };

/**
 * 1.0.1 Dal 1 (K4) — isim ekranında görünen addan `@kullanıcı_adı` önerisi.
 *
 * - `gorunenAd` `null` iken (geçersiz ad ya da kullanıcı adını elle düzenliyor) istek yok.
 * - Her yeni değerde önceki zamanlayıcı ve uçuştaki istek İPTAL edilir.
 * - 🔴 Sonuç ANAHTARLIDIR (bağımsız denetim bulgusu 4, 2026-11-15): yalnız GÜNCEL girdi +
 *   oturum + yenileme turuna ait BAŞARILI öneri döner. Eskiden hata dalı eski öneriyi
 *   silmiyordu: «Arda» → `Arda_TV`, sonra «Mehmet» isteği düşünce `Arda_TV` kalıyor ve
 *   «Devam» açılıyordu; aynısı `taken` sonrası başarısız yenilemede ve oturum değişince.
 * - Hata: `ad = null`, `hata = true` → ekran hesabın bugünkü adına döner (plan: mevcut ad
 *   yedeği). İz `logError`'da; kullanıcının başlattığı bir eylem değil, kayıt hatası ayrıca görünür.
 * - `yenile`: kayıt düşünce (çoğunlukla `taken`) yeni tur — eski turun önerisi geçersizleşir.
 */
export function useKullaniciAdiOnerisi(gorunenAd: string | null) {
  const { accessToken } = useAuth();
  const [tur, setTur] = useState(0);
  const [sonuc, setSonuc] = useState<Sonuc | null>(null);
  const anahtar = gorunenAd && accessToken ? JSON.stringify([tur, accessToken, gorunenAd]) : null;

  useEffect(() => {
    if (!anahtar || !gorunenAd || !accessToken) return;
    const denetci = new AbortController();
    const zamanlayici = setTimeout(async () => {
      try {
        const ad = await kullaniciAdiOnerisiAl(accessToken, gorunenAd, denetci.signal);
        if (!denetci.signal.aborted) setSonuc({ anahtar, ad });
      } catch (e) {
        if (denetci.signal.aborted) return;
        logError('hooks.useKullaniciAdiOnerisi', e);
        setSonuc({ anahtar, ad: null });
      }
    }, ONERI_GECIKMESI_MS);
    return () => {
      clearTimeout(zamanlayici);
      denetci.abort();
    };
  }, [anahtar, gorunenAd, accessToken]);

  const guncel = sonuc !== null && sonuc.anahtar === anahtar;
  const yenile = useCallback(() => setTur((n) => n + 1), []);
  return {
    ad: guncel ? sonuc.ad : null,
    yukleniyor: anahtar !== null && !guncel,
    hata: guncel && sonuc.ad === null,
    yenile,
  };
}
