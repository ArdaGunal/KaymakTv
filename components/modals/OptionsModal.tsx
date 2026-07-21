import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, Share, Alert } from 'react-native';
import { Bookmark, EyeOff, Share2, CheckCheck, Trash2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { generateMediaSlug } from '../../utils/slugHelper';

interface OptionsModalProps {
  visible: boolean;
  onClose: () => void;
  type: 'show' | 'movie';
  data: any;
  isWatchlisted?: boolean;
  isWatched?: boolean;
  onToggleWatchlist: () => void;
  onHideFromProgress?: () => void;
  onDeleteFromHistory?: () => void;
  onRewatch?: () => void;
}

export default function OptionsModal({
  visible,
  onClose,
  type,
  data,
  isWatchlisted,
  isWatched,
  onToggleWatchlist,
  onHideFromProgress,
  onDeleteFromHistory,
  onRewatch
}: OptionsModalProps) {
  const { t } = useTranslation(['media', 'common']);
  const { isGuest } = useAuth();
  const router = useRouter();

  const handleShare = async () => {
    try {
      const slug = generateMediaSlug(data.ids.trakt, data.ids.slug, data.title);
      const url = `https://kaymaktv.com/${type}/${slug}`;
        
      await Share.share({
        message: `${data.title} ${type === 'show' ? t('shareShowMsg') : t('shareMovieMsg')}\n${url}`,
      });
      onClose();
    } catch (error) {
      console.log(error);
    }
  };

  const handleToggleWatchlist = () => {
    if (isGuest) {
      Alert.alert(t('common:error'), t('common:guestRestrictedMessage', 'Bu işlemi gerçekleştirmek için giriş yapmalısınız.'));
      onClose();
      return;
    }
    onToggleWatchlist();
    onClose();
  };

  const handleHideProgress = () => {
    if (isGuest) {
      Alert.alert(t('common:error'), t('common:guestRestrictedMessage', 'Bu işlemi gerçekleştirmek için giriş yapmalısınız.'));
      onClose();
      return;
    }
    if (!onHideFromProgress) return;
    // Trakt'ta gizlenen ilerleme uygulama içinden geri alınamıyor (görünür bir
    // "geri getir" akışımız yok) — bu yüzden diğer geri döndürülemez işlemler
    // gibi onay istiyoruz.
    Alert.alert(
      t('areYouSure'),
      t('hideProgressConfirmMsg'),
      [
        { text: t('common:cancel'), style: "cancel" },
        {
          text: t('yesHide'),
          style: "destructive",
          onPress: () => {
            onHideFromProgress();
            onClose();
          }
        }
      ]
    );
  };

  const handleDeleteHistory = () => {
    if (isGuest) {
      Alert.alert(t('common:error'), t('common:guestRestrictedMessage', 'Bu işlemi gerçekleştirmek için giriş yapmalısınız.'));
      onClose();
      return;
    }
    if (!onDeleteFromHistory) return;
    Alert.alert(
      t('areYouSure'),
      t('historyDeleteConfirm'),
      [
        { text: t('common:cancel'), style: "cancel" },
        {
          text: t('yesDelete'),
          style: "destructive",
          onPress: () => {
            onDeleteFromHistory();
            onClose();
            // Diziler: tüm izleme geçmişi/ilerlemesi silindiği için gösterilecek
            // bir şey kalmaz, geri dönmek mantıklı. Filmler: tek film söz konusu,
            // sayfada kalıp "İzledim" butonunun eski haline dönmesi görülebilsin.
            if (type === 'show') {
              router.back();
            }
          }
        }
      ]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={styles.modalContent}>
          
          <TouchableOpacity style={styles.optionRow} onPress={handleToggleWatchlist}>
            <Bookmark color={isWatchlisted ? "#3b82f6" : "#fff"} size={24} fill={isWatchlisted ? "#3b82f6" : "transparent"} />
            <Text style={styles.optionText}>
              {isWatchlisted ? t('removeFromWatchlist') : t('addToWatchlist')}
            </Text>
          </TouchableOpacity>

          {type === 'show' && onHideFromProgress && (
            <TouchableOpacity style={styles.optionRow} onPress={handleHideProgress}>
              <EyeOff color="#fff" size={24} />
              <Text style={styles.optionText}>{t('hideProgress')}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.optionRow} onPress={handleShare}>
            <Share2 color="#fff" size={24} />
            <Text style={styles.optionText}>{t('share')}</Text>
          </TouchableOpacity>

          {type === 'movie' && isWatched && onRewatch && (
            <TouchableOpacity style={styles.optionRow} onPress={() => {
              if (isGuest) {
                Alert.alert(t('common:error'), t('common:guestRestrictedMessage', 'Bu işlemi gerçekleştirmek için giriş yapmalısınız.'));
                onClose();
                return;
              }
              onRewatch();
              onClose();
            }}>
              <CheckCheck color="#10b981" size={24} />
              <Text style={[styles.optionText, {color: '#10b981'}]}>{t('rewatch')}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={[styles.optionRow, styles.destructiveRow]} onPress={handleDeleteHistory}>
            <Trash2 color="#ef4444" size={24} />
            <View style={styles.destructiveTextWrap}>
              <Text style={styles.destructiveText}>{t('removeHistory')}</Text>
              <Text style={styles.destructiveSubtext}>{t('removeHistorySub')}</Text>
            </View>
          </TouchableOpacity>

        </View>
      </Pressable>
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
    backgroundColor: 'rgba(23, 32, 51, 0.95)',
    padding: 24,
    paddingBottom: 40,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A364F',
  },
  optionText: {
    flex: 1,
    color: '#ffffff',
    fontSize: 16,
    marginLeft: 16,
    fontWeight: '500',
  },
  destructiveRow: {
    borderBottomWidth: 0,
    marginTop: 8,
  },
  // Başlık + alt satır aynı sarmalayıcı View'da hizalanır — eskiden alt metin
  // kendi marginLeft'ine sahip olmadığından ikonun altına kayıyor, başlıkla
  // hizasız görünüyordu.
  destructiveTextWrap: {
    flex: 1,
    marginLeft: 16,
  },
  destructiveText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: 'bold',
  },
  destructiveSubtext: {
    color: '#737373',
    fontSize: 11,
    marginTop: 2,
  },
});
