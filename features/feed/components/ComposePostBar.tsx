import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Avatar from '../../../components/Avatar';
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

  return (
    <TouchableOpacity style={styles.wrap} onPress={onPress} activeOpacity={0.75}>
      <Avatar url={profile?.images?.avatar?.full} ad={profile?.username} size={36} />
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
  placeholder: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '500',
  },
});
