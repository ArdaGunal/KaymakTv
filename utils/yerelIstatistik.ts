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
//   1. Yeniden izlemeler: `completed` TEKİL bölüm sayar, Trakt `minutes`'ı
//      oynatma (`plays`) üzerinden hesaplar. Filmlerde `plays` elimizde
//      olduğu için kullanılıyor; bölümlerde o kırılım yok → süre biraz DÜŞÜK
//      çıkabilir.
//   2. `showProgressMap` yalnızca ilerlemesi çekilmiş diziler için dolu.
//      Eksik dizi varsa sayı düşük görünür. 🔑 Bunu **T6** kökten çözecek
//      (okuma `user_*` tablolarından, tek istekte).
//   3. `runtime` bilinmeyen yapım süreye 0 katar (satır ATILMAZ — sayım yine
//      doğru, yalnızca süre eksik).
// Bu üçü de "hiçbir şey göstermemek"ten iyidir; sayım tarafı ZATEN doğru.

export interface IzlemeOzeti {
  /** İzlenen TEKİL öğe sayısı (bölüm / film). */
  watched: number;
  /** Toplam dakika. Bilinmeyen `runtime` 0 sayılır. */
  minutes: number;
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

/**
 * SAF — kütüphane deposundan izleme özetini hesaplar.
 *
 * Çıktı `/users/me/stats`'ın kullandığımız alt kümesiyle AYNI ŞEKİLDE, böylece
 * çağıran taraf `userStats ?? yerelIstatistik(...)` diyebiliyor ve iki ayrı
 * gösterim yolu doğmuyor.
 */
export function yerelIstatistik(
  watchedShows: any[] | null | undefined,
  watchedMovies: any[] | null | undefined,
  showProgressMap: Record<string | number, { aired?: number; completed?: number }> | null | undefined,
): YerelIstatistik {
  let bolumSayisi = 0;
  let bolumDakika = 0;

  for (const kayit of watchedShows || []) {
    const dizi = kayit?.show;
    const traktId = dizi?.ids?.trakt;
    if (traktId === undefined || traktId === null) continue;

    const ilerleme = showProgressMap?.[traktId];
    const izlenen = sayi(ilerleme?.completed);
    if (!izlenen) continue;

    bolumSayisi += izlenen;
    // 🔑 Dizideki `runtime` BÖLÜM BAŞINA süredir (Trakt `extended=full`).
    bolumDakika += izlenen * sayi(dizi?.runtime);
  }

  let filmSayisi = 0;
  let filmDakika = 0;

  for (const kayit of watchedMovies || []) {
    const film = kayit?.movie;
    if (!film) continue;
    filmSayisi += 1;
    // Filmde yeniden izleme sayısı elimizde: süreye onu katıyoruz ama
    // `watched` TEKİL kalıyor — Trakt'ın `watched`/`plays` ayrımı böyle.
    const oynatma = Math.max(1, sayi(kayit?.plays));
    filmDakika += oynatma * sayi(film?.runtime);
  }

  return {
    episodes: { watched: bolumSayisi, minutes: bolumDakika },
    movies: { watched: filmSayisi, minutes: filmDakika },
  };
}

/**
 * SAF — gösterilecek istatistik: sunucudan geleni TERCİH ET, yoksa yereli kullan.
 *
 * 🔴 SIRALAMA BİLİNÇLİ: Trakt'ın sayısı yeniden izlemeleri ve bizde ilerlemesi
 * çekilmemiş dizileri de kapsıyor, yani DAHA DOĞRU. Yerel hesap bir yedek;
 * Trakt'lı kullanıcıda davranış DEĞİŞMİYOR, Google'lı kullanıcıda ise bölüm
 * artık boş kalmıyor.
 *
 * Hiç veri yoksa `null` — çağıran bölümü gizler (0/0 göstermek yanıltıcı olurdu).
 */
export function gosterilecekIstatistik(
  userStats: any | null | undefined,
  yerel: YerelIstatistik,
): YerelIstatistik | null {
  if (userStats?.episodes || userStats?.movies) {
    return {
      episodes: {
        watched: sayi(userStats?.episodes?.watched),
        minutes: sayi(userStats?.episodes?.minutes),
      },
      movies: {
        watched: sayi(userStats?.movies?.watched),
        minutes: sayi(userStats?.movies?.minutes),
      },
    };
  }
  if (yerel.episodes.watched === 0 && yerel.movies.watched === 0) return null;
  return yerel;
}
