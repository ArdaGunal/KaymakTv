/**
 * MarathonFeedCard — Gruplanmış Maraton Aktivitesi Kartı
 *
 * Normal FeedCard'ın yanında gösterilen özel kart.
 * Kullanıcının aynı diziden art arda (< 12h aralıklarla) izlediği ≥2 bölümü
 * tek, zengin bir kart olarak temsil eder.
 *
 * Tasarım:
 * - Sol:  Kullanıcı avatarı (baş harf), level renginde kenarlık
 * - Orta: Seviye rozeti + dinamik başlık + dizi · bölüm aralığı + zaman
 * - Sağ:  Büyük "×N bölüm" sayacı (accent renginde)
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Zap } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import MediaPoster from '../../../components/MediaPoster';
import { MarathonActivity } from '../types';
import { getMarathonMessage } from '../utils/marathonMessages';
import { formatRelativeTime } from '../../../utils/formatRelativeTime';
import { buildMediaHref } from '../utils/feedNavigation';
import { useMyTraktSlug } from '../hooks/useMyTraktSlug';
import { useQuickBlock } from '../hooks/useQuickBlock';
import { useAuth } from '../../../context/AuthContext';
import CardMenu from './CardMenu';

interface MarathonFeedCardProps {
  activity: MarathonActivity;
  /** Akış VE Profil › Aktiviteler'in İKİSİ de geçer — bkz. FeedCard.tsx'teki
   *  aynı prop. Yalnızca "Sil" — maraton kartının tek bir notu/kalıcı linki
   *  olmadığı için (sentetik bir gruplama, gerçek bir feed_activities satırı
   *  değil) Düzenle/Paylaş burada hiç YOK, bkz. docs/HISTORY.md Madde 156. */
  onDeleteActivity?: () => void | Promise<void>;
}

