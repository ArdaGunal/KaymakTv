// ==========================================================================
// ADAPTÖR KAPSAM DENETİMİ — "hangi yazma yolu Trakt'a kaçıyor?"
// ==========================================================================
// Çalıştır:  node tests/ilerleme/adaptor-kapsam.test.js
//
// 🔴 NEDEN VAR — GERÇEK BİR HATANIN ÜRÜNÜ (2026-09-09):
// Faz T'de "yazma yollarını adapte ettim" denildi ama `progress.ts` ve
// `collections.ts` adapte edilip **`ratings.ts` GÖZDEN KAÇTI**. Kaymak
// kullanıcısı puan veremedi; hata ancak cihazda görüldü.
//
// Üstelik hata bir DEĞİL ÜÇ yerdeydi: `ratings.ts`'in kendisi + İKİ hook
// (`useEpisodeActions`, `useShowDetailHandlers`) ham `traktApi`'yi DOĞRUDAN
// çağırıyordu — mutasyon katmanını hiç kullanmadan.
//
// Bu denetim aynı sınıf kaçağı yapısal olarak yakalar:
//   1. `services/library/mutations/` altındaki HER dosya adaptöre bağlı mı?
//   2. Hook/bileşen katmanı ham `traktApi` yazma fonksiyonu çağırıyor mu?
const fs = require('node:fs');
const path = require('node:path');

const KOK = path.resolve(__dirname, '..', '..');
const NL = String.fromCharCode(10);
// /user/${...slug...} bicimini yakalar
const SLUG_ROTA = new RegExp('/user/\$\{[^}]*[Ss]lug');

// 🔴 YORUMLARI AYIKLA — DENETIMIN KENDI HATASININ URUNU (2026-09-10).
// Bolum 5 ilk yazildiginda IKI YANLIS ALARM verdi: useFollowState.ts ve
// followStore.ts "eskiden followTraktUser cagriliyordu" diye ACIKLIYOR ve
// ham metin taramasi o aciklamalari GERCEK CAGRI sandi.
// 🎓 Ders: bir yasak ismi metinde arayan denetim, o ismi ANLATAN
// dokumantasyonu da yakalar — kod ile yorumu ayirmadan tarama yapilamaz.
const koduAyikla = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
let gecti = 0, kaldi = 0;
const bekle = (ad, kosul, ipucu = '') => {
  console.log(`  ${kosul ? '✅' : '⛔'} ${ad}${kosul ? '' : '  → ' + ipucu}`);
  kosul ? gecti++ : kaldi++;
};

// ── 1) Mutasyon dosyalarının tamamı adaptöre bağlı mı? ───────────────────
const MUT = path.join(KOK, 'services', 'library', 'mutations');
const mutDosyalar = fs.readdirSync(MUT).filter((f) => f.endsWith('.ts'));

// Adaptör kararı GEREKTİRMEYEN dosyalar — ağa hiç çıkmıyorlar.
const MUAF = new Set([
  'optimistikIlerleme.ts', // saf hesap, ağ yok
  'invalidation.ts',       // önbellek geçersizleme, ağ yok
]);

console.log('\n═══ Mutasyon dosyaları adaptöre bağlı mı? ═══');
for (const dosya of mutDosyalar) {
  if (MUAF.has(dosya)) continue;
  const src = fs.readFileSync(path.join(MUT, dosya), 'utf8');
  const traktCagiriyor = /from '\.\.\/\.\.\/traktApi'/.test(src);
  if (!traktCagiriyor) continue; // Trakt'a hiç gitmiyorsa adaptör gerekmez

  bekle(
    `${dosya}: token tipine bakıyor`,
    /kaymakKullanicisiMi\(\)/.test(src),
    'Trakt çağırıyor ama Kaymak kullanıcısını AYIRT ETMİYOR → 401',
  );
}

// ── 2) UI katmanı ham `traktApi` YAZMA fonksiyonu çağırıyor mu? ──────────
// Yazma fiilleri: bunlar kullanıcı verisini değiştirir ve adaptörden
// GEÇMEK ZORUNDA. Okuma fonksiyonları (getX) kapsam dışı.
const YASAK = [
  'addRating', 'removeRating',
  'addEpisodeToHistory', 'addSeasonToHistory', 'addMovieToHistory',
  'removeEpisodeFromHistoryTrakt', 'removeSeasonFromHistoryTrakt', 'removeFromHistoryTrakt',
  'addToWatchlistTrakt', 'removeFromWatchlistTrakt',
  'hideItemTrakt', 'unhideItemTrakt', 'toggleLikedMedia',
];

