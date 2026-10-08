import type { HiddenJob, HiddenDraft } from './types';

let pending: HiddenJob[] = [];
export const setHiddenProjection = (jobs: HiddenJob[]) => { pending = jobs; };
/** Cache ve ağ okumaları aynı yoldan geçer; yalnız geçerli hesabın disk-ACK niyetleri. */
export function projectHiddenIds(type: HiddenDraft['mediaType'], ids: number[]): number[] {
  if (!pending.some((job) => job.mediaType === type)) return ids;
  const result = new Set(ids);
  for (const job of pending) {
    if (job.mediaType !== type) continue;
    if (job.hidden) result.add(job.mediaId);
    else result.delete(job.mediaId);
  }
  return [...result];
}
