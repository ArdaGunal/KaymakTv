// ==========================================================================
// SEZON EVRENİ — işaretleme kararlarının ekran tarafındaki tek kaynağı (M425)
// ==========================================================================
// `useShowDetail` → `computedSeasons` (katalog + ilerleme birleşimi) iki ayrı
// biçime çevriliyor:
//
//   • `tumSezonlar`    — YAYINLANMIŞ bölüm numaraları. "Öncekileri de
//                        işaretle" planı (M421) bunun üzerine kuruluyor.
//   • `iskeletSezonlar`— TÜM bölümler + `first_aired`. Mağazada o dizinin
//                        ilerlemesi YOKKEN iyimser iskelet (M422) bundan
//                        kuruluyor; olmazsa ekran sunucu turunu bekler ve
//                        kullanıcı "işaretledim, tik kayboldu" görür.
//
// 🔴 NEDEN ORTAK DOSYA (M425): bu türetme `app/show/[id].tsx` içinde elle
// yazılmıştı ve MOBİL dalda kalmıştı. Web ayrı bir ağaçtan geçiyor
// (`SeasonsRailWeb` → `SeasonAccordion`) ve bu iki alanı HİÇ almıyordu; yani
// M420/M421/M422'nin üçü de webde devrede DEĞİLDİ. Üçüncü çağıran
// (`app/episode/[id].tsx`) da aynı raya bağlı. Kopyalamak yerine tek yer.

/** `isEpisodeAired` ile AYNI kural (SeasonAccordion satır rozetiyle tutarlı). */
const yayinlandi = (ep: any, airedCount: number): boolean =>
  ep?.first_aired ? new Date(ep.first_aired) <= new Date() : ep?.number <= airedCount;

export type SezonEvreni = {
  tumSezonlar: { sezon: number; bolumler: number[] }[];
  iskeletSezonlar: { number: number; episodes: { number: number; first_aired: string | null; title: string | null }[] }[];
};

/** SAF — ekranın sezon verisinden iki türev. Girdi yoksa boş listeler. */
export function sezonEvreniKur(computedSeasons: any[] | null | undefined): SezonEvreni {
  const sezonlar = Array.isArray(computedSeasons) ? computedSeasons : [];

  return {
    tumSezonlar: sezonlar.map((s: any) => ({
      sezon: s?.number,
      bolumler: (s?.episodes || [])
        .filter((ep: any) => yayinlandi(ep, s?.aired_episodes || 0))
        .map((ep: any) => ep?.number)
        .filter((n: any) => typeof n === 'number'),
    })).filter((s) => typeof s.sezon === 'number'),

    iskeletSezonlar: sezonlar
      .filter((s: any) => typeof s?.number === 'number')
      .map((s: any) => ({
        number: s.number,
        episodes: (s?.episodes || [])
          .filter((ep: any) => typeof ep?.number === 'number')
          .map((ep: any) => ({
            number: ep.number,
            first_aired: ep.first_aired ?? null,
            title: ep.title ?? null,
          })),
      })),
  };
}
