import React, { useRef, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Pressable,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { List as ListIcon } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import type { EnrichedList } from '../../hooks/useProfileLists';
import { POSTER_CARD_WIDTH, POSTER_CARD_HEIGHT, CARD_GAP } from './profileMetrics';

interface ListCardProps {
  data: EnrichedList;
}

/**
 * "Listelerim" şeridinin kartı.
 *
 * Boyut artık sabit 160×220 DEĞİL, diğer şeritlerdeki poster kartlarıyla
 * birebir aynı (`profileMetrics`) — eskiden liste kartları belirgin şekilde
 * daha iriydi ve profil ekranı dengesiz görünüyordu.
 *
 * Başlık poster ÜZERİNE değil ALTINA yazılıyor: küçülen kartta iki satırlık bir
 * bindirme kapak görselinin neredeyse tamamını örtüyordu. (İskelet bileşeni
 * `ListCardSkeleton` zaten bu düzene göre yazılmıştı; kart ondan sapmıştı.)
 */
const ListCard = memo(({ data }: ListCardProps) => {
  const router = useRouter();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const animateTo = (toValue: number) => {
    Animated.spring(scaleAnim, {
      toValue,
      useNativeDriver: true,
      friction: 6,
      tension: 200,
    }).start();
  };

  const handlePress = () => {
    router.push(`/list/${data.id}?name=${encodeURIComponent(data.title)}` as any);
  };

  return (
    <Pressable
      // @ts-ignore web hover
      onHoverIn={() => animateTo(1.05)}
      onHoverOut={() => animateTo(1)}
      onPressIn={() => animateTo(0.97)}
      onPressOut={() => animateTo(1)}
      onPress={handlePress}
      style={styles.pressable}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <View style={styles.card}>
          {data.coverImageUrl ? (
            <Image
              source={{ uri: data.coverImageUrl }}
              style={styles.poster}
              contentFit="cover"
              transition={300}
              cachePolicy="disk"
            />
          ) : (
            <View style={styles.posterFallback}>
              <ListIcon size={24} color="#475569" />
            </View>
          )}

          {data.itemCount > 0 && (
            <View style={styles.countChip}>
              <Text style={styles.countChipText}>{data.itemCount}</Text>
            </View>
          )}
        </View>

        {/* Sabit iki satırlık yükseklik: başlıklar 1 veya 2 satır olabildiği için
            aksi halde kartların alt kenarları tırtıklı hizalanıyordu. */}
        <Text style={styles.title} numberOfLines={2}>{data.title}</Text>
      </Animated.View>
    </Pressable>
  );
});

export default ListCard;

const styles = StyleSheet.create({
  pressable: {
    width: POSTER_CARD_WIDTH,
    marginRight: CARD_GAP,
  },
  card: {
    width: POSTER_CARD_WIDTH,
    height: POSTER_CARD_HEIGHT,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#172033',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  poster: {
    ...StyleSheet.absoluteFillObject,
  },
  posterFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Küçük kartta öğe sayısını posterin üstünde de göstermek, başlık alta
  // taşındığında kartın "sadece görsel" kalmasını engelliyor.
  countChip: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 20,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 7,
    backgroundColor: 'rgba(2,6,23,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  countChipText: {
    color: '#e2e8f0',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  title: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    height: 32, // 2 × lineHeight
    letterSpacing: -0.1,
    marginTop: 7,
  },
});
