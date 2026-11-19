import React from 'react';
import { Link } from 'expo-router';
import Head from 'expo-router/head';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, Calendar, ChevronDown, Download, ExternalLink, Repeat, Smartphone, Tv, Users,
} from '../../components/icons';
import { DownloadCSS } from '../../components/public/download.web.styles';
import { PLAY_STORE_QR } from '../../components/public/download/playStoreQr';
import { ILETISIM_EPOSTA, PLAY_STORE_URL } from '../../utils/constants';

const features = [
  { Icon: Calendar, title: 'dlTrackingTitle', description: 'dlTrackingDescription' },
  { Icon: Repeat, title: 'dlSyncTitle', description: 'dlSyncDescription' },
  { Icon: Users, title: 'dlFeedTitle', description: 'dlFeedDescription' },
] as const;

const qrSize = PLAY_STORE_QR.rows.length + 8; // Four quiet modules on every side.
const qrPath = PLAY_STORE_QR.rows.flatMap((row, y) =>
  Array.from(row, (module, x) => module === '1' ? `M${x + 4} ${y + 4}h1v1h-1z` : ''),
).join('');

export default function DownloadScreen() {
  const { t, i18n } = useTranslation('common');

  return (
    <>
      <Head>
        <title>{t('dlPageTitle')}</title>
        <meta name="description" content={t('dlIntro')} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <style>{DownloadCSS}</style>
      <div className="kt-download" lang={i18n.resolvedLanguage}>
        <header className="kt-download-header">
          <div className="kt-download-shell">
            <div className="kt-download-brand">
              <span className="kt-download-mark"><Tv size={19} aria-hidden /></span>
              {t('dlBrand')}
            </div>
            <Link href="/" className="kt-download-home">
              <ArrowLeft size={16} aria-hidden /> {t('dlHome')}
            </Link>
          </div>
        </header>

        <main className="kt-download-shell kt-download-main">
          <section className="kt-download-hero" aria-labelledby="dl-hero">
            <div className="kt-download-hero-copy">
              <div className="kt-download-platform">
                <Smartphone size={16} aria-hidden /> {t('dlPlatform')}
              </div>
              <h1 id="dl-hero">{t('dlHeadline')} <em>{t('dlHeadlineAccent')}</em></h1>
              <p>{t('dlIntro')}</p>
              <a className="kt-download-cta" href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer">
                <Download size={20} aria-hidden />
                {t('dlPlayButton')}
                <ExternalLink size={15} aria-hidden />
              </a>
            </div>
            <figure className="kt-download-qr">
              <svg className="kt-download-code" viewBox={`0 0 ${qrSize} ${qrSize}`}
                shapeRendering="crispEdges" role="img" aria-label={t('dlQrLabel')}>
                <rect width={qrSize} height={qrSize} fill="white" />
                <path d={qrPath} fill="black" />
              </svg>
              <figcaption>{t('dlQrCaption')}</figcaption>
            </figure>
          </section>

          <section className="kt-download-features" aria-labelledby="dl-features">
            <h2 id="dl-features">{t('dlFeaturesTitle')}</h2>
            <div className="kt-download-grid">
              {features.map(({ Icon, title, description }) => (
                <article className="kt-download-card" key={title}>
                  <span className="kt-download-icon"><Icon size={21} aria-hidden /></span>
                  <div>
                    <h3>{t(title)}</h3>
                    <p>{t(description)}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="kt-download-faq" aria-labelledby="dl-faq">
            <h2 id="dl-faq">{t('dlFaqTitle')}</h2>
            <div className="kt-download-answers">
              <details>
                <summary>{t('dlLegacyQuestion')} <ChevronDown size={18} aria-hidden /></summary>
                <p>{t('dlLegacyAnswer')}</p>
              </details>
              <details>
                <summary>{t('dlAndroidQuestion')} <ChevronDown size={18} aria-hidden /></summary>
                <p>{t('dlAndroidAnswer')}</p>
              </details>
              <details>
                <summary>{t('dlContactQuestion')} <ChevronDown size={18} aria-hidden /></summary>
                <p>
                  <a href={`mailto:${ILETISIM_EPOSTA}`}>{t('dlContactEmail', { email: ILETISIM_EPOSTA })}</a>
                </p>
              </details>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}
