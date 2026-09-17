import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAppBack } from '../../../../hooks/useAppBack';
import { ChevronLeft } from '../../../../components/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import NetworkUserCard from '../../../../features/publicProfile/components/NetworkUserCard';
import UserSearchButton from '../../../../features/feed/components/UserSearchButton';
import { useNetworkList } from '../../../../hooks/useNetworkList';
import { fetchKaymakProfile } from '../../../../services/api/kaymakSocial';
import type { NetworkUser } from '../../../../hooks/useNetworkList';

export default function NetworkScreen() {
  const { slug: rawSlug, type: rawType } = useLocalSearchParams();
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug ?? null;
  const initialType = (Array.isArray(rawType) ? rawType[0] : rawType) as 'followers' | 'following' || 'followers';
  
  const handleBack = useAppBack();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation(['feed', 'media']);

  const [activeTab, setActiveTab] = useState<'followers' | 'following'>(initialType);

  // 🪪 Rota parametresi ARTIK USERNAME ("EVRENSEL KAYMAK KİMLİĞİ"). Graf ucu
  // ise `users.id` istiyor — çeviri burada, BİR KEZ yapılıyor.
  // ⚠️ `me` özel değeri: kendi ağım. O durumda çeviriye gerek yok, hedef
  // `null` bırakılır ve `useNetworkList` kendi grafımı çeker.
  const [hedefUserId, setHedefUserId] = useState<string | null>(null);
  const [kimlikCozuluyor, setKimlikCozuluyor] = useState(slug !== 'me' && !!slug);

  useEffect(() => {
    if (!slug || slug === 'me') {
      setHedefUserId(null);
      setKimlikCozuluyor(false);
      return;
    }
    let cancelled = false;
    setKimlikCozuluyor(true);
    fetchKaymakProfile(slug)
      .then((p) => { if (!cancelled) setHedefUserId(p.profile.userId); })
      // 🔴 Sessiz kalmıyor: kimlik çözülemezse liste boş görünür ve sebebi
      // hiçbir yerde yazmazdı.
      .catch((e) => { if (!cancelled) console.warn('[network] Kimlik çözülemedi:', e); })
      .finally(() => { if (!cancelled) setKimlikCozuluyor(false); });
    return () => { cancelled = true; };
  }, [slug]);

  const { data, isLoading, hata, gizli } = useNetworkList(hedefUserId, activeTab);

  // Not: connectionState burada store'dan OKUNMUYOR — bu ekran zaten
  // `isStoreLoading` bitene kadar (yani followStore.fetchFollowingSlugs
  // tamamlanana kadar) FlatList'i hiç render etmiyor, NetworkUserCard kendi
  // güncel durumunu içeride bir Zustand seçicisiyle doğrudan okuyor (bkz.
  // hooks/useFollowState.ts). Burada `connectionStates`'in TAMAMINA abone
  // olmak, listedeki HERHANGİ bir kullanıcının takip durumu değiştiğinde bu
  // ekranın (ve dolayısıyla FlatList'in) gereksiz yere yeniden render
  // olmasına yol açardı — kalabalık takipçi listelerinde performans sorunu.
  const renderItem = ({ item }: { item: NetworkUser }) => <NetworkUserCard user={item} />;

  return (
    <LinearGradient colors={['#0F172A', '#0B1120']} style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top || 20 }]}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.iconBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft color="#fff" size={26} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {slug === 'me' ? t('media:network', 'Ağım') : `@${slug}`}
        </Text>
        {/* 🔎 Kişi arama — YALNIZCA kendi ağımda (2026-09-17, kullanıcı: *"aynı sembol
            profilimde ağım tarafında da olsun"*). Akıştaki simgeyle AYNI bileşen.
            Başkasının ağında boş kutu kalıyor ki başlık ortada dursun. */}
        {slug === 'me' ? (
          <UserSearchButton style={styles.aramaBtn} iconColor="#fff" iconSize={20} />
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <View style={styles.contentWrapper}>
        <View style={styles.tabsContainer}>
          <TouchableOpacity style={[styles.tab, activeTab === 'followers' && styles.activeTab]} onPress={() => setActiveTab('followers')}>
            <Text style={[styles.tabText, activeTab === 'followers' && styles.activeTabText]}>{t('media:profileFollowers', 'Takipçiler')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, activeTab === 'following' && styles.activeTab]} onPress={() => setActiveTab('following')}>
            <Text style={[styles.tabText, activeTab === 'following' && styles.activeTabText]}>{t('media:profileFollowing', 'Takip Edilenler')}</Text>
          </TouchableOpacity>
        </View>

        {isLoading || kimlikCozuluyor ? (
          <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={data}
            keyExtractor={(item) => item.userId}
            renderItem={renderItem}
            contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 40 }]}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  {hata
                    ? t('feed:networkError', 'Liste yüklenemedi, tekrar dene.')
                    : gizli
                      ? t('feed:privateNetwork', 'Bu hesabın ağı gizli.')
                      : t('feed:noUsersFound', 'Bu listede kimse yok.')}
                </Text>
              </View>
            }
          />
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentWrapper: {
    flex: 1,
    width: '100%',
    maxWidth: 720,
    marginHorizontal: 'auto',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  iconBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginHorizontal: 12,
  },
  headerSpacer: {
    width: 40,
  },
  // Geri düğmesiyle (`iconBtn`) aynı görünüm — başlık iki yandan dengeli dursun.
  aramaBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 0,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#22304A',
    marginBottom: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#3b82f6',
  },
  tabText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#f8fafc',
  },
  listContent: {
    paddingTop: 10,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 40,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 14,
    textAlign: 'center',
  },
});
