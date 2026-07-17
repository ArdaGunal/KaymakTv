import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Modal, TouchableWithoutFeedback } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../context/AuthContext';
import { useRouter } from 'expo-router';
import { LogOut, ChevronLeft, Globe, ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

export default function UserSettingsScreen() {
  const { removeKeys } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation(['settings', 'common']);
  const [isLangMenuVisible, setIsLangMenuVisible] = useState(false);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  const handleLogout = async () => {
    await removeKeys();
    router.replace('/(protected)/(tabs)/explore');
  };

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('common:settings') || 'Ayarlar'}</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.container}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('language')}</Text>
          <TouchableOpacity style={styles.settingItem} onPress={() => setIsLangMenuVisible(true)}>
            <Globe size={20} color="#94a3b8" style={styles.settingIcon} />
            <Text style={styles.settingText}>{t('language')}</Text>
            <View style={styles.settingValueContainer}>
              <Text style={styles.settingValueText}>{i18n.language.toUpperCase()}</Text>
              <ChevronRight size={16} color="#525252" />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('traktAccount')}</Text>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <LogOut size={20} color="#ef4444" style={styles.logoutIcon} />
            <Text style={styles.logoutText}>{t('logoutReset')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Language Selection Modal */}
      <Modal
        visible={isLangMenuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsLangMenuVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsLangMenuVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.langMenu}>
                <Text style={styles.langMenuTitle}>{t('language')}</Text>
                
                <TouchableOpacity 
                  style={[styles.langMenuItem, i18n.language === 'tr' && styles.langMenuItemActive]}
                  onPress={() => { changeLanguage('tr'); setIsLangMenuVisible(false); }}
                >
                  <Text style={[styles.langMenuItemText, i18n.language === 'tr' && styles.langMenuItemTextActive]}>{t('turkish')}</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.langMenuItem, i18n.language === 'en' && styles.langMenuItemActive]}
                  onPress={() => { changeLanguage('en'); setIsLangMenuVisible(false); }}
                >
                  <Text style={[styles.langMenuItemText, i18n.language === 'en' && styles.langMenuItemTextActive]}>{t('english')}</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f1f',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  container: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginTop: 8,
    backgroundColor: '#171717',
    borderRadius: 12,
    overflow: 'hidden',
  },
  sectionTitle: {
    color: '#a3a3a3',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#1f1f1f',
  },
  logoutIcon: {
    marginRight: 12,
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '500',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#1f1f1f',
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
  },
  settingIcon: {
    marginRight: 12,
  },
  settingText: {
    color: '#e5e5e5',
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  settingValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingValueText: {
    color: '#a3a3a3',
    fontSize: 14,
    marginRight: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  langMenu: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    width: 250,
    borderWidth: 1,
    borderColor: '#334155',
  },
  langMenuTitle: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 12,
    fontWeight: '600',
  },
  langMenuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  langMenuItemActive: {
    backgroundColor: '#3b82f6',
  },
  langMenuItemText: {
    color: '#cbd5e1',
    fontSize: 16,
  },
  langMenuItemTextActive: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
});
