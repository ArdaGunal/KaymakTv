import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import MediaPoster from '../../../../components/MediaPoster';
import { Tv, Film, PlayCircle } from '../../../../components/icons';
import { FeedActivity } from '../../types';
import { activityLabel } from '../../utils/activityLabel';
import { useActivityActions } from '../../hooks/useActivityActions';
import { useOpenEpisode } from '../../hooks/useOpenEpisode';
import ActivityAuthorRow from './ActivityAuthorRow';
import ActivityActionBar from './ActivityActionBar';

interface Props {
  activity: FeedActivity;
  actions: ReturnType<typeof useActivityActions>;
  /** Pencereden bir sayfaya gidilmeden ÖNCE çağrılır (pencere kapansın). */
  beforeNavigate?: () => void;
}

/**
 * C2 · Sistem kaydının («X izledi») içeriği — yarım ekran pencere ve paylaşım
 * linkiyle açılan tam sayfa AYNI içeriği gösterir. Yorum alanı yok (kullanıcı
 * kararı). Poster arka planla iç içe geçmez (taslak B'nin düzeltilmiş hâli).
 */
export default function SystemActivityBody({ activity, actions, beforeNavigate }: Props) {
  const { t } = useTranslation('feed');
  const { openEpisode, isOpening } = useOpenEpisode();
  // Bölüm kodu cümleden çıkarılıp ayrı etikete taşınır (ikisi tekrar etmesin).
  const label = activityLabel({ ...activity, episodeNumber: undefined }, t);
  const isMovie = activity.mediaType === 'movie';
  const go = (fn: () => void) => () => {
    beforeNavigate?.();
    fn();
  };

  // Menü eylemleri (alıntı, şikayet, paylaş, engelle) kendi modalını açar —
  // pencere üstte kalıp onu örtmesin diye önce pencere kapanır.
  // C3 · Kendi sistem kaydını buradan da silebilirsin (akış kartıyla aynı uç).
  const menuProps = Object.fromEntries(
    Object.entries({
      ...actions.menuProps,
      onDelete: actions.isOwnActivity
        ? (): void => {
            void actions.deleteOwn();
          }
        : undefined,
    }).map(([k, v]) => [k, typeof v === 'function' ? go(v as () => void) : v])
  );

  return (
    <View style={styles.wrap}>
      <ActivityAuthorRow activity={activity} onPressProfile={go(actions.openProfile)} menuProps={menuProps} />

      <View style={styles.mediaRow}>
        {actions.hasShow && (
          <TouchableOpacity activeOpacity={0.8} onPress={go(actions.openMedia)}>
            <MediaPoster tmdbId={activity.tmdbId} type={activity.mediaType} title={activity.showTitle} style={styles.poster} placeholderTextLines={3} />
          </TouchableOpacity>
        )}
        <View style={styles.mediaText}>
          <Text style={styles.sentence}>
            {label.before}
            {/* Düz metin (onPress YOK): Text yanıtlayıcısı dokunuşu bırakmıyor ve
                pencerenin aşağı sürükleyip kapatılmasını engelliyordu. Yapıma
                gitmek için poster ve «Diziye git» var. */}
            <Text style={styles.title}>{activity.showTitle}</Text>
            {label.after}
          </Text>
          {!!activity.episodeNumber && (
            <View style={styles.chip}>
              <Text style={styles.chipText}>{activity.episodeNumber}</Text>
            </View>
          )}
        </View>
      </View>

      <ActivityActionBar
        activity={activity}
        onToggleLike={actions.toggleLike}
        isLiking={actions.isLiking}
        onShare={actions.share}
        showCounts={false}
      />

      {actions.hasShow && (
        <View style={styles.buttons}>
          <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={go(actions.openMedia)} activeOpacity={0.8}>
            {isMovie ? <Film size={16} color="#bae6fd" /> : <Tv size={16} color="#bae6fd" />}
            <Text style={styles.btnPrimaryText}>{isMovie ? t('detailGoMovie', 'Filme git') : t('detailGoShow', 'Diziye git')}</Text>
          </TouchableOpacity>
          {!!activity.episodeNumber && (
            <TouchableOpacity
              style={styles.btn}
              activeOpacity={0.8}
              disabled={isOpening}
              onPress={() => {
                beforeNavigate?.();
                openEpisode(activity, actions.openMedia);
              }}
            >
              {isOpening ? <ActivityIndicator size="small" color="#cbd5e1" /> : <PlayCircle size={16} color="#cbd5e1" />}
              <Text style={styles.btnText}>{t('detailGoEpisode', 'Bölüme git')}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  mediaRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  poster: { width: 64, height: 94, borderRadius: 8, backgroundColor: '#0B1120' },
  mediaText: { flex: 1, gap: 8 },
  sentence: { color: '#cbd5e1', fontSize: 16, lineHeight: 22 },
  title: { color: '#f1f5f9', fontWeight: '700' },
  chip: { alignSelf: 'flex-start', backgroundColor: '#0c2a3d', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  chipText: { color: '#7dd3fc', fontSize: 12, fontWeight: '600' },
  buttons: { flexDirection: 'row', gap: 10 },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#22304A',
  },
  btnText: { color: '#cbd5e1', fontSize: 14, fontWeight: '600' },
  btnPrimary: { backgroundColor: '#1e3a5f', borderColor: '#1e3a5f' },
  btnPrimaryText: { color: '#bae6fd', fontSize: 14, fontWeight: '700' },
});
