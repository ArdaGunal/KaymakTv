// M620 · Trakt cihaz kodu girişi — istemci (docs/design/TRAKT_CIHAZ_KODU_PLANI.md §3.3).
// 🔴 İDDİALAR: bekleyen oturum SecureStore'da, bozuk/süresi geçmiş kayıt silinir · yoklama aralığı Trakt'ınki,
// 429'da +5 sn, geri çekilme tavanı 30 sn · Worker cevapları doğru sınıflanır · adres yalnız https trakt.tv ·
// bağlama niyeti kod ALINIRKEN tüketilir · çıkış ve misafir bekleyen oturumu siler · ekran web'i bozmaz.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { tsLoader } from '../ts-test-loader.mjs';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const T = require('../yardimci').baslat('TRAKT CIHAZ KODU (M620)', { kokOneki: 'trakt-cihaz-' });
const oku = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const guvenli = new Map();
const SecureStore = {
  getItemAsync: async (k) => (guvenli.has(k) ? guvenli.get(k) : null),
  setItemAsync: async (k, v) => { guvenli.set(k, v); },
  deleteItemAsync: async (k) => { guvenli.delete(k); },
};
let axiosCevap = null;
let axiosIstek = null;
const axios = { post: async (url, govde) => { axiosIstek = { url, govde }; return axiosCevap(url, govde); } };

const yukle = tsLoader(root, {
  '../../utils/secureStorage': SecureStore,
  axios: { __esModule: true, default: axios },
});
const O = yukle('services/auth/traktCihazOturumu.ts');
const A = yukle('services/api/traktCihaz.ts');

const KOD = { deviceCode: 'LS5brMGjG79-AFZKaJvi51qoT_rKbKcbNny83u1WXfY', userCode: 'JBWT7NY7', dogrulamaAdresi: 'https://auth.trakt.tv/activate/JBWT7NY7', sureSn: 600, aralikSn: 6 };

T.H('Bekleyen oturum (saf)');
const o = O.oturumOlustur(KOD, 'giris', 1_000);
T.ok('Bitis = simdi + expires_in, aralik Trakt\'tan (6 sn, sabit degil)', o.bitisMs === 601_000 && o.aralikMs === 6_000 && o.mod === 'giris');
T.ok('Gecerli kayit kabul', O.oturumGecerliMi(o, 2_000));
T.ok('Suresi gecmis / bozuk / yabanci mod reddedilir',
  !O.oturumGecerliMi(o, 601_000) && !O.oturumGecerliMi({ ...o, deviceCode: 'kisa' }, 2_000)
  && !O.oturumGecerliMi({ ...o, mod: 'baska' }, 2_000) && !O.oturumGecerliMi({ ...o, dogrulamaAdresi: 'http://x' }, 2_000) && !O.oturumGecerliMi(null, 0));

T.H('Yoklama zamanlamasi');
T.ok('Ilk (acilis, surec olumu sonrasi) → hemen', O.sonrakiYoklamaGecikmesi(null, 6_000, 50) === 0);
T.ok('Aralik dolmadan one gelince kalan sure (429 yenmez — olculdu: 1–2 sn arayla ikinci istek 429)', O.sonrakiYoklamaGecikmesi(10_000, 6_000, 12_000) === 4_000);
T.ok('Aralik dolduysa hemen', O.sonrakiYoklamaGecikmesi(10_000, 6_000, 17_000) === 0);
T.ok('429 → +5 sn', O.YAVASLA_EK_MS === 5_000);
T.ok('Geri cekilme 6 → 12 → 24 → 30 tavan', [1, 2, 3, 4, 9].map((n) => O.geriCekilmeMs(n, 6_000)).join() === '6000,12000,24000,30000,30000');

T.H('Hata sinifi');
T.ok('suresi_doldu / reddedildi kendi ekrani', O.hataSinifi('suresi_doldu') === 'suresi_doldu' && O.hataSinifi('reddedildi') === 'reddedildi');
T.ok('gecersiz / kullanildi → yeni kod', O.hataSinifi('gecersiz') === 'yeni_kod' && O.hataSinifi('kullanildi') === 'yeni_kod');
T.ok('ag / tekrar_dene / cok_istek / sunucu → gecici (durum SILINMEZ)', ['ag', 'tekrar_dene', 'cok_istek', 'sunucu'].every((k) => O.hataSinifi(k) === 'gecici'));

