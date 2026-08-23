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
import { estimateCooldownRetryAt } from '../../features/feed/services/profile';
import Snackbar from '../Snackbar';

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

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  backdropTouch: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  modalContentWeb: {
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
    borderRadius: 20,
    marginBottom: 24,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: '#fff',
    padding: 14,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  inputDisabled: {
    opacity: 0.5,
  },
  notice: {
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 9,
    paddingHorizontal: 11,
    marginTop: 12,
  },
  noticeInfo: {
    backgroundColor: 'rgba(56,189,248,0.08)',
    borderColor: 'rgba(56,189,248,0.25)',
  },
  noticeError: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderColor: 'rgba(239,68,68,0.28)',
  },
  noticeText: {
    fontSize: 12,
    lineHeight: 17,
  },
  noticeTextInfo: {
    color: '#7dd3fc',
  },
  noticeTextError: {
    color: '#fca5a5',
  },
  saveBtn: {
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  disabledBtn: {
    opacity: 0.5,
  },
});
