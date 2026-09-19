// ==========================================================================
// ARAYUZ — M413: "ilk basista tik gidiyor"
// ==========================================================================
// 1. `utils/isaretlemeBekleme.ts` SAF karari.
// 2. 🔴 ESLESME: karar, `bolumleriIsaretle`'nin `null` dondugu (iyimser
//    guncelleme YAPILAMAYAN) durumlarla BIREBIR ortusmeli. Biri degisip
//    digeri degismezse tik ya yine "gider" ya da dugme gereksiz bekler.
// 3. KAYNAK DENETIMI: `EpisodeCheckButton` karari kullaniyor ve 550 ms
//    zamanlayicisini KOSULSUZ kurmuyor.
//
// Cikti ASCII (tests/yardimci.js kurali).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yardimci from '../yardimci.js';
import { sonucuBeklemeli } from '../../utils/isaretlemeBekleme.ts';
import { bolumleriIsaretle } from '../../services/library/mutations/optimistikIlerleme.ts';

const { baslat } = yardimci;
const T = baslat('ARAYUZ ISARETLEME BEKLEME (M413)', { kokOneki: 'arayuz-isaret-' });
const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const DOLU = {
  aired: 2, completed: 0, next_episode: null, last_episode: null,
  seasons: [{ number: 1, aired: 2, completed: 0, episodes: [
    { number: 1, completed: false, first_aired: '2020-01-01T00:00:00.000Z' },
    { number: 2, completed: false, first_aired: '2020-01-08T00:00:00.000Z' },
  ] }],
};

// ─────────────────────────────────────────────────────────────────────────
T.H('Karar');
T.ok('Kayit yok (undefined/null) -> bekle', sonucuBeklemeli(undefined) && sonucuBeklemeli(null));
T.ok('Bos sezon listesi -> bekle', sonucuBeklemeli({ seasons: [] }) && sonucuBeklemeli({}));
T.ok('Dolu ilerleme -> bekleme (eski 550 ms davranisi)', sonucuBeklemeli(DOLU) === false);

// ─────────────────────────────────────────────────────────────────────────
T.H('Iyimser yama ile birebir eslesme');
const durumlar = [undefined, null, {}, { seasons: [] }, { seasons: null }, DOLU];
const uyusmayan = durumlar.filter((d) => {
  const yamaYok = bolumleriIsaretle(d, 1, [1], '2026-09-19T00:00:00.000Z') === null;
  return yamaYok !== sonucuBeklemeli(d);
});
T.ok('Yama null <=> sonucu bekle (6 durum)', uyusmayan.length === 0, `uyusmayan: ${uyusmayan.length}`);

// ─────────────────────────────────────────────────────────────────────────
T.H('Kaynak denetimi: EpisodeCheckButton');
const kaynak = fs.readFileSync(path.join(KOK, 'components', 'EpisodeCheckButton.tsx'), 'utf8');
T.ok('Karar fonksiyonunu kullaniyor', /sonucuBeklemeli\(useLibraryStore\.getState\(\)\.showProgressMap\[traktId\]\)/.test(kaynak));
T.ok('Karar mutasyondan ONCE okunuyor',
  kaynak.indexOf('sonucuBeklemeli(') < kaynak.indexOf('markEpisodeAsWatched(traktId'));
T.ok('550 ms zamanlayicisi kosullu', /if \(!sonucuBekle\) setTimeout\(serbestBirak, SUCCESS_HOLD_MS\)/.test(kaynak)
  && !/\n\s*setTimeout\(\(\) => \{/.test(kaynak));
T.ok('Basari dalinda bekleyen dugme serbest birakiliyor', /if \(sonucuBekle\) serbestBirak\(\)/.test(kaynak));

T.bitir();
