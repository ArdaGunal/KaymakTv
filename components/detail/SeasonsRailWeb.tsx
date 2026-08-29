import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import SeasonAccordion from '../SeasonAccordion';
import SectionErrorBoundary from '../SectionErrorBoundary';

interface SeasonsRailWebProps {
  seasons: any[];
  showTraktId: number;
  showSlug: string;
  showTitle: string;
  showTmdbId?: number | string | null;
  expandedSeasons: Record<number, boolean>;
  onToggleSeason: (seasonNumber: number) => void;
  onSelectEpisode: (ep: any, seasonNumber: number) => void;
  /** Bölüm sayfasında: hangi sezon/bölümdeyiz (vurgulanır). */
  activeSeasonNumber?: number | null;
  activeEpisodeNumber?: number | null;
}

/**
 * Masaüstü web'in SAĞ SÜTUNU — "Sezonlar ve Bölümler" gezinme rayı.
 *
 * Yapışkanlığı (sticky) `DetailWebLayout` sağlıyor; burada yalnızca kartın
 * kendisi var. Sezon başına ayrı hata sınırı korunuyor (bkz. app/show/[id].tsx
 * Y20 notu: bozuk TEK bir sezon diğerlerini götürmemeli).
 */
export default function SeasonsRailWeb({
  seasons,
  showTraktId,
  showSlug,
  showTitle,
  showTmdbId,
  expandedSeasons,
  onToggleSeason,
  onSelectEpisode,
  activeSeasonNumber = null,
  activeEpisodeNumber = null,
}: SeasonsRailWebProps) {
  const { t } = useTranslation('media');

  if (!seasons || seasons.length === 0) return null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('seasons')}</Text>
        <Text style={styles.count}>{seasons.length}</Text>
      </View>

      <View style={styles.body}>
        {seasons.map((season) => (
          <SectionErrorBoundary key={season.number} label={'season:' + season.number}>
            <SeasonAccordion
              season={season}
              showTraktId={showTraktId}
              showSlug={showSlug}
              showTitle={showTitle}
              showTmdbId={showTmdbId}
              onSelectEpisode={onSelectEpisode}
              isExpanded={!!expandedSeasons[season.number]}
              onToggle={() => onToggleSeason(season.number)}
              seasonProgress={season.seasonProgress}
              activeEpisodeNumber={season.number === activeSeasonNumber ? activeEpisodeNumber : null}
            />
          </SectionErrorBoundary>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(15,23,42,0.72)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingBottom: 12,
  },
  title: {
    color: '#f8fafc',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  count: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  body: {
    gap: 0,
  },
});
