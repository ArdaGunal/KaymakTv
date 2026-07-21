import React, { memo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable, Platform } from 'react-native';
import { MoreVertical, Bookmark, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

interface TrackingCardMenuProps {
  isDropped: boolean;
  onToggleDropped: () => void;
  /** Sheet başlığında gösterilecek dizi adı. */
  title?: string;
  style?: any;
}

// Afiş kartlarındaki 3-nokta menüsü: kullanıcı bir diziyi manuel olarak
// "Bırakılanlar"a ekleyip çıkarabilir. Panel bir RN `Modal` (bottom-sheet) —
// eski sürüm kartın üzerine mutlak konumlu bir View olarak açılıyordu ve
// kartın `overflow: 'hidden'` gövdesi tarafından kırpılıp dokunulamaz hâle
// geliyordu. Modal, üst seviyede (kartın kırpma sınırlarının tamamen
// dışında) render edildiği için bu sorunu kökten çözer.
const TrackingCardMenu = memo(({ isDropped, onToggleDropped, title, style }: TrackingCardMenuProps) => {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation('media');

  return (
    <>
      <TouchableOpacity
        style={[styles.trigger, style]}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        onPress={(e: any) => {
          e?.stopPropagation?.();
          setOpen(true);
        }}
      >
        <MoreVertical size={16} color="#f1f5f9" />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          {/* İç Pressable: sheet'in kendisine dokunmak arka planı kapatmasın. */}
          <Pressable style={styles.sheet} onPress={(e: any) => e?.stopPropagation?.()}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHandle} />
              {title ? (
                <View style={styles.sheetTitleRow}>
                  <Text style={styles.sheetTitle} numberOfLines={1}>
                    {title}
                  </Text>
                  <TouchableOpacity
                    style={styles.closeButton}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    onPress={() => setOpen(false)}
                  >
                    <X size={16} color="#94a3b8" />
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>

            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.7}
              onPress={() => {
                setOpen(false);
                onToggleDropped();
              }}
            >
              <View style={[styles.iconBadge, isDropped && styles.iconBadgeActive]}>
                <Bookmark size={18} color={isDropped ? '#fbbf24' : '#f1f5f9'} />
              </View>
              <View style={styles.menuItemTextWrap}>
                <Text style={styles.menuItemText}>
                  {isDropped ? t('removeFromDropped') : t('addToDropped')}
                </Text>
                <Text style={styles.menuItemSubtext}>
                  {isDropped
                    ? t('undropWatchingSubtext', 'Bu dizi tekrar aktif takibe döner.')
                    : t('dropWatchingSubtext', 'Bu dizi Bırakılanlar listesine taşınır.')}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} activeOpacity={0.7} onPress={() => setOpen(false)}>
              <Text style={styles.cancelText}>{t('cancel')}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
});

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
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#141b2e',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 10,
    paddingBottom: 28,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderBottomWidth: 0,
  },
  sheetHeader: {
    marginBottom: 6,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: 14,
  },
  sheetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  sheetTitle: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginRight: 12,
  },
  closeButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderRadius: 14,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  iconBadgeActive: {
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  menuItemTextWrap: { flex: 1 },
  menuItemText: { color: '#f1f5f9', fontSize: 15, fontWeight: '700' },
  menuItemSubtext: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  cancelButton: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  cancelText: { color: '#cbd5e1', fontSize: 14, fontWeight: '600' },
});
