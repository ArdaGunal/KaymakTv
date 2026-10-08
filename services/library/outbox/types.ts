/** Token ASLA diske yazılmaz. owner yalnız yerel hesap izolasyonudur. */
export type WatchedPart = { season?: number; episodes?: number[] | '*'; kaymakDone?: boolean; traktStarted?: boolean; traktDone?: boolean };
export type WatchedDraft = {
  mediaType: 'show' | 'movie'; mediaId: number; watchedAt: string;
  parts: WatchedPart[]; media?: any; skeleton?: any[];
  activity?: { season: number; episode: number };
};
export type WatchedJob = WatchedDraft & { id: string; owner: string; trakt: boolean; feedDone?: boolean };
export type OutboxSession = { owner: string; token: string; trakt: boolean };
export const OUTBOX_PREFIX = 'kaymak-watched-outbox-v1:';

export function validateJob(job: WatchedJob, owner: string): boolean {
  return !!job && job.owner === owner && typeof job.id === 'string'
    && (job.mediaType === 'show' || job.mediaType === 'movie')
    && Number.isInteger(job.mediaId) && job.mediaId > 0
    && Number.isFinite(Date.parse(job.watchedAt)) && typeof job.trakt === 'boolean'
    && Array.isArray(job.parts) && job.parts.length > 0
    && job.parts.every((p) => !!p && (job.mediaType === 'movie'
      || (Number.isInteger(p.season) && p.season! >= 0 && (p.episodes === '*'
        || (Array.isArray(p.episodes) && p.episodes.length > 0
          && p.episodes.every((e) => Number.isInteger(e) && e > 0))))));
}

/**
 * M467 · Akışa düşecek TEK temsilci bölüm. İşaretleme hangi yoldan yapılırsa
 * yapılsın (bölüm ✓, «öncekileri de işaretle», sezon çift tiki) akışa tam bir
 * `watched_episode` olayı gider. Eskiden sezon çift tiki `activity` taşımadığı
 * için hiç olay yayınlamıyordu (kullanıcı: «bazen düşüyor bazen düşmüyor»).
 * Açık `activity` varsa o; yoksa en büyük sezonun en büyük bölümü. Özel
 * bölümler (sezon 0) ve genişletilmemiş `'*'` temsilci olamaz.
 */
export function temsilciBolum(job: Pick<WatchedJob, 'mediaType' | 'parts' | 'activity'>): { season: number; episode: number } | null {
  if (job.mediaType !== 'show') return null;
  if (job.activity) return job.activity;
  let secilen: { season: number; episode: number } | null = null;
  for (const p of job.parts || []) {
    if (!Number.isInteger(p?.season) || (p.season as number) <= 0 || !Array.isArray(p.episodes) || !p.episodes.length) continue;
    const ep = Math.max(...p.episodes);
    if (!secilen || (p.season as number) > secilen.season) secilen = { season: p.season as number, episode: ep };
  }
  return secilen;
}

