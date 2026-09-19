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
import { AD_EN_COK, adOnizle } from '../../features/feed/services/profile';
import Snackbar from '../Snackbar';
import { profileSheetStyles as styles } from './profileSheetStyles';

interface EditDisplayNameModalProps {
  visible: boolean;
  onClose: () => void;
  /** Sunucudaki mevcut görünen ad — `null` = yok. */
  currentName: string | null;
  /** Başarılı kayıttan SONRA. */
  onSaved?: (name: string | null) => void;
}

/**
 * Görünen ad düzenleme — §C24 · `053` (kullanıcı kararı K1, 2026-09-18:
 * *"@username dışında gerçek isimlerini kullanabilmeleri şart."*).
 *
 * `EditBioModal`'ın birebir kalıbı; farkı TEK SATIR ve 50 kod noktası.
 * Kullanıcı adından AYRI: adın 14 günlük cooldown'u var (ve Trakt'lı hesapta
 * hiç değiştirilemiyor — K2), görünen adın ikisi de yok.
 *
 * 🔴 Kurallar SUNUCUDA (`kaymaktv-feedback-worker/src/lib/profileDisplayName.js`).
 * Sayaç yalnızca gösterge — yanılsa bile Worker 400 döner ve mesajı aşağıda
 * görünür (sessiz başarısızlık yok, AI_RULES §2).
 */
export default function EditDisplayNameModal({ visible, onClose, currentName, onSaved }: EditDisplayNameModalProps) {
  const { t } = useTranslation(['settings', 'common']);
  const insets = useSafeAreaInsets();
  const { save, isSaving, error, clearError } = useUpdateProfile();

  const [value, setValue] = useState(currentName ?? '');
  const [toast, setToast] = useState(false);

  useEffect(() => {
    if (visible) {
      setValue(currentName ?? '');
      clearError();
    }
  }, [visible, currentName, clearError]);

  const onizleme = adOnizle(value);
  const unchanged = onizleme.deger === (currentName ?? '');
  const tooLong = onizleme.uzunluk > AD_EN_COK;
  const disabled = unchanged || tooLong || isSaving;

  const handleClose = () => {
    if (isSaving) return;
    onClose();
  };

  const handleSave = async () => {
    if (disabled) return;
    // Boş kutu = görünen adı KALDIR (`null`) → arayüz @username'e düşer.
    const yeni = onizleme.deger || null;
    const ok = await save({ displayName: yeni });
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
              <Text style={styles.title}>{t('settings:editDisplayNameTitle', 'Görünen Ad')}</Text>
              <TouchableOpacity onPress={handleClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X color="#94a3b8" size={22} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              value={value}
              onChangeText={setValue}
              maxLength={AD_EN_COK * 2}
              editable={!isSaving}
              placeholder={t('settings:displayNamePlaceholder', 'Adın ve soyadın')}
              placeholderTextColor="#64748b"
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={handleSave}
              autoFocus
            />
            <Text style={[localStyles.counter, tooLong && localStyles.counterOver]}>
              {onizleme.uzunluk}/{AD_EN_COK}
            </Text>
            <Text style={localStyles.hint}>
              {t('settings:displayNameHint', 'Profilinde @kullanıcı adının üstünde görünür. Boş bırakırsan yalnızca kullanıcı adın görünür.')}
            </Text>

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
        message={t('settings:displayNameSaved', 'Görünen adın güncellendi.')}
        onDismiss={() => setToast(false)}
      />
    </>
  );
}

const localStyles = StyleSheet.create({
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
  hint: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
    marginBottom: 4,
  },
});