const tara = (dizin, cikti = []) => {
  for (const ad of fs.readdirSync(dizin)) {
    if (ad === 'node_modules' || ad === '.expo') continue;
    const tam = path.join(dizin, ad);
    if (fs.statSync(tam).isDirectory()) tara(tam, cikti);
    else if (/\.tsx?$/.test(ad)) cikti.push(tam);
  }
  return cikti;
};

const uiDosyalar = [
  ...tara(path.join(KOK, 'hooks')),
  ...tara(path.join(KOK, 'components')),
  ...tara(path.join(KOK, 'app')),
  ...tara(path.join(KOK, 'screens')),
];

console.log('\n═══ UI katmanında ham Trakt YAZMA çağrısı var mı? ═══');
const kacaklar = [];
for (const tam of uiDosyalar) {
  const src = fs.readFileSync(tam, 'utf8');
  if (!/from '.*services\/traktApi'/.test(src)) continue;
  for (const fn of YASAK) {
    // Yalnızca GERÇEK çağrı: `await fn(` ya da `fn(` — yorum satırı değil.
    const re = new RegExp('^(?!\\s*(//|\\*)).*\\b' + fn + '\\s*\\(', 'm');
    if (re.test(src)) {
      kacaklar.push(`${path.relative(KOK, tam).replace(/\\/g, '/')} → ${fn}()`);
    }
  }
}
bekle(
  'hiçbir ekran/hook ham Trakt yazma fonksiyonu çağırmıyor',
  kacaklar.length === 0,
  'adaptörü ATLIYOR:\n       ' + kacaklar.join('\n       '),
);

// ── 3) Bilinen adaptör giriş noktaları duruyor mu? ───────────────────────
console.log('\n═══ Adaptör giriş noktaları ═══');
const ratings = fs.readFileSync(path.join(MUT, 'ratings.ts'), 'utf8');
for (const fn of ['rateMedia', 'unrateMedia', 'rateEpisodeMedia', 'unrateEpisodeMedia']) {
  bekle(`ratings.ts: ${fn} var`, new RegExp('export const ' + fn + '\\b').test(ratings));
}

// ── 4) Gölge yazım (dual write) — puanlar, 2026-09-09 ────────────────────
// 🔴 KURAL: Trakt'lı kullanıcının puanı HEM Trakt'a HEM bize gider, ama
// gölge yazma ANA yazmayı ASLA bozamaz. Kullanıcının eylemi Trakt'ta
// başarılıysa başarılıdır; bizim kopyamız `katalogda_yok` (409) yüzünden
// düşebilir ve bu BEKLENEN bir durumdur.
console.log('\n═══ Gölge yazım (puanlar) ═══');
bekle('golgeYaz yardımcısı var', ratings.includes('const golgeYaz = async'));
bekle(
  'gölge hata YUTUYOR ama iz bırakıyor',
  ratings.includes('logError(`mutations.ratings.golge.'),
  'gölge throw ederse kullanıcının Trakt puanı geri alınır — ana yazma bozulur',
);
bekle(
  'dizi/film puanı gölgeleniyor',
  ratings.includes('golgeYaz(`rate.${type}`'),
);
bekle(
  '🔴 SİLME de gölgeleniyor (dizi/film + bölüm)',
  ratings.includes('golgeYaz(`unrate.${type}`') && ratings.includes("golgeYaz('unrate.episode'"),
  'yalnızca yazma gölgelenirse kaldırılan puan bizde KALIR ve T5 içe aktarımında dirilir',
);
bekle(
  'bölüm puanı gölgeleniyor',
  ratings.includes("golgeYaz('rate.episode'"),
);
bekle(
  '⚠️ İZLEME geçmişi gölgelenMİYOR (istisna yalnızca puanlar)',
  !fs.readFileSync(path.join(MUT, 'progress.ts'), 'utf8').includes('golgeYaz'),
  'kullanıcı istisnayı açıkça puanlarla sınırladı — devir §4.7 duruyor',
);

