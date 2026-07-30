/**
 * ActivityDeleteRow — FeedCard/MarathonFeedCard için paylaşılan silme sarmalayıcı
 *
 * Üç davranış modu (Platform.OS ve isSelectionMode'a göre):
 * - Seçim modu (isSelectionMode=true): sol tarafta bir onay kutusu, satıra
 *   dokununca seçim aç/kapa. Kaydırma/hover-sil bu modda TAMAMEN devre dışı.
 * - Web: kaydırma yerine (fareyle zor) kartın sağ üstünde her zaman görünen
 *   ince bir çöp kutusu ikonu.
 * - Mobil: react-native-native-gesture-handler KURULMADI (native rebuild
 *   gerektirmesin diye) — bunun yerine PanResponder + Animated ile "sola
 *   kaydırınca kırmızı çöp kutusu alanı açılır, üzerine dokununca silinir"
 *   davranışı elle inşa edildi.
 *
 * Onay penceresi (confirmAsync) BURADA tetiklenir — üst bileşenler yalnızca
 * "silme onaylandı, gerçekleştir" anlamına gelen `onDelete`'i alır.
 *
 * TODO: Şu an KULLANILMIYOR — DB mimarisi kararı (Tombstone vs Soft Delete vs
 * Delta Sync) netleşene kadar `components/profile/ProfileActivityTab.tsx`
 * içindeki `ACTIVITY_DELETE_ENABLED = false` bayrağı FeedCard/MarathonFeedCard'a
 * `onDelete` geçmiyor, bu yüzden bu bileşen hiç render edilmiyor. Kod silinmedi,
 * bayrak `true` olunca yeniden devreye girecek (bkz. docs/HISTORY.md).
 */

import React, { useRef, useState } from 'react';
import { Animated, PanResponder, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Trash2, Check } from 'lucide-react-native';
import { confirmAsync } from '../utils/confirmDialog';

interface ActivityDeleteRowProps {
  children: React.ReactNode;
  isSelectionMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onDelete: () => void;
}

const MAX_SWIPE = -84;
const OPEN_THRESHOLD = MAX_SWIPE / 2;

const CONFIRM_TITLE = 'Aktiviteyi Sil';
const CONFIRM_MESSAGE = 'Bu aktiviteyi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.';
const CONFIRM_LABEL = 'Sil';
const CANCEL_LABEL = 'İptal';

export default function ActivityDeleteRow({
  children,
  isSelectionMode,
  isSelected,
  onToggleSelect,
  onDelete,
}: ActivityDeleteRowProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const openOffset = useRef(0);
  const [isHovered, setIsHovered] = useState(false);

  const snapTo = (toValue: number) => {
    openOffset.current = toValue;
    Animated.spring(translateX, { toValue, useNativeDriver: true, bounciness: 0 }).start();
  };

  const requestDelete = async () => {
    const confirmed = await confirmAsync(CONFIRM_TITLE, CONFIRM_MESSAGE, CONFIRM_LABEL, CANCEL_LABEL);
    if (confirmed) {
      onDelete();
    } else {
      snapTo(0);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, gesture) =>
        Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
      onPanResponderMove: (_, gesture) => {
        const next = Math.min(0, Math.max(MAX_SWIPE, openOffset.current + gesture.dx));
        translateX.setValue(next);
      },
      onPanResponderRelease: (_, gesture) => {
        const current = openOffset.current + gesture.dx;
        snapTo(current < OPEN_THRESHOLD ? MAX_SWIPE : 0);
      },
      onPanResponderTerminate: () => {
        snapTo(openOffset.current < OPEN_THRESHOLD ? MAX_SWIPE : 0);
      },
    })
  ).current;

  if (isSelectionMode) {
    return (
      <TouchableOpacity style={styles.selectionRow} onPress={onToggleSelect} activeOpacity={0.7}>
        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
          {isSelected && <Check size={14} color="#0B1120" />}
        </View>
        <View style={styles.flex}>{children}</View>
      </TouchableOpacity>
    );
  }

  if (Platform.OS === 'web') {
    return (
      <View
        style={styles.webRow}
        // @ts-ignore - Web specific (bkz. components/web/WebCarousel.tsx'teki aynı desen)
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {children}
        {isHovered && (
          <TouchableOpacity style={styles.webDeleteBtn} onPress={requestDelete} hitSlop={8}>
            <Trash2 size={15} color="#f87171" />
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.swipeContainer}>
      <View style={styles.deleteBackdrop}>
        <TouchableOpacity style={styles.deleteBackdropBtn} onPress={requestDelete} hitSlop={12}>
          <Trash2 size={20} color="#fff" />
        </TouchableOpacity>
      </View>
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  selectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    flexShrink: 0,
  },
  checkboxSelected: {
    backgroundColor: '#38bdf8',
    borderColor: '#38bdf8',
  },
  webRow: {
    position: 'relative',
  },
  webDeleteBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(11, 17, 32, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeContainer: {
    position: 'relative',
  },
  deleteBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 12,
    width: Math.abs(MAX_SWIPE) + 16,
    backgroundColor: '#dc2626',
    borderRadius: 14,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 20,
  },
  deleteBackdropBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
