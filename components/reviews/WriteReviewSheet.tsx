import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { X, Send, AlertTriangle } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { MAX_REVIEW_CHARS, MIN_REVIEW_CHARS } from '../../utils/reviewLimits';
import { confirmAsync } from '../../utils/confirmDialog';

/**
 * İnceleme yazma/düzenleme ekranı.
 *
 * ⚠️ v2: TEK yazma hedefi var. Worker'ın `/feed/review` ucuna yazılır, o da
 * yalnızca `feed_activities`'e yazar — **Trakt'a hiçbir şey gitmez**
 * (bkz. docs/REVIEWS_PLAN.md v2 §1). Artık "iki kapı" sorunu yapısal olarak
 * imkânsız: dizi, film VE bölüm sayfalarının üçü de bu sheet'i kullanıyor
 * (bölüm incelemeleri F2'de açıldı, `episodeNumber` ile ayrışıyor ve `in_feed`
 * türetilmiş kolonu sayesinde ana akışa düşmüyor).
 *
 * Eskiden bu satırda `components/WriteCommentSheet.tsx` ile karşılaştırma
 * vardı — o dosya K1'de silindi (Trakt'a doğrudan yazan v1 yolu).
 *
 * Gönderme mantığı BURADA DEĞİL: `onSubmit` prop'u `useMediaReviews`
 * hook'undan gelir (docs/AI_RULES.md §1 — UI yalnızca gösterir).
 */

interface WriteReviewSheetProps {
  visible: boolean;
  onClose: () => void;
  isSubmitting: boolean;
  /** Düzenleme modunda mevcut inceleme metni (bizim DB'mizden). */
  initialBody?: string;
  initialSpoiler?: boolean;
  onSubmit: (body: string, spoiler: boolean) => Promise<{ ok: true } | { ok: false; message: string }>;
}

