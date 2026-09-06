import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Tv, Sparkles, Film, Inbox, PlayCircle, BarChart2, MessageCircle, UserPlus } from '../../../components/icons';
import { formatRelativeTime } from '../../../utils/formatRelativeTime';
import type { NotificationCategoryId } from '../types';
import type { TimelineEntry } from '../inbox/timeline';

/**
 * Birleşik bildirim akışındaki TEK satır (docs/design/notifications.md § 11).
 *
 * Satır iki farklı kaynaktan gelebiliyor ve `entry.kind` ile ayrılıyor:
 * içerik bildirimleri hazır `title`/`body` taşır, sosyal kayıtlar ise
 * kişiye özgü alanlar (`avatarUrl`/`username`) taşır ve metni ÇEVİRİDEN
 * üretilir. İkisini tek bileşende toplamak, iki ayrı satır bileşeninin
 * zamanla görsel olarak birbirinden ayrışmasını engelliyor.
 */

const CATEGORY_ICONS: Record<NotificationCategoryId, React.ReactNode> = {
  episodeToday: <Tv size={18} color="#3b82f6" />,
  seasonPremiere: <Sparkles size={18} color="#a855f7" />,
  movieRelease: <Film size={18} color="#22d3ee" />,
  continueWatching: <PlayCircle size={18} color="#94a3b8" />,
  // `MessageCircle` BILEREK secildi: lucide diyetinden sonra (Madde 235,
  // 1751 -> 93 ikon) yeni ikon eklemek bundle'i buyutur; bu ikon
  // `components/icons.ts` barrel'inda ZATEN var.
  social: <MessageCircle size={18} color="#ec4899" />,
  monthlyStats: <BarChart2 size={18} color="#f59e0b" />,
};

function UnreadDot({ visible }: { visible: boolean }) {
  // Görünmezken de yer kaplar: okundu/okunmadı arasında satır metni
  // kaymasın (aksi halde liste okundu işaretlenince zıplar).
  return <View style={[styles.dot, !visible && styles.dotHidden]} />;
}

function Avatar({ url, initial }: { url: string | null; initial: string }) {
  if (url) {
    return <Image source={{ uri: url }} style={styles.avatarImage} contentFit="cover" cachePolicy="disk" />;
  }
  return (
    <View style={styles.avatarFallback}>
      <Text style={styles.avatarText}>{initial}</Text>
    </View>
  );
}

export function TimelineRow({ entry }: { entry: TimelineEntry }) {
  const { t } = useTranslation('common');
  const router = useRouter();

  const timeAgo = formatRelativeTime(new Date(entry.at).toISOString(), t);

  if (entry.kind === 'content') {
    return (
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.7}
        // Deep link, bildirimin kendisiyle AYNI hedefe gider (planlayıcı üretti).
        // Hedef ekranlar `useAppBack` kullandığı için geri tuşu doğru davranır.
        onPress={() => router.push(entry.deepLink as never)}
      >
        <UnreadDot visible={!entry.read} />
        <View style={styles.iconSlot}>
          {CATEGORY_ICONS[entry.categoryId] ?? <Inbox size={18} color="#94a3b8" />}
        </View>

        <View style={styles.textWrap}>
          <Text style={[styles.title, !entry.read && styles.titleUnread]} numberOfLines={1}>
            {entry.title}
          </Text>
          <Text style={styles.body} numberOfLines={2}>
            {entry.body}
          </Text>
        </View>

        <Text style={styles.time}>{timeAgo}</Text>
      </TouchableOpacity>
    );
  }

  const displayName = entry.name || entry.username;
  const message =
    entry.activityType === 'newFollower'
      ? t('activityNewFollower', '{{name}} sizi takip etmeye başladı', { name: displayName })
      : t('activityRequestApproved', '{{name}} takip isteğinizi onayladı', { name: displayName });

  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      // 🆕 Sosyal satırlar ESKIDEN TIKLANMIYORDU (salt okunur `View` idi).
      // Bildirimin öznesi bir kullanıcı olduğuna göre profiline gitmek
      // beklenen davranış; akış kartlarındaki desenin aynısı.
      onPress={() => router.push(`/user/${entry.slug || entry.username}` as never)}
    >
      <UnreadDot visible={!entry.read} />
      <Avatar url={entry.avatarUrl} initial={displayName.charAt(0).toUpperCase()} />

      <View style={styles.textWrap}>
        <Text style={[styles.socialMessage, !entry.read && styles.socialUnread]} numberOfLines={2}>
          {message}
        </Text>
        <View style={styles.socialMeta}>
          <UserPlus size={11} color="#64748b" />
          <Text style={styles.socialMetaText}>@{entry.username}</Text>
        </View>
      </View>

      <Text style={styles.time}>{timeAgo}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 13,
    paddingLeft: 10,
    paddingRight: 14,
    // Kaydırınca altındaki kırmızı zemin görünsün diye satırın KENDİ zemini
    // opak olmak ZORUNDA; şeffaf bırakılırsa silme zemini satırın altından
    // sürekli sızar ve satır hep "silinmek üzere" görünür.
    backgroundColor: '#111827',
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#3b82f6' },
  dotHidden: { backgroundColor: 'transparent' },

  iconSlot: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: 36, height: 36, borderRadius: 18 },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#94a3b8', fontWeight: '700', fontSize: 14 },

  textWrap: { flex: 1, gap: 3 },
  title: { color: '#cbd5e1', fontSize: 14, fontWeight: '600' },
  titleUnread: { color: '#f8fafc', fontWeight: '800' },
  body: { color: '#94a3b8', fontSize: 12, lineHeight: 16 },

  socialMessage: { color: '#cbd5e1', fontSize: 13.5, lineHeight: 18 },
  socialUnread: { color: '#f8fafc', fontWeight: '700' },
  socialMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  socialMetaText: { color: '#64748b', fontSize: 11.5 },

  time: { color: '#64748b', fontSize: 11, alignSelf: 'flex-start', paddingTop: 2 },
});
