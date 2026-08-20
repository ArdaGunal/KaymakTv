import { useEffect, useState } from 'react';
import { getTrendingShows, getTrendingMovies } from '../../services/traktApi';
import { getShowPoster, getMoviePoster } from '../../services/tmdbApi';

// F12 — index.web.tsx'teki TEK büyük useEffect'ten çıkarıldı. O effect dört
// ayrı kaygıyı (nav rengi, reveal fade-in, istatistik sayacı, trend çekme)
// tek bloğa karıştırıyordu — AI_RULES §1'in "spagetti kod" dediği örnek.
// Dördü birbirinden bağımsız, ayrı temizlik (cleanup) gerektiriyor.

/** Sayfa 40px'ten fazla kaydırılınca nav bar'ın arka planını koyulaştırır. */
export function useNavScrollStyle() {
  const [navStyle, setNavStyle] = useState({ background: 'rgba(11,17,32,.72)' });

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 40) {
        setNavStyle({ background: 'rgba(11,17,32,.92)' });
      } else {
        setNavStyle({ background: 'rgba(11,17,32,.72)' });
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return navStyle;
}

/**
 * `.reveal` sınıflı elemanlar görünüme girince `.in-view` ekleyip fade-in
 * animasyonunu tetikler. Sınıf adları `index.web.styles.ts`'teki CSS ile
 * SÖZLEŞME içinde — biri değişirse diğeri de değişmeli.
 */
export function useScrollRevealObserver() {
  useEffect(() => {
    const revealEls = document.querySelectorAll('.reveal');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in-view');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    revealEls.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

/**
 * İstatistik paneli görünüme girince sayaçları (`.stat-num`) ve bar
 * grafiklerini (`.bar-fill`) animasyonla doldurur — yalnızca BİR KEZ
 * (`statsPlayed` kilidi).
 */
export function useStatsCounterAnimation() {
  useEffect(() => {
    const statsPanel = document.querySelector('.stats-panel');
    let statsPlayed = false;
    const statsIO = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && !statsPlayed) {
            statsPlayed = true;
            document.querySelectorAll('.stat-num').forEach((el: any) => {
              const target = parseInt(el.dataset.count, 10);
              const duration = 1400;
              const start = performance.now();
              function tick(now: number) {
                const p = Math.min((now - start) / duration, 1);
                const eased = 1 - Math.pow(1 - p, 3);
                el.textContent = Math.round(eased * target).toString();
                if (p < 1) requestAnimationFrame(tick);
              }
              requestAnimationFrame(tick);
            });
            document.querySelectorAll('.bar-fill').forEach((el: any) => {
              requestAnimationFrame(() => {
                el.style.width = el.dataset.pct + '%';
              });
            });
          }
        });
      },
      { threshold: 0.4 }
    );
    if (statsPanel) statsIO.observe(statsPanel);
    return () => statsIO.disconnect();
  }, []);
}

/** Trend dizi/film kartlarını (poster'larıyla birlikte) çeker, marquee şeridi
 * kesintisiz dönsün diye listeyi ikiye katlar. */
export function useTrendingMedia() {
  const [trendingMedia, setTrendingMedia] = useState<any[]>([]);

  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const [shows, movies] = await Promise.all([
          getTrendingShows(1, 10),
          getTrendingMovies(1, 10),
        ]);

        // Paralel: her poster isteği bağımsız bir ağ çağrısı, sıralı `await`
        // 20 istek boyunca birbirini bekletip ilk render'ı gereksiz geciktiriyordu.
        const [showResults, movieResults] = await Promise.all([
          Promise.all(
            shows.map(async (item: any) => ({
              id: item.show.ids.trakt,
              title: item.show.title,
              poster: await getShowPoster(item.show.ids.tmdb),
              type: 'Dizi' as const,
            }))
          ),
          Promise.all(
            movies.map(async (item: any) => ({
              id: item.movie.ids.trakt,
              title: item.movie.title,
              poster: await getMoviePoster(item.movie.ids.tmdb),
              type: 'Film' as const,
            }))
          ),
        ]);
        const combined = [...showResults, ...movieResults].filter((m) => m.poster);

        const shuffled = combined.sort(() => 0.5 - Math.random());
        setTrendingMedia([...shuffled, ...shuffled]); // Duplicate for marquee
      } catch (e) {
        console.error('Landing page trending error:', e);
      }
    };
    fetchTrending();
  }, []);

  return trendingMedia;
}
