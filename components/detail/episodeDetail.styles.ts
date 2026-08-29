import { StyleSheet } from 'react-native';

// AI_RULES §1 (400 satir) — `app/episode/[id].tsx`'ten BIREBIR tasindi.
// Saf stil tanimi, mantik yok. Mobil gorunumde tek bir piksel degismedi.
export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  headerContainer: { width: '100%', height: 350, position: 'relative' },
  stillImage: { width: '100%', height: '100%' },
  stillPlaceholder: { width: '100%', height: '100%', backgroundColor: '#0B1120' },
  gradientOverlay: { ...StyleSheet.absoluteFillObject },
  // `top`/`left`/`right` BİLİNÇLİ OLARAK burada YOK — güvenli alana göre
  // render sırasında veriliyor (bkz. yukarıdaki insets notu).
  backButton: { position: 'absolute', zIndex: 10, padding: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  shareButton: { position: 'absolute', zIndex: 10, padding: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  headerContent: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, zIndex: 5 },
  // Sade breadcrumb: arka plan/kenarlık yok, sadece küçük soluk metin + ok — göze batmaz, isteyen fark edip kullanır.
  showNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 3,
    marginBottom: 5,
  },
  showName: { fontSize: 11, color: 'rgba(148,163,184,0.85)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.7 },
  episodeTitle: { fontSize: 26, fontWeight: 'bold', color: '#fff', marginBottom: 6 },
  episodeIdentifier: { fontSize: 13, color: '#94a3b8', fontWeight: '500', marginBottom: 12 },
  ratingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(250, 204, 21, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(250, 204, 21, 0.2)',
  },
  ratingText: {
    color: '#facc15',
    fontWeight: 'bold',
    fontSize: 13,
    marginLeft: 4,
  },
  // Oy sayısı: puanın yanında ikincil bilgi — daha soluk ve ince, puanı
  // gölgelemesin.
  votesText: {
    color: 'rgba(250, 204, 21, 0.6)',
    fontWeight: '600',
    fontSize: 11,
    marginLeft: 4,
  },
  userRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  userRatingActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  userRatingText: {
    color: '#a3a3a3',
    fontWeight: 'bold',
    fontSize: 13,
    marginLeft: 6,
  },
  userRatingTextActive: {
    color: '#3b82f6',
  },
  progressContainer: { marginTop: 8, width: '100%', maxWidth: 240, flexDirection: 'row', alignItems: 'center' },
  progressBarWrapper: { flex: 1 },
  progressText: { color: '#a3a3a3', fontSize: 12, fontWeight: '600', marginLeft: 8 },
  contentArea: { padding: 16 },
  // Masaustu sol sutununda bloklar arasi dikey ritim + okunabilirlik siniri.
  webBlock: { marginTop: 40 },
  // bkz. app/show/[id].tsx'teki ayni notun gerekcesi.
  webFlush: { marginHorizontal: -16 },
  webOverview: { color: '#cbd5e1', fontSize: 15, lineHeight: 26, maxWidth: 760 },
  section: { marginBottom: 32 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 12 },
  overviewText: { color: '#d4d4d4', fontSize: 15, lineHeight: 24 },
});