export default function MarathonFeedCard({ activity, onDeleteActivity }: MarathonFeedCardProps) {
  const { t } = useTranslation('feed');
  const router = useRouter();
  const myTraktSlug = useMyTraktSlug();
  const { accessToken, isGuest } = useAuth();
  const { blockUserQuick } = useQuickBlock();
  // "Hayalet silme" düzeltmesi (bkz. docs/HISTORY.md) — FeedCard.tsx'teki
  // AYNI kontrol, buradan hiç kopyalanmamıştı: "Sil" yalnızca kendi
  // maratonunda görünmeli. Sunucu tarafı (Worker `handleFeedDelete`, WHERE
  // user_id = doğrulanan kullanıcı) başkasının satırını zaten SİLEMİYORDU —
  // ama istemci iyimser olarak kartı yine de kendi ekranından kaldırıyordu,
  // "sildim" yanılsaması yaratıyordu.
  const isOwnActivity = !!myTraktSlug && myTraktSlug === activity.user.traktSlug;
  const message = getMarathonMessage(activity.user.username, activity.episodeCount);
  const initial = activity.user.username.charAt(0).toUpperCase();

  const handlePressProfile = () => {
    // bkz. FeedCard.tsx'teki AYNI düzeltme notu — takip durumu (followStore)
    // kanonik `slug`'a göre anahtarlanıyor, username'e göre değil.
    router.push(`/user/${activity.user.traktSlug || activity.user.username}`);
  };

  // bkz. utils/feedNavigation.ts — dizi/film ayrımına göre doğru rota.
  // (Maraton her zaman dizidir ama yönlendirme mantığı tek yerde tutuluyor.)
  const handlePressShow = () => router.push(buildMediaHref(activity) as any);

  // Hex rengine opaklık katmak için basit yardımcı (inline stil gerektiğinde)
  const colorAlpha = (hex: string, alpha: string) => `${hex}${alpha}`;

  const card = (
    <View style={[styles.card, { borderColor: colorAlpha(message.color, '2e') }]}>
      <CardMenu
        onDelete={isOwnActivity ? onDeleteActivity : undefined}
        // Rapor YOK: maraton kartı gerçek bir feed_activities satırı değil,
        // birden çok bölüm-izlemenin sentetik gruplaması (bkz. yukarıdaki
        // dosya başı notu) — tek bir target_id'ye bildirilemez. Engelleme ise
        // kullanıcı KİMLİĞİ üzerinden çalıştığı için sorunsuz.
        onBlock={
          !isOwnActivity && accessToken && !isGuest
            ? () => blockUserQuick(activity.user.traktSlug)
            : undefined
        }
        style={styles.menuTrigger}
      />

      {/* ── Sol: Avatar ──────────────────────────────────────────────────── */}
      <TouchableOpacity activeOpacity={0.7} onPress={handlePressProfile}>
        <View style={[styles.avatar, { borderColor: colorAlpha(message.color, '55') }]}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
      </TouchableOpacity>

      {/* ── Orta: İçerik ─────────────────────────────────────────────────── */}
      <View style={styles.body}>
        {/* Seviye rozeti */}
        <View style={[styles.badge, { backgroundColor: colorAlpha(message.color, '1a') }]}>
          <Zap size={9} color={message.color} fill={message.color} />
          <Text style={[styles.badgeText, { color: message.color }]}>
            {message.badge}
          </Text>
        </View>

        {/* Dinamik başlık (marathonMessages'tan gelir) */}
        <TouchableOpacity activeOpacity={0.7} onPress={handlePressProfile}>
          <Text style={styles.headline} numberOfLines={2}>
            {message.headline}
          </Text>
        </TouchableOpacity>

        {/* Dizi adı (tıklanabilir → dizi sayfası) + bölüm aralığı */}
        <Text style={styles.subtitle} numberOfLines={1}>
          <Text style={styles.showNameLink} onPress={handlePressShow}>
            {activity.showTitle}
          </Text>
          {activity.episodeCount > 1
            ? ` • ${activity.episodeRange} arası izlendi`
            : ` • ${activity.firstEpisode} izlendi`}
        </Text>

        {/* Göreceli zaman */}
        <Text style={styles.timestamp}>{formatRelativeTime(activity.activityAt, t)}</Text>
      </View>

      {/* ── Sağ: Poster + Bölüm Sayacı rozeti ────────────────────────────── */}
      <TouchableOpacity activeOpacity={0.8} onPress={handlePressShow} style={styles.posterWrap}>
        <MediaPoster
          tmdbId={activity.tmdbId}
          type="show"
          title={activity.showTitle}
          style={styles.poster}
          placeholderTextLines={2}
        />
        <View style={[styles.counterBadge, { backgroundColor: colorAlpha(message.color, 'e6') }]}>
          <Text style={styles.counterBadgeText}>×{activity.episodeCount}</Text>
        </View>
      </TouchableOpacity>
    </View>
  );

  return card;
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131f35',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    gap: 12,
  },
  // ── Avatar ──────────────────────────────────────────────────────────────
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    color: '#94a3b8',
    fontWeight: '700',
    fontSize: 15,
  },
  // ── Gövde ────────────────────────────────────────────────────────────────
  body: {
    flex: 1,
    gap: 3,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
    marginBottom: 2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  headline: {
    color: '#f1f5f9',
    fontSize: 13.5,
    fontWeight: '700',
    lineHeight: 19,
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 17,
  },
  showNameLink: {
    color: '#e2e8f0',
    fontWeight: '700',
  },
  timestamp: {
    color: '#475569',
    fontSize: 11,
    marginTop: 2,
  },
  menuTrigger: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 1,
  },
  // ── Sağ: Poster + sayaç rozeti ───────────────────────────────────────────
  posterWrap: {
    flexShrink: 0,
    position: 'relative',
  },
  poster: {
    width: 44,
    height: 62,
    borderRadius: 8,
    backgroundColor: '#0B1120',
  },
  // Sayaç posterin üstünde bir rozet: hem bölüm sayısını korur hem de
  // kartın görsel ağırlığını postere taşır (sosyal akış hissi).
  counterBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 100,
    borderWidth: 1.5,
    borderColor: '#131f35',
  },
  counterBadgeText: {
    color: '#0B1120',
    fontSize: 10,
    fontWeight: '800',
  },
});
