/**
 * Aylık izleme özeti — "anlık görüntü farkı" yöntemi
 * (docs/design/notifications.md § 14).
 *
 * 🔴 NEDEN BU YÖNTEM — alternatifleri elendi:
 *
 * | Aday kaynak | Neden yetmiyor |
 * |---|---|
 * | `hooks/useProfileStatistics.ts` aylık grafiği | Dizi başına **son** izleme tarihinden üretiliyor. Bir dizinin 30 bölümünü izlemek orada **1** sayılır; "bu ay 45 saat" oradan ÇIKARILAMAZ |
 * | `/sync/history?start_at=…` | Doğru veriyi verir ama **yeni bir Trakt isteği**; bu modülün "ek istek yok" ilkesini bozar |
 * | Supabase `feed_activities` | Yalnızca YAYINLANAN aktiviteler (gizlilik anahtarlarına tabi) ve 200 kayıtla sınırlı — eksik sayar |
 *
 * Çözüm: Trakt `/users/me/stats` TÜM ZAMANLARIN toplam dakikasını veriyor ve
 * kütüphane senkronu bunu ZATEN çekiyor. İki tarih arasındaki toplam farkı,
 * o dönemde izlenen dakikanın TA KENDİSİDİR. Ek istek yok, tahmin yok.
 *
 * 🔴 SAF: çalışma zamanı import'u yok (gerekçe: `fireTime.ts` başlığı).
 */

/** Diske yazılan anlık görüntü. */
export interface StatsSnapshot {
  takenAt: number;
  episodeMinutes: number;
  movieMinutes: number;
  episodesWatched: number;
  moviesWatched: number;
}

/** `store/useLibraryStore.ts` → `userStats`'tan okunan güncel toplamlar. */
export interface CurrentTotals {
  episodeMinutes: number;
  movieMinutes: number;
  episodesWatched: number;
  moviesWatched: number;
}

export interface MonthlyReport {
  minutes: number;
  episodes: number;
  movies: number;
  /** Dönemin gerçek uzunluğu — metin "son X günde" diyebilsin diye. */
  periodDays: number;
}

export interface MonthlyStatsResult {
  /** Bildirilecek özet; bildirilecek bir şey yoksa `null`. */
  report: MonthlyReport | null;
  /** Diske yazılacak yeni anlık görüntü; yazılacak bir şey yoksa `null`. */
  nextSnapshot: StatsSnapshot | null;
}

const GUN_MS = 24 * 60 * 60 * 1000;

const sayi = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;

export function evaluateMonthlyStats(
  previous: StatsSnapshot | null,
  current: CurrentTotals | null,
  now: number,
  minPeriodDays: number,
): MonthlyStatsResult {
  // İstatistikler henüz yüklenmedi (senkron sürüyor ya da başarısız oldu).
  // Yanlış bir taban kaydetmek, sonraki ayın sayısını KALICI olarak bozardı.
  if (!current) return { report: null, nextSnapshot: null };

  const totals: StatsSnapshot = {
    takenAt: now,
    episodeMinutes: sayi(current.episodeMinutes),
    movieMinutes: sayi(current.movieMinutes),
    episodesWatched: sayi(current.episodesWatched),
    moviesWatched: sayi(current.moviesWatched),
  };

  // İlk çalıştırma: karşılaştıracak bir taban yok. Yalnızca taban alınır,
  // BİLDİRİM ÜRETİLMEZ — "tüm zamanların toplamı"nı bu ayın rakamı gibi
  // sunmak düpedüz yanlış olurdu.
  if (!previous || !Number.isFinite(previous.takenAt)) {
    return { report: null, nextSnapshot: totals };
  }

  const periodMs = now - previous.takenAt;
  if (periodMs < minPeriodDays * GUN_MS) return { report: null, nextSnapshot: null };

  // Negatif fark mümkündür: kullanıcı Trakt'ta geçmişini silmiş/işareti
  // kaldırmış olabilir. Sıfıra kırpılıyor — "bu ay -3 saat izledin" saçmalık.
  const delta = (yeni: number, eski: number) => Math.max(0, yeni - eski);

  const minutes = delta(totals.episodeMinutes, previous.episodeMinutes) +
    delta(totals.movieMinutes, previous.movieMinutes);
  const episodes = delta(totals.episodesWatched, previous.episodesWatched);
  const movies = delta(totals.moviesWatched, previous.moviesWatched);

  // Hiç izlememişse bildirim GÖNDERİLMEZ. "Bu ay 0 saat izledin" hem
  // değersiz hem de kullanıcıyı suçlayan bir mesajdır. Yine de yeni taban
  // alınır, yoksa her açılışta bu hesap tekrar tekrar denenirdi.
  if (minutes <= 0) return { report: null, nextSnapshot: totals };

  return {
    report: {
      minutes,
      episodes,
      movies,
      periodDays: Math.round(periodMs / GUN_MS),
    },
    nextSnapshot: totals,
  };
}
