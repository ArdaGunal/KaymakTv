import { supabase } from './supabaseClient';
import { dogrulanacakKimlikler, parcala } from '../utils/gorunurlukDogrulama';

/**
 * Elimizdeki akış kartlarından hangileri sunucuda HÂLÂ görünür (Moderasyon Faz 6 · MD06).
 *
 * Akış sorgusuyla AYNI kilit: `in_feed = true` + RLS (engel, gizli hesap, moderasyon gizlemesi,
 * hesap kapatma). Yalnız `id` okunur; kart verisi tazelenmez (o iş akışın kendi yollarında).
 *
 * 🔴 HATA FIRLATIR — çağıran sonucu yalnız BAŞARIDA uygular. Yarım/başarısız bir sorguda
 * «dönmedi» demek, görünür kartları da silerdi.
 */
export async function gorunenAktiviteKimlikleri(kimlikler: readonly string[]): Promise<Set<string>> {
  const sorulacak = dogrulanacakKimlikler(kimlikler);
  const donen = new Set<string>();
  for (const parca of parcala(sorulacak)) {
    const { data, error } = await supabase
      .from('feed_activities')
      .select('id')
      .in('id', parca)
      .eq('in_feed', true);
    if (error) throw error;
    for (const satir of (data ?? []) as { id: string }[]) donen.add(satir.id);
  }
  return donen;
}
