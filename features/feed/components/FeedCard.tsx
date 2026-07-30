import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Eye, Play, CheckCircle2, Star, Film } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { FeedActivity } from '../types';
import { formatRelativeTime } from '../utils/formatRelativeTime';
import ActivityDeleteRow from './ActivityDeleteRow';

interface FeedCardProps {
  activity: FeedActivity;
  /** Yalnızca Profil › Aktiviteler'de kullanılır — Akış (feed.tsx) sekmesinde
   *  hiçbiri geçilmez, bu yüzden `onDelete` yoksa kart eskisi gibi davranır. */
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  onDelete?: () => void;
}

// Her aktivite tipi kendi ikonunu, vurgu rengini ve metin şablonunu taşır —
// yeni bir tip eklemek (Phase 2: 'commented' vb.) bu map'e bir satır eklemek
// kadar basit olacak şekilde tasarlandı.
const ACTIVITY_META: Record<
  FeedActivity['activityType'],
  { icon: typeof Eye; color: string; label: (a: FeedActivity) => string }
> = {
  watched_episode: {
    icon: Eye,
    color: '#38bdf8',
    label: (a) => `${a.showTitle} ${a.episodeNumber ?? ''} izledi`.trim(),
  },
  started_show: {
    icon: Play,
    color: '#a78bfa',
    label: (a) => `${a.showTitle} izlemeye başladı`,
  },
  completed_show: {
    icon: CheckCircle2,
    color: '#4ade80',
    label: (a) => `${a.showTitle} tamamladı`,
  },
  rated: {
    icon: Star,
    color: '#facc15',
    label: (a) => `${a.showTitle} filmine ${a.rating}/10 puan verdi`,
  },
};

export default function FeedCard({
  activity,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
  onDelete,
}: FeedCardProps) {
  const meta = ACTIVITY_META[activity.activityType];
  const Icon = meta.icon;
  const initial = activity.user.username.charAt(0).toUpperCase();
  const router = useRouter();

  const handlePressProfile = () => {
    router.push(`/user/${activity.user.username}`);
  };

  const card = (
    <View style={styles.card}>
      <TouchableOpacity activeOpacity={0.7} onPress={handlePressProfile}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.body}>
        <View style={styles.headerRow}>
          <TouchableOpacity activeOpacity={0.7} onPress={handlePressProfile}>
            <Text style={styles.username}>{activity.user.username}</Text>
          </TouchableOpacity>
          <Icon size={14} color={meta.color} />
        </View>

        <Text style={styles.label} numberOfLines={2}>
          {meta.label(activity)}
        </Text>

        <Text style={styles.timestamp}>{formatRelativeTime(activity.activityAt)}</Text>
      </View>

      <View style={styles.poster}>
        <Film size={20} color="#475569" />
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
    backgroundColor: '#172033',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#22304A',
    padding: 14,
    marginBottom: 12,
    gap: 12,
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
  avatarText: {
    color: '#94a3b8',
    fontWeight: '700',
    fontSize: 15,
  },
  body: {
    flex: 1,
    gap: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  username: {
    color: '#f8fafc',
    fontWeight: '700',
    fontSize: 14,
  },
  label: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 18,
  },
  timestamp: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  poster: {
    width: 40,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#0B1120',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
