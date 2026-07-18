import React, { memo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import EpisodeCheckButton from './EpisodeCheckButton';
import InlineRater from './InlineRater';
import { addRating } from '../services/traktApi';
import { useAirCountdown } from '../hooks/useAirCountdown';
import { useTranslation } from 'react-i18next';

interface EpisodeCardActionsProps {
  data: any;
  isSuccess: boolean;
  onSuccessStateChange: (val: boolean) => void;
  onShowFinished?: (showName: string, showId: number) => void;
}

// Kartın sağ paneli: geri sayım / spinner / işaretleme butonu.
// useAirCountdown timer'ı BURADA yaşar — her tick'te yalnızca bu küçük panel
// yeniden render olur; poster, başlık ve etiketleri taşıyan kart gövdesi etkilenmez.
const EpisodeCardActions = memo(({ data, isSuccess, onSuccessStateChange, onShowFinished }: EpisodeCardActionsProps) => {
  const { t } = useTranslation('media');
  const airStatus = useAirCountdown(data?.rawDate);

  return (
    <View style={styles.checkButtonContainer}>
      {data.rawDate !== undefined && !airStatus.isAired ? (
        <View style={styles.countdownContainer}>
          {airStatus.text.includes(t('day')) ? (
            <>
              <Text style={styles.countdownNumber}>
                {airStatus.text.replace(` ${t('day')}`, '')}
              </Text>
              <Text style={styles.countdownText}>{t('day')}</Text>
            </>
          ) : (
            <Text style={[styles.countdownText, styles.countdownTextLive]}>
              {airStatus.text}
            </Text>
          )}
        </View>
      ) : data.isCalculating ? (
        <ActivityIndicator size="small" color="#a3a3a3" />
      ) : (
        <>
          <EpisodeCheckButton
            traktId={data.rawTraktId || data.id}
            season={data.season}
            episode={data.episode}
            showName={data.showName}
            onShowFinished={onShowFinished}
            onSuccessStateChange={onSuccessStateChange}
          />
          {isSuccess && (
            <InlineRater
              onRate={async (val) => {
                await addRating(data.rawTraktId || data.id, 'episode', val, data.season, data.episode);
              }}
            />
          )}
        </>
      )}
    </View>
  );
});

export default EpisodeCardActions;

const styles = StyleSheet.create({
  checkButtonContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    minWidth: 56,
  },
  countdownContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownNumber: {
    color: '#10b981',
    fontSize: 20,
    fontWeight: '800',
  },
  countdownText: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  countdownTextLive: {
    color: '#10b981',
    fontSize: 11,
    textAlign: 'center',
  },
});
