import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Download,
  Smartphone,
  Sparkles,
  CheckCircle2,
  Tv,
  ArrowLeft,
  FileCheck,
  Cpu,
  ChevronDown,
  ChevronUp,
  Globe,
  Info,
  ExternalLink,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { APK_DOWNLOAD_URL, GITHUB_RELEASES_URL } from '../../utils/constants';

// APK bilgileri — Sürüm notları GitHub API'den dinamik çekilir
const CURRENT_VERSION = 'v2.0.0';
const APK_SIZE = '~87 MB';

const DESKTOP_BREAKPOINT = 868;

export default function DownloadScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;

  // Masaüstünde kurulum rehberi varsayılan olarak açık tutulur
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // GitHub'dan dinamik sürüm notları
  const [releaseNotes, setReleaseNotes] = useState<string>('');
  const [isLoadingNotes, setIsLoadingNotes] = useState(true);
  const [notesError, setNotesError] = useState<string | null>(null);

  // GitHub Releases API'sinden beta sürüm notlarını çek
  useEffect(() => {
    const fetchReleaseNotes = async () => {
      try {
        const response = await fetch(
          'https://api.github.com/repos/ArdaGunal/KaymakTv/releases/tags/beta'
        );

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        setReleaseNotes(data.body || '');
        setNotesError(null);
      } catch (err) {
        console.error('Sürüm notları çekilemedi:', err);
        setNotesError('Sürüm notlarına GitHub üzerinden ulaşabilirsiniz.');
        setReleaseNotes('');
      } finally {
        setIsLoadingNotes(false);
      }
    };

    fetchReleaseNotes();
  }, []);

  const handleDownload = () => {
    Linking.openURL(APK_DOWNLOAD_URL).catch((e) => console.error('APK linki açılamadı:', e));
  };

  const handleOpenGithubRelease = () => {
    Linking.openURL(GITHUB_RELEASES_URL).catch((e) => console.error('GitHub Release linki açılamadı:', e));
  };

  const handleGoHome = () => {
    router.push('/');
  };

  const showGuide = isDesktop || isGuideOpen;

  return (
    <View style={styles.outerContainer}>
      {/* Arka plan ortam ışığı - yumuşatılmış ve göz yormayan */}
      <View style={isDesktop ? styles.ambientGlowTopDesktop : styles.ambientGlowTop} />
      <View style={isDesktop ? styles.ambientGlowBottomDesktop : styles.ambientGlowBottom} />

      {/* Üst Navigasyon Barı */}
      <View style={[styles.navbar, isDesktop && styles.navbarDesktop]}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleGoHome}
          style={styles.brandButton}
        >
          <View style={styles.logoBadge}>
            <Tv size={18} color="#60a5fa" />
          </View>
          <View>
            <Text style={styles.brandTitle}>KaymakTV</Text>
            <Text style={styles.brandSub}>Android İndirme Merkezi</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.navRightGroup}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleGoHome}
            style={styles.webAppLink}
          >
            <Globe size={15} color="#60a5fa" />
            <Text style={styles.webAppLinkText}>Web Sürümüne Git</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleGoHome}
            style={styles.backLink}
          >
            <ArrowLeft size={16} color="#94a3b8" />
            <Text style={styles.backLinkText}>Ana Sayfa</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Ana İçerik Konteyneri */}
      <View style={[styles.mainWrapper, isDesktop && styles.mainWrapperDesktop]}>
        <View style={[styles.heroCard, isDesktop && styles.heroCardDesktop]}>

          {/* MASAÜSTÜ SOL SÜTUN / MOBİL ÜST KISIM */}
          <View style={isDesktop ? styles.leftColumn : styles.singleColumn}>
            {/* Sade Kategori Rozeti */}
            <View style={styles.categoryBadge}>
              <Smartphone size={13} color="#60a5fa" />
              <Text style={styles.categoryBadgeText}>Android APK İndirme</Text>
            </View>

            {/* Uygulama İkonu & Başlık */}
            <View style={[styles.appHeader, isDesktop && styles.appHeaderDesktop]}>
              <View style={[styles.appIconContainer, isDesktop && styles.appIconContainerDesktop]}>
                <LinearGradient
                  colors={['#1e293b', '#0f172a']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.appIconGradient}
                >
                  <Tv size={isDesktop ? 44 : 38} color="#60a5fa" />
                </LinearGradient>
              </View>

              <View style={styles.appTitleContainer}>
                <View style={styles.titleRow}>
                  <Text style={[styles.appTitle, isDesktop && styles.appTitleDesktop]}>
                    KaymakTV
                  </Text>
                  <View style={styles.versionBadge}>
                    <Text style={styles.versionBadgeText}>{CURRENT_VERSION}</Text>
                  </View>
                </View>
                <Text style={[styles.appSubtitle, isDesktop && styles.appSubtitleDesktop]}>
                  Dizi & Film Takibinin En Tatlı Hali
                </Text>
              </View>
            </View>

            {/* İndirme Butonu */}
            <TouchableOpacity
              activeOpacity={0.82}
              onPress={handleDownload}
              style={[styles.downloadButtonWrapper, isDesktop && styles.downloadButtonWrapperDesktop]}
            >
              <LinearGradient
                colors={['#2563eb', '#1d4ed8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.downloadButton, isDesktop && styles.downloadButtonDesktop]}
              >
                <View style={[styles.buttonIconCircle, isDesktop && styles.buttonIconCircleDesktop]}>
                  <Download size={isDesktop ? 24 : 20} color="#ffffff" />
                </View>
                <View style={styles.buttonTextContainer}>
                  <Text style={[styles.downloadButtonText, isDesktop && styles.downloadButtonTextDesktop]}>
                    KaymakTV APK İndir
                  </Text>
                  <Text style={styles.downloadButtonSubtext}>
                    {CURRENT_VERSION} • Android 8.0+ ({APK_SIZE})
                  </Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>

            {/* Bilgi Izgarası (Meta Data) */}
            <View style={styles.metaGrid}>
              <View style={styles.metaCard}>
                <FileCheck size={15} color="#60a5fa" />
                <View>
                  <Text style={styles.metaLabel}>Dosya Boyutu</Text>
                  <Text style={styles.metaValue}>{APK_SIZE}</Text>
                </View>
              </View>

              <View style={styles.metaCard}>
                <Cpu size={15} color="#60a5fa" />
                <View>
                  <Text style={styles.metaLabel}>Gereksinim</Text>
                  <Text style={styles.metaValue}>Android 8.0+</Text>
                </View>
              </View>

              {/* Tıklanabilir GitHub Release Kartı */}
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={handleOpenGithubRelease}
                style={[styles.metaCard, styles.clickableMetaCard]}
              >
                <Globe size={15} color="#60a5fa" />
                <View style={styles.metaCardTextWrapper}>
                  <Text style={styles.metaLabel}>Dağıtım Kanalı</Text>
                  <View style={styles.metaValueRow}>
                    <Text style={styles.metaValueLink}>GitHub Release</Text>
                    <ExternalLink size={11} color="#60a5fa" />
                  </View>
                </View>
              </TouchableOpacity>
            </View>

            {/* Masaüstü Ek Bilgi Kutusu */}
            {isDesktop && (
              <View style={styles.desktopTrustBox}>
                <View style={styles.trustBoxHeader}>
                  <Info size={15} color="#60a5fa" />
                  <Text style={styles.trustBoxTitle}>Android Yükleme Bilgisi</Text>
                </View>
                <Text style={styles.trustBoxDesc}>
                  En son güncellemeleri anında test edebilmeniz için uygulamanın güncel Android paketleri doğrudan sunulmaktadır.
                </Text>
              </View>
            )}
          </View>

          {/* MASAÜSTÜ SAĞ SÜTUN / MOBİL ALT KISIM */}
          <View style={isDesktop ? styles.rightColumn : styles.singleColumn}>
            {/* Sürüm Notları (Changelog) — GitHub API'den dinamik */}
            <View style={styles.changelogCard}>
              <View style={styles.changelogHeader}>
                <Sparkles size={16} color="#60a5fa" />
                <Text style={styles.changelogTitle}>
                  {CURRENT_VERSION} Sürüm Notları
                </Text>
              </View>

              {isLoadingNotes ? (
                <Text style={styles.changelogText}>Sürüm notları yükleniyor...</Text>
              ) : notesError ? (
                <Text style={styles.changelogText}>{notesError}</Text>
              ) : (
                <View style={styles.changelogList}>
                  {releaseNotes
                    .split('\n')
                    .filter((line) => line.trim().length > 0)
                    .map((line, index) => (
                      <View key={index} style={styles.changelogRow}>
                        <CheckCircle2 size={15} color="#60a5fa" style={styles.checkIcon} />
                        <Text style={styles.changelogText}>{line.trim()}</Text>
                      </View>
                    ))}
                </View>
              )}
            </View>

            {/* Adım Adım Kurulum Rehberi */}
            <View style={styles.guideContainer}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => !isDesktop && setIsGuideOpen(!isGuideOpen)}
                style={[styles.guideHeader, isDesktop && { cursor: 'default' as any }]}
              >
                <View style={styles.guideTitleRow}>
                  <Smartphone size={16} color="#94a3b8" />
                  <Text style={styles.guideTitle}>Nasıl Kurulur? (3 Kolay Adım)</Text>
                </View>
                {!isDesktop && (
                  isGuideOpen ? (
                    <ChevronUp size={18} color="#94a3b8" />
                  ) : (
                    <ChevronDown size={18} color="#94a3b8" />
                  )
                )}
              </TouchableOpacity>

              {showGuide && (
                <View style={styles.guideContent}>
                  <View style={styles.stepRow}>
                    <View style={styles.stepNumberBadge}>
                      <Text style={styles.stepNumberText}>1</Text>
                    </View>
                    <View style={styles.stepTextContainer}>
                      <Text style={styles.stepHeading}>APK Dosyasını İndirin</Text>
                      <Text style={styles.stepDesc}>
                        Yukarıdaki "APK İndir" butonuna tıklayarak dosyayı cihazınıza indirin.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.stepRow}>
                    <View style={styles.stepNumberBadge}>
                      <Text style={styles.stepNumberText}>2</Text>
                    </View>
                    <View style={styles.stepTextContainer}>
                      <Text style={styles.stepHeading}>Yükleme İznini Onaylayın</Text>
                      <Text style={styles.stepDesc}>
                        Tarayıcınız "Bilinmeyen kaynaklardan yükleme" uyarısı verirse izin verin.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.stepRow}>
                    <View style={styles.stepNumberBadge}>
                      <Text style={styles.stepNumberText}>3</Text>
                    </View>
                    <View style={styles.stepTextContainer}>
                      <Text style={styles.stepHeading}>Kurun ve Başlatın</Text>
                      <Text style={styles.stepDesc}>
                        İndirme tamamlandığında dosyaya dokunup kurulumu bitirin ve giriş yapın.
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
          </View>

        </View>

        {/* Alt Bilgi Footer */}
        <Text style={styles.footerNote}>
          KaymakTV • Tüm hakları saklıdır.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
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
  versionBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.22)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  versionBadgeText: {
    color: '#60a5fa',
    fontSize: 12,
    fontWeight: '700',
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
