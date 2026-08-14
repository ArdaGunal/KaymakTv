import React, { useEffect, useState } from 'react';
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
  Platform,
  ActivityIndicator,
} from 'react-native';
import { X } from 'lucide-react-native';

const NOTE_MAX_LENGTH = 500;

interface NoteEditorModalProps {
  visible: boolean;
  initialNote: string;
  initialSpoiler: boolean;
  saving: boolean;
  onSave: (note: string, spoiler: boolean) => void;
  onCancel: () => void;
}

/**
 * Kendi aktivitene kişisel not/alıntı ekleme sheet'i (bkz.
 * docs/FEED_SOCIAL_PLAN.md §3.6). "Çok güzeldi!" gibi Letterboxd tarzı bir
 * inceleme — Trakt'ın kendi yorum sistemiyle karışmaz, yalnızca KaymakTV
 * içinde yaşar.
 */
export default function NoteEditorModal({
  visible,
  initialNote,
  initialSpoiler,
  saving,
  onSave,
  onCancel,
}: NoteEditorModalProps) {
  const { t } = useTranslation('feed');
  const [note, setNote] = useState(initialNote);
  const [spoiler, setSpoiler] = useState(initialSpoiler);

  // Modal her açılışta önceki oturumun taslağını değil, GÜNCEL kayıtlı notu
  // göstermeli — kapatıp tekrar açınca eski yazılan-ama-kaydedilmemiş metin
  // kalmasın.
  useEffect(() => {
    if (visible) {
      setNote(initialNote);
      setSpoiler(initialSpoiler);
    }
  }, [visible, initialNote, initialSpoiler]);

  const trimmedLength = note.trim().length;
  const overLimit = trimmedLength > NOTE_MAX_LENGTH;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent={Platform.OS === 'android'}
    >
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.dialog}>
              <View style={styles.header}>
                {/* Başlık duruma göre değişir — var olan bir alıntıyı
                    güncellerken de "Alıntı Yap" ekranı yeniden açılan aynı
                    eylem değil, "Alıntıyı Düzenle" (bkz. kullanıcı kararı:
                    ayrı bir "Notu Düzenle" ifadesi/butonu YOK). */}
                <Text style={styles.title}>
                  {initialNote
                    ? t('noteEditorTitleEdit', 'Alıntıyı Düzenle')
                    : t('noteEditorTitle', 'Alıntı Yap')}
                </Text>
                <TouchableOpacity onPress={onCancel} hitSlop={8}>
                  <X size={20} color="#64748b" />
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.input}
                value={note}
                onChangeText={setNote}
                placeholder={t('noteEditorPlaceholder', 'Bu yapım hakkında ne düşünüyorsun?')}
                placeholderTextColor="#475569"
                multiline
                maxLength={NOTE_MAX_LENGTH + 50}
                editable={!saving}
              />
              <Text style={[styles.counter, overLimit && styles.counterOver]}>
                {trimmedLength}/{NOTE_MAX_LENGTH}
              </Text>

              <View style={styles.spoilerRow}>
                <Text style={styles.spoilerLabel}>{t('spoilerToggle', 'Spoiler içeriyor')}</Text>
                <Switch
                  value={spoiler}
                  onValueChange={setSpoiler}
                  disabled={saving}
                  trackColor={{ false: '#334155', true: '#3b82f6' }}
                  thumbColor="#f1f5f9"
                />
              </View>

              <View style={styles.actions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} disabled={saving}>
                  <Text style={styles.cancelText}>{t('cancel', 'Vazgeç')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, (saving || overLimit) && styles.btnDisabled]}
                  onPress={() => onSave(note.trim(), spoiler)}
                  disabled={saving || overLimit}
                >
                  {saving ? <ActivityIndicator size="small" color="#fff" /> : (
                    <Text style={styles.saveText}>{t('save', 'Kaydet')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
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
    padding: 24,
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: '#22304A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    color: '#f1f5f9',
    fontSize: 17,
    fontWeight: '700',
  },
  input: {
    minHeight: 90,
    maxHeight: 160,
    backgroundColor: '#172033',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#22304A',
    color: '#e2e8f0',
    fontSize: 14,
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
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
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
  saveBtn: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#3b82f6',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  saveText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
