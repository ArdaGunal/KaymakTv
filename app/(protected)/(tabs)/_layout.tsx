import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useWindowDimensions, View } from 'react-native';
import Sidebar from '../../../components/Sidebar';
import CustomTabBar from '../../../components/CustomTabBar';
import { useNotificationStore } from '../../../store/notificationStore';

export default function TabsLayout() {
  const { t } = useTranslation('navigation');
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const { unreadCount } = useNotificationStore();
  
  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      {!isMobile && <Sidebar />}
      <View style={{ flex: 1 }}>
        <Tabs
          tabBar={isMobile ? (props) => <CustomTabBar {...props} /> : () => null}
          screenOptions={{
            headerShown: false,
            tabBarStyle: isMobile ? undefined : { display: 'none' },
          }}>
          <Tabs.Screen
            name="shows"
            options={{
              title: t('shows'),
            }}
          />
          <Tabs.Screen
            name="movies"
            options={{
              title: t('movies'),
            }}
          />
          <Tabs.Screen
            name="feed"
            options={{
              title: t('feed'),
            }}
          />
          <Tabs.Screen
            name="explore"
            options={{
              title: t('explore'),
            }}
          />
          <Tabs.Screen
            name="profile"
            options={{
              title: t('profile'),
              tabBarBadge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : undefined,
              tabBarBadgeStyle: { backgroundColor: '#ef4444', color: 'white', fontSize: 10, fontWeight: 'bold' }
            }}
          />
        </Tabs>
      </View>
    </View>
  );
}
