import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMyTraktProfile } from '../../../hooks/useMyTraktProfile';

interface ComposePostBarProps {
  onPress: () => void;
}

/**
 * Akışın en üstündeki "Ne düşünüyorsun?" kutusu — bağımsız gönderi
 * ("Fikir Paylaş") özelliğinin TEK giriş noktası. Kullanıcının kararı: sağ
 * altta yüzen bir buton (FAB) yerine bu — "teknik bir parça" gibi görünüp
 * görmezden gelinmesin, akışın doğal bir parçası olsun diye Twitter/
 * Facebook tarzı sabit bir kutu.
 *
 * Kendisi bir TextInput DEĞİL — dokununca tam compose modalı açılır
 * (ComposePostModal.tsx). Böylece klavye/karakter sayacı gibi state akış
 * ekranına hiç sızmaz.
 */
export default function ComposePostBar({ onPress }: ComposePostBarProps) {
  const { t } = useTranslation('feed');
  const { profile } = useMyTraktProfile();
  const avatarUrl = profile?.images?.avatar?.full;
  const initial = profile?.username?.charAt(0).toUpperCase() ?? '?';

  return (
    <TouchableOpacity style={styles.wrap} onPress={onPress} activeOpacity={0.75}>
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
      ) : (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
      )}
      <Text style={styles.placeholder}>{t('composePlaceholder', 'Ne düşünüyorsun?')}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#172033',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#22304A',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    flexShrink: 0,
  },
  avatarText: {
    color: '#94a3b8',
    fontWeight: '700',
    fontSize: 14,
  },
  placeholder: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '500',
  },
});
