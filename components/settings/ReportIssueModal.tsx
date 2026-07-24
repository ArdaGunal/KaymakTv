import { X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReportIssue } from '../../hooks/useReportIssue';
import Snackbar from '../Snackbar';

interface ReportIssueModalProps {
  visible: boolean;
  onClose: () => void;
}

const MAX_MESSAGE_LENGTH = 250;

const formatCooldown = (ms: number): string => {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export default function ReportIssueModal({ visible, onClose }: ReportIssueModalProps) {
  const { t } = useTranslation('settings');
  const insets = useSafeAreaInsets();
  const {
    message,
    setMessage,
    includeLogs,
    setIncludeLogs,
    isSubmitting,
    remainingCooldownMs,
    handleSubmit,
  } = useReportIssue();

  const [toast, setToast] = useState<{ visible: boolean; message: string }>({
    visible: false,
    message: '',
  });
  // Modal her açıldığında güncel cooldown ile başlar, ardından her saniye
  // kendi içinde geri sayar (store'a tekrar tekrar yazmadan).
  const [cooldownTick, setCooldownTick] = useState(remainingCooldownMs);

  useEffect(() => {
    if (!visible) return;
    setCooldownTick(remainingCooldownMs);
  }, [visible, remainingCooldownMs]);

  useEffect(() => {
    if (!visible || cooldownTick <= 0) return;
    const interval = setInterval(() => {
      setCooldownTick((prev) => Math.max(0, prev - 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [visible, cooldownTick]);

  const onSubmit = async () => {
    const result = await handleSubmit();
    if (result.success) {
      setToast({ visible: true, message: t('reportIssueSuccess', '✅ Bildirimin alındı, teşekkürler!') });
      setTimeout(onClose, 900);
    } else if (result.reason === 'cooldown') {
      setToast({
        visible: true,
        message: t('reportIssueCooldown', '🕐 Son 3 dakikada zaten gönderdin, biraz bekle.'),
      });
    } else if (result.reason === 'error') {
      setToast({ visible: true, message: t('reportIssueError', '❌ Gönderilemedi, tekrar dene.') });
    }
  };

  const canSubmit = !isSubmitting && cooldownTick <= 0 && message.trim().length > 0;

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
        statusBarTranslucent={Platform.OS === 'android'}
      >
        {/* iOS: padding; Android: height — RN Modal içinde Android'de 'padding'
            çoğu cihazda çalışmayıp input'un klavye altında kalmasına sebep
            oluyordu (bkz. WriteCommentSheet.tsx'teki aynı düzeltme). */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.overlay}
        >
          <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={onClose} />

          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={styles.grabber} />

            <View style={styles.header}>
              <Text style={styles.title}>{t('reportIssueTitle', 'Bize Ulaşın / Hata Bildir')}</Text>
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <Text style={styles.body}>
              {t('reportIssueBody', 'Karşılaştığın bir sorunu anlat, birlikte çözelim.')}
            </Text>

            <TextInput
              style={styles.input}
              value={message}
              onChangeText={(text) => setMessage(text.slice(0, MAX_MESSAGE_LENGTH))}
              placeholder={t('reportIssuePlaceholder', 'Örn: Bölüm işaretlerken uygulama kapandı...')}
              placeholderTextColor="#64748b"
              multiline
              numberOfLines={4}
              maxLength={MAX_MESSAGE_LENGTH}
              editable={!isSubmitting}
            />
            <Text style={styles.charCount}>
              {message.length}/{MAX_MESSAGE_LENGTH}
            </Text>

            <View style={styles.switchRow}>
              <View style={styles.switchTextWrap}>
                <Text style={styles.switchLabel}>
                  {t('reportIssueIncludeLogs', 'Hata loglarımı da gönder')}
                </Text>
                <Text style={styles.switchHint}>
                  {t('reportIssueIncludeLogsHint', 'Geliştiricilerin sorunu çözmesine yardımcı olur.')}
                </Text>
              </View>
              <Switch
                value={includeLogs}
                onValueChange={setIncludeLogs}
                disabled={isSubmitting}
                trackColor={{ false: '#334155', true: '#3b82f6' }}
                thumbColor="#f1f5f9"
              />
            </View>

            {cooldownTick > 0 && (
              <Text style={styles.cooldownText}>
                {t('reportIssueCooldownHint', 'Tekrar göndermek için: {{time}}', {
                  time: formatCooldown(cooldownTick),
                })}
              </Text>
            )}

            <TouchableOpacity
              style={[styles.sendBtn, !canSubmit && styles.btnDisabled]}
              onPress={onSubmit}
              disabled={!canSubmit}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.sendBtnText}>{t('reportIssueSend', 'Gönder')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Snackbar
        visible={toast.visible}
        message={toast.message}
        onDismiss={() => setToast((prev) => ({ ...prev, visible: false }))}
        duration={2800}
      />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  backdropTouch: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 20,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.3,
    paddingRight: 12,
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  input: {
    width: '100%',
    minHeight: 100,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: 16,
    color: '#f1f5f9',
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  charCount: {
    alignSelf: 'flex-end',
    color: '#475569',
    fontSize: 11,
    marginTop: 6,
    marginBottom: 16,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 8,
  },
  switchTextWrap: {
    flex: 1,
  },
  switchLabel: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '600',
  },
  switchHint: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  cooldownText: {
    color: '#fb923c',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  sendBtn: {
    width: '100%',
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#3b82f6',
    marginTop: 20,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  sendBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
