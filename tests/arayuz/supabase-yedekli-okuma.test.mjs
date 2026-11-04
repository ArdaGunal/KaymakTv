import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { tsLoader } from '../ts-test-loader.mjs';
import yardimci from '../yardimci.js';

// HIZ-02 (M574) — supabase-js okumasında yedek istek + toplam sınır; aynı anda istenen kimlik/engel okuması tek istek.
// Süreler ölçekli, kademeler sınansın diye üç tane. Bir bölüm gerçek postgrest-js ile çalışır: «AbortError'u tekrar
// denemez» iddiası kütüphanenin kendi davranışıdır, sahte istemciyle kanıtlanamazdı.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const { PostgrestClient } = require('@supabase/postgrest-js');
const T = yardimci.baslat('SUPABASE YEDEKLI OKUMA (M574)', { kokOneki: 'supabase-yedekli-' });

const { sinirliFetchKur, OKUMA_SINIRI_MS, OKUMA_YEDEKLERI_MS } = tsLoader(root, {}, { AbortController })('features/feed/services/supabaseSinirliFetch.ts');
const { geciciHataNedeni } = tsLoader(root)('utils/geciciHata.ts');

const sus = console.warn;
console.warn = () => {};
const uyu = (ms) => new Promise((r) => setTimeout(r, ms));
const yanit = (status) => ({ status, ok: status < 400 });
const YEDEK = [20, 50, 100];
const SINIR = 200;
const kur = (temel) => sinirliFetchKur(temel, SINIR, YEDEK);

/** Her istek için `davranis[sira]`: sayı = o durumla hemen döner, 'asili' = iptale kadar bekler, 'ag' = ağ hatası. */
function sahte(davranis) {
  const k = { n: 0, sinyaller: [] };
  k.fetch = (input, init) => {
    const d = davranis[Math.min(k.n++, davranis.length - 1)];
    k.sinyaller.push(init?.signal);
    if (d === 'ag') return Promise.reject(new TypeError('Network request failed'));
    if (d === 'asili') {
      return new Promise((_, red) => {
        init.signal.addEventListener('abort', () => red(Object.assign(new Error('Aborted'), { name: 'AbortError' })));
      });
    }
    return Promise.resolve(yanit(d));
  };
  return k;
}

