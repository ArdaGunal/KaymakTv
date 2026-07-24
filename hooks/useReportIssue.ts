import Constants from 'expo-constants';
import { useCallback, useState } from 'react';
import { Platform } from 'react-native';

import { useAuth } from '../context/AuthContext';
import { sendFeedback } from '../services/api/feedback';
import { useFeedbackStore } from '../store/useFeedbackStore';
import { getErrorLog } from '../utils/errorLog';
import { sanitizeText } from '../utils/sanitize';

const COOLDOWN_MS = 3 * 60 * 1000;

export type ReportIssueResult =
  | { success: true }
  | { success: false; reason: 'cooldown' | 'empty' | 'error' };

export interface UseReportIssueResult {
  message: string;
  setMessage: (value: string) => void;
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
      const errorLogs = includeLogs ? await getErrorLog() : [];
      const deviceInfo = `${Platform.OS} ${Platform.Version} · v${Constants.expoConfig?.version ?? '?'}`;

      await sendFeedback({
        userMessage: sanitizeText(message.trim()),
        errorLogs: JSON.parse(sanitizeText(JSON.stringify(errorLogs))),
        deviceInfo: sanitizeText(deviceInfo),
        userId: isGuest ? `guest-${anonymousId}` : anonymousId,
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
  }, [message, includeLogs, remainingCooldownMs, anonymousId, isGuest, setLastSentAt]);

  return {
    message,
    setMessage,
    includeLogs,
    setIncludeLogs,
    isSubmitting,
    remainingCooldownMs,
    handleSubmit,
  };
}
