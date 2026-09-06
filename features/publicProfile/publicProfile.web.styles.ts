import { StyleSheet } from 'react-native';

/**
 * `app/(protected)/user/[slug].web.tsx`'in stilleri.
 *
 * ⚠️ AYRI DOSYA OLMASININ SEBEBİ satır sayısı DEĞİL, `AI_RULES.md`'deki
 * ölçüte göre KOD sayısı: dosya 544 satır / **513 KOD** ile "🔴 BÖL,
 * tartışma yok" eşiğinin üstündeydi. StyleSheet tek başına 251 satır
 * tutuyordu ve TEK bir sorumluluğu vardı (çizim), yani ayrılması kodu
 * dağıtmıyor — topluyor.
 *
 * 📏 Aynı teknik Madde 218'de üç dosyada uygulandı (`download.web.tsx`,
 * `index.web.tsx`, `MediaHero.tsx`): orada da StyleSheet'i taşımak TEK
 * BAŞINA yetmişti.
 *
 * 🔴 NEDEN `app/` ALTINDA DEĞİL — ölçüldü, varsayılmadı. Önce ekranın
 * yanına (`app/(protected)/user/[slug].web.styles.ts`) kondu ve tarayıcı
 * şunu bastı:
 *
 *   Route "./(protected)/user/[slug].web.styles.ts" is missing the
 *   required default export.
 *
 * expo-router `app/` altındaki HER dosyayı bir ROTA sayıyor. Projedeki
 * mevcut yedi `.styles.ts` dosyasının hepsi zaten `app/` DIŞINDA
 * (`components/…`) — kural yazılı değildi ama uygulanıyordu. Burası
 * seçildi çünkü bu ekranın kancaları da `features/publicProfile/` altında.
 */

export const styles = StyleSheet.create({
  pageBackground: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    width: '100%',
    maxWidth: 720,
    marginHorizontal: 'auto' as any,
    paddingHorizontal: 24,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingRight: 10,
    ...({ cursor: 'pointer' } as any),
  },
  backButtonText: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '600',
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    backgroundColor: '#172033',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#22304A',
    padding: 24,
    marginBottom: 24,
  },
  skeletonIdentity: {
    gap: 8,
    flex: 1,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#1e293b',
    borderWidth: 2,
    borderColor: 'rgba(59,130,246,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: 'rgba(59,130,246,0.4)',
  },
  avatarText: {
    color: '#94a3b8',
    fontWeight: '700',
    fontSize: 30,
  },
  identityCol: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  handle: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '500',
  },
  bio: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
  },
  statItem: {
    alignItems: 'center',
    minWidth: 50,
  },
  statValue: {
    color: '#f1f5f9',
    fontSize: 16,
    fontWeight: '800',
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 11,
    minWidth: 130,
    justifyContent: 'center',
    flexShrink: 0,
    ...({ cursor: 'pointer' } as any),
  },
  followingBtn: {
    backgroundColor: 'rgba(74, 222, 128, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.35)',
  },
  pendingBtn: {
    backgroundColor: 'rgba(250, 204, 21, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(250, 204, 21, 0.3)',
  },
  followBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  followingBtnText: {
    color: '#4ade80',
    fontSize: 13,
    fontWeight: '700',
  },
  pendingBtnText: {
    color: '#facc15',
    fontSize: 13,
    fontWeight: '700',
  },
  feedColumn: {
    width: '100%',
  },
  errorState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  errorText: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 40,
    gap: 8,
  },
  emptyTitle: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 6,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  // Akış/Profil ekranlarındaki hata durumu retry butonuyla AYNI görsel dil.
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 100,
    backgroundColor: '#172033',
    borderWidth: 1,
    borderColor: '#22304A',
  },
  retryButtonText: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '700',
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#22304A',
    marginBottom: 20,
    width: '100%',
  },
  tab: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#3b82f6',
  },
  tabText: {
    color: '#94a3b8',
    fontSize: 15,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#f8fafc',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    marginHorizontal: -6, // SPACING / 2 compensation
  },
  gridCard: {
    backgroundColor: '#172033',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#22304A',
  },
  poster: {
    width: '100%',
    height: '100%',
  },
});
