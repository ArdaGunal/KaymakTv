/**
 * "Kaldığın yerden devam" için aday dizi seçimi
 * (docs/design/notifications.md § 13).
 *
 * 🔴 YENİ AĞ İSTEĞİ YOK. Girdiler `store/useLibraryStore.ts`'in ZATEN bellekte
 * tuttuğu `watchedShows` ve `showProgressMap` — kütüphane senkronu bunları
 * kendi işi için çekiyor (`services/library/fetchers.ts`).
 *
 * 🔴 SAF: çalışma zamanı import'u yok (gerekçe: `fireTime.ts` başlığı).
 */

/** Dürtmenin ihtiyaç duyduğu MİNİMUM bilgi. */
export interface ResumeCandidate {
  showTitle: string;
  showTraktId: number;
  /** Kullanıcının izleyeceği SIRADAKİ bölüm. */
  seasonNumber: number;
  episodeNumber: number;
  /** Deep link için; Trakt bazen bölüm kimliği vermez. */
  nextEpisodeTraktId: number | null;
  lastWatchedAtMs: number;
}

const toMs = (value: unknown): number => {
  if (typeof value !== 'string') return 0;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? 0 : ms;
};

/**
 * En son izlenen, HENÜZ BİTMEMİŞ diziyi seçer.
 *
 * NEDEN "en son izlenen": kullanıcının zihninde en taze olan hikâye odur.
 * Aylar önce bıraktığı bir diziyi hatırlatmak, dürtmeyi alakasız kılar ve
 * kapatılma sebebi olur.
 *
 * @param watchedShows   `/sync/watched/shows` yanıtı (dizi başlığı buradan)
 * @param showProgressMap `/shows/:id/progress/watched` sonuçları, id → progress
 * @param hiddenShowIds  Kullanıcının gizlediği diziler — dürtme de gelmemeli
 */
export function pickResumeCandidate(
  watchedShows: readonly unknown[],
  showProgressMap: Record<string, unknown>,
  hiddenShowIds: readonly number[],
): ResumeCandidate | null {
  const hidden = new Set(hiddenShowIds);
  let best: ResumeCandidate | null = null;

  for (const raw of watchedShows) {
    const item = raw as {
      show?: { title?: string; ids?: { trakt?: number } };
      last_watched_at?: string;
    };

    const showTraktId = item?.show?.ids?.trakt;
    const showTitle = item?.show?.title;
    if (typeof showTraktId !== 'number' || typeof showTitle !== 'string') continue;
    if (hidden.has(showTraktId)) continue;

    const progress = showProgressMap[String(showTraktId)] as
      | {
          next_episode?: { season?: number; number?: number; ids?: { trakt?: number } } | null;
          last_watched_at?: string;
        }
      | undefined;

    // `next_episode` yoksa dizi BİTMİŞ (ya da yeni bölüm beklemiyor) —
    // "kaldığın yer" diye bir şey yok. Bitmiş diziyi hatırlatmak sistemi
    // yalancı çıkarır.
    const next = progress?.next_episode;
    if (!next || typeof next.season !== 'number' || typeof next.number !== 'number') continue;

    // 0. sezon "Specials"tır; ana hikâyenin devamı değildir ve "kaldığın yer"
    // olarak sunmak yanıltıcı olur.
    if (next.season <= 0) continue;

    const lastWatchedAtMs = Math.max(
      toMs(progress?.last_watched_at),
      toMs(item?.last_watched_at),
    );
    if (lastWatchedAtMs === 0) continue;

    if (!best || lastWatchedAtMs > best.lastWatchedAtMs) {
      best = {
        showTitle,
        showTraktId,
        seasonNumber: next.season,
        episodeNumber: next.number,
        nextEpisodeTraktId: typeof next.ids?.trakt === 'number' ? next.ids.trakt : null,
        lastWatchedAtMs,
      };
    }
  }

  return best;
}