T.H('Gosterim');
T.ok('Kod 4+4', O.koduBicimle('JBWT7NY7') === 'JBWT 7NY7' && O.koduBicimle('ABC') === 'ABC');

T.H('Disk (SecureStore)');
await O.cihazOturumunuKaydet(o);
T.ok('SecureStore anahtari traktCihazOturumu', guvenli.has('traktCihazOturumu'));
T.ok('Gecerli kayit okunur', (await O.cihazOturumunuOku(2_000))?.userCode === 'JBWT7NY7');
T.ok('Suresi gecmis kayit okunmaz VE silinir', (await O.cihazOturumunuOku(700_000)) === null && !guvenli.has('traktCihazOturumu'));
guvenli.set('traktCihazOturumu', '{bozuk');
T.ok('Bozuk kayit silinir', (await O.cihazOturumunuOku(2_000)) === null && !guvenli.has('traktCihazOturumu'));

T.H('Worker uclari');
axiosCevap = () => ({ data: { success: true, ...KOD } });
const k = await A.cihazKoduBaslat();
T.ok('baslat: /auth/trakt/cihaz/baslat, alanlar aynen', axiosIstek.url === 'https://worker.invalid/auth/trakt/cihaz/baslat' && k.userCode === 'JBWT7NY7' && k.aralikSn === 6);
const hataKodu = async (is) => { try { await is(); return null; } catch (e) { return e instanceof A.CihazHatasi ? e.kod : `BASKA:${e}`; } };
axiosCevap = () => ({ data: { success: true, ...KOD, dogrulamaAdresi: 'https://trakt.tv.saldirgan.io/activate/X' } });
T.ok('🔴 baslat: yabanci adres reddedilir (cihaz bunu tarayicida acar)', (await hataKodu(A.cihazKoduBaslat)) === 'sunucu');
T.ok('Adres denetimi: https + trakt.tv alt alanlari', A.cihazKoduGecerli(KOD) && A.cihazKoduGecerli({ ...KOD, dogrulamaAdresi: 'https://trakt.tv/activate/A' })
  && !A.cihazKoduGecerli({ ...KOD, dogrulamaAdresi: 'http://trakt.tv/activate' }) && !A.cihazKoduGecerli({ ...KOD, dogrulamaAdresi: 'https://kotutrakt.tv/' }));

axiosCevap = () => ({ data: { success: true, durum: 'bekliyor' } });
T.ok('yokla: bekliyor', (await A.cihazKodunuYokla(KOD.deviceCode)).durum === 'bekliyor' && axiosIstek.govde.deviceCode === KOD.deviceCode);
axiosCevap = () => ({ data: { success: true, durum: 'yavasla' } });
T.ok('yokla: yavasla', (await A.cihazKodunuYokla(KOD.deviceCode)).durum === 'yavasla');
axiosCevap = () => ({ data: { success: true, durum: 'tamam', erisim: 'e-1', erisimBitis: 1, kimlik: { slug: 's' }, kasaBileti: 'b-1' } });
const tam = await A.cihazKodunuYokla(KOD.deviceCode);
T.ok('yokla: tamam → /degis ile ayni TraktGirisi', tam.durum === 'tamam' && tam.giris.erisim === 'e-1' && tam.giris.kasaBileti === 'b-1' && tam.giris.kimlik.slug === 's');
for (const [status, code] of [[410, 'suresi_doldu'], [403, 'reddedildi'], [404, 'gecersiz'], [409, 'kullanildi'], [503, 'tekrar_dene'], [429, 'cok_istek']]) {
  axiosCevap = () => { const e = new Error('x'); e.response = { status, data: { success: false, code } }; throw e; };
  T.ok(`yokla: HTTP ${status} → ${code}`, (await hataKodu(() => A.cihazKodunuYokla(KOD.deviceCode))) === code);
}
axiosCevap = () => { throw new Error('Network Error'); };
T.ok('yokla: ag hatasi → ag (gecici)', (await hataKodu(() => A.cihazKodunuYokla(KOD.deviceCode))) === 'ag');
axiosCevap = () => ({ data: { success: true, durum: 'tamam' } });
T.ok('yokla: eksik paket → sunucu', (await hataKodu(() => A.cihazKodunuYokla(KOD.deviceCode))) === 'sunucu');

T.H('Kanca (kaynak)');
const kanca = oku('hooks/useTraktCihazGirisi.ts');
T.ok('Baglama niyeti kod ALINIRKEN tuketilir; yeni kodda baglama korunur',
  /istenen === 'baglama' \|\| \(await traktBaglamaNiyetiTuket\(\)\) \? 'baglama' : istenen/.test(kanca) && kanca.indexOf('traktBaglamaNiyetiTuket()') < kanca.indexOf('await cihazKoduBaslat()'));
