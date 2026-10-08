export type HiddenDraft = { mediaType: 'show' | 'movie'; mediaId: number; hidden: boolean };
export type HiddenJob = HiddenDraft & { id: string; owner: string; trakt: boolean };
export type HiddenSession = { owner: string; token: string; trakt: boolean };
export type HiddenSnapshot = { show: number[]; movie: number[] };
export const HIDDEN_OUTBOX_PREFIX = 'kaymak-hidden-outbox-v1:';

export function validHiddenJob(job: HiddenJob, owner: string): boolean {
  return !!job && job.owner === owner && typeof job.id === 'string' && !!job.id
    && (job.mediaType === 'show' || job.mediaType === 'movie')
    && Number.isSafeInteger(job.mediaId) && job.mediaId > 0
    && typeof job.hidden === 'boolean' && typeof job.trakt === 'boolean'
    && Object.keys(job).every((key) => ['id', 'owner', 'trakt', 'mediaType', 'mediaId', 'hidden'].includes(key));
}
