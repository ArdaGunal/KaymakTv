import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { notify } from '../../utils/confirmDialog';
import { Star, CheckCheck, Trash2 } from '../icons';
import OrtaPencere from './OrtaPencere';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';

interface EpisodeOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  episode: { season: number; episode: number; title: string } | null;
  loadingOption: 'remove' | 'rewatch' | null;
  onRatePress: () => void;
  onRewatch: () => void;
  onUnwatch: () => void;
}

export default function EpisodeOptionsModal({
  visible,
  onClose,
  episode,
  loadingOption,
  onRatePress,
  onRewatch,
  onUnwatch
}: EpisodeOptionsModalProps) {
  const { t } = useTranslation(['media', 'common']);
  const { isGuest } = useAuth();

  // ESKİ HATA: bu satır misafir kontrolü yapmadan doğrudan puanlama modalını
  // açıyordu — misafir bir bölümü puanlamaya çalıştığında Trakt'a token'sız
  // istek gidip genel bir "hata oluştu" mesajıyla karşılaşıyordu. Diğer tüm
  // aksiyonlar (izlendi/geri al) zaten `useShowDetailHandlers.ts` içinde
  // korunuyor — bu, aynı korumanın eksik olduğu tek satırdı.
  const handleRatePress = () => {
    if (isGuest) {
      notify(t('common:error'), t('common:guestRestrictedMessage', 'Bu işlemi gerçekleştirmek için giriş yapmalısınız.'));
      onClose();
      return;
    }
    onRatePress();
  };

  return (
    <OrtaPencere visible={visible} onClose={onClose}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>S{episode?.season} E{episode?.episode}: {episode?.title}</Text>
        <Text style={styles.modalSubtitle}>{t('episodeOptions')}</Text>
      </View>

      <TouchableOpacity style={styles.modalButton} onPress={handleRatePress}>
        <Star size={20} color="#f59e0b" fill="#f59e0b" />
        <Text style={[styles.modalButtonText, { color: '#f59e0b' }]}>{t('rateOrEdit')}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.modalButton} onPress={onRewatch} disabled={!!loadingOption}>
        {loadingOption === 'rewatch' ? (
          <ActivityIndicator size="small" color="#3b82f6" />
        ) : (
          <>
            <CheckCheck size={20} color="#10b981" />
            <Text style={[styles.modalButtonText, { color: '#10b981' }]}>{t('rewatch')}</Text>
          </>
        )}
      </TouchableOpacity>

      {/* 2.6.8 MENU-01: başlık ve açıklama eskiden yan yana yapışıyordu
          («İzlemeyi KaldırTüm izleme kayıtları silinecek») — artık alt alta. */}
      <TouchableOpacity style={[styles.modalButton, styles.lastButton]} onPress={onUnwatch} disabled={!!loadingOption}>
        {loadingOption === 'remove' ? (
          <ActivityIndicator size="small" color="#ef4444" />
        ) : (
          <>
            <Trash2 size={20} color="#ef4444" />
            <View style={styles.destructiveTextWrap}>
              <Text style={[styles.modalButtonText, styles.destructiveText]}>{t('unwatch')}</Text>
              <Text style={styles.destructiveSubtext}>{t('allRecordsDeleted')}</Text>
            </View>
          </>
        )}
      </TouchableOpacity>
    </OrtaPencere>
  );
}

const styles = StyleSheet.create({
  modalHeader: {
    marginBottom: 20,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  modalSubtitle: {
    color: '#a3a3a3',
    fontSize: 14,
  },
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  lastButton: {
    borderBottomWidth: 0,
  },
  destructiveTextWrap: {
    flex: 1,
  },
  destructiveText: {
    color: '#ef4444',
  },
  destructiveSubtext: {
    color: '#737373',
    fontSize: 11,
    marginTop: 2,
    marginLeft: 12,
  },
});
