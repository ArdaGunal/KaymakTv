/**
 * groupMarathonActivities — 12 Saatlik Kayan Pencere Gruplama Algoritması
 *
 * NEDEN BURADA, feedApi.ts'DE DEĞİL?
 * feedApi sayfalama (pagination) uyguladığında, aynı maratona ait bölümler
 * farklı sayfalara düşebilir. Gruplama yalnızca TÜM ham veriler biriktirildikten
 * sonra, ekrana basılmadan hemen önce (useFeed.ts içinde) çalıştırılmalıdır.
 *
 * NEDEN YYYY-MM-DD DEĞİL?
 * Takvim günü ile gruplama gece yarısı geçişlerinde yanlış sonuç verir.
 * Bunun yerine: "art arda izlenen iki bölüm arasındaki süre < 12 saat ise
 * aynı maratona dahil et" kuralı kullanılır.
 *
 * ALGORİTMA (Sliding Window, DESC):
 * 1. 'watched_episode' aktivitelerini ve diğerlerini ayır.
 * 2. Episode listesini activityAt DESC sırala (new Date().getTime() ile).
 * 3. Her episode için {userId}-{showId} anahtarlı açık bir grup ara.
 *    - Varsa ve gap < 12h → gruba ekle, lastTime'ı eski tarafa güncelle.
 *    - Varsa ama gap ≥ 12h → mevcut grubu kapat, yeni grup aç.
 *    - Yoksa: yeni grup aç.
 * 4. Kalan açık grupları kapat.
 * 5. Boyutu ≥ 2 olan gruplar → MarathonActivity; boyutu 1 → FeedActivity.
 * 6. Tüm öğeleri activityAt DESC ile birleştirip döndür.
 *
 * HATA AYIKLAMA:
 * Fonksiyonun en başında gelen ham aktivitelerin tipi ve episode numaraları
 * __DEV__ modunda konsola yazdırılır. Bu sayede gruplama koşulunu etkileyen
 * tip/alan uyuşmazlıkları anında tespit edilebilir.
 */

import { FeedActivity, FeedItem, FeedUser, MarathonActivity } from '../types';

/** 12 saat (ms cinsinden) — iki ardışık episode arasındaki max kabul edilebilir boşluk */
const MARATHON_GAP_MS = 12 * 60 * 60 * 1000; // 43_200_000 ms

/** En az kaç bölüm gruplanırsa MarathonActivity oluşturulsun */
const MARATHON_MIN_COUNT = 2;

interface GroupAccumulator {
  userId: string;
  showId: number;
  showTitle: string;
  showPosterUrl: string | null;
  user: FeedUser;
  episodes: FeedActivity[];
  /**
   * Son eklenen (= zaman olarak en eski) bölümün Unix ms timestamp'i.
   * Her zaman new Date(activityAt).getTime() ile hesaplanır — NaN riski yok.
   */
  lastTime: number;
}

// ── Yardımcı: Güvenli timestamp dönüşümü ─────────────────────────────────────
/**
 * ISO string'den güvenli şekilde Unix ms döndürür.
 * Geçersiz tarih gelirse 0 döner ve NaN'ın algoritmayı kırması önlenir.
 */
