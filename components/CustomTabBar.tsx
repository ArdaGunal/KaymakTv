/**
 * CustomTabBar — Reanimated v3 Yumuşak Geçişli Alt Navigasyon
 *
 * Animasyon Mimarisi:
 * - useSharedValue + useEffect → withSpring   (doğru Reanimated paterni)
 * - useDerivedValue KULLANILMIYOR (koşullu çağrı riski)
 * - maxWidth yerine scaleX + opacity kombinasyonu (layout jump yok)
 * - İkon rengi de animated (interpolateColor)
 * - Web: Reanimated tamamen devre dışı, sıfır ek yük
 */

import React, { memo, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Tv, Film, Rss, Compass, User } from 'lucide-react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  interpolateColor,
} from 'react-native-reanimated';

// Tab ikonu eşleştirmeleri
const TAB_ICONS: Record<string, React.ComponentType<any>> = {
  shows: Tv,
  movies: Film,
  feed: Rss,
  explore: Compass,
  profile: User,
};

// Pastel Turkuaz Accent Renkleri
const ACCENT_COLOR = '#22d3ee';
const ACCENT_BG = 'rgba(34, 211, 238, 0.14)';
const ACCENT_BORDER = 'rgba(34, 211, 238, 0.28)';
const INACTIVE_COLOR = '#64748b';

// Spring konfigürasyonu: hafif yay — hissedilir ama kullanıcıyı bekletmez
const SPRING_CFG = {
  damping: 22,    // Söndürme: düşük = daha "titrekçe", yüksek = daha "ağır"
  stiffness: 260, // Sertlik: yüksek = daha hızlı, düşük = daha yavaş
  mass: 0.7,      // Kütle: düşük = hafif ve narin his
  overshootClamping: false, // Hafif "bounce" izin ver ama abartma
};

interface TabItemProps {
  isFocused: boolean;
  label: string;
  IconComponent: React.ComponentType<any>;
  onPress: () => void;
  onLongPress: () => void;
  accessibilityLabel?: string;
  testID?: string;
}

// ─── Web: Reanimated olmadan anlık geçiş (sıfır ek yük) ─────────────────────
const TabItemWeb = memo(function TabItemWeb({
  isFocused,
  label,
  IconComponent,
  onPress,
  onLongPress,
  accessibilityLabel,
  testID,
}: TabItemProps) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
      style={isFocused ? styles.activeTabPillWeb : styles.inactiveTabButtonWeb}
    >
      <IconComponent
        size={isFocused ? 20 : 22}
        color={isFocused ? ACCENT_COLOR : INACTIVE_COLOR}
        strokeWidth={isFocused ? 2.3 : 1.8}
      />
      {isFocused && (
        <Text style={styles.activeLabel} numberOfLines={1}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
});

// ─── Native (iOS/Android): UI Thread üzerinde Reanimated v3 animasyonu ───────
const TabItemNative = memo(function TabItemNative({
  isFocused,
  label,
  IconComponent,
  onPress,
  onLongPress,
  accessibilityLabel,
  testID,
}: TabItemProps) {
  // 0 = inaktif, 1 = aktif — useSharedValue → doğru Reanimated v3 paterni
  const progress = useSharedValue(isFocused ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(isFocused ? 1 : 0, SPRING_CFG);
  }, [isFocused]);

  // ── Kapsül (Pill) Konteyneri ─────────────────────────────────────────────
  const pillStyle = useAnimatedStyle(() => {
    // Arka plan ve kenarlık rengi düzgün interpolate edilir
    const backgroundColor = interpolateColor(
      progress.value,
      [0, 1],
      ['rgba(34,211,238,0)', ACCENT_BG]
    );
    const borderColor = interpolateColor(
      progress.value,
      [0, 1],
      ['rgba(34,211,238,0)', ACCENT_BORDER]
    );
    // Yatay dolgu: ikondan kapsüle yumuşak genişleme
    const paddingHorizontal = interpolate(progress.value, [0, 1], [10, 16]);

    return { backgroundColor, borderColor, paddingHorizontal };
  });

  // ── İkon Rengi (Animated) ────────────────────────────────────────────────
  // Lucide doğrudan animasyonu desteklemiyor — ikon üzerine renkli bir "tint
  // katmanı" değil, ikinya prop ile JS tarafında değişim. Renk geçişini
  // ekstra bir sarıcı `opacity` animasyonu ile simüle ediyoruz (iki ikon).
  const activeIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.5, 1], [0, 0, 1]),
    position: 'absolute',
  }));

  const inactiveIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.5, 1], [1, 0, 0]),
  }));

  // ── Etiket (Label) ──────────────────────────────────────────────────────
  // scaleX + opacity kombinasyonu — maxWidth Layout recalculation yok
  const labelStyle = useAnimatedStyle(() => {
    // Fade-in gecikme: kapsül genişledikten sonra metin belirir
    const opacity = interpolate(progress.value, [0, 0.55, 1], [0, 0, 1]);
    // Sola doğru küçük ölçek: metin "içeriden açılır" hissi
    const scaleX = interpolate(progress.value, [0, 1], [0.7, 1]);
    // Genişlik: 0'dan serbest akışa (metin kendi genişliğine oturur)
    const maxWidth = interpolate(progress.value, [0, 1], [0, 80]);
    const marginLeft = interpolate(progress.value, [0, 1], [0, 7]);

    return { opacity, transform: [{ scaleX }], maxWidth, marginLeft };
  });

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.85}
    >
      <Animated.View style={[styles.tabItemBase, pillStyle]}>
        {/* İkon çapraz geçişi: inaktif (outline) ↔ aktif (renkli) */}
        <View style={styles.iconWrapper}>
          <Animated.View style={inactiveIconStyle}>
            <IconComponent size={22} color={INACTIVE_COLOR} strokeWidth={1.8} />
          </Animated.View>
          <Animated.View style={activeIconStyle}>
            <IconComponent size={20} color={ACCENT_COLOR} strokeWidth={2.3} />
          </Animated.View>
        </View>

        {/* Etiket: overflow:hidden → layout jump yok */}
        <Animated.View style={[styles.labelWrap, labelStyle]}>
          <Text style={styles.activeLabel} numberOfLines={1}>
            {label}
          </Text>
        </Animated.View>
      </Animated.View>
    </TouchableOpacity>
  );
});

