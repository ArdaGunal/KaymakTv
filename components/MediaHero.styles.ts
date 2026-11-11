import { StyleSheet } from 'react-native';
import { MOBILE_PALETTE, nativeTint } from '../constants/mobilePalette';

// F12 — MediaHero.tsx'ten çıkarıldı (400 satır kuralı, AI_RULES §1).
// Saf stil tanımı, mantık yok.
export const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
  },
  backdropContainer: {
    height: 280,
    width: '100%',
    position: 'relative',
  },
  backdropImage: {
    width: '100%',
    height: '100%',
  },
  backdropPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: MOBILE_PALETTE.surface,
  },
  gradientOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 180,
  },
  backButton: {
    position: 'absolute',
    left: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeButton: {
    position: 'absolute',
    right: 64,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionsButton: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    flexDirection: 'row',
    marginTop: -80,
    zIndex: 5,
  },
  progressContainer: {
    marginTop: 16,
    width: '100%',
    maxWidth: 240,
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBarWrapper: {
    flex: 1,
  },
  progressText: {
    color: MOBILE_PALETTE.muted,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
  },
  posterImage: {
    width: 110,
    height: 165,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: MOBILE_PALETTE.border,
  },
  posterPlaceholder: {
    width: 110,
    height: 165,
    borderRadius: 8,
    backgroundColor: MOBILE_PALETTE.surface,
  },
  textContainer: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'flex-end',
    paddingBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: MOBILE_PALETTE.text,
    marginBottom: 4,
  },
  ikincilBaslik: {
    fontSize: 14,
    color: MOBILE_PALETTE.muted,
    marginBottom: 4,
  },
  meta: {
    fontSize: 13,
    color: MOBILE_PALETTE.muted,
    marginBottom: 4,
  },
  genres: {
    fontSize: 13,
    color: MOBILE_PALETTE.muted,
    marginBottom: 12,
  },
  ratingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    rowGap: 8,
    columnGap: 10,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: MOBILE_PALETTE.ratingTint,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: MOBILE_PALETTE.ratingBorder,
  },
  ratingText: {
    color: MOBILE_PALETTE.rating,
    fontWeight: 'bold',
    fontSize: 13,
    marginLeft: 4,
  },
  userRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: MOBILE_PALETTE.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minHeight: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: MOBILE_PALETTE.border,
  },
  // Sadece ikon barındıran rozetler: metin olmadığı için dokunma alanı
  // önerilen 44pt'nin çok altında kalıyordu — biraz genişletildi.
  iconOnlyBadge: {
    minWidth: 32,
    justifyContent: 'center',
  },
  userRatingActive: {
    backgroundColor: nativeTint('primary', 0.1, 'rgba(59, 130, 246, 0.1)'),
    borderColor: nativeTint('primary', 0.3, 'rgba(59, 130, 246, 0.3)'),
  },
  userRatingText: {
    color: MOBILE_PALETTE.muted,
    fontWeight: '500',
    fontSize: 13,
    marginLeft: 4,
  },
  userRatingTextActive: {
    color: MOBILE_PALETTE.rating,
    fontWeight: 'bold',
  },
  watchlistSection: {
    marginTop: 14,
  },
  watchlistBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 46,
    borderRadius: 10,
    backgroundColor: MOBILE_PALETTE.surface,
    borderWidth: 1,
    borderColor: MOBILE_PALETTE.border,
  },
  watchlistBtnActive: {
    backgroundColor: nativeTint('primary', 0.12, 'rgba(59, 130, 246, 0.12)'),
    borderColor: nativeTint('primary', 0.35, 'rgba(59, 130, 246, 0.35)'),
  },
  watchlistBtnText: {
    color: MOBILE_PALETTE.text,
    fontSize: 14,
    fontWeight: '700',
  },
  watchlistBtnTextActive: {
    color: MOBILE_PALETTE.text,
  },
  overviewSection: {
    padding: 16,
    marginTop: 8,
  },
  overviewText: {
    color: MOBILE_PALETTE.body,
    fontSize: 14,
    lineHeight: 22,
  },
});

/** Native ve dar web detaylarının TARDIS renkleri ve film eylem sırası. */
export const nativeStyles = StyleSheet.create({
  backdropContainer: { height: 264 },
  title: { color: MOBILE_PALETTE.text },
  muted: { color: MOBILE_PALETTE.muted },
  ratingBadge: { backgroundColor: MOBILE_PALETTE.ratingTint, borderColor: MOBILE_PALETTE.ratingBorder },
  ratingText: { color: MOBILE_PALETTE.rating },
  userRatingBadge: { backgroundColor: MOBILE_PALETTE.surface, borderColor: MOBILE_PALETTE.border },
  userRatingActive: { backgroundColor: MOBILE_PALETTE.ratingTint, borderColor: MOBILE_PALETTE.ratingBorder },
  userRatingTextActive: { color: MOBILE_PALETTE.rating },
  watchlistBtn: { flex: 1, backgroundColor: MOBILE_PALETTE.surface, borderColor: MOBILE_PALETTE.border },
  watchlistBtnActive: { backgroundColor: MOBILE_PALETTE.primary, borderColor: MOBILE_PALETTE.primary },
  watchlistBtnText: { color: MOBILE_PALETTE.text },
  watchlistBtnTextActive: { color: MOBILE_PALETTE.text },
  movieActions: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  overviewText: { color: MOBILE_PALETTE.text },
});
