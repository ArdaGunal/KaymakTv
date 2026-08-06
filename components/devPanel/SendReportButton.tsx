import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { Send, Clock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { useSendDevReport } from '../../hooks/useSendDevReport';
import type { LoggedError } from '../../utils/errorLog';
import type { PerfMark } from '../../utils/perfLog';

interface SendReportButtonProps {
  perfEntries: PerfMark[];
  errorEntries: LoggedError[];
  onResult: (message: string) => void;
}

const formatCooldown = (ms: number): string => {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

/** "Raporu Gönder" butonu — kullanıcıya HİÇBİR YERDE "Discord'a gönder"
 * denmez (bkz. useSendDevReport.ts başlığı); yalnızca "geliştiriciye
 * bildir" çerçevesinde profesyonel bir eylem olarak sunulur. */
export default function SendReportButton({ perfEntries, errorEntries, onResult }: SendReportButtonProps) {
  const { t } = useTranslation(['settings', 'common']);
  const { isSending, remainingCooldownMs, handleSend } = useSendDevReport();
  const [cooldownTick, setCooldownTick] = useState(remainingCooldownMs);

  useEffect(() => {
    setCooldownTick(remainingCooldownMs);
  }, [remainingCooldownMs]);

  useEffect(() => {
    if (cooldownTick <= 0) return;
    const interval = setInterval(() => setCooldownTick((prev) => Math.max(0, prev - 1000)), 1000);
    return () => clearInterval(interval);
  }, [cooldownTick]);

  const onPress = async () => {
    const result = await handleSend(perfEntries, errorEntries);
    if (result.success) {
      onResult(t('settings:devPanelSendReportSuccess', '✅ Rapor gönderildi, teşekkürler!'));
    } else if (result.reason === 'cooldown') {
      onResult(t('settings:reportIssueCooldown', '🕐 Son 3 dakikada zaten gönderdin, biraz bekle.'));
    } else {
      onResult(t('settings:devPanelSendReportError', '❌ Rapor gönderilemedi, tekrar dene.'));
    }
  };

  const disabled = isSending || cooldownTick > 0;

  return (
    <View>
      <TouchableOpacity
        style={[styles.button, disabled && styles.buttonDisabled]}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.85}
      >
        {isSending ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : cooldownTick > 0 ? (
          <>
            <Clock size={16} color="#94a3b8" />
            <Text style={styles.buttonTextDisabled}>
              {t('settings:reportIssueCooldownHint', 'Tekrar göndermek için: {{time}}', {
                time: formatCooldown(cooldownTick),
              })}
            </Text>
          </>
        ) : (
          <>
            <Send size={16} color="#ffffff" />
            <Text style={styles.buttonText}>
              {t('settings:devPanelSendReport', 'Raporu Geliştiriciye Gönder')}
            </Text>
          </>
        )}
      </TouchableOpacity>
      <Text style={styles.hint}>
        {t('settings:devPanelSendReportHint', 'Anlık performans ve hata verilerini geliştirme ekibine iletir.')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: '#2563eb',
  },
  buttonDisabled: {
    backgroundColor: '#1f2937',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  buttonTextDisabled: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  hint: {
    color: '#64748b',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
  },
});
