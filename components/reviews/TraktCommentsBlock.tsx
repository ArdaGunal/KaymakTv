import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CommentData } from '../../hooks/useComments';
import TraktCommentRow from './TraktCommentRow';

/**
 * Yorumlar bölümünün **Trakt kuyruğu** — salt okunur önizleme.
 *
 * `MediaCommentsSection`'ın altında, yumuşak bir ayraçtan sonra akar. Ayrı
 * dosya olmasının sebebi yalnızca boyut değil: burada **tek bir sorumluluk**
 * var — "başka bir kaynaktan gelen yorumları göster ve kendi listemizle
 * çakışanları ele".
 *
 * ⚠️ SLUG TEKİLLEŞTİRMESİ (S7) BURADA: Aynı kişinin hem KaymakTV incelemesi
 * hem Trakt yorumu olabilir; tek listede yan yana görünmeleri "çift kayıt"
 * gibi durur. Eşleştirme anahtarı iki tarafta da HAZIR — bizde
 * `users.trakt_slug`, Trakt'ta `comment.user.ids.slug` — bu yüzden eleme tek
 * bir `Set.has()`, ek istek YOK.
 *
 * Yan fayda: kullanıcı KaymakTV'den yazdığı an Trakt'taki eski yorumu listeden
 * düşer, "hangisi güncel" belirsizliği oluşmaz.
 */

const PREVIEW_LIMIT = 3;

interface TraktCommentsBlockProps {
  comments?: CommentData[];
  isLoading?: boolean;
  /**
   * Kendi listemizdeki yazarların Trakt slug'ları — tekilleştirme için.
   * `MediaCommentsSection` besler (iki veri kümesinin buluştuğu tek yer orası).
   */
  excludeSlugs: Set<string>;
  /** "Tümünü Gör" — Trakt'ın kendi sheet'i (sayfalama + sıralama orada). */
  onSeeAll?: () => void;
}

export default function TraktCommentsBlock({
  comments,
  isLoading,
  excludeSlugs,
  onSeeAll,
}: TraktCommentsBlockProps) {
  const { t } = useTranslation('media');

  // Yükleniyorsa: kendi bloğumuz ZATEN çizildi, burada yalnızca küçük bir
  // spinner. Ekranın tamamı bunu beklemiyor (S12).
  if (isLoading) {
    return <ActivityIndicator size="small" style={styles.loader} />;
  }
  if (!comments || comments.length === 0) return null;

  const deduped = comments.filter((c) => {
    const slug = c.user?.ids?.slug;
    return !slug || !excludeSlugs.has(slug);
  });
  if (deduped.length === 0) return null;

  // Spoiler'lılar önizlemede gösterilmiyor (mevcut davranış korundu) — perde
  // yine de `TraktCommentRow`'da var, "Tümünü Gör"de görünürler.
  const preview = deduped.filter((c) => !c.spoiler).slice(0, PREVIEW_LIMIT);

  return (
    <View>
      {/* Ayraç bir SEKME DEĞİL — ince çizgi + ortada etiket. Kullanıcı
          kaydırmaya devam eder, "başka bir yere geçtim" hissetmez
          (docs/REVIEWS_PLAN.md §7). */}
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerLabel}>
          {t('traktCommunityTitle', 'Trakt topluluğundan')}
        </Text>
        <View style={styles.dividerLine} />
      </View>

      {preview.length > 0 ? (
        preview.map((c) => <TraktCommentRow key={c.id} comment={c} onPress={onSeeAll} />)
      ) : (
        <Text style={styles.emptyText}>{t('allSpoilers')}</Text>
      )}

      {onSeeAll && deduped.length > preview.length && (
        <TouchableOpacity style={styles.seeAllBtn} onPress={onSeeAll} activeOpacity={0.8}>
          <Text style={styles.seeAllText}>{t('seeAllCount', { count: deduped.length })}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
    marginBottom: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#1e293b',
  },
  dividerLabel: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '600',
  },
  loader: {
    marginTop: 20,
  },
  emptyText: {
    color: '#475569',
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 14,
  },
  seeAllBtn: {
    marginTop: 8,
    paddingVertical: 11,
    backgroundColor: '#172033',
    borderRadius: 8,
    alignItems: 'center',
  },
  seeAllText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
});
