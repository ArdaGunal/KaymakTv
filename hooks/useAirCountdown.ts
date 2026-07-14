import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface CountdownResult {
  text: string;
  isAired: boolean;
}

/**
 * Verilen hedef yayın tarihine göre (ms cinsinden) kalan süreyi hesaplayan canlı sayaç hook'u.
 * Component mount olduktan sonra belirli aralıklarla (dakikada bir) kendini günceller.
 */
export const useAirCountdown = (targetDateMs?: number): CountdownResult => {
  const { t } = useTranslation('media');
  const [result, setResult] = useState<CountdownResult>(() => calculateTime(targetDateMs, t));

  useEffect(() => {
    if (!targetDateMs) return;

    // İlk hesaplamayı hemen yap
    setResult(calculateTime(targetDateMs, t));

    // Her 60 saniyede bir sayacı güncelle
    const interval = setInterval(() => {
      setResult(calculateTime(targetDateMs, t));
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, [targetDateMs]);

  return result;
};

// Saf hesaplama fonksiyonu (hook dışında, performansı korur)
const calculateTime = (targetDateMs: number | undefined, t: any): CountdownResult => {
  if (!targetDateMs) {
    return { text: '', isAired: false };
  }

  const now = new Date().getTime();
  const diffMs = targetDateMs - now;

  if (diffMs <= 0) {
    return { text: t('aired'), isAired: true };
  }

  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 24) {
    // 24 saatten az kaldıysa saat bazlı göster (Örn: "5 SAAT SONRA (20:00)")
    const targetDateObj = new Date(targetDateMs);
    const timeString = targetDateObj.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    const roundedHours = Math.floor(diffHours);
    
    if (roundedHours <= 0) {
        return { text: t('shortly', { time: timeString }), isAired: false };
    }
    return { text: t('hoursLater', { hours: roundedHours, time: timeString }), isAired: false };
  }

  // 1 günden fazla varsa gün bazlı göster
  return { text: t('daysLeft', { days: diffDays }), isAired: false };
};
