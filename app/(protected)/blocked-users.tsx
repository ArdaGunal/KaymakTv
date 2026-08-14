import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { UserX, Ban } from 'lucide-react-native';

import { SettingsHeader } from '../../components/settings/SettingsHeader';
import { useAuth } from '../../context/AuthContext';
import { getMyBlockedUsers, unblockUser, BlockedUser } from '../../features/feed/services/userBlocks';
import { invalidateFeedCache, invalidateVisibleUserIds } from '../../features/feed/services/feedApi';
import { confirmAsync } from '../../features/feed/utils/confirmDialog';

const DESKTOP_BREAKPOINT = 768;

interface BlockedUserRowProps {
  user: BlockedUser;
  isRemoving: boolean;
  onUnblock: () => void;
}

function BlockedUserRow({ user, isRemoving, onUnblock }: BlockedUserRowProps) {
  const { t } = useTranslation('feed');
  const initial = user.username.charAt(0).toUpperCase();

  return (
    <View style={styles.row}>
      {user.avatarUrl ? (
        <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
      ) : (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
      )}

      <Text style={styles.username} numberOfLines={1}>
        @{user.username}
      </Text>

      <TouchableOpacity style={styles.unblockBtn} onPress={onUnblock} disabled={isRemoving} activeOpacity={0.8}>
        {isRemoving ? (
          <ActivityIndicator size="small" color="#94a3b8" />
        ) : (
          <Text style={styles.unblockBtnText}>{t('unblock', 'Engeli Kaldır')}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

// Ayarlar → "Engellenen Kullanıcılar" — bkz. docs/FEED_SOCIAL_PLAN.md §4.5.
// Yalnızca BENİM engellediklerim listelenir (beni engelleyenler kasıtlı
// olarak gösterilmiyor, bkz. userBlocks.ts getMyBlockedUsers).
export default function BlockedUsersScreen() {
  const { accessToken } = useAuth();
  const router = useRouter();
  const { t } = useTranslation(['feed', 'settings']);
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;

  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const list = await getMyBlockedUsers();
      setUsers(list);
    } catch (error) {
      console.warn('[Feed] Engellenen kullanıcılar yüklenemedi:', error);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleUnblock = async (user: BlockedUser) => {
    if (!accessToken || removingId) return;
    const confirmed = await confirmAsync(
      t('unblockConfirmTitle', 'Engeli Kaldır?'),
      t('unblockConfirmMessage', 'Bu kullanıcının aktivitelerini tekrar görmeye başlayacaksın.'),
      t('unblock', 'Engeli Kaldır'),
      t('cancel', 'Vazgeç')
    );
    if (!confirmed) return;

    setRemovingId(user.id);
    try {
      await unblockUser(accessToken, user.traktSlug);
      invalidateVisibleUserIds();
      invalidateFeedCache();
      setUsers((list) => list.filter((u) => u.id !== user.id));
    } catch (error) {
      console.warn('[Feed] Engel kaldırılamadı:', error);
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, isDesktop && styles.scrollContentDesktop]}
        showsVerticalScrollIndicator={false}
      >
        <SettingsHeader
          title={t('blockedUsersTitle', 'Engellenen Kullanıcılar')}
          isDesktop={isDesktop}
          onBack={() => router.back()}
        />

        <View style={[styles.content, isDesktop && styles.contentDesktop]}>
          {isLoading ? (
            <ActivityIndicator style={styles.loading} color="#3b82f6" />
          ) : hasError ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>{t('blockedUsersError', 'Liste yüklenemedi.')}</Text>
            </View>
          ) : users.length === 0 ? (
            <View style={styles.emptyState}>
              <Ban size={36} color="#334155" />
              <Text style={styles.emptyTitle}>{t('blockedUsersEmptyTitle', 'Kimseyi engellemedin')}</Text>
              <Text style={styles.emptyText}>
                {t('blockedUsersEmptyText', 'Engellediğin kullanıcılar burada listelenir.')}
              </Text>
            </View>
          ) : (
            users.map((user, index) => (
              <View key={user.id}>
                <BlockedUserRow
                  user={user}
                  isRemoving={removingId === user.id}
                  onUnblock={() => handleUnblock(user)}
                />
                {index < users.length - 1 && <View style={styles.separator} />}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  scrollContentDesktop: {
    paddingHorizontal: 24,
  },
  content: {
    paddingHorizontal: 16,
  },
  contentDesktop: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    paddingHorizontal: 0,
  },
  loading: {
    marginTop: 40,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
    gap: 8,
  },
  emptyTitle: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 6,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarText: {
    color: '#94a3b8',
    fontWeight: '700',
    fontSize: 15,
  },
  username: {
    flex: 1,
    color: '#e2e8f0',
    fontWeight: '600',
    fontSize: 14,
  },
  unblockBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    minWidth: 96,
    alignItems: 'center',
  },
  unblockBtnText: {
    color: '#e2e8f0',
    fontSize: 12.5,
    fontWeight: '600',
  },
  separator: {
    height: 1,
    backgroundColor: '#1e293b',
  },
});
