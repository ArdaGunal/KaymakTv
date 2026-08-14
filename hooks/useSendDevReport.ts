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

export const DEV_REPORT_NOTE_MAX_LENGTH = 250;

export interface SendDevReportOptions {
  /** Hata günlüğü gönderime dahil edilsin mi. */
  includeErrors: boolean;
  /** Performans verisi (canlı ölçümler + 24 saatlik özet) gönderime dahil edilsin mi. */
  includePerf: boolean;
  /** Serbest metin not — boşsa sabit varsayılan mesaj kullanılır. UI zaten
   * `DEV_REPORT_NOTE_MAX_LENGTH` ile sınırlıyor; burada tekrar kesiliyor ki
   * hook kendi başına da (UI'dan bağımsız) güvenli olsun. */
  note: string;
  perfEntries: PerfMark[];
  errorEntries: LoggedError[];
}

export type SendDevReportResult =
  | { success: true }
  | { success: false; reason: 'cooldown' | 'nothing_selected' | 'error' };

export interface UseSendDevReportResult {
  isSending: boolean;
  /** Bir sonraki gönderime kalan süre (ms). 0 ise gönderilebilir. */
  remainingCooldownMs: number;
  handleSend: (options: SendDevReportOptions) => Promise<SendDevReportResult>;
}

/**
 * Geliştirici Paneli'ndeki "Rapor Gönder" akışının mantığı. Kullanıcıya
 * hiçbir yerde "Discord'a gönder" DENMEZ (bkz. görev talebi) — bu yalnızca
 * mevcut geri bildirim borusunun (`sendFeedback` → Cloudflare Worker →
 * Supabase `error_logs` + Discord embed) `category: 'bug'` ile ikinci bir
 * çağrı noktası. Worker zaten hem Supabase'e (ham veri, karakter sınırı yok)
 * hem Discord'a (özet + "kaydedildi" durumu) yazıyor — burada YENİ bir arka
 * uç KURULMUYOR, var olanı Geliştirici Paneli'nden de tetiklenebilir hale
 * getiriyoruz.
 *
 * Kullanıcı hangi verilerin gönderileceğini seçebiliyor (`SendReportModal`) —
 * `includeErrors`/`includePerf` en az biri true olmalı, aksi hâl UI'da zaten
 * engellenir; burada da savunma amaçlı `'nothing_selected'` ile reddedilir.
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
    async (options: SendDevReportOptions): Promise<SendDevReportResult> => {
      if (!options.includeErrors && !options.includePerf) {
        return { success: false, reason: 'nothing_selected' };
      }
      if (remainingCooldownMs > 0) {
        return { success: false, reason: 'cooldown' };
      }

      setIsSending(true);
      try {
        // Aggregated (saatlik histogram) rapor da eklenir — canlı ring buffer
        // (`perfEntries`) TEKİL son ölçümleri, aggregated ise 24 saatlik
        // istatistiksel özeti (p50/p95/p99) taşır; ikisi BİRBİRİNİN YERİNE
        // GEÇMEZ, geliştirici ikisini birlikte görsün diye aynı JSON'a konur.
        // Kullanıcı Performans'ı işaretlemediyse İKİSİ DE gönderilmez (NULL) —
        // "İstek/Öneri" akışındaki `includeLogs` kapalıyken `performanceReport:
        // null` gitmesiyle AYNI sözleşme (bkz. 011_error_logs_...sql yorumu).
        let performanceReport: unknown = null;
        if (options.includePerf) {
          let aggregated: unknown = null;
          try {
            aggregated = JSON.parse(await exportMetricsReport());
          } catch (metricsError) {
            console.warn('[useSendDevReport] Toplulaştırılmış rapor eklenemedi:', metricsError);
          }
          performanceReport = { liveEvents: options.perfEntries, aggregated };
        }

        const note = options.note.trim().slice(0, DEV_REPORT_NOTE_MAX_LENGTH);
        const userMessage = note
          ? `[Geliştirici Paneli] ${note}`
          : '[Geliştirici Paneli] Otomatik performans ve hata raporu.';

        const deviceInfo = `${Platform.OS} ${Platform.Version} · v${Constants.expoConfig?.version ?? '?'}`;

        await sendFeedback({
          userMessage: sanitizeText(userMessage),
          errorLogs: options.includeErrors
            ? JSON.parse(sanitizeText(JSON.stringify(options.errorEntries)))
            : [],
          performanceReport: performanceReport
            ? JSON.parse(sanitizeText(JSON.stringify(performanceReport)))
            : null,
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
