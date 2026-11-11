import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Redirect, useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../hooks/useSettings';
import LanguagePickerModal from '../../components/settings/LanguagePickerModal';
import Head from 'expo-router/head';
import { LandingCSS } from '../../components/public/index.web.styles';
import { useNavScrollStyle } from '../../components/public/index.web.hooks';
import { useLandingPosterWall } from '../../hooks/useLandingPosterWall';
import { Clapperboard, Calendar, Search, List, LogIn, Globe, Compass } from '../../components/icons';
import { MOBILE_PALETTE } from '../../constants/mobilePalette';
import { dilBilgisi } from '../../locales/diller';

const POSTER_TILE_COUNT = 21;

export default function WebLandingPage() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { accessToken, isGuest, loginAsGuest } = useAuth();
  const { currentLanguage, handleChangeLanguage } = useSettings();
  const [langModalVisible, setLangModalVisible] = useState(false);

  const navStyle = useNavScrollStyle();
  const posters = useLandingPosterWall();
  const posterTiles = posters.length > 0
    ? Array.from({ length: POSTER_TILE_COUNT }, (_, i) => posters[i % posters.length])
    : [];

  // Mobil karşılama ekranıyla (app/(public)/index.tsx) AYNI kural — bu ikili
  // ARCHITECTURE §E gereği yalnızca GÖRSEL olarak farklılaşmalı, iş mantığı
  // olarak değil; burada eksikti. Oturumu olan (Trakt'a bağlı ya da misafir)
  // bir kullanıcı bu sayfada MAHSUR KALIYORDU: geri tuşundan buraya düşen
  // misafirin uygulamaya dönmek için tekrar "Misafir Olarak Devam Et"
  // demesi gerekiyordu. Sonsuz döngü riski yok — (protected)/_layout.tsx'in
  // ters yöndeki yönlendirmesi tam olarak BUNUN DEĞİLİ koşulla çalışıyor
  // (oturum YOKSA '/'), iki koşul ayrık.
  if (accessToken || isGuest) {
    return <Redirect href="/(protected)/(tabs)/explore" />;
  }

  const handleLogin = () => {
    router.push('/(public)/settings');
  };

  const handleGuest = async () => {
    await loginAsGuest();
    router.replace('/(protected)/(tabs)/explore');
  };

  const features = [
    { titleKey: 'viewingDiary', descKey: 'viewingDiaryDesc', Icon: Calendar },
    { titleKey: 'personalLists', descKey: 'personalListsDesc', Icon: List },
    { titleKey: 'fastSearchTitle', descKey: 'fastSearchDesc', Icon: Search },
  ];

  return (
    <>
      <Head>
        <title>{t('webTitle', 'KaymakTV - İzlediklerinin kaymağını çıkar')}</title>
        <meta name="description" content={t('webDesc', 'Dizi ve film izleme hayatınızı tek bir profilde toplayın.')} />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <style dangerouslySetInnerHTML={{ __html: LandingCSS }} />

      <div className="landing-scroll">
      <nav className="nav" style={navStyle}>
        <div className="kaymak-container">
          <button type="button" onClick={() => window.scrollTo(0, 0)} className="logo">
            <span className="dot"></span>KaymakTV
          </button>

          <div className="nav-center">
            <button type="button" onClick={handleGuest}>{t('navExplore', 'Keşfet')}</button>
          </div>

          <div className="nav-actions">
            <button className="lang-btn" onClick={() => setLangModalVisible(true)}>
              <Globe size={14} color={MOBILE_PALETTE.steel} strokeWidth={2.2} />
              {dilBilgisi(currentLanguage).kisa}
            </button>

            <button onClick={handleLogin} className="btn-primary">
              <LogIn size={15} color={MOBILE_PALETTE.text} strokeWidth={2.2} />
              {t('login', 'Giriş Yap')}
            </button>
          </div>
        </div>
      </nav>

      <main>
        <section className="hero">
          {posterTiles.length > 0 && (
            <>
              <div className="hero-poster-wall">
                {posterTiles.map((src, idx) => (
                  <img key={idx} src={src} alt="" decoding="async" />
                ))}
              </div>
              <div className="hero-poster-fade"></div>
            </>
          )}
          <div className="hero-glow"></div>
          <div className="kaymak-container">
            <div className="eyebrow-badge">
              <Clapperboard size={14} color={MOBILE_PALETTE.steel} strokeWidth={2} />
              {t('diaryEyebrow', 'SİNEMA & DİZİ GÜNLÜĞÜN').toUpperCase()}
            </div>

            <h1>
              {t('heroTitle1')}<br />
              <em>{t('heroTitle2')}</em>

            </h1>

            <p>{t('heroSubtitle')}</p>

            <div className="hero-ctas">
              <button onClick={handleLogin} className="btn-primary">
                <LogIn size={16} color={MOBILE_PALETTE.text} strokeWidth={2.2} />
                {t('login', 'Giriş Yap')}
              </button>
              <button onClick={handleGuest} className="btn-secondary">
                <Compass size={16} color={MOBILE_PALETTE.steel} strokeWidth={2} />
                {t('exploreAsGuest', 'Misafir Olarak Devam Et')}
              </button>
            </div>
          </div>
        </section>

        <section className="features kaymak-container">
          <div className="features-head">
            <span className="eyebrow">{t('features', 'NELER YAPABİLİRSİN').toUpperCase()}</span>
            <h2>{t('oneApp', 'Bir uygulama, bütün izleme hayatın.')}</h2>
            <p>{t('featuresSectionSub', 'Hangi platformda izlersen izle — Kaymak hepsini tek profilde toplar.')}</p>
          </div>

          <div className="bento-grid">
            {features.map((item, idx) => (
              <div key={idx} className="bento-card">
                <div className="icon-wrap" >
                  <item.Icon size={20} color={MOBILE_PALETTE.steel} strokeWidth={1.8} />
                </div>
                <h3>{t(item.titleKey)}</h3>
                <p>{t(item.descKey)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="cta-band kaymak-container">
          <div className="cta-card">
            <div className="cta-card-head">
              <span className="eyebrow">{t('ctaEyebrow', 'HEMEN BAŞLA').toUpperCase()}</span>
              <h2>
                {t('startToday1')}

              </h2>
              <p>{t('ctaBandSubtitle', 'Kurulum yok, kredi kartı yok. Sadece izle ve kaydet.')}</p>
            </div>
            <div className="cta-divider"></div>
            <div className="cta-actions">
              <button onClick={handleLogin} className="btn-primary">
                <LogIn size={16} color={MOBILE_PALETTE.text} strokeWidth={2.2} />
                {t('login', 'Giriş Yap')}
              </button>
              <button onClick={handleGuest} className="btn-secondary">
                <Compass size={16} color={MOBILE_PALETTE.steel} strokeWidth={2} />
                {t('exploreAsGuest', 'Misafir Olarak Devam Et')}
              </button>
            </div>
            <p className="cta-footnote">{t('ctaFootnote', 'Ücretsiz · Reklamsız · Trakt.tv ile senkronize')}</p>
          </div>
        </section>
      </main>

      <footer>
        <div className="kaymak-container">
          <button type="button" onClick={() => window.scrollTo(0, 0)} className="footer-logo">
            <span className="dot"></span>KaymakTV
          </button>

          <div className="footer-links">
            <button type="button" onClick={() => router.push('/(public)/gizlilik')}>{t('welcomePrivacy')}</button>
            <button type="button" onClick={() => router.push('/(public)/kullanim-kosullari')}>{t('welcomeTerms')}</button>
          </div>

          <div className="footer-bottom">
            <span className="copyright">{t('footerRights', '© 2026 KaymakTV. Tüm hakları saklıdır.')}</span>

          </div>
        </div>
      </footer>
      </div>

      <LanguagePickerModal
        visible={langModalVisible}
        currentLanguage={currentLanguage}
        onSelect={handleChangeLanguage}
        onClose={() => setLangModalVisible(false)}
      />
    </>
  );
}
