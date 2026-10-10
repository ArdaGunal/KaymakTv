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
T.bitir();
