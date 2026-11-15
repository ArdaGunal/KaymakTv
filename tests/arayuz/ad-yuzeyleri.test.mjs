// ==========================================================================
// ARAYUZ — Gorunen ad her yuzeyde ayni kural (1.0.1 Dal 2, kullanici karari 2026-11-15)
// ==========================================================================
// Kural `utils/profilAdi.ts` (profil basligiyla ayni): gorunen ad farkliysa «Ad» + «@ad»,
// yoksa ya da ayniysa yalniz «ad» (@ yok). Akis karti, akis detay satiri, maraton karti,
// yorum, takip agi, arama, takip istegi ve bildirim bu tek yardimciyi kullanir; satir ici
// `displayName || @username` kopyasi kalmaz. Akis/yorum verisi `display_name`i 083 ile okur.
// Cikti ASCII (tests/yardimci.js kurali).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yardimci from '../yardimci.js';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const T = yardimci.baslat('ARAYUZ AD YUZEYLERI (1.0.1 Dal 2)', { kokOneki: 'arayuz-ad-yuzeyleri-' });
const oku = (p) => fs.readFileSync(path.join(KOK, p), 'utf8');

T.H('1 · Yuzeyler ortak yardimciyi kullanir, satir ici kopya yok');
const yuzeyler = {
  'akis karti': 'features/feed/components/FeedCard.tsx',
  'akis detay satiri': 'features/feed/components/detail/ActivityAuthorRow.tsx',
  'maraton karti': 'features/feed/components/MarathonFeedCard.tsx',
  'akis yorumu': 'features/feed/components/FeedCommentItem.tsx',
  'takip agi': 'features/publicProfile/components/NetworkUserCard.tsx',
  'kullanici aramasi': 'features/feed/components/UserSearchResults.tsx',
  'takip istegi': 'app/(protected)/notifications.tsx',
  'bildirim satiri': 'features/notifications/components/TimelineRow.tsx',
};
for (const [ad, dosya] of Object.entries(yuzeyler)) {
  const k = oku(dosya);
  T.ok(`${ad}: profilAdSatirlari kullaniliyor`, /profilAdSatirlari\(/.test(k));
  T.ok(`${ad}: satir ici «displayName || @username» yok`, !/displayName \|\| `@\$\{/.test(k));
  T.ok(`${ad}: kosulsuz «@{...username}» cizimi yok`, !/>@\{[a-z.]*username\}</.test(k));
}
T.ok('akis karti: ad yerine ham username cizilmiyor', !/>\{activity\.user\.username\}</.test(oku(yuzeyler['akis karti'])));
T.ok('akis yorumu: ad yerine ham username cizilmiyor', !/>\{comment\.username\}</.test(oku(yuzeyler['akis yorumu'])));

T.H('2 · Veri: akis ve yorum display_name tasir');
const api = oku('features/feed/services/feedApi.ts');
const sosyal = oku('features/feed/services/feedSocial.ts');
T.ok('akis secimi display_name iceriyor', /user:users!inner\(id, trakt_slug, username, display_name, avatar_url\)/.test(api));
T.ok('akis eslemesi displayName yaziyor', /displayName: row\.user\.display_name \?\? null/.test(api));
T.ok('yorum secimi display_name iceriyor', /user:users!inner\(id, trakt_slug, username, display_name, avatar_url\)/.test(sosyal));
T.ok('yorum eslemesi displayName yaziyor', /displayName: row\.user\.display_name \?\? null/.test(sosyal));
T.ok('iyimser kart gorunen adi onbellege almadan okuyor',
  /resolveMeKimlik\(\)/.test(oku('features/feed/services/feedPublish.ts')));

T.H('3 · 083 kolon izni yalniz display_name');
const m083 = oku('supabase/schema/083_display_name_okuma_izni.sql')
  .split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
T.ok('083: display_name anon + authenticated okunur', /GRANT SELECT \(display_name\) ON users TO anon, authenticated;/.test(m083));
T.ok('083: REVOKE yok (028 izin listesi korunur)', !/REVOKE/i.test(m083));
T.ok('083: baska kolon acilmiyor', !/\b(bio|google_sub|is_private|publish_|ad_onaylandi_at)\b/.test(m083));

T.bitir();
