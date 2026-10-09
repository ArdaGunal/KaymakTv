import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yardimci from '../yardimci.js';

// C4 · Yazıya dokunmak ≠ karta dokunmak. İnceleme → yapım sayfasında o inceleme.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const T = yardimci.baslat('AKIS YAZIDAN YORUMA (C4)', { kokOneki: 'akis-yorum-' });
const oku = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const eylem = oku('features/feed/hooks/useActivityActions.tsx');
T.ok('Inceleme degilse yazi -> detay sayfasi', /activity\.activityType !== 'reviewed' \|\| !hasShow\) return openDetail\(\)/.test(eylem));
T.ok('Inceleme -> yapim sayfasi + yorum parametresi', /href \+ yorumEki\(activity, href\.includes\('\?'\)\)/.test(eylem) && /yorum=\$\{encodeURIComponent\(a\.id\)\}/.test(eylem));
T.ok('Bolum incelemesi -> bolum sayfasi (kimlik cozulur), olmazsa dizi', /openEpisode\(activity, diziyeGit, \{ yorum: activity\.id \}\)/.test(eylem));
const not = oku('features/feed/components/FeedActivityNote.tsx');
T.ok('Akis kartinda yazi dokunusu openText (eski: kendi notunda duzenleme)', /onPressText\?: \(\) => void/.test(not) && !/onPressEdit/.test(not) && /onPressText=\{isInteractive \? actions\.openText : undefined\}/.test(oku('features/feed/components/FeedCard.tsx')));
T.ok('Duzenleme hala menude (Edit) ve alinti ikonunda', /onEdit: isOwnActivity \? \(\) => setNoteModalVisible\(true\)/.test(eylem));
const kanca = oku('hooks/useScrollToComment.ts');
T.ok('Sayfa yalniz BIR KEZ kaydirir (kullanici kaydirinca geri ziplamaz)', /kaydirilan\.current === focusId\) return/.test(kanca) && /measureLayout/.test(kanca));
const bolum = oku('components/reviews/MediaCommentsSection.tsx');
T.ok('Yorum bolumu odaktaki incelemeyi sarar, vurgu soner', /reviewId === focusReviewId/.test(bolum) && /setTimeout\(\(\) => setVurguAcik\(false\), 3500\)/.test(bolum));
for (const s of ['show', 'movie', 'episode']) {
  const sayfa = oku(`app/${s}/[id].tsx`);
  const kaydirma = (sayfa.match(/ref=\{yorumOdagi\.scrollRef\}/g) || []).length;
  T.ok(`${s} sayfasi: iki duzende de kaydirma ref'i + odak propu (${kaydirma})`, kaydirma === 2 && /focusReviewId=\{yorumOdagi\.focusId\}/.test(sayfa));
}
T.bitir();
