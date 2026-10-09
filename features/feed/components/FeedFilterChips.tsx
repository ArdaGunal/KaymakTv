import React from 'react';
import { ScrollView, Text, StyleSheet, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FEED_FILTERS, FeedFilter } from '../utils/feedFilter';

interface Props {
  value: FeedFilter;
  onChange: (f: FeedFilter) => void;
}

const ETIKET: Record<FeedFilter, [string, string]> = {
  tumu: ['filterAll', 'Tümü'],
  gonderiler: ['filterPosts', 'Gönderiler'],
  takip: ['filterFollowing', 'Takip Ettiklerim'],
  aktiviteler: ['filterActivity', 'Aktiviteler'],
};

/**
 * C6 · YouTube tarzı filtre çipleri (kullanıcı kararı 2026-10-10). Tek seçimli;
 * «Tümü» varsayılan — filtreden çıkmak tek dokunuş. Görünürlüğü (açılışta gizli,
 * aşağı çekince beliren) çip değil liste yönetir — bkz. useGizliFiltreBasligi.
 */
export default function FeedFilterChips({ value, onChange }: Props) {
  const { t } = useTranslation('feed');
  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {FEED_FILTERS.map((f) => {
          const secili = f === value;
          return (
            <Pressable
              key={f}
              onPress={() => onChange(f)}
              accessibilityRole="button"
              accessibilityState={{ selected: secili }}
              style={(state) => [
                styles.chip,
                secili && styles.chipOn,
                !secili && (state as { hovered?: boolean }).hovered && styles.chipHover,
                state.pressed && styles.chipPressed,
              ]}
            >
              <Text style={[styles.text, secili && styles.textOn]}>{t(ETIKET[f][0], ETIKET[f][1])}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 4, paddingBottom: 12 },
  row: { gap: 8, paddingRight: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#172033',
    borderWidth: 1,
    borderColor: '#22304A',
  },
  chipOn: { backgroundColor: '#e2e8f0', borderColor: '#e2e8f0' },
  chipHover: { borderColor: '#2E4166' },
  chipPressed: { opacity: 0.8 },
  text: { color: '#cbd5e1', fontSize: 13, fontWeight: '600' },
  textOn: { color: '#0B1120' },
});
