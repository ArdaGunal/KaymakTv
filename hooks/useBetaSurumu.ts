import { useEffect, useState } from 'react';
import { fetchBetaRelease, type BetaApk } from '../services/github';
import { GITHUB_RELEASES_URL } from '../utils/constants';

/**
 * İndirme sayfasının (`app/(public)/download.web.tsx`) veri kancası: GitHub «beta»
 * sürümünün notları + indirilecek APK. APK bulunamazsa ya da istek düşerse
 * düğme 404'e değil sürüm sayfasına gider (orada dosya her zaman listelenir).
 */
export function useBetaSurumu() {
  const [notlar, setNotlar] = useState('');
  const [apk, setApk] = useState<BetaApk | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState(false);

  useEffect(() => {
    let iptal = false;
    fetchBetaRelease()
      .then((s) => {
        if (iptal) return;
        setNotlar(s.notlar);
        setApk(s.apk);
        setHata(false);
      })
      .catch((e) => {
        console.error('Beta sürümü çekilemedi:', e);
        if (!iptal) setHata(true);
      })
      .finally(() => { if (!iptal) setYukleniyor(false); });
    return () => { iptal = true; };
  }, []);

  return {
    notlar,
    yukleniyor,
    hata,
    /** Düğmenin açacağı adres: APK'nın kendisi, yoksa sürüm sayfası. */
    indirmeAdresi: apk?.url ?? GITHUB_RELEASES_URL,
    /** «~90 MB»; bilinmiyorsa `null`. */
    boyutMetni: apk?.boyut ? `~${Math.round(apk.boyut / (1024 * 1024))} MB` : null,
  };
}