// ─── Platform Seçici ─────────────────────────────────────────────────────────
const TabItem = (props: TabItemProps) =>
  Platform.OS === 'web' ? <TabItemWeb {...props} /> : <TabItemNative {...props} />;

// ─── Ana Bileşen ─────────────────────────────────────────────────────────────
function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('navigation');

  const paddingBottom = Math.max(insets.bottom, 10);

  return (
    <View style={[styles.outerWrapper, { paddingBottom }]}>
      <BlurView intensity={40} tint="dark" style={styles.blurContainer}>
        <View style={styles.tabBarContent}>
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const isFocused = state.index === index;

            const label =
              options.title !== undefined
                ? options.title
                : t(route.name, { defaultValue: route.name });

            const IconComponent = TAB_ICONS[route.name] || Tv;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            };

            const onLongPress = () => {
              navigation.emit({ type: 'tabLongPress', target: route.key });
            };

            return (
              <TabItem
                key={route.key}
                isFocused={isFocused}
                label={label}
                IconComponent={IconComponent}
                onPress={onPress}
                onLongPress={onLongPress}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                testID={options.tabBarButtonTestID}
              />
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

export default memo(CustomTabBar);

const styles = StyleSheet.create({
  outerWrapper: {
    backgroundColor: '#0B1120',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  blurContainer: {
    backgroundColor:
      Platform.OS === 'android' ? 'rgba(11, 17, 32, 0.95)' : 'rgba(11, 17, 32, 0.82)',
  },
  tabBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    paddingVertical: 10,
    minHeight: 58,
  },
  // Mobil animasyonlu kapsül zemini
  tabItemBase: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    minWidth: 44,
    borderRadius: 22,
    borderWidth: 1,
  },
  // İkon çakışma konumu için
  iconWrapper: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Etiket kırpma — layout jump önler
  labelWrap: {
    overflow: 'hidden',
  },
  // Aktif sekme — Web
  activeTabPillWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ACCENT_BG,
    borderColor: ACCENT_BORDER,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 22,
    maxWidth: 160,
  },
  // İnaktif sekme — Web
  inactiveTabButtonWeb: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  activeLabel: {
    color: ACCENT_COLOR,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
