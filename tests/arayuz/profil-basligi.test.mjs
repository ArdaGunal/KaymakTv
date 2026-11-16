// ==========================================================================
// ARAYUZ — Profil basligi sadelesme (1.0.1 Dal 2, kullanici karari 2026-11-15)
// ==========================================================================
// Kurallar: gorunen ad varsa ve kullanici adindan farkliysa iki satir (ad / @ad), yoksa ya da
// ayniysa TEK satir (@ olmadan). Kullanici adina dokununca `@ad` panoya. Paylas dugmesi
// «Profili Duzenle» / «Takip Et» yaninda. Kaymak numarasi baslikta YOK, «Profilim» ekraninda.
// Cikti ASCII (tests/yardimci.js kurali).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tsLoader } from '../ts-test-loader.mjs';
import yardimci from '../yardimci.js';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const T = yardimci.baslat('ARAYUZ PROFIL BASLIGI (1.0.1 Dal 2)', { kokOneki: 'arayuz-profil-basligi-' });
const oku = (p) => fs.readFileSync(path.join(KOK, p), 'utf8');
const { profilAdSatirlari: s } = tsLoader(KOK)('utils/profilAdi.ts');
const esit = (a, b) => JSON.stringify(a) === JSON.stringify(b);

T.H('1 · Ad satirlari kurali');
T.ok('gorunen ad farkli: iki satir', esit(s('Arda Günal', 'ArdaGnl'), { baslik: 'Arda Günal', altSatir: '@ArdaGnl' }));
T.ok('gorunen ad yok: tek satir, @ yok', esit(s(null, 'ArdaGnl'), { baslik: 'ArdaGnl', altSatir: null }));
T.ok('gorunen ad bos dize / bosluk: tek satir', esit(s('  ', 'ArdaGnl'), { baslik: 'ArdaGnl', altSatir: null }));
T.ok('gorunen ad kullanici adiyla ayni (buyuk/kucuk harf farki): tek satir', esit(s('ardagnl', 'ArdaGnl'), { baslik: 'ArdaGnl', altSatir: null }));
T.ok('kullanici adi yok (yukleniyor): gorunen ad tek satir', esit(s('Arda Günal', ''), { baslik: 'Arda Günal', altSatir: null }));
T.ok('ikisi de yok: bos baslik (cagiran yedek gosterir)', esit(s(null, null), { baslik: '', altSatir: null }));

T.H('2 · Ekranlar ortak parcalari kullanir');
const ekranlar = {
  'mobil baslik': 'components/profile/ProfileHeader.tsx',
  // 1.0.1 Dal 5: masaüstü başlığı 400 satır kuralı için ekrandan ayrı bileşene taşındı.
  'web kendi profilim': 'components/profile/DesktopProfileHeader.tsx',
  'web baskasinin profili': 'app/(protected)/user/[slug].web.tsx',
};
for (const [ad, dosya] of Object.entries(ekranlar)) {
  const k = oku(dosya);
  T.ok(`${ad}: ad blogu ortak bilesenden (tekrar yok)`, /<ProfilAdBlogu\b/.test(k) && !/@\{profile\.username\}/.test(k));
  T.ok(`${ad}: Kaymak numarasi baslikta YOK`, !/KaymakNoEtiketi/.test(k));
  T.ok(`${ad}: paylas dugmesi eylem dugmesinin yaninda`, /<ProfilPaylasDugmesi\b/.test(k));
}
T.ok('web kendi profilim: ekran masaustu basligi ortak bilesenden aliyor',
  /<DesktopProfileHeader\b/.test(oku('app/(protected)/(tabs)/profile.web.tsx')));
const duzenle = oku('screens/EditProfileMobile.tsx');
T.ok('Profilim: Kaymak ID satiri + kopyala burada', /<KaymakNoEtiketi\b/.test(duzenle) && /editProfileKaymakIdLabel/.test(duzenle));
T.ok('Profilim: ad blogu da ayni kural (tekrar yok)', /<ProfilAdBlogu\b/.test(duzenle) && !/@\{profile\.username\}/.test(duzenle));
const etiket = oku('components/profile/KaymakNoEtiketi.tsx');
T.ok('Kaymak numarasi etiketi artik yalniz kopyalar (paylas ayri dugmede)', !/Share2|profilPaylasimLinki/.test(etiket));

T.H('3 · Kopyalama ve paylasma');
const eylem = oku('hooks/useProfilEylemleri.ts');
T.ok('kullanici adi @ ile kopyalanir', /setStringAsync\(`@\$\{kullaniciAdi\}`\)/.test(eylem));
T.ok('Android de sistem toast i, diger platformda satir ici bildirim', /ToastAndroid\.show\(/.test(eylem) && /else kopyalandiGoster\(\);/.test(eylem));
T.ok('paylasim kisa baglantiyla (ad degisse de kirilmaz)', /profilPaylasimLinki\(kaymakNo\)/.test(eylem));
T.ok('hatalar logError a gider (sessiz basarisizlik yok)', (eylem.match(/logError\(/g) || []).length >= 2);
const blok = oku('components/profile/ProfilAdBlogu.tsx');
T.ok('tek satirda baslik, iki satirda @satir dokununca kopyalar', /profilAdSatirlari\(/.test(blok) && /onPress=\{kopyala\}/.test(blok));

T.H('4 · Sag ust «⋮» menusu: Profili bildir + Engelle (kullanici karari 2026-11-15)');
// Google Play UGC: uygulama ici bildirme + engelleme yolu sart, ayri dugme sart degil.
const mobil = oku('screens/PublicProfileMobile.tsx');
const web = oku('app/(protected)/user/[slug].web.tsx');
for (const [ad, k] of [['mobil', mobil], ['web', web]]) {
  T.ok(`${ad}: menu users.id ile, bildir modalini acar`, /<ProfilMenusu targetUserId=\{hedefUserId\} onReport=\{\(\) => setBioRaporAcik\(true\)\} \/>/.test(k));
  T.ok(`${ad}: ayri «Profili bildir» baglantisi ve tek engelle simgesi kalmadi`, !/reportProfile/.test(k) && !/BlockUserButton/.test(k));
}
T.ok('mobil ust cubukta @kullanici_adi tekrari yok (ad blogunda zaten var)', !/`@\$\{profile\.username\}`/.test(mobil));
T.ok('baslik bildir baglantisi tasimiyor', !/onReportBio/.test(oku('components/profile/ProfileHeader.tsx')));
const menu = oku('features/publicProfile/components/ProfilMenusu.tsx');
T.ok('menu: «Profili bildir» etiketi, engel durumu netlesmeden engelle satiri yok',
  /reportLabel=\{t\('reportProfile'/.test(menu) && /onBlock=\{isLoading \|\| isMutating \? undefined : engelDegistir\}/.test(menu) && /blocked=\{didIBlockThem\}/.test(menu));
T.ok('menu: hata gorunur bildirilir', /notify\(t\('common:error'\), t\('common:actionFailedMessage'\)\)/.test(menu));
const kart = oku('features/feed/components/CardMenu.tsx');
T.ok('CardMenu: engelliyse «Engeli Kaldir», degilse kirmizi «Kullaniciyi Engelle»',
  /blocked \? t\('feed:unblock'/.test(kart) && /!blocked && styles\.deleteText/.test(kart));

T.bitir();
