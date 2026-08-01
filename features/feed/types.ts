// Feed (Akış) sistemi tipleri — bkz. docs/feed.md
// Phase 1: yalnızca 4 aktivite tipi. Phase 2'de 'commented'/'added_to_list' eklenecek.

export type FeedActivityType =
  | 'watched_episode'
  | 'watched_movie'
  | 'started_show'
  | 'completed_show'
  | 'rated';

/** Yapımın türü. `showId` hem dizi hem film trakt id'sini taşıdığı için
 *  (bkz. supabase şeması `show_id`), doğru detay sayfasına yönlendirmenin
 *  TEK yolu budur. */
export type FeedMediaType = 'show' | 'movie';

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
  mediaType: FeedMediaType;
  /** Poster için — TMDB id'si (URL değil, bkz. migration 013). */
  tmdbId?: number;
  showTitle: string;
  showPosterUrl: string | null;
  episodeNumber?: string; // "S03E04" — yalnızca watched_episode
  rating?: number;        // 1-10 — yalnızca rated
  activityAt: string;     // ISO timestamp
  /** Yalnızca ANINDA YAYIN sırasında true: kart ekranda ama sunucu onayı
   *  henüz gelmedi. Onay gelince silinir, hata olursa kart geri alınır
   *  (bkz. features/feed/services/feedPublish.ts). */
  isPending?: boolean;
}

// ── Maraton (Gruplanmış) Aktivite ─────────────────────────────────────────
// Aynı kullanıcının aynı dizide, art arda izlediği bölümler arasında 12 saatten
// az fark varsa (ve toplam ≥2 bölüm) bu aktiviteler tek bir MarathonActivity'e
// dönüştürülür. Gruplama feedApi'de DEĞİL, useFeed hook'unda yapılır — bkz.
// features/feed/utils/groupMarathonActivities.ts
export interface MarathonActivity {
  /** "marathon-{userId}-{showId}-{lastTimeMs}" bileşik ID */
  id: string;
  /** Discriminant — FeedActivity'nin activityType'ından farklı, tip guard için */
  type: 'marathon';
  user: FeedUser;
  showId: number;
  /** Maraton tanım gereği bir dizidir; alan yine de taşınıyor ki kartlar
   *  `FeedActivity` ile aynı yönlendirme mantığını paylaşabilsin. */
  mediaType: FeedMediaType;
  tmdbId?: number;
  showTitle: string;
  showPosterUrl: string | null;
  episodeCount: number;  // Kaç bölüm izlendi
  episodeRange: string;  // "S01E02 - S01E06" (tek bölümse sadece "S01E02")
  firstEpisode: string;  // Kronolojik olarak ilk bölüm kodu
  lastEpisode: string;   // Kronolojik olarak son bölüm kodu
  activityAt: string;    // En son bölümün ISO timestamp'i (sıralama için)
  /** Bu maratona gruplanan tüm ham feed_activities satırlarının id'leri —
   *  maraton kartı silinmek istendiğinde HEPSİ birlikte silinmeli (bkz.
   *  features/feed/services/feedApi.ts deleteActivitiesBulk). */
  originalActivityIds: string[];
}

/** Feed listesindeki her öğe ya tekil aktivite ya da gruplanmış maraton */
export type FeedItem = FeedActivity | MarathonActivity;

/** Discriminant tip guard — MarathonActivity mi yoksa FeedActivity mi?
 *  Silme, seçim modu vb. birden fazla yerde gerektiği için burada, tiplerin
 *  kendi yanında tanımlı — feed.tsx/ProfileActivityTab.tsx'te ayrı ayrı
 *  kopyalanmasın diye. */
export function isMarathonActivity(item: FeedItem): item is MarathonActivity {
  return 'type' in item && item.type === 'marathon';
}
