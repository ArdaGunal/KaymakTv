import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tsLoader } from '../ts-test-loader.mjs';
import yardimci from '../yardimci.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const T = yardimci.baslat('SURUM KAPISI AGI BEKLEMEZ (M458)', { kokOneki: 'surum-kapisi-' });
const { surumKarari, onbellegiCoz, oturumIciKarar } = tsLoader(root)('features/versionGate/services/surumKarari.ts');
const source = (f) => fs.readFileSync(path.join(root, f), 'utf8');

T.H('Saf karar');
const kayit = (min, url = 'https://ornek/apk') => ({ minRequiredVersion: min, updateUrl: url });
T.ok('Onbellek yok → ok (fail-open)', surumKarari('2.6.0', null).durum === 'ok');
T.ok('Kurulu surum bilinmiyor → ok', surumKarari(null, kayit('9.0.0')).durum === 'ok');
T.ok('Esit surum engellenmez', surumKarari('2.6.0', kayit('2.6.0')).durum === 'ok');
T.ok('Yeni surum engellenmez', surumKarari('2.7.0', kayit('2.6.0')).durum === 'ok');
const k = surumKarari('2.5.9', kayit('2.6.0'));
T.ok('Eski surum anında engellenir + adres tasinir', k.durum === 'blocked' && k.updateUrl === 'https://ornek/apk');
T.ok('Sunucu siniri dusurunce engel kalkar', surumKarari('2.5.9', kayit('2.5.0')).durum === 'ok');

T.H('Oturum ici: sunucu kapiyi yalniz gevsetir (2.6.5 madde 8)');
const ok = { durum: 'ok' }, engel = { durum: 'blocked', updateUrl: 'u' };
T.ok('Kullanan kiside sunucu engeli agaci DEGISTIRMEZ (ok kalir)', oturumIciKarar(ok, engel).durum === 'ok');
T.ok('Soguk acilista onbellek engeli surer', oturumIciKarar(engel, engel).durum === 'blocked');
T.ok('Sunucu siniri dusurunce engel oturum icinde de kalkar', oturumIciKarar(engel, ok).durum === 'ok');

T.H('Onbellek cozumu');
T.ok('Bos/bozuk JSON → null', onbellegiCoz(null) === null && onbellegiCoz('{bozuk') === null);
T.ok('Eksik alan → null', onbellegiCoz('{"updateUrl":"x"}') === null && onbellegiCoz('{"minRequiredVersion":""}') === null);
T.ok('Gecerli kayit', JSON.stringify(onbellegiCoz('{"minRequiredVersion":"2.6.0","updateUrl":"u"}')) === '{"minRequiredVersion":"2.6.0","updateUrl":"u"}');
T.ok('updateUrl yoksa null', onbellegiCoz('{"minRequiredVersion":"2.6.0"}').updateUrl === null);

T.H('Kaynak denetimi');
const hook = source('features/versionGate/hooks/useVersionGate.ts');
T.ok('Kanca agi beklemiyor (zaman asimi yarisi yok)', !hook.includes('Promise.race') && !hook.includes('VERSION_GATE_TIMEOUT_MS'));
// M542: sunucu kontrolü modül düzeyinde TEK KEZ (`sunucuKontrolu`) — sıra kancanın gövdesinde aranır.
const kancaGovdesi = hook.slice(hook.indexOf('export function useVersionGate'));
T.ok('Once onbellek karari, sonra arka plan kontrolu', kancaGovdesi.indexOf('SURUM_ONBELLEK_ANAHTARI)') > -1
  && kancaGovdesi.indexOf('SURUM_ONBELLEK_ANAHTARI)') < kancaGovdesi.indexOf('sunucuKontrolu()'));
T.ok('M542: sunucu kontrolu oturum basina tek (modul duzeyi soz)', /let sunucuKontrolSozu/.test(hook) && /if \(sunucuKontrolSozu\) return sunucuKontrolSozu/.test(hook));
const api = source('features/versionGate/services/appSettingsApi.ts');
T.ok('M542: surum okumasi supabase-js degil, sinirli duz REST (belge zincirini beklemez)', !api.includes('supabaseClient') && /AbortController/.test(api) && /SURUM_ISTEGI_SINIRI_MS = 5000/.test(api));
T.ok('Sunucu sonucu saklaniyor', hook.includes('AsyncStorage.setItem(SURUM_ONBELLEK_ANAHTARI'));
T.ok('Sunucu sonucu oturum ici kuraldan geciyor', hook.includes('uygula(oturumIciKarar(mevcut, surumKarari(kurulu, yeni)))'));
const bant = source('hooks/useSoftUpdate.ts');
T.ok('Zorunlu guncelleme bekliyorsa bant ertelemeden once acilir', bant.indexOf('settings.minRequiredVersion') > -1 && bant.indexOf('settings.minRequiredVersion') < bant.indexOf('SNOOZE_KEY)'));
T.ok('Kapi hala AuthProvider disinda', source('app/_layout.tsx').indexOf('<VersionGate>') < source('app/_layout.tsx').indexOf('<AuthProvider>'));
T.bitir();
