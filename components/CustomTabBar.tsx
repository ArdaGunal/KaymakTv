import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Tv, Film, Rss, Compass, User } from 'lucide-react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';

// Tab ikonu eşleştirmeleri
const TAB_ICONS: Record<string, React.ComponentType<any>> = {
  shows: Tv,
  movies: Film,
  feed: Rss,
  explore: Compass,
  profile: User,
};

// Pastel Turkuaz Accent Renkleri (Göz Yormayan Cyan Tonları)
const ACCENT_COLOR = '#22d3ee'; // Soft Cyan (cyan-400)
const ACCENT_BG = 'rgba(34, 211, 238, 0.14)'; // Saydam pastel turkuaz kapsül zemini
const ACCENT_BORDER = 'rgba(34, 211, 238, 0.28)'; // İnce kapsül kenarlığı
const INACTIVE_COLOR = '#64748b'; // Soluk gri/slate ikon rengi

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('navigation');

  // Güvenli alan alt boşluğu: iOS Home Indicator ve Android alt çubuğu için koruma
  const paddingBottom = Math.max(insets.bottom, 10);

  return (
    <View style={[styles.outerWrapper, { paddingBottom }]}>
      <BlurView intensity={40} tint="dark" style={styles.blurContainer}>
        <View style={styles.tabBarContent}>
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const isFocused = state.index === index;

            // Sekme etiketi: options.title veya i18n veya route.name
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
              navigation.emit({
                type: 'tabLongPress',
                target: route.key,
              });
            };

            return (
              <TouchableOpacity
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                testID={options.tabBarButtonTestID}
                onPress={onPress}
                onLongPress={onLongPress}
                activeOpacity={0.7}
                style={isFocused ? styles.activeTabPill : styles.inactiveTabButton}
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
    backgroundColor: Platform.OS === 'android' ? 'rgba(11, 17, 32, 0.95)' : 'rgba(11, 17, 32, 0.82)',
  },
  tabBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    paddingVertical: 10,
    minHeight: 58,
  },
  // Aktif Sekme: Yumuşak Pastel Turkuaz Kapsül (Pill)
  activeTabPill: {
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
  activeLabel: {
    color: ACCENT_COLOR,
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 7,
    letterSpacing: 0.2,
  },
  // İnaktif Sekme: Minimum 44x44px dokunma alanı, sadece ikon
  inactiveTabButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
});
