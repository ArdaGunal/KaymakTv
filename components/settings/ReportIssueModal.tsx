import { AlertTriangle, Clock, Info, Lightbulb, Send, Sparkles, X } from 'lucide-react-native';
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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(3, 7, 18, 0.75)',
    justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end',
    alignItems: Platform.OS === 'web' ? 'center' : 'stretch',
    padding: Platform.OS === 'web' ? 20 : 0,
  },
  backdropTouch: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: '#0b1329',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 24,
  },
  sheetMobile: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    width: '100%',
  },
  sheetWeb: {
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 520,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'center',
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  titleIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  title: {
    color: '#f8fafc',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Futuristic Segmented Tabs
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 14,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
    position: 'relative',
  },
  tabBtnActiveBug: {
    backgroundColor: '#dc2626',
  },
  tabBtnActiveFeature: {
    backgroundColor: '#16a34a',
  },
  tabBtnText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  tabBtnTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    position: 'absolute',
    bottom: 4,
  },
  // Callout Banner
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderLeftWidth: 3,
    marginBottom: 14,
  },
  infoBannerText: {
    flex: 1,
    color: '#cbd5e1',
    fontSize: 12.5,
    lineHeight: 18,
  },
  // Input Box & Wrapper
  inputWrapper: {
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 14,
    overflow: 'hidden',
  },
  input: {
    width: '100%',
    minHeight: 110,
    padding: 14,
    color: '#f8fafc',
    fontSize: 14.5,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  inputFeature: {
    minHeight: 150,
  },
  inputFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  charBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  charCountText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
  },
  // Switch Card
  switchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 14,
    gap: 12,
  },
  switchTextWrap: {
    flex: 1,
  },
  switchLabel: {
    color: '#e2e8f0',
    fontSize: 13.5,
    fontWeight: '600',
  },
  switchHint: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  // Cooldown Badge
  cooldownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
    borderRadius: 10,
    paddingVertical: 8,
    marginBottom: 14,
  },
  cooldownText: {
    color: '#fb923c',
    fontSize: 12,
    fontWeight: '600',
  },
  // Submit Action Button
  sendBtn: {
    width: '100%',
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  sendBtnFeature: {
    backgroundColor: '#22c55e',
    shadowColor: '#22c55e',
  },
  sendBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnDisabled: {
    opacity: 0.45,
    shadowOpacity: 0,
    elevation: 0,
  },
  sendBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: -0.2,
  },
});

