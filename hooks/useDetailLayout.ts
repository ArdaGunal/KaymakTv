import { Platform, useWindowDimensions } from 'react-native';

/**
 * Dizi/film/bölüm DETAY ekranlarının masaüstü-web düzeni için tek ölçüm
 * kaynağı.
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
  /** (Kullanılmıyor, geriye dönük uyumluluk için var) Üstteki dekoratif arka plan görselinin yüksekliği. */
  bannerHeight: number;
  /** İçeriğin sayfanın en üstünden (tepeden) ne kadar aşağıda başlayacağı boşluk (margin-top). */
  contentOffset: number;
}

export function useDetailLayout(): DetailLayoutMetrics {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT;

  const contentWidth = Math.min(width - 48, MAX_CONTENT_WIDTH);
  const railWidth = clamp(Math.round(contentWidth * 0.32), 300, 384);
  
  // Tam ekran arka plan yapısına geçtiğimiz için bannerHeight eskisi gibi 
  // 'afiş yüksekliği' olarak kullanılmayacak.
  const bannerHeight = 0; 
  
  // İçerik kapsayıcısı ekranın neredeyse en üstünden (sadece 32px boşlukla) başlayacak
  const contentOffset = 32;

  return { isDesktopWeb, contentWidth, railWidth, bannerHeight, contentOffset };
}
