import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLibraryActions } from '../context/LibraryContext';
import { useBitisAniStore } from '../store/bitisAniStore';
import { notify } from '../utils/confirmDialog';

/**
 * Film kartlarının (mobil + masaüstü) TEK «izledim» akışı (2.6.8 BITIS-01).
 *
 * ESKİ HÂL: iki kart aynı mantığı kopya taşıyordu ve yazımı 1,2–1,4 sn
 * GECİKTİRİYORDU (yeşil «geçmişe eklendi» görünsün diye); ardından ekran
 * ayrı bir tebrik katmanı açıyordu. Şimdi yazım HEMEN yapılır; kartı
 * yerinde mavi «bitti» görünümünde tutan şey bitiş anı deposudur.
 */
export function useFilmIzle(data: any) {
  const { t } = useTranslation(['media', 'common']);
  const { markMovieAsWatched } = useLibraryActions();
  // Çift dokunuşta tek yazım (durum asenkron, ref anlık).
  const mesgul = useRef(false);

  return useCallback(async () => {
    const id = data?.id;
    if (mesgul.current || !id) return;
    mesgul.current = true;
    const { bitir, birak } = useBitisAniStore.getState();
    // Önce bitiş anı: kaydı ve sırasını iyimser yazım listeden silmeden saklar.
    bitir('movie', id);
    try {
      // 🔴 M421 (denetim E) — FİLM NESNESİ DE GEÇİYOR: iyimser «izlendi» girdisi
      // film izleme listesinde değilse ancak bununla kurulabiliyor.
      await markMovieAsWatched(id, data.raw || data.movie || null);
    } catch (e) {
      console.error(e);
      birak('movie', id);
      notify(t('common:error'), t('movieMarkError'));
    } finally {
      mesgul.current = false;
    }
  }, [data, markMovieAsWatched, t]);
}
