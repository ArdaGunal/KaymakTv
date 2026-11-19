// TRAKT-YORUM-KALDIR (2026-11-18, kullanıcı kararı): Trakt topluluğu yorumları istemciden
// tamamen kalktı; yapım sayfalarında yalnız KaymakTV incelemeleri var. Bu koruma testi
// silinen katmanın geri gelmesini ve ölü izlerin birikmesini engeller.
//
// ⚠️ Sunucu dalları (Worker `feedReport` trakt_comment, `feedBlock` blockedTraktSlug, mod paneli
// `islem_disi`, `gizli_trakt_yorumlari`, `feed_activities.trakt_comment_id`) eski APK'lar (1.0.0)
// için BİLEREK duruyor; silme koşulu docs/design/TRAKT_YORUM_KALDIRMA.md'de. Bu test yalnız
// istemciyi (Kaymak/ uygulama kodu) denetler.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yardimci from '../yardimci.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const T = yardimci.baslat('TRAKT YORUMLARI YOK (TRAKT-YORUM-KALDIR)', { kokOneki: 'trakt-yorum-yok-' });
const oku = (f) => fs.readFileSync(path.join(root, f), 'utf8');

T.H('Silinen dosyalar geri gelmedi');
const SILINEN = [
  'services/api/comments.ts',
  'hooks/useComments.ts',
  'components/comments',
  'components/CommentSheet.tsx',
  'components/reviews/TraktCommentRow.tsx',
  'components/reviews/TraktCommentsBlock.tsx',
  'components/skeletons/CommentListSkeleton.tsx',
  'features/feed/hooks/useMyTraktSlug.ts',
];
for (const f of SILINEN) T.ok(`${f} yok`, !fs.existsSync(path.join(root, f)));

T.H('Uygulama kodunda Trakt yorumu izi yok');
const DIZINLER = ['app', 'components', 'features', 'hooks', 'services', 'utils', 'context', 'constants', 'store', 'screens'];
const dosyalar = [];
const tara = (d) => {
  const tam = path.join(root, d);
  if (!fs.existsSync(tam)) return;
  for (const ad of fs.readdirSync(tam)) {
    const yol = `${d}/${ad}`;
    if (fs.statSync(path.join(root, yol)).isDirectory()) tara(yol);
    else if (/\.(tsx?|jsx?)$/.test(ad)) dosyalar.push(yol);
  }
};
DIZINLER.forEach(tara);
const IZLER = [
  /trakt_comment/, /traktComment/i, /getMediaComments|getCommentReplies|getEpisodeComments/,
  /\buseComments\b/, /\bCommentSheet\b/, /useMyTraktSlug/, /blockedTraktSlug/, /gizli_trakt/,
  /\/comments\/(likes|newest|oldest|\$\{)/, /\/comments\/\$\{[^}]+\}\/replies/,
];
const bulgu = [];
for (const f of dosyalar) {
  const metin = oku(f);
  for (const re of IZLER) if (re.test(metin)) bulgu.push(`${f} ~ ${re}`);
}
T.ok(`${dosyalar.length} dosyada iz yok${bulgu.length ? ': ' + bulgu.join(' | ') : ''}`, bulgu.length === 0);

T.H('Ortak dosyalarda yalniz KaymakTV dali kaldi');
T.ok("Sikayet tipi: 'trakt_comment' yok, KaymakTV tipleri duruyor",
  /export type ReportTargetType = 'activity' \| 'comment' \| 'user_bio';/.test(oku('features/feed/services/contentReports.ts')));
T.ok('Engel hedefi tek dal: { userId }',
  /export type EngelHedefi = \{ userId: string \};/.test(oku('features/feed/services/userBlocks.ts')));
const bolum = oku('components/reviews/MediaCommentsSection.tsx');
T.ok('Yorumlar bolumu: inceleme yazma, begeni ve vurgu duruyor',
  /<ReviewItem/.test(bolum) && /WriteReviewSheet/.test(bolum) && /toggleReviewLike/.test(bolum) && /focusReviewId/.test(bolum));
T.ok('Yorumlar bolumu 400 satirin altinda', bolum.split('\n').length <= 400);
for (const f of ['hooks/useMovieDetail.ts', 'hooks/useShowDetail.ts', 'hooks/useEpisodeDetail.ts']) {
  T.ok(`${f}: yorum yukleme durumu yok`, !/isLoadingComments|comments:/.test(oku(f)));
}

T.H('Trakt yorumlarina ait ceviri anahtarlari iki dilde de silindi');
const SILINEN_ANAHTAR = {
  media: ['traktCommunityTitle', 'seeAllCount', 'allSpoilers', 'hideReplies', 'noRepliesYet', 'writeComment', 'replyPlaceholder', 'comments'],
  common: ['viewReplies', 'sortMostLiked', 'sortNewest', 'sortOldest', 'commentsLoadError', 'noCommentsYet', 'containsSpoilers', 'tapToView'],
};
for (const dil of ['tr', 'en']) {
  for (const [ns, ks] of Object.entries(SILINEN_ANAHTAR)) {
    const sozluk = JSON.parse(oku(`locales/${dil}/${ns}.json`));
    const kalan = ks.filter((k) => k in sozluk);
    T.ok(`${dil}/${ns}.json temiz${kalan.length ? ': ' + kalan.join(', ') : ''}`, kalan.length === 0);
  }
}

T.bitir();
