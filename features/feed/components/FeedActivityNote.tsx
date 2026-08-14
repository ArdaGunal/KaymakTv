import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { EyeOff, Pencil } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import NoteFullTextModal from './NoteFullTextModal';

interface FeedActivityNoteProps {
  note: string;
  spoiler: boolean;
  /** Yalnızca kendi aktivitende true — bloğun kendisi tıklanınca düzenleme
   *  modalını açar (bkz. FeedCard.tsx: ayrı bir "Düzenle" butonu YOK,
   *  Twitter'da kendi gönderine dokunma hissi). */
  editable?: boolean;
  onPressEdit?: () => void;
}

/**
 * Kullanıcının kendi aktivitesine eklediği kişisel not/alıntı — Letterboxd/
 * Twitter tarzı: "İzledim" logunun altında bir alıntı gibi gösterilir (bkz.
 * docs/FEED_SOCIAL_PLAN.md). Trakt'ın kendi yorum sistemiyle KARIŞTIRILMASIN,
 * bu tamamen KaymakTV'ye özel. Bağımsız gönderilerin ("Fikir Paylaş", bkz.
 * 017_feed_posts.sql) ana metni de AYNI bileşenle gösterilir — ikisi de aynı
 * `note` alanına yazılır, tekrar bir bileşen yazmaya gerek yok.
 *
 * GÖRSEL HİYERARŞİ (kullanıcı geri bildirimi): bu, kartın BİRİNCİL içeriği —
 * "X izledi" satırı FeedCard.tsx'te bunun ALTINA, küçük/soluk bir bağlam
 * satırına iniyor (Twitter'ın Alıntı Tweet'i: senin yazdığın büyük/üstte,
 * alıntıladığın içerik küçük/altta). Önceki sürüm tam tersiydi (italik,
 * soluk) — kullanıcı kendi yazdığı alıntının "izledi" satırından daha
 * SİLİK göründüğünü belirtti, bilerek düzeltildi: italik kaldırıldı, punto/
 * ağırlık/renk kartın en göz alıcı metni olacak şekilde yükseltildi.
 *
 * UZUN METİN ("Devamını Gör"): `note` artık 1000 karaktere kadar olabilir
 * (bkz. 017) — kart akışta yer kaplamasın diye 4 satırla kesilir, kesilip
 * kesilmediği GERÇEK satır sayımıyla DEĞİL (RN Web'de `onTextLayout` tutarsız
 * ateşleyebiliyor) basit bir karakter uzunluğu eşiğiyle kararlaştırılır —
 * kesin değil ama güvenilir ve platformdan bağımsız. Kesilmişse küçük bir
 * "Devamını Gör" linki tam metni gösteren küçük bir modal açar (tüm sayfayı
 * kaplamaz, kullanıcının isteği).
 *
 * Spoiler varsayılan olarak bulanık/gizli — dokununca açılır. Açma durumu
 * BİLİNÇLİ OLARAK kalıcı değil (yalnızca bileşen state'i): kart yeniden
 * mount olduğunda (ör. sekmeler arası geçiş) tekrar kapalı başlar, sunucuya
 * hiçbir "gördüm" bilgisi gönderilmez.
 */
const TRUNCATE_CHAR_THRESHOLD = 220;

export default function FeedActivityNote({ note, spoiler, editable = false, onPressEdit }: FeedActivityNoteProps) {
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
      <Text style={styles.note} numberOfLines={isLong ? 4 : undefined}>
        {note}
      </Text>
      {editable && <Pencil size={11} color="#475569" style={styles.editIcon} />}
    </View>
  );

  return (
    <>
      {editable ? (
        <TouchableOpacity activeOpacity={0.75} onPress={onPressEdit}>
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
  editIcon: {
    marginLeft: 4,
    marginTop: 4,
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
