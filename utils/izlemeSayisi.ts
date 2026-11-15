// ==========================================================================
// İZLEME SAYISI — bölüm/film kaç kez izlendi (SAF · 1.0.1 Dal 4)
// ==========================================================================
// Kaynak sunucu: bölümde `plays` (081), filmde `plays` (074). 081 öncesi veride `plays` yoksa
// izlenmiş bölüm 1 sayılır (rozet çıkmaz, eski davranış).
// İyimser artış/azalış `services/library/mutations/optimistik*.ts`'te; burası yalnız okur.

type BolumBenzeri = { number?: number; completed?: boolean; plays?: number };
type IlerlemeBenzeri = { seasons?: { number?: number; episodes?: BolumBenzeri[] }[] } | null | undefined;
type FilmKaydi = { plays?: number; movie?: { ids?: { trakt?: number } } };

const bolumBul = (ilerleme: IlerlemeBenzeri, sezon: number, bolum: number) =>
  ilerleme?.seasons?.find((s) => s?.number === sezon)?.episodes?.find((b) => b?.number === bolum) ?? null;

/** Bir bölümün izleme sayısı: 0 = izlenmedi. */
export const bolumIzlemeSayisi = (b: BolumBenzeri | null | undefined): number => {
  if (!b?.completed) return 0;
  const n = Number(b.plays);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
};

export const ilerlemedenBolumSayisi = (ilerleme: IlerlemeBenzeri, sezon: number, bolum: number) =>
  bolumIzlemeSayisi(bolumBul(ilerleme, sezon, bolum));

const filmKaydi = (liste: FilmKaydi[] | null | undefined, filmId: number) =>
  (liste || []).find((k) => k?.movie?.ids?.trakt === filmId) ?? null;

/** Bir filmin izleme sayısı: 0 = izlenmedi. */
export const filmIzlemeSayisi = (liste: FilmKaydi[] | null | undefined, filmId: number): number => {
  const k = filmKaydi(liste, filmId);
  if (!k) return 0;
  const n = Number(k.plays);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
};

/** İşaretleme alanındaki küçük rozet: 2 ve üzeri için `2x`, aksi hâlde `null` (yalnız tik). */
export const izlemeRozeti = (plays: number): string | null => (plays >= 2 ? `${plays}x` : null);

/** «İzlendi» düğme metni: 2+ izlemede «İzlendi · 3x», aksi hâlde aynen. */
export const izlendiMetni = (izlendi: string, plays: number): string => {
  const rozet = izlemeRozeti(plays);
  return rozet ? `${izlendi} · ${rozet}` : izlendi;
};

/** Dizide (sezon 0 dahil) izlenmiş tek bölüm kaldı mı — yoksa dizi «izlenenler» listesinden düşer. */
export const izlemeKaldiMi = (ilerleme: IlerlemeBenzeri): boolean =>
  !!ilerleme?.seasons?.some((s) => s?.episodes?.some((b) => b?.completed));
