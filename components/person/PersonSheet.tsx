import { nativeColor } from '../../constants/mobilePalette';
import React, { useEffect } from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, Pressable, ActivityIndicator, Platform, StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { X, User } from '../icons';
import { usePersonDetail } from '../../hooks/usePersonDetail';
import { getPersonProfileLarge } from '../../services/tmdbPerson';
import { useDetailLayout } from '../../hooks/useDetailLayout';

interface PersonSheetProps {
  /** TMDB kişi kimliği; null = kapalı. */
  personId: number | null;
  /** Kartta zaten görünen ad — veri gelene kadar başlıkta durur. */
  initialName?: string;
  onClose: () => void;
}

/**
 * 2.6.5 madde 9 · Oyuncu bilgisi — uygulama İÇİNDE pencere. Kullanıcı: «uygulama
 * dışına çıkmasın… kapama ve geri tuşu da olsun». Mobil: ortalı pencere
 * (X, Android geri tuşu, dışarı dokunma kapatır). Masaüstü web: sağdan yan panel.
 * TMDB atfı (kullanım koşulu) pencerenin altında her zaman görünür.
 */
export default function PersonSheet({ personId, initialName, onClose }: PersonSheetProps) {
  const { t } = useTranslation('media');
  const insets = useSafeAreaInsets();
  const { height: viewportHeight } = useWindowDimensions();
  const { isDesktopWeb } = useDetailLayout();
  const { person, isLoading, hasError, retry } = usePersonDetail(personId);

  // Web'de Escape ile kapatma (LibraryFilterModal ile aynı) — RN-web Modal yapmıyor.
  useEffect(() => {
    if (Platform.OS !== 'web' || !personId) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [personId, onClose]);

  // ConfirmModal ile aynı ders: görünmezken hiç render etme.
  if (!personId) return null;

  const foto = getPersonProfileLarge(person?.profilePath ?? null);
  const ad = person?.name || initialName || '';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, isDesktopWeb ? styles.overlayDesktop : styles.overlayMobile]}>
        <Pressable style={styles.backdropTouch} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('close')} />
        <View style={[isDesktopWeb ? styles.panel : styles.sheet, { paddingBottom: isDesktopWeb ? Math.max(insets.bottom, 12) : 12 }]}>
          <View style={styles.header}>
            <Text style={styles.headerTitle} numberOfLines={1}>{ad}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel={t('close')} hitSlop={10}>
              <X size={22} color={nativeColor('text', "#e5e7eb")} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={[styles.body, isDesktopWeb ? styles.bodyDesktop : { maxHeight: viewportHeight * 0.64 }]}
            contentContainerStyle={styles.bodyContent}
            nestedScrollEnabled
            showsVerticalScrollIndicator
          >
            <View style={styles.photoWrap}>
              {foto ? (
                <Image source={{ uri: foto }} style={styles.photo} contentFit="cover" cachePolicy="disk" transition={150} />
              ) : (
                <View style={styles.photoEmpty}><User size={48} color={nativeColor('mutedDeep', "#475569")} /></View>
              )}
            </View>

            <Text style={styles.sectionTitle}>{t('personBioTitle')}</Text>
            {isLoading ? (
              <ActivityIndicator color={nativeColor('steel', "#3b82f6")} style={styles.loader} />
            ) : hasError ? (
              <View>
                <Text style={styles.muted}>{t('personLoadError')}</Text>
                <TouchableOpacity onPress={retry} style={styles.retryBtn}>
                  <Text style={styles.retryText}>{t('personRetry')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={person?.biography ? styles.bio : styles.muted}>
                {person?.biography || t('personBioEmpty')}
              </Text>
            )}
          </ScrollView>

          <Text style={styles.attribution}>{t('tmdbAttribution')}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  backdropTouch: { ...StyleSheet.absoluteFillObject },
  overlayMobile: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16 },
  overlayDesktop: { flexDirection: 'row', justifyContent: 'flex-end' },
  sheet: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '86%',
    backgroundColor: nativeColor('surface', '#0f172a'),
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  panel: {
    width: 420,
    maxWidth: '100%',
    height: '100%',
    backgroundColor: nativeColor('surface', '#0f172a'),
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.08)',
  },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10 },
  headerTitle: { flex: 1, color: nativeColor('text', '#ffffff'), fontSize: 20, fontWeight: 'bold' },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  body: { flexGrow: 0, flexShrink: 1 },
  bodyDesktop: { flex: 1 },
  bodyContent: { paddingHorizontal: 20, paddingBottom: 16 },
  photoWrap: { alignSelf: 'center', width: 180, height: 270, borderRadius: 12, overflow: 'hidden', backgroundColor: nativeColor('surface', '#172033'), marginVertical: 8 },
  photo: { width: '100%', height: '100%' },
  photoEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { color: nativeColor('text', '#ffffff'), fontSize: 16, fontWeight: 'bold', marginTop: 16, marginBottom: 8 },
  bio: { color: nativeColor('body', '#cbd5e1'), fontSize: 14, lineHeight: 21 },
  muted: { color: nativeColor('muted', '#94a3b8'), fontSize: 14 },
  loader: { marginVertical: 16 },
  retryBtn: { alignSelf: 'flex-start', marginTop: 10, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: nativeColor('raised', '#1e293b') },
  retryText: { color: nativeColor('text', '#e5e7eb'), fontWeight: '600' },
  attribution: { color: nativeColor('mutedDeep', '#64748b'), fontSize: 11, paddingHorizontal: 20, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.08)' },
});
