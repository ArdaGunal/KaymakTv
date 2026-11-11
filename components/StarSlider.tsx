import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Animated, PanResponder, Platform } from 'react-native';
import { Star } from './icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { formatRating } from '../utils/formatRating';
import { MOBILE_PALETTE, nativeColor } from '../constants/mobilePalette';

interface StarSliderProps {
  initialRating?: number | null; // 1 to 10
  onRate: (rating: number) => void;
  onRemove?: () => void;
}

const STAR_SIZE = 40;
const STAR_COLOR = '#facc15';
const STAR_EMPTY_COLOR = '#3f3f46';
const NATIVE_STAR_EMPTY = '#52616B';

const STAR_SHADOW = {
  textShadowColor: 'rgba(250, 204, 21, 0.5)',
  textShadowOffset: { width: 0, height: 0 },
  textShadowRadius: 8,
};

// Statik bir yıldız sırası: sürükleme sırasında YENİDEN RENDER OLMAZ.
// Dolgu efekti bunun üstüne bindirilen, genişliği Animated.Value ile
// sürülen ayrı bir katmandan gelir (bkz. FillLayer).
const StarsRow = React.memo(({ color, filled, glow = true }: { color: string; filled: boolean; glow?: boolean }) => (
  <View style={styles.starsRow} pointerEvents="none">
    {[1, 2, 3, 4, 5].map((i) => (
      <View key={i} style={styles.starWrapper}>
        <Star
          size={STAR_SIZE}
          color={color}
          fill={filled ? color : 'transparent'}
          style={filled && glow ? (STAR_SHADOW as any) : undefined}
        />
      </View>
    ))}
  </View>
));

