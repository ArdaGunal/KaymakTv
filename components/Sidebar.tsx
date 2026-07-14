import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, usePathname, Link } from 'expo-router';
import { Tv, Film, Compass, User, Settings } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation('navigation');

  const menuItems = [
    { name: t('shows'), icon: Tv, path: '/' },
    { name: t('movies'), icon: Film, path: '/movies' },
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
          const isActive = pathname === item.path;
          return (
            <Link key={item.path} href={item.path as any} asChild>
              <TouchableOpacity
                style={StyleSheet.flatten([styles.menuItem, isActive && styles.menuItemActive])}
              >
                <item.icon size={24} color={isActive ? '#3B82F6' : '#94A3B8'} />
                <Text style={[styles.menuText, isActive && styles.menuTextActive]}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            </Link>
          );
        })}
      </View>

      <View style={styles.footerContainer}>
        <Link href="/settings" asChild>
          <TouchableOpacity style={styles.menuItem}>
            <Settings size={24} color="#94A3B8" />
            <Text style={styles.menuText}>{t('settings', { defaultValue: 'Ayarlar' })}</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 250,
    backgroundColor: '#0B1120',
    borderRightWidth: 1,
    borderRightColor: '#172033',
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
    color: '#ffffff',
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
  },
  menuItemActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  menuText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 16,
  },
  menuTextActive: {
    color: '#3B82F6',
  },
  footerContainer: {
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: '#172033',
    paddingTop: 16,
  },
});
