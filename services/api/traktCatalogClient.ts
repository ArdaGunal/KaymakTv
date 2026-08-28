// ==========================================================================
// TRAKT KATALOG İSTEMCİSİ (LazyFetch L7)
// ==========================================================================
// TEK İŞİ: PUBLIC katalog çağrılarını Pi'nin `/api/trakt-catalog` ucuna
// yönlendirmek. Bugüne kadar bu istekler `api.trakt.tv`'ye DOĞRUDAN
// gidiyordu — yani Pi Trakt katalog trafiğinin sıfırını görüyordu
// (`docs/Lazy Down Plan/00_BULGULAR.md §1`, ölçüldü).
//
// 🔴 NEDEN AYRI BİR DOSYA VE AYRI BİR AXIOS INSTANCE:
// `services/api/traktClient.ts` uygulamanın EN SICAK kod yolu — 401→refresh
// zinciri, istek kuyruğu, devre kesici hepsi ona bağlı. Katalog çağrılarını
// oraya karıştırmak, kullanıcıya özel akışları (senkron, puanlama, takip)
// riske atardı. Bu dosya o instance'a HİÇ dokunmaz.
//
// 🔴 BU İSTEMCİ TOKEN GÖNDERMEZ. Katalog verisi kimlikten bağımsızdır;
// sunucu tarafı da (`server/lazyfetch/providers/trakt.js`) `Authorization`
// başlığını yapısal olarak gönderemez. Misafir ve Google-only kullanıcılar
// da bu yüzden aynı yanıtı alabiliyor.
//
// 🔴 GERİ DÜŞÜŞ ZORUNLU: Pi'ye giden yol herhangi bir sebeple (ağ, 403,
// 503, yanlış yapılandırma) çalışmazsa çağrı ESKİ yola — doğrudan Trakt'a —
// düşer. L7, L1-L6'nın aksine istemciyi değiştiren ilk faz; bir hata tüm
// kullanıcıların dizi ekranını kırabilirdi. Bayrak kapalıyken bu dosya
// zaten hiç devreye girmez.

import axios from 'axios';

// `TMDB_PROXY_URL` ile BİREBİR aynı desen (services/tmdbApi.ts:12):
// native derlemelerde cihazın sunucuya ulaşacağı mutlak adres gerekir;
// web'de aynı origin'den servis edildiği için göreli yol yeterli.
const CATALOG_URL = process.env.EXPO_PUBLIC_API_URL
  ? `${process.env.EXPO_PUBLIC_API_URL}/api/trakt-catalog`
  : '/api/trakt-catalog';

/**
 * Katalog geçidi AÇIK mı?
 *
 * Varsayılan KAPALI — açık bir tercih olmadan istemci davranışı
 * değişmesin (03_FAZLAR.md L7 adım 3). Açmak için `.env`:
 *   EXPO_PUBLIC_TRAKT_CATALOG_VIA_PI=1
 */
export const isTraktCatalogViaPiEnabled = (): boolean =>
  process.env.EXPO_PUBLIC_TRAKT_CATALOG_VIA_PI === '1';

/**
 * Katalog isteğini Pi üzerinden yapar.
 *
 * @param endpoint Trakt yolu — ör. `/shows/1388/seasons`
 * @param params   Query parametreleri (ör. `{ extended: 'full,episodes' }`)
 * @throws Pi'ye ulaşılamazsa / geçit reddederse — çağıran taraf ESKİ yola
 *         düşmekle yükümlü (bkz. `shows.ts` `getShowSeasons`).
 */
export const fetchTraktCatalog = async (endpoint: string, params: Record<string, string> = {}) => {
  const response = await axios.get(CATALOG_URL, {
    params: { ...params, endpoint },
    // Katalog verisi büyük olabiliyor (ölçüm: Breaking Bad sezonları
    // 63 KB ham) ve Pi soğukken Trakt'a gidiyor. Yine de bir üst sınır
    // şart: sonsuz bekleyen bir istek, dizi ekranını kilitli bırakırdı.
    timeout: 15000,
  });
  return response.data;
};
