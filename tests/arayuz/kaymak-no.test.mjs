import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { tsLoader } from '../ts-test-loader.mjs';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const T = require('../yardimci').baslat('KAYMAKNO (Kimlik birligi Faz 2 · 066)', { kokOneki: 'kaymak-no-' });
const oku = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const { kaymakNoMetni } = tsLoader(root)('utils/kaymakNo.ts');

T.H('Gorunum #48291735 (D9)');
T.ok('8 hane -> #numara', kaymakNoMetni(48291735) === '#48291735');
T.ok('Aralik disi / yok -> null (gosterilmez)', kaymakNoMetni(9999999) === null && kaymakNoMetni(100000000) === null && kaymakNoMetni(null) === null && kaymakNoMetni(undefined) === null && kaymakNoMetni(4829.5) === null);

T.H('Bagli ekranlar');
T.ok('Profil servisi kaymakNo okuyor (yoksa null)', /kaymakNo: typeof response\.data\.kaymakNo === 'number'/.test(oku('features/feed/services/profile.ts')));
T.ok('Kendi profil kancasi kaymakNo donduruyor', /kaymakNo: veri\?\.kaymakNo \?\? null/.test(oku('hooks/useMyTraktProfile.ts')) && /sonuc\.kaymakNo = kaymakProfil\.kaymakNo/.test(oku('store/benimProfilimStore.ts')));
T.ok('Mobil baslik etiketi ciziyor', oku('components/profile/ProfileHeader.tsx').includes('<KaymakNoEtiketi no={kaymakNo} />'));
T.ok('Mobil: kendi + baskasinin profili numarayi veriyor', oku('screens/ProfileMobile.tsx').includes('kaymakNo={kaymakNo}') && oku('screens/PublicProfileMobile.tsx').includes('kaymakNo={kaymakProfil?.profile.kaymakNo}'));
T.ok('Web: kendi + baskasinin profili etiketi ciziyor', oku('app/(protected)/(tabs)/profile.web.tsx').includes('<KaymakNoEtiketi no={kaymakNo} />') && oku('app/(protected)/user/[slug].web.tsx').includes('<KaymakNoEtiketi no={kaymakProfil?.profile.kaymakNo} />'));
T.ok('Arama sonucunda numara', oku('features/feed/components/UserSearchResults.tsx').includes('kaymakNoMetni(kisi.kaymakNo)'));
T.ok('Etiket panoya kopyalar (giris anahtari degil, yalniz gosterim)', /Clipboard\.setStringAsync\(metin\)/.test(oku('components/profile/KaymakNoEtiketi.tsx')));

T.H('Ceviri');
const tr = JSON.parse(oku('locales/tr/common.json')), en = JSON.parse(oku('locales/en/common.json'));
T.ok('kaymakNoKopyala + kaymakNoKopyalandi TR + EN', ['kaymakNoKopyala', 'kaymakNoKopyalandi'].every((k) => tr[k] && en[k]) && tr.kaymakNoKopyala.includes('{{no}}') && en.kaymakNoKopyala.includes('{{no}}'));
T.bitir();
