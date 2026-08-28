import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../hooks/useSettings';
import LanguagePickerModal from '../../components/settings/LanguagePickerModal';
import Head from 'expo-router/head';
import { LandingCSS } from '../../components/public/index.web.styles';
import { useNavScrollStyle, useScrollRevealObserver } from '../../components/public/index.web.hooks';
import { Clapperboard, Calendar, Search, BarChart2, Star, List, Users, LogIn, Globe, Compass, Lock } from '../../components/icons';

export default function WebLandingPage() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { loginAsGuest } = useAuth();
  const { currentLanguage, handleChangeLanguage } = useSettings();
  const [langModalVisible, setLangModalVisible] = useState(false);

  const navStyle = useNavScrollStyle();
  useScrollRevealObserver();

  const handleLogin = () => {
    router.push('/(public)/settings');
  };

  const handleGuest = async () => {
    await loginAsGuest();
    router.replace('/(protected)/(tabs)/explore');
  };

  const features = [
    {
      titleKey: 'viewingDiary',
      descKey: 'viewingDiaryDesc',
      Icon: Calendar,
      color: '#b0c6ff',
      accent: 'rgba(176,198,255,0.12)',
      borderAccent: 'rgba(176,198,255,0.14)',
    },
    {
      titleKey: 'fastSearchTitle',
      descKey: 'fastSearchDesc',
      Icon: Search,
      color: '#94ccff',
      accent: 'rgba(148,204,255,0.10)',
      borderAccent: 'rgba(148,204,255,0.14)',
    },
    {
      titleKey: 'statsPanel',
      descKey: 'statsPanelDesc',
      Icon: BarChart2,
      color: '#fbbf24',
      accent: 'rgba(251,191,36,0.10)',
      borderAccent: 'rgba(251,191,36,0.14)',
    },
    {
      titleKey: 'ratingReview',
      descKey: 'ratingReviewDesc',
      Icon: Star,
      color: '#f87171',
      accent: 'rgba(248,113,113,0.10)',
      borderAccent: 'rgba(248,113,113,0.14)',
    },
    {
      titleKey: 'personalLists',
      descKey: 'personalListsDesc',
      Icon: List,
      color: '#34d399',
      accent: 'rgba(52,211,153,0.10)',
      borderAccent: 'rgba(52,211,153,0.14)',
    },
    {
      titleKey: 'socialFollow',
      descKey: 'socialFollowDesc',
      Icon: Users,
      color: '#c084fc',
      accent: 'rgba(192,132,252,0.10)',
      borderAccent: 'rgba(192,132,252,0.14)',
    },
  ];

  return (
    <>
      <Head>
        <title>{t('webTitle', 'KaymakTV - İzlediklerinin kaymağını çıkar')}</title>
        <meta name="description" content={t('webDesc', 'Dizi ve film izleme hayatınızı tek bir profilde toplayın.')} />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <style dangerouslySetInnerHTML={{ __html: LandingCSS }} />

      <nav className="nav" style={navStyle}>
        <div className="kaymak-container">
          <a onClick={() => window.scrollTo(0, 0)} className="logo">
            <span className="dot"></span>KaymakTV
          </a>
          
          <div className="nav-center">
            <a onClick={handleGuest}>{t('navExplore', 'Keşfet')}</a>
          </div>

          <div className="nav-actions">
            <button className="lang-btn" onClick={() => setLangModalVisible(true)}>
              <Globe size={14} color="#b0c6ff" strokeWidth={2.5} />
              {currentLanguage === 'tr' ? 'TR' : 'EN'}
            </button>
            
            <button onClick={handleLogin} className="btn-primary">
              <LogIn size={15} color="#002d6e" strokeWidth={2.5} />
              {t('connectTraktButton', 'Trakt ile Giriş Yap')}
            </button>
          </div>
        </div>
      </nav>

      <main>
        <section className="hero">
          <div className="hero-glow"></div>
          <div className="kaymak-container reveal">
            <div className="eyebrow-badge">
              <Clapperboard size={14} color="#b0c6ff" strokeWidth={2} />
              {t('diaryEyebrow', 'SİNEMA & DİZİ GÜNLÜĞÜN').toUpperCase()}
            </div>
            
            <h1>
              {t('heroTitle1', 'İzlediklerinin ')}
              <em>{t('heroTitle2', 'kaymağını ')}</em>
              {t('heroTitle3', 'çıkar.')}
            </h1>
            
            <p>{t('heroSubtitle')}</p>
            
            <div className="hero-ctas">
              <button onClick={handleLogin} className="btn-primary">
                <LogIn size={16} color="#002d6e" strokeWidth={2.5} />
                {t('connectTraktButton', 'Trakt ile Giriş Yap')}
              </button>
              <button onClick={handleGuest} className="btn-secondary">
                <Compass size={16} color="#b0c6ff" strokeWidth={2} />
                {t('exploreAsGuest', 'Misafir Olarak Devam Et')}
              </button>
            </div>
          </div>
        </section>

        <section className="features kaymak-container reveal">
          <div className="features-head">
            <span className="eyebrow">{t('features', 'NELER YAPABİLİRSİN').toUpperCase()}</span>
            <h2>{t('oneApp', 'Bir uygulama, bütün izleme hayatın.')}</h2>
            <p>{t('featuresSectionSub', 'Hangi platformda izlersen izle — Kaymak hepsini tek profilde toplar.')}</p>
          </div>

          <div className="bento-grid">
            {features.map((item, idx) => (
              <div key={idx} className="bento-card" style={{ borderColor: item.borderAccent }}>
                <div className="corner-glow" style={{ backgroundColor: item.color }}></div>
                <div className="icon-wrap" style={{ backgroundColor: item.accent }}>
                  <item.Icon size={20} color={item.color} strokeWidth={1.8} />
                </div>
                <h3>{t(item.titleKey)}</h3>
                <p>{t(item.descKey)}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer>
        <div className="kaymak-container">
          <a onClick={() => window.scrollTo(0, 0)} className="footer-logo">
            <span className="dot"></span>KaymakTV
          </a>
          
          <div className="footer-links">
            <a onClick={() => router.push('/(public)/gizlilik')}>{t('product', 'Gizlilik Politikası')}</a>
            <a onClick={() => router.push('/(public)/kullanim-kosullari')}>{t('other', 'Kullanım Koşulları')}</a>
          </div>
          
          <div className="footer-bottom">
            <span className="copyright">{t('footerRights', '© 2026 KaymakTV. Tüm hakları saklıdır.')}</span>
            <span className="data-secure">
              <Lock size={12} color="#424654" strokeWidth={2.5} />
              {t('dataLocal', 'Verileriniz cihazda tutulur.')}
            </span>
          </div>
        </div>
      </footer>

      <LanguagePickerModal
        visible={langModalVisible}
        currentLanguage={currentLanguage}
        onSelect={handleChangeLanguage}
        onClose={() => setLangModalVisible(false)}
      />
    </>
  );
}
