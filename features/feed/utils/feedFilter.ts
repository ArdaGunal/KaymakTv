import type { FeedActivity } from '../types';

/**
 * C6 · Akış filtresi (kullanıcı kararı 2026-10-10, YouTube tarzı çipler):
 *  - `tumu`        — her şey (varsayılan; uygulama her açılışta bununla başlar)
 *  - `gonderiler`  — İNSAN üretimi: gönderi, inceleme, puan (yazısız da), alıntılı izleme
 *  - `takip`       — yalnız takip ettiklerim (ben hariç)
 *  - `aktiviteler` — SİSTEM logları: «X izledi / başladı / tamamladı», maraton
 *
 * Asıl filtre SUNUCUDA (feedApi) — istemcide eleme 40'lık sayfayı boşaltırdı.
 * Bu yüklem yalnız Realtime/iyimser eklemelerin filtreye uyup uymadığını sorar.
 * `gonderiler` kuralı Worker yorum kapısı ve `isUserPublished` ile aynı aile:
 * gönderi/inceleme metni `note`'ta, puan `rating`'de.
 */
export type FeedFilter = 'tumu' | 'gonderiler' | 'takip' | 'aktiviteler';

export const FEED_FILTERS: FeedFilter[] = ['tumu', 'gonderiler', 'takip', 'aktiviteler'];

/** Sistem log tipleri — `aktiviteler` sunucu sorgusu da bunu kullanır. */
export const SISTEM_TIPLERI = ['watched_episode', 'watched_movie', 'started_show', 'completed_show'] as const;

export function filtreyeUyar(
  a: Pick<FeedActivity, 'activityType' | 'note' | 'rating' | 'user'>,
  filtre: FeedFilter,
  benimId: string | null
): boolean {
  switch (filtre) {
    case 'tumu':
      return true;
    case 'gonderiler':
      return !!a.note || a.rating != null;
    case 'aktiviteler':
      return !a.note && a.rating == null && (SISTEM_TIPLERI as readonly string[]).includes(a.activityType);
    case 'takip':
      return !!benimId && a.user.id !== benimId;
  }
}
