import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Tv, Sparkles, Film, Inbox, PlayCircle, BarChart2 } from '../../../components/icons';
import { formatRelativeTime } from '../../../utils/formatRelativeTime';
import { useInboxStore } from '../inbox/useInboxStore';
import type { InboxItem } from '../inbox/useInboxStore';
import type { NotificationCategoryId } from '../types';

/**
 * `app/(protected)/notifications.tsx` ekranındaki "İçerik Bildirimleri"
 * bölümü (docs/design/notifications.md § 11).
 *
 * ⚠️ AYRI BİLEŞEN OLMASININ SEBEBİ: o ekran zaten 351 satırdı; bölümü içine
 * yazmak `AI_RULES` §1'in 400 satır sınırını aşardı.
 *
 * 🔴 SOSYAL LİSTEYLE KARIŞTIRILMADI. Aynı ekranda ama AYRI bölüm ve AYRI
 * store — gerekçe `inbox/useInboxStore.ts` başlığında (sosyal kayıtlar
 * `avatarUrl`/`username` taşır, içerik bildirimleri taşımaz).
 */

const CATEGORY_ICONS: Record<NotificationCategoryId, React.ReactNode> = {
  episodeToday: <Tv size={18} color="#3b82f6" />,
  seasonPremiere: <Sparkles size={18} color="#a855f7" />,
  movieRelease: <Film size={18} color="#22d3ee" />,
  continueWatching: <PlayCircle size={18} color="#94a3b8" />,
  monthlyStats: <BarChart2 size={18} color="#f59e0b" />,
};

function InboxRow({ item }: { item: InboxItem }) {
  const { t } = useTranslation('common');
  const router = useRouter();

  const timeAgo = formatRelativeTime(new Date(item.fireAt).toISOString(), t);

  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      // Deep link, bildirimin kendisiyle AYNI hedefe gider (planlayıcı üretti).
      // Hedef ekranlar `useAppBack` kullandığı için geri tuşu doğru davranır.
      onPress={() => router.push(item.deepLink as never)}
    >
      <View style={styles.iconSlot}>{CATEGORY_ICONS[item.categoryId] ?? <Inbox size={18} color="#94a3b8" />}</View>

      <View style={styles.textWrap}>
        <Text style={[styles.title, !item.read && styles.titleUnread]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.body} numberOfLines={2}>
          {item.body}
        </Text>
      </View>

      <Text style={styles.time}>{timeAgo}</Text>
    </TouchableOpacity>
  );
}

export function InboxSection() {
  const { t } = useTranslation('notifications');
  const items = useInboxStore((state) => state.items);

  // Yalnızca gerçekten DÜŞMÜŞ olanlar listelenir. Saat farkı/gelecek tarihli
  // bozuk bir kayıt listeye sızarsa kullanıcıya "gelecekte olan bir şey oldu"
  // gibi görünürdü.
  const now = Date.now();
  const visible = useMemo(() => items.filter((item) => item.fireAt <= now), [items, now]);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Tv size={16} color="#94a3b8" />
        <Text style={styles.sectionTitle}>{t('inbox.sectionTitle')}</Text>
      </View>

      {visible.length === 0 ? (
        <View style={styles.emptyBox}>
          <Inbox size={28} color="#334155" />
          <Text style={styles.emptyText}>{t('inbox.empty')}</Text>
        </View>
      ) : (
        <View style={styles.card}>
          {visible.map((item, index) => (
            <React.Fragment key={item.identifier}>
              <InboxRow item={item} />
              {index < visible.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  // `app/(protected)/notifications.tsx`'teki `sectionTitle` ile BİREBİR aynı:
  // aynı ekranda iki bölüm başlığı farklı görünürse yamalı durur.
  sectionTitle: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  iconSlot: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { flex: 1, gap: 2 },
  title: { color: '#cbd5e1', fontSize: 14, fontWeight: '600' },
  titleUnread: { color: '#f8fafc', fontWeight: '800' },
  body: { color: '#94a3b8', fontSize: 12, lineHeight: 16 },
  time: { color: '#64748b', fontSize: 11 },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 24,
    backgroundColor: '#111827',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  emptyText: { color: '#64748b', fontSize: 13 },
});
