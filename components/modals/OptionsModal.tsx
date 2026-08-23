import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, Share, Alert } from 'react-native';
import { PauseCircle, PlayCircle, Share2, CheckCheck, Trash2 } from '../icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { generateMediaSlug } from '../../utils/slugHelper';
import { confirmAsync } from '../../utils/confirmDialog';

interface OptionsModalProps {
  visible: boolean;
  onClose: () => void;
  type: 'show' | 'movie';
  data: any;
  isWatched?: boolean;
  /** "İzlemeyi Bırak" eylemi — dizi/filmi Trakt'ın gizlenen listesinde mi
   * (true → satır "İzlemeye Devam Et"e döner). Diziler için `progress_watched`,
   * filmler için `calendar` bölümü kullanılır (bkz.
   * services/api/users.ts:hideItemTrakt); ayrı bir yerel "bırakıldı" durumu
   * YOKTUR. */
  isHidden?: boolean;
  /** Trakt'a giden asenkron bir istektir (bkz. toggleHiddenFromProgress) —
   * `handleHideProgress` bunu BEKLER ve reddedilirse kullanıcıya görünür bir
   * hata gösterir (aksi halde ağ hatası/401 gibi durumlarda buton "hiçbir şey
   * yapmıyormuş" gibi hissettirir, bkz. Madde 99). */
  onHideFromProgress?: () => void | Promise<void>;
  onDeleteFromHistory?: () => void;
  onRewatch?: () => void;
}

export default function OptionsModal({
  visible,
  onClose,
  type,
  data,
  isWatched,
  isHidden,
  onHideFromProgress,
  onDeleteFromHistory,
  onRewatch,
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

  const handleHideProgress = async () => {
    if (isGuest) {
      Alert.alert(t('common:error'), t('common:guestRestrictedMessage', 'Bu işlemi gerçekleştirmek için giriş yapmalısınız.'));
      onClose();
      return;
    }
    if (!onHideFromProgress) return;
    // ONAY DİYALOĞU YOK (bilinçli, kullanıcı kararı): "İzlemeyi Bırak"a basan
    // kullanıcı ne yaptığını zaten biliyor; üstelik eylem YIKICI DEĞİL —
    // izleme geçmişi/puanlar korunur, yapım Kütüphane > "Gizlenenler /
    // Bırakılanlar" filtresinden her an geri getirilebilir ve yeni bir bölüm
    // izlenince otomatik geri döner (bkz. mutations/progress.ts:
    // unhideShowIfNeeded). Takip panosundaki 3-nokta menüsü (TrackingCardMenu)
    // da zaten onay sormuyordu — bu satır o davranışla eşitlendi.
    onClose();
    // ESKİ DAVRANIŞ: `onHideFromProgress()` (Trakt'a giden asenkron bir
    // istek) ne await edilip ne yakalanıyordu — reddedilirse tamamen SESSİZ
    // bir "unhandled promise rejection" oluşuyordu. Kullanıcı butona basıyor,
    // ağ hatası/401 gibi bir sebeple istek başarısız oluyor, YERELDEKİ iyimser
    // güncelleme kendi içinde rollback yapıyor (bkz. toggleHiddenFromProgress)
    // ama ekranda HİÇBİR ŞEY göstermiyordu — "İzlemeyi Bırak" butonu
    // "çalışmıyor gibi" hissettiriyordu, tek iz cihazın hata günlüğünde kalıyordu.
    try {
      await onHideFromProgress();
    } catch (error) {
      console.error('İzlemeyi Bırak hatası:', error);
      Alert.alert(t('common:error'), t('common:actionFailedMessage'));
    }
  };

  const handleDeleteHistory = async () => {
    if (isGuest) {
      Alert.alert(t('common:error'), t('common:guestRestrictedMessage', 'Bu işlemi gerçekleştirmek için giriş yapmalısınız.'));
      onClose();
      return;
    }
    if (!onDeleteFromHistory) return;
    const confirmed = await confirmAsync(
      t('areYouSure'),
      t('historyDeleteConfirm'),
      t('yesDelete'),
      t('common:cancel')
    );
    if (!confirmed) return;
    onDeleteFromHistory();
    onClose();
    // Diziler: tüm izleme geçmişi/ilerlemesi silindiği için gösterilecek
    // bir şey kalmaz, geri dönmek mantıklı. Filmler: tek film söz konusu,
    // sayfada kalıp "İzledim" butonunun eski haline dönmesi görülebilsin.
    if (type === 'show') {
      router.back();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={styles.modalContent}>

          {/* İzleme Listesi artık burada DEĞİL — tek, görünür yerden (MediaHero
              rozet satırındaki Bookmark butonu) yönetiliyor. Aynı eylemi iki
              yerde göstermek karışıklık yaratırdı (bkz. docs/HISTORY.md). */}

          {/* "İzlemeyi Bırak" — hem diziler hem filmler için Trakt'ın gizleme uç
              noktasına bağlıdır (bkz. isHidden/onHideFromProgress), takip
              panosundaki 3-nokta menüsüyle (`TrackingCardMenu`) BİREBİR AYNI
              eylem/mekanizma/ikon — yalnızca buradan iki yöne de (bırak/devam
              et) çalışabilir, panodaki menü tek yönlüdür (bkz. o dosyadaki not).
              `PauseCircle` uygulama genelinde bu eylemin TEK ikonudur;
              "devam et" yönünde onun doğal karşıtı `PlayCircle` kullanılır. */}
          {onHideFromProgress && (
            <TouchableOpacity style={styles.optionRow} onPress={handleHideProgress}>
              {isHidden ? <PlayCircle color="#38bdf8" size={24} /> : <PauseCircle color="#fff" size={24} />}
              <Text style={[styles.optionText, isHidden && { color: '#38bdf8' }]}>
                {isHidden ? t('unhideProgress') : t('hideProgress')}
              </Text>
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
