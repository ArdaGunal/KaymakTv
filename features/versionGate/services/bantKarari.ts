/**
 * Saf — sınanır. «Yeni sürüm var» bandının kararı (`hooks/useSoftUpdate.ts`).
 *  - `zorunlu`: yapı `min_required_build`'den küçük → bant ertelemeye bakmadan açılır
 *    (engel ekranı oturum içinde açılmaz, 2.6.5 madde 8; bir sonraki soğuk açılışta gelir).
 *  - `istege_bagli`: yapı `latest_build`'den küçük → bant, kullanıcı ertelemediyse.
 *  - `yok`: yapı bilinmiyor, sınır yok ya da güncel.
 */
export type BantKarari = 'zorunlu' | 'istege_bagli' | 'yok';

export function bantGosterilsinMi(
  kuruluYapi: number | null,
  ayar: { minRequiredBuild: number | null; latestBuild: number | null } | null,
): BantKarari {
  if (kuruluYapi === null || !ayar) return 'yok';
  if (ayar.minRequiredBuild && kuruluYapi < ayar.minRequiredBuild) return 'zorunlu';
  if (ayar.latestBuild && kuruluYapi < ayar.latestBuild) return 'istege_bagli';
  return 'yok';
}
