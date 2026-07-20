// Liste sistemi için tek kaynak: isimler, limitler ve yardımcılar.
//
// Kritik bağlam: "Favoriler" (kalp butonu) aslında Trakt'ta gizli bir özel liste
// olarak tutulur ("Beğenilen Diziler"). Trakt'ın /users/me/lists uç noktası bu
// listeyi de döndürdüğü için, filtrelenmezse kullanıcının özel listeleri arasında
// bir "ikinci favoriler" gibi görünür ve kafa karıştırır. Bu yüzden bu liste her
// yerde kullanıcı listelerinden AYIKLANIR — favoriler yalnızca kalp ikonuyla yönetilir.

// Kalp/favori özelliğinin arka planda kullandığı liste adları (geçmiş sürümler dahil).
export const LIKED_LIST_NAMES = ['Beğenilen Diziler', 'Beğenilenler'];

// Kullanıcının varsayılan koleksiyon listesi. "Listeye ekle" akışında yoksa oluşturulur.
export const DEFAULT_LIST_NAME = 'Koleksiyonum';

// Trakt platform limitleri (ücretsiz hesap).
// Not: Favori listesi de Trakt'ın 5 liste kotasına dahildir. Favorilemenin her zaman
// çalışabilmesi için 1 slot ona rezerve edilir → kullanıcıya en fazla 4 liste izni verilir.
export const MAX_TRAKT_LISTS_TOTAL = 5;
export const MAX_USER_LISTS = 4;
export const MAX_LIST_ITEMS = 250;

export const isLikedList = (name?: string | null): boolean =>
  !!name && LIKED_LIST_NAMES.includes(name);

export const isDefaultList = (name?: string | null): boolean =>
  name === DEFAULT_LIST_NAME;

// Trakt'tan gelen ham liste dizisinden favori (liked) listesini ayıklar.
export const filterUserLists = <T extends { name?: string }>(lists: T[] | null | undefined): T[] =>
  (lists || []).filter((l) => !isLikedList(l?.name));

// Limit aşımlarını çağıran katmanın tanıyabilmesi için tiplenmiş hata.
export type ListLimitReason = 'maxLists' | 'maxItems';
export class ListLimitError extends Error {
  reason: ListLimitReason;
  constructor(reason: ListLimitReason) {
    super(reason);
    this.name = 'ListLimitError';
    this.reason = reason;
  }
}
