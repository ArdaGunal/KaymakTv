/**
 * Puanı görüntüye uygun formatta göster.
 * - 5 puanında: "5" (5.0 değil)
 * - 3.5 puanında: "3.5" (olduğu gibi)
 *
 * @param numericRating - 1-10 arası Trakt API'den gelen puan
 * @returns Formatlanmış puan (örn. "5", "3.5", "-")
 */
export const formatRating = (numericRating: number | null | undefined): string => {
  if (numericRating === null || numericRating === undefined) {
    return '-';
  }
  const num = numericRating / 2;
  // Tam sayı ise ondalık kısım gösterme
  return Number.isInteger(num) ? Math.floor(num).toString() : num.toFixed(1);
};
