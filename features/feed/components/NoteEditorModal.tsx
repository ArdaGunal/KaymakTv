import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { confirmAsync } from '../../../utils/confirmDialog';
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
import { X } from '../../../components/icons';

// 500 DEĞİL 1000: Worker'ın `/feed/note`si (handleFeedNote) ve DB kısıtı
// (`feed_activities_note_length`, 017_feed_posts.sql) 1000'e çıkarıldı —
// bu alan artık hem kısa alıntıları hem "Fikir Paylaş" gönderilerinin ana
// metnini taşıyor (bkz. FeedActivityNote.tsx, ComposePostModal.tsx'in AYNI
// POST_MAX_LENGTH'i). Bu sabit eskiden 500'de kalmıştı — 501-1000 karakter
// arası bir gönderiyi (ComposePostModal ile oluşturulmuş, geçerli) buradan
// tekrar kaydetmeye çalışmak "limit aşıldı" diye SESSİZCE engelleniyordu.
const NOTE_MAX_LENGTH = 1000;

interface NoteEditorModalProps {
  visible: boolean;
  initialNote: string;
  initialSpoiler: boolean;
  saving: boolean;
  /** Kaydetme başarısız olduysa gösterilecek mesaj — ComposePostModal'daki
   *  AYNI desen. Olmadan kaydetme hatası SESSİZ kalıyordu: modal açık kalıyor
   *  ama kullanıcı neden kapanmadığını göremiyordu (bkz. docs/AI_RULES.md
   *  § Sessiz başarısızlık YASAKTIR). */
  error?: string | null;
  onSave: (note: string, spoiler: boolean) => void;
  onCancel: () => void;
}

/**
 * Kendi aktivitene kişisel not/alıntı ekleme sheet'i (bkz.
 * docs/design/FEED_SOCIAL_PLAN.md §3.6). "Çok güzeldi!" gibi Letterboxd tarzı bir
 * inceleme — Trakt'ın kendi yorum sistemiyle karışmaz, yalnızca KaymakTV
 * içinde yaşar.
 */
export default function NoteEditorModal({
  visible,
  initialNote,
  initialSpoiler,
  saving,
  error,
  onSave,
  onCancel,
}: NoteEditorModalProps) {
  const { t } = useTranslation('feed');
  const [note, setNote] = useState(initialNote);
  const [spoiler, setSpoiler] = useState(initialSpoiler);

  /**
   * Y16: kapatma yolu artık ONAY istiyor. Eskiden arka plana dokunmak, X ve
   * Android geri tuşu değişiklikleri onaysız atıyordu — klavyeyi kapatmak için
   * karartılmış alana dokunmak mobilde en doğal refleks olduğu için yazılan
   * metin tek dokunuşla, geri alınamaz şekilde gidiyordu. WriteReviewSheet bu
   * korumayı F4-T9 sırasında kazanmıştı; kapatma tarafı buraya taşınmamıştı.
   *
   * Burada ölçüt "metin var mı" değil "DEĞİŞTİ mi" — düzenleme modunda mevcut
   * not zaten dolu geliyor, hiçbir şey yazmadan kapatan kullanıcıya onay
   * sormak gereksiz sürtünme olurdu.
   */
  const requestClose = async () => {
    const changed = note.trim() !== (initialNote ?? '').trim();
    if (!changed) { onCancel(); return; }
    const confirmed = await confirmAsync(
      t('noteDiscardTitle', 'Nottan çıkılsın mı?'),
      t('noteDiscardText', 'Yaptığın değişiklikler kaydedilmeyecek.'),
      t('discardConfirm', 'Vazgeç'),
      t('keepEditing', 'Devam Et')
    );
    if (confirmed) onCancel();
  };

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
      onRequestClose={requestClose}
      statusBarTranslucent={Platform.OS === 'android'}
    >
      <TouchableWithoutFeedback onPress={requestClose}>
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
                <TouchableOpacity onPress={requestClose} hitSlop={8}>
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

              {!!error && <Text style={styles.error}>{error}</Text>}

              <View style={styles.actions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={requestClose} disabled={saving}>
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
  // ComposePostModal.tsx'teki hata satırıyla AYNI görsel dil.
  error: {
    color: '#f87171',
    fontSize: 12,
    marginTop: 12,
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
