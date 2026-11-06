// ==========================================================================
// ARAYUZ — 2.6.8 MENU-01: secim/eylem menuleri ekranin ortasinda
// ==========================================================================
// Kullanici (2026-11-06): «ekrandaki alan en alt yerine ortada olsun ... tum
// sezonu isaretle kismi ... genel olarak bu tarz menuler ekran ortasinda olsun».
// Ortak kabuk `components/modals/OrtaPencere.tsx`. Uzun icerik / klavye tasiyan
// sayfalar bilincli olarak altta kalir (IZINLI listesi); yeni bir alttan-kayan
// pencere eklenirse bu test kalir ve karar bilerek verilir.
//
// Cikti ASCII (tests/yardimci.js kurali).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yardimci from '../yardimci.js';

const T = yardimci.baslat('ARAYUZ ORTA MENU (2.6.8 MENU-01)', { kokOneki: 'arayuz-orta-menu-' });
const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const oku = (p) => fs.readFileSync(path.join(KOK, p), 'utf8');

T.H('Ortak kabuk');
const kabuk = oku('components/modals/OrtaPencere.tsx');
T.ok('ortada: justifyContent + alignItems center', /justifyContent: 'center',\s*alignItems: 'center'/.test(kabuk));
T.ok('Android geri tusu kapatir (onRequestClose)', /onRequestClose=\{onClose\}/.test(kabuk));
T.ok('disari dokunma kapatir', /<Pressable style=\{StyleSheet\.absoluteFill\} onPress=\{onClose\}/.test(kabuk));
T.ok('web: Escape kapatir', /e\.key === 'Escape'/.test(kabuk));
T.ok('kayma degil solma animasyonu', /animationType="fade"/.test(kabuk) && !/slide/.test(kabuk.replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, '')));

T.H('Menuler kabugu kullaniyor, alttan acilmiyor');
const MENULER = [
  'components/modals/EpisodeOptionsModal.tsx',
  'components/modals/OptionsModal.tsx',
  'components/SeasonAccordion.tsx',
  'components/library/LibraryFilterModal.tsx',
  'components/settings/LanguagePickerModal.tsx',
];
for (const d of MENULER) {
  const s = oku(d);
  T.ok(`${d}: OrtaPencere`, /<OrtaPencere\b/.test(s) && !/<Modal\b/.test(s) && !/justifyContent: 'flex-end'/.test(s));
}
T.ok('filtrenin olu `wide` ozelligi kalkti', !/wide\??:/.test(oku('components/library/LibraryFilterModal.tsx'))
  && !/<LibraryFilterModal\s+wide/.test(oku('app/(protected)/library/[type].web.tsx')));

T.H('Bolum menusu: «Izlemeyi Kaldir» baslik + aciklama alt alta');
const bolum = oku('components/modals/EpisodeOptionsModal.tsx');
T.ok('baslik ve aciklama ayni dikey sarmalayicida', /<View style=\{styles\.destructiveTextWrap\}>\s*<Text[^>]*>\{t\('unwatch'\)\}<\/Text>\s*<Text style=\{styles\.destructiveSubtext\}>/.test(bolum));

T.H('Alttan kayan pencere yalniz izinli icerik sayfalarinda');
const IZINLI = new Set([
  'components/AddToListModal.tsx', 'components/CommentSheet.tsx', 'components/reviews/WriteReviewSheet.tsx',
  'components/modals/EditBioModal.tsx', 'components/modals/EditDisplayNameModal.tsx', 'components/modals/EditProfileModal.tsx',
  'components/settings/LegalTermsModal.tsx', 'features/feed/components/ComposePostModal.tsx', 'features/feed/components/MediaPickerModal.tsx',
]);
const tara = (dizin, cikti = []) => {
  for (const ad of fs.readdirSync(path.join(KOK, dizin))) {
    const yol = `${dizin}/${ad}`;
    if (fs.statSync(path.join(KOK, yol)).isDirectory()) tara(yol, cikti);
    else if (ad.endsWith('.tsx')) cikti.push(yol);
  }
  return cikti;
};
const kayanlar = ['app', 'components', 'features', 'screens'].flatMap((d) => tara(d))
  .filter((d) => /animationType=\{?["'][^"']*slide|animationType="slide"/.test(oku(d)));
const izinsiz = kayanlar.filter((d) => !IZINLI.has(d));
T.ok(`alttan kayan ${kayanlar.length} pencerenin hepsi izinli listede`, izinsiz.length === 0);
for (const d of izinsiz) T.ok(`izinsiz alttan kayan pencere: ${d}`, false);

T.bitir();
