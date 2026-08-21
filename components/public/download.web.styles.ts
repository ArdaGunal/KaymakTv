import { StyleSheet, Platform } from 'react-native';

// F12 — download.web.tsx'ten çıkarıldı (400 satır kuralı, AI_RULES §1).
// Saf stil tanımı, mantık yok.
//
// ⚠️ BURADA, `components/` ALTINDA durmasının sebebi (`app/(public)/`
// DEĞİL): Expo Router `app/` altındaki HER dosyayı olası bir route sanıp
// tarıyor — `.web.` içeren bir dosya adı platform-özel bir route sanılıp
// "fallback sibling" (örn. `download.styles.ts`) aranıyor, bulunamayınca
// TÜM uygulama beyaz ekranla çöküyordu (canlıda bulundu, 2026-08-21).
// `MediaHero.styles.ts`/`ReportIssueModal.styles.ts` aynı F12 turunda zaten
// `components/` altına taşınmıştı — bu dosya da aynı kurala uydurulmalıydı.
export const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    minHeight: '100vh' as any,
    backgroundColor: '#0B1120',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 36,
    paddingHorizontal: 20,
    position: 'relative',
  },

  // Ortam Işıkları
  ambientGlowTop: {
    position: 'absolute',
    top: -100,
    width: 600,
    height: 400,
    borderRadius: 300,
    backgroundColor: 'rgba(59, 130, 246, 0.04)',
    ...(Platform.OS === 'web' ? ({ filter: 'blur(120px)', pointerEvents: 'none' } as any) : {}),
  },
  ambientGlowTopDesktop: {
    position: 'absolute',
    top: -160,
    left: '25%' as any,
    width: 800,
    height: 450,
    borderRadius: 400,
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
    ...(Platform.OS === 'web' ? ({ filter: 'blur(150px)', pointerEvents: 'none' } as any) : {}),
  },
  ambientGlowBottom: {
    position: 'absolute',
    bottom: -100,
    width: 500,
    height: 350,
    borderRadius: 250,
    backgroundColor: 'rgba(34, 211, 238, 0.03)',
    ...(Platform.OS === 'web' ? ({ filter: 'blur(120px)', pointerEvents: 'none' } as any) : {}),
  },
  ambientGlowBottomDesktop: {
    position: 'absolute',
    bottom: -140,
    right: '20%' as any,
    width: 600,
    height: 400,
    borderRadius: 300,
    backgroundColor: 'rgba(34, 211, 238, 0.04)',
    ...(Platform.OS === 'web' ? ({ filter: 'blur(150px)', pointerEvents: 'none' } as any) : {}),
  },

  // Navigasyon Barı
  navbar: {
    width: '100%',
    maxWidth: 520,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
    zIndex: 10,
  },
  navbarDesktop: {
    maxWidth: 1040,
  },
  brandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  logoBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    color: '#f8fafc',
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  brandSub: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  navRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  webAppLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.18)',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  webAppLinkText: {
    color: '#93c5fd',
    fontSize: 13,
    fontWeight: '600',
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  backLinkText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },

  // Ana İçerik Konteyneri & Layout
  mainWrapper: {
    width: '100%',
    maxWidth: 520,
    zIndex: 10,
  },
  mainWrapperDesktop: {
    maxWidth: 1040,
  },
  heroCard: {
    width: '100%',
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 28,
    alignItems: 'center',
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(24px)',
          boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.4)',
        } as any)
      : {}),
  },
  heroCardDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 40,
    gap: 40,
  },

  // Sütunlar
  singleColumn: {
    width: '100%',
    alignItems: 'center',
  },
  leftColumn: {
    flex: 1,
    width: '50%',
    alignItems: 'flex-start',
  },
  rightColumn: {
    flex: 1,
    width: '50%',
    alignItems: 'flex-start',
  },

  // Sade Kategori Rozeti
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.18)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 100,
    marginBottom: 24,
  },
  categoryBadgeText: {
    color: '#60a5fa',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  // Header bölümü
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    width: '100%',
    marginBottom: 24,
  },
  appHeaderDesktop: {
    gap: 20,
    marginBottom: 26,
  },
  appIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.25)',
  },
  appIconContainerDesktop: {
    width: 76,
    height: 76,
    borderRadius: 22,
  },
  appIconGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appTitleContainer: {
    flex: 1,
  },
  appTitle: {
    color: '#f8fafc',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  appTitleDesktop: {
    fontSize: 30,
    letterSpacing: -0.7,
  },
  appSubtitle: {
    color: '#94a3b8',
    fontSize: 13.5,
    marginTop: 4,
  },
  appSubtitleDesktop: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 5,
  },

  // İndirme Butonu
  downloadButtonWrapper: {
    width: '100%',
    borderRadius: 16,
    marginBottom: 24,
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
        } as any)
      : {}),
  },
  downloadButtonWrapperDesktop: {
    marginBottom: 26,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.25)',
  },
  downloadButtonDesktop: {
    paddingVertical: 18,
    paddingHorizontal: 22,
    gap: 16,
  },
  buttonIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIconCircleDesktop: {
    width: 48,
    height: 48,
    borderRadius: 14,
  },
  buttonTextContainer: {
    flex: 1,
  },
  downloadButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  downloadButtonTextDesktop: {
    fontSize: 18,
    fontWeight: '700',
  },
  downloadButtonSubtext: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 12,
    marginTop: 2,
  },

  // Meta Bilgi Izgarası
  metaGrid: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
    marginBottom: 24,
  },
  metaCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 14,
    padding: 11,
  },
  clickableMetaCard: {
    backgroundColor: 'rgba(59, 130, 246, 0.06)',
    borderColor: 'rgba(59, 130, 246, 0.2)',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  metaCardTextWrapper: {
    flex: 1,
  },
  metaLabel: {
    color: '#64748b',
    fontSize: 10.5,
    fontWeight: '600',
  },
  metaValue: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 1,
  },
  metaValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  metaValueLink: {
    color: '#60a5fa',
    fontSize: 12,
    fontWeight: '700',
  },

  // Masaüstü Ek Bilgi Kutusu
  desktopTrustBox: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 18,
    marginTop: 4,
  },
  trustBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  trustBoxTitle: {
    color: '#e2e8f0',
    fontSize: 13.5,
    fontWeight: '700',
  },
  trustBoxDesc: {
    color: '#94a3b8',
    fontSize: 12.5,
    lineHeight: 19,
  },

  // Sürüm Notları
  changelogCard: {
    width: '100%',
    backgroundColor: 'rgba(23, 32, 51, 0.5)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    padding: 20,
    marginBottom: 20,
  },
  changelogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  changelogTitle: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  changelogList: {
    gap: 11,
  },
  changelogRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  checkIcon: {
    marginTop: 2,
  },
  changelogText: {
    flex: 1,
    color: '#cbd5e1',
    fontSize: 13.5,
    lineHeight: 20,
  },

  // Adım Adım Kurulum Rehberi
  guideContainer: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  guideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  guideTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  guideTitle: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '700',
  },
  guideContent: {
    paddingHorizontal: 18,
    paddingBottom: 18,
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.04)',
    paddingTop: 16,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepNumberBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumberText: {
    color: '#60a5fa',
    fontSize: 12.5,
    fontWeight: '700',
  },
  stepTextContainer: {
    flex: 1,
  },
  stepHeading: {
    color: '#f1f5f9',
    fontSize: 13.5,
    fontWeight: '700',
    marginBottom: 2,
  },
  stepDesc: {
    color: '#94a3b8',
    fontSize: 12.5,
    lineHeight: 18,
  },

  // Footer Note
  footerNote: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 20,
  },
});
