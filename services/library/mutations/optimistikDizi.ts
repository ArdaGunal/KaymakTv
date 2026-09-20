// ==========================================================================
// DİZİ İZLEME — iyimser "izlenenler" girdisi + izleme listesinden düşme (M421)
// ==========================================================================
// 🔴 KUSUR (denetim B, 2026-09-20): `reactivateShowTracking` diziyi
// `watchedShows`'ta BULAMAZSA hiçbir şey yapmıyordu:
//
//     const idx = prev.findIndex(...); if (idx === -1) return prev;
//
// Yani hiç izlenmemiş bir dizinin İLK bölümünü işaretlemek o diziyi
// "izlenenler"e EKLEMİYORDU. Etkilenen yüzeyler: dizi detayındaki dizi
// seviyesi durum (`app/show/[id].tsx` → `watchedShows.some`), Diziler
// sekmesi, kartlardaki takip rozeti (`utils/followStatus.ts`). Kullanıcı
// "işaretledim, ekranda hiçbir şey değişmiyor; çıkıp girince görüyorum"
// diye bildirdi — tam bu.
//
// 🔑 ÜRÜN KARARI (kullanıcı, 2026-09-20): *"Diziler, ilk bölüm izlendiği an
// İzleme Listesinden düşmeli."* Film tarafında bu davranış zaten vardı
// (`progress.ts` filmi listeden çıkarıp izlenenlere taşıyor); dizi tarafı
// şimdi aynı kurala geçiyor. Sunucu ayağı Worker'da (`/library/watched`
// yazınca `user_watchlist` satırı silinir) — ikisi birlikte olmazsa bir
// sonraki senkron diziyi listeye GERİ getirirdi.

/** `watchedShows` girdisinin beklediği asgari dizi nesnesi. */
export type DiziBenzeri = { ids?: { trakt?: number } | null; title?: string } | null | undefined;

/**
 * SAF — diziyi `watchedShows` listesine iyimser ekler.
 *
 * @returns yeni liste ya da AYNI referans (değişiklik yoksa)
 */
export function izlenenDiziyeEkle(
  prev: any[] | null | undefined,
  diziId: number,
  dizi: DiziBenzeri,
  simdi: string = new Date().toISOString(),
): any[] {
  const liste = Array.isArray(prev) ? prev : [];
  if (!Number.isFinite(diziId)) return liste;
  if (liste.some((p: any) => p?.show?.ids?.trakt === diziId)) return liste;
  // Veri yoksa UYDURMA YOK: başlıksız kart çizmektense hiç çizme
  // (`optimistikFilm.ts` ve `mediaMeta.ts` ile aynı karar).
  if (!dizi || dizi?.ids?.trakt !== diziId) return liste;
  return [{ plays: 1, last_watched_at: simdi, show: dizi }, ...liste];
}

/**
 * SAF — diziyi izleme listesinden çıkarır ve çıkarılan girdiyi döndürür.
 * Girdi bulunamazsa liste aynı referansla döner.
 */
export function izlemeListesindenDus(
  prev: any[] | null | undefined,
  diziId: number,
): { liste: any[]; dusen: any | null } {
  const liste = Array.isArray(prev) ? prev : [];
  const dusen = liste.find((p: any) => p?.show?.ids?.trakt === diziId) || null;
  if (!dusen) return { liste, dusen: null };
  return { liste: liste.filter((p: any) => p?.show?.ids?.trakt !== diziId), dusen };
}
