import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import SeasonAccordion from '../SeasonAccordion';
import SectionErrorBoundary from '../SectionErrorBoundary';

interface SeasonsListMobileProps {
  seasons: any[] | null | undefined;
  showTraktId: number;
  showSlug: string;
  showTitle: string;
  showTmdbId?: number | string | null;
  expandedSeasons: Record<number, boolean>;
  onToggleSeason: (seasonNumber: number) => void;
  onSelectEpisode: (ep: any, seasonNumber: number) => void;
  /** 🆕 M421 — "öncekileri de işaretle" ÖNCEKİ SEZONLARI da kapsıyor; evren
   *  ekranın katalog verisinden geliyor (bkz. utils/sezonEvreni.ts). */
  tumSezonlar?: { sezon: number; bolumler: number[] }[];
  iskeletSezonlar?: any[];
  showMedia?: any;
}

/**
 * Mobil (ve dar web) dizi sayfasının «Sezonlar» bölümü — masaüstü web'deki
 * `SeasonsRailWeb`'in karşılığı. Sayfadaki yeri `utils/diziSayfaSirasi.ts`'te
 * (DIZI-SAYFA-01: uygulamada yorumların üstünde, web'de altında).
 */
export default function SeasonsListMobile({
  seasons,
  showTraktId,
  showSlug,
  showTitle,
  showTmdbId,
  expandedSeasons,
  onToggleSeason,
  onSelectEpisode,
  tumSezonlar,
  iskeletSezonlar,
  showMedia,
}: SeasonsListMobileProps) {
  const { t } = useTranslation('media');
  if (!seasons || seasons.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('seasons')}</Text>
      {/* Y20: sınır SEZON BAŞINA — tüm listeyi tek sınıra sarmak,
          bozuk TEK bir sezonun diğerlerini de götürmesi demekti
          (feed.tsx'teki kart-başına sınırla aynı gerekçe). */}
      {seasons.map((season) => (
        <SectionErrorBoundary key={season.number} label={'season:' + season.number}>
          <SeasonAccordion
            season={season}
            showTraktId={showTraktId}
            showSlug={showSlug}
            showTitle={showTitle}
            showTmdbId={showTmdbId}
            onSelectEpisode={onSelectEpisode}
            isExpanded={expandedSeasons[season.number]}
            onToggle={() => onToggleSeason(season.number)}
            seasonProgress={season.seasonProgress}
            tumSezonlar={tumSezonlar}
            iskeletSezonlar={iskeletSezonlar}
            showMedia={showMedia}
          />
        </SectionErrorBoundary>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 12 },
});