T.ok('Yalniz on plandayken yoklar; one gelince aralik dolduysa hemen', /AppState\.currentState !== 'active'\) return;/.test(kanca) && /s === 'active'\) planla\(sonrakiYoklamaGecikmesi\(/.test(kanca));
T.ok('Tek istek: ucustaki istek nesle bagli (eski nesil yenisini kilitlemez)', /yoklaniyorRef\.current === nesilRef\.current\) return;/.test(kanca) && /if \(yoklaniyorRef\.current === nesil\) yoklaniyorRef\.current = null;/.test(kanca));
T.ok('Gec gelen yanit yok sayilir (nesil)', (kanca.match(/if \(nesil !== nesilRef\.current\) return;/g) || []).length >= 3);
T.ok('Gecici hata oturumu SILMEZ (cevrimdisi + geri cekilme)', /sinif === 'gecici'[\s\S]{0,200}planla\(geriCekilmeMs\(/.test(kanca));
T.ok('Basari: oturum diskten silinir, sonra giris tamamlanir; uyusmazlikta kod gorunumu kapanir',
  kanca.indexOf("setDurum({ tur: 'tamamlaniyor' })") > kanca.indexOf('await cihazOturumunuSil();') && /await onGirisRef\.current\(sonuc\.giris, oturum\.mod\);\s+\/\/[^\n]*\n\s+setDurum\(\{ tur: 'bos' \}\);/.test(kanca));
T.ok('M622: kod alininca Trakt KENDILIGINDEN acilir (ikinci dokunus yok)', /surdur\(o\);\s+await trakttaOnayla\(\);/.test(kanca) && kanca.indexOf('const trakttaOnayla') < kanca.indexOf('const baslat'));
T.ok('M622: «otomatik kopyalandi» yalniz pano gercekten yazildiysa; bitince sifirlanir', /await Clipboard\.setStringAsync\(o\.userCode\);\s+setKopyalandi\(true\);/.test(kanca) && /oturumRef\.current = null;\s+setKopyalandi\(false\);/.test(kanca));
T.ok('Onayla: kod panoya + sayfa siradan tarayicida (auth oturumu DEGIL)', /Clipboard\.setStringAsync\(o\.userCode\)/.test(kanca) && /Linking\.openURL\(o\.dogrulamaAdresi\)/.test(kanca) && !/openAuthSessionAsync|promptAsync/.test(kanca));
T.ok('Acilista bekleyen oturum surer', /cihazOturumunuOku\(\)\.then\(\(o\) => \{\s+if \(!iptal && o && !oturumRef\.current\) surdur\(o\);/.test(kanca));

T.H('Ekran ve temizlik');
const ekran = oku('app/(public)/settings.tsx');
T.ok('Native cihaz kodunu, web ayri yonlendirme kancasini kullanir', /const nativeGiris = Platform\.OS !== 'web'/.test(ekran)
  && /if \(nativeGiris\) \{\s+await cihaz\.baslat\(zorunluGiris \? 'kart' : 'giris'\);\s+return;\s+\}\s+await webGirisi\.baslat/.test(ekran)
  && !/promptAsync|TRAKT_CIHAZ_GIRISI/.test(ekran));
T.ok('Kod ekrani acikken diger secenekler gizli', /const kutuAcik = [^\n]*\|\| cihazAcik;/.test(ekran) && /\{cihazAcik && !uyariAcik && \(\s+<TraktCihazKodu/.test(ekran));
T.ok('Emulator bulgusu: kod ekraninda Google dugmesi de gizli (Madde 231: unmount DEGIL, gizli)', /<GoogleGirisDugmesi [^>]*gizli=\{uyariAcik \|\| cihazAcik\}/.test(ekran));
T.ok('settings.tsx 400 satirin altinda', ekran.split('\n').length < 400);
const auth = oku('context/AuthContext.tsx');
const misafir = auth.slice(auth.indexOf('const loginAsGuest'), auth.indexOf('const removeKeys = '));
T.ok('Misafire gecis bekleyen oturumu siler', misafir.includes("SecureStore.deleteItemAsync('traktCihazOturumu')"));
T.ok('Cikis bekleyen oturumu siler', auth.slice(auth.indexOf('const removeKeys = ')).includes("SecureStore.deleteItemAsync('traktCihazOturumu')"));
const giris = oku('app/(public)/index.tsx');
T.ok('Karsilama: bekleyen oturum varsa giris ekranina (surec olumu sonrasi)', /cihazOturumunuOku\(\)\.then\(\(o\) => \{\s+if \(o && !iptal\) router\.replace\('\/\(public\)\/settings'\);/.test(giris) && /Platform\.OS === 'web'/.test(giris));
const uyari = oku('components/auth/TraktHesapUyusmazligiEkrani.tsx');
T.ok('Uyusmazlik ekrani cihaz kodu metinlerini kullanir (prompt=login yok)', /cihazKodu = false/.test(uyari) && /settings:uyusmazlikIpucu\$\{ek\}/.test(uyari) && /cihazKodu=\{nativeGiris\}/.test(ekran));
const anahtarlar = ['cihazBaslik', 'cihazAltBaslik', 'cihazKodEtiketi', 'cihazKodKopyalandi', 'cihazTekrarAc', 'cihazTekrarDene',
  'cihazBaglantiBekleniyor', 'cihazVazgec', 'cihazKodAliniyor', 'cihazGirisYapiliyor', 'cihazSuresiDoldu', 'cihazReddedildi', 'cihazYeniKodGerekli',
  'cihazKodAlinamadi', 'rehberAdim2Cihaz', 'rehberAdim3Cihaz', 'uyusmazlikIpucuCihaz'];
const eksik = ['tr', 'en'].flatMap((d) => { const j = JSON.parse(oku(`locales/${d}/settings.json`)); return anahtarlar.filter((a) => typeof j[a] !== 'string').map((a) => `${d}:${a}`); });
T.ok('Butun metinler TR + EN', eksik.length === 0, eksik.join(','));
const bilesen = oku('components/auth/TraktCihazKodu.tsx');
T.ok('M622: sade ekran — maddeli kilavuz, geri sayim, buyuk onay dugmesi YOK', !/cihazAdim|cihazKalanSure|cihazTrakttaOnayla/.test(bilesen + ekran)
  && ['cihazAdim1', 'cihazKalanSure', 'cihazTrakttaOnayla'].every((a) => ['tr', 'en'].every((d) => !(a in JSON.parse(oku(`locales/${d}/settings.json`))))));
T.ok('M622: kod kutusu + «tekrar ac» + «vazgec»', /cihazKodKopyalandi/.test(bilesen) && /onPress=\{onTekrarAc\}/.test(bilesen) && /onTekrarAc=\{cihaz\.trakttaOnayla\}/.test(ekran) && /t\('cihazVazgec'\)/.test(bilesen));
T.ok('M622: bekleme basligi yalniz bekleme durumlarinda; hata ekraninda karsilama basligi', /const cihazBekliyor = \['kod_aliniyor', 'bekliyor', 'tamamlaniyor'\]\.includes\(cihaz\.durum\.tur\);/.test(ekran) && /cihazBekliyor \? 'cihazBaslik'/.test(ekran));

T.H('Baglama niyeti (asili kalmaz)');
const disk = new Map();
const N = tsLoader(root, { '@react-native-async-storage/async-storage': { __esModule: true, default: {
  getItem: async (k) => (disk.has(k) ? disk.get(k) : null), setItem: async (k, v) => { disk.set(k, v); }, removeItem: async (k) => { disk.delete(k); },
} } })('services/auth/baglamaNiyeti.ts');
await N.traktBaglamaNiyetiYaz(1_000);
T.ok('Gecerli niyet gorunur, silinmez', (await N.traktBaglamaNiyetiVarMi(2_000)) && disk.size === 1);
T.ok('Suresi dolmus niyet gosterimde de SILINIR', !(await N.traktBaglamaNiyetiVarMi(1_000 + N.NIYET_OMRU_MS + 1)) && disk.size === 0);
disk.set('kaymak-baglama-niyeti-v1', JSON.stringify({ tur: 'trakt', zaman: 'dun' }));
T.ok('Bozuk zaman → gecersiz ve silinir (eskiden VarMi sayi denetlemiyordu)', !(await N.traktBaglamaNiyetiVarMi(5_000)) && disk.size === 0);
disk.set('kaymak-baglama-niyeti-v1', JSON.stringify({ tur: 'trakt', zaman: 9_000 }));
T.ok('Gelecekten kayit gecersiz', !(await N.traktBaglamaNiyetiVarMi(5_000)));
T.bitir();