export default function WriteReviewSheet({
  visible,
  onClose,
  isSubmitting,
  initialBody,
  initialSpoiler,
  onSubmit,
}: WriteReviewSheetProps) {
  const { t } = useTranslation(['media', 'common']);
  const [inputText, setInputText] = useState('');
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ⚠️ v2: Mevcut metin artık TRAKT'TAN OKUNMUYOR. v1'de `useMyMediaComment`
  // ile Trakt'taki yorum ön-doldurulurdu, çünkü inceleme oraya da yazılıyordu
  // ve kullanıcının Trakt web'den yazdığının üzerine boş kutuyla yazması
  // önlenmeliydi. Trakt'a yazmayı bıraktığımız için (docs/REVIEWS_PLAN.md v2)
  // tek gerçek kaynak KENDİ satırımız — çağıran onu `initialBody` ile geçiyor.
  const trimmed = inputText.trim();
  const charCount = trimmed.length;
  const isTooShort = charCount > 0 && charCount < MIN_REVIEW_CHARS;
  const isTooLong = charCount > MAX_REVIEW_CHARS;
  const canSend = charCount >= MIN_REVIEW_CHARS && !isTooLong && !isSubmitting;

  // Sheet AÇILDIĞINDA mevcut metni yükle. Bağımlılıkta `visible` var ki
  // kullanıcı yazarken (her tuşta) sıfırlanmasın.
  useEffect(() => {
    if (visible) {
      setInputText(initialBody ?? '');
      setIsSpoiler(!!initialSpoiler);
      setErrorMessage(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleSend = async () => {
    if (!canSend) return;
    setErrorMessage(null);
    const result = await onSubmit(trimmed, isSpoiler);
    if (result.ok) {
      onClose();
      return;
    }
    // ⚠️ TÜNEL PROBLEMİ — EMEK KAYBOLMAZ.
    // Sınır 5000 karakter; kullanıcı uzun bir metin yazmış olabilir. Hata
    // durumunda sheet KAPANMAZ, metin kutuda KALIR, sebep ekranda görünür.
    // Kullanıcı ağı düzelip tekrar "Gönder"e basabilir.
    // (Sheet kapanma sıfırlaması bilinçli olarak `visible` AÇILIRKEN çalışıyor,
    // kapanırken değil — böylece burada state'i temizleyen bir yan etki yok.)
    setErrorMessage(result.message);
  };

  /**
   * Kapatma isteği — YAZILMIŞ METİN VARSA ÖNCE ONAY İSTER.
   *
   * Hata yolu yukarıda korunuyor ama emeğin kaybolduğu İKİNCİ bir yol daha
   * var: kullanıcının yanlışlıkla kapatması (X'e dokunma, Android geri tuşu).
   * 5000 karakterlik bir metin için bu, hata kadar can sıkıcı.
   */
  const handleRequestClose = async () => {
    const hasUnsavedChanges = trimmed.length > 0 && trimmed !== (initialBody ?? '').trim();
    if (!hasUnsavedChanges) {
      onClose();
      return;
    }
    const confirmed = await confirmAsync(
      t('reviewDiscardTitle', 'İncelemeden çıkılsın mı?'),
      t('reviewDiscardText', 'Yazdıkların kaydedilmeyecek.'),
      t('reviewDiscardConfirm', 'Vazgeç'),
      t('common:cancel')
    );
    if (confirmed) onClose();
  };

  // Kullanıcı butonun NEDEN pasif olduğunu her an görsün (WriteCommentSheet'teki
  // `hint` deseninin aynısı — oradaki gerekçe: hatayı yalnızca gönderme
  // denemesinden sonra göstermek kullanıcıyı kör bırakıyordu).
  const hint = useMemo(() => {
    if (isTooLong) {
      return { text: t('reviewHintTooLong', { max: MAX_REVIEW_CHARS }), isError: true };
    }
    if (charCount === 0) {
      return { text: t('reviewHintEmpty', 'Ne düşündüğünü yaz.'), isError: false };
    }
    if (isTooShort) {
      return { text: t('reviewHintTooShort', { min: MIN_REVIEW_CHARS }), isError: true };
    }
    return { text: t('reviewHintCount', { chars: charCount, max: MAX_REVIEW_CHARS }), isError: false };
  }, [charCount, isTooShort, isTooLong, t]);

  // onRequestClose = Android geri tuşu — o da onay akışından geçmeli.
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleRequestClose}>
      {/* iOS: padding; Android: height — bkz. WriteCommentSheet'teki aynı not. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.sheetContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {initialBody ? t('editReview', 'İncelemeni Düzenle') : t('writeReview', 'İnceleme Yaz')}
            </Text>
            <TouchableOpacity
              onPress={handleRequestClose}
              style={styles.closeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X color="#fff" size={24} />
            </TouchableOpacity>
          </View>

          <View style={styles.inputSection}>
              <View style={styles.inputHeader}>
                {/* Switch'i TouchableOpacity ile SARMAMAK önemli — bkz.
                    WriteCommentSheet'teki aynı not (çift tetikleme). */}
                <View style={styles.spoilerToggle}>
                  <Switch
                    value={isSpoiler}
                    onValueChange={setIsSpoiler}
                    trackColor={{ false: '#3f3f46', true: '#3b82f6' }}
                    thumbColor={Platform.OS === 'ios' ? '#fff' : isSpoiler ? '#fff' : '#a3a3a3'}
                  />
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setIsSpoiler((v) => !v)}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                  >
                    <Text style={styles.spoilerText}>{t('containsSpoiler')}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={[styles.inputRow, hint.isError && styles.inputError]}>
                <TextInput
                  style={styles.textInput}
                  placeholder={t('reviewPlaceholder', 'Bu yapım hakkında ne düşünüyorsun?')}
                  placeholderTextColor="#a3a3a3"
                  value={inputText}
                  onChangeText={setInputText}
                  multiline
                  // `maxLength` YOK — bilinçli: kullanıcı sınırı aşan metnini
                  // sessizce kırpmak yerine, ne kadar aştığını ipucu satırında
                  // görüp kendisi kısaltsın.
                  autoFocus={!initialBody}
                />
                <TouchableOpacity
                  style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
                  onPress={handleSend}
                  disabled={!canSend}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" />
                  ) : (
                    <Send size={20} color={canSend ? '#fb923c' : '#475569'} />
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.hintRow}>
                {hint.isError && (
                  <AlertTriangle size={13} color="#ef4444" style={{ marginRight: 5 }} />
                )}
                <Text style={[styles.hintText, hint.isError && styles.hintTextError]}>
                  {hint.text}
                </Text>
              </View>

              {errorMessage && (
                <View style={styles.errorBox}>
                  <AlertTriangle size={13} color="#ef4444" />
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              )}

              <Text style={styles.footnote}>
                {/* Fallback metni çeviri anahtarıyla AYNI şeyi söylemeli:
                    v2'de inceleme Trakt'a GİTMİYOR. (Bayat fallback yalnızca
                    i18n yüklenemediğinde görünürdü ama yine de yalan olurdu.) */}
                {t('reviewPublishNote', 'İncelemen KaymakTV akışında yayınlanır.')}
              </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#0B1120',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    // Web'de sheet ekranın tamamına yayılıp devasa görünüyordu.
    ...(Platform.OS === 'web'
      ? ({ maxWidth: 680, alignSelf: 'center', width: '100%' } as any)
      : {}),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#172033',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeBtn: {
    padding: 4,
  },
  inputSection: {
    padding: 16,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(56,189,248,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.2)',
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  infoText: {
    color: '#7dd3fc',
    fontSize: 11,
    flex: 1,
  },
  inputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  spoilerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spoilerText: {
    color: '#e5e5e5',
    fontSize: 12,
    marginLeft: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#172033',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  textInput: {
    color: '#fff',
    maxHeight: 200,
    minHeight: 110,
    flex: 1,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  sendBtn: {
    marginLeft: 12,
    padding: 8,
  },
  sendBtnDisabled: {
    opacity: 0.6,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    minHeight: 18,
  },
  hintText: {
    color: '#737373',
    fontSize: 11,
  },
  hintTextError: {
    color: '#ef4444',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 10,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 12,
    flex: 1,
  },
  footnote: {
    color: '#475569',
    fontSize: 11,
    marginTop: 12,
    fontStyle: 'italic',
  },
});
