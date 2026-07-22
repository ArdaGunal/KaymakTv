/**
 * Kart etiketlerinin (tag) TEK çeviri noktası.
 *
 * Veri katmanı (`trackingLogic`, `useMoviesDashboardData`, `useDashboardData`)
 * etiketleri SEMANTİK KOD olarak üretir — 'WATCHLIST', 'BIRAKILDI', 'EN SON'…
 * Bu kodlar tarihsel sebeplerle Türkçe yazılmıştır ve ekranda doğrudan
 * basıldıklarında İngilizce arayüzde de Türkçe metin görünür.
 *
 * Bu fonksiyon o kodları arayüz diline çevirir. Eskiden `EpisodeCard.web.tsx`
 * içinde yerel bir yardımcı olarak duruyordu; film kartları ondan habersizdi ve
 * `MovieCardMobile` etiketi HAM haliyle basıyordu ("WATCHLIST"), `MovieCard.web`
 * ise yalnızca tek bir kodu ele alan kendi ayrı ternary'sini taşıyordu. Ortak
 * yere alınarak bu sapma kapatıldı.
 *
 * Bilinmeyen bir kod geldiğinde kodun kendisi döner — yeni bir etiket eklendiğinde
 * ekranda boşluk değil, en azından ham kod görünür.
 */
export function getMediaTagLabel(tag: string, t: (key: string) => string): string {
  switch (tag) {
    case 'WATCHLIST':
      return t('watchlistTab');
    case 'BIRAKILDI':
      return t('dropped');
    case 'EN SON':
      return t('last');
    case 'PREMIERE':
      return t('premiere');
    case 'YENİ':
      return t('new');
    case 'TAMAMLANDI':
      return t('completed');
    default:
      return tag;
  }
}
