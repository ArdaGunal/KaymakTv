import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
  StyleSheet,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { Flag, CheckCircle2, Circle } from 'lucide-react-native';
import { reportContent, ReportReason, ReportTargetType } from '../services/contentReports';
import Snackbar from '../../../components/Snackbar';

interface ReportContentModalProps {
  visible: boolean;
  targetType: ReportTargetType;
  targetId: string;
  onClose: () => void;
}

const REASONS: { value: ReportReason; labelKey: string; fallback: string }[] = [
  { value: 'spam', labelKey: 'feed:reportReasonSpam', fallback: 'Spam veya yanıltıcı içerik' },
  { value: 'harassment', labelKey: 'feed:reportReasonHarassment', fallback: 'Taciz veya zorbalık' },
  { value: 'hate_speech', labelKey: 'feed:reportReasonHateSpeech', fallback: 'Nefret söylemi' },
  { value: 'spoiler', labelKey: 'feed:reportReasonSpoiler', fallback: 'İşaretlenmemiş spoiler' },
  { value: 'illegal', labelKey: 'feed:reportReasonIllegal', fallback: 'Yasa dışı içerik' },
  { value: 'other', labelKey: 'feed:reportReasonOther', fallback: 'Diğer' },
];

/**
 * Akış kartları, akış yorumları ve Trakt yorumları için ORTAK bildirme
 * modalı — üçü de yalnızca `targetType`/`targetId` farkıyla aynı bileşeni
 * kullanır (bkz. CardMenu.tsx, FeedCommentItem.tsx, CommentItem.tsx).
 */
export default function ReportContentModal({
  visible,
  targetType,
  targetId,
  onClose,
}: ReportContentModalProps) {
  const { t } = useTranslation(['feed', 'common']);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [detail, setDetail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string }>({
    visible: false,
    message: '',
  });

  const reset = () => {
    setReason(null);
    setDetail('');
  };

  const handleClose = () => {
    if (isSubmitting) return;
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!reason || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const result = await reportContent(targetType, targetId, reason, detail);
      // `duplicate` = kullanıcı bu içeriği DAHA ÖNCE bildirmiş (023'teki UNIQUE
      // kısıtı yeni satırı yok saydı). Bunu "alındı, teşekkürler" diye
      // göstermek yalan olurdu — aynı zamanda kullanıcının tekrar tekrar
      // bildirmeye çalışmasının bir işe yaramadığını da anlatıyor.
      setToast({
        visible: true,
        message: result.duplicate
          ? t('feed:reportDuplicate', 'Bu içeriği zaten bildirmiştin.')
          : t('feed:reportSuccess', '✅ Bildirimin alındı, teşekkürler.'),
      });
      reset();
      setTimeout(onClose, 900);
    } catch (error) {
      console.error('[ReportContentModal] gönderim hatası:', error);
      setToast({ visible: true, message: t('feed:reportError', '❌ Bildirim gönderilemedi, tekrar dene.') });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
        <TouchableWithoutFeedback onPress={handleClose}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.overlay}
          >
            <TouchableWithoutFeedback>
              <View style={styles.dialog}>
                <View style={styles.header}>
                  <View style={styles.iconBadge}>
                    <Flag size={18} color="#f87171" />
                  </View>
                  <View style={styles.headerText}>
                    <Text style={styles.title}>{t('feed:reportModalTitle', 'İçeriği Bildir')}</Text>
                    <Text style={styles.subtitle}>
                      {t('feed:reportModalSubtitle', 'Bu içerikle ilgili sorunu bize bildir, inceleyelim.')}
                    </Text>
                  </View>
                </View>

                <View style={styles.reasonList}>
                  {REASONS.map((r) => {
                    const selected = reason === r.value;
                    return (
                      <TouchableOpacity
                        key={r.value}
                        style={[styles.reasonRow, selected && styles.reasonRowSelected]}
                        activeOpacity={0.7}
                        onPress={() => setReason(r.value)}
                        disabled={isSubmitting}
                      >
                        {selected ? (
                          <CheckCircle2 size={18} color="#f87171" />
                        ) : (
                          <Circle size={18} color="#475569" />
                        )}
                        <Text style={[styles.reasonText, selected && styles.reasonTextSelected]}>
                          {t(r.labelKey, r.fallback)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TextInput
                  style={styles.detailInput}
                  value={detail}
                  onChangeText={(text) => setDetail(text.slice(0, 500))}
                  placeholder={t('feed:reportDetailPlaceholder', 'İstersen kısaca açıkla (opsiyonel)')}
                  placeholderTextColor="#64748b"
                  multiline
                  numberOfLines={3}
                  maxLength={500}
                  editable={!isSubmitting}
                />

                <View style={styles.actions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={handleClose} disabled={isSubmitting}>
                    <Text style={styles.cancelText}>{t('common:cancel', 'Vazgeç')}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.submitBtn, (!reason || isSubmitting) && styles.btnDisabled]}
                    onPress={handleSubmit}
                    disabled={!reason || isSubmitting}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.submitText}>{t('feed:reportSubmit', 'Bildir')}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </Modal>

      <Snackbar
        visible={toast.visible}
        message={toast.message}
        onDismiss={() => setToast((prev) => ({ ...prev, visible: false }))}
        duration={2500}
      />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialog: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 22,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.2)',
  },
  header: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(239,68,68,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    flexShrink: 0,
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: '#f1f5f9',
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 12.5,
    marginTop: 3,
    lineHeight: 17,
  },
  reasonList: {
    gap: 4,
    marginBottom: 14,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  reasonRowSelected: {
    backgroundColor: 'rgba(239,68,68,0.08)',
  },
  reasonText: {
    color: '#cbd5e1',
    fontSize: 14,
    flexShrink: 1,
  },
  reasonTextSelected: {
    color: '#f1f5f9',
    fontWeight: '600',
  },
  detailInput: {
    backgroundColor: 'rgba(15,23,42,0.6)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 12,
    color: '#f1f5f9',
    fontSize: 13.5,
    minHeight: 70,
    textAlignVertical: 'top',
    marginBottom: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  cancelText: {
    color: '#94a3b8',
    fontWeight: '600',
    fontSize: 14,
  },
  submitBtn: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#dc2626',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  submitText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
