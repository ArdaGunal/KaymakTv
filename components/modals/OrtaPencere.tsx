import { nativeColor } from '../../constants/mobilePalette';
import React, { useEffect } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

interface OrtaPencereProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Kartın en geniş hâli (px). Varsayılan 400 — telefonda kenarlardan 16 px boşluk kalır. */
  maxWidth?: number;
  /** Kartın iç boşluğu gibi küçük farklar için. */
  cardStyle?: StyleProp<ViewStyle>;
}

/**
 * Ekranın ORTASINDA açılan seçim/eylem penceresinin ortak kabuğu (2.6.8 MENU-01).
 *
 * Kullanıcı kararı (2026-11-06): *«genel olarak bu tarz menüler ekran ortasında
 * olsun»*. Eskiden bölüm/dizi/sezon menüleri, filtre ve dil seçimi her biri kendi
 * alttan-açılan (bottom sheet) düzenini kopyalıyordu. Kabuk tek yerde: kararmış
 * arka plan, ortada kart, dışarı dokunma + Android geri tuşu + web'de Escape kapatır.
 *
 * 🔴 Uzun içerik ve klavye taşıyan sayfalar (yorumlar, inceleme/gönderi yazma, ad
 * düzenleme, kişi kartı) BİLİNÇLİ olarak altta kalır — bu kabuk onlar için değil.
 */
export default function OrtaPencere({ visible, onClose, children, maxWidth = 400, cardStyle }: OrtaPencereProps) {
  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;
    const tus = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', tus);
    return () => window.removeEventListener('keydown', tus);
  }, [visible, onClose]);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.card, { maxWidth }, cardStyle]}>{children}</View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
  },
  card: {
    width: '100%',
    maxHeight: '85%',
    backgroundColor: nativeColor('surface', '#111827'),
    borderRadius: 20,
    borderWidth: 1,
    borderColor: nativeColor('raised', '#1F2937'),
    padding: 20,
  },
});
