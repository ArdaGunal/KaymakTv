// ==========================================================================
// İYİMSER İLERLEME — SENARYO TESTİ
// ==========================================================================
// Çalıştır:  node tests/ilerleme/optimistik.test.js
//
// 🔴 NEDEN VAR: "yeşil tik" ve "atlanan bölüm" hataları ÜÇ TUR boyunca
// yanlış yerden düzeltilmeye çalışıldı (M317/M318/M319). Kök sebep her
// seferinde aynıydı: iyimser güncelleme `seasons[].episodes[].completed`
// alanını GÜNCELLEMİYORDU ve o alanı üç ayrı tüketici okuyor.
//
// Bu dosya kullanıcının cihazda bildirdiği senaryoyu BİREBİR kurar:
// "3x3'ü işaretle → 3x4'e geç → 3x5'e bas → 'atlanan bölüm' diyor."
// Sunucu turu HİÇ dönmeden, yalnızca iyimser durumla çalışıyor —
// yarışın kendisini ölçüyor.
//
// ⚠️ `useEpisodeActions.ts`'teki atlama kontrolü BURAYA KOPYALANDI
// (`atlananlar`). Orası değişirse burası da değişmeli; kopyanın amacı
// testi UI'dan bağımsız tutmak.
const { execFileSync } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

// TS kaynağı geçici bir dizine derlenir — istemcide vitest yok, `tests/imza`
// ile aynı "düz node" geleneği sürdürülüyor.
const KOK = path.resolve(__dirname, '..', '..');
const CIKTI = fs.mkdtempSync(path.join(os.tmpdir(), 'kaymak-ilerleme-'));
// 🔴 `npx` DEĞİL: Windows'ta `.cmd` dosyasını doğrudan spawn etmek
// `EINVAL` veriyor (shell gerekir). `tsc`'yi node ile çağırmak hem
// platformdan bağımsız hem de kabuk açmıyor.
const TSC = path.join(KOK, 'node_modules', 'typescript', 'bin', 'tsc');
execFileSync(
  process.execPath,
  [TSC, path.join('services', 'library', 'mutations', 'optimistikIlerleme.ts'),
   '--outDir', CIKTI, '--module', 'commonjs', '--target', 'es2020', '--skipLibCheck'],
  { cwd: KOK, stdio: 'inherit' }
);

const { bolumleriIsaretle, bolumleriGeriAl, sezonuIsaretle } =
  require(path.join(CIKTI, 'optimistikIlerleme.js'));

const GECMIS = '2020-01-01T00:00:00Z';
const bolum = (n, izlendi = false) => ({
  number: n, completed: izlendi, last_watched_at: izlendi ? GECMIS : null,
  title: `E${n}`, first_aired: GECMIS,
});

// 3. sezon, 10 bölüm; E1 ve E2 izlenmiş (kullanıcı S3E3'ten devam ediyor).
const baslangic = {
  seasons: [{ number: 3, aired: 10, completed: 2,
    episodes: [bolum(1, true), bolum(2, true), ...[3,4,5,6,7,8,9,10].map((n) => bolum(n))] }],
  aired: 10, completed: 2,
  next_episode: { season: 3, number: 3, title: 'E3' },
  last_episode: { season: 3, number: 2, title: 'E2' },
};

// ── `useEpisodeActions.ts:103`'ün ATLANAN BÖLÜM kontrolünün birebir kopyası
const atlananlar = (ilerleme, sNum, eNum) => {
  const atlanan = [];
  const sezon = ilerleme?.seasons?.find((s) => s.number === sNum);
  for (let i = 1; i < eNum; i++) {
    const ep = sezon?.episodes?.find((e) => e.number === i);
    if (!ep || !ep.completed) atlanan.push(i);
  }
  return atlanan;
};

let gecti = 0, kaldi = 0;
const bekle = (ad, gercek, beklenen) => {
  const ok = JSON.stringify(gercek) === JSON.stringify(beklenen);
  console.log(`  ${ok ? '✅' : '⛔'} ${ad}` + (ok ? '' : `\n       beklenen ${JSON.stringify(beklenen)} | gelen ${JSON.stringify(gercek)}`));
  ok ? gecti++ : kaldi++;
};

console.log('\n═══ SENARYO: arka arkaya hızlı işaretleme (sunucu turu DÖNMEDEN) ═══');
let p = baslangic;

// 1) S3E3 işaretle
p = bolumleriIsaretle(p, 3, [3], '2026-09-08T10:00:00Z');
bekle('S3E3 sonrası: sıradaki E4', p.next_episode, { season: 3, number: 4, title: 'E4' });
bekle('S3E3 sonrası: completed=3', p.completed, 3);
bekle('S3E3 sonrası: E3 tikli', p.seasons[0].episodes[2].completed, true);

// 2) SUNUCU TURU DÖNMEDEN S3E4'e bas
bekle('🔴 S3E4 basılırken atlanan YOK', atlananlar(p, 3, 4), []);
p = bolumleriIsaretle(p, 3, [4], '2026-09-08T10:00:01Z');
bekle('S3E4 sonrası: sıradaki E5', p.next_episode, { season: 3, number: 5, title: 'E5' });

// 3) SUNUCU TURU DÖNMEDEN S3E5'e bas — HATANIN GÖRÜLDÜĞÜ AN
bekle('🔴 S3E5 basılırken atlanan YOK (hatanın kendisi)', atlananlar(p, 3, 5), []);
p = bolumleriIsaretle(p, 3, [5], '2026-09-08T10:00:02Z');
bekle('S3E5 sonrası: completed=5', p.completed, 5);

console.log('\n═══ GERÇEK ATLAMA HÂLÂ YAKALANMALI ═══');
// E1,E2 izlenmiş; kullanıcı doğrudan E5'e basıyor → E3,E4 gerçekten atlanmış.
bekle('E5 basılınca atlanan = [3,4]', atlananlar(baslangic, 3, 5), [3, 4]);

console.log('\n═══ DİĞER DAVRANIŞLAR ═══');
const geri = bolumleriGeriAl(p, 3, [5]);
bekle('geri alınca sıradaki tekrar E5', geri.next_episode, { season: 3, number: 5, title: 'E5' });
bekle('geri alınca completed=4', geri.completed, 4);

const sezon = sezonuIsaretle(baslangic, 3, '2026-09-08T10:00:00Z');
bekle('sezonu işaretle: completed=aired', sezon.completed, sezon.aired);
bekle('sezonu işaretle: sıradaki YOK', sezon.next_episode, null);

// Aynı bölüme İKİ KEZ basmak sayacı şişirmemeli.
const iki = bolumleriIsaretle(bolumleriIsaretle(baslangic, 3, [3], GECMIS), 3, [3], GECMIS);
bekle('aynı bölüme iki kez: completed=3 (şişmiyor)', iki.completed, 3);

// Elde ilerleme yoksa null dönmeli (sunucu turu beklenir).
bekle('ilerleme yoksa null', bolumleriIsaretle(null, 3, [1], GECMIS), null);
bekle('boş sezon dizisinde null', bolumleriIsaretle({ seasons: [] }, 3, [1], GECMIS), null);

console.log(`\n${kaldi ? '⛔ ' + kaldi + ' KALDI' : '🎉 TÜMÜ GEÇTİ'} — geçen ${gecti}, kalan ${kaldi}`);
process.exit(kaldi ? 1 : 0);