// ── 5) SOSYAL GRAF — denetimin ESKİ KÖR NOKTASI (2026-09-10, M337) ───────
// 🔴 BU BÖLÜM BİR HATANIN ÜRÜNÜ, TIPKI DOSYANIN GERİ KALANI GİBİ.
// Bu denetim 14/14 YEŞİL yanarken hooks/useFollowState.ts'in Google-only
// kullanıcıda 401 verdiğini KAÇIRDI: taraması yalnızca
// services/library/mutations/ + services/traktApi idi; social.ts'e ve takip
// yollarına HİÇ bakmıyordu.
// 🎓 DERS: bir denetimin kapsamı, koruduğu sanılan alandan DAR olabilir —
// ve yeşil ışık yanlış güven verir.
console.log(NL + 'ozet: Sosyal graf bizim uclarimizda mi?');

const followState = koduAyikla(fs.readFileSync(path.join(KOK, 'hooks', 'useFollowState.ts'), 'utf8'));
bekle(
  'useFollowState Trakt takip API-sini CAGIRMIYOR',
  !/followTraktUser|unfollowTraktUser/.test(followState),
  'Kaymak oturum tokeni Trakta gidince 401 doner (FAZ_T3_TASLAK 1.1)',
);
bekle('useFollowState bizim uclari kullaniyor', /followKaymakUser|unfollowKaymakUser/.test(followState));

const store = koduAyikla(fs.readFileSync(path.join(KOK, 'store', 'followStore.ts'), 'utf8'));
bekle(
  'followStore Trakt takip listesini CEKMIYOR',
  !/getMyFollowingSlugs/.test(store),
  'graf artik bizde (karar 5.1) - Trakt listesi ikinci bir gercek kaynagi olurdu',
);
bekle(
  'followStore disk anahtari v2',
  /kaymak-follow-storage-v2/.test(store),
  'eski kayit SLUG anahtarliydi; ayni anahtarla okunursa herkes takip ediliyor gorunur',
);

// EVRENSEL KAYMAK KIMLIGI: profil adresi username, trakt_slug DEGIL.
const ROTALAR = [
  ['features', 'feed', 'components', 'FeedCard.tsx'],
  ['features', 'feed', 'components', 'MarathonFeedCard.tsx'],
  ['components', 'reviews', 'ReviewItem.tsx'],
  ['features', 'feed', 'components', 'UserSearchResults.tsx'],
];
for (const parcalar of ROTALAR) {
  const yol = path.join(KOK, ...parcalar);
  if (!fs.existsSync(yol)) continue;
  const src = koduAyikla(fs.readFileSync(yol, 'utf8'));
  bekle(
    parcalar[parcalar.length - 1] + ': /user/ rotasi slug ile kurulMUYOR',
    !SLUG_ROTA.test(src),
    'Google-only kullanicinin slugi YOK - kirik rota (FAZ_T3_TASLAK 1.2)',
  );
}

