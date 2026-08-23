import { AlertTriangle, Clock, Info, Lightbulb, Send, Sparkles, X } from '../icons';
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

import { useReportIssue } from '../../hooks/useReportIssue';
import Snackbar from '../Snackbar';
import { styles } from './ReportIssueModal.styles';

interface ReportIssueModalProps {
  visible: boolean;
  onClose: () => void;
}

const MAX_LENGTH_BUG = 250;
const MAX_LENGTH_FEATURE = 300;

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
    category,
    setCategory,
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
  const [cooldownTick, setCooldownTick] = useState(remainingCooldownMs);
  const [isFocused, setIsFocused] = useState(false);

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

  const maxLength = category === 'bug' ? MAX_LENGTH_BUG : MAX_LENGTH_FEATURE;
  const isBug = category === 'bug';
  const accentColor = isBug ? '#ef4444' : '#22c55e';
  const isWeb = Platform.OS === 'web';

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
  const charRatio = message.length / maxLength;

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType={isWeb ? 'fade' : 'slide'}
        onRequestClose={onClose}
        statusBarTranslucent={Platform.OS === 'android'}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.overlay}
        >
          <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={onClose} />

          <View
            style={[
              styles.sheet,
              isWeb ? styles.sheetWeb : styles.sheetMobile,
              { paddingBottom: isWeb ? 24 : Math.max(insets.bottom, 20) },
            ]}
          >
            {!isWeb && <View style={styles.grabber} />}

            {/* Header Area */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View
                  style={[
                    styles.titleIconBadge,
                    { backgroundColor: isBug ? 'rgba(239, 68, 68, 0.12)' : 'rgba(34, 197, 94, 0.12)' },
                  ]}
                >
                  {isBug ? (
                    <AlertTriangle size={18} color="#ef4444" />
                  ) : (
                    <Sparkles size={18} color="#22c55e" />
                  )}
                </View>
                <View>
                  <Text style={styles.title}>{t('feedbackModalTitle', 'Geri Bildirim Kutusu')}</Text>
                  <Text style={styles.subtitle}>
                    {t('feedbackModalSubtitle', 'KaymakTV tecrübeni birlikte geliştirelim')}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={onClose}
                style={styles.closeBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={18} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {/* Futuristic Segmented Tabs */}
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tabBtn, isBug && styles.tabBtnActiveBug]}
                onPress={() => {
                  setCategory('bug');
                  setMessage('');
                }}
                disabled={isSubmitting}
                activeOpacity={0.8}
              >
                <AlertTriangle size={15} color={isBug ? '#ffffff' : '#64748b'} />
                <Text style={[styles.tabBtnText, isBug && styles.tabBtnTextActive]}>
                  {t('feedbackTabBug', 'Hata / Problem')}
                </Text>
                {isBug && <View style={[styles.activeDot, { backgroundColor: '#ef4444' }]} />}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabBtn, !isBug && styles.tabBtnActiveFeature]}
                onPress={() => {
                  setCategory('feature');
                  setMessage('');
                }}
                disabled={isSubmitting}
                activeOpacity={0.8}
              >
                <Lightbulb size={15} color={!isBug ? '#ffffff' : '#64748b'} />
                <Text style={[styles.tabBtnText, !isBug && styles.tabBtnTextActive]}>
                  {t('feedbackTabFeature', 'İstek / Öneri')}
                </Text>
                {!isBug && <View style={[styles.activeDot, { backgroundColor: '#22c55e' }]} />}
              </TouchableOpacity>
            </View>

            {/* Category Banner Callout */}
            <View style={[styles.infoBanner, { borderLeftColor: accentColor }]}>
              <Info size={16} color={accentColor} style={{ marginTop: 1 }} />
              <Text style={styles.infoBannerText}>
                {isBug
                  ? t('reportIssueBody', 'Karşılaştığın bir sorunu anlat, birlikte çözelim.')
                  : t('feedbackFeatureBody', 'Görmek istediğin yeni özelliği veya önerini paylaş.')}
              </Text>
            </View>

            {/* Input Box with Animated Active Border */}
            <View
              style={[
                styles.inputWrapper,
                isFocused && { borderColor: accentColor, backgroundColor: 'rgba(15, 23, 42, 0.7)' },
              ]}
            >
              <TextInput
                style={[styles.input, !isBug && styles.inputFeature]}
                value={message}
                onChangeText={(text) => setMessage(text.slice(0, maxLength))}
                placeholder={
                  isBug
                    ? t('reportIssuePlaceholder', 'Örn: Bölüm işaretlerken uygulama kapandı...')
                    : t('feedbackFeaturePlaceholder', 'Örn: Watchlist listelerini sıralayabilmek istiyorum...')
                }
                placeholderTextColor="#64748b"
                multiline
                numberOfLines={isBug ? 4 : 6}
                maxLength={maxLength}
                editable={!isSubmitting}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
              />

              <View style={styles.inputFooter}>
                <View style={styles.charBadge}>
                  <Text
                    style={[
                      styles.charCountText,
                      charRatio > 0.9 && { color: '#f59e0b' },
                      charRatio >= 1 && { color: '#ef4444' },
                    ]}
                  >
                    {message.length} / {maxLength}
                  </Text>
                </View>
              </View>
            </View>

            {/* Option Switch Card (Only for Bug Category) */}
            {isBug && (
              <View style={styles.switchCard}>
                <View style={styles.switchTextWrap}>
                  <Text style={styles.switchLabel}>
                    {t('reportIssueIncludeLogs', 'Hata loglarımı da gönder')}
                  </Text>
                  <Text style={styles.switchHint}>
                    {t('reportIssueIncludeLogsHint', 'Geliştiricilerin sorunu teşhis etmesine yardımcı olur.')}
                  </Text>
                </View>
                <Switch
                  value={includeLogs}
                  onValueChange={setIncludeLogs}
                  disabled={isSubmitting}
                  trackColor={{ false: '#334155', true: '#3b82f6' }}
                  thumbColor="#f8fafc"
                />
              </View>
            )}

            {/* Cooldown Alert */}
            {cooldownTick > 0 && (
              <View style={styles.cooldownBadge}>
                <Clock size={14} color="#f97316" />
                <Text style={styles.cooldownText}>
                  {t('reportIssueCooldownHint', 'Tekrar göndermek için: {{time}}', {
                    time: formatCooldown(cooldownTick),
                  })}
                </Text>
              </View>
            )}

            {/* Submit Action Button */}
            <TouchableOpacity
              style={[
                styles.sendBtn,
                !isBug && styles.sendBtnFeature,
                !canSubmit && styles.btnDisabled,
              ]}
              onPress={onSubmit}
              disabled={!canSubmit}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <View style={styles.sendBtnContent}>
                  {isBug ? (
                    <Send size={17} color="#ffffff" />
                  ) : (
                    <Sparkles size={17} color="#ffffff" />
                  )}
                  <Text style={styles.sendBtnText}>
                    {isBug
                      ? t('reportIssueSendBug', 'Hata Bildirimi Gönder')
                      : t('reportIssueSendFeature', 'Öneriyi İlet')}
                  </Text>
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
