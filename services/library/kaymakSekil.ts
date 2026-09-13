// ==========================================================================
// KAYMAK KÜTÜPHANE YANITI → MAĞAZA ŞEKLİ (SAF)
// ==========================================================================
// 🔴 NEDEN AYRI DOSYA: `kaymakSync.ts` `services/api/library`'yi (dolayısıyla
// `axios`'u) içe aktarıyor ve test koşucusu DÜZ NODE — o dosya orada
// YÜKLENEMİYOR. Bu şekillendirici zaten *"SAF — ağ yok, yan etki yok, test
// edilebilir"* diye yazılmıştı ama pratikte test EDİLEMİYORDU; §C17.2'de
// `runtime` alanının sessizce düşmesi tam bu boşlukta oldu.
// `services/api/traktImportCekirdek.ts`'in gerekçesiyle aynı ayrım.
//
// ⚠️ Tip içe aktarımı `import type` — derlemede SİLİNİR, çalışma zamanında
// `axios` yüklenmez. Buraya normal bir `import` eklemek dosyayı yeniden test
// dışına atar.

import type { KutuphaneYaniti } from '../api/library';

/** `watchedShows`/`watchedMovies` girdilerinin beklediği yapım nesnesi. */
const yapimNesnesi = (k: {
  traktId: number; title: string | null; year: number | null;
  tmdbId: number | null; runtime?: number | null; genres?: string[] | null;
}) => ({
  // 🔴 `ids.trakt` ZORUNLU — mağazanın TÜM anahtarlaması bunun üzerinde
  // (`trackingLogic.ts:146`). `ids.tmdb` posterin tek dayanağı.
  ids: { trakt: k.traktId, tmdb: k.tmdbId ?? undefined },
  title: k.title ?? '',
  year: k.year ?? undefined,
  // 🔑 §C17.2 — İSTATİSTİĞİN SÜRE AYAĞI. Bu alan yokken Google hesabında
  // "kaç saat izledin" HEP 0 çıkıyordu: `utils/yerelIstatistik.ts` süreyi
  // `show.runtime`/`movie.runtime` üzerinden hesaplıyor ve Kaymak yolunda o
  // alan hiç doldurulmuyordu (sayım doğruydu, yalnızca süre sıfırdı).
  // Trakt yolunda `extended=full` bunu zaten veriyordu — iki yol artık eşit.
  runtime: k.runtime ?? undefined,
  // 🔑 §C18 — "favori tür" istatistiğinin tek kaynağı
  // (`useProfileStatistics.ts` → `entry.media?.genres`). Trakt yolu bunu
  // `extended=full` ile alıyordu; Kaymak yolunda alan HİÇ yoktu ve tür
  // bölümü Google hesabında BOŞ kalıyordu. `runtime`'ın (§C17.2) ikizi.
  // ⚠️ Boş dizi DEĞİL `undefined`: `entry.media?.genres` kontrolü ikisini de
  // atlıyor ama `undefined` "bilinmiyor" demek, `[]` "türü yok" demek olurdu.
  genres: k.genres && k.genres.length > 0 ? k.genres : undefined,
});

/**
 * Yanıtı mağaza şekline çevirir. SAF — ağ yok, yan etki yok, test edilebilir.
 */
export const yanitiSekillendir = (yanit: KutuphaneYaniti) => {
  const watchedShows = (yanit.diziler || []).map((d) => ({
    show: yapimNesnesi(d),
    // `trackingLogic` "Ara Verilenler" kovasını bu tarihe göre ayırıyor
    // (45 günden eski). `null` bırakmak diziyi yanlış kovaya atardı.
    last_watched_at: d.ilerleme?.last_watched_at ?? null,
  }));

  const showProgressMap: Record<number, any> = {};
  for (const d of yanit.diziler || []) {
    if (d?.traktId) showProgressMap[d.traktId] = d.ilerleme;
  }

  const watchedMovies = (yanit.filmler || []).map((f) => ({
    plays: f.plays ?? 1,
    last_watched_at: f.last_watched_at ?? null,
    movie: yapimNesnesi(f),
  }));

  return { watchedShows, showProgressMap, watchedMovies };
};
