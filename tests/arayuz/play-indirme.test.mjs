import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { tsLoader } from '../ts-test-loader.mjs';
import yardimci from '../yardimci.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const T = yardimci.baslat('PLAY-INDIR-01 · WEB INDIRME', { kokOneki: 'play-indir-' });
const page = 'app/(public)/download.web.tsx';
const catalogs = Object.fromEntries(['tr', 'en'].map((lang) =>
  [lang, JSON.parse(read(`locales/${lang}/common.json`))],
));
const dlKeys = (catalog) => Object.keys(catalog).filter((key) => /^dl[A-Z]/.test(key)).sort();
const keys = new Set();
let language = 'tr';

function RouterLink({ href, children }) {
  return React.createElement('a', { href }, children);
}

const load = tsLoader(root, {
  react: { default: React },
  'expo-router': { Link: RouterLink },
  'expo-router/head': { default: React.Fragment },
  'react-i18next': {
    useTranslation: () => ({
      i18n: { resolvedLanguage: language },
      t(key, values) {
        keys.add(key);
        return catalogs[language][key]?.replace(/{{(\w+)}}/g, (_, name) => values?.[name]);
      },
    }),
  },
  '../../components/icons': new Proxy({}, { get: () => () => null }),
  '../../components/public/download.web.styles': tsLoader(root)('components/public/download.web.styles.ts'),
});
const { PLAY_STORE_URL, ILETISIM_EPOSTA } = load('utils/constants.ts');
const { PLAY_STORE_QR } = load('components/public/download/playStoreQr.ts');
const Screen = load(page).default;
const app = JSON.parse(read('app.json')).expo;

for (language of ['tr', 'en']) {
  keys.clear();
  const catalog = catalogs[language];
  const html = renderToStaticMarkup(React.createElement(Screen));
  const externalLinks = Array.from(html.matchAll(/<a\b[^>]* href="https?:\/\/[^"]+"[^>]*>/g), (match) => match[0]);
  T.ok(`${language}: tek dis baglanti Play adresini yeni sekmede acar`, externalLinks.length === 1
    && externalLinks[0].includes(`href="${PLAY_STORE_URL}"`)
    && externalLinks[0].includes('target="_blank"') && externalLinks[0].includes('rel="noopener noreferrer"')
    && new URL(PLAY_STORE_URL).searchParams.get('id') === app.android.package);
  T.ok(`${language}: destek, gereksinim ve eski kurulum SSS'de`, (html.match(/<details>/g) || []).length === 3
    && html.includes(`href="mailto:${ILETISIM_EPOSTA}"`) && html.includes('Android 7.0')
    && html.includes(catalog.dlLegacyQuestion));
  T.ok(`${language}: tum dl anahtarlari dolu, kullanimla birebir ve diger dille es`,
    JSON.stringify([...keys].sort()) === JSON.stringify(dlKeys(catalog))
    && JSON.stringify(dlKeys(catalogs.tr)) === JSON.stringify(dlKeys(catalogs.en))
    && dlKeys(catalog).every((key) => typeof catalog[key] === 'string' && catalog[key].trim()));
  T.ok(`${language}: eski kurulum SSS disinda APK, GitHub veya beta metni yok`,
    dlKeys(catalog).filter((key) => !key.startsWith('dlLegacy')).every((key) => !/\b(?:APK|GitHub|beta)\b/i.test(catalog[key]))
    && !/github|\/releases\/|\.apk\b|\bbeta\b/i.test(html));
}

T.ok('QR ayni adrese ait ve kare matris', PLAY_STORE_QR.address === PLAY_STORE_URL
  && PLAY_STORE_QR.rows.length > 0 && PLAY_STORE_QR.rows.every((row) =>
    row.length === PLAY_STORE_QR.rows.length && /^[01]+$/.test(row)));
T.ok('Eski dagitim modulleri, baglantisi ve izin kaldirildi',
  ['hooks/useBetaSurumu.ts', 'services/github.ts', 'tests/arayuz/apk-indirme.test.mjs'].every((file) =>
    !fs.existsSync(path.join(root, file)))
  && !/GITHUB_RELEASES_URL|useBetaSurumu|services\/github|Linking\.openURL|fetch\(/.test(read(page))
  && !/GITHUB_RELEASES_URL/.test(read('utils/constants.ts'))
  && !/https:\/\/api\.github\.com/.test(read('server.js')));

T.bitir();
