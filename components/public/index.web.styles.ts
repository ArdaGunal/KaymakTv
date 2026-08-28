export const LandingCSS = `
  :root {
    --bg: #0e131d;
    --primary: #5c8cf5;
    --primary-dim: #3b82f6;
    --on-primary: #ffffff;
    --text-main: #dee2f1;
    --text-muted: #8c90a0;
    --text-dim: #c2c6d6;
    --card-bg: rgba(27, 32, 42, 0.7);
    --border-soft: rgba(255, 255, 255, 0.06);
    --font-main: 'Inter', system-ui, -apple-system, sans-serif;
    --container: 1040px;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }
  
  html, body, #root {
    min-height: 100vh;
    width: 100%;
    background: var(--bg);
    color: var(--text-main);
    font-family: var(--font-main);
    -webkit-font-smoothing: antialiased;
    scroll-behavior: smooth;
    overflow-x: hidden;
  }

  a { color: inherit; text-decoration: none; cursor: pointer; }
  ul { list-style: none; }
  button { font-family: inherit; cursor: pointer; border: none; background: none; color: inherit; }

  .kaymak-container { max-width: var(--container); margin: 0 auto; padding: 0 24px; }
  
  ::selection { background: rgba(92, 140, 245, 0.3); }

  .nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 100;
    transition: all 0.3s ease;
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
  }
  .nav .kaymak-container {
    display: flex; align-items: center; justify-content: space-between; height: 64px;
  }
  .logo {
    display: flex; align-items: center; gap: 8px; font-size: 17px; font-weight: 800; color: var(--primary); letter-spacing: -0.4px;
  }
  .logo .dot { width: 8px; height: 8px; background: var(--primary); border-radius: 50%; }
  
  .nav-center a { color: var(--text-dim); font-size: 14px; font-weight: 500; padding: 6px 12px; transition: color 0.2s; }
  .nav-center a:hover { color: var(--primary); }

  .nav-actions { display: flex; align-items: center; gap: 12px; }
  .lang-btn {
    display: flex; align-items: center; gap: 6px;
    padding: 8px 12px; border-radius: 20px;
    background: rgba(27, 32, 42, 0.8); border: 1px solid var(--border-soft);
    color: var(--text-dim); font-size: 12px; font-weight: 700; letter-spacing: 0.5px;
    transition: background 0.2s, color 0.2s;
  }
  .lang-btn:hover { background: rgba(27, 32, 42, 1); color: var(--text-main); }
  
  .btn-primary {
    display: flex; align-items: center; gap: 8px;
    background: linear-gradient(135deg, var(--primary), var(--primary-dim));
    color: var(--on-primary); font-size: 14px; font-weight: 700;
    padding: 10px 20px; border-radius: 12px;
    box-shadow: 0 4px 14px rgba(37, 99, 235, 0.25);
    transition: transform 0.2s, box-shadow 0.2s;
  }
  .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(37, 99, 235, 0.35); }

  .hero {
    position: relative; padding: 160px 0 100px; text-align: center;
    display: flex; flex-direction: column; align-items: center;
    overflow: hidden;
  }
  .hero-poster-wall {
    position: absolute; top: 0; left: -6%; right: -6%; height: 100%;
    display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px;
    pointer-events: none; z-index: 0;
  }
  .hero-poster-wall img {
    width: 100%; aspect-ratio: 2 / 3; object-fit: cover; border-radius: 6px;
    filter: blur(1px) brightness(0.55) saturate(0.9);
  }
  .hero-poster-fade {
    position: absolute; inset: 0; z-index: 0; pointer-events: none;
    background:
      linear-gradient(180deg, rgba(14,19,29,0.5) 0%, rgba(14,19,29,0.85) 55%, var(--bg) 92%),
      linear-gradient(90deg, var(--bg) 0%, rgba(14,19,29,0.25) 15%, rgba(14,19,29,0.25) 85%, var(--bg) 100%);
  }
  .hero-glow {
    position: absolute; top: 0; left: 50%; transform: translateX(-50%);
    width: 100%; height: 400px; pointer-events: none; z-index: 1;
    background: radial-gradient(circle at top, rgba(59, 130, 246, 0.04) 0%, transparent 60%);
  }
  
  .eyebrow-badge {
    display: inline-flex; align-items: center; gap: 8px;
    background: rgba(27, 32, 42, 0.9); border: 1px solid var(--border-soft);
    padding: 8px 16px; border-radius: 100px; margin-bottom: 28px;
    color: #7aa2f7; font-size: 12px; font-weight: 700; letter-spacing: 1.4px;
    position: relative; z-index: 1;
  }
  
  .hero h1 {
    font-size: 64px; font-weight: 800; line-height: 1.1; letter-spacing: -1.5px; margin-bottom: 24px; position: relative; z-index: 1;
  }
  .hero h1 em { font-style: italic; color: var(--primary); }
  
  .hero p {
    font-size: 18px; color: var(--text-dim); max-width: 540px; margin: 0 auto 40px; line-height: 1.6; position: relative; z-index: 1;
  }
  
  .hero-ctas {
    display: flex; justify-content: center; gap: 16px; position: relative; z-index: 1;
  }
  .btn-secondary {
    display: flex; align-items: center; gap: 8px;
    background: rgba(27, 32, 42, 0.8); border: 1px solid var(--border-soft);
    color: var(--text-dim); font-size: 15px; font-weight: 600;
    padding: 14px 28px; border-radius: 12px;
    transition: background 0.2s, border-color 0.2s;
  }
  .btn-secondary:hover { background: rgba(35, 41, 54, 0.9); border-color: rgba(255, 255, 255, 0.12); }
  
  .features { padding: 80px 0 120px; text-align: center; }
  .features-head { margin-bottom: 60px; display: flex; flex-direction: column; align-items: center; }
  .features-head .eyebrow {
    display: inline-block; background: rgba(27, 32, 42, 0.9); border: 1px solid var(--border-soft);
    padding: 6px 14px; border-radius: 100px; margin-bottom: 20px;
    color: #7aa2f7; font-size: 11px; font-weight: 700; letter-spacing: 1.4px;
  }
  .features-head h2 { font-size: 36px; font-weight: 800; letter-spacing: -0.8px; margin-bottom: 16px; }
  .features-head p { font-size: 16px; color: var(--text-dim); max-width: 500px; margin: 0 auto; line-height: 1.6; }

  .bento-grid {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; text-align: left;
  }
  .bento-card {
    background: var(--card-bg); border: 1px solid var(--border-soft);
    border-radius: 16px; padding: 24px; position: relative; overflow: hidden;
    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
    transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    box-shadow: 0 4px 24px -6px rgba(0,0,0,0.5);
    display: flex; flex-direction: column; gap: 14px;
  }
  .bento-card:hover { transform: scale(1.02); }
  .bento-card .corner-glow {
    position: absolute; top: -40px; right: -40px; width: 120px; height: 120px;
    border-radius: 50%; filter: blur(30px); opacity: 0.15; pointer-events: none;
  }
  .bento-card .icon-wrap {
    width: 48px; height: 48px; border-radius: 12px;
    display: flex; align-items: center; justify-content: center; margin-bottom: 4px;
  }
  .bento-card h3 { font-size: 16px; font-weight: 700; color: var(--text-main); letter-spacing: -0.2px; }
  .bento-card p { font-size: 14px; color: var(--text-muted); line-height: 1.5; }

  .cta-band { padding: 20px 0 100px; display: flex; justify-content: center; position: relative; }
  .cta-card {
    width: 100%; max-width: 560px; text-align: center;
    background: var(--card-bg); border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 24px; overflow: hidden;
    box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.5);
  }
  .cta-card-head { padding: 40px 32px 28px; display: flex; flex-direction: column; align-items: center; }
  .cta-card-head .eyebrow {
    display: inline-block; background: rgba(27, 32, 42, 0.9); border: 1px solid var(--border-soft);
    padding: 6px 14px; border-radius: 100px; margin-bottom: 18px;
    color: #7aa2f7; font-size: 11px; font-weight: 700; letter-spacing: 1.4px;
  }
  .cta-card-head h2 { font-size: 30px; font-weight: 800; letter-spacing: -0.6px; margin-bottom: 12px; line-height: 1.25; }
  .cta-card-head h2 em { font-style: italic; color: var(--primary); }
  .cta-card-head p { font-size: 15px; color: var(--text-muted); }
  .cta-divider { height: 1px; background: rgba(255,255,255,0.06); }
  .cta-actions { display: flex; gap: 12px; padding: 24px 32px; }
  .cta-actions .btn-primary, .cta-actions .btn-secondary { flex: 1; justify-content: center; }
  .cta-footnote { color: #424654; font-size: 12px; padding-bottom: 24px; letter-spacing: 0.2px; }
  @media (max-width: 600px) {
    .cta-actions { flex-direction: column; padding: 20px 24px; }
    .cta-card-head { padding: 32px 20px 24px; }
    .cta-card-head h2 { font-size: 24px; }
  }

  footer {
    background: #090e18; padding: 60px 0 40px; border-top: 1px solid rgba(255,255,255,0.03);
    text-align: center;
  }
  .footer-logo {
    display: inline-flex; align-items: center; gap: 8px; font-size: 20px; font-weight: 800; color: var(--text-main); margin-bottom: 24px;
  }
  .footer-logo .dot { width: 8px; height: 8px; background: var(--primary); border-radius: 50%; opacity: 0.8; }
  
  .footer-links {
    display: flex; justify-content: center; gap: 24px; margin-bottom: 32px;
  }
  .footer-links a { color: var(--text-muted); font-size: 14px; font-weight: 600; transition: color 0.2s; }
  .footer-links a:hover { color: var(--primary); }
  
  .footer-bottom {
    display: flex; flex-direction: column; align-items: center; gap: 12px;
  }
  .copyright { color: #424654; font-size: 12px; }
  .data-secure { display: flex; align-items: center; gap: 6px; color: #424654; font-size: 12px; }

  .reveal { opacity: 0; transform: translateY(20px); transition: opacity 0.8s ease, transform 0.8s ease; }
  .reveal.in-view { opacity: 1; transform: translateY(0); }

  @media (max-width: 900px) {
    .bento-grid { grid-template-columns: repeat(2, 1fr); }
    .hero h1 { font-size: 48px; }
    .hero-poster-wall { grid-template-columns: repeat(5, 1fr); }
  }
  @media (max-width: 600px) {
    .kaymak-container { padding: 0 16px; }
    .logo { font-size: 15px; }
    .nav-actions { gap: 8px; }
    .nav-actions .btn-primary { padding: 8px 12px; font-size: 12px; }
    .bento-grid { grid-template-columns: 1fr; }
    .hero h1 { font-size: 32px; word-break: break-word; }
    .hero-ctas { flex-direction: column; width: 100%; }
    .hero-ctas button { width: 100%; justify-content: center; }
    .nav-center { display: none; }
    .hero-poster-wall { grid-template-columns: repeat(3, 1fr); }
  }
`;
