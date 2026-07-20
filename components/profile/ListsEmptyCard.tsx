import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { List as ListIcon, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

interface ListsEmptyCardProps {
  onPress: () => void;
}

// Profildeki "Listelerim" bölümünün boş durumu: kalabalık yapmayan, tek satırlık
// bilgilendirici kart. Kullanıcıya liste özelliğinin var olduğunu ve nasıl
// oluşturulacağını anlatır. Profilin gece-lacivert dil'iyle uyumlu.
export default function ListsEmptyCard({ onPress }: ListsEmptyCardProps) {
  const { t } = useTranslation('media');

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={onPress}>
      <View style={styles.iconChip}>
        <ListIcon size={22} color="#60a5fa" />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>{t('listsEmptyTitle', 'Henüz listen yok')}</Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {t('listsEmptySub', 'Dizi veya film sayfasındaki liste butonuyla ilk koleksiyonunu oluştur.')}
        </Text>
      </View>
      <View style={styles.plusChip}>
        <Plus size={18} color="#93c5fd" />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.18)',
    ...(Platform.OS === 'web' && ({ cursor: 'pointer' } as any)),
  },
  iconChip: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    color: '#f1f5f9',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 12.5,
    lineHeight: 17,
  },
  plusChip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
});
