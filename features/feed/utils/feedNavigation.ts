import { FeedMediaType } from '../types';

/**
 * Bir akış kartından gidilecek detay sayfasının yolu.
 *
 * NEDEN AYRI: `feed_activities.show_id` HEM dizi HEM film trakt id'sini
 * taşır (bkz. supabase şeması) — hangisi olduğunu yalnızca `media_type`
 * söyler. Bu ayrım yapılmadan tüm kartlar `/show/{id}`ye gidiyordu ve bir
 * FİLM puanına tıklandığında yanlış sayfa (çoğu zaman "bulunamadı") açılıyordu.
 *
 * Slug'sız, yalnızca sayısal id yeterli: `/show/[id]` ve `/movie/[id]`
 * rotaları yolu `parseMediaSlug` ile ayrıştırır ve slug kısmı boşken de
 * çalışır; `tmdbId` de opsiyoneldir (detay hook'u eksikse Trakt özetinden
 * kendisi keşfeder). Varsa yine de geçiyoruz — poster/afiş ilk karede gelsin.
 */
export function buildMediaHref(activity: {
  showId: number;
  mediaType: FeedMediaType;
  tmdbId?: number;
}): string {
  const base = activity.mediaType === 'movie' ? 'movie' : 'show';
  const query = activity.tmdbId ? `?tmdbId=${activity.tmdbId}` : '';
  return `/${base}/${activity.showId}${query}`;
}
