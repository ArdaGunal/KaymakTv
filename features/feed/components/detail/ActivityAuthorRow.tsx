import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import Avatar from '../../../../components/Avatar';
import { FeedActivity } from '../../types';
import { ACTIVITY_META } from '../../utils/activityMeta';
import { formatExactDate } from '../../../../utils/formatExactDate';
import CardMenu from '../CardMenu';

interface Props {
  activity: FeedActivity;
  onPressProfile: () => void;
  menuProps: React.ComponentProps<typeof CardMenu>;
}

/** C2 · Detay sayfası ve sistem penceresinin ortak üst satırı: avatar, ad + tip
 *  ikonu, TAM tarih («10 Eki · 21:14»), üç nokta menüsü. */
export default function ActivityAuthorRow({ activity, onPressProfile, menuProps }: Props) {
  const { i18n } = useTranslation('feed');
  const meta = ACTIVITY_META[activity.activityType];
  const Icon = meta.icon;
  return (
    <View style={styles.row}>
      <TouchableOpacity activeOpacity={0.7} onPress={onPressProfile}>
        <Avatar url={activity.user.avatarUrl} ad={activity.user.username} size={42} />
      </TouchableOpacity>
      <View style={styles.middle}>
        <TouchableOpacity activeOpacity={0.7} onPress={onPressProfile} style={styles.nameRow}>
          <Text style={styles.username} numberOfLines={1}>{activity.user.username}</Text>
          <Icon size={14} color={meta.color} />
        </TouchableOpacity>
        <Text style={styles.date}>{formatExactDate(activity.activityAt, i18n.language)}</Text>
      </View>
      {!activity.isPending && <CardMenu {...menuProps} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  middle: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  username: { color: '#f8fafc', fontWeight: '700', fontSize: 15, flexShrink: 1 },
  date: { color: '#64748b', fontSize: 12 },
});