// ── 6) PROFİL: Trakt okumaları ROTA PARAMETRESİYLE yapılmıyor (M338) ──────
// 🔴 BİR REGRESYONUN ÜRÜNÜ: M337'de profil rotası KaymakTV `username`'ine geçti
// ama iki profil ekranı Trakt okumalarını hâlâ rota parametresiyle (`slug`)
// yapıyordu. Ölçüldü: `ArdaGnl`≠`ardagnl`, `esrakilinc515_45f919`≠
// `esrakilinc515-45f919` → 6 gerçek kullanıcının 5'inde aktivite BOŞ gelirdi;
// Trakt'ta aynı adlı BAŞKA biri varsa onun verisi gösterilirdi. tsc bunu
// YAKALAMADI (her iki değer de `string | null`), 22 denetimin hiçbiri de.
console.log(NL + 'ozet: Profil ekranlari Trakt-i gercek slug ile mi okuyor?');
const PROFIL_EKRANLARI = [
  ['screens', 'PublicProfileMobile.tsx'],
  ['app', '(protected)', 'user', '[slug].web.tsx'],
];
for (const parcalar of PROFIL_EKRANLARI) {
  const src = koduAyikla(fs.readFileSync(path.join(KOK, ...parcalar), 'utf8'));
  const ad = parcalar[parcalar.length - 1];
  bekle(
    ad + ': usePublicProfile* rota parametresiyle cagrilmiyor',
    !/usePublicProfile(Activity|Library)?\(slug\)/.test(src),
    'rota KaymakTV adi tasiyor - Trakt okumalari traktSlug ile yapilmali (M338)',
  );
  bekle(ad + ': kimlik usePublicProfileIdentity ile cozuluyor', /usePublicProfileIdentity\(/.test(src));
}

// ⚠️ JSX ölçütleri `<Bileşen` ile başlıyor: `Bileşen[^>]*` import satırından
// başlayıp satırlar boyunca ilk `>`'a kadar kayıyor ve arada geçen alakasız
// bir `traktSlug`'ı yakalıyordu — ilk koşuda web profilinde YANLIŞ ALARM (M339).
// ── 7) KİMLİK: "benim mi" · engelleme · profil aktivitesi `users.id` ile (M339) ──
// 🔴 Google-only kullanıcının Trakt slug'ı YOK. Bu üç yol slug'la sorulduğunda
// o kullanıcı: kendi kartında "Engelle" görüyordu · kimseyi engelleyemiyordu
// (T3 çıkış ölçütü sınanamıyordu) · kendi aktivite sekmesini göremiyordu.
// ⚠️ `components/comments/CommentItem.tsx` BİLİNÇLİ OLARAK listede YOK: Trakt'ın
// kendi yorumu, tek kimlik slug.
console.log(NL + 'ozet: Kimlik users.id ile mi (benim mi / engelleme / aktivite)?');
const KIMLIK_DENETIMI = [
  [['features', 'feed', 'components', 'FeedCard.tsx'], 'isOwn', 'engel'],
  [['features', 'feed', 'components', 'MarathonFeedCard.tsx'], 'isOwn', 'engel'],
  [['features', 'feed', 'components', 'FeedCommentItem.tsx'], 'engel'],
  [['components', 'reviews', 'ReviewItem.tsx'], 'engel'],
  [['screens', 'PublicProfileMobile.tsx'], 'profilEngel'],
  [['app', '(protected)', 'user', '[slug].web.tsx'], 'profilEngel'],
  [['screens', 'ProfileMobile.tsx'], 'aktiviteSekmesi'],
  [['app', '(protected)', '(tabs)', 'profile.web.tsx'], 'aktiviteSekmesi'],
];
for (const [parcalar, ...kurallar] of KIMLIK_DENETIMI) {
  const src = koduAyikla(fs.readFileSync(path.join(KOK, ...parcalar), 'utf8'));
  const ad = parcalar[parcalar.length - 1];
  for (const kural of kurallar) {
    if (kural === 'isOwn') {
      bekle(ad + ': isOwnActivity slug ile hesaplanmiyor', !/isOwnActivity\s*=[^;]*traktSlug/.test(src),
        'Google-only kullanici kendi kartinda Engelle gorur (M339)');
    } else if (kural === 'engel') {
      bekle(ad + ': hizli engelleme slug gondermiyor', !/blockUserQuick\([^)]*traktSlug/.test(src),
        'bizim kullanicimizin icerigi userId ile engellenmeli (M339)');
    } else if (kural === 'profilEngel') {
      bekle(ad + ': engelleme durumu slug ile okunmuyor', !/useBlockState\([^)]*[Ss]lug/.test(src),
        'Google-only kimseyi engelleyemez (T3 cikis olcutu, M339)');
      bekle(ad + ': engelleme dugmesi slug almiyor', !/<BlockUserButton[^>]*traktSlug/.test(src));
      bekle(ad + ': aktivite slug ile okunmuyor', !/usePublicProfileActivity\([^)]*[Ss]lug/.test(src));
    } else if (kural === 'aktiviteSekmesi') {
      bekle(ad + ': kendi aktivite sekmesine slug verilmiyor', !/<ProfileActivityTab[^>]*traktSlug/.test(src),
        'Google-only kullanicida bos string - sekme yuklenmez (M339)');
    }
  }
}

console.log(`\n${kaldi ? '⛔ ' + kaldi + ' KALDI' : '🎉 TÜMÜ GEÇTİ'} — geçen ${gecti}, kalan ${kaldi}`);
process.exit(kaldi ? 1 : 0);
