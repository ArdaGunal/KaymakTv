// YAYIN_ONCESI_PLAN Adım 4a + 4b (M609): yasal metinler üç ayrı belge + Topluluk Kuralları onayı.
//
// Google Play UGC politikası: (1) sakıncalı içerik koşullarda tanımlanıp yasaklanır,
// (2) kullanıcı içerik oluşturmadan ÖNCE kuralları kabul eder. Bu takım ikisinin de
// kodda bağlı kaldığını denetler: metin eksilirse ya da bir içerik yazma servisi kapıyı
// atlarsa kırılır.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tsLoader } from '../ts-test-loader.mjs';
import yardimci from '../yardimci.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const T = yardimci.baslat('KURAL ONAYI + YASAL BELGELER (YAYIN Adim 4a/4b)', { kokOneki: 'kural-onayi-' });
const yukle = tsLoader(root);
const oku = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const json = (f) => JSON.parse(oku(f));

const {
  KURALLAR_SURUMU, KURAL_ONAYI_ANAHTARI, KURAL_ONAYI_BEKLEYEN_ANAHTARI,
  onayGecerliMi, onaySurumuCoz, onayYazimKarari, profilYamasiOnayIsterMi,
} = yukle('utils/kuralOnayi.ts');
const { YASAL_BELGELER, GIRIS_KABUL_BELGELERI, TUM_YASAL_BELGELER, bolumleriCoz } = yukle('utils/yasalBelge.ts');

T.H('Saf kararlar');
T.ok('Yururlukteki surum gecerli, bos/eski/bozuk gecersiz',
  onayGecerliMi(KURALLAR_SURUMU) && onayGecerliMi(KURALLAR_SURUMU + 1)
  && [null, undefined, 0, KURALLAR_SURUMU - 1, '1', 1.5].every((v) => !onayGecerliMi(v)));
T.ok('Onbellek cozumu: dizgi → surum; bos/bozuk → null',
  onaySurumuCoz('1') === 1 && onaySurumuCoz('7') === 7
  && [null, undefined, '', 'x', '0', '-1', '1.5'].every((v) => onaySurumuCoz(v) === null));
T.ok('Yazim: 200 + onayli → kaydedildi', onayYazimKarari(200, { success: true, onayli: true }) === 'kaydedildi');
T.ok('Yazim: 200 ama onayli degil → hata (sessizce kabul sayilmaz)', onayYazimKarari(200, { success: true, onayli: false }) === 'hata');
T.ok('Yazim: 409 surum_eski → surum_eski', onayYazimKarari(409, { code: 'surum_eski' }) === 'surum_eski');
T.ok('Yazim: 404 kodsuz (rota yok, eski Worker) → uc_yok', onayYazimKarari(404, { success: false, message: 'Bilinmeyen uç nokta: /account/kurallar-onay' }) === 'uc_yok');
T.ok('Yazim: 404 kodlu (kullanici_yok) → hata, uc_yok DEGIL', onayYazimKarari(404, { code: 'kullanici_yok' }) === 'hata');
T.ok('Yazim: ag hatasi / 5xx / 401 → hata',
  [[undefined, undefined], [502, {}], [401, { code: 'no_credentials' }], [429, {}]].every(([d, g]) => onayYazimKarari(d, g) === 'hata'));
T.ok('Profil yamasi: metin yazan onay ister',
  profilYamasiOnayIsterMi({ bio: 'merhaba' }) && profilYamasiOnayIsterMi({ displayName: 'Ad' }) && profilYamasiOnayIsterMi({ username: 'ad' }));
T.ok('Profil yamasi: silme / fotograf / ad onayi onay istemez',
  [{ bio: null }, { displayName: null }, { bio: '   ' }, { avatarUrl: null }, { adOnayla: true }, {}, null, undefined]
    .every((y) => !profilYamasiOnayIsterMi(y)));