(async () => {
  T.H('Üretim değerleri');
  T.ok('Kademeler ölçülen: 1 ve 5 sn', OKUMA_YEDEKLERI_MS.join() === '1000,5000');
  T.ok('Toplam sınır 10 sn', OKUMA_SINIRI_MS === 10_000);

  T.H('Okuma');
  let k = sahte([200]);
  let r = await kur(k.fetch)('https://x/rest/v1/t');
  await uyu(30);
  T.ok('Hızlı cevapta yedek gitmez (method yoksa GET sayılır)', r.status === 200 && k.n === 1);

  k = sahte(['asili', 200]);
  r = await kur(k.fetch)('https://x/rest/v1/t', { method: 'GET' });
  T.ok('Takılan okumanın yanına yedek gider, yedek kazanır', r.status === 200 && k.n === 2);
  T.ok('Kaybeden iptal edilir, kazananın sinyali açık kalır (gövde okunacak)', k.sinyaller[0].aborted && !k.sinyaller[1].aborted);
  await uyu(120);
  T.ok('Kazanandan sonra yedek gitmez', k.n === 2);

  k = sahte([522, 200]);
  r = await kur(k.fetch)('https://x/rest/v1/t');
  T.ok('Açık 522: bekleme yok, hemen bir kez daha', r.status === 200 && k.n === 2);

  k = sahte(['asili', 522, 200]);
  r = await kur(k.fetch)('https://x/rest/v1/t');
  T.ok('Yedek 522 alırsa sıradaki kademe sürer', r.status === 200 && k.n === 3);

  T.H('Vazgeçiş');
  k = sahte(['asili']);
  let hata = null;
  const bas = Date.now();
  await kur(k.fetch)('https://x/rest/v1/t').catch((e) => { hata = e; });
  const sure = Date.now() - bas;
  T.ok('Hepsi asılı: sınırda AbortError', hata?.name === 'AbortError' && sure >= SINIR - 5 && sure < SINIR + 150, `${hata?.name} ${sure}`);
  T.ok('Üç kademe de gitti, hepsi iptal', k.n === 4 && k.sinyaller.every((s) => s.aborted));

  k = sahte([522, 'asili']);
  r = await kur(k.fetch)('https://x/rest/v1/t');
  T.ok('Sınırda elde 522 varsa fırlatmaz, onu döner', r.status === 522);

  k = sahte([522, 522]);
  r = await kur(k.fetch)('https://x/rest/v1/t');
  T.ok('İki açık 522: boşuna kademe beklemez, 522 döner', r.status === 522 && k.n === 2);

  k = sahte(['ag', 'ag']);
  hata = null;
  await kur(k.fetch)('https://x/rest/v1/t').catch((e) => { hata = e; });
  T.ok('İki ağ hatası: ağ hatası olarak fırlar (kütüphanenin kendi tekrarı sürer)', hata?.message === 'Network request failed' && k.n === 2);

  T.H('Yazma ve iptal');
  k = sahte([502]);
  r = await kur(k.fetch)('https://x/rest/v1/t', { method: 'POST', body: '{}' });
  T.ok('POST dokunulmaz: tek deneme, sinyal eklenmez', r.status === 502 && k.n === 1 && k.sinyaller[0] === undefined);

  k = sahte(['asili']);
  let cagiran = new AbortController();
  hata = null;
  const iptalli = kur(k.fetch)('https://x/rest/v1/t', { signal: cagiran.signal }).catch((e) => { hata = e; });
  cagiran.abort();
  await iptalli;
  await uyu(120);
  T.ok('Çağıranın iptali: AbortError, yedek gitmez', hata?.name === 'AbortError' && k.n === 1 && k.sinyaller[0].aborted);

  k = sahte([200]);
  cagiran = new AbortController();
  cagiran.abort();
  hata = null;
  await kur(k.fetch)('https://x/rest/v1/t', { signal: cagiran.signal }).catch((e) => { hata = e; });
  T.ok('Önceden iptal edilmiş: hiç istek yok', hata?.name === 'AbortError' && k.n === 0);

  T.H('Yedek tavanı');
  k = sahte(['asili']);
  const bes = Array.from({ length: 5 }, () => kur(k.fetch)('https://x/rest/v1/t').catch(() => {}));
  await uyu(150);
  T.ok('Beş takılan okuma: uçan yedek en çok 3 (OkHttp ana makine başına 5)', k.n === 8, String(k.n));
  await Promise.all(bes);
  k = sahte(['asili', 200]);
  r = await kur(k.fetch)('https://x/rest/v1/t');
  T.ok('Tur bitince sayaç boşalır, sonraki okuma yedek kullanabilir', r.status === 200 && k.n === 2);

  T.H('Gerçek postgrest-js ile');
  k = sahte(['asili']);
  let istemci = new PostgrestClient('https://x/rest/v1', { fetch: kur(k.fetch) });
  let sonuc = await istemci.from('users').select('id');
  T.ok('🔴 Vazgeçince kütüphane TEKRAR DENEMEZ (4 istek, 16 değil)', k.n === 4, String(k.n));
  T.ok('Hata biçimi: AbortError + «Request was aborted» ipucu', /^AbortError/.test(sonuc.error?.message) && /^Request was aborted/.test(sonuc.error?.hint));
  T.ok('🔴 13:30 gürültüsü: bu hata geçici sayılır, Discord\'a gitmez', geciciHataNedeni(sonuc.error) === 'abort');

  k = sahte(['ag']);
  istemci = new PostgrestClient('https://x/rest/v1', { fetch: kur(k.fetch) });
  istemci = istemci.from('users').select('id').retry(false);
  sonuc = await istemci;
  T.ok('Ağ hatası da geçici (kütüphanenin «TypeError:» öneki)', geciciHataNedeni(sonuc.error) === 'network', sonuc.error?.message);

  T.H('Geçici hata sınırları');
  T.ok('AbortError nesnesi geçici', geciciHataNedeni(Object.assign(new Error('Aborted'), { name: 'AbortError' })) === 'abort');
  T.ok('🔴 Rastgele JS hatası hâlâ GERÇEK', geciciHataNedeni(new TypeError("Cannot read properties of undefined (reading 'x')")) === null);
  T.ok('🔴 «abort» geçen uygulama hatası GERÇEK', geciciHataNedeni(new Error('Kullanıcı abort etti')) === null);
  T.ok('🔴 500 gövdesi hâlâ GERÇEK', geciciHataNedeni({ status: 500, message: 'AbortError: x' }) === null);

  const { geciciseBirKezDaha } = tsLoader(root)('utils/geciciseTekrarla.ts');
  let deneme = 0;
  await geciciseBirKezDaha(async () => { deneme += 1; throw Object.assign(new Error('Aborted'), { name: 'AbortError' }); }, 0).catch(() => {});
  T.ok('İptal edilmiş istek geciciseBirKezDaha ile tekrarlanmaz', deneme === 1);

  T.H('Aynı anda istenen kimlik + engel okuması');
  const sayac = { users: 0, engel: 0, gecikme: 5, hata: null };
  const sorgu = (tablo) => {
    const zincir = {
      select: () => zincir,
      eq: () => zincir,
      maybeSingle: () => zincir,
      then: (coz, red) => {
        sayac[tablo === 'users' ? 'users' : 'engel'] += 1;
        const hata = sayac.hata;
        const satir = tablo === 'users' ? { id: '11111111-1111-4111-8111-111111111111' } : [{ blocked_id: 'a', blocker_id: 'b' }];
        return uyu(sayac.gecikme).then(() => ({ data: hata ? null : satir, error: hata })).then(coz, red);
      },
    };
    return zincir;
  };
  const engel = tsLoader(root, {
    axios: {},
    '@react-native-async-storage/async-storage': { default: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} } },
    './supabaseClient': { supabase: { from: sorgu } },
    '../../../utils/secureStorage': { getItemAsync: async () => 'jeton' },
    '../../../services/api/myIdentity': { getMyTraktSlug: async () => 'slug' },
    '../../../services/api/traktClient': { isKaymakSessionToken: () => false },
    './profile': { getMyProfile: async () => ({}) },
  })('features/feed/services/userBlocks.ts');

  const kimlikler = await Promise.all([engel.getMySupabaseUserId(), engel.getMySupabaseUserId(), engel.getMySupabaseUserId()]);
  T.ok('Üç eş zamanlı kimlik çözümü tek okuma', sayac.users === 1 && kimlikler.every((x) => x === kimlikler[0] && x));

  const [a, b] = await Promise.all([engel.getBlockedUserIds(), engel.getBlockedUserIds()]);
  T.ok('İki eş zamanlı engel isteği: 4 değil 2 okuma, aynı küme', sayac.engel === 2 && a === b && a.has('a') && a.has('b'));
  await engel.getBlockedUserIds();
  T.ok('Süre dolmadan önbellekten', sayac.engel === 2);
  await engel.getBlockedUserIds(true);
  T.ok('force taze okur', sayac.engel === 4);

  engel.invalidateBlockedUserIds();
  const eski = engel.getBlockedUserIds();
  await uyu(1);
  engel.invalidateBlockedUserIds();
  const yeni = engel.getBlockedUserIds();
  T.ok('Geçersiz kılınınca yoldaki paylaşılmaz (engelleme sonrası eski küme gelmesin)', eski !== yeni);
  await Promise.all([eski, yeni]);
  const onceki = sayac.engel;
  T.ok('Eski sonuç önbelleği ezmez, yenisi yazılır', (await engel.getBlockedUserIds()) === (await yeni) && sayac.engel === onceki);

  engel.invalidateBlockedUserIds();
  sayac.hata = { message: 'patladi' };
  const dusen = await Promise.allSettled([engel.getBlockedUserIds(), engel.getBlockedUserIds()]);
  T.ok('Okuma düşerse ikisi de hatayı görür', dusen.every((d) => d.status === 'rejected'));
  sayac.hata = null;
  T.ok('Düşen okuma yolda kalmaz, sonraki deneme gider', (await engel.getBlockedUserIds()).has('a'));

  console.warn = sus;
  T.bitir();
})();
