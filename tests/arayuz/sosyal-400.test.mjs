import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tsLoader } from '../ts-test-loader.mjs';
import yardimci from '../yardimci.js';

// C25 (M541) — eskiden HER 400 «Aramak için en az 2 karakter yaz» oluyordu (eksik token, geçersiz kimlik
// gibi başka sebepli 400'ler de). Artık yalnız Worker `code: "cok_kisa"` dediğinde.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const T = yardimci.baslat('SOSYAL 400 SINIFLANDIRMA (C25 · M541)', { kokOneki: 'sosyal400-' });

let yanit;
const load = tsLoader(root, {
  axios: { default: { post: async () => { throw Object.assign(new Error('Request failed with status code 400'), { response: { status: 400, data: yanit } }); } } },
  '../../utils/secureStorage': { getItemAsync: async () => 'tok' },
});
const S = load('services/api/kaymakSocial.ts');
const tur = async (fn) => { try { await fn(); return 'yok'; } catch (e) { return e.tur; } };

T.H('Saf karar');
T.ok('code:cok_kisa → cok kisa', S.aramaCokKisaMi({ code: 'cok_kisa' }));
T.ok('Eski Worker mesaji («en az 2 karakter») → cok kisa', S.aramaCokKisaMi({ message: 'Arama için en az 2 karakter gerekiyor.' }));
T.ok('🔴 «traktAccessToken zorunlu.» → cok kisa DEGIL', !S.aramaCokKisaMi({ message: 'traktAccessToken zorunlu.' }));
T.ok('🔴 «targetUserId geçersiz.» → cok kisa DEGIL', !S.aramaCokKisaMi({ message: 'targetUserId geçersiz.' }));

T.H('Gercek istek yolu');
yanit = { success: false, code: 'cok_kisa', message: 'Arama için en az 2 karakter gerekiyor.' };
T.ok('Arama kisa terim → cok_kisa', (await tur(() => S.searchKaymakUsers('a'))) === 'cok_kisa');
yanit = { success: false, message: 'targetUserId geçersiz.' };
T.ok('🔴 Takip 400 → genel (eskiden cok_kisa)', (await tur(() => S.followKaymakUser('x'))) === 'genel');
yanit = { success: false, message: 'traktAccessToken zorunlu.' };
T.ok('🔴 Arama token yok 400 → genel', (await tur(() => S.searchKaymakUsers('arda'))) === 'genel');
T.bitir();
