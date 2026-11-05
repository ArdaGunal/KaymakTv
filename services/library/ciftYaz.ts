import { logError } from '../../utils/errorLog';

/**
 * 🔄 ÇİFT YAZMA — kütüphane yazımının tek kuralı (T6 kararı 2026-09-13; tüm aileler M575).
 *
 * Herkes BİZDEN okuyor (T6.3). Bu yüzden yazım önce bize gider: yalnız Trakt'a yazılsaydı
 * ekran fark turuna kadar görmez, silme ise hiç görmezdi (M575: silinen film geri geliyordu).
 *
 * 🔴 SIRA: önce bize. Bizimki düşerse hata çağırana gider, ekran geri alınır, Trakt'a gidilmez.
 * 🔴 Trakt düşerse bizimki GERİ ALINMAZ (M318): kalıcı yazılmış işlemi ekrandan silmek
 * kullanıcıyı tekrar denemeye iter. Yutulur ama `logError` ile iz kalır.
 *
 * @param trakte Google-only kullanıcıda `null`: Trakt token'ı yok.
 */
export const ciftYaz = async (
  bize: () => Promise<unknown>,
  trakte: (() => Promise<unknown>) | null,
): Promise<void> => {
  await bize();
  if (!trakte) return;
  try {
    await trakte();
  } catch (error) {
    logError('kutuphane.ciftYaz.trakt', error);
  }
};
