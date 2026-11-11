import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { usePathname, Link } from 'expo-router';
import { Tv, Film, Compass, User, Settings, Rss } from './icons';
import { useTranslation } from 'react-i18next';
import { MOBILE_PALETTE } from '../constants/mobilePalette';

export default function Sidebar() {
  const pathname = usePathname();
  const activePath = resolveSidebarPath(pathname);
  const { t } = useTranslation('navigation');

  const menuItems = [
    { name: t('shows'), icon: Tv, path: '/shows' },
    { name: t('movies'), icon: Film, path: '/movies' },
    { name: t('feed'), icon: Rss, path: '/feed' },
    { name: t('explore'), icon: Compass, path: '/explore' },
    { name: t('profile'), icon: User, path: '/profile' },
  ];

  return (
    <View style={styles.sidebar}>
      <View style={styles.logoContainer}>
        <Text style={styles.logoText}>KAYMAK</Text>
      </View>

      <View style={styles.menuContainer}>
        {menuItems.map((item) => {
          const isActive = activePath === item.path || activePath.startsWith(`${item.path}/`);
          return (
            <Link key={item.path} href={item.path as any} asChild>
              <TouchableOpacity
                style={StyleSheet.flatten([styles.menuItem, isActive && styles.menuItemActive])}
                accessibilityRole="link"
                accessibilityState={{ selected: isActive }}
              >
                <item.icon size={24} color={isActive ? MOBILE_PALETTE.steel : MOBILE_PALETTE.muted} />
                <Text style={[styles.menuText, isActive && styles.menuTextActive]}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            </Link>
          );
        })}
      </View>

      <View style={styles.footerContainer}>
        <Link href="/(protected)/account" asChild>
          <TouchableOpacity style={styles.menuItem}>
            <Settings size={24} color={MOBILE_PALETTE.muted} />
            <Text style={styles.menuText}>{t('settings', { defaultValue: 'Ayarlar' })}</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </View>
  );
}

/** Expo Router pathname'inden görünmeyen route gruplarını çıkarıp sekme yollarını eşler. */
function resolveSidebarPath(pathname: string): string {
  const pathOnly = pathname.split(/[?#]/, 1)[0] || '/';
  const segments = pathOnly
    .split('/')
    .filter(Boolean)
    .filter((segment) => !(segment.startsWith('(') && segment.endsWith(')')));
  const path = `/${segments.join('/')}`;

  if (path === '/show' || path.startsWith('/show/') || path === '/episode' || path.startsWith('/episode/')) {
    return '/shows';
  }
  if (path === '/movie' || path.startsWith('/movie/')) return '/movies';
  return path;
}

const styles = StyleSheet.create({
  sidebar: {
    width: 250,
    backgroundColor: MOBILE_PALETTE.background,
    borderRightWidth: 1,
    borderRightColor: MOBILE_PALETTE.border,
    height: '100%',
    paddingVertical: 24,
    display: 'flex',
    flexDirection: 'column',
  },
  logoContainer: {
    paddingHorizontal: 24,
    marginBottom: 40,
  },
  logoText: {
    color: MOBILE_PALETTE.text,
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  menuContainer: {
    flex: 1,
    paddingHorizontal: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  menuItemActive: {
    backgroundColor: MOBILE_PALETTE.navPill,
    borderColor: MOBILE_PALETTE.navBorder,
  },
  menuText: {
    color: MOBILE_PALETTE.muted,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 16,
  },
  menuTextActive: {
    color: MOBILE_PALETTE.steel,
    fontWeight: '700',
  },
  footerContainer: {
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: MOBILE_PALETTE.border,
    paddingTop: 16,
  },
});
