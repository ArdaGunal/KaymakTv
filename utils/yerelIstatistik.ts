// ==========================================================================
// YEREL İZLEME İSTATİSTİĞİ — Trakt'ın `/users/me/stats` ucuna BAĞIMLI OLMADAN
// ==========================================================================
// §C17.2 (kullanıcı raporu, 2026-09-12): *"profilde duran kaç dizi, film
// izlediğine yönelik olan verilerin olduğu kısım"* kaybolmuştu.
//
// 🔬 SEBEP ÖLÇÜLDÜ: `ProfileStatsMobile` `userStats` yoksa `null` döndürüyor
// (hiçbir şey çizmiyor). `userStats`'ı dolduran zincir
// `fetchers.ts → getUserStats() → Trakt /users/me/stats` ve bu uç **Trakt
// token'ı istiyor**. Google hesabında token yok → istek düşüyor → bölüm
// görünmüyor. "Tam bağımsızlık" hedefiyle de çelişiyor: kendi verimiz elimizde
// dururken sayıyı Trakt'a sormak.
//
// 🔑 ELİMİZDEKİ VERİ YETİYOR:
//   · `watchedShows` / `watchedMovies` → `extended=full` ile çekiliyor
//     (`services/api/users/history.ts`), yani **`runtime` alanı MEVCUT**.
//   · `showProgressMap[traktId].completed` → o dizide izlenen bölüm sayısı.
//
// ⚠️ TRAKT'IN SAYISIYLA KÜÇÜK FARKLAR OLABİLİR — bilinçli ve kabul edilmiş:
//   1. Yeniden izlemeler: ✅ 1.0.1 Dal 3–4'te kapandı — bölümde de her izleme
//      (`play_minutes`, 081) süreye girer; sayım tekil kalır.
//   2. `showProgressMap` yalnızca ilerlemesi çekilmiş diziler için dolu.
//      Eksik dizi varsa sayı düşük görünür. 🔑 Bunu **T6** kökten çözecek
//      (okuma `user_*` tablolarından, tek istekte).
//   3. `runtime` bilinmeyen yapım süreye 0 katar (satır ATILMAZ — sayım yine
//      doğru, yalnızca süre eksik).
// Bu üçü de "hiçbir şey göstermemek"ten iyidir; sayım tarafı ZATEN doğru.

export interface IzlemeOzeti {
  /** İzlenen TEKİL öğe sayısı (bölüm / film). */
  watched: number;
  /** Toplam dakika — HER izleme (tekrarlar dahil). Bilinmeyen `runtime` 0 sayılır. */
  minutes: number;
  /** 1.0.1 Dal 4 · ek tekrar izleme sayısı: Σ max(izleme − 1, 0). */
  rewatches: number;
}

export interface YerelIstatistik {
  episodes: IzlemeOzeti;
  movies: IzlemeOzeti;
}

/** Güvenli pozitif tamsayı; `null`/metin/NaN → 0. */
function sayi(deger: unknown): number {
  const n = Number(deger);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

type IlerlemeOzeti = {
  aired?: number; completed?: number; watched_minutes?: number; play_minutes?: number; rewatch_plays?: number;
};

/**
 * Bir dizinin toplam izleme süresi. Öncelik (1.0.1 Dal 3–4):
 *   1. `play_minutes` (081) — HER izleme, sezon 0 dahil;
 *   2. `watched_minutes` (063) — tekil bölüm, 081 öncesi sunucu;
 *   3. tekil bölüm × dizinin ortalama `runtime`'ı (Trakt kaynaklı eski ilerleme).
 */
function diziDakikasi(ilerleme: IlerlemeOzeti | undefined, izlenen: number, diziRuntime: unknown): number {
  const izleme = Number(ilerleme?.play_minutes);
  if (Number.isFinite(izleme) && izleme >= 0 && ilerleme?.play_minutes !== undefined) return izleme;
  const tekil = Number(ilerleme?.watched_minutes);
  if (Number.isFinite(tekil) && tekil > 0) return tekil;
  return izlenen * sayi(diziRuntime);
}

/**
 * SAF — kütüphane deposundan izleme özetini hesaplar. Sayımlar TEKİL (bölüm/film), süre ve tekrar
 * HER izlemeyi kapsar. Tür dağılımı ayrı yerde tekil yapımdan hesaplanır (tekrar onu şişirmez).
 */
export function yerelIstatistik(
  watchedShows: any[] | null | undefined,
  watchedMovies: any[] | null | undefined,
  showProgressMap: Record<string | number, IlerlemeOzeti> | null | undefined,
): YerelIstatistik {
  let bolumSayisi = 0;
  let bolumDakika = 0;
  let bolumTekrar = 0;

  for (const kayit of watchedShows || []) {
    const dizi = kayit?.show;
    const traktId = dizi?.ids?.trakt;
    if (traktId === undefined || traktId === null) continue;

    const ilerleme = showProgressMap?.[traktId];
    const izlenen = sayi(ilerleme?.completed);
    const tekrar = sayi(ilerleme?.rewatch_plays);
    // Yalnız özel bölüm (sezon 0) izlenmiş dizi de süre/tekrar taşır; `completed` onu saymaz.
    if (!izlenen && !sayi(ilerleme?.play_minutes) && !tekrar) continue;

    bolumSayisi += izlenen;
    bolumDakika += diziDakikasi(ilerleme, izlenen, dizi?.runtime);
    bolumTekrar += tekrar;
  }

  let filmSayisi = 0;
  let filmDakika = 0;
  let filmTekrar = 0;

  for (const kayit of watchedMovies || []) {
    const film = kayit?.movie;
    if (!film) continue;
    filmSayisi += 1;
    const oynatma = Math.max(1, sayi(kayit?.plays));
    filmDakika += oynatma * sayi(film?.runtime);
    filmTekrar += oynatma - 1;
  }

  return {
    episodes: { watched: bolumSayisi, minutes: bolumDakika, rewatches: bolumTekrar },
    movies: { watched: filmSayisi, minutes: filmDakika, rewatches: filmTekrar },
  };
}

/**
 * SAF — gösterilecek istatistik: kendi verimizden hesap; hiç izleme yoksa `null` (bölüm gizlenir,
 * «0 / 0» yanıltıcı olurdu).
 *
 * 🔄 1.0.1 Dal 4 — önbellekteki Trakt `userStats` YEDEĞİ KALDIRILDI. T6.2'den (2026-09-14) beri hiç
 * tazelenmiyordu; kütüphanesi gerçekten boşalan kullanıcıya eski Trakt sayısını (ör. «7 bölüm ·
 * 280 dk») geri getiriyordu. İlk senkron bitene kadar bölümün gizli kalması yanlış sayıdan iyidir.
 * `userStats` mağazada bildirim zamanlayıcısı için duruyor (`features/notifications`).
 */
export function gosterilecekIstatistik(yerel: YerelIstatistik): YerelIstatistik | null {
  return yerel.episodes.watched > 0 || yerel.movies.watched > 0 || yerel.episodes.minutes > 0 ? yerel : null;
}