T.H('Yasal belgeler: uc belge, iki dil');
const diller = ['tr', 'en'].map((d) => [d, json(`locales/${d}/legal.json`)]);
const anahtar = (k) => k.split(':')[1];
for (const [dil, d] of diller) {
  for (const belge of ['terms', 'privacy', 'rules']) {
    const b = YASAL_BELGELER[belge];
    const bolumler = bolumleriCoz(d[anahtar(b.bolumler)]);
    T.ok(`${dil}/${belge}: baslik + en az 5 bolum, hepsi dolu`,
      typeof d[anahtar(b.baslik)] === 'string' && bolumler.length >= 5
      && bolumler.length === d[anahtar(b.bolumler)].length
      && bolumler.every((x) => x.heading.trim() && x.text.trim().length > 20), String(bolumler.length));
  }
  const metin = JSON.stringify(d);
  T.ok(`${dil}: iletisim adresi uc belgede de var`,
    ['sections', 'privacySections', 'rulesSections'].every((k) => JSON.stringify(d[k]).includes('destek@kaymaktv.com')));
  T.ok(`${dil}: hesap silme metni iki giris yontemini de kapsar`, /Google/.test(d.deleteAccountHowText) && /Trakt/.test(d.deleteAccountHowText));
  T.ok(`${dil}: onay penceresi metinleri var`,
    ['rulesAcceptTitle', 'rulesAcceptIntro', 'rulesAcceptRead', 'rulesAcceptConfirm', 'rulesAcceptLater', 'rulesAcceptError', 'rulesAcceptOutdated', 'rulesAcceptRequired', 'updatedAt']
      .every((k) => typeof d[k] === 'string' && d[k].trim()));
  T.ok(`${dil}: gizlilik metni veri isleyenleri sayar`,
    ['Supabase', 'Cloudflare', 'Google', 'Expo', 'Trakt', 'TMDB', 'Discord'].every((s) => JSON.stringify(d.privacySections).includes(s)));
  T.ok(`${dil}: 13 yas siniri kosullarda ve gizlilikte`, /13/.test(JSON.stringify(d.sections)) && /13/.test(JSON.stringify(d.privacySections)), metin.length + ' karakter');
}
T.ok('Iki dilde bolum sayilari ayni',
  ['sections', 'privacySections', 'rulesSections'].every((k) => diller[0][1][k].length === diller[1][1][k].length));
T.ok('Iki dilde anahtar kumesi ayni', Object.keys(diller[0][1]).sort().join() === Object.keys(diller[1][1]).sort().join());
T.ok('bolumleriCoz: dizi degilse / bozuk oge varsa cokmez',
  bolumleriCoz('legal:sections').length === 0 && bolumleriCoz(null).length === 0
  && bolumleriCoz([{ heading: 'a', text: 'b' }, { heading: 1 }, null]).length === 1);
