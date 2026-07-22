import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useGlobalCountdownStore,
  subscribeToGlobalCountdown,
  unsubscribeFromGlobalCountdown,
} from '../store/useGlobalCountdownStore';

interface CountdownResult {
  text: string;
  isAired: boolean;
}

/**
 * Verilen hedef yayın tarihine göre (ms cinsinden) kalan süreyi hesaplayan canlı sayaç hook'u.
 * ESKİ DAVRANIŞ: her çağıran bileşen kendi setInterval(60s)'ını açıyordu — ekranda
 * onlarca kart varsa aynı sayıda timer RAM'de birikip cihazı yavaşlatıyordu. Artık
 * TEK bir paylaşılan global tick (useGlobalCountdownStore) kullanılıyor; bu hook
 * yalnızca abone olup o paylaşılan "şu an" değerinden kendi metnini hesaplıyor.
 */
export const useAirCountdown = (targetDateMs?: number): CountdownResult => {
  const { t } = useTranslation('media');
  const now = useGlobalCountdownStore((s) => s.now);

  useEffect(() => {
    if (!targetDateMs) return;
    subscribeToGlobalCountdown();
    return () => unsubscribeFromGlobalCountdown();
  }, [targetDateMs]);

  return useMemo(() => calculateTime(targetDateMs, now, t), [targetDateMs, now, t]);
};

// Saf hesaplama fonksiyonu (hook dışında, performansı korur)
const calculateTime = (targetDateMs: number | undefined, now: number, t: any): CountdownResult => {
  if (!targetDateMs) {
    return { text: '', isAired: false };
  }

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
