// Moderasyon Faz 6 (MODERASYON_PLANI §7, FAZ_6.md): istemci tarafı.
//   a) Görünürlük yeniden doğrulaması (MD06): öne gelişte / ağa dönüşte gizlenen kart ve yorum düşer.
//   c) `403 hesap_kapali` (süresiz kapalı hesap beğeni/takip) kullanıcının dilinde açıklanır.
//   d) İnceleme kaydı veritabanına YAZILAN spoiler değerini kullanır (moderatör kilidi).
// Ağ yok: saf çekirdek davranışla, bağlantılar kaynak denetimiyle sınanır.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { tsLoader } from '../ts-test-loader.mjs';
import yardimci from '../yardimci.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const T = yardimci.baslat('MODERASYON ISTEMCI (Faz 6)', { kokOneki: 'moderasyon-istemci-' });
const yukle = tsLoader(root, { zustand: require('zustand') });
const oku = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const U = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

T.H('a) Saf cekirdek: hangi kimlikler sorulur, hangileri duser');
const { dogrulanacakKimlikler, parcala, dusenKimlikler, DOGRULAMA_PARCA, DOGRULAMA_ESIGI_MS } = yukle('features/feed/utils/gorunurlukDogrulama.ts');
T.ok('Yalniz gercek UUID sorulur; iyimser temp ve yerel kimlik sorulmaz',
  JSON.stringify(dogrulanacakKimlikler([U(1), 'temp-watched_episode-1--1', 'me-ardagnl', U(2)])) === JSON.stringify([U(1), U(2)]));
T.ok('Tekrarlayan kimlik bir kez sorulur', dogrulanacakKimlikler([U(1), U(1), U(1)]).length === 1);
T.ok('Bos liste → bos', dogrulanacakKimlikler([]).length === 0);
const yuzElli = Array.from({ length: 250 }, (_, i) => U(i));
const parcalar = parcala(yuzElli);
T.ok(`${DOGRULAMA_PARCA}'luk parcalar (250 → 100+100+50), sira korunur`,
  parcalar.length === 3 && parcalar[0].length === 100 && parcalar[2].length === 50 && parcalar.flat().join() === yuzElli.join());
T.ok('Parca boyutu 0 reddedilir', (() => { try { parcala([1], 0); return false; } catch { return true; } })());
T.ok('Sorulup donmeyen duser, donen kalir', JSON.stringify(dusenKimlikler([U(1), U(2), U(3)], new Set([U(2)]))) === JSON.stringify([U(1), U(3)]));
T.ok('Sorulmayan hicbir sey dusmez (donende fazlalik zararsiz)', dusenKimlikler([U(1)], new Set([U(1), U(9)])).length === 0);
T.ok('Esik 15 sn (useFeed M470 yakalamasiyla ayni)', DOGRULAMA_ESIGI_MS === 15_000);

T.H('a) Depoya uygulanisi: dusen kart cikar, iyimser kart ve digerleri kalir');
const { useFeedStore } = yukle('features/feed/store/feedStore.ts');
const st = useFeedStore.getState;
const kart = (id, dk) => ({ id, activityAt: new Date(Date.now() - dk * 60_000).toISOString(), likeCount: 0 });
st().setFirstPage({ items: [kart(U(1), 1), kart(U(2), 2), kart(U(3), 3)], hasMore: true, nextCursor: null });
st().appendPage({ items: [kart(U(4), 400)], hasMore: false, nextCursor: null });
st().upsertActivity(kart('temp-watched_episode-1--1', 0), false);
const sorulan = dogrulanacakKimlikler(st().activities.map((a) => a.id));
const dusen = new Set(dusenKimlikler(sorulan, new Set([U(1), U(3)])));
st().removeActivitiesWhere((a) => dusen.has(a.id));
const kalan = st().activities.map((a) => a.id);
T.ok('Temp kart hic sorulmadi', !sorulan.some((k) => k.startsWith('temp-')));
T.ok('Gizlenen 1. sayfa karti ve kaydirilip yuklenmis eski kart cikti', !kalan.includes(U(2)) && !kalan.includes(U(4)));
T.ok('Gorunurler ve iyimser kart kaldi', kalan.includes(U(1)) && kalan.includes(U(3)) && kalan.includes('temp-watched_episode-1--1'));

