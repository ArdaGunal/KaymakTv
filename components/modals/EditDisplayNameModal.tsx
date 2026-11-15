import { nativeColor } from '../../constants/mobilePalette';
import React, { useState } from 'react';
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
import { useGorunenAdDuzenle } from '../../hooks/useGorunenAdDuzenle';
import { AD_EN_COK, gorunenAdHataMetni } from '../../utils/gorunenAd';
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
 * 🔴 Kurallar SUNUCUDA (`kaymaktv-feedback-worker/src/lib/profileDisplayName.js`);
 * mantık `hooks/useGorunenAdDuzenle.ts`'te (kural K2, kaldırma hakkı K4, denetim bulgusu 2);
 * bu dosya yalnız çizer. Yanılsa bile Worker 400 döner ve hata aşağıda görünür (AI_RULES §2).
 */
export default function EditDisplayNameModal({ visible, onClose, currentName, onSaved }: EditDisplayNameModalProps) {
  const { t } = useTranslation(['settings', 'common']);
  const insets = useSafeAreaInsets();
  const d = useGorunenAdDuzenle({ visible, currentName });
  const [toast, setToast] = useState(false);

  const handleClose = () => {
    if (d.isSaving) return;
    onClose();
  };

  const handleSave = async () => {
    if (await d.kaydet()) {
      onSaved?.(d.yeni);
      setToast(true);
      setTimeout(onClose, 900);
    }
  };

  // Uyarı önceliği: kural ihlali → görünmez karakter ayıklandı → olağan ipucu.
  const altMetin = d.sorun
    ? { stil: localStyles.kuralUyari, metin: gorunenAdHataMetni(t, d.sorun) }
    : d.gorunmezAyiklandi
      ? { stil: localStyles.kuralUyari, metin: t('settings:displayNameInvisibleRemoved', 'Görünmeyen karakterler çıkarıldı. Adını yaz ya da kutuyu kendin boşalt.') }
      : { stil: localStyles.hint, metin: t('settings:displayNameHint', 'Profilinde @kullanıcı adının üstünde görünür. Boş bırakırsan yalnızca kullanıcı adın görünür.') };

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
                <X color={nativeColor('muted', "#94a3b8")} size={22} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              value={d.value}
              onChangeText={d.onChange}
              maxLength={AD_EN_COK * 2}
              editable={!d.isSaving}
              placeholder={t('settings:displayNamePlaceholder', 'Adın ve soyadın')}
              placeholderTextColor={nativeColor('mutedDeep', "#64748b")}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={handleSave}
              autoFocus
            />
            <Text style={[localStyles.counter, d.sorun === 'cok_uzun' && localStyles.counterOver]}>
              {d.karar.uzunluk}/{AD_EN_COK}
            </Text>
            <Text style={altMetin.stil}>{altMetin.metin}</Text>

            {d.error && (
              <View style={[styles.notice, styles.noticeError]}>
                <Text style={[styles.noticeText, styles.noticeTextError]}>{d.error.askiMetni ?? gorunenAdHataMetni(t, d.error.code)}</Text>
              </View>
            )}

            <TouchableOpacity style={[styles.saveBtn, d.disabled && styles.disabledBtn]} onPress={handleSave} disabled={d.disabled}>
              {d.isSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>{t('common:save')}</Text>}
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
    color: nativeColor('mutedDeep', '#64748b'),
    fontSize: 12,
    alignSelf: 'flex-end',
    marginTop: 6,
  },
  counterOver: {
    color: '#fca5a5',
    fontWeight: '700',
  },
  hint: {
    color: nativeColor('mutedDeep', '#64748b'),
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
    marginBottom: 4,
  },
  // Kullanıcı adı kural uyarısıyla aynı ton (`profil-olustur.tsx` kuralUyari).
  kuralUyari: {
    color: '#fbbf24',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
    marginBottom: 4,
  },
});
