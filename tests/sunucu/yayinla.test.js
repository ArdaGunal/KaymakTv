// ==========================================================================
// scripts/sunucu/yayinla.sh + derleme-env.js (GNL-SERVER taşıması · D7)
// ==========================================================================
// 🔴 İDDİALAR: npm ci yalnız kilit/paket/yama değişince · npm ci çalıştıysa servis HER ZAMAN ve
// derlemeden ÖNCE yeniden başlar (danışman 002 §3.3) · yalnız istemci değişince yeniden başlatma yok ·
// derleme düşerse eski `dist` YERİNDE, betik hata verir · sağlık 200 değilse hata · KURU kip hiçbir
// şey değiştirmez · YAYIN_DERLEME_ENV derlemeyi sarmalayıcıdan geçirir · sarmalayıcı yalnız
// EXPO_PUBLIC_* geçirir, değer yazdırmaz.
// Ağ / servis YOK: git, npm, npx, sudo, curl, id, node SAHTE (geçici PATH); gerçek depo değişmez.

const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');
const { baslat, PROJE_KOKU } = require('../yardimci');
const { bashBul, bashKos } = require('./bash');

const T = baslat('YAYIN BETIGI (D7)', { kokOneki: 'yayinla-' });
const BETIK = path.join(PROJE_KOKU, 'scripts', 'sunucu', 'yayinla.sh');
const SARMAL = path.join(PROJE_KOKU, 'scripts', 'sunucu', 'derleme-env.js');
const bash = bashBul();

// Bash'e verilecek yollar ileri eğik çizgili olsun (Git Bash `C:/...` biçimini anlar).
const b = (p) => p.replace(/\\/g, '/');

const SAHTE = {
  git: `echo "git $*" >> "$KAYIT"
case "$1" in
  rev-parse) if [ -f "$DURUM/cekildi" ]; then echo bbbbbbb2222222; else echo aaaaaaa1111111; fi ;;
  pull) touch "$DURUM/cekildi" ;;
  diff) printf '%s' "$SAHTE_DEGISEN" ;;
esac`,
  npm: `echo "npm $*" >> "$KAYIT"; [ "$1" = ci ] && mkdir -p node_modules; exit 0`,
  npx: `echo "npx $* EXPO_PUBLIC_X=\${EXPO_PUBLIC_X:-yok}" >> "$KAYIT"
# Gerçekçi: düşen derleme de çıktı dizinine YARIM dosya bırakır.
while [ $# -gt 0 ]; do if [ "$1" = --output-dir ]; then mkdir -p "$2"; echo yarim > "$2/parca.js"; [ "\${SAHTE_NPX_KOD:-0}" != 0 ] && exit "$SAHTE_NPX_KOD"; echo yeni > "$2/index.html"; fi; shift; done`,
  node: `echo "node $*" >> "$KAYIT"; shift; shift; shift; exec "$@"`,
  sudo: `echo "sudo $*" >> "$KAYIT"`,
  curl: `echo "curl" >> "$KAYIT"; printf '%s' "\${SAHTE_SAGLIK:-200}"`,
  id: `echo 1000`,
};

function kur() {
  const kok = fs.mkdtempSync(path.join(os.tmpdir(), 'yayinla-senaryo-'));
  const bin = path.join(kok, 'bin');
  const app = path.join(kok, 'app');
  const durum = path.join(kok, 'durum');
  for (const d of [bin, path.join(app, 'dist'), path.join(app, 'node_modules'), durum]) fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(app, 'dist', 'index.html'), 'ESKI');
  for (const [ad, govde] of Object.entries(SAHTE)) fs.writeFileSync(path.join(bin, ad), `#!/usr/bin/env bash\n${govde}\n`, { mode: 0o755 });
  return { kok, bin, app, durum, kayit: path.join(kok, 'kayit.txt') };
}

function kos(s, { degisen = '', argumanlar = [], ortam = {} } = {}) {
  const env = {
    HOME: b(s.kok), KAYIT: b(s.kayit), DURUM: b(s.durum), SAHTE_DEGISEN: degisen,
    KAYMAK_APP: b(s.app), KAYMAK_NODE_BIN: b(s.bin), YAYIN_SAGLIK_SN: '1', ...ortam,
  };
  env.PATH = process.env.PATH;
  // Sahte dizin PATH'in en önünde (Git Bash'in kendi dizinlerinden de önce) — bash.js `bashKos`.
  const r = bashKos(bash, BETIK, argumanlar, env, s.bin);
  const kayit = fs.existsSync(s.kayit) ? fs.readFileSync(s.kayit, 'utf8').trim().split('\n') : [];
  return { kod: r.status, cikti: (r.stdout || '') + (r.stderr || ''), kayit };
}

const sira = (kayit, desen) => kayit.findIndex((s) => desen.test(s));
const icerik = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8').trim() : null);
const temizle = (s) => fs.rmSync(s.kok, { recursive: true, force: true });

