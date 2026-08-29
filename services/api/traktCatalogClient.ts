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
import { logWarning } from '../../utils/errorLog';

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

// --------------------------------------------------------------------------
// TEŞHİS (Madde 259-260)
// --------------------------------------------------------------------------
// 🔴 NEDEN GEREKLİ: L7'nin geri düşüşü BİLEREK sessizdir — geçit çalışmazsa
// kullanıcı hiçbir şey fark etmez, eski yol devreye girer. Ama bu sessizlik
// geliştirme sırasında da geçerliydi: cihazda `console.warn` görünmüyor,
// dolayısıyla "neden çalışmıyor" sorusunun cevabı hiçbir yerde yoktu.
//
// 🔴 EN KRİTİK VAKA — BAYRAK KAPALIYSA HİÇ HATA OLUŞMAZ: `EXPO_PUBLIC_*`
// build zamanında gömülür; bayrak APK'ya girmediyse geçit hiç DENENMEZ,
// yani hata da olmaz ve panel BOŞ kalır. Boş panel "sorun yok" değil
// "hiç denenmedi" anlamına gelirdi — teşhis edilemez bir durum. Bu yüzden
// yapılandırma durumu, hata olmasa bile oturumda BİR KEZ yazılır.
//
// `logWarning` (level: 'warn') kullanılıyor — yalnızca CİHAZDA kalır,
// Discord telemetrisine GİTMEZ (`utils/errorLog.ts`: uzak bildirim yalnızca
// 'error' seviyesinde). Teşhis gürültüsü operasyon kanalını kirletmemeli.

let yapilandirmaYazildi = false;

/** Oturumda bir kez: L7 açık mı, hangi adrese gidiyor? */
const logCatalogConfigOnce = () => {
  if (yapilandirmaYazildi) return;
  yapilandirmaYazildi = true;

  const acik = isTraktCatalogViaPiEnabled();
  logWarning('L7/yapilandirma', acik ? 'Katalog geçidi AÇIK' : 'Katalog geçidi KAPALI', {
    bayrak: acik ? 'acik' : 'KAPALI',
    // Ham değer: `undefined` görünüyorsa bayrak APK'ya HİÇ gömülmemiş demektir.
    bayrakHamDeger: String(process.env.EXPO_PUBLIC_TRAKT_CATALOG_VIA_PI),
    adres: CATALOG_URL,
    // Göreli yol native'de ÇALIŞMAZ — `EXPO_PUBLIC_API_URL` eksikse buradan anlaşılır.
    adresMutlakMi: CATALOG_URL.startsWith('http') ? 'evet' : 'HAYIR (native icin HATA)',
  });
};

/**
 * Katalog isteğini Pi üzerinden yapar.
 *
 * @param endpoint Trakt yolu — ör. `/shows/1388/seasons`
 * @param params   Query parametreleri (ör. `{ extended: 'full,episodes' }`)
 * @throws Pi'ye ulaşılamazsa / geçit reddederse — çağıran taraf ESKİ yola
 *         düşmekle yükümlü (bkz. `shows.ts` `getShowSeasons`).
 */
export const fetchTraktCatalog = async (endpoint: string, params: Record<string, string> = {}) => {
  logCatalogConfigOnce();

  const response = await axios.get(CATALOG_URL, {
    params: { ...params, endpoint },
    // Katalog verisi büyük olabiliyor (ölçüm: Breaking Bad sezonları
    // 63 KB ham) ve Pi soğukken Trakt'a gidiyor. Yine de bir üst sınır
    // şart: sonsuz bekleyen bir istek, dizi ekranını kilitli bırakırdı.
    timeout: 15000,
  });
  return response.data;
};

/** Bayrak kapalıyken de yapılandırmayı görebilmek için — `shows.ts` çağırır. */
export const reportCatalogConfig = logCatalogConfigOnce;

/**
 * Bir geçit hatasını teşhis edilebilir etiketlere çevirir.
 * En çok işe yarayan alan `durum`: 404 → uç yayında yok · 502/522 →
 * Pi'ye ulaşılamıyor · 403 → beyaz liste reddi · `ag-hatasi` → istek
 * hiç ulaşmadı (adres yanlış olabilir).
 */
export const catalogErrorTags = (error: any, extra: Record<string, string> = {}) => ({
  adres: CATALOG_URL,
  durum: error?.response?.status ? String(error.response.status) : 'ag-hatasi',
  mesaj: String(error?.message || '').slice(0, 120),
  ...extra,
});

/**
 * 🆕 L7+ — GEÇİT + GERİ DÜŞÜŞ deseninin TEK kopyası.
 *
 * L7'de bu desen yalnızca `getShowSeasons`'ta vardı ve elle yazılmıştı.
 * L7+ beyaz listeyi 8 uca çıkarınca aynı 12 satır 8 yere kopyalanacaktı —
 * `AI_RULES §2.5` bunu yasaklıyor, ve pratik sebebi şu: geri düşüş
 * mantığında ileride yapılacak bir düzeltme (ör. yalnızca belirli hata
 * kodlarında düşmek) 8 yerden 7'sinde unutulurdu.
 *
 * 🔴 SÖZLEŞME: bu fonksiyon ASLA geçit hatası fırlatmaz. Geçit çalışmazsa
 * `eskiYol()` çağrılır ve onun sonucu/hatası dışarı çıkar — yani çağıran
 * için davranış, bayrak kapalıymış gibi BİREBİR aynıdır. L7 istemciyi
 * değiştiren ilk fazdı; bir dizi ekranının açılmaması, önbellek
 * kazancından kat kat pahalıdır.
 *
 * @param etiket   Geliştirici Paneli'nde görünecek ad (ör. `L7/getShowSummary`)
 * @param endpoint Trakt yolu — ör. `/shows/1388/seasons`
 * @param params   Query parametreleri
 * @param eskiYol  Geçit kullanılamazsa çalıştırılacak ESKİ çağrı
 * @param etiketler Teşhis için ek etiketler (ör. `{ showId: '1388' }`)
 */
export const fetchCatalogOrFallback = async <T>(
  etiket: string,
  endpoint: string,
  params: Record<string, string>,
  eskiYol: () => Promise<T>,
  etiketler: Record<string, string> = {}
): Promise<T> => {
  // 🔴 Bayrak KAPALIYKEN de bir kez raporlanır — kapalıyken hiç hata
  // oluşmayacağı için panel boş kalır ve "sorun yok" ile "hiç denenmedi"
  // ayırt edilemezdi (yukarıdaki teşhis notu).
  logCatalogConfigOnce();

  if (isTraktCatalogViaPiEnabled()) {
    try {
      return (await fetchTraktCatalog(endpoint, params)) as T;
    } catch (error) {
      // `logWarning` → yalnızca cihazdaki günlük + Geliştirici Paneli;
      // Discord'a GİTMEZ (teşhis gürültüsü operasyon kanalını kirletmesin).
      logWarning(etiket, error, catalogErrorTags(error, { ...etiketler, sonuc: 'eski-yola-dusuldu' }));
      // bilinçli olarak yutuluyor — aşağıdaki eski yol denenecek
    }
  }

  return eskiYol();
};