function toMs(isoString: string): number {
  const ms = new Date(isoString).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

// ── Yardımcı: Episode kodu karşılaştırma ─────────────────────────────────────

/** "S03E04" → { season: 3, episode: 4 } — parse edilemezse null */
function parseEpisodeCode(code: string): { season: number; episode: number } | null {
  const match = code.match(/S(\d+)E(\d+)/i);
  if (!match) return null;
  return { season: parseInt(match[1], 10), episode: parseInt(match[2], 10) };
}

/** İki episode kodunu kronolojik ASC sıralar */
function compareEpisodeCodes(a: string, b: string): number {
  const pa = parseEpisodeCode(a);
  const pb = parseEpisodeCode(b);
  if (!pa || !pb) return 0;
  if (pa.season !== pb.season) return pa.season - pb.season;
  return pa.episode - pb.episode;
}

// ── Yardımcı: Grup → MarathonActivity ────────────────────────────────────────

function buildMarathon(group: GroupAccumulator): MarathonActivity {
  // Episode kodlarına göre kronolojik ASC sırala
  const sorted = [...group.episodes].sort((a, b) =>
    compareEpisodeCodes(a.episodeNumber ?? '', b.episodeNumber ?? '')
  );

  const first = sorted[0]?.episodeNumber ?? '?';
  const last  = sorted[sorted.length - 1]?.episodeNumber ?? '?';
  const count = group.episodes.length;

  // activityAt = en son izlenen bölümün zamanı — MUTLAKA .getTime() ile karşılaştır
  // (string > string karşılaştırması ISO formatta çoğunlukla çalışsa da,
  // timezone offset içeren formatlarda yanlış sıra üretebilir)
  const latestActivity = group.episodes.reduce((prev, cur) =>
    toMs(cur.activityAt) > toMs(prev.activityAt) ? cur : prev
  );

  return {
    id: `marathon-${group.userId}-${group.showId}-${group.lastTime}`,
    type: 'marathon',
    user: group.user,
    showId: group.showId,
    showTitle: group.showTitle,
    showPosterUrl: group.showPosterUrl,
    episodeCount: count,
    episodeRange: count === 1 ? first : `${first} - ${last}`,
    firstEpisode: first,
    lastEpisode: last,
    activityAt: latestActivity.activityAt,
    originalActivityIds: group.episodes.map((e) => e.id),
  };
}

// ── Ana Export ────────────────────────────────────────────────────────────────

/**
 * Ham FeedActivity dizisini alır, maraton gruplamalarını uygular ve FeedItem[]
 * döndürür. Saf (pure) fonksiyon — yan etkisi yoktur.
 *
 * @param activities - feedApi'den gelen ham aktiviteler (herhangi bir sırada olabilir)
 * @returns Gruplandırılmış ve activityAt DESC sıralı, yeni referanslı FeedItem[]
 */
export function groupMarathonActivities(activities: FeedActivity[]): FeedItem[] {
  // ── [DEBUG] Gelen veriyi incele ──────────────────────────────────────────
  // Hangi activityType değerleri geliyor? episodeNumber dolu mu?
  // Bu log, tip/alan uyuşmazlıklarını hızlıca tespit etmek için bırakıldı.
  if (__DEV__) {
    console.log(
      '[Marathon] Gelen aktiviteler:',
      activities.map(a => ({
        type: a.activityType,
        ep: a.episodeNumber ?? '(boş)',
        show: a.showTitle,
        at: a.activityAt,
      }))
    );
  }

  // 1. Gruplama adayı: activityType === 'watched_episode' VE episodeNumber dolu
  //    Diğer tipler (started_show, completed_show, rated) ve episodeNumber'sız
  //    watched_episode'lar gruplama dışında kalır.
  const episodeActivities: FeedActivity[] = [];
  const otherActivities:   FeedActivity[] = [];

  for (const a of activities) {
    if (a.activityType === 'watched_episode' && a.episodeNumber) {
      episodeActivities.push(a);
    } else {
      otherActivities.push(a);
    }
  }

  if (__DEV__) {
    console.log(
      `[Marathon] Gruplama adayı: ${episodeActivities.length} episode, ` +
      `diğer: ${otherActivities.length} aktivite`
    );
  }

  // 2. Güvenli sıralama — MUTLAKA .getTime() (NaN riski yok, string karşılaştırması yok)
  const sortedDesc = [...episodeActivities].sort(
    (a, b) => toMs(b.activityAt) - toMs(a.activityAt)
  );

  // 3. Sliding window: {userId}-{showId} anahtarlı açık gruplar
  const openGroups   = new Map<string, GroupAccumulator>();
  const closedGroups: GroupAccumulator[] = [];

  for (const activity of sortedDesc) {
    const key     = `${activity.user.id}-${activity.showId}`;
    // MUTLAKA toMs() — string aritmetiği yapmıyoruz
    const actTime = toMs(activity.activityAt);
    const existing = openGroups.get(key);

    if (existing) {
      // DESC iterasyonda: existing.lastTime >= actTime
      // (lastTime = bu gruptaki en eski bölümün zamanı)
      const gap = existing.lastTime - actTime;

      if (gap < MARATHON_GAP_MS) {
        // Boşluk < 12h → aynı maratona ekle, zaman penceresini geri uzat
        existing.episodes.push(activity);
        existing.lastTime = actTime;
      } else {
        // 12h sınırı aşıldı → grubu kapat, yeni açık grup başlat
        closedGroups.push(existing);
        openGroups.set(key, {
          userId: activity.user.id,
          showId: activity.showId,
          showTitle: activity.showTitle,
          showPosterUrl: activity.showPosterUrl,
          user: activity.user,
          episodes: [activity],
          lastTime: actTime,
        });
      }
    } else {
      // Bu kullanıcı+dizi için ilk episode → yeni açık grup
      openGroups.set(key, {
        userId: activity.user.id,
        showId: activity.showId,
        showTitle: activity.showTitle,
        showPosterUrl: activity.showPosterUrl,
        user: activity.user,
        episodes: [activity],
        lastTime: actTime,
      });
    }
  }

  // 4. Açık kalan grupları kapat
  openGroups.forEach(g => closedGroups.push(g));

  // 5. Her grubu FeedItem'a dönüştür
  const groupedItems: FeedItem[] = [];
  for (const group of closedGroups) {
    if (group.episodes.length >= MARATHON_MIN_COUNT) {
      groupedItems.push(buildMarathon(group));
    } else {
      // Tek bölüm → maraton değil, orijinal FeedActivity olarak kalsın
      const single = group.episodes[0];
      if (single) groupedItems.push(single);
    }
  }

  if (__DEV__) {
    const marathonCount = groupedItems.filter(i => 'type' in i && i.type === 'marathon').length;
    console.log(`[Marathon] Sonuç: ${marathonCount} maraton kartı, ${groupedItems.length - marathonCount} tekil episode`);
  }

  // 6. Gruplu episodeler + diğer aktiviteler → activityAt DESC birleştir
  //    Spread ile yeni array referansı garantileniyor (React state update için)
  const allItems: FeedItem[] = [...groupedItems, ...otherActivities];
  allItems.sort((a, b) => toMs(b.activityAt) - toMs(a.activityAt));

  return allItems;
}
