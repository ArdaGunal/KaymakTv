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
} from 'react-native';
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
  const [body, setBody] = useState('');
  const [spoiler, setSpoiler] = useState(false);
  const [media, setMedia] = useState<PickedMedia | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheet}>
              <View style={styles.header}>
                <Text style={styles.title}>{t('composeTitle', 'Fikir Paylaş')}</Text>
                <TouchableOpacity onPress={resetAndClose} hitSlop={8}>
                  <X size={20} color="#64748b" />
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.input}
                value={body}
                onChangeText={setBody}
                placeholder={t('composeBodyPlaceholder', 'Bir dizi/film hakkında ne düşünüyorsun?')}
                placeholderTextColor="#475569"
                multiline
                autoFocus
                maxLength={POST_MAX_LENGTH + 100}
                editable={!isSubmitting}
              />
              <Text style={[styles.counter, overLimit && styles.counterOver]}>
                {trimmedLength}/{POST_MAX_LENGTH}
              </Text>

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
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
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
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 32 : 20,
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
  input: {
    minHeight: 100,
    maxHeight: 220,
    backgroundColor: '#172033',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#22304A',
    color: '#e2e8f0',
    fontSize: 15,
    padding: 12,
    textAlignVertical: 'top',
  },
  counter: {
    alignSelf: 'flex-end',
    color: '#475569',
    fontSize: 11,
    marginTop: 4,
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