T.ok('Giris kutusu yalniz sozlesmeleri kabul ettirir (kosullar, kurallar); gizlilik onaya baglanmaz (KVKK, M611)', GIRIS_KABUL_BELGELERI.join() === 'terms,rules');
T.ok('Pencere varsayilani uc belge (kosullar, kurallar, gizlilik)', TUM_YASAL_BELGELER.join() === 'terms,rules,privacy');
for (const d of ['tr', 'en']) {
  const ayar = json(`locales/${d}/settings.json`);
  const s = ayar.termsAcceptance;
  T.ok(`${d}: giris kutusu iki ayri baglanti (kosullar <1>, kurallar <2>)`, /<1>[^<]*(Kullanım Koşulları|Terms of Use)[^<]*<\/1>/.test(s) && /<2>[^<]*(Topluluk Kuralları|Community Guidelines)[^<]*<\/2>/.test(s), s);
  T.ok(`${d}: giris kutusu gizliligi onaylatmaz`, !/Gizlilik|Privacy/.test(s), s);
  T.ok(`${d}: gizlilik ayri bilgi satiri, kendi baglantisiyla`, /<1>[^<]*(Gizlilik Politikası|Privacy Policy)[^<]*<\/1>/.test(ayar.privacyNotice || ''), ayar.privacyNotice);
  const kosul1 = json(`locales/${d}/legal.json`).sections[0].text;
  T.ok(`${d}: Kosullar 1.1 gizliligi kabule baglamaz`, !/(Gizlilik Politikası'nı kabul|accept[^.]*Privacy Policy)/.test(kosul1), kosul1.slice(0, 120));
}

T.H('Sayfalar ve baglantilar');
const sayfa = (ad) => oku(`app/(public)/${ad}.tsx`);
T.ok('/gizlilik → privacy', sayfa('gizlilik').includes('belge="privacy"'));
T.ok('/kullanim-kosullari → terms', sayfa('kullanim-kosullari').includes('belge="terms"'));
T.ok('/topluluk-kurallari → rules', sayfa('topluluk-kurallari').includes('belge="rules"'));
T.ok('Uc sayfa da public yiginda kayitli',
  ['gizlilik', 'kullanim-kosullari', 'topluluk-kurallari', 'hesap-sil'].every((ad) => oku('app/(public)/_layout.tsx').includes(`name="${ad}"`)));
T.ok('Belge yollari sayfa dosyalariyla eslesir',
  Object.values(YASAL_BELGELER).every((b) => fs.existsSync(path.join(root, 'app', `${b.yol.slice(1)}.tsx`))));
T.ok('Ayarlar > Yasal: Topluluk Kurallari satiri', oku('app/(protected)/account.tsx').includes("'/(public)/topluluk-kurallari'"));
T.ok('Karsilama alt bilgisi (mobil + web) kurallara baglanir',
  oku('components/landing/Footer.tsx').includes('topluluk-kurallari') && oku('app/(public)/index.web.tsx').includes('topluluk-kurallari'));
T.ok('Pencere istenen belgeleri gosterir (varsayilan uc belge)', oku('components/settings/LegalTermsModal.tsx').includes('belgeler = TUM_YASAL_BELGELER') && oku('components/settings/LegalTermsModal.tsx').includes('belgeler.map'));
const giris = oku('app/(public)/settings.tsx');
T.ok('Giris ekrani: her baglanti kendi belgesini acar, gizlilik kutunun disinda',
  ["setAcikBelge('terms')", "setAcikBelge('rules')", "setAcikBelge('privacy')", 'settings:privacyNotice'].every((p) => giris.includes(p))
  && giris.indexOf('settings:privacyNotice') > giris.indexOf('</TouchableOpacity>', giris.indexOf('settings:termsAcceptance')));
T.ok('Giris kutusu isaretsiz baslar', giris.includes('const [isChecked, setIsChecked] = useState(false);'));

T.H('Icerik yazan her servis kapidan gecer (agdan ONCE)');
const kapidanOnce = (dosya, uc, kapi) => {
  const s = oku(dosya);
  const iUc = s.indexOf(uc);
  const iKapi = s.lastIndexOf(kapi, iUc);
  // Kapı, aynı işlevin içinde ve ağ çağrısından önce olmalı (araya başka `export` girmemeli).
  return iUc > 0 && iKapi > 0 && !s.slice(iKapi, iUc).includes('\nexport ');
};
T.ok('Gonderi: publishPost', kapidanOnce('features/feed/services/feedPublish.ts', '/feed/post`', 'kuralOnayiSagla()'));
T.ok('Inceleme: publishReview', kapidanOnce('features/feed/services/feedReviews.ts', '/feed/review`', 'kuralOnayiSagla()'));
T.ok('Yorum: addComment', kapidanOnce('features/feed/services/feedSocial.ts', '/feed/comment`', 'kuralOnayiZorunlu()'));
T.ok('Not: setActivityNote (yalniz yazarken)', kapidanOnce('features/feed/services/feedSocial.ts', '/feed/note`', 'kuralOnayiZorunlu()')
  && oku('features/feed/services/feedSocial.ts').includes("typeof note === 'string' && note.trim().length > 0) await kuralOnayiZorunlu()"));
T.ok('Profil metni: updateProfile', kapidanOnce('features/feed/services/profile.ts', '/account/profile`', 'kuralOnayiZorunlu()')
  && oku('features/feed/services/profile.ts').includes('if (profilYamasiOnayIsterMi(patch)) await kuralOnayiZorunlu()'));
T.ok('Silme uclari kapiya TAKILMAZ (yorum silme)', !kapidanOnce('features/feed/services/feedSocial.ts', '/feed/comment/delete`', 'kuralOnayiZorunlu()')
  || oku('features/feed/services/feedSocial.ts').split('export async function deleteComment')[1].split('\nexport ')[0].includes('kuralOnayi') === false);

T.H('Kapi ve pencere');
const kapi = oku('services/kuralOnayiKapisi.ts');
T.ok('Oturum yoksa pencere acilmaz (misafir icerik yazamaz)', /if \(!\(await token\(\)\)\) return true;/.test(kapi));
T.ok('Sira: cihaz → giris kutusu → sunucu → pencere',
  kapi.indexOf('KURAL_ONAYI_ANAHTARI, KURAL_ONAYI_BEKLEYEN_ANAHTARI]') < kapi.indexOf('await istek({})')
  && kapi.indexOf('await istek({})') < kapi.indexOf('useKuralOnayiStore.getState().iste()'));
T.ok('uc_yok diske YAZILMAZ (yalniz oturum bayragi)',
  /sonuc === 'kaydedildi'\) await cihazaYaz/.test(kapi) && /sonuc === 'uc_yok'\) \{[^}]*oturumdaOnayli = true/s.test(kapi));
