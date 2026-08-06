import Constants from 'expo-constants';
import { useCallback, useState } from 'react';
import { Platform } from 'react-native';

import { useAuth } from '../context/AuthContext';
import { sendFeedback } from '../services/api/feedback';
import { useFeedbackStore } from '../store/useFeedbackStore';
import { exportMetricsReport } from '../utils/metrics';
import { sanitizeText } from '../utils/sanitize';
import type { LoggedError } from '../utils/errorLog';
import type { PerfMark } from '../utils/perfLog';

// `hooks/useReportIssue.ts`teki kullanıcı geri bildirimiyle AYNI kuyruğu
// (aynı Supabase tablosu + aynı Discord kanalı — bkz. services/api/feedback.ts
// başlığı) ve AYNI 3 dakikalık soğuma penceresini paylaşır: ikisi de sonuçta
// tek bir bildirim hattına yazıyor, ayrı bir spam koruması icat etmeye gerek yok.
const COOLDOWN_MS = 3 * 60 * 1000;

export type SendDevReportResult =
  | { success: true }
  | { success: false; reason: 'cooldown' | 'error' };

export interface UseSendDevReportResult {
  isSending: boolean;
  /** Bir sonraki gönderime kalan süre (ms). 0 ise gönderilebilir. */
  remainingCooldownMs: number;
  handleSend: (perfEntries: PerfMark[], errorEntries: LoggedError[]) => Promise<SendDevReportResult>;
}

/**
 * Geliştirici Paneli'ndeki "Raporu Gönder" butonunun mantığı. Kullanıcıya
 * hiçbir yerde "Discord'a gönder" DENMEZ (bkz. görev talebi) — bu yalnızca
 * mevcut geri bildirim borusunun (`sendFeedback` → Cloudflare Worker →
 * Supabase `error_logs` + Discord embed) `category: 'bug'` ile ikinci bir
 * çağrı noktası. Worker zaten hem Supabase'e (ham veri, karakter sınırı yok)
 * hem Discord'a (özet + "kaydedildi" durumu) yazıyor — burada YENİ bir arka
 * uç KURULMUYOR, var olanı Geliştirici Paneli'nden de tetiklenebilir hale
 * getiriyoruz.
 */
export function useSendDevReport(): UseSendDevReportResult {
  const { isGuest } = useAuth();
  const anonymousId = useFeedbackStore((s) => s.anonymousId);
  const lastSentAt = useFeedbackStore((s) => s.lastSentAt);
  const setLastSentAt = useFeedbackStore((s) => s.setLastSentAt);
  const [isSending, setIsSending] = useState(false);

  const remainingCooldownMs = lastSentAt
    ? Math.max(0, COOLDOWN_MS - (Date.now() - lastSentAt))
    : 0;

  const handleSend = useCallback(
    async (perfEntries: PerfMark[], errorEntries: LoggedError[]): Promise<SendDevReportResult> => {
      if (remainingCooldownMs > 0) {
        return { success: false, reason: 'cooldown' };
      }

      setIsSending(true);
      try {
        // Aggregated (saatlik histogram) rapor da eklenir — canlı ring buffer
        // (`perfEntries`) TEKİL son ölçümleri, aggregated ise 24 saatlik
        // istatistiksel özeti (p50/p95/p99) taşır; ikisi BİRBİRİNİN YERİNE
        // GEÇMEZ, geliştirici ikisini birlikte görsün diye aynı JSON'a konur.
        let aggregated: unknown = null;
        try {
          aggregated = JSON.parse(await exportMetricsReport());
        } catch (metricsError) {
          console.warn('[useSendDevReport] Toplulaştırılmış rapor eklenemedi:', metricsError);
        }

        const deviceInfo = `${Platform.OS} ${Platform.Version} · v${Constants.expoConfig?.version ?? '?'}`;

        await sendFeedback({
          userMessage: sanitizeText('[Geliştirici Paneli] Otomatik performans ve hata raporu.'),
          errorLogs: JSON.parse(sanitizeText(JSON.stringify(errorEntries))),
          performanceReport: JSON.parse(
            sanitizeText(JSON.stringify({ liveEvents: perfEntries, aggregated }))
          ),
          deviceInfo: sanitizeText(deviceInfo),
          userId: isGuest ? `guest-${anonymousId}` : anonymousId,
          category: 'bug',
        });

        setLastSentAt(Date.now());
        return { success: true };
      } catch (error) {
        console.error('[useSendDevReport] submit error:', error);
        return { success: false, reason: 'error' };
      } finally {
        setIsSending(false);
      }
    },
    [remainingCooldownMs, anonymousId, isGuest, setLastSentAt]
  );

  return { isSending, remainingCooldownMs, handleSend };
}
