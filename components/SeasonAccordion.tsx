import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { ChevronDown, ChevronUp, Check, CheckCheck } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { generateEpisodeSlug } from '../utils/slugHelper';
import EpisodeCheckButton from './EpisodeCheckButton';
import LoadingIndicator from './LoadingIndicator';
import { useLibraryActions } from '../context/LibraryContext';
import { useAuth } from '../context/AuthContext';

// Bir bölümün yayınlanıp yayınlanmadığını belirler (satırlardaki rozetle aynı mantık).
const isEpisodeAired = (ep: any, airedEpisodesCount: number) =>
  ep.first_aired ? new Date(ep.first_aired) <= new Date() : ep.number <= airedEpisodesCount;

interface SeasonAccordionProps {
  season: any;
  showTraktId: number;
  showSlug: string;
  showTitle: string;
  showTmdbId?: number | string | null;
  onSelectEpisode: (ep: any, seasonNumber: number) => void;
  isExpanded: boolean;
  onToggle: () => void;
  seasonProgress: any;
}

export default function SeasonAccordion({ 
  season, 
  showTraktId, 
  showSlug, 
  showTitle, 
  showTmdbId,
  onSelectEpisode, 
  isExpanded, 
  onToggle,
  seasonProgress 
}: SeasonAccordionProps) {
  const { t } = useTranslation(['media', 'common']);
  const router = useRouter();
  const [seasonLoading, setSeasonLoading] = useState(false);
  // Abonesiz aksiyon hook'u — store değişimleri bu bileşeni yeniden render etmez.
  const { markSeasonAsWatched, markEpisodesUpToAsWatched, unwatchSeason } = useLibraryActions();
  const { isGuest } = useAuth();

  const isSeasonWatched = seasonProgress && seasonProgress.completed > 0;

  const runSeasonAction = async (action: () => Promise<any>) => {
    setSeasonLoading(true);
    try {
      await action();
    } catch (e) {
      console.error(e);
      Alert.alert(t('common:error'), t('seasonMarkError', 'Sezon işaretlenirken bir hata oluştu.'));
    } finally {
      setSeasonLoading(false);
    }
  };

  // Yanlışlıkla basmaya çok müsait bir buton: her iki yön de (işaretle / geri al)
  // artık onay istiyor ve yayınlanmamış bölümler asla işaretlenmiyor.
  const handleMarkSeason = () => {
    if (seasonLoading) return;

    if (isGuest) {
      Alert.alert(t('common:error'), t('common:guestRestrictedMessage', 'Bu işlemi gerçekleştirmek için giriş yapmalısınız.'));
      return;
    }

    const seasonLabel = season.number === 0
      ? t('specials', 'Özel Bölümler')
      : t('seasonNum', { number: season.number });

    // İzlenmişse: geçmişi silme onayı (yıkıcı işlem)
    if (isSeasonWatched) {
      Alert.alert(
        t('unwatchSeasonTitle', 'Sezonu Geri Al'),
        t('unwatchSeasonMsg', { defaultValue: `${seasonLabel} için tüm izleme geçmişi silinecek. Emin misiniz?` }),
        [
          { text: t('common:cancel', 'Vazgeç'), style: 'cancel' },
          {
            text: t('common:delete', 'Geri Al'),
            style: 'destructive',
            onPress: () => runSeasonAction(() => unwatchSeason(showTraktId, season.number)),
          },
        ]
      );
      return;
    }

    // İşaretleme: sadece yayınlanmış bölümler hesaba katılır
    const episodes: any[] = season.episodes || [];
    const airedCount = season.aired_episodes || 0;
    const airedEps = episodes.filter((ep) => isEpisodeAired(ep, airedCount));
    const unairedCount = episodes.length - airedEps.length;

    if (airedEps.length === 0) {
      Alert.alert(
        t('seasonNotAiredTitle', 'Henüz Yayınlanmadı'),
        t('seasonNotAiredMsg', { defaultValue: `${seasonLabel} bölümleri henüz yayınlanmadığı için işaretlenemez.` })
      );
      return;
    }

    const message = unairedCount > 0
      ? t('markSeasonPartialMsg', { defaultValue: `Yayınlanmış ${airedEps.length} bölüm izlendi olarak işaretlenecek (henüz çıkmamış ${unairedCount} bölüm atlanacak). Devam edilsin mi?` })
      : t('markSeasonMsg', { defaultValue: `${seasonLabel} içindeki ${airedEps.length} bölümün tamamı izlendi olarak işaretlensin mi?` });

    Alert.alert(
      t('markSeasonTitle', 'Sezonu İşaretle'),
      message,
      [
        { text: t('common:cancel', 'Vazgeç'), style: 'cancel' },
        {
          text: t('markAsWatched', 'İşaretle'),
          onPress: () => runSeasonAction(() =>
            unairedCount > 0
              // Yayınlanmamış bölüm varsa tüm sezon yerine sadece yayınlanmışlar gönderilir
              ? markEpisodesUpToAsWatched(showTraktId, season.number, airedEps.map((ep) => ep.number))
              : markSeasonAsWatched(showTraktId, season.number)
          ),
        },
      ]
    );
  };

  return (
    <View style={styles.seasonContainer}>
      <TouchableOpacity 
        style={styles.seasonHeader} 
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <Text style={styles.seasonTitle}>
          {season.number === 0 ? t('specials', 'Özel Bölümler') : t('seasonNum', { number: season.number })}
        </Text>
        <View style={styles.seasonHeaderRight}>
           <TouchableOpacity
              onPress={handleMarkSeason}
              style={[styles.markSeasonBtn, isSeasonWatched && styles.markSeasonBtnWatched]}
              disabled={seasonLoading}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
           >
              {seasonLoading ? (
                <LoadingIndicator size="small" color="#ffffff" />
              ) : (
                <CheckCheck color="#ffffff" size={20} />
              )}
           </TouchableOpacity>
           {isExpanded ? <ChevronUp color="#a3a3a3" /> : <ChevronDown color="#a3a3a3" />}
        </View>
      </TouchableOpacity>

      {isExpanded && season.episodes && (
        <View style={styles.episodesList}>
          {season.episodes.map((ep: any) => {
             const isWatchedLocal = ep.isWatchedLocal;
             const isAired = isEpisodeAired(ep, season.aired_episodes || 0);
             
             return (
               <View key={ep.number} style={styles.episodeRow}>
                 <TouchableOpacity 
                   style={styles.episodeInfo}
                   activeOpacity={0.7}
                   onPress={() => {
                     const epId = ep?.ids?.trakt;
                     if (!epId) return;
                     const slug = generateEpisodeSlug(showTraktId, showSlug, showTitle, season.number, ep.number, epId);
                     router.push(`/episode/${slug}${showTmdbId ? `?showTmdbId=${showTmdbId}` : ''}`);
                   }}
                 >
                   <Text style={styles.episodeNumber}>{t('episodeNum', { number: ep.number })}</Text>
                   <Text style={styles.episodeName} numberOfLines={1}>{ep.title}</Text>
                   {ep.first_aired && <Text style={styles.episodeDate}>{new Date(ep.first_aired).toLocaleDateString('tr-TR')}</Text>}
                 </TouchableOpacity>
                 <View>
                   {isWatchedLocal ? (
                      <TouchableOpacity 
                        style={styles.watchedIcon}
                        activeOpacity={0.7}
                        onPress={() => onSelectEpisode(ep, season.number)}
                      >
                        <Check size={20} color="#fff" strokeWidth={3} />
                      </TouchableOpacity>
                   ) : !isAired ? (
                      <View style={styles.unairedBadge}>
                        <Text style={styles.unairedText}>
                          {!ep.first_aired ? 'TBA' : (() => {
                            const diff = new Date(ep.first_aired).getTime() - new Date().getTime();
                            const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
                            return days <= 0 ? t('today') : t('daysLeft', { days: days });
                          })()}
                        </Text>
                      </View>
                   ) : (
                      <EpisodeCheckButton 
                        traktId={showTraktId}
                        season={season.number}
                        episode={ep.number}
                        showName={showTitle}
                      />
                   )}
                 </View>
               </View>
             )
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  seasonContainer: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  seasonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#263346',
  },
  seasonTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  episodesList: {
    padding: 12,
    backgroundColor: '#1e293b',
  },
  episodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  episodeInfo: {
    flex: 1,
    marginRight: 16,
  },
  episodeNumber: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#94a3b8',
    marginBottom: 4,
  },
  episodeName: {
    fontSize: 14,
    color: '#f8fafc',
    fontWeight: '600',
    marginBottom: 2,
  },
  episodeDate: {
    fontSize: 12,
    color: '#64748b',
  },
  watchedIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unairedBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  unairedText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: 'bold',
  },
  seasonHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  markSeasonBtn: {
    marginRight: 16,
    padding: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
  },
  markSeasonBtnWatched: {
    backgroundColor: '#10b981',
  },
});
