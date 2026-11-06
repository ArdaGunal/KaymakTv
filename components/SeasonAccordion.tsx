import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { ChevronDown, ChevronUp, Check, CheckCheck, RotateCcw, Trash2 } from './icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { yerelEtiket } from '../locales/diller';
import { generateEpisodeSlug } from '../utils/slugHelper';
import EpisodeCheckButton from './EpisodeCheckButton';
import OrtaPencere from './modals/OrtaPencere';
import { useSezonIsaretleme } from '../hooks/useSezonIsaretleme';
import { bolumYayinlandiMi } from '../utils/atlananBolumler';

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
  /**
   * Masaüstü web'deki BÖLÜM sayfasının sağ gezinme rayı için (kullanıcı
   * isteği: "bulunduğu bölüm görsel olarak vurgulansın"). Verilmezse hiçbir
   * satır vurgulanmaz — mobil çağrı yerleri bunu HİÇ göndermiyor, yani mobil
   * görünüm değişmiyor.
   */
  activeEpisodeNumber?: number | null;
  /** 🆕 M421 — dizinin TÜM sezonlarının yayınlanmış bölümleri (çok sezonlu plan). */
  tumSezonlar?: { sezon: number; bolumler: number[] }[];
  /** 🆕 M421 — dizi nesnesi: ilk işaretlemede "izlenenler"e eklemek için. */
  showMedia?: any;
  /** 🆕 M422 — ham sezon verisi: ilerleme kaydı yokken iyimser iskelet. */
  iskeletSezonlar?: any[];
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
  seasonProgress,
  activeEpisodeNumber = null,
  tumSezonlar,
  iskeletSezonlar,
  showMedia,
}: SeasonAccordionProps) {
  const { t, i18n } = useTranslation(['media', 'common']);
  const router = useRouter();
  // "completed > 0" yalnızca TEK bölüm izlenmişken bile sezonu "izlendi" (yeşil
  // tik) gösteriyordu — bu hem yanıltıcıydı hem de o durumda tek seçenek olarak
  // "tüm sezonu geri al"ı sunuyordu. Artık yeşil tik (ve geri al/tekrar izle
  // seçenekleri) yalnızca yayınlanmış TÜM bölümler tamamlanmışken gösteriliyor;
  // kısmen izlenmiş sezonlarda buton normal "kalanları işaretle" akışına düşer.
  const airedInSeason = seasonProgress?.aired || 0;
  const isSeasonWatched = !!seasonProgress && airedInSeason > 0 && seasonProgress.completed >= airedInSeason;

  // 🆕 M420 — sezonda VAR OLAN ve YAYINLANMIŞ bölüm numaraları. Bu liste
  // katalogdan geliyor (ekran zaten çizmek için kullanıyor) ve "öncekileri de
  // işaretleyeyim mi?" sorusunun ilerleme kaydını beklememesini sağlıyor:
  // yeni eklenen dizide o kayıt ilk işaretlemeden 2-3 sn SONRA geliyor.
  const yayinlanmisNumaralar = useMemo(
    () => (season.episodes || [])
      .filter((ep: any) => bolumYayinlandiMi(ep, season.aired_episodes || 0))
      .map((ep: any) => ep.number)
      .filter((n: any) => typeof n === 'number'),
    [season.episodes, season.aired_episodes],
  );

  const seasonLabel = season.number === 0
    ? t('specials', 'Özel Bölümler')
    : t('seasonNum', { number: season.number });

  // Düğme, menü ve onayların mantığı hook'ta (2.6.8 SEZON-01).
  const sezon = useSezonIsaretleme({
    season, showTraktId, seasonLabel, isSeasonWatched, tumSezonlar, showMedia, iskeletSezonlar,
  });

  return (
    <View style={styles.seasonContainer}>
      <TouchableOpacity
        style={[styles.seasonHeader, !isExpanded && { borderBottomLeftRadius: 15, borderBottomRightRadius: 15 }]}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <Text style={styles.seasonTitle}>
          {season.number === 0 ? t('specials', 'Özel Bölümler') : t('seasonNum', { number: season.number })}
        </Text>
        <View style={styles.seasonHeaderRight}>
           <TouchableOpacity
              onPress={sezon.sezonDugmesi}
              style={[styles.markSeasonBtn, isSeasonWatched && styles.markSeasonBtnWatched]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
           >
              <CheckCheck color="#ffffff" size={20} />
           </TouchableOpacity>
           {isExpanded ? <ChevronUp color="#a3a3a3" /> : <ChevronDown color="#a3a3a3" />}
        </View>
      </TouchableOpacity>

      {isExpanded && season.episodes && (
        <View style={styles.episodesList}>
          {season.episodes.map((ep: any) => {
             const isWatchedLocal = ep.isWatchedLocal;
             const isAired = bolumYayinlandiMi(ep, season.aired_episodes || 0);
             const isActive = activeEpisodeNumber != null && ep.number === activeEpisodeNumber;

             return (
               <View key={ep.number} style={[styles.episodeRow, isActive && styles.episodeRowActive]}>
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
                   <Text style={[styles.episodeName, isActive && styles.episodeNameActive]} numberOfLines={1}>{ep.title}</Text>
                   {ep.first_aired && <Text style={styles.episodeDate}>{new Date(ep.first_aired).toLocaleDateString(yerelEtiket(i18n.language))}</Text>}
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
                        // 🆕 M420 — yalnızca YAYINLANMIŞ bölümler: yayınlanmamışı
                        // işaretlemek sunucuda "gelecek tarih" diye reddedilir.
                        sezonBolumleri={yayinlanmisNumaralar}
                        tumSezonlar={tumSezonlar}
                        iskeletSezonlar={iskeletSezonlar}
                        showMedia={showMedia}
                      />
                   )}
                 </View>
               </View>
             )
          })}
        </View>
      )}

      {/* Sezon tamamen izlenmişken "Tekrar İzle / Bırakılmışı Sil" menüsü —
          window.confirm en fazla 2 seçenek sunabildiği için kendi penceremiz;
          ekranın ortasında (MENU-01, `OrtaPencere`), web ve mobilde aynı. */}
      <OrtaPencere visible={sezon.menuGorunur} onClose={sezon.menuyuKapat}>
        <View style={styles.menuHeader}>
          <Text style={styles.menuTitle}>{t('seasonOptionsTitle')}</Text>
          <Text style={styles.menuSubtitle}>{t('seasonOptionsMsg', { season: seasonLabel })}</Text>
        </View>

        <TouchableOpacity style={styles.menuButton} onPress={sezon.tekrarIzle}>
          <RotateCcw size={20} color="#3b82f6" />
          <Text style={[styles.menuButtonText, { color: '#3b82f6' }]}>{t('rewatch')}</Text>
        </TouchableOpacity>

        {sezon.menuOncekiSayisi > 0 && (
          <TouchableOpacity style={styles.menuButton} onPress={sezon.oncekileriIsaretle}>
            <CheckCheck size={20} color="#10b981" />
            <Text style={[styles.menuButtonText, { color: '#10b981' }]}>
              {t('markPrevSeasons', { count: sezon.menuOncekiSayisi })}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={[styles.menuButton, { borderBottomWidth: 0 }]} onPress={sezon.sezonuGeriAl}>
          <Trash2 size={20} color="#ef4444" />
          <Text style={[styles.menuButtonText, { color: '#ef4444' }]}>{t('unwatchSeasonTitle')}</Text>
        </TouchableOpacity>
      </OrtaPencere>
    </View>
  );
}

const styles = StyleSheet.create({
  seasonContainer: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    marginBottom: 12,
    // 'overflow: hidden' was removed because CSS sticky needs visible overflow.
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  seasonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    ...(Platform.OS === 'web' 
      ? { 
          position: 'sticky', 
          top: -1, 
          zIndex: 10,
          backgroundColor: 'rgba(15, 23, 42, 0.95)', // Yazıların üst üste binmesini engellemek için tok bir renk
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        } as any 
      : {}),
  },
  seasonTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f8fafc',
    letterSpacing: -0.2,
  },
  episodesList: {
    padding: 12,
    overflow: 'hidden',
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
  },
  episodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  // Yalnızca `activeEpisodeNumber` verildiğinde uygulanır (masaüstü web).
  episodeRowActive: {
    backgroundColor: 'rgba(59,130,246,0.10)',
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
    borderBottomColor: 'rgba(59,130,246,0.18)',
    marginHorizontal: -12,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  episodeNameActive: {
    color: '#93c5fd',
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
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  unairedText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: 'bold',
  },
  seasonHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  markSeasonBtn: {
    padding: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
  },
  markSeasonBtnWatched: {
    backgroundColor: '#10b981',
  },
  menuHeader: {
    marginBottom: 20,
  },
  menuTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  menuSubtitle: {
    color: '#a3a3a3',
    fontSize: 14,
  },
  menuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    gap: 12,
  },
  menuButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
