#!/usr/bin/env node
// ==========================================================================
// DURUM — projenin tek komutluk fotoğrafı
// ==========================================================================
// Çalıştır:
//   npm run durum           → çevrimdışı (git, migration, belge, borç sayıları)
//   npm run durum:canli     → + Supabase ve Worker'a TOKEN'SIZ sağlık sorguları
//   node scripts/durum.js --json
//
// 🔴 NEDEN VAR: her yeni oturum aynı soruları yeniden soruyordu — "hangi
// migration uygulandı, Worker'ın canlı sürümü ne, kaç dosya commit edilmedi,
// son HISTORY maddesi hangisi". Bunlar 8-10 ayrı komut ediyordu ve hepsi
// bağlam (token) yiyordu. Tek çıktıya indirildi.
//
// 🔒 GÜVENLİK: hiçbir sır YAZDIRILMAZ. `--canli` yalnızca `.env`'deki PUBLIC
// anon anahtarıyla okuma sorgusu atar ve Worker'a TOKEN'SIZ, gövdesi zararsız
// istekler yollar (veritabanına ve Trakt'a dokunmaz). Yazma YOK.
//
// ⚠️ Bağımlılık YOK — yalnızca Node'un kendi modülleri (mevcut scripts/
//    dosyalarıyla aynı CommonJS dili).

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const KOK = path.resolve(__dirname, '..');
const WORKER_KOK = path.resolve(KOK, '..', 'kaymaktv-feedback-worker');
const canli = process.argv.includes('--canli');
const jsonCikti = process.argv.includes('--json');

const rapor = { uretildi: new Date().toISOString(), depo: {}, sema: {}, belge: {}, borc: {}, canli: null };

// ── git ───────────────────────────────────────────────────────────────────
function gitBilgi(kok, ad) {
  try {
    const g = (...a) => execFileSync('git', ['-C', kok, ...a], { encoding: 'utf8' }).trim();
    const durum = g('status', '--porcelain');
    const satirlar = durum ? durum.split('\n') : [];
    return {
      ad,
      dal: g('rev-parse', '--abbrev-ref', 'HEAD'),
      sonCommit: g('log', '-1', '--format=%h %s'),
      degisen: satirlar.length,
      yeni: satirlar.filter((s) => s.startsWith('??')).length,
    };
  } catch (e) {
    return { ad, hata: e.message.split('\n')[0] };
  }
}
rapor.depo.istemci = gitBilgi(KOK, 'Kaymak');
if (fs.existsSync(WORKER_KOK)) rapor.depo.worker = gitBilgi(WORKER_KOK, 'worker');

// ── şema ──────────────────────────────────────────────────────────────────
try {
  const dizin = path.join(KOK, 'supabase', 'schema');
  const dosyalar = fs.readdirSync(dizin).filter((f) => /^\d{3}_.*\.sql$/.test(f)).sort();
  rapor.sema.sayi = dosyalar.length;
  rapor.sema.son = dosyalar.slice(-3);
  rapor.sema.sonrakiNumara = String(Number(dosyalar[dosyalar.length - 1].slice(0, 3)) + 1).padStart(3, '0');
} catch (e) {
  rapor.sema.hata = e.message;
}

