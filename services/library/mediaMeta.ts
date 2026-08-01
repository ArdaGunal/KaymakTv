import { useLibraryStore } from '../../store/useLibraryStore';

/**
 * Bir dizi/filmin görsel meta verisi (başlık + tmdb id), kullanıcının kendi
 * kütüphane dilimlerinden çözülür.
 *
 * NEDEN VAR: Akış'a anında yayın yaparken kartı çizebilmek için başlık ve
 * poster (tmdb id) gerekiyor. Bu bilgiyi her çağrı noktasından prop olarak
 * geçirmek, ilgisiz 6 ekranın imzasını Akış yüzünden değiştirmek anlamına
 * gelirdi. Kullanıcı zaten izlediği/puanladığı bir yapıma dokunuyor, yani
 * yapım tanım gereği kütüphane dilimlerinden birinde mevcut — tek bir yerden
 * okumak hem daha az kod hem de her çağıran için tutarlı.
 *
 * Bulunamazsa boş başlık döner; yayın katmanı başlıksız aktiviteyi hiç
 * göndermez (Worker da reddederdi) — yanlış/eksik bir kart çizmektense hiç
 * çizmemek doğrudur, bir sonraki tam senkron onu Trakt'ın kanonik verisiyle
 * zaten getirir.
 */
export interface MediaMeta {
  title: string;
  tmdbId?: number;
}

export function resolveMediaMeta(traktId: number, type: 'show' | 'movie'): MediaMeta {
  const state = useLibraryStore.getState();

  const pools: any[][] =
    type === 'movie'
      ? [state.watchedMovies || [], state.watchlistMovies || [], state.favMovies || []]
      : [state.watchedShows || [], state.watchlistShows || [], state.favShows || []];

  const key = type === 'movie' ? 'movie' : 'show';
  for (const pool of pools) {
    const entry = pool.find((item: any) => item?.[key]?.ids?.trakt === traktId);
    if (entry?.[key]?.title) {
      return { title: entry[key].title, tmdbId: entry[key]?.ids?.tmdb };
    }
  }
  return { title: '' };
}
