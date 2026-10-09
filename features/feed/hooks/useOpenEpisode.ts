import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { getEpisodeDetail } from '../../../services/api/shows';
import { generateEpisodeSlug } from '../../../utils/slugHelper';

/** «S01E24» → { season: 1, episode: 24 }; biçim dışıysa null. */
export function parseEpisodeCode(code?: string | null): { season: number; episode: number } | null {
  const m = /^S(\d+)E(\d+)$/i.exec((code ?? '').trim());
  return m ? { season: Number(m[1]), episode: Number(m[2]) } : null;
}

/**
 * C2 · Akış kaydından bölüm sayfasına git. Akış satırı bölümün Trakt
 * kimliğini taşımıyor, ama bölüm sayfasının işaretle/puanla eylemleri o
 * kimliği slug'dan okuyor (`useEpisodeActions` — 0 ile açmak puanı yanlış
 * yere yazardı). Bu yüzden önce mevcut katalog-öncelikli `getEpisodeDetail`
 * ile kimlik çözülür, sonra gerçek slug'la gidilir. Çözülemezse dizi sayfası.
 */
export function useOpenEpisode() {
  const router = useRouter();
  const [isOpening, setIsOpening] = useState(false);

  const openEpisode = useCallback(
    async (
      a: { showId?: number; showTitle?: string; tmdbId?: number; episodeNumber?: string },
      fallback: () => void,
      /** C4 · ek sorgu parametreleri (ör. `{ yorum: id }`). */
      ekSorgu: Record<string, string> = {}
    ) => {
      const kod = parseEpisodeCode(a.episodeNumber);
      if (!a.showId || !kod || isOpening) return fallback();
      setIsOpening(true);
      try {
        const ep = await getEpisodeDetail(a.showId, kod.season, kod.episode);
        const epId = Number(ep?.ids?.trakt);
        if (!epId) return fallback();
        const slug = generateEpisodeSlug(a.showId, undefined, a.showTitle, kod.season, kod.episode, epId);
        const sorgu = new URLSearchParams({ ...(a.tmdbId ? { showTmdbId: String(a.tmdbId) } : {}), ...ekSorgu }).toString();
        router.push(`/episode/${slug}${sorgu ? `?${sorgu}` : ''}` as any);
      } catch (error) {
        console.warn('[Feed] Bölüm sayfası çözülemedi, dizi sayfasına gidiliyor:', error);
        fallback();
      } finally {
        setIsOpening(false);
      }
    },
    [router, isOpening]
  );

  return { openEpisode, isOpening };
}
