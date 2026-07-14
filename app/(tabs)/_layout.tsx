import { Tabs } from 'expo-router';
import { Tv, Compass, User, Film } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useWindowDimensions, View } from 'react-native';
import Sidebar from '../../components/Sidebar';

export default function TabsLayout() {
  const { t } = useTranslation('navigation');
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  
  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      {!isMobile && <Sidebar />}
      <View style={{ flex: 1 }}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarStyle: isMobile ? {
              backgroundColor: '#0B1120',
              borderTopWidth: 1,
              borderTopColor: '#172033',
              elevation: 0,
              shadowOpacity: 0,
            } : {
              display: 'none'
            },
            tabBarActiveTintColor: '#3B82F6',
            tabBarInactiveTintColor: '#475569',
            tabBarShowLabel: false,
          }}>
          <Tabs.Screen
            name="index"
            options={{
              title: t('shows'),
              tabBarIcon: ({ color }) => <Tv size={28} color={color} />,
            }}
          />
          <Tabs.Screen
            name="movies"
            options={{
              title: t('movies'),
              tabBarIcon: ({ color }) => <Film size={28} color={color} />,
            }}
          />
          <Tabs.Screen
            name="explore"
            options={{
              title: t('explore'),
              tabBarIcon: ({ color }) => <Compass size={28} color={color} />,
            }}
          />
          <Tabs.Screen
            name="profile"
            options={{
              title: t('profile'),
              tabBarIcon: ({ color }) => <User size={28} color={color} />,
            }}
          />
        </Tabs>
      </View>
    </View>
  );
}
