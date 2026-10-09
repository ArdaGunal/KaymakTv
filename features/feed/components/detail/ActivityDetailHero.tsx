import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import MediaPoster from '../../../../components/MediaPoster';
import { ChevronRight, EyeOff, Star } from '../../../../components/icons';
import { FeedActivity } from '../../types';
import { activityLabel } from '../../utils/activityLabel';
import { formatRating } from '../../../../utils/formatRating';
import { useActivityActions } from '../../hooks/useActivityActions';
import ActivityAuthorRow from './ActivityAuthorRow';

interface Props {
  activity: FeedActivity;
  actions: ReturnType<typeof useActivityActions>;
  menuProps: React.ComponentProps<typeof ActivityAuthorRow>['menuProps'];
}

/**
 * C2 · Kullanıcı yayınının (gönderi / inceleme / puan / alıntı) detay üstü —
 * onaylanan taslak A: yazı büyük ve birincil, puan yıldızları, yapım küçük
 * gömülü kart (dokununca yapım sayfası). Kullanıcının metni çevrilmez.
 */
export default function ActivityDetailHero({ activity, actions, menuProps }: Props) {
  const { t } = useTranslation('feed');
  const [revealed, setRevealed] = useState(!activity.noteSpoiler);
  const label = activityLabel(activity, t);
  const puan = activity.rating != null ? Number(formatRating(activity.rating)) : null;
  const dolu = puan != null && !Number.isNaN(puan) ? Math.round(puan) : 0;

  return (
    <View style={styles.wrap}>
      <ActivityAuthorRow activity={activity} onPressProfile={actions.openProfile} menuProps={menuProps} />

      {activity.note ? (
        revealed ? (
          <Text style={styles.body} selectable>{activity.note}</Text>
        ) : (
          <TouchableOpacity style={styles.spoiler} onPress={() => setRevealed(true)} activeOpacity={0.7}>
            <EyeOff size={14} color="#64748b" />
            <Text style={styles.spoilerText}>{t('spoilerReveal', 'Spoiler var — görmek için dokun')}</Text>
          </TouchableOpacity>
        )
      ) : (
        // Yazısız puan: cümlenin kendisi birincil içerik.
        <Text style={styles.sentence}>
          {label.before}
          <Text style={styles.sentenceTitle} onPress={actions.openMedia}>{activity.showTitle}</Text>
          {label.after}
        </Text>
      )}

      {puan != null && !Number.isNaN(puan) && (
        <View style={styles.stars} accessibilityLabel={`${formatRating(activity.rating)}/5`}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Star key={i} size={18} color={i <= dolu ? '#facc15' : '#334155'} fill={i <= dolu ? '#facc15' : 'none'} />
          ))}
          <Text style={styles.starsText}>{`${formatRating(activity.rating)}/5`}</Text>
        </View>
      )}

      {actions.hasShow && (
        <TouchableOpacity style={styles.media} onPress={actions.openMedia} activeOpacity={0.8}>
          <MediaPoster tmdbId={activity.tmdbId} type={activity.mediaType} title={activity.showTitle} style={styles.poster} placeholderTextLines={2} />
          <View style={styles.mediaText}>
            <Text style={styles.mediaTitle} numberOfLines={1}>{activity.showTitle}</Text>
            <Text style={styles.mediaSub} numberOfLines={1}>
              {activity.activityType === 'posted' || !activity.note
                ? activity.mediaType === 'movie'
                  ? t('detailMovie', 'Film')
                  : t('detailShow', 'Dizi')
                : `${label.before}${activity.showTitle ?? ''}${label.after}`}
            </Text>
          </View>
          <ChevronRight size={18} color="#64748b" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14, paddingBottom: 14 },
  body: { color: '#f1f5f9', fontSize: 17, lineHeight: 26 },
  sentence: { color: '#cbd5e1', fontSize: 17, lineHeight: 25 },
  sentenceTitle: { color: '#f1f5f9', fontWeight: '700' },
  spoiler: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#172033',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  spoilerText: { color: '#94a3b8', fontSize: 14 },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  starsText: { color: '#facc15', fontSize: 13, fontWeight: '700', marginLeft: 6 },
  media: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#172033',
    borderWidth: 1,
    borderColor: '#22304A',
    borderRadius: 12,
    padding: 8,
  },
  poster: { width: 42, height: 62, borderRadius: 6, backgroundColor: '#0B1120' },
  mediaText: { flex: 1, gap: 3 },
  mediaTitle: { color: '#f1f5f9', fontSize: 14, fontWeight: '700' },
  mediaSub: { color: '#64748b', fontSize: 12 },
});
