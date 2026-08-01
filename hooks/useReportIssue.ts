import Constants from 'expo-constants';
import { useCallback, useState } from 'react';
import { Platform } from 'react-native';

import { useAuth } from '../context/AuthContext';
import { FeedbackCategory, sendFeedback } from '../services/api/feedback';
import { useFeedbackStore } from '../store/useFeedbackStore';
import { getErrorLog } from '../utils/errorLog';
import { exportMetricsReport } from '../utils/metrics';
import { sanitizeText } from '../utils/sanitize';

const COOLDOWN_MS = 3 * 60 * 1000;

export type ReportIssueResult =
  | { success: true }
  | { success: false; reason: 'cooldown' | 'empty' | 'error' };

export interface UseReportIssueResult {
  message: string;
  setMessage: (value: string) => void;
  /** Geri bildirim türü: 'bug' = Hata / Problem, 'feature' = İstek / Öneri */
  category: FeedbackCategory;
  setCategory: (value: FeedbackCategory) => void;
  /** Yalnızca `category === 'bug'` olduğunda anlamlıdır ve gösterilir. */
  includeLogs: boolean;
  setIncludeLogs: (value: boolean) => void;
  isSubmitting: boolean;
  /** Bir sonraki gönderime kalan süre (ms). 0 ise gönderilebilir. */
  remainingCooldownMs: number;
  handleSubmit: () => Promise<ReportIssueResult>;
}

export function useReportIssue(): UseReportIssueResult {
  const { isGuest } = useAuth();
  const anonymousId = useFeedbackStore((s) => s.anonymousId);
  const lastSentAt = useFeedbackStore((s) => s.lastSentAt);
  const setLastSentAt = useFeedbackStore((s) => s.setLastSentAt);

  const [message, setMessage] = useState('');
  const [category, setCategory] = useState<FeedbackCategory>('bug');
  // `includeLogs` yalnızca hata bildiriminde etkindir. Kategori 'feature'
  // olduğunda bu değer handleSubmit'te zorla false'a düşürülür — kullanıcıya
  // gereksiz yere log gönderilmez.
  const [includeLogs, setIncludeLogs] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const remainingCooldownMs = lastSentAt
    ? Math.max(0, COOLDOWN_MS - (Date.now() - lastSentAt))
    : 0;

  const handleSubmit = useCallback(async (): Promise<ReportIssueResult> => {
    if (remainingCooldownMs > 0) {
      return { success: false, reason: 'cooldown' };
    }
    if (!message.trim()) {
      return { success: false, reason: 'empty' };
    }

    setIsSubmitting(true);
    try {
      // İstek/Öneri kategorisinde log ve performans raporu gönderilmez.
      const shouldSendLogs = category === 'bug' && includeLogs;

      const errorLogs = shouldSendLogs ? await getErrorLog() : [];
      const deviceInfo = `${Platform.OS} ${Platform.Version} · v${Constants.expoConfig?.version ?? '?'}`;

      // Aynı "Hata loglarımı da gönder" onayına bağlı — ayrı bir izin
      // istenmiyor (bkz. docs/HISTORY.md). Performans raporunun toplanması
      // başarısız olursa (ör. metricsStore bozuk), bu ASIL bildirim gönderimini
      // ENGELLEMEMELİ — sadece o alan boş kalır.
      let performanceReport: unknown = null;
      if (shouldSendLogs) {
        try {
          performanceReport = JSON.parse(await exportMetricsReport());
        } catch (metricsError) {
          console.warn('[useReportIssue] Performans raporu eklenemedi:', metricsError);
        }
      }

      await sendFeedback({
        userMessage: sanitizeText(message.trim()),
        errorLogs: JSON.parse(sanitizeText(JSON.stringify(errorLogs))),
        performanceReport: performanceReport
          ? JSON.parse(sanitizeText(JSON.stringify(performanceReport)))
          : null,
        deviceInfo: sanitizeText(deviceInfo),
        userId: isGuest ? `guest-${anonymousId}` : anonymousId,
        category,
      });

      setLastSentAt(Date.now());
      setMessage('');
      return { success: true };
    } catch (error) {
      console.error('[useReportIssue] submit error:', error);
      return { success: false, reason: 'error' };
    } finally {
      setIsSubmitting(false);
    }
  }, [message, category, includeLogs, remainingCooldownMs, anonymousId, isGuest, setLastSentAt]);

  return {
    message,
    setMessage,
    category,
    setCategory,
    includeLogs,
    setIncludeLogs,
    isSubmitting,
    remainingCooldownMs,
    handleSubmit,
  };
}
