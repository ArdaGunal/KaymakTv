import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Linking,
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
} from '../../components/icons';
import { useRouter } from 'expo-router';
import { APK_DOWNLOAD_URL, GITHUB_RELEASES_URL } from '../../utils/constants';
import { fetchBetaReleaseNotes } from '../../services/github';
import { styles } from '../../components/public/download.web.styles';

// APK bilgileri — Sürüm notları GitHub API'den dinamik çekilir. Sürüm
// numarası BİLİNÇLİ OLARAK burada tutulmuyor (kullanıcı GitHub Release
// notlarını zaten elle güncelliyor, koddaki sabiti de ayrıca güncellemeyi
// unutup bayat bir sürüm göstermek istemiyor — bkz. 2026-08-16 kararı).
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
    fetchBetaReleaseNotes()
      .then((body) => {
        setReleaseNotes(body);
        setNotesError(null);
      })
      .catch((err) => {
        console.error('Sürüm notları çekilemedi:', err);
        setNotesError('Sürüm notlarına GitHub üzerinden ulaşabilirsiniz.');
        setReleaseNotes('');
      })
      .finally(() => setIsLoadingNotes(false));
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
                <Text style={[styles.appTitle, isDesktop && styles.appTitleDesktop]}>
                  KaymakTV
                </Text>
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
                    Android 8.0+ ({APK_SIZE})
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
                  Sürüm Notları
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
