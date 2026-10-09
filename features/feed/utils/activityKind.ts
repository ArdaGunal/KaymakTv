import type { FeedActivity } from '../types';

/**
 * C2 · Kartın türü: KULLANICININ YAYINI mı, SİSTEM kaydı mı?
 *
 * Yayın = kişinin kendi ürettiği içerik: gönderi, inceleme, puan (yazısız da),
 * alıntı eklenmiş izleme. Tam ekran detay + yorumlar açılır.
 * Sistem = «X izledi / başladı / tamamladı» gibi otomatik log. Yarım ekran
 * pencere açılır, yorum yok.
 *
 * Kural Worker'daki yorum kapısıyla AYNI (`handleFeedComment`: not VEYA puan
 * yoksa 403) — `posted`/`reviewed` metni `note` alanında taşıdığı için zaten
 * kapsanıyor; tip kontrolü yine de açık yazıldı (metinsiz bozuk satıra karşı).
 */
export function isUserPublished(a: Pick<FeedActivity, 'activityType' | 'note' | 'rating'>): boolean {
  return a.activityType === 'posted' || a.activityType === 'reviewed' || !!a.note || a.rating != null;
}
