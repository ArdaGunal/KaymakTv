import { Eye, Play, CheckCircle2, Star, Clapperboard, MessageSquarePlus, PenLine } from '../../../components/icons';
import type { FeedActivity } from '../types';

/**
 * Her aktivite tipinin ikonu ve vurgu rengi — akış kartı, detay sayfası ve
 * sistem kartı penceresi aynı görsel dili kullansın diye tek yerde (C2).
 * Cümlenin kendisi (A-3, çeviri) `activityLabel.ts`'te.
 */
export const ACTIVITY_META: Record<FeedActivity['activityType'], { icon: typeof Eye; color: string }> = {
  watched_episode: { icon: Eye, color: '#38bdf8' },
  watched_movie: { icon: Clapperboard, color: '#f472b6' },
  started_show: { icon: Play, color: '#a78bfa' },
  completed_show: { icon: CheckCircle2, color: '#4ade80' },
  // Puanın 5 üzerinden gösterimi (`formatRating`) activityLabel'da.
  rated: { icon: Star, color: '#facc15' },
  // Bağımsız gönderi ("Fikir Paylaş") — bkz. 017_feed_posts.sql.
  posted: { icon: MessageSquarePlus, color: '#22d3ee' },
  // İnceleme — bkz. 018_feed_reviews.sql, docs/design/REVIEWS_PLAN.md.
  reviewed: { icon: PenLine, color: '#fb923c' },
};
