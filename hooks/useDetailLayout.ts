import { Platform, useWindowDimensions } from 'react-native';

/**
 * Dizi/film/bölüm DETAY ekranlarının masaüstü-web düzeni için tek ölçüm
 * kaynağı.
 *
 * 🔴 NEDEN VAR: bu ekranlar mobil için tasarlanmıştı ve genişliği hiçbir yerde
 * sınırlamıyorlardı. 1600-2560px'lik bir tarayıcıda metin satırları ekranın bir
 * ucundan diğerine uzanıyor, 110px'lik afiş kayboluyor ve tam genişlikteki
 * "Takip Et" butonu 2 metrelik bir çubuğa dönüşüyordu (kullanıcı "%50 ters zoom
 * yapmak zorunda kalıyoruz" diye bildirdi).
 *
 * ⚠️ `Platform.OS === 'web'` KONTROLÜ ŞART: yalnızca genişliğe bakmak,
 * tabletleri ve yatay moddaki katlanabilir telefonları da masaüstü sayar —
 * mobil düzen bilinçli olarak DOKUNULMADAN bırakılıyor.
 */

/** Bu genişliğin altında (veya native'de) her şey mevcut mobil düzende kalır. */
export const DESKTOP_BREAKPOINT = 1024;

/** İçeriğin asla aşamayacağı genişlik — sayfanın ortasında kalır. */
export const MAX_CONTENT_WIDTH = 1200;

/** İki sütun arası boşluk. */
export const COLUMN_GAP = 32;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export interface DetailLayoutMetrics {
  /** Masaüstü web düzeni aktif mi — TÜM web'e özel dalların tek koşulu. */
  isDesktopWeb: boolean;
  /** Ortalanmış kapsayıcının gerçek genişliği (≤ MAX_CONTENT_WIDTH). */
  contentWidth: number;
  /** Sağ sütun (sezon rayı) genişliği — toplamın ~%32'si, 300-384 arası. */
  railWidth: number;
  /** Üstteki dekoratif arka plan görselinin yüksekliği. */
  bannerHeight: number;
  /** İçeriğin banner üzerinde başladığı nokta (afiş bilinçli olarak taşar). */
  contentOffset: number;
}

export function useDetailLayout(): DetailLayoutMetrics {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT;

  // Yatay nefes payı: 1200'e ulaşmayan ekranlarda kenarlara yapışmasın.
  const contentWidth = Math.min(width - 48, MAX_CONTENT_WIDTH);
  const railWidth = clamp(Math.round(contentWidth * 0.32), 300, 384);
  // Banner ekranla birlikte büyür ama sınırlıdır. 🔴 Oran 0.26'dan 0.20'ye,
  // tavan 440'tan 340'a ÇEKİLDİ (kullanıcı geri bildirimi): kapak görseli
  // "sırıtıyor, içeriği kaplıyor"du — özellikle bölüm sayfasında, altındaki
  // bölüm karesiyle birlikte ilk ekranın tamamını yiyordu.
  const bannerHeight = clamp(Math.round(width * 0.20), 240, 340);
  // İçerik banner'ın alt kısmından başlar: afiş görselin üstüne BİNER
  // (kırpılmaz — bindirme ile kırpılma farklı şeyler) ve klasik detay
  // sayfası derinliği oluşur.
  const contentOffset = Math.round(bannerHeight * 0.44);

  return { isDesktopWeb, contentWidth, railWidth, bannerHeight, contentOffset };
}
