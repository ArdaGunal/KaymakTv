import type { WatchedJob } from './types';
import { bolumleriIsaretle, sezonuIsaretle, iskeletKur } from '../mutations/optimistikIlerleme';
import { izlenenDiziyeEkle } from '../mutations/optimistikDizi';
import { izlenenFilmeEkle } from '../mutations/optimistikFilm';

let pending: WatchedJob[] = [];
let settled: Array<{ job: WatchedJob; expires: number }> = [];
export const setWatchedProjection = (jobs: WatchedJob[], reset = false) => {
  if (reset) settled = [];
  else for (const job of pending) {
    if (job.feedDone && !jobs.some((j) => j.id === job.id)) settled.push({ job, expires: Date.now() + 30000 });
  }
  pending = jobs;
};
export const clearSettledProjection = () => { settled = []; };
const projectedJobs = () => {
  settled = settled.filter((j) => j.expires > Date.now());
  return [...settled.map((j) => j.job), ...pending];
};
export const projectProgress = (map: Record<string, any>) => {
  let result = map;
  for (const j of projectedJobs().filter((p) => p.mediaType === 'show')) {
    let value = result[j.mediaId] || iskeletKur(j.skeleton);
    for (const p of j.parts) {
      const patched = p.episodes === '*'
        ? sezonuIsaretle(value, p.season!, j.watchedAt)
        : bolumleriIsaretle(value, p.season!, p.episodes!, j.watchedAt);
      if (patched) value = patched;
    }
    if (value) result = { ...result, [j.mediaId]: value };
  }
  return result;
};
export const projectWatchedList = (list: any[], type: 'show' | 'movie') => {
  let result = list;
  for (const j of projectedJobs().filter((p) => p.mediaType === type)) {
    result = type === 'show'
      ? izlenenDiziyeEkle(result, j.mediaId, j.media, j.watchedAt)
      : izlenenFilmeEkle(result, j.mediaId, j.media, j.watchedAt);
    if (type === 'show') result = result.map((row) => row.show?.ids?.trakt === j.mediaId
      && (!row.last_watched_at || Date.parse(row.last_watched_at) < Date.parse(j.watchedAt))
      ? { ...row, last_watched_at: j.watchedAt } : row);
  }
  return result;
};
export const projectWatchlist = (list: any[], type: 'show' | 'movie') => {
  const ids = new Set(projectedJobs().filter((p) => p.mediaType === type).map((p) => p.mediaId));
  return ids.size ? list.filter((p) => !ids.has(p?.[type]?.ids?.trakt)) : list;
};
