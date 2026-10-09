import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { EyeOff } from '../../../components/icons';
import { useTranslation } from 'react-i18next';
import NoteFullTextModal from './NoteFullTextModal';

interface FeedActivityNoteProps {
  note: string;
  spoiler: boolean;
  /** C4 · Yazıya dokunma — inceleme ise yapım sayfasındaki o incelemeye,
   *  değilse detay sayfasına (karar FeedCard'ın değil `useActivityActions.openText`'in).
   *  Eskiden kendi notuna dokunmak düzenleme açıyordu; düzenleme artık menüde
   *  («Düzenle») — kullanıcı kararı: «yoruma basınca yoruma gider». */
  onPressText?: () => void;
}

const TRUNCATE_CHAR_THRESHOLD = 220;

export default function FeedActivityNote({ note, spoiler, onPressText }: FeedActivityNoteProps) {
  const { t } = useTranslation('feed');
  const [revealed, setRevealed] = useState(!spoiler);
  const [fullTextVisible, setFullTextVisible] = useState(false);
  const isLong = note.length > TRUNCATE_CHAR_THRESHOLD;

  if (!revealed) {
    // İlk dokunuş HER ZAMAN spoiler'ı açar — sahibi bile olsa, "düzenle"ye
    // yanlışlıkla değil bilerek girsin diye ayrı bir adım.
    return (
      <TouchableOpacity activeOpacity={0.7} onPress={() => setRevealed(true)} style={styles.spoilerWrap}>
        <EyeOff size={12} color="#64748b" />
        <Text style={styles.spoilerText}>{t('spoilerReveal', 'Spoiler var — görmek için dokun')}</Text>
      </TouchableOpacity>
    );
  }

  // NOT: Büyük tipografik tırnak işareti ('"') kaldırıldı — kullanıcı geri
  // bildirimi "kaba duruyor" idi. Sol mavi kenarlık tek başına "bu vurgulu/
  // alıntılanmış bir içerik" sinyalini yeterince veriyor, ekstra bir glif
  // gerekmiyor.
  const textBlock = (
    <View style={styles.wrap}>
      <Text style={styles.note} numberOfLines={isLong ? 4 : undefined} selectable>
        {note}
      </Text>
    </View>
  );

  return (
    <>
      {onPressText ? (
        <TouchableOpacity activeOpacity={0.75} onPress={onPressText}>
          {textBlock}
        </TouchableOpacity>
      ) : (
        textBlock
      )}

      {/* "Devamını Gör" — düzenleme dokunuşuyla ÇAKIŞMASIN diye AYRI, kardeş
          bir dokunma hedefi (içine gömülü değil). */}
      {isLong && (
        <TouchableOpacity onPress={() => setFullTextVisible(true)} hitSlop={6} style={styles.readMoreBtn}>
          <Text style={styles.readMoreText}>{t('readMore', 'Devamını gör')}</Text>
        </TouchableOpacity>
      )}

      <NoteFullTextModal visible={fullTextVisible} text={note} onClose={() => setFullTextVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
    paddingLeft: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  // Kartın en göz alıcı metni — büyük, dolgun renk, italik DEĞİL (italik
  // "ikincil/aside" hissi veriyordu, birincil içerik böyle görünmemeli).
  note: {
    flex: 1,
    color: '#f1f5f9',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  readMoreBtn: {
    alignSelf: 'flex-start',
    marginTop: 2,
    paddingLeft: 10,
  },
  readMoreText: {
    color: '#60a5fa',
    fontSize: 12,
    fontWeight: '700',
  },
  spoilerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  spoilerText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
  },
});
