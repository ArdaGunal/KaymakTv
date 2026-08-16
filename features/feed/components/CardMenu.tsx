import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MoreVertical, Pencil, Trash2, Share2, Flag, UserX } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { confirmAsync } from '../utils/confirmDialog';

interface CardMenuProps {
  /** Verilmezse "Düzenle" satırı hiç render edilmez. */
  onEdit?: () => void;
  /** Verilmezse "Sil" satırı hiç render edilmez. Onay burada (CardMenu
   *  içinde) alınır — çağıran yalnızca "onaylandı, gerçekleştir" alır. */
  onDelete?: () => void | Promise<void>;
  /** Verilmezse "Paylaş" satırı hiç render edilmez. */
  onShare?: () => void;
  /** Verilmezse "İçeriği Bildir" satırı hiç render edilmez — yalnızca
   *  BAŞKASININ içeriğinde geçirilmeli (bkz. FeedCard.tsx: isOwnActivity
   *  false iken). Onay gerektirmez, doğrudan ReportContentModal'ı açar. */
  onReport?: () => void;
  /** Verilmezse "Kullanıcıyı Engelle" satırı hiç render edilmez — yalnızca
   *  BAŞKASININ içeriğinde geçirilmeli. Onay çağıranın (useBlockState akışı)
   *  sorumluluğunda, burada yalnızca tetiklenir. */
  onBlock?: () => void;
  style?: any;
}

const MENU_WIDTH = 200;
const EDGE_MARGIN = 12;
const ROW_HEIGHT = 46;

// Aktivite kartlarındaki "⋯" menüsü — components/tracking/TrackingCardMenu.tsx
// ile AYNI konumlandırma deseni (dokunulan butonun ekrandaki konumunu ölçüp
// hemen yanında açılan, ekran sınırlarına/safe-area'ya göre kırpılan mutlak
// konumlu bir açılır menü). O bileşenden BİLİNÇLİ OLARAK ayrı tutuldu —
// TrackingCardMenu afiş kartlarına özel (favori/listeye ekle/bırak) mantık
// taşıyor, burası yalnızca Düzenle/Sil/Paylaş — genelleştirmek gereksiz bir
// bağımlılık yaratırdı.
export default function CardMenu({ onEdit, onDelete, onShare, onReport, onBlock, style }: CardMenuProps) {
  const { t } = useTranslation(['media', 'feed', 'common']);
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const triggerRef = useRef<View>(null);

  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [isDeleting, setIsDeleting] = useState(false);

  // Hiçbir eylem verilmediyse (ör. isPending bir kartta hiç render edilmemesi
  // gerekiyordu ama çağıran unutursa) sessizce hiçbir şey gösterme.
  if (!onEdit && !onDelete && !onShare && !onReport && !onBlock) return null;

  const openMenu = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setOpen(true);
    });
  };

  const closeMenu = () => setOpen(false);

  const handleEdit = () => {
    closeMenu();
    onEdit?.();
  };

  const handleShare = () => {
    closeMenu();
    onShare?.();
  };

  const handleReport = () => {
    closeMenu();
    onReport?.();
  };

  const handleBlock = () => {
    closeMenu();
    onBlock?.();
  };

  const handleDelete = async () => {
    const confirmed = await confirmAsync(
      t('media:activityDeleteConfirmTitle', 'Aktiviteyi Sil'),
      t('media:activityDeleteConfirmMessage', 'Bu aktiviteyi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.'),
      t('common:delete'),
      t('common:cancel')
    );
    if (!confirmed) return;
    // Onay ekranın kendi (Alert/window.confirm) UI'ında alınıyor — menü ONAY
    // SONRASINA kadar açık kalır, aksi halde silme kararını "Sil" satırına
    // basar basmaz kaybederdik.
    setIsDeleting(true);
    try {
      await onDelete?.();
    } finally {
      setIsDeleting(false);
      closeMenu();
    }
  };

  const rowCount = [onEdit, onDelete, onShare, onReport, onBlock].filter(Boolean).length;
  const estimatedMenuHeight = rowCount * ROW_HEIGHT + 12;
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
        <MoreVertical size={16} color="#94a3b8" />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={closeMenu}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeMenu}>
          <View style={[styles.menu, { top, left, width: MENU_WIDTH }]}>
            {onEdit && (
              <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={handleEdit}>
                <Pencil size={16} color="#f1f5f9" />
                <Text style={styles.menuItemText}>{t('common:edit')}</Text>
              </TouchableOpacity>
            )}

            {onShare && (
              <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={handleShare}>
                <Share2 size={16} color="#f1f5f9" />
                <Text style={styles.menuItemText}>{t('media:share')}</Text>
              </TouchableOpacity>
            )}

            {onReport && (
              <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={handleReport}>
                <Flag size={16} color="#f1f5f9" />
                <Text style={styles.menuItemText}>{t('feed:reportContentMenuLabel', 'İçeriği Bildir')}</Text>
              </TouchableOpacity>
            )}

            {onBlock && (
              <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={handleBlock}>
                <UserX size={16} color="#f1f5f9" />
                <Text style={styles.menuItemText}>{t('feed:blockUserMenuLabel', 'Kullanıcıyı Engelle')}</Text>
              </TouchableOpacity>
            )}

            {onDelete && (
              <TouchableOpacity
                style={styles.menuItem}
                activeOpacity={0.7}
                onPress={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#f87171" />
                ) : (
                  <Trash2 size={16} color="#f87171" />
                )}
                <Text style={[styles.menuItemText, styles.deleteText]}>{t('common:delete')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
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
  menuItemText: { color: '#f1f5f9', fontSize: 14, fontWeight: '600' },
  deleteText: { color: '#f87171' },
});
