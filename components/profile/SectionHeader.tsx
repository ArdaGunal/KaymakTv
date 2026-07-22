import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { SECTION_PADDING_H } from './profileMetrics';

interface SectionHeaderProps {
  title: string;
  /** Başlığın solunda, hafif renkli bir rozet içinde gösterilir. */
  icon?: React.ReactNode;
  /** Rozetin arka plan/çerçeve rengi — ikonun rengiyle uyumlu verilmeli. */
  iconTint?: string;
  /** Verilirse başlığın yanında öğe sayısı rozeti çıkar. */
  count?: number;
  /** Verilirse satır tıklanabilir olur ve sağda "Tümü ›" görünür. */
  onSeeAll?: () => void;
  seeAllLabel: string;
}

/**
 * Profil ekranındaki TÜM şeritlerin ortak başlığı.
 *
 * Öncesinde iki ayrı başlık dili vardı: poster şeritleri 18px kalın başlık +
 * yalnız chevron (16px kenar boşluğu), "Listelerim" ise 19px + ikon rozeti +
 * sayı rozeti + "Tümü" metni (20px kenar boşluğu). Aynı ekranda alt alta
 * durdukları için bu fark hem hizasızlık hem de dağınık bir görünüm
 * yaratıyordu. Artık tek bileşen.
 */
const SectionHeader = memo(({
  title,
  icon,
  iconTint = '#60a5fa',
  count,
  onSeeAll,
  seeAllLabel,
}: SectionHeaderProps) => (
  <TouchableOpacity
    style={styles.row}
    activeOpacity={onSeeAll ? 0.6 : 1}
    onPress={onSeeAll}
    disabled={!onSeeAll}
    accessibilityRole={onSeeAll ? 'button' : 'header'}
  >
    <View style={styles.titleGroup}>
      {icon ? (
        <View style={[styles.iconBadge, { backgroundColor: `${iconTint}22` }]}>
          {icon}
        </View>
      ) : null}

      <Text style={styles.title} numberOfLines={1}>{title}</Text>

      {typeof count === 'number' && count > 0 ? (
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{count}</Text>
        </View>
      ) : null}
    </View>

    {onSeeAll ? (
      <View style={styles.seeAll}>
        <Text style={styles.seeAllText}>{seeAllLabel}</Text>
        <ChevronRight size={15} color="#60a5fa" />
      </View>
    ) : null}
  </TouchableOpacity>
));

export default SectionHeader;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SECTION_PADDING_H,
    marginBottom: 12,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  iconBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },
  title: {
    color: '#f8fafc',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  countBadge: {
    marginLeft: 8,
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  countText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    paddingVertical: 4,
    paddingLeft: 8,
  },
  seeAllText: {
    color: '#60a5fa',
    fontSize: 13,
    fontWeight: '600',
  },
});
