// Feed (Akış) sistemi tipleri — bkz. docs/feed.md
// Phase 1: yalnızca 4 aktivite tipi. Phase 2'de 'commented'/'added_to_list' eklenecek.

export type FeedActivityType =
  | 'watched_episode'
  | 'started_show'
  | 'completed_show'
  | 'rated';

export interface FeedUser {
  id: string;
  traktSlug: string;
  username: string;
  avatarUrl: string | null;
}

export interface FeedActivity {
  id: string;
  user: FeedUser;
  activityType: FeedActivityType;
  showId: number;
  showTitle: string;
  showPosterUrl: string | null;
  episodeNumber?: string; // "S03E04" — yalnızca watched_episode
  rating?: number; // 1-10 — yalnızca rated
  activityAt: string; // ISO timestamp
}
