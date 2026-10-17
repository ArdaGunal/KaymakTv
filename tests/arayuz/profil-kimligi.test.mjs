import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yardimci from '../yardimci.js';

// PROFIL-AD-01 (M519) — profil kimliği TAMAMEN bizden. Kullanıcı (2026-10-15): «Trakt artık
// kullanıcının profil kimliğini belirleyen ana kaynak değil, sadece arkada çalışan bir
// senkronizasyon eklentisidir.» · «Bizde açıklama boşsa ekranda da boş kalacak; Trakt'tan
// kesinlikle metin çekilmeyecek.» Canlı bulgu (M518): Trakt_test adını değiştirdi, kendi
// profilinde Trakt slug'ı görünüyordu.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const T = yardimci.baslat('PROFIL KIMLIGI BIZDEN (PROFIL-AD-01 · M519)', { kokOneki: 'profil-kimlik-' });
const oku = (f) => fs.readFileSync(path.join(root, f), 'utf8');

T.H('Kendi profilim (useMyTraktProfile — ProfileHeader + Edit Profile ayni kaynak)');
const kendi = oku('hooks/useMyTraktProfile.ts');
const traktDali = kendi.slice(kendi.indexOf("KİMLİK TAMAMEN BİZDEN"));
T.ok('@kullanici adi sunucudan, yoksa yerel kopya — Trakt\'tan DEGIL', /username: kaymakProfil\?\.username \|\| myUsername \|\| ''/.test(traktDali));
T.ok('Aciklama yalniz bizden (Trakt about yedegi YOK)', /about: kaymakProfil\?\.bio \?\? null/.test(traktDali) && !/\.about\b(?!:)/.test(traktDali.replace(/about: kaymakProfil\?\.bio \?\? null/, '')));
T.ok('Trakt profili kimlik alani tasimiyor (ad/foto/aciklama)', !/\.\.\.myProfile|\.\.\.traktProfil/.test(traktDali) && !/traktProfil\?\.(username|name|about|images)/.test(traktDali));
T.ok('Trakt cagrisi duserse profil yine cizilir (catch → null)', /getUserProfile\('me'\)\.catch\(/.test(traktDali));
T.ok('Edit Profile ayni kancayi kullaniyor', /useMyTraktProfile\(\)/.test(oku('screens/EditProfileMobile.tsx')));
T.ok('Kendi ad yerel kopyaya da yaziliyor, kanca bagimliligina girmeden (ref)', /yerelProfiliGuncelle\.current\(\{ username: kaymakProfil\.username \}\)/.test(traktDali) && !/myAvatarUrl, updateMyProfile\]/.test(kendi));

T.H('Baskasinin profili (usePublicProfileIdentity)');
const dis = oku('features/publicProfile/hooks/usePublicProfileIdentity.ts');
T.ok('Ad sunucudan', /username: kaymakProfil\.profile\.username/.test(dis));
T.ok('Aciklama yalniz bizden', /about: kaymakProfil\.profile\.bio \?\? null,/.test(dis) && !/traktProfil\?\.about/.test(dis));
T.ok('Trakt profili artik CEKILMIYOR (yukleme Trakt\'i beklemiyor)', !/=\s*usePublicProfile\(/.test(dis) && /isLoading: kaymakYukleniyor,/.test(dis));

T.H('Trakt adi yalniz Ayarlar\'da');
// M520: «Trakt Hesabı» bölümü Faz 5'te «Giriş yöntemleri»ne dönüştü.
const bolum = oku('components/settings/GirisYontemleriSection.tsx');
T.ok('«Bagli Trakt hesabi: @…» satiri', /t\('settings:traktBagliHesap', \{ ad: y\.traktAdi \}\)/.test(bolum));
T.ok('Slug kancadan (useGirisYontemleri → useBagliTraktHesabi)', /useBagliTraktHesabi\(authProvider === 'trakt'\)/.test(oku('hooks/useGirisYontemleri.ts')) && /<GirisYontemleriSection \/>/.test(oku('app/(protected)/account-settings.tsx')));
for (const dil of ['tr', 'en']) {
  const s = JSON.parse(oku(`locales/${dil}/settings.json`));
  T.ok(`${dil}: traktBagliHesap {{ad}} ile`, /@\{\{ad\}\}/.test(s.traktBagliHesap || ''));
}

T.H('Rotalar zaten bizim adimizla (M519 olcumu — gerilemesin)');
const rotaDosyalari = ['features/feed/hooks/useActivityActions.tsx', 'features/feed/components/MarathonFeedCard.tsx', 'components/reviews/ReviewItem.tsx', 'features/feed/components/UserSearchResults.tsx'];
T.ok('Profil baglantilari /user/${…username} (Trakt slug degil)', rotaDosyalari.every((f) => /\/user\/\$\{[^}]*username/.test(oku(f)) && !/\/user\/\$\{[^}]*traktSlug/.test(oku(f))));
T.bitir();