export default function StarSlider({ initialRating, onRate, onRemove }: StarSliderProps) {
  const { t } = useTranslation(['common']);
  const native = Platform.OS !== 'web';
  const [rating, setRating] = useState<number>(initialRating || 5); // 0..10, kaydedilen ayrık değer
  const [containerWidth, setContainerWidth] = useState(0);
  const widthRef = useRef(0);
  // 0..1 arası sürekli değer — sürükleme sırasında dolgu genişliğini
  // React state'ine hiç dokunmadan (native prop güncellemesiyle) sürer.
  const fill = useRef(new Animated.Value((initialRating || 5) / 10)).current;
  const lastDiscreteRef = useRef(initialRating || 5);
  const isPanningRef = useRef(false);

  React.useEffect(() => {
    const nextRating = initialRating || 5;
    setRating(nextRating);
    lastDiscreteRef.current = nextRating;
    fill.setValue(nextRating / 10);
  }, [initialRating, fill]);

  const commitFromX = useCallback((x: number, snapToFullStar: boolean) => {
    const width = widthRef.current;
    if (width === 0) return;
    const clampedX = Math.max(0, Math.min(x, width));

    // Görsel dolgu: her zaman parmağı 1:1 takip eder, pürüzsüz.
    fill.setValue(clampedX / width);

    // Kaydedilecek ayrık değer (yarım yıldız hassasiyeti, 1-10 skala).
    const stepWidth = width / 10;
    let discrete = Math.ceil(clampedX / stepWidth);
    if (discrete < 1) discrete = 1;
    if (discrete > 10) discrete = 10;
    if (snapToFullStar) discrete = Math.ceil(discrete / 2) * 2;

    if (discrete !== lastDiscreteRef.current) {
      Haptics.selectionAsync();
      lastDiscreteRef.current = discrete;
      setRating(discrete);
    }
  }, [fill]);

  const settleFillToDiscrete = useCallback(() => {
    Animated.spring(fill, {
      toValue: lastDiscreteRef.current / 10,
      useNativeDriver: false,
      friction: 8,
      tension: 90,
    }).start();
  }, [fill]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          isPanningRef.current = false;
          commitFromX(evt.nativeEvent.locationX, false);
        },
        onPanResponderMove: (evt, gestureState) => {
          if (Math.abs(gestureState.dx) > 4 || Math.abs(gestureState.dy) > 4) {
            isPanningRef.current = true;
          }
          commitFromX(evt.nativeEvent.locationX, false);
        },
        onPanResponderRelease: (evt) => {
          // Sürüklemeden bırakma: yarım yıldız hassasiyetinde kalır.
          // Sade dokunma (sürüklenmedi): en yakın tam yıldıza yaslanır.
          commitFromX(evt.nativeEvent.locationX, !isPanningRef.current);
          settleFillToDiscrete();
        },
        onPanResponderTerminate: () => {
          settleFillToDiscrete();
        },
      }),
    [commitFromX, settleFillToDiscrete]
  );

  const sentimentText = useMemo(() => {
    if (rating <= 2) return t('sentimentWaste', 'Zaman Kaybı');
    if (rating <= 4) return t('sentimentBad', 'Pek İyi Değil');
    if (rating <= 6) return t('sentimentAverage', 'Ortalama');
    if (rating <= 8) return t('sentimentGood', 'Gerçekten İyi');
    return t('sentimentMasterpiece', 'Başyapıt!');
  }, [rating, t]);

  const fillWidth = fill.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      <Text style={[styles.ratingText, native && styles.nativeRatingText]}>{formatRating(rating)} / 5</Text>
      <Text style={[styles.sentimentText, native && styles.nativeSentimentText]}>{sentimentText}</Text>

      <View
        style={[
          styles.starsSlot,
          Platform.OS === 'web' && ({ touchAction: 'none', userSelect: 'none' } as any),
        ]}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          widthRef.current = w;
          setContainerWidth(w);
        }}
        {...panResponder.panHandlers}
      >
        <StarsRow color={native ? NATIVE_STAR_EMPTY : STAR_EMPTY_COLOR} filled={false} />
        <Animated.View style={[styles.fillClip, { width: fillWidth }]}>
          {/* Sabit piksel genişlik (konteynerin tam genişliği) — dıştaki
              Animated genişlik küçüldükçe bu satırı SIKIŞTIRMAZ, sadece
              maskeler. Böylece yıldızlar orantısız küçülmeden düzgün açığa çıkar. */}
          <View style={[styles.fillInner, { width: containerWidth }]}>
            <StarsRow color={native ? MOBILE_PALETTE.rating : STAR_COLOR} filled glow={!native} />
          </View>
        </Animated.View>
      </View>

      <TouchableOpacity style={[styles.saveButton, native && styles.nativeSaveButton]} activeOpacity={0.85} onPress={() => onRate(rating)}>
        <Text style={styles.saveButtonText}>{t('saveRating', 'Puanı Kaydet')}</Text>
      </TouchableOpacity>

      {initialRating && onRemove ? (
        <TouchableOpacity style={styles.removeButton} onPress={onRemove}>
          <Text style={[styles.removeButtonText, native && styles.nativeRemoveButtonText]}>{t('removeRating', 'Puanı Kaldır')}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
  },
  ratingText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: nativeColor('text', '#ffffff'),
    marginBottom: 4,
  },
  nativeRatingText: { color: MOBILE_PALETTE.text },
  sentimentText: {
    fontSize: 14,
    color: '#d4d4d4',
    fontWeight: '500',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  nativeSentimentText: { color: MOBILE_PALETTE.muted },
  starsSlot: {
    position: 'relative',
    width: '100%',
    paddingVertical: 10,
    marginBottom: 20,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    width: '100%',
  },
  starWrapper: {
    alignItems: 'center',
  },
  fillClip: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    overflow: 'hidden',
  },
  fillInner: {
    flexDirection: 'row',
  },
  saveButton: {
    backgroundColor: nativeColor('primary', '#3b82f6'),
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    ...(Platform.OS === 'web' && ({ cursor: 'pointer' } as any)),
  },
  nativeSaveButton: { backgroundColor: MOBILE_PALETTE.primary, borderWidth: 1, borderColor: MOBILE_PALETTE.border },
  saveButtonText: {
    color: nativeColor('text', '#ffffff'),
    fontSize: 15,
    fontWeight: 'bold',
  },
  removeButton: {
    paddingVertical: 12,
  },
  removeButtonText: {
    color: '#ef4444',
    fontSize: 14,
  },
  nativeRemoveButtonText: { color: '#B98988' },
});
