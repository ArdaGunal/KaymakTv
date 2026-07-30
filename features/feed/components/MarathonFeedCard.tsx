/**
 * MarathonFeedCard — Gruplanmış Maraton Aktivitesi Kartı
 *
 * Normal FeedCard'ın yanında gösterilen özel kart.
 * Kullanıcının aynı diziden art arda (< 12h aralıklarla) izlediği ≥2 bölümü
 * tek, zengin bir kart olarak temsil eder.
 *
 * Tasarım:
 * - Sol:  Kullanıcı avatarı (baş harf), level renginde kenarlık
 * - Orta: Seviye rozeti + dinamik başlık + dizi · bölüm aralığı + zaman
 * - Sağ:  Büyük "×N bölüm" sayacı (accent renginde)
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Zap } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { MarathonActivity } from '../types';
import { getMarathonMessage } from '../utils/marathonMessages';
import { formatRelativeTime } from '../utils/formatRelativeTime';
import ActivityDeleteRow from './ActivityDeleteRow';

interface MarathonFeedCardProps {
  activity: MarathonActivity;
  /** Yalnızca Profil › Aktiviteler'de kullanılır — bkz. FeedCard.tsx'teki not. */
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  onDelete?: () => void;
}

export default function MarathonFeedCard({
  activity,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
  onDelete,
}: MarathonFeedCardProps) {
  const router = useRouter();
  const message = getMarathonMessage(activity.user.username, activity.episodeCount);
  const initial = activity.user.username.charAt(0).toUpperCase();

  const handlePressProfile = () => {
    // bkz. FeedCard.tsx'teki AYNI düzeltme notu — takip durumu (followStore)
    // kanonik `slug`'a göre anahtarlanıyor, username'e göre değil.
    router.push(`/user/${activity.user.traktSlug || activity.user.username}`);
  };

  // Hex rengine opaklık katmak için basit yardımcı (inline stil gerektiğinde)
  const colorAlpha = (hex: string, alpha: string) => `${hex}${alpha}`;

  const card = (
    <View style={[styles.card, { borderColor: colorAlpha(message.color, '2e') }]}>
      {/* ── Sol: Avatar ──────────────────────────────────────────────────── */}
      <TouchableOpacity activeOpacity={0.7} onPress={handlePressProfile}>
        <View style={[styles.avatar, { borderColor: colorAlpha(message.color, '55') }]}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
      </TouchableOpacity>

      {/* ── Orta: İçerik ─────────────────────────────────────────────────── */}
      <View style={styles.body}>
        {/* Seviye rozeti */}
        <View style={[styles.badge, { backgroundColor: colorAlpha(message.color, '1a') }]}>
          <Zap size={9} color={message.color} fill={message.color} />
          <Text style={[styles.badgeText, { color: message.color }]}>
            {message.badge}
          </Text>
        </View>

        {/* Dinamik başlık (marathonMessages'tan gelir) */}
        <TouchableOpacity activeOpacity={0.7} onPress={handlePressProfile}>
          <Text style={styles.headline} numberOfLines={2}>
            {message.headline}
          </Text>
        </TouchableOpacity>

        {/* Dizi adı + bölüm aralığı */}
        <Text style={styles.subtitle} numberOfLines={1}>
          {activity.showTitle}
          {activity.episodeCount > 1
            ? ` • ${activity.episodeRange} arası izlendi`
            : ` • ${activity.firstEpisode} izlendi`}
        </Text>

        {/* Göreceli zaman */}
        <Text style={styles.timestamp}>{formatRelativeTime(activity.activityAt)}</Text>
      </View>

      {/* ── Sağ: Bölüm Sayacı ────────────────────────────────────────────── */}
      <View style={[styles.counter, { backgroundColor: colorAlpha(message.color, '12') }]}>
        <Text style={[styles.counterNumber, { color: message.color }]}>
          ×{activity.episodeCount}
        </Text>
        <Text style={styles.counterLabel}>bölüm</Text>
      </View>
    </View>
  );

  if (!onDelete) return card;

  return (
    <ActivityDeleteRow
      isSelectionMode={isSelectionMode}
      isSelected={isSelected}
      onToggleSelect={onToggleSelect ?? (() => {})}
      onDelete={onDelete}
    >
      {card}
    </ActivityDeleteRow>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131f35',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    gap: 12,
  },
  // ── Avatar ──────────────────────────────────────────────────────────────
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    color: '#94a3b8',
    fontWeight: '700',
    fontSize: 15,
  },
  // ── Gövde ────────────────────────────────────────────────────────────────
  body: {
    flex: 1,
    gap: 3,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
    marginBottom: 2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  headline: {
    color: '#f1f5f9',
    fontSize: 13.5,
    fontWeight: '700',
    lineHeight: 19,
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 17,
  },
  timestamp: {
    color: '#475569',
    fontSize: 11,
    marginTop: 2,
  },
  // ── Sağ Sayaç ────────────────────────────────────────────────────────────
  counter: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 52,
    borderRadius: 12,
    flexShrink: 0,
  },
  counterNumber: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 20,
  },
  counterLabel: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
