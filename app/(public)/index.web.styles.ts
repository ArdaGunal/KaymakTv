// F12 — index.web.tsx'ten çıkarıldı (400 satır kuralı, AI_RULES §1).
// Saf CSS string, mantık yok. `<style dangerouslySetInnerHTML>` ile
// enjekte ediliyor (bkz. index.web.tsx) — bu web-only sayfa StyleSheet.create
// yerine ham CSS kullanıyor, .reveal/.stats-panel gibi sınıf adları
// index.web.hooks.ts'teki DOM sorgularıyla SÖZLEŞME içinde, ikisi birlikte
// değişmeli.
export const LandingCSS = `
  :root{
    --bg:#0B1120;
    --bg-alt:#0B1120;
    --bg-card:#172033;
    --bg-card-2:#1A2438;
    --cream:#ffffff;
    --cream-soft:#f8fafc;
    --gold:#3B82F6;
    --gold-deep:#2563EB;
    --wine:#1D4ED8;
    --wine-bright:#60A5FA;
    --text:#f8fafc;
    --text-muted:#94A3B8;
    --text-dim:#64748B;
    --border:#2A364F;
    --border-soft:rgba(42, 54, 79, 0.5);
    --shadow-lg: 0 30px 80px rgba(0,0,0,.5);
    --shadow-sm: 0 10px 30px rgba(0,0,0,.35);
    --radius-lg: 22px;
    --radius-md: 14px;
    --ff-display: 'Inter', system-ui, sans-serif;
    --ff-body: 'Inter', system-ui, sans-serif;
    --ff-mono: 'JetBrains Mono', monospace;
    --container: 1220px;
  }

  *{ box-sizing:border-box; margin:0; padding:0; }
  html, body, #root {
    height: auto !important;
    min-height: 100vh !important;
    overflow: visible !important;
    overflow-x: hidden !important;
  }
  html{ scroll-behavior:smooth; }
  body{
    background:var(--bg);
    color:var(--text);
    font-family:var(--ff-body);
    font-size:16px;
    line-height:1.6;
    -webkit-font-smoothing:antialiased;
  }
  img,svg{ display:block; max-width:100%; }
  a{ color:inherit; text-decoration:none; cursor: pointer; }
  ul{ list-style:none; }
  button{ font-family:inherit; cursor:pointer; border:none; background:none; color:inherit; }
  .kaymak-container{ max-width:var(--container); margin:0 auto; padding:0 32px; }
  ::selection{ background:var(--gold); color:var(--bg); }

  :focus-visible{
    outline:2px solid var(--cream);
    outline-offset:3px;
    border-radius:4px;
  }

  .grain{
    position:fixed; inset:0; pointer-events:none; z-index:2; opacity:.045; mix-blend-mode:overlay;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  }

  .nav{
    position:fixed; top:0; left:0; right:0; z-index:100;
    background:rgba(11, 17, 32, .85);
    backdrop-filter:blur(14px) saturate(140%);
    border-bottom:1px solid var(--border-soft);
    transition:background .3s ease;
  }
  .nav .kaymak-container{ display:flex; align-items:center; justify-content:space-between; height:78px; }
  .logo{ display:flex; align-items:center; gap:10px; font-family:var(--ff-display); font-weight:700; font-size:23px; letter-spacing:-.01em; }
  .logo .dot{ width:9px; height:9px; border-radius:50%; background:linear-gradient(135deg,var(--cream),var(--gold)); box-shadow:0 0 14px rgba(59,130,246,.7); }
  .nav-links{ display:flex; align-items:center; gap:40px; }
  .nav-links a{
    font-size:14.5px; font-weight:500; color:var(--text-muted); transition:color .25s ease; position:relative;
  }
  .nav-links a:hover{ color:var(--cream-soft); }
  .nav-actions{ display:flex; align-items:center; gap:22px; }
  .link-ghost{ font-size:14.5px; font-weight:600; color:var(--text-muted); transition:color .2s ease; }
  .link-ghost:hover{ color:var(--cream); }

  /* Dil değiştirme butonu */
  .lang-btn{
    display:inline-flex; align-items:center; gap:6px;
    padding:7px 13px; border-radius:100px; font-size:12.5px; font-weight:700;
    background:rgba(59,130,246,.1); border:1px solid rgba(59,130,246,.22);
    color:#93c5fd; letter-spacing:.04em; cursor:pointer;
    transition:background .2s ease, border-color .2s ease;
  }
  .lang-btn:hover{ background:rgba(59,130,246,.18); border-color:rgba(59,130,246,.4); }

  .btn{
    display:inline-flex; align-items:center; justify-content:center; gap:8px;
    padding:13px 26px; border-radius:100px; font-size:14.5px; font-weight:700;
    transition:transform .25s cubic-bezier(.2,.8,.2,1), box-shadow .25s ease, background .25s ease;
    white-space:nowrap;
  }
  .btn-primary{
    background:linear-gradient(135deg,var(--gold-deep),var(--gold));
    color:#ffffff;
    box-shadow:0 8px 24px rgba(59,130,246,.28);
  }
  .btn-primary:hover{ transform:translateY(-2px); box-shadow:0 14px 34px rgba(59,130,246,.4); }
  .btn-outline{
    border:1px solid var(--border); color:var(--cream-soft);
  }
  .btn-outline:hover{ border-color:var(--gold); background:rgba(59,130,246,.08); transform:translateY(-2px); }

  .burger{ display:none; width:26px; height:20px; position:relative; }
  .burger span{ position:absolute; left:0; right:0; height:2px; background:var(--cream-soft); border-radius:2px; transition:.3s; }
  .burger span:nth-child(1){ top:0; }
  .burger span:nth-child(2){ top:9px; }
  .burger span:nth-child(3){ top:18px; }
  .burger.open span:nth-child(1){ transform:translateY(9px) rotate(45deg); }
  .burger.open span:nth-child(2){ opacity:0; }
  .burger.open span:nth-child(3){ transform:translateY(-9px) rotate(-45deg); }

  .mobile-menu{
    display:none; position:fixed; inset:78px 0 0 0; background:var(--bg); z-index:90;
    padding:40px 32px; flex-direction:column; gap:28px;
  }
  .mobile-menu.open{ display:flex; }
  .mobile-menu a{ font-family:var(--ff-display); font-size:28px; font-weight:600; }
  .mobile-menu .btn{ width:100%; }

  .ribbon-defs{ position:absolute; width:0; height:0; }

  .hero{
    position:relative; min-height:100vh; display:flex; align-items:center;
    padding:150px 0 100px; overflow:hidden;
  }
  .poster-field{
    position:absolute; inset:0; z-index:0;
    display:grid; grid-template-columns:repeat(7,1fr); gap:14px;
    padding:40px; opacity:.55; filter:blur(.5px);
    -webkit-mask-image:radial-gradient(ellipse 70% 60% at 50% 42%, transparent 35%, black 90%);
    mask-image:radial-gradient(ellipse 70% 60% at 50% 42%, transparent 35%, black 90%);
  }
  .poster{
    aspect-ratio:2/3; border-radius:6px; opacity:.5;
    background-size:cover;
  }
  .poster:nth-child(1){ background:linear-gradient(160deg,#2a3b4d,#0e1620); margin-top:40px;}
  .poster:nth-child(2){ background:linear-gradient(160deg,#1e3a8a,#0f172a); }
  .poster:nth-child(3){ background:linear-gradient(160deg,#2563eb,#0B1120); margin-top:70px;}
  .poster:nth-child(4){ background:linear-gradient(160deg,#3b82f6,#172033); }
  .poster:nth-child(5){ background:linear-gradient(160deg,#1e40af,#0B1120); margin-top:20px;}
  .poster:nth-child(6){ background:linear-gradient(160deg,#2563eb,#172033); }
  .poster:nth-child(7){ background:linear-gradient(160deg,#3b82f6,#0B1120); margin-top:60px;}
  .poster:nth-child(8){ background:linear-gradient(160deg,#1e3a8a,#172033); }
  .poster:nth-child(9){ background:linear-gradient(160deg,#2563eb,#0B1120); margin-top:35px;}
  .poster:nth-child(10){ background:linear-gradient(160deg,#1e40af,#172033); }
  .poster:nth-child(11){ background:linear-gradient(160deg,#3b82f6,#0B1120); margin-top:75px;}
  .poster:nth-child(12){ background:linear-gradient(160deg,#2563eb,#172033); }
  .poster:nth-child(13){ background:linear-gradient(160deg,#1e3a8a,#0B1120); margin-top:15px;}
  .poster:nth-child(14){ background:linear-gradient(160deg,#1e40af,#172033); }

  .hero-fade{
    position:absolute; inset:0; z-index:1;
    background:linear-gradient(180deg, rgba(11,17,32,.35) 0%, rgba(11,17,32,.75) 40%, var(--bg) 92%);
  }

  .hero-inner{ position:relative; z-index:2; text-align:center; max-width:900px; margin:0 auto; padding:0 24px;}
  .eyebrow{
    display:inline-flex; align-items:center; gap:10px; font-family:var(--ff-mono); font-size:12.5px;
    letter-spacing:.14em; text-transform:uppercase; color:var(--gold); margin-bottom:26px;
    padding:8px 18px; border:1px solid var(--border); border-radius:100px; background:rgba(59,130,246,.1);
  }
  .hero-ribbon-wrap{ position:relative; width:100%; max-width:640px; margin:0 auto -30px; }
  .hero h1{
    font-family:var(--ff-display); font-weight:700; font-size:clamp(42px,7vw,86px);
    line-height:1.03; letter-spacing:-.015em; color:var(--cream-soft);
  }
  .hero h1 em{ font-style:italic; font-weight:500; color:var(--gold); }
  .hero p.lead{
    margin:30px auto 0; max-width:560px; font-size:18.5px; color:var(--text-muted); line-height:1.65;
  }
  .hero-ctas{ display:flex; gap:16px; justify-content:center; margin-top:42px; flex-wrap:wrap; }
  .hero-ctas .btn{ padding:16px 32px; font-size:15.5px; }

  .scroll-cue{
    position:absolute; bottom:36px; left:50%; transform:translateX(-50%); z-index:2;
    display:flex; flex-direction:column; align-items:center; gap:10px; color:var(--text-dim);
    font-family:var(--ff-mono); font-size:11px; letter-spacing:.12em; text-transform:uppercase;
  }
  .scroll-cue .line{ width:1px; height:34px; background:linear-gradient(var(--gold),transparent); animation:scrollpulse 2s ease-in-out infinite; }
  @keyframes scrollpulse{ 0%,100%{ opacity:.3; } 50%{ opacity:1; } }

  .kaymak-section{ position:relative; padding:130px 0; }
  .section-head{ max-width:640px; margin:0 auto 70px; text-align:center; }
  .section-head .eyebrow{ margin-bottom:20px; }
  .section-head h2{
    font-family:var(--ff-display); font-weight:600; font-size:clamp(32px,4.2vw,48px); letter-spacing:-.01em; color:var(--cream-soft); line-height:1.15;
  }
  .section-head p{ margin-top:18px; color:var(--text-muted); font-size:17px; }

  .reveal{ opacity:0; transform:translateY(28px); transition:opacity .8s ease, transform .8s cubic-bezier(.2,.7,.2,1); }
  .reveal.in-view{ opacity:1; transform:translateY(0); }

  .bento{
    display:grid; grid-template-columns:repeat(12,1fr); gap:20px;
  }
  .bento-card{
    background:linear-gradient(165deg,var(--bg-card),var(--bg-card-2));
    border:1px solid var(--border); border-radius:var(--radius-lg);
    padding:38px; position:relative; overflow:hidden;
    transition:border-color .3s ease, transform .3s ease;
  }
  .bento-card:hover{ border-color:var(--border); transform:translateY(-4px); }
  .bento-card::before{
    content:''; position:absolute; top:-60%; right:-30%; width:280px; height:280px; border-radius:50%;
    background:radial-gradient(circle, rgba(59,130,246,.14), transparent 70%); pointer-events:none;
  }
  .card-icon{
    width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center;
    background:rgba(59,130,246,.1); border:1px solid var(--border); color:var(--cream); margin-bottom:22px;
  }
  .bento-card h3{ font-family:var(--ff-display); font-size:22px; font-weight:600; color:var(--cream-soft); margin-bottom:10px; }
  .bento-card p{ color:var(--text-muted); font-size:15px; line-height:1.6; }

  .c-log{ grid-column:span 7; }
  .c-search{ grid-column:span 5; }
  .c-stats{ grid-column:span 4; }
  .c-rate{ grid-column:span 4; }
  .c-lists{ grid-column:span 4; }
  .c-social{ grid-column:span 12; display:flex; align-items:center; gap:40px; }

  .mini-timeline{ display:flex; gap:8px; margin-top:26px; }
  .mini-timeline span{ flex:1; height:6px; border-radius:4px; background:var(--border); }
  .mini-timeline span.on{ background:linear-gradient(90deg,var(--gold-deep),var(--gold)); }

  .search-tags{ display:flex; flex-wrap:wrap; gap:8px; margin-top:24px; }
  .search-tags span{ font-family:var(--ff-mono); font-size:12px; padding:6px 12px; border-radius:100px; border:1px solid var(--border); color:var(--text-muted); }

  .mini-bars{ display:flex; align-items:flex-end; gap:7px; height:56px; margin-top:24px; }
  .mini-bars i{ flex:1; border-radius:4px 4px 0 0; background:linear-gradient(180deg,var(--gold),var(--gold-deep)); opacity:.85; }

  .mini-stars{ display:flex; gap:4px; margin-top:24px; color:var(--gold); font-size:18px; }

  .lists-stack{ display:flex; flex-direction:column; gap:8px; margin-top:22px; }
  .lists-stack div{ font-family:var(--ff-mono); font-size:12.5px; color:var(--text-muted); border:1px dashed var(--border); border-radius:8px; padding:9px 14px; }

  .avatar-row{ display:flex; }
  .avatar-row .av{
    width:52px; height:52px; border-radius:50%; border:3px solid var(--bg-card);
    margin-left:-14px; display:flex; align-items:center; justify-content:center;
    font-family:var(--ff-display); font-weight:600; font-size:16px; color:#ffffff;
  }
  .avatar-row .av:first-child{ margin-left:0; }
  .c-social .txt h3{ margin-bottom:8px; }
  .c-social .txt p{ max-width:480px; }

  .stats-panel{
    max-width:980px; margin:0 auto; background:linear-gradient(160deg,var(--bg-card),var(--bg-alt));
    border:1px solid var(--border); border-radius:28px; padding:52px; box-shadow:var(--shadow-lg);
    position:relative;
  }
  .stats-panel-head{ display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:44px; flex-wrap:wrap; gap:20px; }
  .stats-panel-head h4{ font-family:var(--ff-display); font-size:24px; font-weight:600; color:var(--cream-soft); }
  .stats-panel-head span{ font-family:var(--ff-mono); font-size:12px; color:var(--text-dim); letter-spacing:.08em; text-transform:uppercase; }
  .stat-grid{ display:grid; grid-template-columns:repeat(4,1fr); gap:0; border-top:1px solid var(--border); border-bottom:1px solid var(--border); margin-bottom:44px; }
  .stat-box{ padding:26px 20px; border-right:1px solid var(--border); text-align:center; }
  .stat-box:last-child{ border-right:none; }
  .stat-num{ font-family:var(--ff-mono); font-weight:600; font-size:clamp(28px,3.4vw,40px); color:var(--cream); }
  .stat-label{ font-size:13px; color:var(--text-muted); margin-top:8px; }
  .genre-bars{ display:flex; flex-direction:column; gap:16px; }
  .genre-row{ display:grid; grid-template-columns:140px 1fr 46px; align-items:center; gap:16px; }
  .genre-row span.name{ font-size:14px; color:var(--text-muted); }
  .genre-row span.pct{ font-family:var(--ff-mono); font-size:13px; color:var(--cream); text-align:right; }
  .bar-track{ height:9px; background:var(--bg-alt); border-radius:6px; overflow:hidden; border:1px solid var(--border-soft); }
  .bar-fill{ height:100%; width:0; border-radius:6px; background:linear-gradient(90deg,var(--wine),var(--gold-deep),var(--gold)); transition:width 1.4s cubic-bezier(.2,.7,.2,1); }

  .marquee-wrap{ position:relative; margin-top:10px; -webkit-mask-image:linear-gradient(90deg,transparent,black 8%,black 92%,transparent); mask-image:linear-gradient(90deg,transparent,black 8%,black 92%,transparent); }
  .marquee{ display:flex; gap:22px; width:max-content; animation:marquee 46s linear infinite; }
  .marquee:hover{ animation-play-state:paused; }
  @keyframes marquee{ from{ transform:translateX(0);} to{ transform:translateX(-50%);} }
  .trending-card{
    width:180px; flex-shrink:0; background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-md); padding:14px; text-align:center; transition: transform 0.3s, border-color 0.3s;
  }
  .trending-card:hover{ transform: scale(1.05); border-color: var(--gold); }
  .trending-card img{ width:100%; border-radius:8px; aspect-ratio:2/3; object-fit:cover; margin-bottom:12px; }
  .trending-card h3{ font-family:var(--ff-display); font-size:15px; color:var(--cream-soft); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-weight:600; margin-bottom: 4px; }
  .trending-card span{ font-family:var(--ff-mono); font-size:11px; color:var(--text-dim); text-transform:uppercase; letter-spacing:1px; }

  .cta-band{ text-align:center; padding:160px 0; position:relative; overflow:hidden; }
  .cta-band .ribbon-cta{ width:min(700px,90%); margin:0 auto 10px; opacity:.9; }
  .cta-band h2{ font-family:var(--ff-display); font-weight:700; font-size:clamp(34px,5vw,58px); color:var(--cream-soft); letter-spacing:-.01em; margin-bottom:20px;}
  .cta-band p{ color:var(--text-muted); font-size:17px; margin-bottom:38px; }

  footer{ border-top:1px solid var(--border-soft); padding:70px 0 34px; background:var(--bg); }
  .foot-top{ display:flex; justify-content:space-between; gap:60px; flex-wrap:wrap; margin-bottom:60px; }
  .foot-brand{ max-width:280px; }
  .foot-brand p{ color:var(--text-dim); font-size:14px; margin-top:14px; line-height:1.6; }
  .foot-cols{ display:flex; gap:64px; flex-wrap:wrap; }
  .foot-col h5{ font-family:var(--ff-mono); font-size:12px; text-transform:uppercase; letter-spacing:.1em; color:var(--text-dim); margin-bottom:18px; }
  .foot-col a{ display:block; color:var(--text-muted); font-size:14.5px; margin-bottom:12px; transition:color .2s; }
  .foot-col a:hover{ color:var(--cream); }
  .foot-bottom{ display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px; border-top:1px solid var(--border-soft); padding-top:28px; }
  .foot-bottom span{ font-size:13px; color:var(--text-dim); }
  .foot-social{ display:flex; gap:12px; }
  .foot-social a{ width:36px; height:36px; border-radius:50%; border:1px solid var(--border); display:flex; align-items:center; justify-content:center; color:var(--text-muted); transition:.2s; }
  .foot-social a:hover{ border-color:var(--gold); color:var(--cream); }

  @media (min-width:901px){ .desktop-only{ display:inline-flex; } }
  @media (max-width:900px){
    .desktop-only{ display:none; }
    .nav-links{ display:none; }
    .burger{ display:block; }
    .c-log,.c-search,.c-stats,.c-rate,.c-lists,.c-social{ grid-column:span 12; }
    .c-social{ flex-direction:column; text-align:center; }
    .stat-grid{ grid-template-columns:repeat(2,1fr); }
    .stat-box:nth-child(2){ border-right:none; }
    .stat-box{ border-bottom:1px solid var(--border); }
    .foot-top{ flex-direction:column; gap:40px; }
    .genre-row{ grid-template-columns:100px 1fr 40px; gap:10px; }
  }
  @media (max-width:560px){
    .kaymak-section{ padding:90px 0; }
    .hero{ padding:130px 0 80px; }
    .poster-field{ grid-template-columns:repeat(4,1fr); }
    .stats-panel{ padding:30px 22px; }
    .cta-band{ padding:110px 0; }
  }
  /* .hero, min-height:100vh olduğundan içeriği dikeyde ortalıyor; kısa
     viewport'larda (örn. küçük dizüstü pencereleri, açılır tarayıcı panelleri)
     ortalanmış içeriğin alt kenarı, kutunun dibine sabit (bottom:36px)
     duran "Kaydır" ipucuyla çakışabiliyordu — buton üstüne biniyordu.
     Bu yükseklik aralığında ipucu tamamen gizlenir. */
  @media (max-height:820px){
    .scroll-cue{ display:none; }
  }
`;
