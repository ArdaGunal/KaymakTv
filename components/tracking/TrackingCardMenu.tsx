import React, { memo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  Platform,
  Share,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MoreVertical, Bookmark, ListPlus, Heart, Share2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useLibrarySelector, useLibraryActions } from '../../context/LibraryContext';
import { generateMediaSlug } from '../../utils/slugHelper';
import AddToListModal from '../AddToListModal';

interface TrackingCardMenuProps {
  id: number;
  showName: string;
  tmdbId?: number;
  slug?: string;
  isDropped: boolean;
  onToggleDropped: () => void;
  style?: any;
}

const MENU_WIDTH = 240;
const EDGE_MARGIN = 12;
const ROW_HEIGHT = 46;
const ROW_COUNT = 5; // Bırakılanlara Ekle, Listeye Ekle, Favorilere Ekle, Paylaş, Vazgeç

// Afiş kartlarındaki 3-nokta menüsü. Eskiden tam ekran bir bottom-sheet'ti —
// uzun bir listede en üstteki bir kart için bile menü hep ekranın en altında
// açılıyordu ("dizinin hizasında" değil) ve bazı cihazlarda alt navigasyon
// çubuğunun ARKASINDA kalabiliyordu. Artık dokunulan 3-nokta butonunun hemen
// yanında açılan, ekran sınırlarına ve safe-area insets'e göre kırpılan
// mutlak-konumlu bir açılır menü (context menu). `Modal` kullanılmaya devam
// ediyor — kartların `overflow: 'hidden'` gövdesi tarafından kırpılmaması için.
const TrackingCardMenu = memo(
  ({ id, showName, tmdbId, slug, isDropped, onToggleDropped, style }: TrackingCardMenuProps) => {
    const { t } = useTranslation('media');
    const insets = useSafeAreaInsets();
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();
    const triggerRef = useRef<View>(null);

    const [open, setOpen] = useState(false);
    const [anchor, setAnchor] = useState({ x: 0, y: 0, width: 0, height: 0 });
    const [listModalVisible, setListModalVisible] = useState(false);

    const favShows = useLibrarySelector((s) => s.favShows);
    const { toggleFavoriteStatus } = useLibraryActions();
    const isFavorited = !!favShows?.some((item: any) => item.show?.ids?.trakt === id);

    const openMenu = () => {
      triggerRef.current?.measureInWindow((x, y, width, height) => {
        setAnchor({ x, y, width, height });
        setOpen(true);
      });
    };

    const closeMenu = () => setOpen(false);

    const handleToggleDropped = () => {
      closeMenu();
      onToggleDropped();
    };

    const handleToggleFavorite = () => {
      closeMenu();
      toggleFavoriteStatus(id, 'show', isFavorited, {
        ids: { trakt: id, tmdb: tmdbId, slug },
        title: showName,
      }).catch((e: unknown) => console.error(e));
    };

    const handleShare = async () => {
      closeMenu();
      try {
        const mediaSlug = generateMediaSlug(id, slug, showName);
        const url = `https://kaymaktv.com/show/${mediaSlug}`;
        await Share.share({ message: `${showName} ${t('shareShowMsg')}\n${url}` });
      } catch (e) {
        console.log(e);
      }
    };

    const openListModal = () => {
      closeMenu();
      setListModalVisible(true);
    };

    // Tercihen dokunulan butonun hemen altında/sağ hizasında açılır; ekranın
    // altına/üstüne veya kenarlarına taşacaksa (özellikle alt navigasyon
    // çubuğunun arkasına düşmemesi için `insets.bottom` hesaba katılarak)
    // sığacak şekilde kaydırılır.
    const estimatedMenuHeight = ROW_COUNT * ROW_HEIGHT + 12;
    const minTop = insets.top + EDGE_MARGIN;
    const maxTop = Math.max(screenHeight - insets.bottom - estimatedMenuHeight - EDGE_MARGIN, minTop);
    const top = Math.min(Math.max(anchor.y + anchor.height + 6, minTop), maxTop);

    const maxLeft = Math.max(screenWidth - MENU_WIDTH - EDGE_MARGIN, EDGE_MARGIN);
    const left = Math.min(Math.max(anchor.x + anchor.width - MENU_WIDTH, EDGE_MARGIN), maxLeft);

    return (
      <>
        <TouchableOpacity
          ref={triggerRef}
          style={[styles.trigger, style]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={(e: any) => {
            e?.stopPropagation?.();
            openMenu();
          }}
        >
          <MoreVertical size={16} color="#f1f5f9" />
        </TouchableOpacity>

        <Modal visible={open} transparent animationType="fade" onRequestClose={closeMenu}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeMenu}>
            <View style={[styles.menu, { top, left, width: MENU_WIDTH }]}>
              <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={handleToggleDropped}>
                <Bookmark size={18} color={isDropped ? '#fbbf24' : '#f1f5f9'} />
                <Text style={styles.menuItemText}>
                  {isDropped ? t('removeFromDropped') : t('addToDropped')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={openListModal}>
                <ListPlus size={18} color="#f1f5f9" />
                <Text style={styles.menuItemText}>{t('addToList')}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={handleToggleFavorite}>
                <Heart size={18} color={isFavorited ? '#ef4444' : '#f1f5f9'} fill={isFavorited ? '#ef4444' : 'transparent'} />
                <Text style={styles.menuItemText}>
                  {isFavorited ? t('removeFromFavorites') : t('addToFavorites')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={handleShare}>
                <Share2 size={18} color="#f1f5f9" />
                <Text style={styles.menuItemText}>{t('share')}</Text>
              </TouchableOpacity>

              <View style={styles.divider} />

              <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={closeMenu}>
                <Text style={styles.dismissText}>{t('dismissAction')}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>

        <AddToListModal visible={listModalVisible} onClose={() => setListModalVisible(false)} mediaId={id} mediaType="show" />
      </>
    );
  }
);

export default TrackingCardMenu;

const styles = StyleSheet.create({
  trigger: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  menu: {
    position: 'absolute',
    backgroundColor: '#141b2e',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 6,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 12px 32px rgba(0,0,0,0.55)' } as any)
      : {
          shadowColor: '#000',
          shadowOpacity: 0.4,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 12,
        }),
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    height: ROW_HEIGHT,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  menuItemText: { color: '#f1f5f9', fontSize: 14, fontWeight: '600', flexShrink: 1 },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 4,
    marginHorizontal: 10,
  },
  dismissText: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
});
