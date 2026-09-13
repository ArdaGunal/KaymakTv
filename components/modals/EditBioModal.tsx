import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { X } from '../icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUpdateProfile } from '../../hooks/useUpdateProfile';
import { BIO_EN_COK, BIO_EN_COK_SATIR, bioOnizle } from '../../features/feed/services/profile';
import Snackbar from '../Snackbar';
import { profileSheetStyles as styles } from './profileSheetStyles';

interface EditBioModalProps {
  visible: boolean;
  onClose: () => void;
  /** Sunucudaki mevcut açıklama — `null` = hiç yazılmamış. */
  currentBio: string | null;
  /** Başarılı kayıttan SONRA — çağıran ekran state'ini yeniden fetch etmeden güncellesin. */
  onSaved?: (bio: string | null) => void;
}

/**
 * Profil açıklaması (bio) düzenleme — Faz T · T4 (`043`).
 *
 * Kullanıcı adından AYRI modal: adın 14 günlük cooldown'u var, açıklamanın
 * yok. Tek formda ikisi birlikte olsaydı "ad kilitliyken açıklama da mı
 * kilitli?" belirsizliği doğardı ve cooldown hatası açıklama kaydını da
 * reddederdi (Worker tüm-ya-da-hiç).
 *
 * 🔴 Kurallar SUNUCUDA (`kaymaktv-feedback-worker/src/lib/profileBio.js`).
 * Buradaki sayaç ve satır uyarısı yalnızca gösterge — yanılsa bile Worker
 * 400 döner ve mesajı aşağıda görünür (sessiz başarısızlık yok, AI_RULES §2).
 */
export default function EditBioModal({ visible, onClose, currentBio, onSaved }: EditBioModalProps) {
  const { t } = useTranslation(['settings', 'common']);
  const insets = useSafeAreaInsets();
  const { save, isSaving, error, clearError } = useUpdateProfile();

  const [value, setValue] = useState(currentBio ?? '');
  const [toast, setToast] = useState(false);

  useEffect(() => {
    if (visible) {
      setValue(currentBio ?? '');
      clearError();
    }
  }, [visible, currentBio, clearError]);

  const onizleme = bioOnizle(value);
  const unchanged = onizleme.deger === (currentBio ?? '');
  const tooLong = onizleme.uzunluk > BIO_EN_COK;
  const tooManyLines = onizleme.satir > BIO_EN_COK_SATIR;
  const disabled = unchanged || tooLong || tooManyLines || isSaving;

  const handleClose = () => {
    if (isSaving) return;
    onClose();
  };

  const handleSave = async () => {
    if (disabled) return;
    // Boş kutu = açıklamayı KALDIR (`null`), boş string DEĞİL — DB CHECK'i
    // boş string'i zaten reddeder.
    const yeni = onizleme.deger || null;
    const ok = await save({ bio: yeni });
    if (ok) {
      onSaved?.(yeni);
      setToast(true);
      setTimeout(onClose, 900);
    }
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
        <KeyboardAvoidingView behavior="padding" style={styles.modalOverlay}>
          <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={handleClose} />
          <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 20) }, Platform.OS === 'web' && styles.modalContentWeb]}>
            <View style={styles.grabber} />
            <View style={styles.header}>
              <Text style={styles.title}>{t('settings:editBioTitle', 'Hakkımda')}</Text>
              <TouchableOpacity onPress={handleClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X color="#94a3b8" size={22} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.input, localStyles.multiline]}
              value={value}
              onChangeText={setValue}
              multiline
              maxLength={BIO_EN_COK * 3}
              editable={!isSaving}
              placeholder={t('settings:bioPlaceholder', 'Kendinden kısaca bahset')}
              placeholderTextColor="#64748b"
              autoFocus
            />
            <Text style={[localStyles.counter, tooLong && localStyles.counterOver]}>
              {onizleme.uzunluk}/{BIO_EN_COK}
            </Text>

            {tooManyLines && (
              <View style={[styles.notice, styles.noticeInfo]}>
                <Text style={[styles.noticeText, styles.noticeTextInfo]}>
                  {t('settings:bioTooManyLines', {
                    max: BIO_EN_COK_SATIR,
                    defaultValue: 'Açıklama en fazla {{max}} satır olabilir.',
                  })}
                </Text>
              </View>
            )}

            {error && (
              <View style={[styles.notice, styles.noticeError]}>
                <Text style={[styles.noticeText, styles.noticeTextError]}>{error.message}</Text>
              </View>
            )}

            <TouchableOpacity style={[styles.saveBtn, disabled && styles.disabledBtn]} onPress={handleSave} disabled={disabled}>
              {isSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>{t('common:save')}</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <Snackbar
        visible={toast}
        message={t('settings:bioSaved', 'Açıklaman güncellendi.')}
        onDismiss={() => setToast(false)}
      />
    </>
  );
}

const localStyles = StyleSheet.create({
  multiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  counter: {
    color: '#64748b',
    fontSize: 12,
    alignSelf: 'flex-end',
    marginTop: 6,
  },
  counterOver: {
    color: '#fca5a5',
    fontWeight: '700',
  },
});
