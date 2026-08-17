import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Heart, EyeOff } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { CommentData } from '../../hooks/useComments';

/**
 * Trakt topluluğundan gelen TEK bir yorum — **SALT OKUNUR**.
 *
 * ⚠️ `ReviewItem.tsx` ile neden ayrı bileşen: ikisi farklı veri tipi taşıyor
 * (`CommentData` vs `FeedActivity`) ve daha önemlisi **etkileşim yüzeyleri
 * tamamen ayrık**. Bu satırda beğen/yanıtla/menü YOKTUR — çünkü:
 *   - Beğeni Trakt'ta yaşar, bizim `feed_activity_likes` tablomuzda değil
 *   - Yanıt Trakt'a gitmez (kullanıcı kararı, bkz. docs/REVIEWS_PLAN.md v2)
 * Bir `variant` prop'uyla tek bileşende birleştirmek, aksiyon satırının
 * tamamını koşullu hale getirip ikisini de okunmaz yapardı. Emsal: projede
 * `FeedCommentItem` ve `ReviewItem` de aynı gerekçeyle ayrı duruyor.
 *
 * **Buton yokluğu bilinçli bir SİNYALDİR:** kullanıcı dokunacak bir şey
 * göremeyince bu satırın "başka bir yerden geldiğini" ayrıca okumaya gerek
 * kalmadan anlar. Bu yüzden burada disabled/gri buton da GÖSTERMİYORUZ —
 * öyle olsaydı "bozuk" sanılırdı (docs/REVIEWS_PLAN.md §7).
 */

interface TraktCommentRowProps {
  comment: CommentData;
  /** Trakt'ın kendi yorum detayına/yanıtlarına götüren salt-okuma sheet'i. */
  onPress?: () => void;
}

export default function TraktCommentRow({ comment, onPress }: TraktCommentRowProps) {
  const { t } = useTranslation(['media', 'feed']);
  const [revealed, setRevealed] = useState(!comment.spoiler);

  const username = comment.user?.username || comment.user?.name || 'Kullanıcı';
  const initial = username.charAt(0).toUpperCase();

  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={onPress ? 0.7 : 1}
      onPress={onPress}
      // Ölü uç olmasın: dokunma Trakt yorum detayını açar. `onPress`
      // verilmezse dokunma tamamen pasif.
      disabled={!onPress}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initial}</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.headerRow}>
          <Text style={styles.username} numberOfLines={1}>
            {username}
          </Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>TRAKT</Text>
          </View>
          {/* Beğeni SAYISI gösteriliyor ama TIKLANAMAZ — bilgi, aksiyon değil. */}
          {comment.likes > 0 && (
            <View style={styles.likeInfo}>
              <Heart size={11} color="#64748b" />
              <Text style={styles.likeCount}>{comment.likes}</Text>
            </View>
          )}
        </View>

        {revealed ? (
          <Text style={styles.text} numberOfLines={4}>
            {comment.comment}
          </Text>
        ) : (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setRevealed(true)}
            style={styles.spoilerWrap}
          >
            <EyeOff size={11} color="#64748b" />
            <Text style={styles.spoilerText}>
              {t('feed:spoilerReveal', 'Spoiler var — görmek için dokun')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

// Palet BİLİNÇLİ olarak ReviewItem'dan bir ton SÖNÜK — "başka bir kaynaktan"
// hissi versin ama devre dışı görünmesin.
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#131c2e',
    borderWidth: 1,
    borderColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    color: '#64748b',
    fontWeight: '700',
    fontSize: 12,
  },
  body: {
    flex: 1,
    gap: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  username: {
    color: '#94a3b8',
    fontWeight: '600',
    fontSize: 13,
    flexShrink: 1,
  },
  badge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: 'rgba(148,163,184,0.12)',
  },
  badgeText: {
    color: '#64748b',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  likeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 'auto',
  },
  likeCount: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
  },
  text: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 19,
  },
  spoilerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 8,
    backgroundColor: '#131c2e',
    borderRadius: 8,
    marginTop: 2,
  },
  spoilerText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
  },
});
