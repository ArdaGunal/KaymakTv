// ==========================================================================
// BÖLÜM İŞARETLEME — yeşil tik ne kadar tutulsun?  (M413)
// ==========================================================================
// `EpisodeCheckButton` basınca 550 ms yeşil kalıp söner. Bu, ekranın o
// sürede İYİMSER güncellemeyle zaten değişeceğini varsayar: bölüm satırı
// kalıcı tike, "sıradaki bölüm" kartı bir sonraki bölüme geçer.
//
// 🔴 VARSAYIMIN KIRILDIĞI YER — dizinin İLK işaretlemesi: mağazada o dizi
// için ilerleme kaydı yoksa `bolumleriIsaretle` bilinçli olarak `null`
// döner (bölüm listesi bilinmeden sahte kayıt uydurulmaz) ve kalıcı tik
// ancak sunucu turu bitince çizilir. Canlıda ölçülen boşluk ~2 sn: düğme
// 550 ms'de sönüyor, ~1,5 sn tik YOK görünüyor ("ilk basışta tik gidiyor").
// Üstelik düğme o boşlukta yeniden basılabilir → sunucuda İKİNCİ bir
// izleme kaydı (hayalet yeniden izleme, M318 sınıfı).
//
// ✅ KARAR: ilerleme kaydı YOKSA yeşil + kilit, işlem SONUÇLANANA kadar
// tutulur. Kayıt varsa davranış birebir eskisi (550 ms, ağı beklemez).

/** Mağazadaki bir dizi ilerlemesinin asgari biçimi. */
type IlerlemeBenzeri = { seasons?: unknown[] | null } | null | undefined;

/**
 * SAF — basış ANINDA okunur (mutasyon mağazayı değiştirmeden önce).
 * `true` → iyimser güncelleme YAPILAMAYACAK; düğme sonucu beklemeli.
 */
export const sonucuBeklemeli = (ilerleme: IlerlemeBenzeri): boolean =>
  !(Array.isArray(ilerleme?.seasons) && ilerleme!.seasons!.length > 0);
