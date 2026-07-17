import React, { useRef, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Pressable,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { List as ListIcon } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import type { EnrichedList } from '../../hooks/useProfileLists';

const CARD_WIDTH = 160;
const CARD_HEIGHT = 220;

interface ListCardProps {
  data: EnrichedList;
}

const ListCard = memo(({ data }: ListCardProps) => {
  const router = useRouter();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handleHoverIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 1.05,
      useNativeDriver: true,
      friction: 6,
      tension: 200,
    }).start();
  };

  const handleHoverOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
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
      onHoverIn={handleHoverIn}
      onHoverOut={handleHoverOut}
      onPressIn={handleHoverIn}
      onPressOut={handleHoverOut}
      onPress={handlePress}
      style={styles.pressable}
    >
      <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
        {/* Poster / Placeholder */}
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
            <ListIcon size={36} color="#334155" />
          </View>
        )}

        {/* Bottom gradient overlay */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.92)']}
          locations={[0.3, 0.6, 1]}
          style={styles.gradient}
        />

        {/* Title & count */}
        <View style={styles.meta}>
          <Text style={styles.title} numberOfLines={2}>
            {data.title}
          </Text>
          {data.itemCount > 0 && (
            <Text style={styles.count}>{data.itemCount} öğe</Text>
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
});

export default ListCard;

const styles = StyleSheet.create({
  pressable: {
    marginRight: 14,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
      boxShadow: '0 6px 24px rgba(0,0,0,0.5)',
    } as any),
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
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: CARD_HEIGHT * 0.65,
  },
  meta: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
  },
  title: {
    color: '#f1f5f9',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  count: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
  },
});
