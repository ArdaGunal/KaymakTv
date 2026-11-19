import { MOBILE_PALETTE as p } from '../../constants/mobilePalette';

export const DownloadCSS = `
.kt-download {
  --bg: ${p.background};
  --surface: ${p.surface};
  --raised: ${p.raised};
  --line: ${p.border};
  --text: ${p.text};
  --muted: ${p.muted};
  --accent: ${p.steel};
  --tint: ${p.steelTint};
  --primary: ${p.primary};
  --hero: #152c3f;
  --film: #112635;
  --film-edge: #294457;
  --film-hole: #456277;
  color-scheme: dark;
  height: 100vh;
  height: 100dvh;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  background: var(--bg);
  color: var(--text);
  font-family: system-ui, -apple-system, sans-serif;
  -webkit-user-select: text;
  user-select: text;
}
.kt-download *, .kt-download *::before, .kt-download *::after { box-sizing: border-box; }
.kt-download a { color: inherit; }
.kt-download :is(a, summary):focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; }
.kt-download-shell { width: min(100% - 56px, 1120px); margin-inline: auto; }
.kt-download-header { border-bottom: 1px solid var(--line); }
.kt-download-header .kt-download-shell {
  min-height: 70px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.kt-download-brand, .kt-download-home { display: inline-flex; align-items: center; gap: 10px; }
.kt-download-brand { font-size: 19px; font-weight: 750; letter-spacing: -.5px; }
.kt-download-mark, .kt-download-icon {
  display: inline-grid;
  place-items: center;
  flex: none;
  background: var(--tint);
  color: var(--accent);
}
.kt-download-mark { width: 36px; height: 36px; border-radius: 10px; }
.kt-download a.kt-download-home {
  min-height: 44px;
  font-size: 14px;
  color: var(--muted);
  text-decoration: none;
}
.kt-download a.kt-download-home:hover { color: var(--text); }
.kt-download-main { padding-block: 38px 56px; }
.kt-download-hero {
  position: relative;
  isolation: isolate;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, .69fr);
  align-items: center;
  gap: 40px;
  min-height: 398px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 24px;
  padding: 42px clamp(32px, 4vw, 58px);
  background: radial-gradient(ellipse at 85% 20%, var(--hero), transparent 76%), var(--surface);
}
.kt-download-platform {
  display: inline-flex;
  gap: 7px;
  align-items: center;
  color: var(--accent);
  font-size: 14px;
  font-weight: 650;
}
.kt-download h1 {
  margin: 15px 0;
  font-size: clamp(53px, 6.1vw, 88px);
  line-height: 1;
  letter-spacing: -.065em;
  font-weight: 760;
}
.kt-download h1 em { display: block; color: var(--accent); font-style: normal; }
.kt-download-hero-copy > p {
  max-width: 44ch;
  margin: 19px 0 25px;
  color: var(--muted);
  line-height: 1.65;
  font-size: 16px;
}
.kt-download a.kt-download-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 52px;
  padding: 12px 17px;
  border: 1px solid #3972a0;
  border-radius: 12px;
  background: var(--primary);
  color: #fff;
  text-decoration: none;
  font-size: 15px;
  font-weight: 700;
}
.kt-download-cta svg { flex: none; }
.kt-download-cta svg:last-child { margin-left: 8px; }
.kt-download a.kt-download-cta:hover { background: #185783; }

.kt-download-qr {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 12px;
  min-height: 278px;
  align-content: center;
  margin: 0;
  padding: 44px 25px;
  border: 1px solid var(--film-edge);
  border-radius: 12px;
  background: var(--film);
}
.kt-download-qr::before, .kt-download-qr::after {
  position: absolute;
  inset: auto 13px;
  height: 8px;
  content: '';
  background: repeating-linear-gradient(90deg, var(--film-hole) 0 12px, transparent 12px 24px);
}
.kt-download-qr::before { top: 11px; }
.kt-download-qr::after { bottom: 11px; }
.kt-download-code { display: block; width: 164px; height: 164px; border-radius: 5px; }
.kt-download-qr figcaption { color: var(--muted); text-align: center; font-size: 14px; line-height: 1.45; }
.kt-download h2 { margin: 0; font-weight: 750; font-size: clamp(23px, 3vw, 32px); letter-spacing: -.04em; }
.kt-download-features { margin-top: 33px; }
.kt-download-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-top: 16px; }
.kt-download-card { padding: 20px; background: var(--surface); border: 1px solid var(--line); border-radius: 16px; }
.kt-download-icon { width: 42px; height: 42px; border-radius: 11px; }
.kt-download-card h3 { margin: 14px 0 6px; font-size: 17px; letter-spacing: -.02em; }
.kt-download-card p, .kt-download-answers p { color: var(--muted); font-size: 14px; line-height: 1.6; margin: 0; }
.kt-download-faq {
  display: grid;
  grid-template-columns: 1fr 2fr;
  align-items: start;
  gap: 16px;
  margin-top: 33px;
  padding-top: 25px;
  border-top: 1px solid var(--line);
}
.kt-download-answers { display: grid; gap: 8px; }
.kt-download-answers details { background: var(--surface); border: 1px solid var(--line); border-radius: 11px; }
.kt-download-answers details:hover { background: var(--raised); }
.kt-download-answers summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 46px;
  padding: 12px 15px;
  cursor: pointer;
  list-style: none;
  font-size: 14px;
  font-weight: 650;
}
.kt-download-answers summary::-webkit-details-marker { display: none; }
.kt-download-answers summary svg { flex: none; color: var(--accent); }
.kt-download-answers [open] summary svg { transform: rotate(180deg); }
.kt-download-answers p { padding: 0 15px 14px; }
.kt-download-answers a { color: var(--accent); overflow-wrap: anywhere; }

@media (prefers-color-scheme: light) {
  .kt-download {
    --bg: #eef2f4;
    --surface: #fafcfd;
    --raised: #eaf0f4;
    --line: #d0dae1;
    --text: ${p.background};
    --muted: #425b6a;
    --accent: #2c5873;
    --tint: #e3ecf2;
    --hero: #dfeaf1;
    --film: #e2edf3;
    --film-edge: #c3d4df;
    --film-hole: #9eb5c5;
    color-scheme: light;
  }
}
@media (max-width: 799px) {
  .kt-download-hero { min-height: auto; grid-template-columns: 1fr; }
  .kt-download-qr { display: none; }
}
@media (max-width: 599px) {
  .kt-download-shell { width: calc(100% - 32px); }
  .kt-download-header .kt-download-shell { min-height: 61px; }
  .kt-download-main { padding-block: 18px 32px; }
  .kt-download-hero { padding: 24px 20px; border-radius: 18px; }
  .kt-download h1 { font-size: clamp(36px, 11.5vw, 62px); }
  .kt-download-hero-copy > p { margin: 14px 0 19px; font-size: 15px; }
  .kt-download a.kt-download-cta { width: 100%; }
  .kt-download-features, .kt-download-faq { margin-top: 24px; }
  .kt-download-grid, .kt-download-faq { grid-template-columns: 1fr; }
  .kt-download-grid { gap: 8px; margin-top: 12px; }
  .kt-download-card { display: flex; gap: 12px; padding: 14px; border-radius: 12px; }
  .kt-download-card h3 { margin: 0 0 4px; }
  .kt-download-faq { padding-top: 18px; gap: 12px; }
}
`;
