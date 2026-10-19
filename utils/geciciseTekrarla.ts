import { geciciHataNedeni } from './geciciHata';

/**
 * HIZ-01 (M542) — geçici ağ hatasında BİR KEZ sessiz yeniden deneme.
 *
 * Canlı ölçüm (2026-10-19, AG test APK + geliştirici paneli): oturumun ilk Worker istekleri
 * takılan bir bağlantıda ~20 sn bekleyip düşüyor (`/library/sync` 502, `/library/takvim` ağ
 * hatası), aynı istek bir saniye sonra 1 sn'de dönüyordu. İlk geçici hatada kullanıcıya sarı
 * uyarı göstermek / Trakt'a düşmek yerine istek bir kez daha atılır; uyarı yalnız İKİNCİ deneme
 * de düşerse çıkar.
 *
 * 🔴 YALNIZ SALT-OKUR istekler için — ilk deneme sunucuda işlenmiş olabilir; yazan bir isteği
 * tekrarlamak çift kayıt üretebilir. «Geçici» ölçütü `geciciHataNedeni`nin DAR listesi
 * (ağ hatası, zaman aşımı, 502/503/504/522/524); 4xx/500 gerçek hatadır, tekrarlanmaz.
 * `canceled` (çağıranın kendi iptali) de tekrarlanmaz.
 */
export async function geciciseBirKezDaha<T>(
  is: () => Promise<T>,
  bekleMs = 300,
): Promise<T> {
  try {
    return await is();
  } catch (hata) {
    const neden = geciciHataNedeni(hata);
    if (!neden || neden === 'canceled' || neden === 'ERR_CANCELED') throw hata;
    console.warn(`[geciciseBirKezDaha] geçici hata (${neden}), bir kez daha deneniyor`);
    if (bekleMs > 0) await new Promise((coz) => setTimeout(coz, bekleMs));
    return is();
  }
}
