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
  const i = liste.findIndex((p: any) => p?.movie?.ids?.trakt === filmId);
  if (i >= 0) {
    // 1.0.1 Dal 4 · zaten izlenmiş film = TEKRAR: `plays` + 1. 🔴 DAMGAYA BAĞLI — outbox bekleyen ve
    // yeni onaylanmış işi SUNUCU listesinin üstüne yeniden yansıtıyor (`outbox/projection.ts`); sunucu
    // bu izlemeyi zaten içeriyorsa son damga ≥ bu damgadır ve sayı artmaz (iki kez sayılmaz).
    const k = liste[i];
    if (k?.last_watched_at && Date.parse(k.last_watched_at) >= Date.parse(simdi)) return liste;
    const kopya = [...liste];
    kopya[i] = { ...k, plays: Math.max(1, Number(k?.plays) || 1) + 1, last_watched_at: simdi };
    return kopya;
  }
  if (!film || film?.ids?.trakt !== filmId) return liste;
  return [{ plays: 1, last_watched_at: simdi, movie: film }, ...liste];
}

/**
 * 1.0.1 Dal 4 · SAF — filmin YALNIZ son izlemesini iyimser geri alır (3x → 2x); tek izlemesi kalan
 * film listeden düşer. Önceki damga yerelde bilinmediği için `last_watched_at` sunucu turuna kadar kalır.
 */
export function filmIzlemesiniGeriAl(prev: any[] | null | undefined, filmId: number): any[] {
  const liste = Array.isArray(prev) ? prev : [];
  const i = liste.findIndex((p: any) => p?.movie?.ids?.trakt === filmId);
  if (i < 0) return liste;
  const plays = Math.max(1, Number(liste[i]?.plays) || 1);
  if (plays <= 1) return liste.filter((_, j) => j !== i);
  const kopya = [...liste];
  kopya[i] = { ...liste[i], plays: plays - 1 };
  return kopya;
}
