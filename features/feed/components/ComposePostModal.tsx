import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
  Switch,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Plus } from 'lucide-react-native';
import MediaPoster from '../../../components/MediaPoster';
import MediaPickerModal from './MediaPickerModal';
import { PickedMedia } from './MediaPickerRow';
import { publishPost } from '../services/feedPublish';

const POST_MAX_LENGTH = 1000;

interface ComposePostModalProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Bağımsız gönderi ("Fikir Paylaş") compose ekranı — bkz.
 * docs/HISTORY.md (Madde 157). `ComposePostBar`'a dokununca açılır.
 * Yapım seçimi OPSİYONEL (kullanıcı kararı): seçilirse küçük bir "chip"
 * olarak eklenir, seçilmezse gönderi düz metin olarak paylaşılır.
 */
export default function ComposePostModal({ visible, onClose }: ComposePostModalProps) {
  const { t } = useTranslation('feed');
  const insets = useSafeAreaInsets();
  const [body, setBody] = useState('');
  const [spoiler, setSpoiler] = useState(false);
  const [media, setMedia] = useState<PickedMedia | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);

  const trimmedLength = body.trim().length;
  const overLimit = trimmedLength > POST_MAX_LENGTH;
  const canPublish = trimmedLength > 0 && !overLimit && !isSubmitting;

  const resetAndClose = () => {
    setBody('');
    setSpoiler(false);
    setMedia(null);
    setError(null);
    onClose();
  };

  const handlePublish = async () => {
    if (!canPublish) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await publishPost({
        body: body.trim(),
        spoiler,
        show: media
          ? { showId: media.showId, mediaType: media.mediaType, showTitle: media.showTitle, tmdbId: media.tmdbId }
          : undefined,
      });
      if (result.ok) {
        resetAndClose();
      } else {
        setError(result.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={resetAndClose} statusBarTranslucent={Platform.OS === 'android'}>
      <TouchableWithoutFeedback onPress={resetAndClose}>
        {/* `behavior="height"` Android'de eskiden `undefined`'dı — yani klavye
            açılınca içerik HİÇ küçülmüyordu, yazı alanı klavyenin altında
            kalıp görünmez oluyordu (bkz. kullanıcı bildirimi). iOS'ta
            `padding` zaten doğruydu, Android'e de karşılığı eklendi
            (ReportIssueModal.tsx'teki AYNI desen). */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.overlay}
        >
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.sheet,
                // `insets.bottom` EKLENMEMİŞTİ — Paylaş butonu Android'in
                // gezinme çubuğunun (gesture bar) ALTINDA kalıyordu. Diğer
                // sheet'lerdeki (DeleteAccountModal, ReportContentModal vb.)
                // AYNI güvenli alan deseni burada da uygulandı.
                { paddingBottom: Math.max(insets.bottom, 16) },
              ]}
            >
              <View style={styles.grabber} />

              <View style={styles.header}>
                <Text style={styles.title}>{t('composeTitle', 'Fikir Paylaş')}</Text>
                <TouchableOpacity onPress={resetAndClose} hitSlop={8}>
                  <X size={20} color="#64748b" />
                </TouchableOpacity>
              </View>

              {/* Tüm gövde (yazı alanı + medya + spoiler + hata) TEK bir
                  kaydırılabilir alan — 1000 karaktere kadar büyüyebilen bir
                  metin için kullanıcı kolayca yukarı/aşağı gezinebilsin diye
                  (bkz. kullanıcı isteği). Yazı alanının kendi iç scroll'u
                  YOK artık (aşağıdaki `input` stiline bkz.) — iç içe iki ayrı
                  kaydırma alanı Android'de dokunuş çakışması yaratırdı, tek
                  kaynaktan kaydırma daha sağlam ve daha "modern" (Twitter/X
                  compose ekranıyla aynı desen). */}
              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator
              >
                <TextInput
                  style={[styles.input, isInputFocused && styles.inputFocused]}
                  value={body}
                  onChangeText={setBody}
                  placeholder={t('composeBodyPlaceholder', 'Bir dizi/film hakkında ne düşünüyorsun?')}
                  placeholderTextColor="#475569"
                  multiline
                  autoFocus
                  maxLength={POST_MAX_LENGTH + 100}
                  editable={!isSubmitting}
                  onFocus={() => setIsInputFocused(true)}
                  onBlur={() => setIsInputFocused(false)}
                />
                <View style={styles.counterRow}>
                  <View style={styles.counterBadge}>
                    <Text style={[styles.counterText, overLimit && styles.counterOver]}>
                      {trimmedLength}/{POST_MAX_LENGTH}
                    </Text>
                  </View>
                </View>

                {media ? (
                  <View style={styles.mediaChip}>
                    <MediaPoster tmdbId={media.tmdbId} type={media.mediaType} title={media.showTitle} style={styles.mediaChipPoster} />
                    <Text style={styles.mediaChipText} numberOfLines={1}>
                      {media.showTitle}
                    </Text>
                    <TouchableOpacity onPress={() => setMedia(null)} hitSlop={8}>
                      <X size={16} color="#94a3b8" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.addMediaBtn} onPress={() => setPickerVisible(true)} activeOpacity={0.7}>
                    <Plus size={14} color="#60a5fa" />
                    <Text style={styles.addMediaBtnText}>{t('composeAddMedia', 'Dizi/Film Ekle (opsiyonel)')}</Text>
                  </TouchableOpacity>
                )}

                <View style={styles.spoilerRow}>
                  <Text style={styles.spoilerLabel}>{t('spoilerToggle', 'Spoiler içeriyor')}</Text>
                  <Switch
                    value={spoiler}
                    onValueChange={setSpoiler}
                    disabled={isSubmitting}
                    trackColor={{ false: '#334155', true: '#3b82f6' }}
                    thumbColor="#f1f5f9"
                  />
                </View>

                {error && <Text style={styles.error}>{error}</Text>}
              </ScrollView>

              {/* Paylaş butonu BİLİNÇLİ OLARAK ScrollView'ın DIŞINDA — sabit
                  bir alt bar, kaydırma sırasında asla kaybolmaz/gizlenmez. */}
              <TouchableOpacity
                style={[styles.publishBtn, !canPublish && styles.publishBtnDisabled]}
                onPress={handlePublish}
                disabled={!canPublish}
                activeOpacity={0.85}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.publishBtnText}>{t('publish', 'Paylaş')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>

      <MediaPickerModal visible={pickerVisible} onSelect={setMedia} onClose={() => setPickerVisible(false)} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: '#22304A',
    // Ekranın tamamını kaplamasın diye üst sınır — geri kalan boşluk
    // ScrollView'a kalır, klavye açıkken de sheet'in tamamı ekranda görünür
    // kalır (KeyboardAvoidingView bu yüksekliği klavye kadar küçültür).
    maxHeight: '88%',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: {
    color: '#f1f5f9',
    fontSize: 16,
    fontWeight: '700',
  },
  scroll: {
    flexShrink: 1,
  },
  scrollContent: {
    paddingBottom: 4,
  },
  input: {
    // Sabit bir maxHeight YOK — dış ScrollView tek kaydırma kaynağı (bkz.
    // yukarıdaki JSX notu). Yazı alanı yazdıkça doğal olarak büyür, uzun bir
    // gönderide sheet'in tamamı (input + medya + spoiler + buton) birlikte
    // kayar; kullanıcı üste/alta rahatça gezinebilir.
    minHeight: 140,
    backgroundColor: '#172033',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#22304A',
    color: '#e2e8f0',
    fontSize: 15,
    lineHeight: 22,
    padding: 14,
    textAlignVertical: 'top',
  },
  inputFocused: {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
  },
  counterRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 6,
  },
  counterBadge: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  counterText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
  },
  counterOver: {
    color: '#f87171',
  },
  addMediaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.3)',
  },
  addMediaBtnText: {
    color: '#60a5fa',
    fontSize: 12.5,
    fontWeight: '700',
  },
  mediaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#172033',
    borderWidth: 1,
    borderColor: '#22304A',
  },
  mediaChipPoster: {
    width: 30,
    height: 44,
    borderRadius: 5,
    backgroundColor: '#0B1120',
  },
  mediaChipText: {
    flex: 1,
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '600',
  },
  spoilerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingVertical: 4,
  },
  spoilerLabel: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '500',
  },
  error: {
    color: '#f87171',
    fontSize: 12,
    marginTop: 10,
  },
  publishBtn: {
    marginTop: 18,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishBtnDisabled: {
    opacity: 0.5,
  },
  publishBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