T.ok('Sunucu 403 kural_onayi_gerekli derse cihaz kaydi silinir (pencere yeniden cikabilsin)',
  kapi.includes("durum === 403 && govde?.code === 'kural_onayi_gerekli'")
  && kapi.includes('void sunucuOnayiReddetti();')
  && kapi.includes('AsyncStorage.multiRemove([KURAL_ONAYI_ANAHTARI, KURAL_ONAYI_BEKLEYEN_ANAHTARI])')
  && kapi.includes('return Promise.reject(hata)'));
const host = oku('components/rules/KuralOnayiHost.tsx');
T.ok('Pencere kokte bagli (ConfirmHost yaninda)', oku('app/_layout.tsx').includes('<KuralOnayiHost />'));
T.ok('Kayit basarisizsa pencere acik kalir, hata gosterilir',
  /sonuc === 'kaydedildi' \|\| sonuc === 'uc_yok'\) \{\s*sonuclandir\(true\)/.test(host) && host.includes('setHata('));
T.ok('Geri tusu / «Simdi degil» = kabul edilmedi', host.includes('onRequestClose={vazgec}') && host.includes('sonuclandir(false)'));
T.ok('Kurallarin tamami AYNI pencerede acilir (yazilan metin kaybolmasin)', host.includes('setTamami(true)') && !host.includes('router.push'));
// zustand'in en kucuk karsiligi: `create((set, get) => durum)` + `getState`.
const create = (kur) => {
  let durum;
  const set = (p) => { durum = { ...durum, ...(typeof p === 'function' ? p(durum) : p) }; };
  const get = () => durum;
  durum = kur(set, get);
  const kanca = () => durum;
  kanca.getState = get;
  kanca.setState = set;
  return kanca;
};
const store = tsLoader(root, { zustand: { create } })('store/kuralOnayiStore.ts').useKuralOnayiStore;
T.ok('Host yokken istek hemen false (sonsuz bekleme yok)', (await store.getState().iste()) === false);
const birak = store.getState().hostBaglandi();
const [a, b] = [store.getState().iste(), store.getState().iste()];
T.ok('Iki es zamanli istek TEK pencere', store.getState().acik === true && store.getState().bekleyenler.length === 2);
store.getState().sonuclandir(true);
T.ok('Sonuc iki bekleyene de gider, pencere kapanir', (await a) === true && (await b) === true && store.getState().acik === false);
const c = store.getState().iste();
birak();
T.ok('Host sokulurse bekleyen false ile cozulur', (await c) === false);

