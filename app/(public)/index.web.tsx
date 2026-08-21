import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../hooks/useSettings';
import LanguagePickerModal from '../../components/settings/LanguagePickerModal';
import Head from 'expo-router/head';
import { LandingCSS } from '../../components/public/index.web.styles';
import {
  useNavScrollStyle,
  useScrollRevealObserver,
  useStatsCounterAnimation,
  useTrendingMedia,
} from '../../components/public/index.web.hooks';

export default function WebLandingPage() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { loginAsGuest } = useAuth();
  const { currentLanguage, handleChangeLanguage } = useSettings();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [langModalVisible, setLangModalVisible] = useState(false);

  // F12 — dört ayrı kaygı (nav rengi, reveal animasyonu, istatistik sayacı,
  // trend çekme) tek bir useEffect'e karışmıştı, dört ayrı hook'a bölündü
  // (bkz. components/public/index.web.hooks.ts).
  const navStyle = useNavScrollStyle();
  useScrollRevealObserver();
  useStatsCounterAnimation();
  const trendingMedia = useTrendingMedia();

  // "Ücretsiz Başla" (register) ve "Giriş Yap" (login) eskiden AYRI butonlardı
  // ama ikisi de aynı yere (Trakt OAuth ekranı) gidiyordu — `mode` parametresi
  // hiç kullanılmıyordu. Uygulamanın tek giriş yöntemi zaten Trakt olduğundan
  // "ücretsiz kayıt" diye ayrı bir akış yok; tek, dürüst bir "Giriş Yap" yeterli.
  const handleLogin = () => {
    router.push('/settings');
  };

  const handleGuest = async () => {
    await loginAsGuest();
    router.replace('/(protected)/(tabs)/explore');
  };

  return (
    <>
      <Head>
        <title>{t('webTitle')}</title>
        <meta name="description" content={t('webDesc')} />
        <meta property="og:title" content={t('webTitle')} />
        <meta property="og:description" content={t('webDesc')} />
        <meta property="og:type" content="website" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      </Head>

      <style dangerouslySetInnerHTML={{ __html: LandingCSS }} />
      
      <div className="grain"></div>

      <svg className="ribbon-defs">
        <defs>
          <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1D4ED8"/>
            <stop offset="45%" stopColor="#3B82F6"/>
            <stop offset="75%" stopColor="#60A5FA"/>
            <stop offset="100%" stopColor="#3B82F6"/>
          </linearGradient>
          <symbol id="ribbon-shape" viewBox="0 0 1000 220">
            <path d="M -20,140 C 130,40 260,230 410,120 C 560,10 660,210 810,95 C 900,30 950,60 1020,45"
                  fill="none" stroke="url(#goldGrad)" strokeWidth="20" strokeLinecap="round" opacity="0.9"/>
            <g fill="#60A5FA" opacity="0.55">
              <circle cx="40" cy="108" r="3.4"/>
              <circle cx="105" cy="72" r="3.4"/>
              <circle cx="172" cy="90" r="3.4"/>
              <circle cx="240" cy="150" r="3.4"/>
              <circle cx="308" cy="178" r="3.4"/>
              <circle cx="378" cy="150" r="3.4"/>
              <circle cx="448" cy="88" r="3.4"/>
              <circle cx="518" cy="48" r="3.4"/>
              <circle cx="588" cy="72" r="3.4"/>
              <circle cx="658" cy="150" r="3.4"/>
              <circle cx="728" cy="168" r="3.4"/>
              <circle cx="798" cy="130" r="3.4"/>
              <circle cx="866" cy="78" r="3.4"/>
              <circle cx="932" cy="58" r="3.4"/>
            </g>
          </symbol>
        </defs>
      </svg>

      <nav className="nav" style={navStyle}>
        <div className="kaymak-container">
          <a onClick={() => window.scrollTo(0, 0)} className="logo">
            <span className="dot"></span>KaymakTV
          </a>
          <ul className="nav-links">
            <li><a href="#ozellikler">{t('features')}</a></li>
            <li><a href="#istatistik">{t('statistics')}</a></li>
            <li><a href="#kesfet">Trendler</a></li>
          </ul>
          <div className="nav-actions">
            <button
              className="lang-btn"
              onClick={() => setLangModalVisible(true)}
              aria-label="Change language"
            >
              🌐 {currentLanguage === 'tr' ? 'TR' : 'EN'}
            </button>
            <a onClick={handleGuest} className="link-ghost desktop-only">{t('exploreAsGuest')}</a>
            <a onClick={handleLogin} className="btn btn-primary desktop-only">{t('login')}</a>
            <button
              className={`burger ${isMenuOpen ? 'open' : ''}`}
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <span></span><span></span><span></span>
            </button>
          </div>
        </div>
      </nav>

      {/* Eskiden mobil menüde misafir seçeneği hiç yoktu (yalnızca masaüstü
          nav-actions'ta "desktop-only" sınıfıyla vardı) — dar ekran web
          kullanıcıları giriş yapmadan uygulamayı deneyemiyordu. */}
      <div className={`mobile-menu ${isMenuOpen ? 'open' : ''}`}>
        <a href="#ozellikler" onClick={() => setIsMenuOpen(false)}>{t('features')}</a>
        <a href="#istatistik" onClick={() => setIsMenuOpen(false)}>{t('statistics')}</a>
        <a href="#kesfet" onClick={() => setIsMenuOpen(false)}>Trendler</a>
        <a onClick={() => { setIsMenuOpen(false); handleGuest(); }}>{t('exploreAsGuest')}</a>
        <button
          className="lang-btn"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => { setIsMenuOpen(false); setLangModalVisible(true); }}
        >
          🌐 {currentLanguage === 'tr' ? 'Türkçe' : 'English'}
        </button>
        <a onClick={() => { setIsMenuOpen(false); handleLogin(); }} className="btn btn-primary">{t('login')}</a>
      </div>

      <header className="hero">
        <div className="poster-field" aria-hidden="true">
          <div className="poster"></div><div className="poster"></div><div className="poster"></div><div className="poster"></div>
          <div className="poster"></div><div className="poster"></div><div className="poster"></div><div className="poster"></div>
          <div className="poster"></div><div className="poster"></div><div className="poster"></div><div className="poster"></div>
          <div className="poster"></div><div className="poster"></div>
        </div>
        <div className="hero-fade"></div>
        <div className="hero-inner">
          <span className="eyebrow">{t('diaryEyebrow')}</span>
          <div className="hero-ribbon-wrap">
            <svg viewBox="0 0 1000 220" style={{ width: '100%' }}><use href="#ribbon-shape"/></svg>
          </div>
          <h1>{t('heroTitle1')}<br/><em>{t('heroTitle2')}</em>{t('heroTitle3')}</h1>
          <p className="lead">{t('heroSubtitle')}</p>
          <div className="hero-ctas">
            <a onClick={handleLogin} className="btn btn-primary">{t('login')}</a>
            <a onClick={handleGuest} className="btn btn-outline">{t('exploreAsGuest')}</a>
          </div>
        </div>
        <div className="scroll-cue"><span>Kaydır</span><span className="line"></span></div>
      </header>

      <section id="ozellikler" className="kaymak-section">
        <div className="kaymak-container">
          <div className="section-head reveal">
            <span className="eyebrow">Neler yapabilirsin</span>
            <h2>{t('oneApp')}</h2>
            <p>Hangi platformda izlersen izle — Kaymak hepsini tek profilde toplar.</p>
          </div>

          <div className="bento">
            <div className="bento-card c-log reveal">
              <div className="card-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2v4M16 2v4"/></svg></div>
              <h3>{t('viewingDiary')}</h3>
              <p>{t('viewingDiaryDesc')}</p>
              <div className="mini-timeline"><span className="on"></span><span className="on"></span><span></span><span className="on"></span><span></span><span className="on"></span><span className="on"></span></div>
            </div>

            <div className="bento-card c-search reveal">
              <div className="card-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg></div>
              <h3>Kapsamlı Arama</h3>
              <p>{t('fastSearch')}</p>
              <div className="search-tags"><span>{t('director')}</span><span>{t('actor')}</span><span>{t('episode')}</span><span>{t('genre')}</span></div>
            </div>

            <div className="bento-card c-stats reveal">
              <div className="card-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 20V10M12 20V4M20 20v-7"/></svg></div>
              <h3>{t('statsPanel')}</h3>
              <p>{t('statsPanelDesc')}</p>
              <div className="mini-bars"><i style={{ height: '40%' }}></i><i style={{ height: '70%' }}></i><i style={{ height: '55%' }}></i><i style={{ height: '90%' }}></i><i style={{ height: '35%' }}></i></div>
            </div>

            <div className="bento-card c-rate reveal">
              <div className="card-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 2l3.1 6.6 7.2.8-5.4 5 1.5 7.1L12 18l-6.4 3.5 1.5-7.1-5.4-5 7.2-.8z"/></svg></div>
              <h3>{t('ratingReview')}</h3>
              <p>{t('ratingReviewDesc')}</p>
              <div className="mini-stars">★★★★☆</div>
            </div>

            <div className="bento-card c-lists reveal">
              <div className="card-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 6h16M4 12h10M4 18h7"/></svg></div>
              <h3>{t('personalLists')}</h3>
              <p>{t('personalListsDesc')}</p>
              <div className="lists-stack">
                <div>Favori Bilim Kurgu Filmlerim</div>
                <div>{t('weekendWatchlist')}</div>
              </div>
            </div>

            <div className="bento-card c-social reveal">
              <div className="avatar-row">
                <div className="av" style={{ background: 'linear-gradient(135deg,#3B82F6,#1e3a8a)' }}>A</div>
                <div className="av" style={{ background: 'linear-gradient(135deg,#60A5FA,#3B82F6)' }}>S</div>
                <div className="av" style={{ background: 'linear-gradient(135deg,#2563EB,#1e40af)' }}>M</div>
                <div className="av" style={{ background: 'linear-gradient(135deg,#3B82F6,#1e3a8a)' }}>D</div>
              </div>
              <div className="txt">
                <h3>Sosyal Takip Sistemi</h3>
                <p>{t('socialFeed')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="istatistik" className="kaymak-section" style={{ background: 'var(--bg-alt)' }}>
        <div className="kaymak-container">
          <div className="section-head reveal">
            <span className="eyebrow">{t('dataVis')}</span>
            <h2>{t('endOfYear')}</h2>
            <p>{t('screenTime')}</p>
          </div>

          <div className="stats-panel reveal">
            <div className="stats-panel-head">
              <h4>{t('summary2026')}</h4>
              <span>{t('sampleProfile')}</span>
            </div>
            <div className="stat-grid">
              <div className="stat-box"><div className="stat-num" data-count="482">0</div><div className="stat-label">Saat izlendi</div></div>
              <div className="stat-box"><div className="stat-num" data-count="127">0</div><div className="stat-label">Film</div></div>
              <div className="stat-box"><div className="stat-num" data-count="34">0</div><div className="stat-label">Dizi</div></div>
              <div className="stat-box"><div className="stat-num" data-count="310">0</div><div className="stat-label">{t('episode')}</div></div>
            </div>
            <div className="genre-bars">
              <div className="genre-row"><span className="name">Bilim Kurgu</span><div className="bar-track"><div className="bar-fill" data-pct="34"></div></div><span className="pct">34%</span></div>
              <div className="genre-row"><span className="name">Dram</span><div className="bar-track"><div className="bar-fill" data-pct="22"></div></div><span className="pct">22%</span></div>
              <div className="genre-row"><span className="name">Komedi</span><div className="bar-track"><div className="bar-fill" data-pct="18"></div></div><span className="pct">18%</span></div>
              <div className="genre-row"><span className="name">Korku</span><div className="bar-track"><div className="bar-fill" data-pct="14"></div></div><span className="pct">14%</span></div>
              <div className="genre-row"><span className="name">{t('other')}</span><div className="bar-track"><div className="bar-fill" data-pct="12"></div></div><span className="pct">12%</span></div>
            </div>
          </div>
        </div>
      </section>

      <section id="kesfet" className="kaymak-section">
        <div className="kaymak-container">
          <div className="section-head reveal">
            <span className="eyebrow">Haftanın Trendleri</span>
            <h2>{t('trendingNow')}</h2>
            <p>{t('trendingNowDesc')}</p>
          </div>
        </div>

        <div className="marquee-wrap reveal">
          <div className="marquee" id="marqueeTrack">
            {trendingMedia.length > 0 ? trendingMedia.map((media, idx) => (
              <div className="trending-card" key={`${media.id}-${idx}`}>
                <img src={media.poster} alt={media.title} />
                <h3>{media.title}</h3>
                <span>{media.type}</span>
              </div>
            )) : (
              Array.from({length: 10}).map((_, idx) => (
                 <div className="trending-card" key={`skeleton-${idx}`} style={{opacity: 0.5}}>
                   <div style={{width:'100%', aspectRatio:'2/3', background:'var(--bg)', borderRadius:8, marginBottom:12}}></div>
                   <div style={{height:15, background:'var(--bg)', borderRadius:4, marginBottom:6}}></div>
                 </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="cta-band">
        <div className="kaymak-container reveal">
          <svg className="ribbon-cta" viewBox="0 0 1000 220"><use href="#ribbon-shape"/></svg>
          <h2>{t('startToday1')}<br/>{t('startToday2')}</h2>
          <p>{t('ctaBandSubtitle')}</p>
          <a onClick={handleLogin} className="btn btn-primary">{t('login')}</a>
        </div>
      </section>

      <footer>
        <div className="kaymak-container">
          <div className="foot-top">
            <div className="foot-brand">
              <a onClick={() => window.scrollTo(0, 0)} className="logo"><span className="dot"></span>KaymakTV</a>
              <p>{t('digitalDiary')}</p>
            </div>
            <div className="foot-cols">
              <div className="foot-col">
                <h5>{t('product')}</h5>
                <a href="#ozellikler">{t('features')}</a>
                <a href="#istatistik">{t('statistics')}</a>
                <a onClick={handleLogin}>{t('login')}</a>
              </div>
              <div className="foot-col">
                <h5>{t('company')}</h5>
                <a href="#">Hakkımızda</a>
                <a href="#">İletişim</a>
                <a href="#">Kariyer</a>
              </div>
              <div className="foot-col">
                <h5>Yasal</h5>
                <a onClick={() => router.push('/gizlilik')}>Gizlilik Politikası</a>
                <a onClick={() => router.push('/kullanim-kosullari')}>Kullanım Şartları</a>
              </div>
            </div>
          </div>
          <div className="foot-bottom">
            <span>© 2026 KaymakTV. Tüm hakları saklıdır.</span>
            <div className="foot-social">
              <a href="#" aria-label="Instagram"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/></svg></a>
              <a href="#" aria-label="X"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 4l16 16M20 4L4 20"/></svg></a>
              <a href="#" aria-label="Youtube"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="2" y="5" width="20" height="14" rx="4"/><path d="M10 9l5 3-5 3z" fill="currentColor" stroke="none"/></svg></a>
            </div>
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
