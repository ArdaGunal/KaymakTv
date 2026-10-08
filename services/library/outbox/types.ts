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
