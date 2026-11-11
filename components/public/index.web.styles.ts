import { MOBILE_PALETTE as p } from '../../constants/mobilePalette';

/** Karşılama ekranı: ortak TARDIS tokenları, telefon → masaüstü. */
export const LandingCSS = `
:root { --bg:${p.background}; --surface:${p.surface}; --text:${p.text}; --muted:${p.muted}; --steel:${p.steel}; --border:${p.border}; --primary:${p.primary}; }
* { box-sizing:border-box; }
html,body,#root { margin:0; min-height:100%; background:var(--bg); color:var(--text); font-family:system-ui,-apple-system,sans-serif; }
button { font:inherit; color:inherit; cursor:pointer; border:0; background:none; }
button:focus-visible { outline:2px solid var(--steel); outline-offset:5px; }
.kaymak-container { width:min(100%,1120px); margin:auto; padding:0 28px; }
.nav { position:fixed; inset:0 0 auto; z-index:10; backdrop-filter:blur(18px); }
.nav .kaymak-container { height:76px; display:flex; align-items:center; justify-content:space-between; gap:16px; }
.logo,.footer-logo { display:flex; align-items:center; gap:10px; font-weight:750; font-size:20px; letter-spacing:-.6px; }
.dot { width:10px; height:10px; border-radius:3px; background:var(--steel); }
.nav-center button { color:var(--muted); }
.nav-actions { display:flex; align-items:center; gap:12px; }
.lang-btn { display:flex; align-items:center; gap:6px; padding:12px; min-height:44px; border:1px solid var(--border); border-radius:12px; font-size:12px; }
.btn-primary,.btn-secondary { display:inline-flex; align-items:center; justify-content:center; gap:10px; min-height:50px; padding:14px 24px; border-radius:12px; font-size:15px; font-weight:650; transition:background .18s; }
.btn-primary { background:var(--primary); color:var(--text); border:1px solid #285c87; }
.btn-primary:hover { background:#185783; }
.btn-secondary { border:1px solid var(--border); background:var(--surface); color:var(--text); }
.btn-secondary:hover { background:${p.raised}; }
.hero { position:relative; overflow:hidden; padding:164px 0 90px; text-align:center; }
.hero-poster-wall { position:absolute; inset:0 -4%; display:grid; grid-template-columns:repeat(7,1fr); gap:12px; pointer-events:none; }
.hero-poster-wall img { width:100%; aspect-ratio:2/3; object-fit:cover; border-radius:10px; filter:saturate(.45) brightness(.5); }
.hero-poster-fade { position:absolute; inset:0; background:linear-gradient(180deg,rgba(12,29,43,.7),rgba(12,29,43,.92) 65%,var(--bg)); }
.hero-glow { display:none; }
.hero .kaymak-container { position:relative; }
.eyebrow-badge { display:inline-flex; align-items:center; gap:8px; font-size:11px; letter-spacing:1.5px; color:var(--steel); padding:9px 14px; border:1px solid var(--border); background:var(--surface); border-radius:30px; }
h1 { font-size:clamp(36px,5.5vw,68px); line-height:1.12; letter-spacing:-2px; margin:26px auto 22px; font-weight:750; }
h1 em,h2 em { color:var(--steel); font-style:normal; }
.hero p { max-width:480px; margin:0 auto; color:${p.body}; font-size:18px; line-height:1.7; }
.hero-ctas { display:flex; justify-content:center; gap:12px; margin-top:30px; }
.features { padding-top:28px; padding-bottom:48px; }
.features-head { text-align:center; margin-bottom:28px; }
.eyebrow { font-size:10px; letter-spacing:1.6px; color:var(--steel); }
h2 { font-size:clamp(25px,3vw,36px); letter-spacing:-.7px; margin:12px 0; }
.features-head p,.cta-card p { color:var(--muted); line-height:1.65; }
.bento-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:16px; }
.bento-card { padding:28px; border:1px solid var(--border); border-radius:18px; background:var(--surface); }
.icon-wrap { display:inline-flex; padding:12px; background:${p.steelTint}; border-radius:12px; }
h3 { margin:22px 0 10px; font-size:20px; letter-spacing:-.3px; }
.bento-card p { margin:0; font-size:15px; line-height:1.7; color:var(--muted); }
.cta-band { padding-top:24px; padding-bottom:60px; }
.cta-card { padding:32px; border-top:1px solid var(--border); display:grid; grid-template-columns:1fr auto; gap:20px; align-items:center; }
.cta-card-head p { margin-bottom:0; }
.cta-actions { display:flex; flex-direction:column; gap:10px; }
.cta-divider { display:none; }
.cta-footnote { grid-column:1/-1; font-size:12px; margin:0; }
footer { border-top:1px solid var(--border); padding:28px 0; }
footer .kaymak-container { display:flex; flex-wrap:wrap; justify-content:space-between; gap:24px; }
.footer-links { display:flex; flex-wrap:wrap; gap:20px; font-size:13px; color:var(--muted); }
.footer-links button { min-height:44px; }
.footer-bottom { flex-basis:100%; color:var(--muted); font-size:12px; }
@media(max-width:640px) {
.kaymak-container { padding-left:20px; padding-right:20px; }
.nav .kaymak-container { height:68px; gap:8px; }
.nav-center { display:none; }
.nav-actions { gap:6px; }
.nav-actions .btn-primary { padding:10px 12px; min-height:44px; font-size:12px; }
.logo { font-size:17px; }
.hero { padding:112px 0 48px; }
h1 { letter-spacing:-1px; }
.hero p { font-size:16px; }
.hero-ctas { flex-direction:column; max-width:380px; margin:26px auto 0; }
.hero-poster-wall { grid-template-columns:repeat(4,1fr); }
.bento-grid { grid-template-columns:1fr; gap:12px; }
.bento-card { padding:22px; }
h3 { margin-top:16px; }
.features { padding-top:12px; padding-bottom:20px; }
.cta-card { grid-template-columns:1fr; padding:28px 0 0; }
.cta-band { padding-bottom:36px; }
}
@media(prefers-reduced-motion:reduce) { * { scroll-behavior:auto!important; transition:none!important; animation:none!important; } }
`;