(async () => {
  T.H('derleme-env.js (sarmalayici)');
  const { ayir, herkeseAcikAnahtarlar } = require(SARMAL);
  T.ok('Arguman ayirma: <dosya> -- <komut> zorunlu', ayir(['f', '--', 'k', 'a']).komut === 'k' && ayir(['f', 'k']) === null && ayir(['f', '--']) === null);
  const acik = herkeseAcikAnahtarlar('EXPO_PUBLIC_A=1\nTRAKT_CLIENT_SECRET=gizli\nPI_SYNC_SECRET=gizli2\nEXPO_PUBLIC_B="iki kelime"\n');
  T.ok('🔒 Yalniz EXPO_PUBLIC_* gecer, sirlar alt surece GITMEZ', Object.keys(acik).join() === 'EXPO_PUBLIC_A,EXPO_PUBLIC_B' && acik.EXPO_PUBLIC_B === 'iki kelime');
  const envDosya = path.join(T.kok, 'derleme.env');
  fs.writeFileSync(envDosya, 'EXPO_PUBLIC_X=derlemeDegeri\nGIZLI=cokgizli\n', { mode: 0o600 });
  const s1 = spawnSync(process.execPath, [SARMAL, envDosya, '--', process.execPath, '-e',
    "process.stdout.write('X=' + process.env.EXPO_PUBLIC_X + ' G=' + (process.env.GIZLI || 'yok')); process.exit(7)"],
  { encoding: 'utf8', env: { ...process.env, EXPO_PUBLIC_X: 'provaDegeri' } });
  T.ok('Dosyadaki EXPO_PUBLIC_ degeri ortamdakini EZER (prova env i pakete girmez)', s1.stdout.includes('X=derlemeDegeri'), s1.stdout.trim());
  T.ok('🔒 Sir anahtari komuta gecmedi', s1.stdout.includes('G=yok'));
  T.ok('Komutun cikis kodu aynen doner', s1.status === 7, String(s1.status));
  T.ok('🔒 Deger YAZDIRILMAZ (yalniz anahtar sayisi)', /1 EXPO_PUBLIC_ anahtari/.test(s1.stdout) && !s1.stdout.replace(/X=derlemeDegeri/, '').includes('derlemeDegeri'));
  const s2 = spawnSync(process.execPath, [SARMAL, path.join(T.kok, 'yok.env'), '--', 'x'], { encoding: 'utf8' });
  T.ok('Dosya yoksa cikis 2', s2.status === 2);

  if (!bash) {
    T.ok('bash bulunamadi -> yayinla.sh testleri ATLANDI (sunucuda/Pi de kosar)', true);
    T.bitir();
    return;
  }

  T.H('Soz dizimi + KURU');
  const n = spawnSync(bash, ['-n', b(BETIK)], { encoding: 'utf8' });
  T.ok('bash -n gecer', n.status === 0, (n.stderr || '').trim());
  const k = kur();
  const kuru = kos(k, { degisen: 'server/x.js', ortam: { YAYIN_KURU: '1' } });
  T.ok('KURU: cikis 0, adimlar yazildi', kuru.kod === 0 && /KURU git pull --ff-only/.test(kuru.cikti), kuru.cikti.split('\n').slice(-3).join(' | '));
  T.ok('🔴 KURU: pull/npm/npx/sudo/curl CALISMADI, dist ayni', !kuru.kayit.some((s) => /^(git pull|npm|npx|sudo|curl)/.test(s))
    && icerik(path.join(k.app, 'dist', 'index.html')) === 'ESKI');
  temizle(k);

  T.H('Yalniz istemci degisti');
  const i = kur();
  const ri = kos(i, { degisen: 'app/(tabs)/index.tsx\ncomponents/X.tsx' });
  T.ok('Cikis 0', ri.kod === 0, ri.cikti.trim().split('\n').pop());
  T.ok('npm ci YOK, yeniden baslatma YOK', !ri.kayit.some((s) => /^npm ci/.test(s)) && !ri.kayit.some((s) => /^sudo/.test(s)), ri.kayit.join(' | '));
  T.ok('Web paketi dist.yeni ye derlendi ve dist ile yer degisti', ri.kayit.some((s) => /^npx expo export --platform web --output-dir dist\.yeni/.test(s))
    && icerik(path.join(i.app, 'dist', 'index.html')) === 'yeni' && !fs.existsSync(path.join(i.app, 'dist.yeni')) && !fs.existsSync(path.join(i.app, 'dist.eski')));
  T.ok('Saglik soruldu', ri.kayit.includes('curl'));
  temizle(i);

  T.H('Sunucu kodu degisti');
  const sv = kur();
  const rs = kos(sv, { degisen: 'server/saglik.js' });
  T.ok('npm ci yok, servis TAM BIR KEZ ve derlemeden SONRA yeniden basladi', rs.kod === 0 && !rs.kayit.some((s) => /^npm ci/.test(s))
    && rs.kayit.filter((s) => s === 'sudo -n systemctl restart kaymaktv').length === 1 && sira(rs.kayit, /^sudo/) > sira(rs.kayit, /^npx/), rs.kayit.join(' | '));
  temizle(sv);

  T.H('Kilit dosyasi degisti (npm ci)');
  const l = kur();
  const rl = kos(l, { degisen: 'package-lock.json' });
  T.ok('npm ci calisti', rl.kod === 0 && rl.kayit.includes('npm ci'), rl.kayit.join(' | '));
  T.ok('🔴 npm ci den HEMEN sonra, derlemeden ONCE yeniden baslatma', sira(rl.kayit, /^npm ci/) < sira(rl.kayit, /^sudo/) && sira(rl.kayit, /^sudo/) < sira(rl.kayit, /^npx/));
  T.ok('Yeniden baslatma TEK (iki kez degil)', rl.kayit.filter((s) => /^sudo/.test(s)).length === 1);
  temizle(l);
  const p = kur();
  T.ok('patches/ degisince de npm ci (patch-package)', kos(p, { degisen: 'patches/expo+1.patch' }).kayit.includes('npm ci'));
  temizle(p);
  const nm = kur();
  fs.rmSync(path.join(nm.app, 'node_modules'), { recursive: true });
  T.ok('node_modules yoksa npm ci + yeniden baslatma', (() => { const r = kos(nm); return r.kayit.includes('npm ci') && r.kayit.some((s) => /^sudo/.test(s)); })());
  temizle(nm);

  T.H('Derleme duserse');
  const d = kur();
  const rd = kos(d, { degisen: 'server/x.js\napp/y.tsx', ortam: { SAHTE_NPX_KOD: '1' } });
  T.ok('Betik HATA verir', rd.kod !== 0 && /DERLEME DUSTU/.test(rd.cikti), String(rd.kod));
  T.ok('🔴 Eski dist YERINDE, yarim dist.yeni temizlendi', icerik(path.join(d.app, 'dist', 'index.html')) === 'ESKI' && !fs.existsSync(path.join(d.app, 'dist.yeni')));
  T.ok('Npm ci yokken servis yeniden BASLATILMADI (eski kod + eski paket tutarli)', !rd.kayit.some((s) => /^sudo/.test(s)));
  temizle(d);
  const dl = kur();
  const rdl = kos(dl, { degisen: 'package-lock.json', ortam: { SAHTE_NPX_KOD: '1' } });
  T.ok('🔴 Kilit degisti + derleme dustu: npm ci sonrasi yeniden baslatma YINE yapildi', rdl.kod !== 0 && rdl.kayit.some((s) => /^sudo/.test(s)), rdl.kayit.join(' | '));
  temizle(dl);

  T.H('Saglik + secenekler');
  const h = kur();
  const rh = kos(h, { degisen: 'server/x.js', ortam: { SAHTE_SAGLIK: '503' } });
  T.ok('Saglik 503 -> betik hata verir', rh.kod !== 0 && /saglik 503/.test(rh.cikti), rh.cikti.trim().split('\n').pop());
  temizle(h);
  const y = kur();
  const ry = kos(y, { argumanlar: ['--yeniden'] });
  T.ok('--yeniden, degisiklik yok: yeniden baslatma var, derleme/npm yok', ry.kod === 0 && ry.kayit.some((s) => /^sudo/.test(s)) && !ry.kayit.some((s) => /^(npx|npm)/.test(s)), ry.kayit.join(' | '));
  temizle(y);
  const bil = kur();
  T.ok('Bilinmeyen secenek -> cikis 2', kos(bil, { argumanlar: ['--hizli'] }).kod === 2);
  temizle(bil);

  T.H('YAYIN_DERLEME_ENV');
  const e = kur();
  const ozgun = path.join(e.kok, 'env.pi');
  fs.writeFileSync(ozgun, 'EXPO_PUBLIC_X=ozgun\n', { mode: 0o600 });
  const re = kos(e, { degisen: 'app/x.tsx', ortam: { YAYIN_DERLEME_ENV: b(ozgun) } });
  T.ok('Derleme sarmalayicidan gecti (node derleme-env.js <dosya> -- npx expo export ...)', re.kod === 0
    && re.kayit.some((s) => /^node .*scripts\/sunucu\/derleme-env\.js .*env\.pi -- npx expo export --platform web --output-dir dist\.yeni/.test(s)), re.kayit.join(' | '));
  temizle(e);
  const eyok = kur();
  T.ok('YAYIN_DERLEME_ENV okunamiyorsa hicbir sey yapmadan cikis 2', (() => { const r = kos(eyok, { degisen: 'app/x.tsx', ortam: { YAYIN_DERLEME_ENV: '/yok/env' } }); return r.kod === 2 && !r.kayit.some((s) => /^git pull/.test(s)); })());
  temizle(eyok);

  T.H('Kaynak');
  const kaynak = fs.readFileSync(BETIK, 'utf8');
  T.ok('Govde main() icinde ve son satirda cagriliyor (pull betigi degistirse de guvenli)', /\nmain "\$@"\n?$/.test(kaynak.replace(/\r\n/g, '\n')));
  T.ok('RES_OPTIONS ayarlaniyor (sunucuda DNS 5 sn)', kaynak.includes('single-request-reopen'));
  T.ok('sudo -n (parola sormaz, takilmaz)', kaynak.includes('sudo -n systemctl restart'));

  T.bitir();
})();
