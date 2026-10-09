import type { FeedActivity, FeedActivityType } from '../types';
import { formatRating } from '../../../utils/formatRating';

/**
 * A-3 · Akış kartının SİSTEM cümlesi («Dune filmini izledi» / «watched Dune»).
 *
 * Yalnız sistemin ürettiği metin çevrilir; kullanıcının yazdığı alıntı/gönderi/
 * inceleme hangi dilde yazıldıysa öyle kalır (kullanıcı kararı 2026-10-10).
 *
 * Yapım adı cümlenin içinde ayrı, tıklanabilir bir <Text> olarak çizilir — ama
 * yeri dile göre değişir (TR: başta, EN: fiilden sonra). Bu yüzden çeviriye
 * `{{title}}` yerine bir işaret karakteri verilir ve sonuç ondan bölünür:
 * `before` + [yapım adı] + `after`.
 */
const ISARET = '\u0001';

const ANAHTAR: Record<FeedActivityType, (a: FeedActivity) => string> = {
  watched_episode: () => 'feed:activityWatchedEpisode',
  watched_movie: () => 'feed:activityWatchedMovie',
  started_show: () => 'feed:activityStartedShow',
  completed_show: () => 'feed:activityCompletedShow',
  rated: (a) => (a.mediaType === 'movie' ? 'feed:activityRatedMovie' : 'feed:activityRatedShow'),
  reviewed: (a) => (a.mediaType === 'movie' ? 'feed:activityReviewedMovie' : 'feed:activityReviewedShow'),
  posted: () => 'feed:activityPosted',
};

export interface ActivityLabel {
  before: string;
  after: string;
}

export function activityLabel(
  a: FeedActivity,
  t: (key: string, options?: Record<string, unknown>) => string
): ActivityLabel {
  const metin = String(
    t(ANAHTAR[a.activityType](a), {
      title: ISARET,
      episode: a.episodeNumber ?? '',
      // `formatRating`: Trakt 1-10 tutar, uygulama her yerde 5 üzerinden gösterir.
      rating: formatRating(a.rating),
    })
  );
  const i = metin.indexOf(ISARET);
  // Çeviride {{title}} yoksa (bozuk çeviri) yapım adı sona eklenir — cümle kaybolmaz.
  if (i === -1) return { before: `${metin.trim()} `, after: '' };
  return {
    before: metin.slice(0, i),
    after: metin.slice(i + 1).replace(/\s+/g, ' ').trimEnd(),
  };
}
