import React from 'react';
import { Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Play } from '../icons';
import { MOBILE_PALETTE } from '../../constants/mobilePalette';

interface MediaTrailerProps {
  trailerId?: string | null;
  /** Dizi içerik alanı zaten 16 px yatay dolgu taşıyor. */
  noPadding?: boolean;
}

/** Dar ekran fragmanı; native'de bölümlerin sonunda, dar web'de mevcut konumunda. */
export default function MediaTrailer({ trailerId, noPadding = false }: MediaTrailerProps) {
  const { t } = useTranslation('media');
  if (!trailerId || trailerId === 'null') return null;

  const native = Platform.OS !== 'web';
  return (
    <View style={[styles.section, noPadding && styles.noPadding]}>
      <Text style={[styles.title, native && styles.nativeTitle]}>{t('trailer')}</Text>
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={t('trailer')}
        onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${trailerId}`)}
      >
        <Image
          source={{ uri: `https://img.youtube.com/vi/${trailerId}/hqdefault.jpg` }}
          style={styles.image}
          contentFit="cover"
          transition={200}
        />
        <View style={styles.overlay}>
          <Play color="#fff" size={40} fill="#fff" />
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 16, marginBottom: 16 },
  noPadding: { paddingHorizontal: 0 },
  title: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  nativeTitle: { color: MOBILE_PALETTE.text },
  card: { height: 180, width: '100%', borderRadius: 12, overflow: 'hidden', position: 'relative' },
  image: { width: '100%', height: '100%' },
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center',
  },
});
