import { StyleSheet } from 'react-native';

/**
 * Masaüstü web hero'sunun stilleri. Mobil hero (components/MediaHero.styles.ts)
 * bu dosyadan TAMAMEN bağımsızdır ve DEĞİŞTİRİLMEDİ.
 *
 * Tasarım kararlarının ortak paydası: hiçbir öğe "ekran kadar geniş" değil.
 * Butonlar içeriğe göre büyür (`alignSelf: 'flex-start'`), metin satırları
 * okunabilir uzunlukta kesilir (`maxWidth`), görseller sabit ORANLA çizilir.
 */
export const webHeroStyles = StyleSheet.create({
  // ── Üst araç çubuğu ───────────────────────────────────────────────────
  // Mobildeki yuvarlak, yüzen ikonlar masaüstünde kayboluyordu (kullanıcı
  // "butonların görünmemesi" diye bildirdi): 1600px'lik bir kapak görselinin
  // köşesindeki 40px'lik saydam daire fark edilmiyor. Masaüstünde ETİKETLİ,
  // yüzeyi olan bir çubuk.
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  ghostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(15,23,42,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    cursor: 'pointer',
  } as any,
  ghostIconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(15,23,42,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    cursor: 'pointer',
  } as any,
  ghostButtonText: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '600',
  },

  // ── Afiş + künye ──────────────────────────────────────────────────────
  headRow: {
    flexDirection: 'row',
    gap: 24,
    alignItems: 'flex-start',
  },
  // 🔴 `aspectRatio: 2/3` ZORUNLU (kullanıcı isteği): sabit width+height
  // ikilisi, TMDB'den gelen farklı oranlardaki afişlerde kırpılma/esneme
  // üretiyordu. Oranı çerçeveye yazıp `contentFit="cover"` demek, görseli
  // BOZMADAN ve YARIM BIRAKMADAN doldurmanın tek güvenli yolu.
  poster: {
    width: 200,
    aspectRatio: 2 / 3,
    borderRadius: 14,
    backgroundColor: '#172033',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  headText: {
    flex: 1,
    minWidth: 0,
    paddingTop: 4,
  },
  title: {
    color: '#f8fafc',
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -0.7,
    marginBottom: 8,
  },
  meta: {
    color: '#cbd5e1',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  genres: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 14,
  },

  // ── Aksiyon satırı ────────────────────────────────────────────────────
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    rowGap: 10,
    columnGap: 10,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    cursor: 'pointer',
  } as any,
  pillStatic: { cursor: 'default' } as any,
  pillIconOnly: { width: 40, paddingHorizontal: 0, justifyContent: 'center' },
  pillText: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '600',
  },
  pillRating: {
    backgroundColor: 'rgba(250,204,21,0.10)',
    borderColor: 'rgba(250,204,21,0.22)',
  },
  pillRatingText: { color: '#facc15', fontWeight: '700' },
  pillActive: {
    backgroundColor: 'rgba(59,130,246,0.14)',
    borderColor: 'rgba(59,130,246,0.38)',
  },
  pillActiveText: { color: '#60a5fa', fontWeight: '700' },
  pillFavActive: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderColor: 'rgba(239,68,68,0.32)',
  },

  // 🔴 ASIL ŞİKAYET: mobilde tam genişlikte olan "Takip Et" butonu masaüstünde
  // 1600px'lik bir çubuğa dönüşüyordu. Artık içeriğe göre genişliyor.
  followButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    height: 40,
    minWidth: 168,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#3b82f6',
    borderWidth: 1,
    borderColor: '#3b82f6',
    cursor: 'pointer',
  } as any,
  followButtonActive: {
    backgroundColor: 'rgba(59,130,246,0.14)',
    borderColor: 'rgba(59,130,246,0.42)',
  },
  followButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  followButtonTextActive: { color: '#60a5fa' },

  // ── İlerleme ──────────────────────────────────────────────────────────
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    maxWidth: 320,
  },
  progressBarWrapper: { flex: 1 },
  progressText: { color: '#94a3b8', fontSize: 12, fontWeight: '700' },

  // ── Özet / fragman ────────────────────────────────────────────────────
  // 🔴 Özet artık afişin ALTINDA değil, YANINDA (metin sütununun içinde):
  // 200x300'lük afişin sağında, butonların altında kocaman boş bir alan
  // kalıyordu ("üst ile alt arasında çok fazla boşluk"). Paragrafı oraya
  // taşımak hem boşluğu doldurdu hem sayfayı ~120px kısalttı.
  overview: {
    color: '#cbd5e1',
    fontSize: 15,
    lineHeight: 25,
    marginTop: 16,
    // Okunabilirlik sınırı: kesintisiz akan uzun bir satır göz için takip
    // edilemez hale geliyordu.
    maxWidth: 720,
  },
  sectionTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 12,
  },
  trailerSection: { marginTop: 28 },
  // 🔴 `aspectRatio: 16/9` ZORUNLU: eskiden sabit `height: 180` idi, yani
  // masaüstünde 760x180'lik bir şeride kırpılıyordu.
  // 🔴 620 -> 380 (kullanıcı geri bildirimi: "fragman çok fazla yer
  // kaplıyor"). 16:9'da 380x214 — tanınabilir bir önizleme, sayfayı
  // yutmayan bir kart.
  trailerCard: {
    width: '100%',
    maxWidth: 380,
    aspectRatio: 16 / 9,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#172033',
    cursor: 'pointer',
  } as any,
  trailerImage: { width: '100%', height: '100%' },
  trailerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