T.H('Cikis ve surum esligi');
const cikis = oku('services/auth/cikisTemizligi.ts');
T.ok('Onay kayitlari cikista SILINIR (izin listesinde degil)',
  !cikis.includes(KURAL_ONAYI_ANAHTARI) && !cikis.includes(KURAL_ONAYI_BEKLEYEN_ANAHTARI));
T.ok('Cikis oturum bayragini da sifirlar', oku('context/AuthContext.tsx').includes('kuralOnayiniUnut()'));
T.ok('Giris kutusu isaretlenince surum cihaza not edilir', oku('app/(public)/settings.tsx').includes('girisOnayiniIsaretle(isChecked)'));
const workerDosyasi = path.resolve(root, '..', 'kaymaktv-feedback-worker', 'src', 'lib', 'kurallar.js');
if (fs.existsSync(workerDosyasi)) {
  const m = fs.readFileSync(workerDosyasi, 'utf8').match(/export const KURALLAR_SURUMU = (\d+);/);
  T.ok('KURALLAR_SURUMU istemci = Worker', !!m && Number(m[1]) === KURALLAR_SURUMU, m ? m[1] : 'bulunamadi');
} else {
  console.log('  [ATLANDI] Worker deposu yaninda yok; surum esligi denetlenemedi');
}
T.ok('077: kolonlar + tutarlilik kisiti + dogrulama sorgusu',
  ['kurallar_onay_surumu', 'kurallar_onay_at', 'users_kurallar_onay_tutarli', 'has_column_privilege'].every((k) => oku('supabase/schema/077_kurallar_onayi.sql').includes(k)));
T.H('Hesap askisi (Adim 4e): yaniti tani, kullanicinin dilinde acikla');
const { askiYanitiCoz, askiMetinAnahtari, askiTarihiYaz } = yukle('utils/hesapAskisi.ts');
T.ok('403 hesap_askida (aski) → durum + ISO bitis + itiraz',
  JSON.stringify(askiYanitiCoz(403, { code: 'hesap_askida', durum: 'aski', bitis: '2026-11-19T12:00:00+00:00', itiraz: 'destek@kaymaktv.com' }))
  === JSON.stringify({ durum: 'aski', bitis: '2026-11-19T12:00:00.000Z', itiraz: 'destek@kaymaktv.com' }));
T.ok('403 hesap_askida (kapali) → suresiz', (() => { const b = askiYanitiCoz(403, { code: 'hesap_askida', durum: 'kapali', bitis: null }); return b.durum === 'kapali' && b.bitis === null && b.itiraz === null; })());
T.ok('Bitis okunamazsa yine aski (tarihsiz metin)', askiYanitiCoz(403, { code: 'hesap_askida', durum: 'aski', bitis: 'x' }).bitis === null);
T.ok('Baska 403 / baska durum aski DEGIL',
  [[403, { code: 'kural_onayi_gerekli' }], [403, {}], [401, { code: 'hesap_askida' }], [200, { code: 'hesap_askida' }], [undefined, undefined]]
    .every(([d, g]) => askiYanitiCoz(d, g) === null));
T.ok('Metin anahtari: tarihli / tarihsiz / kapali',
  askiMetinAnahtari({ durum: 'aski', bitis: '2026-11-19T12:00:00.000Z', itiraz: null }) === 'legal:suspendedUntil'
  && askiMetinAnahtari({ durum: 'aski', bitis: null, itiraz: null }) === 'legal:suspendedNoDate'
  && askiMetinAnahtari({ durum: 'kapali', bitis: null, itiraz: null }) === 'legal:suspendedClosed');
T.ok('Tarih kullanicinin dilinde yazilir', /2026/.test(askiTarihiYaz('2026-11-19T12:00:00.000Z', 'tr')) && /2026/.test(askiTarihiYaz('2026-11-19T12:00:00.000Z', 'en')));
for (const [dil, d] of diller) {
  T.ok(`${dil}: aski metinleri var, tarih ve adres yer tutuculu`,
    typeof d.suspendedTitle === 'string' && d.suspendedUntil.includes('{{tarih}}')
    && ['suspendedUntil', 'suspendedNoDate', 'suspendedClosed'].every((k) => d[k].includes('{{adres}}')));
  T.ok(`${dil}: kapali metni hesap silme hakkini soyler`, /hesabını silebilirsin|delete your account/.test(d.suspendedClosed));
}
T.ok('Aski yaniti tek yerde yakalanir, hata aynen firlatilir',
  kapi.includes('const aski = askiYanitiCoz(durum, govde);') && kapi.includes('if (aski) askiKutusunuGoster(aski);'));