// ── belgeler ──────────────────────────────────────────────────────────────
try {
  const docs = path.join(KOK, 'docs');
  const devirler = fs.readdirSync(docs).filter((f) => /^DEVIR_.*\.md$/.test(f)).sort();
  rapor.belge.guncelDevir = devirler[devirler.length - 1] || null;

  const history = fs.readFileSync(path.join(docs, 'HISTORY.md'), 'utf8');
  const basliklar = [...history.matchAll(/^## (\d+)\. (.*)$/gm)];
  const sonuncu = basliklar[basliklar.length - 1];
  rapor.belge.sonMadde = sonuncu ? { no: Number(sonuncu[1]), baslik: sonuncu[2].slice(0, 80) } : null;
  rapor.belge.historySatir = history.split('\n').length;
  rapor.belge.dizinVar = fs.existsSync(path.join(docs, 'HISTORY_INDEX.md'));
} catch (e) {
  rapor.belge.hata = e.message;
}

// ── açık borçlar ──────────────────────────────────────────────────────────
try {
  const backlog = fs.readFileSync(path.join(KOK, 'docs', 'BACKLOG.md'), 'utf8');
  const say = (re) => (backlog.match(re) || []).length;
  rapor.borc.C = say(/^### C\d+/gm);
  rapor.borc.D = say(/^\| D\d+ /gm);
  rapor.borc.kirmiziBayrak = say(/^🔴 /gm);
  const denetim = backlog.match(/^> Son denetim: (.*)$/m);
  rapor.borc.sonDenetim = denetim ? denetim[1].replace(/\*/g, '') : null;
} catch (e) {
  rapor.borc.hata = e.message;
}

// ── canlı sağlık (token'sız, salt okuma) ──────────────────────────────────
function envOku() {
  const cikti = {};
  for (const ad of ['.env', '.env.local']) {
    const yol = path.join(KOK, ad);
    if (!fs.existsSync(yol)) continue;
    for (const satir of fs.readFileSync(yol, 'utf8').split(/\r?\n/)) {
      const m = satir.match(/^(EXPO_PUBLIC_SUPABASE_URL|EXPO_PUBLIC_SUPABASE_ANON_KEY|EXPO_PUBLIC_KAYMAK_WORKER_URL)=(.*)$/);
      if (m && !cikti[m[1]]) cikti[m[1]] = m[2].trim().replace(/^"|"$/g, '');
    }
  }
  return cikti;
}

async function canliKontrol() {
  const env = envOku();
  const sonuc = { supabase: {}, worker: {} };
  const zamanAsimi = (ms) => AbortSignal.timeout(ms);

  // 🔑 42703 = kolon YOK (migration uygulanmadı) · 42501 = kolon VAR ama
  // anon'a kapalı (uygulandı). Bu ayrım `043`'ün uygulanıp uygulanmadığını
  // sır kullanmadan söylüyor (HISTORY M347).
  const supabaseSor = async (sorgu, yontem = 'GET', govde = {}) => {
    const url = `${env.EXPO_PUBLIC_SUPABASE_URL}/rest/v1/${sorgu}`;
    const r = await fetch(url, {
      method: yontem,
      headers: {
        apikey: env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
        ...(yontem === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(yontem === 'POST' ? { body: JSON.stringify(govde) } : {}),
      signal: zamanAsimi(10000),
    });
    const g = await r.text();
    const kod = (g.match(/"code":"([^"]+)"/) || [])[1] || null;
    return { http: r.status, kod };
  };

  if (env.EXPO_PUBLIC_SUPABASE_URL && env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    try {
      const bio = await supabaseSor('users?select=bio&limit=1');
      sonuc.supabase['043 (users.bio)'] = bio.kod === '42501' ? 'UYGULANDI' : bio.kod === '42703' ? 'YOK' : `? (${bio.kod || bio.http})`;
      const durum = await supabaseSor('user_import_state?select=user_id&limit=1');
      sonuc.supabase['044 (import tablolari)'] = durum.http === 200 ? 'UYGULANDI' : `? (${durum.kod || durum.http})`;
      // 🔑 RPC karsiligi ayni ayrim: PGRST202 = fonksiyon YOK · 42501 =
      // fonksiyon VAR ama anon cagiramiyor (= uygulandi + REVOKE calisiyor).
      // Govde bos `{}` -> p_limit varsayilana duser; zaten anon reddedilecek.
      const rpc = await supabaseSor('rpc/import_eksik_hedefler', 'POST');
      sonuc.supabase['046 (import RPC)'] = rpc.kod === '42501' ? 'UYGULANDI'
        : rpc.kod === 'PGRST202' ? 'YOK' : `? (${rpc.kod || rpc.http})`;
      const gen = await supabaseSor('catalog_entities?select=genres&limit=1');
      sonuc.supabase['047 (catalog genres)'] = gen.http === 200 ? 'UYGULANDI' : `? (${gen.kod || gen.http})`;
      const alt = await supabaseSor('user_import_state?select=alt_sinir&limit=1');
      sonuc.supabase['048 (alt_sinir)'] = alt.http === 200 ? 'UYGULANDI' : `? (${alt.kod || alt.http})`;
      // 🔴 Kolon ve FONKSİYON ayrı ayrı sorulur: `048`'in kolonu görünüp
      // RPC'leri görünmeyebilir — PostgREST şema önbelleği fonksiyonları
      // kendi listesinden çözüyor (M366; çözümü `NOTIFY pgrst, 'reload schema';`).
      //
      // 🔴🔴 GÖVDE BOŞ GÖNDERİLEMEZ (M370). PostgREST fonksiyonu GÖVDEDEKİ
      // ANAHTAR ADLARINA göre çözer. `046`'nın `p_limit`'i DEFAULT'lu
      // olduğu için `{}` sıfır argümanla eşleşir; `048`'in dört
      // parametresinin HİÇBİRİNDE default YOK → `{}` "parametresiz
      // import_kapanis_supur" arar, bulamaz ve önbellek TAZEYKEN BİLE
      // PGRST202 döner. Bu yanlış sonda iki oturum boyunca "ONBELLEK BAYAT"
      // diye hayalet kovalattı; fonksiyon başından beri canlıydı.
      // ⚠️ Bu yüzden argüman adları TAM verilir. Değerler sahte: `p_gorulen`
      // boş → `048`'in Guard 1'i zaten 0 döndürürdü, ama anon çağıramadığı
      // için gövde hiç çalışmaz; 42501 çözümlemenin BAŞARILI olduğunun kanıtı.
      const kap = await supabaseSor('rpc/import_kapanis_supur', 'POST', {
        p_user_id: '00000000-0000-0000-0000-000000000000',
        p_hedef: 'user_watchlist',
        p_tip: 'show',
        p_gorulen: [],
      });
      sonuc.supabase['048 (kapanis RPC)'] = kap.kod === '42501' ? 'UYGULANDI'
        : kap.kod === 'PGRST202' ? '🔴 ONBELLEK BAYAT -> NOTIFY pgrst' : `? (${kap.kod || kap.http})`;
    } catch (e) {
      sonuc.supabase.hata = e.message;
    }
  } else {
    sonuc.supabase.hata = '.env okunamadi';
  }

  if (env.EXPO_PUBLIC_KAYMAK_WORKER_URL) {
    const workerSor = async (yol, govde) => {
      const r = await fetch(`${env.EXPO_PUBLIC_KAYMAK_WORKER_URL}${yol}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(govde),
        signal: zamanAsimi(10000),
      });
      const j = await r.json().catch(() => ({}));
      return { http: r.status, mesaj: j.message || j.code || '' };
    };
    try {
      const imp = await workerSor('/import/trakt', {});
      sonuc.worker['/import/trakt (T5.2)'] = imp.mesaj.includes('traktAccessToken') ? 'CANLI' : `? (${imp.http} ${imp.mesaj})`;
      const bio = await workerSor('/account/profile', { traktAccessToken: 'x', bio: 5 });
      sonuc.worker['/account/profile bio (T4)'] = bio.mesaj.includes('açıklama') || bio.mesaj.includes('Geçersiz') ? 'CANLI' : `? (${bio.http} ${bio.mesaj})`;
      const blok = await workerSor('/feed/block', { traktAccessToken: 'x' });
      sonuc.worker['/feed/block userId (M339)'] = blok.mesaj.includes('blockedUserId') ? 'CANLI' : `? (${blok.http} ${blok.mesaj})`;
      // İç uçlar: sırsız istek 401 dönmeli. 404 = rota yok (deploy edilmedi),
      // 503 = PI_SYNC_SECRET tanımsız (uç kendini kapatmış).
      const k3 = await workerSor('/import/trakt', { traktAccessToken: 's', aile: 'puan_dizi', kapanis: true, yenile: true });
      sonuc.worker['/import/trakt kapanis (K3)'] = k3.mesaj.includes('birlikte') ? 'CANLI' : `? (${k3.http} ${k3.mesaj})`;
      for (const [yol, ad] of [['/import/eksikler', 'eksikler'], ['/import/bekleyenler', 'bekleyenler']]) {
        const r = await workerSor(yol, {});
        sonuc.worker[`${yol} (T5.3)`] = r.http === 401 ? 'CANLI'
          : r.http === 503 ? 'SIR YOK' : r.http === 404 ? 'ROTA YOK' : `? (${r.http})`;
      }
    } catch (e) {
      sonuc.worker.hata = e.message;
    }
  } else {
    sonuc.worker.hata = 'Worker adresi .env de yok';
  }
  return sonuc;
}

// ── yazdır ────────────────────────────────────────────────────────────────
function yazdir() {
  if (jsonCikti) {
    console.log(JSON.stringify(rapor, null, 2));
    return;
  }
  const satir = (a, b) => console.log(`  ${String(a).padEnd(34)} ${b}`);
  console.log('\n===================== KAYMAKTV DURUM =====================');

  console.log('\n[DEPOLAR]');
  for (const d of Object.values(rapor.depo)) {
    if (d.hata) satir(d.ad, `hata: ${d.hata}`);
    else satir(d.ad, `${d.dal} | ${d.degisen} degisik (${d.yeni} yeni) | ${d.sonCommit}`);
  }

  console.log('\n[SEMA]');
  satir('migration sayisi', rapor.sema.sayi);
  satir('son uc dosya', (rapor.sema.son || []).join(', '));
  satir('sonraki numara', rapor.sema.sonrakiNumara);

  console.log('\n[BELGELER]');
  satir('guncel devir', rapor.belge.guncelDevir);
  satir('son HISTORY maddesi', rapor.belge.sonMadde ? `M${rapor.belge.sonMadde.no} — ${rapor.belge.sonMadde.baslik}` : '?');
  satir('HISTORY satir', rapor.belge.historySatir);
  satir('madde dizini', rapor.belge.dizinVar ? 'docs/HISTORY_INDEX.md' : 'YOK → npm run tarihce:index');

  console.log('\n[ACIK BORCLAR]');
  satir('son denetim', rapor.borc.sonDenetim);
  satir('C maddesi', rapor.borc.C);
  satir('D maddesi', rapor.borc.D);
  satir('kirmizi bayrak', rapor.borc.kirmiziBayrak);

  if (rapor.canli) {
    console.log('\n[CANLI — tokensiz, salt okuma]');
    for (const [alan, degerler] of Object.entries(rapor.canli)) {
      for (const [k, v] of Object.entries(degerler)) satir(`${alan}: ${k}`, v);
    }
  } else {
    console.log('\n[CANLI]  atlandi — "npm run durum:canli" ile sorgula');
  }

  console.log('\n[TESTLER]  npm test  |  tests/ilerleme/*  |  tests/imza/*  |  worker: npx vitest run');
  console.log('==========================================================\n');
}

(async () => {
  if (canli) {
    try {
      rapor.canli = await canliKontrol();
    } catch (e) {
      rapor.canli = { hata: e.message };
    }
  }
  yazdir();
})();
