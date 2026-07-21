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
