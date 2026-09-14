/**
 * Tarih ve zamanla ilgili ortak saf (pure) fonksiyonlar.
 * Bu dosya, Saat hesaplamalarının farklı dosyalarda çakışmasını önler.
 */

import i18n from '../locales';

/**
 * Verilen tarihi "BUGÜN - 5 KASIM ÇARŞAMBA", "YARIN - ..." 
 * veya normal "5 KASIM ÇARŞAMBA" formatına çevirir.
 */
export const getDateGroup = (dateObj: Date, t?: any): string => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const locale = i18n?.language === 'en' ? 'en-US' : 'tr-TR';
  
  const fullDateStr = dateObj.toLocaleDateString(locale, { 
    day: 'numeric', 
    month: 'long', 
    weekday: 'long' 
  }).toUpperCase();

  if (dateObj.toDateString() === today.toDateString()) {
    return (t ? t('today') : 'BUGÜN') + ' - ' + fullDateStr;
  } else if (dateObj.toDateString() === tomorrow.toDateString()) {
    return (t ? t('tomorrow') : 'YARIN') + ' - ' + fullDateStr;
  }
  
  // Eğer t fonksiyonu verilmişse ve günden fazlaysa yanına sayacı ekle
  if (t) {
    const diffTime = dateObj.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays > 1) {
      return `${fullDateStr} (${t('daysLeft', { days: diffDays })})`;
    }
  }
  
  return fullDateStr;
};

/**
 * Verilen bir tarih dizgesinin (veya objesinin) bugünden ileri bir tarih olup olmadığını kontrol eder.
 * @param dateStr Kontrol edilecek tarih (ISO formatı veya string)
 * @returns Gelecekte ise true döner.
 */
export const isFutureDate = (dateStr: string | null | undefined): boolean => {
  if (!dateStr) return false;
  try {
    const dateObj = new Date(dateStr);
    if (isNaN(dateObj.getTime())) return false;
    
    // Bugünden ileri mi?
    return dateObj.getTime() > new Date().getTime();
  } catch {
    return false;
  }
};

/**
 * Takvim ve Progress API'lerinden gelen verileri aynı formatta 
 * eşleştirmek için birleştirici/normalize edici Unique Key oluşturur.
 */
export const getEpisodeKey = (traktId: number | string, season: number, episode: number): string => {
  return `${traktId}-${season}-${episode}`;
};

/**
 * Film ÇIKIŞ TARİHİNİ ekranda gösterilecek biçime çevirir: gün-ay-yıl.
 *
 * 🔴 NEDEN BURADA, SUNUCUDA DEĞİL: `movie.released` makine tarafından da
 * okunuyor (`isFutureDate`, `new Date(...)`). Sunucu biçimlenmiş bir dize
 * gönderseydi o iki çağrı `NaN` alırdı ve film takvimden TAMAMEN düşerdi.
 * Sunucu `YYYY-MM-DD` (makine), ekran bu fonksiyon (insan).
 *
 * ⚠️ YEREL-DUYARLI, sabit biçim DEĞİL: `getDateGroup` de öyle yapıyor.
 * tr → "18.12.2026" · en → "12/18/2026". Kullanıcının istediği gün-ay-yıl
 * Türkçede zaten bu; İngilizcede o dilin kendi sırası doğru olan.
 *
 * 🔴 "YYYY-MM-DD" ELDE AYRIŞTIRILIYOR: `new Date("2026-12-18")` değeri
 * UTC gece yarısı sayar; UTC'nin gerisindeki bir saat diliminde tarih bir
 * gün GERİ kayardı. Parçalayıp yerel tarih kurmak bunu kapatıyor.
 */
export const cikisTarihiBicimle = (ham?: string | null): string => {
  if (!ham) return '';
  const m = String(ham).match(/^(d{4})-(d{2})-(d{2})/);
  const d = m
    ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    : new Date(ham);
  if (Number.isNaN(d.getTime())) return '';
  const locale = i18n?.language === 'en' ? 'en-US' : 'tr-TR';
  return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
};
