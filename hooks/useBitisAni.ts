import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLibraryActions } from '../context/LibraryContext';
import { useLibraryStore } from '../store/useLibraryStore';
import { useBitisAniStore, type BitisTuru } from '../store/bitisAniStore';
import { diziBitisOzeti, filmBitisOzeti, sureParcalari } from '../utils/bitisOzeti';
import { notify } from '../utils/confirmDialog';

/**
 * Bitiş anı kartının (2.6.8 BITIS-01) mantığı: özet metni, mevcut puan ve
 * «Puanla». Puan penceresi açıkken kart listeden kaymaz (süre durur).
 * Bileşen (`BitisIcerigi`) yalnız çizer.
 */
export function useBitisAni(tur: BitisTuru, id: number, ad: string, film?: any) {
  const { t } = useTranslation(['media', 'common']);
  const { rateMedia } = useLibraryActions();
  const { duraklat, devam } = useBitisAniStore.getState();

  // Seçiciler yalnız sabit başvuru / ilkel döndürür (her çizimde yeni nesne yok).
  const ilerleme = useLibraryStore((s) => (tur === 'show' ? s.showProgressMap[id] : undefined));
  const bolumSuresi = useLibraryStore((s) => (tur === 'show'
    ? s.watchedShows.find((w: any) => w?.show?.ids?.trakt === id)?.show?.runtime ?? null
    : null));
  // Film süresi izleme listesi kaydında YOK (sunucu göndermiyor); izlenen film
  // kaydı yazımdan ~1-3 sn sonra `/library/sync` ile süresiyle gelir (emü ölçümü).
  const filmSuresi = useLibraryStore((s) => (tur === 'movie'
    ? s.watchedMovies.find((w: any) => w?.movie?.ids?.trakt === id)?.movie?.runtime ?? null
    : null));
  const puan: number | null = useLibraryStore((s) => (tur === 'show'
    ? s.userRatingsShows?.find((r: any) => r?.show?.ids?.trakt === id)?.rating
    : s.userRatingsMovies?.find((r: any) => r?.movie?.ids?.trakt === id)?.rating) ?? null);

  const ozetMetni = useMemo(() => {
    const o = tur === 'show' ? diziBitisOzeti(ilerleme, bolumSuresi) : filmBitisOzeti({ runtime: filmSuresi ?? film?.runtime });
    const parcalar: string[] = [];
    if (o.bolum) parcalar.push(t('bitisBolum', { count: o.bolum }));
    if (o.dakika) {
      const { sa, dk } = sureParcalari(o.dakika);
      parcalar.push(sa === 0 ? t('bitisDakika', { dk }) : dk === 0 ? t('bitisSaat', { sa }) : t('bitisSaatDakika', { sa, dk }));
    }
    if (o.gun) parcalar.push(t('bitisGun', { count: o.gun }));
    return parcalar.join(' · ');
  }, [tur, ilerleme, bolumSuresi, filmSuresi, film, t]);

  const [puanAcik, setPuanAcik] = useState(false);
  const mesgul = useRef(false);

  const puanlaAc = () => {
    duraklat(tur, id);
    setPuanAcik(true);
  };
  const puanKapat = () => {
    setPuanAcik(false);
    devam(tur, id);
  };
  const puanVer = async (deger: number) => {
    if (mesgul.current) return;
    mesgul.current = true;
    try {
      await rateMedia(id, tur, deger, { title: ad });
    } catch (e) {
      console.error(e);
      notify(t('common:error'), t('common:ratingSaveError'));
    } finally {
      mesgul.current = false;
      puanKapat();
    }
  };

  return {
    baslik: t(tur === 'show' ? 'bitisDizi' : 'bitisFilm'),
    ozetMetni,
    puan,
    puanAcik,
    puanlaAc,
    puanKapat,
    puanVer,
  };
}
