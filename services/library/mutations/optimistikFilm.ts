// ==========================================================================
// FİLM İZLEME — iyimser "izlendi" girdisi  (M417)
// ==========================================================================
// 🔴 KUSUR (kullanıcı, 2026-09-20, cihazda): *"filmlerde izledim
// işaretlenmiyor."* Sunucu tarafı ÇALIŞIYORDU (canlı log: `/library/watched`
// → film katalogda yoksa bile §C30 ile çekilip yazıldı), ama ekran
// değişmiyordu.
//
// KÖK: `markMovieAsWatched` iyimser girdiyi YALNIZCA film o an İZLEME
// LİSTESİNDEYSE ekliyordu (girdi listeden "taşınıyordu"). Film hiçbir
// listede değilken — Keşfet'ten/aramadan açılıp doğrudan işaretlenen film —
// `watchedMovies` HİÇ değişmiyor, film detayındaki «İzlendi» rozeti
// (`app/movie/[id].tsx`: `watchedMovies.some(...)`) hiç yeşile dönmüyordu.
// Dizilerde bu yaşanmıyor çünkü orada yazmadan sonra sunucudan ilerleme
// tazeleniyor; filmlerde öyle bir tazeleme YOK.
//
// ⚠️ NEDEN AYRI DOSYA: `progress.ts` DONDURULMUŞ. Karar burada (saf, test
// edilebilir), orada yalnızca tek satırlık çağrı var.

/** `watchedMovies` girdisinin beklediği asgari film nesnesi. */
export type FilmBenzeri = { ids?: { trakt?: number } | null; title?: string } | null | undefined;

/**
 * SAF — filmi `watchedMovies` listesine iyimser ekler.
 *
 * @param prev   mağazadaki mevcut liste
 * @param filmId Trakt film kimliği
 * @param film   filmin kendisi (izleme listesinden taşınan girdi ya da
 *               çağıran ekranın elindeki veri). Yoksa/kimliksizse liste
 *               DEĞİŞMEZ: uydurma başlıklı bir kart çizmektense hiç
 *               çizmemek doğru (bkz. `mediaMeta.ts`'in aynı kararı).
 * @returns yeni liste ya da AYNI referans (değişiklik yoksa)
 */
export function izlenenFilmeEkle(
  prev: any[] | null | undefined,
  filmId: number,
  film: FilmBenzeri,
  simdi: string = new Date().toISOString(),
): any[] {
  const liste = Array.isArray(prev) ? prev : [];
  if (!Number.isFinite(filmId)) return liste;
  // Zaten izlenmişse dokunma — `plays` sayacı sunucunun işi, burada
  // artırmak iki kaynağı ıraksatırdı.
  if (liste.some((p: any) => p?.movie?.ids?.trakt === filmId)) return liste;
  if (!film || film?.ids?.trakt !== filmId) return liste;
  return [{ plays: 1, last_watched_at: simdi, movie: film }, ...liste];
}
