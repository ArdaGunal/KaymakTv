import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tsLoader } from '../ts-test-loader.mjs';
import yardimci from '../yardimci.js';

// ISCI-SUPABASE-ISTEMCI (K-50): Supabase belgesi yenileme düşünce eldeki geçerli belge korunur,
// bitiş cihaz saatinden bağımsız (belgenin exp−iat'ı + yerel geçen süre), geri çekilme Worker'ı dövmez;
// Realtime kanalı CLOSED olunca sınırlı yeniden abonelik.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const T = yardimci.baslat('SUPABASE BELGE YENILEME (K-50 istemci)', { kokOneki: 'supabase-belge-' });
const oku = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const sessiz = { log() {}, warn() {}, error() {}, info() {} };

const Z = tsLoader(root)('features/feed/utils/supabaseBelgeZamani.ts');
const R = tsLoader(root)('features/feed/utils/realtimeYenidenAbonelik.ts');

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (iat, exp, ek = {}) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'u', iat, exp, ...ek })}.imza`;
const S0 = 1_800_000_000; // sunucu saati (sn)

// ── Saf zaman yardımcısı ────────────────────────────────────────────────────
T.ok('jwtOmruMs: exp−iat (900 sn)', Z.jwtOmruMs(jwt(S0, S0 + 900)) === 900_000);
T.ok('jwtOmruMs: bozuk belge → null', Z.jwtOmruMs('abc') === null && Z.jwtOmruMs('a.!!.c') === null && Z.jwtOmruMs(jwt(S0, S0)) === null);
T.ok('belgeOmruMs: belge okunamazsa expiresAt − cihaz saati, en çok 5 dk',
  Z.belgeOmruMs('x', S0 + 900, S0 * 1000) === Z.YEDEK_OMUR_MS && Z.belgeOmruMs('x', S0 + 200, S0 * 1000) === 200_000);
T.ok('belgeOmruMs: cihaz saati çok ileride (kalan ≤ 0) → yedek ömür, 0 değil',
  Z.belgeOmruMs('x', S0 + 300, (S0 + 3600) * 1000) === Z.YEDEK_OMUR_MS);
T.ok('gecenMs: duvar saati geri alınırsa monoton saat kullanılır',
  Z.gecenMs({ duvar: 1e9, monoton: 0 }, { duvar: 1e9 - 3_600_000, monoton: 300_000 }) === 300_000);
T.ok('gecenMs: monoton saat uykuda durursa duvar saati kullanılır',
  Z.gecenMs({ duvar: 1e9, monoton: 50 }, { duvar: 1e9 + 1_200_000, monoton: 50 }) === 1_200_000);
T.ok('gecenMs: monoton yoksa duvar, eksiye düşmez',
  Z.gecenMs({ duvar: 10, monoton: null }, { duvar: 5, monoton: 9 }) === 0);
const kayit = { token: 't', omurMs: 300_000, alis: { duvar: 0, monoton: 0 } };
const an = (ms) => ({ duvar: ms, monoton: ms });
T.ok('belgeDurumu: 5 dk belgede 179 sn taze, 181 sn yenilenmeli, 286 sn dolmus',
  Z.belgeDurumu(kayit, an(179_000)) === 'taze' && Z.belgeDurumu(kayit, an(181_000)) === 'yenilenmeli'
  && Z.belgeDurumu(kayit, an(284_000)) === 'yenilenmeli' && Z.belgeDurumu(kayit, an(286_000)) === 'dolmus');
T.ok('belgeDurumu: çok kısa ömürde pay ömrün yarısı (60 sn belge 31 sn taze)',
  Z.belgeDurumu({ ...kayit, omurMs: 60_000 }, an(29_000)) === 'taze' && Z.belgeDurumu({ ...kayit, omurMs: 60_000 }, an(31_000)) === 'yenilenmeli');
const orta = () => 0.5;
T.ok('geriCekilmeMs: 5, 10, 20, 40, 80, 120, 120 sn (sapmasız)',
  [1, 2, 3, 4, 5, 6, 7].map((n) => Z.geriCekilmeMs(n, 522, orta)).join(',') === '5000,10000,20000,40000,80000,120000,120000');
T.ok('geriCekilmeMs: sapma ±%20 ve tavanı aşmaz',
  Z.geriCekilmeMs(1, null, () => 0) === 4000 && Z.geriCekilmeMs(1, null, () => 1) === 6000 && Z.geriCekilmeMs(9, null, () => 1) === 120_000);
T.ok('geriCekilmeMs: 429 → en az 60 sn', Z.geriCekilmeMs(1, 429, () => 0) === 60_000 && Z.geriCekilmeMs(6, 429, orta) === 120_000);
T.ok('kesinRetMi: yalnız 401/403', Z.kesinRetMi(401) && Z.kesinRetMi(403) && ![429, 502, 503, 522, null].some(Z.kesinRetMi));

// ── supabaseKimlik.ts uçtan uca (sahte fetch + sahte saat) ──────────────────
function kur({ sapmaMs = 0, monotonVar = true } = {}) {
  const saat = { sunucu: S0 * 1000, mono: 1000 };
  const istekler = [];
  const kuyruk = [];
  let sayac = 0;
  const ileri = (ms) => { saat.sunucu += ms; saat.mono += ms; };
  const yanit = (durum, govde) => ({ ok: durum >= 200 && durum < 300, status: durum, json: async () => govde });
  const belgeYaniti = (omurSn) => {
    const iat = Math.floor(saat.sunucu / 1000);
    sayac += 1;
    return yanit(200, { success: true, token: jwt(iat, iat + omurSn, { n: sayac }), expiresAt: iat + omurSn });
  };
  const fetch = async (url, istek) => {
    istekler.push({ url, govde: JSON.parse(istek.body) });
    const sonraki = kuyruk.shift();
    if (!sonraki) throw new Error('beklenmeyen istek');
    return typeof sonraki === 'function' ? sonraki() : sonraki;
  };
  const K = tsLoader(root, {}, {
    fetch,
    AbortController,
    console: sessiz,
    Date: { now: () => saat.sunucu + sapmaMs },
    performance: monotonVar ? { now: () => saat.mono } : undefined,
  })('features/feed/services/supabaseKimlik.ts');
  K.supabaseKimlikKaynaginiAyarla('oturum-1');
  return { K, saat, ileri, istekler, kuyruk, yanit, belgeYaniti };
}
const n = (token) => (token ? JSON.parse(Buffer.from(token.split('.')[1], 'base64url')).n : null);

// Saat sapması: 10 dk ileri / geri / yok × 5 dk ve 15 dk belge — yenileme zamanı sunucu saatine göre doğru.
for (const omurSn of [300, 900]) {
  for (const sapmaMs of [600_000, -600_000, 0]) {
    const d = kur({ sapmaMs });
    const etiket = `${omurSn / 60} dk belge, saat ${sapmaMs / 60000} dk`;
    d.kuyruk.push(() => d.belgeYaniti(omurSn));
    const ilk = await d.K.supabaseErisimTokeni();
    d.ileri((omurSn - 120 - 5) * 1000);
    const ara1 = await d.K.supabaseErisimTokeni();
    const ara2 = await d.K.supabaseErisimTokeni();
    T.ok(`${etiket}: belge önbellekte kalır (fırtına yok)`, n(ilk) === 1 && n(ara1) === 1 && n(ara2) === 1 && d.istekler.length === 1);
    d.kuyruk.push(() => d.belgeYaniti(omurSn));
    d.ileri(10_000);
    const yeni = await d.K.supabaseErisimTokeni();
    T.ok(`${etiket}: bitişe 120 sn kala yenilenir (dolmuş belge gönderilmez)`, n(yeni) === 2 && d.istekler.length === 2);
  }
}

{
  // Yenileme iki kez 522 → eldeki geçerli belge döner (eskiden null → 60 sn anon).
  const d = kur();
  d.kuyruk.push(() => d.belgeYaniti(300));
  await d.K.supabaseErisimTokeni();
  d.ileri(190_000);
  d.kuyruk.push(d.yanit(522, { success: false }), d.yanit(522, { success: false }));
  const t1 = await d.K.supabaseErisimTokeni();
  T.ok('Yenileme 2× 522 düşerse süresi dolmamış belge döner (null değil)', n(t1) === 1 && d.istekler.length === 3);
  const t2 = await d.K.supabaseErisimTokeni();
  d.ileri(3_000);
  const t3 = await d.K.supabaseErisimTokeni();
  T.ok('Geri çekilme içinde Worker yeniden dövülmez, eldeki belge verilir', n(t2) === 1 && n(t3) === 1 && d.istekler.length === 3);
  d.ileri(10_000);
  d.kuyruk.push(d.yanit(503, {}), d.yanit(503, {}));
  const t4 = await d.K.supabaseErisimTokeni();
  T.ok('Geri çekilme bitince yeniden denenir; yine düşerse belge hâlâ geçerliyse o', n(t4) === 1 && d.istekler.length === 5);
  d.ileri(90_000); // 293 sn: kalan 7 sn < güvenlik payı
  d.kuyruk.push(d.yanit(503, {}), d.yanit(503, {}));
  const t5 = await d.K.supabaseErisimTokeni();
  T.ok('Belge gerçekten dolmuşsa (güvenlik payı içinde) null → anon', t5 === null && d.istekler.length === 7);
  const t6 = await d.K.supabaseErisimTokeni();
  T.ok('Dolmuş belge + geri çekilme → istek yok, null', t6 === null && d.istekler.length === 7);
}

{
  // Geri çekilme ardışık hatalarda büyür (belge yokken).
  const d = kur();
  const zamanlar = [];
  for (let i = 0; i < 4; i++) {
    const once = d.istekler.length;
    d.kuyruk.push(() => d.yanit(502, {}), () => d.yanit(502, {}));
    let gecen = 0;
    while (d.istekler.length === once && gecen < 400_000) {
      await d.K.supabaseErisimTokeni();
      if (d.istekler.length === once) { d.ileri(1_000); gecen += 1_000; }
    }
    zamanlar.push(gecen);
  }
  T.ok(`Ardışık hatada bekleme büyür (${zamanlar.join('/')} ms): 0, ~5, ~10, ~20 sn`,
    zamanlar[0] === 0 && zamanlar[1] >= 4_000 && zamanlar[1] <= 6_000 && zamanlar[2] >= 8_000 && zamanlar[2] <= 12_000
    && zamanlar[3] >= 16_000 && zamanlar[3] <= 24_000);
  d.kuyruk.length = 0;
  d.ileri(200_000);
  d.kuyruk.push(() => d.belgeYaniti(300));
  const t = await d.K.supabaseErisimTokeni();
  d.ileri(200_000);
  d.kuyruk.push(d.yanit(502, {}), d.yanit(502, {}));
  await d.K.supabaseErisimTokeni();
  const once = d.istekler.length;
  d.ileri(6_500);
  d.kuyruk.push(() => d.belgeYaniti(300));
  const t2 = await d.K.supabaseErisimTokeni();
  T.ok('Başarılı alış sayacı sıfırlar (sonraki ilk hatada bekleme yine ~5 sn)', t !== null && n(t2) !== n(t) && d.istekler.length === once + 1);
}

{
  // 429: ikinci istek yok, bekleme ≥ 60 sn; belge geçerliyse o kullanılır.
  const d = kur();
  d.kuyruk.push(() => d.belgeYaniti(300));
  await d.K.supabaseErisimTokeni();
  d.ileri(200_000);
  d.kuyruk.push(d.yanit(429, { success: false }));
  const t1 = await d.K.supabaseErisimTokeni();
  d.ileri(55_000);
  const t2 = await d.K.supabaseErisimTokeni();
  T.ok('429: hemen ikinci istek yok, 55 sn sonra da yok, eldeki belge veriliyor', n(t1) === 1 && n(t2) === 1 && d.istekler.length === 2);
}

{
  // 401: oturum geçersiz → geçerli belge de bırakılır (iptal boşa çıkmasın).
  const d = kur();
  d.kuyruk.push(() => d.belgeYaniti(300));
  await d.K.supabaseErisimTokeni();
  d.ileri(200_000);
  d.kuyruk.push(d.yanit(401, { success: false, code: 'invalid_token' }));
  const t = await d.K.supabaseErisimTokeni();
  T.ok('401 invalid_token: eldeki belge bırakılır → null, tek istek', t === null && d.istekler.length === 2);
}

{
  // Yenileme yoldayken geçerli belge isteği BEKLETMEZ.
  const d = kur();
  d.kuyruk.push(() => d.belgeYaniti(300));
  await d.K.supabaseErisimTokeni();
  d.ileri(200_000);
  let birak;
  d.kuyruk.push(() => new Promise((r) => { birak = () => r(d.belgeYaniti(300)); }));
  const yolda = d.K.supabaseErisimTokeni();
  const hemen = await d.K.supabaseErisimTokeni();
  T.ok('Yenileme yoldayken ikinci çağrı eldeki belgeyi hemen alır, yeni istek yok', n(hemen) === 1 && d.istekler.length === 2);
  birak();
  const yeni = await yolda;
  const sonra = await d.K.supabaseErisimTokeni();
  T.ok('Yenileme bitince yeni belge önbellekte', n(yeni) === 2 && n(sonra) === 2 && d.istekler.length === 2);
}

{
  // Belge yokken yoldaki istek paylaşılır; kimlik değişirse eski belge kullanılmaz.
  const d = kur();
  let birak;
  d.kuyruk.push(() => new Promise((r) => { birak = () => r(d.belgeYaniti(300)); }));
  const a = d.K.supabaseErisimTokeni();
  const b = d.K.supabaseErisimTokeni();
  d.K.supabaseKimlikKaynaginiAyarla('oturum-2');
  d.kuyruk.push(() => d.belgeYaniti(300));
  const c = await d.K.supabaseErisimTokeni();
  birak();
  const [ra, rb] = await Promise.all([a, b]);
  const sonra = await d.K.supabaseErisimTokeni();
  T.ok('Kimlik yolda değişince eski kişinin belgesi null, yenisi kendi belgesini alır',
    ra === null && rb === null && c !== null && sonra === c && d.istekler.length === 2
    && d.istekler[1].govde.traktAccessToken === 'oturum-2');
}

{
  // Saat sıçramaları: duvar saati 1 sa geri alınsa da monoton saat belgeyi zamanında bitirir.
  const d = kur();
  d.kuyruk.push(() => d.belgeYaniti(300));
  await d.K.supabaseErisimTokeni();
  d.saat.mono += 185_000; // duvar saati yerinde (geri alınmış gibi), 185 sn geçti
  d.kuyruk.push(() => d.belgeYaniti(300));
  const t = await d.K.supabaseErisimTokeni();
  T.ok('Duvar saati ilerlemese de monoton saatle yenilenir', n(t) === 2 && d.istekler.length === 2);
  d.saat.sunucu += 20 * 60_000; // uyku: monoton durdu, duvar 20 dk ilerledi
  d.kuyruk.push(() => d.belgeYaniti(300));
  const u = await d.K.supabaseErisimTokeni();
  T.ok('Uykuda monoton saat dursa da duvar saatiyle dolmuş belge gönderilmez', n(u) === 3 && d.istekler.length === 3);
}

{
  // `performance` yoksa (eski çalışma zamanı) yalnız duvar saatiyle çalışır.
  const d = kur({ monotonVar: false, sapmaMs: 600_000 });
  d.kuyruk.push(() => d.belgeYaniti(300));
  const a = await d.K.supabaseErisimTokeni();
  d.ileri(100_000);
  const b = await d.K.supabaseErisimTokeni();
  T.ok('performance yokken de önbellek + sapma bağımsızlığı', n(a) === 1 && n(b) === 1 && d.istekler.length === 1);
}

{
  const kaynak = oku('features/feed/services/supabaseKimlik.ts');
  T.ok('supabaseKimlik açılış yolunda: yalnız importsuz saf yardımcıyı içe aktarır',
    (kaynak.match(/^import /gm) || []).length === 1 && /from '\.\.\/utils\/supabaseBelgeZamani'/.test(kaynak)
    && !/^import /m.test(oku('features/feed/utils/supabaseBelgeZamani.ts')));
  T.ok('Cihaz saati bitişle (expiresAt) doğrudan karşılaştırılmıyor', !/bitis\s*-\s*simdi/.test(kaynak) && !/expiresAt\s*-\s*Date/.test(kaynak));
}

// ── Realtime yeniden abonelik ───────────────────────────────────────────────
const p = R.yenidenAbonelikPlani;
T.ok('Plan: 2, 4, 8, 16, 30 sn sonra vazgeç',
  [0, 1, 2, 3, 4].map((i) => p(i, null).beklemeMs).join(',') === '2000,4000,8000,16000,30000' && p(5, null) === null);
T.ok('Plan: sayaç her denemede artar', p(0, null).deneme === 1 && p(3, 1000).deneme === 4);
T.ok('Plan: kanal ≥60 sn açık kaldıysa sayaç sıfırlanır; hemen kapanan kanal döngüye girmez',
  p(5, 60_000).beklemeMs === 2000 && p(5, 60_000).deneme === 1 && p(5, 59_000) === null);
const hook = oku('features/feed/hooks/useFeedRealtime.ts');
T.ok('Hook: subscribe durum geri çağrısı, yalnız CLOSED yeniden kurar, güncel kanal + cancelled bekçisi',
  /\.subscribe\(\(durum, hata\) =>/.test(hook) && /if \(cancelled \|\| channelRef\.current !== channel\) return;/.test(hook)
  && /if \(durum !== 'CLOSED'\)/.test(hook) && /yenidenAbonelikPlani\(deneme,/.test(hook));
T.ok('Hook: kapanışta bekleyen yeniden abonelik zamanlayıcısı temizlenir',
  /if \(yenidenZamanlayici\) clearTimeout\(yenidenZamanlayici\);/.test(hook));
T.ok('Hook: denemeler tükenince öne gelişte yeniden kurulur',
  /if \(vazgecildi\) \{\s*vazgecildi = false;\s*deneme = 0;\s*subscribe\(\);/.test(hook));

T.bitir();
