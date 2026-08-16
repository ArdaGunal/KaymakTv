import { FeedItem, isMarathonActivity } from '../types';

/** Maraton kartı için TÜM gruplanan ham satırlar; tekil aktivite için kendi id'si.
 *  Akış (useFeed.ts) ve Profil (useUserActivity.ts) silme yolları PAYLAŞIYOR —
 *  ikisi de aynı `feed_activities` satırlarını hedeflemeli. */
export function resolveRawActivityIds(item: FeedItem): string[] {
  return isMarathonActivity(item) ? item.originalActivityIds : [item.id];
}
