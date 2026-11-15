import { nativeColor } from '../../constants/mobilePalette';
import React from 'react';
import { StyleProp, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Check, Share2 } from '../icons';
import { useProfilPaylas } from '../../hooks/useProfilEylemleri';

/**
 * Profil paylaş düğmesi — 1.0.1 Dal 2 (kullanıcı kararı, 2026-11-15): kullanıcı adının
 * altındaki küçük simge yerine «Profili Düzenle» / «Takip Et» düğmesinin HEMEN SAĞINDA,
 * aynı yükseklikte kare simge düğme. Numara yoksa çizilmez (bağlantı numaraya dayanır).
 * Web'de paylaşım sayfası yoksa bağlantı panoya kopyalanır ve simge kısa süre ✓ olur.
 */
export default function ProfilPaylasDugmesi({ kaymakNo, boyut = 34, style }: {
  kaymakNo: number | null | undefined;
  /** Yanındaki eylem düğmesinin yüksekliği (mobil 34, masaüstü 36). */
  boyut?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useTranslation('common');
  const { link, paylas, linkKopyalandi } = useProfilPaylas(kaymakNo);
  if (!link) return null;
  return (
    <TouchableOpacity
      onPress={paylas}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={linkKopyalandi ? t('profilLinkKopyalandi') : t('profilPaylas')}
      style={[styles.dugme, { width: boyut, height: boyut }, style]}
    >
      {linkKopyalandi
        ? <Check size={16} color="#4ade80" />
        : <Share2 size={16} color={nativeColor('text', '#f1f5f9')} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // «Profili Düzenle» düğmesiyle aynı yüzey: yarı saydam zemin + ince kenar.
  dugme: {
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
