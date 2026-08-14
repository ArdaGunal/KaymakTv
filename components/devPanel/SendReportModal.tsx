import { AlertTriangle, Activity, Clock, Send, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Snackbar from '../Snackbar';
import { styles } from './sendReportModalStyles';
import { DEV_REPORT_NOTE_MAX_LENGTH, useSendDevReport } from '../../hooks/useSendDevReport';
import type { LoggedError } from '../../utils/errorLog';
import type { PerfMark } from '../../utils/perfLog';

interface SendReportModalProps {
  visible: boolean;
  onClose: () => void;
  perfEntries: PerfMark[];
  errorEntries: LoggedError[];
}

const formatCooldown = (ms: number): string => {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * "Rapor Gönder" akışının seçim ekranı — `components/settings/ReportIssueModal.tsx`
 * ile AYNI görsel dili (sheet/backdrop/switch kartı/karakter sayacı) kullanır,
 * kendi kendine yeten (self-contained) bir modaldır: kendi Snackbar'ı, kendi
 * soğuma sayacı var — dev-panel.tsx yalnızca `visible`/`onClose` verir.
 *
 * Kullanıcı hangi verilerin gönderileceğini seçer (Hata Günlüğü / Performans);
 * ikisi de kapalıyken gönder butonu DEVRE DIŞI kalır ve bir uyarı satırı
 * belirir — sunucuya boş bir rapor GİTMEZ.
 */
export default function SendReportModal({ visible, onClose, perfEntries, errorEntries }: SendReportModalProps) {
  const { t } = useTranslation(['settings', 'common']);
  const insets = useSafeAreaInsets();
  const { isSending, remainingCooldownMs, handleSend } = useSendDevReport();

  const [includeErrors, setIncludeErrors] = useState(true);
  const [includePerf, setIncludePerf] = useState(true);
  const [note, setNote] = useState('');
  const [toast, setToast] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });
  const [cooldownTick, setCooldownTick] = useState(remainingCooldownMs);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setCooldownTick(remainingCooldownMs);
  }, [visible, remainingCooldownMs]);

  useEffect(() => {
    if (!visible || cooldownTick <= 0) return;
    const interval = setInterval(() => setCooldownTick((prev) => Math.max(0, prev - 1000)), 1000);
    return () => clearInterval(interval);
  }, [visible, cooldownTick]);

  const isWeb = Platform.OS === 'web';
  const nothingSelected = !includeErrors && !includePerf;
  const canSubmit = !isSending && cooldownTick <= 0 && !nothingSelected;

  const onSubmit = async () => {
    const result = await handleSend({ includeErrors, includePerf, note, perfEntries, errorEntries });
    if (result.success) {
      setToast({ visible: true, message: t('settings:devPanelSendReportSuccess', '✅ Rapor gönderildi, teşekkürler!') });
      setNote('');
      setTimeout(onClose, 900);
    } else if (result.reason === 'cooldown') {
      setToast({ visible: true, message: t('settings:reportIssueCooldown', '🕐 Son 3 dakikada zaten gönderdin, biraz bekle.') });
    } else if (result.reason === 'error') {
      setToast({ visible: true, message: t('settings:devPanelSendReportError', '❌ Rapor gönderilemedi, tekrar dene.') });
    }
    // 'nothing_selected': buton zaten disabled, buraya normal akışta düşülmez.
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType={isWeb ? 'fade' : 'slide'}
        onRequestClose={onClose}
        statusBarTranslucent={Platform.OS === 'android'}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
          <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={onClose} />

          <View
            style={[
              styles.sheet,
              isWeb ? styles.sheetWeb : styles.sheetMobile,
              { paddingBottom: isWeb ? 24 : Math.max(insets.bottom, 20) },
            ]}
          >
            {!isWeb && <View style={styles.grabber} />}

            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.titleIconBadge}>
                  <Send size={18} color="#60a5fa" />
                </View>
                <View>
                  <Text style={styles.title}>{t('settings:devPanelSendModalTitle', 'Rapor Gönder')}</Text>
                  <Text style={styles.subtitle}>
                    {t('settings:devPanelSendModalSubtitle', 'Nelerin gönderileceğini seç')}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={18} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <View style={styles.switchCard}>
              <View style={styles.switchIconWrap}>
                <AlertTriangle size={16} color="#f87171" />
              </View>
              <View style={styles.switchTextWrap}>
                <Text style={styles.switchLabel}>{t('settings:devPanelIncludeErrors', 'Hata Günlüğü')}</Text>
                <Text style={styles.switchHint}>
                  {t('settings:devPanelIncludeErrorsHint', '{{count}} kayıt', { count: errorEntries.length })}
                </Text>
              </View>
              <Switch
                value={includeErrors}
                onValueChange={setIncludeErrors}
                disabled={isSending}
                trackColor={{ false: '#334155', true: '#3b82f6' }}
                thumbColor="#f8fafc"
              />
            </View>

            <View style={styles.switchCard}>
              <View style={styles.switchIconWrap}>
                <Activity size={16} color="#60a5fa" />
              </View>
              <View style={styles.switchTextWrap}>
                <Text style={styles.switchLabel}>{t('settings:devPanelIncludePerf', 'Performans Verileri')}</Text>
                <Text style={styles.switchHint}>
                  {t('settings:devPanelIncludePerfHint', '{{count}} ölçüm', { count: perfEntries.length })}
                </Text>
              </View>
              <Switch
                value={includePerf}
                onValueChange={setIncludePerf}
                disabled={isSending}
                trackColor={{ false: '#334155', true: '#3b82f6' }}
                thumbColor="#f8fafc"
              />
            </View>

            {nothingSelected && (
              <View style={styles.warnBadge}>
                <AlertTriangle size={14} color="#f59e0b" />
                <Text style={styles.warnText}>
                  {t('settings:devPanelSelectAtLeastOne', 'Göndermek için en az birini seç.')}
                </Text>
              </View>
            )}

            <View style={[styles.inputWrapper, isFocused && styles.inputWrapperFocused]}>
              <TextInput
                style={styles.input}
                value={note}
                onChangeText={(text) => setNote(text.slice(0, DEV_REPORT_NOTE_MAX_LENGTH))}
                placeholder={t('settings:devPanelNotePlaceholder', 'Not ekle (opsiyonel)... ör. az önce ne yaparken oldu')}
                placeholderTextColor="#64748b"
                multiline
                numberOfLines={3}
                maxLength={DEV_REPORT_NOTE_MAX_LENGTH}
                editable={!isSending}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
              />
              <View style={styles.inputFooter}>
                <View style={styles.charBadge}>
                  <Text style={styles.charCountText}>{note.length} / {DEV_REPORT_NOTE_MAX_LENGTH}</Text>
                </View>
              </View>
            </View>

            {cooldownTick > 0 && (
              <View style={styles.cooldownBadge}>
                <Clock size={14} color="#f97316" />
                <Text style={styles.cooldownText}>
                  {t('settings:reportIssueCooldownHint', 'Tekrar göndermek için: {{time}}', {
                    time: formatCooldown(cooldownTick),
                  })}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.sendBtn, !canSubmit && styles.btnDisabled]}
              onPress={onSubmit}
              disabled={!canSubmit}
              activeOpacity={0.85}
            >
              {isSending ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <View style={styles.sendBtnContent}>
                  <Send size={17} color="#ffffff" />
                  <Text style={styles.sendBtnText}>{t('settings:reportIssueSend', 'Gönder')}</Text>
                </View>
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