T.H('a) Baglantilar (kaynak denetimi)');
const sorgu = oku('features/feed/services/gorunurlukSorgusu.ts');
T.ok('Sorgu akisla ayni kilit: in_feed=true, yalniz id, parcali',
  sorgu.includes(".select('id')") && sorgu.includes(".eq('in_feed', true)") && sorgu.includes('parcala(sorulacak)') && sorgu.includes('if (error) throw error;'));
const kanca = oku('features/feed/hooks/useAkisGorunurlukDogrulama.ts');
T.ok('Hata olursa hicbir kart dusmez (catch removeActivitiesWhere oncesi)',
  /catch \(error\) \{[\s\S]{0,200}return 0;/.test(kanca) && kanca.indexOf('removeActivitiesWhere') < kanca.indexOf('catch (error)'));
T.ok('Disk kopyasi sorulmaz (ag ilk sayfasi onu degistirir), ayni anda tek tur',
  kanca.includes("store.kaynak !== 'ag'") && kanca.includes('ucusta.current'));
T.ok('Dusunce akis + profil onbellekleri gecersiz', kanca.includes('invalidateFeedCache()') && kanca.includes('invalidateUserFeedActivitiesCache()'));
T.ok('useFeed dogrulamayi baglar', /useAkisGorunurlukDogrulama\(canLoad\)/.test(oku('features/feed/hooks/useFeed.ts')));
const one = oku('features/feed/hooks/useOneGelince.ts');
T.ok('Tetik: one gelis (esik) + ag yoktu→var gecisi; abonelikler kaldirilir',
  one.includes("AppState.addEventListener('change'") && one.includes('sure >= esikMs')
  && one.includes('bagliydi === false && bagli') && one.includes('app.remove()') && one.includes('ag();'));
const detay = oku('features/feed/hooks/useActivityDetail.ts');
T.ok('Detay: sunucu dondurmezse store kopyasi da duser; one geliste yeniden sorulur',
  detay.includes('else useFeedStore.getState().removeActivity(id);') && detay.includes('useOneGelince(() => setTur((n) => n + 1), !!id)'));
T.ok('Detay: dogrulama turunda ag hatasi eldeki kopyayi silmez', detay.includes('if (!dogrulamaTuru) setFetched(null);'));
const yorum = oku('features/feed/hooks/useFeedComments.ts');
T.ok('Yorumlar: liste acikken one geliste sessiz yeniden okuma, hata listeyi silmez',
  /useOneGelince\(\(\) => \{[\s\S]{0,200}fetchComments\(activityId\)[\s\S]{0,120}\.catch/.test(yorum) && /\}, isOpen\);/.test(yorum));

T.H('c) 403 hesap_kapali');
const { kapaliYanitiCoz, askiYanitiCoz } = yukle('utils/hesapAskisi.ts');
T.ok('403 hesap_kapali → itiraz adresi', JSON.stringify(kapaliYanitiCoz(403, { code: 'hesap_kapali', itiraz: 'destek@kaymaktv.com' })) === JSON.stringify({ itiraz: 'destek@kaymaktv.com' }));
T.ok('Adres bozuksa null (varsayilan adres kullanilir)', kapaliYanitiCoz(403, { code: 'hesap_kapali', itiraz: 'x' }).itiraz === null);
T.ok('Baska kod / durum kapali DEGIL',
  [[403, { code: 'hesap_askida' }], [403, {}], [401, { code: 'hesap_kapali' }], [200, { code: 'hesap_kapali' }], [undefined, undefined]]
    .every(([d, g]) => kapaliYanitiCoz(d, g) === null));
T.ok('hesap_kapali askı sayilmaz (ayri kutu)', askiYanitiCoz(403, { code: 'hesap_kapali' }) === null);
const kapi = oku('services/kuralOnayiKapisi.ts');
T.ok('Genel axios kancasi kapali reddini yakalar, hata aynen firlatilir',
  kapi.includes('const kapali = kapaliYanitiCoz(durum, govde);') && kapi.includes('if (kapali) kapaliKutusunuGoster(kapali);')
  && /kapaliKutusunuGoster\(kapali\);\s*return Promise\.reject\(hata\);/.test(kapi));
T.ok('Kutu askı kutusuyla ayni sikliği paylasir', /export function kapaliKutusunuGoster[\s\S]{0,200}ASKI_KUTUSU_ARALIGI_MS/.test(kapi));
const worker = path.resolve(root, '..', 'kaymaktv-feedback-worker', 'src', 'lib', 'kurallar.js');
if (fs.existsSync(worker)) {
  const w = fs.readFileSync(worker, 'utf8');
  T.ok('Worker ayni kodu ve itiraz alanini donduruyor', w.includes('code: "hesap_kapali"') && w.includes('itiraz: ITIRAZ_ADRESI'));
} else {
  console.log('  [ATLANDI] Worker deposu yaninda yok; kod esligi denetlenemedi');
}
for (const dil of ['tr', 'en']) {
  const d = JSON.parse(oku(`locales/${dil}/legal.json`));
  T.ok(`${dil}: kapali basligi + metni, adres yer tutuculu, hesap silme hakki`,
    typeof d.closedTitle === 'string' && d.closedTitle.length > 0 && d.closedAction.includes('{{adres}}')
    && /hesabını silebilirsin|delete your account/.test(d.closedAction));
}

T.H('e) Gizlilik metni: moderasyon saklama sureleri (AK-M1…M4, sema 086/089 ile ayni)');
const sureler = {
  tr: ['açıklama silinir', '90 gün', '180 gün', 'geri çevrilemeyen bir özeti', 'kapatmada 2 yıl', '2 yıl saklanır'],
  en: ['explanation you wrote is deleted', '90 days', '180 days', 'one-way summary', 'after 2 years for a closed account', 'kept for 2 years'],
};
for (const dil of ['tr', 'en']) {
  const metin = JSON.parse(oku(`locales/${dil}/legal.json`)).privacySections[6].text;
  T.ok(`${dil}: privacySections[6] dort kuralin hepsini soyler`, sureler[dil].every((p) => metin.includes(p)));
}
// Şema klasörü açık depoda git dışında (canlı şema kopyası commit edilmez): yalnız yerelde varsa denetlenir.
const semaDosyasi = path.join(root, 'supabase/schema/089_moderasyon_hesap_yasam.sql');
if (fs.existsSync(semaDosyasi)) {
  const sema = fs.readFileSync(semaDosyasi, 'utf8');
  T.ok('Sureler canli saklama isiyle ayni (90/180 gun, kayit 2 yil, kapali ozet 2 yil)',
    ["interval '90 days'", "interval '180 days'", "moderasyon_kaydi WHERE created_at < now() - interval '2 years'", "THEN now() + interval '2 years'"].every((p) => sema.includes(p)));
} else {
  console.log('  [ATLANDI] supabase/schema yerelde yok; sure esligi denetlenemedi');
}

T.H('d) Inceleme: yazilan spoiler degeri');
const inceleme = oku('features/feed/services/feedReviews.ts');
T.ok('Yanittaki noteSpoiler kullanilir, eski Worker icin istekteki deger',
  inceleme.includes("typeof response.data?.noteSpoiler === 'boolean' ? response.data.noteSpoiler : input.spoiler"));
T.ok('Sonuc tipinde noteSpoiler var ve akistaki kart yamanir',
  inceleme.includes('updated: boolean; noteSpoiler: boolean') && inceleme.includes('patchActivity(activityId, { note: input.body, noteSpoiler })'));

T.bitir();
