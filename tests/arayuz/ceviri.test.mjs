import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import yardimci from '../yardimci.js';

// DIL-01 / DIL-03 · Sistem metinleri iki dilde. Kullanıcının YAZDIĞI metin kapsam dışı
// (kullanıcı kararı 2026-10-10: «ben Türkçe yorum yapıyorsam İngilizce uygulamada
// mecburen Türkçe görünecek… sistem tarafını düzelt»).
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const T = yardimci.baslat('CEVIRI DENETIMI (DIL-01/03)', { kokOneki: 'ceviri-' });
const { denetle } = require(path.join(root, 'scripts/ceviri-denetim.js'));

const { eksik } = denetle();
for (const e of eksik.slice(0, 15)) T.ok(`${e.dosya}:${e.satir} ${e.ns}:${e.anahtar} (${e.diller.join(',')})`, false);
T.ok(`Koddaki her t('...') anahtari TR ve EN dosyalarinda var (${eksik.length} eksik)`, eksik.length === 0);

const tekil = (k) => k.replace(/_(one|other|zero|two|few|many)$/, '');
for (const f of fs.readdirSync(path.join(root, 'locales/tr'))) {
  const tr = new Set(Object.keys(JSON.parse(fs.readFileSync(path.join(root, 'locales/tr', f), 'utf8'))).map(tekil));
  const en = new Set(Object.keys(JSON.parse(fs.readFileSync(path.join(root, 'locales/en', f), 'utf8'))).map(tekil));
  const yalnizTr = [...tr].filter((k) => !en.has(k));
  const yalnizEn = [...en].filter((k) => !tr.has(k));
  T.ok(`${f}: TR/EN anahtar esitligi${yalnizTr.length || yalnizEn.length ? ` — yalniz TR: ${yalnizTr.slice(0, 5)} yalniz EN: ${yalnizEn.slice(0, 5)}` : ''}`, !yalnizTr.length && !yalnizEn.length);
}

// Bu turda bulunan çıplak JSX metinleri geri gelmesin.
const oku = (f) => fs.readFileSync(path.join(root, f), 'utf8');
T.ok('Herkese acik profil sekmeleri ceviride (mobil + web)', ['screens/PublicProfileMobile.tsx', 'app/(protected)/user/[slug].web.tsx'].every((f) => !/>(Aktiviteler|Diziler|Filmler)</.test(oku(f))));
T.ok('Oyuncular / bolum hatasi / izlendi ipucu ceviride', !/>Oyuncular</.test(oku('components/MediaCast.tsx')) && !/>Bu bölüm yüklenemedi\.</.test(oku('components/SectionErrorBoundary.tsx')) && !/İzlendi` }/.test(oku('components/ProgressBar.tsx')));
T.ok('Bolum karti yuzde metni ceviride (C7 yayin turunda bulundu)', !/% izlendi\s*$/m.test(oku('components/EpisodeCardMobile.tsx')));

// ── M490 · Ham (t() dışı) metin denetimi — scripts/ceviri-ham-metin.js ──
// Kullanıcı: «ilerde de benzer problem çıkmasın.» Sabit Türkçe hata metni, servis/Worker
// `message`'ının ekrana sızması ve diyaloglara çıplak dize verilmesi kalıcı olarak yasak.
const { hamMetinleriBul, dosyaTara } = require(path.join(root, 'scripts/ceviri-ham-metin.js'));
const ham = hamMetinleriBul();
for (const b of ham.slice(0, 15)) T.ok(`${b.dosya}:${b.satir} [${b.kural}] ${b.metin}`, false);
T.ok(`Projede ceviri disi ham metin yok (${ham.length} bulgu) — istisna icin satira // ceviri-ok: <sebep>`, ham.length === 0);

// Öz-test: kurallar gerçekten yakalıyor mu? (denetim sessizce körleşmesin)
const tara = (rel, kod) => dosyaTara(rel, kod).map((b) => b.kural[0]).join('');
T.ok('(a) notify\'a ciplak dize yakalanir (servis katmaninda da)', tara('services/x.ts', "notify(i18n.t('common:error'), 'Depolama dolu');") === 'a');
T.ok('(a) Turkce harfsiz ciplak dize de yakalanir', tara('services/x.ts', "notify('Hata', 'Something failed');") === 'a');
T.ok('(a) durum KODU metin sayilmaz', tara('hooks/x.ts', "setError('not_found');") === '');
T.ok('(b) ham error.message ekrana yakalanir', tara('components/x.tsx', "setHata(error?.message || t('k', 'y'));").includes('b'));
T.ok('(b) sunucu data.message yakalanir', tara('hooks/x.ts', 'setSaveError((error as any)?.response?.data?.message);').includes('b'));
T.ok('(b) gunluk satiri ekrana sayilmaz', tara('components/x.tsx', "console.warn('x', error?.message);") === '');
T.ok('(c) t() disi Turkce dize yakalanir', tara('components/x.tsx', "const a = 'Puan kaydedilirken bir hata oluştu.';") === 'c');
T.ok('(c) cok satirli JSX metni yakalanir', tara('components/x.tsx', '<Text>\n  Sürüm notları\n</Text>') === 'c');
T.ok('(c) t() yedegi (cok satirli) serbest', tara('components/x.tsx', "t(\n  'k',\n  'Türkçe yedek'\n)") === '');
T.ok('(c) yorum serbest', tara('components/x.tsx', '// Türkçe yorum\n/* çok satırlı\n yorum */') === '');
T.ok('// ceviri-ok istisnasi calisir', tara('components/x.tsx', "const d = 'Türkçe'; // ceviri-ok: dil adi") === '');
T.ok('Servis katmaninda ic hata metni serbest (kullaniciya t() gider)', tara('services/x.ts', "throw new Error('İşlem başarısız.');") === '');

// Değişken anahtarlı tablolar (yedeksiz) — anahtarlar iki dilde var olmalı
const sozluk = (d, ns) => JSON.parse(fs.readFileSync(path.join(root, `locales/${d}/${ns}.json`), 'utf8'));
const varMi = (o, k) => k.split('.').reduce((x, p) => (x && typeof x === 'object' ? x[p] : undefined), o) !== undefined;
const tablo = [
  ['feed', 'features/feed/components/FeedFilterChips.tsx', /:\s*'(filter\w+)'/g],
  ['feed', 'features/feed/components/ReportContentModal.tsx', /labelKey: 'feed:(\w+)'/g],
  ['notifications', 'features/notifications/components/NotificationTimeline.tsx', /:\s*'(timeline\.\w+)'/g],
];
for (const [ns, dosya, desen] of tablo) {
  const anahtarlar = [...oku(dosya).matchAll(desen)].map((m) => m[1]);
  const eksikler = anahtarlar.filter((k) => !['tr', 'en'].every((d) => varMi(sozluk(d, ns), k)));
  T.ok(`${dosya}: tablo anahtarlari TR+EN (${anahtarlar.length} anahtar, eksik: ${eksikler.join(',') || 'yok'})`, anahtarlar.length > 0 && eksikler.length === 0);
}
T.bitir();
