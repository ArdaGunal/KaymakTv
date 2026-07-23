import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, TouchableWithoutFeedback, Alert } from 'react-native';
import { Star, CheckCheck } from 'lucide-react-native';
import LoadingIndicator from '../LoadingIndicator';
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
      Alert.alert(t('common:error'), t('common:guestRestrictedMessage', 'Bu işlemi gerçekleştirmek için giriş yapmalısınız.'));
      onClose();
      return;
    }
    onRatePress();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>S{episode?.season} E{episode?.episode}: {episode?.title}</Text>
                <Text style={styles.modalSubtitle}>{t('episodeOptions')}</Text>
              </View>
              
              <TouchableOpacity
                style={styles.modalButton}
                onPress={handleRatePress}
              >
                <Star size={20} color="#f59e0b" fill="#f59e0b" />
                <Text style={[styles.modalButtonText, {color: '#f59e0b'}]}>{t('rateOrEdit')}</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.modalButton} 
                onPress={onRewatch}
                disabled={!!loadingOption}
              >
                {loadingOption === 'rewatch' ? (
                  <LoadingIndicator size="small" color="#3b82f6" />
                ) : (
                  <>
                    <CheckCheck size={20} color="#10b981" />
                    <Text style={[styles.modalButtonText, {color: '#10b981'}]}>{t('rewatch')}</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.modalButton, {borderBottomWidth: 0}]} 
                onPress={onUnwatch}
                disabled={!!loadingOption}
              >
                {loadingOption === 'remove' ? (
                  <LoadingIndicator size="small" color="#ef4444" />
                ) : (
                  <>
                    <Text style={[styles.modalButtonText, {color: '#ef4444', marginLeft: 0}]}>{t('unwatch')}</Text>
                    <Text style={{color: '#737373', fontSize: 11, marginTop: 4}}>{t('allRecordsDeleted')}</Text>
                  </>
                )}
              </TouchableOpacity>

            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
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
});