T.ok('Art arda kopyalar tek kutu', kapi.includes('if (simdi - sonAskiKutusu < ASKI_KUTUSU_ARALIGI_MS) return;'));
T.ok('Iletisim sabiti yasal metinlerle ayni adres', oku('utils/constants.ts').includes("ILETISIM_EPOSTA = 'destek@kaymaktv.com'"));
T.ok('078: uc tablo + uc islev + rol adiyla geri alma + dogrulama',
  ['hesap_durumu', 'moderasyon_kaydi', 'kullanici_rolleri', 'mod_askiya_al', 'mod_kapat', 'mod_aski_kaldir',
    'FROM PUBLIC, anon, authenticated, service_role', 'FROM PUBLIC, anon, authenticated;', 'has_function_privilege']
    .every((k) => oku('supabase/schema/078_hesap_durumu.sql').includes(k)));

T.H('Aski nedeni yazilan yerde gorunur (M613: «paylasilamadi, tekrar dene» degil)');
const kapiKaynak = oku('services/kuralOnayiKapisi.ts');
T.ok('hataAskiMetni: axios hatasi ve `aski` alani ikisini de okur, yoksa null',
  kapiKaynak.includes('export function hataAskiMetni') && kapiKaynak.includes('k?.aski ?? askiYanitiCoz(k?.response?.status, k?.response?.data)')
  && kapiKaynak.includes('return bilgi ? askiMetni(bilgi) : null'));
T.ok('Kutu ve satir ayni metni kullanir', kapiKaynak.includes("notify(i18n.t('legal:suspendedTitle'), askiMetni(bilgi))"));
T.ok('Sonuc donduren servisler askiyi tasir (gonderi, inceleme, profil)',
  oku('features/feed/services/feedPublish.ts').includes('aski: askiYanitiCoz(error?.response?.status, error?.response?.data)')
  && oku('features/feed/services/feedReviews.ts').includes('aski: askiYanitiCoz(error?.response?.status, error?.response?.data)')
  && oku('features/feed/services/profile.ts').includes('askiYanitiCoz(response.status, response.data)'));
const askiYuzeyleri = {
  'gonderi penceresi': ['features/feed/components/ComposePostModal.tsx', 'hataAskiMetni(result) ??'],
  'yorum (hook)': ['features/feed/hooks/useFeedComments.ts', 'askiMetni: hataAskiMetni(error)'],
  'yorum (satir)': ['features/feed/components/detail/PublishedActivityDetail.tsx', 'sonuc.askiMetni ??'],
  'not': ['features/feed/hooks/useActivityActions.tsx', 'hataAskiMetni(error) ??'],
  'inceleme (hook)': ['hooks/useMediaReviews.ts', 'askiMetni: hataAskiMetni(result)'],
  'inceleme (pencere)': ['components/reviews/WriteReviewSheet.tsx', 'result.askiMetni ??'],
  'profil (hook)': ['hooks/useUpdateProfile.ts', 'askiMetni: hataAskiMetni(err)'],
  'aciklama penceresi': ['components/modals/EditBioModal.tsx', 'error.askiMetni ??'],
  'gorunen ad penceresi': ['components/modals/EditDisplayNameModal.tsx', 'error.askiMetni ??'],
  'kullanici adi penceresi': ['components/modals/EditProfileModal.tsx', 'error.askiMetni ??'],
  'isim ekrani': ['app/(public)/profil-olustur.tsx', 'error.askiMetni ??'],
};
for (const [ad, [dosya, iz]] of Object.entries(askiYuzeyleri)) T.ok(`${ad}: aski nedenini gosterir`, oku(dosya).includes(iz), dosya);
T.bitir();
