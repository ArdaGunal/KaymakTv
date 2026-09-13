import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
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
import { estimateCooldownRetryAt } from '../../features/feed/services/profile';
import Snackbar from '../Snackbar';
import { profileSheetStyles as styles } from './profileSheetStyles';

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
  currentUsername: string;
  /** `handleAccountProfileGet`'ten gelen ham değer — `null` = kilit yok. */
  usernameUpdatedAt: string | null;
  /** Başarılı kayıttan SONRA çağrılır — çağıran kendi ekran state'ini
   * (ör. `useMyGoogleProfile`'ın `profile`'ı) yeniden fetch etmeden
   * güncelleyebilsin diye yeni değeri taşır. */
  onSaved?: (username: string) => void;
}

/**
 * Ayarlar/Hesap'tan kullanıcı adı düzenleme — yalnızca Google-only
 * kullanıcılar için (bkz. `account.tsx`'teki `authProvider==='google'`
 * kapısı; Trakt kullanıcılarının adı Trakt'tan senkronlanıyor, buradan
 * değiştirilirse bir sonraki Trakt girişinde sessizce ESKİ hâline dönerdi
 * — bilinçli olarak kapsam dışı bırakıldı).
 *
 * `AddToListModal.tsx`'in Modal+TextInput+KeyboardAvoidingView iskeleti +
 * `ReportContentModal.tsx`'in `notice` (taken/cooldown/hata) deseni.
 */
export default function EditProfileModal({ visible, onClose, currentUsername, usernameUpdatedAt, onSaved }: EditProfileModalProps) {
  const { t, i18n } = useTranslation(['settings', 'common']);
  const insets = useSafeAreaInsets();
  const { save, isSaving, error, clearError } = useUpdateProfile();

  const [value, setValue] = useState(currentUsername);
  const [toast, setToast] = useState(false);

  useEffect(() => {
    if (visible) {
      setValue(currentUsername);
      clearError();
    }
  }, [visible, currentUsername, clearError]);

  const retryAt = estimateCooldownRetryAt(usernameUpdatedAt);
  const trimmed = value.trim();
  const unchanged = trimmed === currentUsername.trim();
  const invalid = trimmed.length === 0 || trimmed.length > 30;

  const handleClose = () => {
    if (isSaving) return;
    onClose();
  };

  const handleSave = async () => {
    if (unchanged || invalid || retryAt) return;
    const ok = await save({ username: trimmed });
    if (ok) {
      onSaved?.(trimmed);
      setToast(true);
      setTimeout(onClose, 900);
    }
  };

  const cooldownText = retryAt
    ? t('settings:usernameCooldownActive', {
        date: retryAt.toLocaleDateString(i18n.language, { day: 'numeric', month: 'long' }),
        defaultValue: 'Kullanıcı adını en erken {{date}} tarihinde tekrar değiştirebilirsin.',
      })
    : null;

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
        <KeyboardAvoidingView behavior="padding" style={styles.modalOverlay}>
          <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={handleClose} />
          <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 20) }, Platform.OS === 'web' && styles.modalContentWeb]}>
            <View style={styles.grabber} />
            <View style={styles.header}>
              <Text style={styles.title}>{t('settings:editUsernameTitle', 'Kullanıcı Adını Düzenle')}</Text>
              <TouchableOpacity onPress={handleClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X color="#94a3b8" size={22} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.input, !!retryAt && styles.inputDisabled]}
              value={value}
              onChangeText={setValue}
              maxLength={30}
              editable={!retryAt && !isSaving}
              placeholder={t('settings:usernamePlaceholder', 'Kullanıcı adın')}
              placeholderTextColor="#64748b"
              autoFocus={!retryAt}
            />

            {cooldownText && (
              <View style={[styles.notice, styles.noticeInfo]}>
                <Text style={[styles.noticeText, styles.noticeTextInfo]}>{cooldownText}</Text>
              </View>
            )}

            {error && !retryAt && (
              <View style={[styles.notice, styles.noticeError]}>
                <Text style={[styles.noticeText, styles.noticeTextError]}>
                  {error.code === 'taken'
                    ? t('settings:usernameTaken', 'Bu kullanıcı adı zaten alınmış, başka bir tane dene.')
                    : error.message}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.saveBtn, (unchanged || invalid || !!retryAt || isSaving) && styles.disabledBtn]}
              onPress={handleSave}
              disabled={unchanged || invalid || !!retryAt || isSaving}
            >
              {isSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>{t('common:save')}</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <Snackbar
        visible={toast}
        message={t('settings:usernameSaved', 'Kullanıcı adın güncellendi.')}
        onDismiss={() => setToast(false)}
      />
    </>
  );
}
