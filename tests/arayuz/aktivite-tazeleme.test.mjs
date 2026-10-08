import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yardimci from '../yardimci.js';

// M468 · A1: silme/geri alma sonrası açık Profil › Aktiviteler listesi tazelenir.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const T = yardimci.baslat('AKTIVITE LISTESI SILMEDE TAZELENIR (M468 / A1)', { kokOneki: 'aktivite-tazeleme-' });
const src = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const yayin = src('features/feed/services/feedPublish.ts');
const kanca = src('features/feed/hooks/useActivityFeed.ts');
const govde = yayin.slice(yayin.indexOf('export function retractLocalActivity'));
T.ok('retractLocalActivity once onbellegi temizler SONRA surumu artirir',
  govde.indexOf('invalidateUserFeedActivitiesCache()') > 0
  && govde.indexOf('useAktiviteSurumu.getState().artir()') > govde.indexOf('invalidateUserFeedActivitiesCache()'));
T.ok('Ortak kanca surume abone ve ilk degeri atliyor', /useAktiviteSurumu\(\(s\) => s\.surum\)/.test(kanca)
  && /if \(surum === ilkSurumRef\.current\) return;/.test(kanca));
T.ok('Tazeleme sessiz (iskelet gostermez: setIsLoading yok)', /ilkSurumRef\.current = surum;\s*\n\s*run\(false\);/.test(kanca));
const col = src('services/library/mutations/collections.ts');
T.ok('Gecmis silme geri cekmeyi SUNUCU yanitindan sonra yapar (taze veri okunur)',
  col.indexOf('libraryApi.unwatchShow(id) : libraryApi.unwatchMovie(id)') < col.indexOf('retractLocalActivity((a: any) =>'));
const puan = src('services/library/mutations/ratings.ts');
T.ok('Puan kaldirma da ayni yoldan (retractLocalActivity)', /retractLocalActivity\(\(a\) => a\.activityType === 'rated'/.test(puan));
T.bitir();
