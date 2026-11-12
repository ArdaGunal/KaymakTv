import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tsLoader } from '../ts-test-loader.mjs';
import yardimci from '../yardimci.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const T = yardimci.baslat('SURUM KAPISI: AGI BEKLEMEZ (M458) + YAPI NUMARASI (YAYIN Adim 1)', { kokOneki: 'surum-kapisi-' });
const yukle = tsLoader(root);
const { surumKarari, onbellegiCoz, oturumIciKarar, kuruluYapiNumarasi, SURUM_ONBELLEK_ANAHTARI, ESKI_SURUM_ONBELLEK_ANAHTARI } =
  yukle('features/versionGate/services/surumKarari.ts');
const { ayarlariCoz, yapiNumarasi } = yukle('features/versionGate/services/appSettingsApi.ts');
const { guncellemeAdresi, DAGITIM } = yukle('features/versionGate/services/dagitim.ts');
const { bantGosterilsinMi } = yukle('features/versionGate/services/bantKarari.ts');
const { STORE_URL, PLAY_STORE_URL } = yukle('utils/constants.ts');
const source = (f) => fs.readFileSync(path.join(root, f), 'utf8');

T.H('Saf karar: yapi numarasi (versionCode)');
const kayit = (min, url = 'https://ornek/apk') => ({ minRequiredBuild: min, updateUrl: url });
T.ok('Onbellek yok → ok (fail-open)', surumKarari(12, null).durum === 'ok');
T.ok('Kurulu yapi bilinmiyor → ok', surumKarari(null, kayit(99)).durum === 'ok');
T.ok('Sinir yok (null) → ok, eski engel de kalkar', surumKarari(12, kayit(null)).durum === 'ok');
T.ok('Esit yapi engellenmez', surumKarari(12, kayit(12)).durum === 'ok');
T.ok('Yeni yapi engellenmez (1.0.0 + vc 13, sinir 12)', surumKarari(13, kayit(12)).durum === 'ok');
const k = surumKarari(12, kayit(13));
T.ok('Eski yapi aninda engellenir + adres tasinir', k.durum === 'blocked' && k.updateUrl === 'https://ornek/apk');
T.ok('Kurulu yapi metinden sayiya: "13" → 13', kuruluYapiNumarasi('13') === 13);
T.ok('Bozuk / bos / sifir kurulu yapi → null', kuruluYapiNumarasi('') === null && kuruluYapiNumarasi(null) === null
  && kuruluYapiNumarasi('abc') === null && kuruluYapiNumarasi('0') === null && kuruluYapiNumarasi('1.5') === null);

T.H('Oturum ici: sunucu kapiyi yalniz gevsetir (2.6.5 madde 8)');
const ok = { durum: 'ok' }, engel = { durum: 'blocked', updateUrl: 'u' };
T.ok('Kullanan kiside sunucu engeli agaci DEGISTIRMEZ (ok kalir)', oturumIciKarar(ok, engel).durum === 'ok');
T.ok('Soguk acilista onbellek engeli surer', oturumIciKarar(engel, engel).durum === 'blocked');
T.ok('Sunucu siniri dusurunce engel oturum icinde de kalkar', oturumIciKarar(engel, ok).durum === 'ok');

T.H('Onbellek cozumu (v2)');
T.ok('Anahtar v2, eskisi v1', SURUM_ONBELLEK_ANAHTARI === '@kaymak_surum_kapisi_v2' && ESKI_SURUM_ONBELLEK_ANAHTARI === '@kaymak_surum_kapisi_v1');
T.ok('Bos/bozuk JSON → null', onbellegiCoz(null) === null && onbellegiCoz('{bozuk') === null);
T.ok('v1 bicimi (surum ADI) OKUNMAZ → null, 1.0.0 kilitlenmez', onbellegiCoz('{"minRequiredVersion":"2.6.8","updateUrl":"u"}') === null);
T.ok('Sinir null/0/metin → null', onbellegiCoz('{"minRequiredBuild":null}') === null && onbellegiCoz('{"minRequiredBuild":0}') === null
  && onbellegiCoz('{"minRequiredBuild":"x"}') === null);
T.ok('Gecerli kayit', JSON.stringify(onbellegiCoz('{"minRequiredBuild":13,"updateUrl":"u"}')) === '{"minRequiredBuild":13,"updateUrl":"u"}');
T.ok('updateUrl yoksa null', onbellegiCoz('{"minRequiredBuild":13}').updateUrl === null);

T.H('Sunucu satiri (076 kolonlari)');
const canli = { id: 1, min_required_version: '2.6.8', latest_version: '2.6.8', update_url: 'https://kaymaktv.com/download',
  min_required_build: null, latest_build: null, store_update_url: null };
const c = ayarlariCoz(canli);
T.ok('Bugunku canli satir: yapi sinirlari null, adres korunur', c.minRequiredBuild === null && c.latestBuild === null
  && c.updateUrl === 'https://kaymaktv.com/download' && c.storeUpdateUrl === null);
T.ok('Surum ADI alanlari istemciye hic tasinmaz', !('minRequiredVersion' in c) && !('latestVersion' in c));
const d = ayarlariCoz({ ...canli, min_required_build: 13, latest_build: '14', store_update_url: 'https://play/x' });
T.ok('Dolu satir: sayi ve metin sayiya cevrilir', d.minRequiredBuild === 13 && d.latestBuild === 14 && d.storeUpdateUrl === 'https://play/x');
T.ok('076 oncesi satir (kolonlar yok) → sinir yok, cokmez', ayarlariCoz({ min_required_version: '2.6.8', update_url: 'u' }).minRequiredBuild === null);
T.ok('Satir yok → null', ayarlariCoz(null) === null && ayarlariCoz(undefined) === null);
T.ok('yapiNumarasi: negatif/kesirli → null', yapiNumarasi(-1) === null && yapiNumarasi(2.5) === null && yapiNumarasi(7) === 7);

T.H('Dagitim kanali ve guncelleme adresi');
const ayar = { updateUrl: 'https://kaymaktv.com/download', storeUpdateUrl: 'https://play/x' };
T.ok('Varsayilan kanal apk (bayrak yok)', DAGITIM === 'apk');
T.ok('apk → indirme sayfasi', guncellemeAdresi(ayar, 'apk') === 'https://kaymaktv.com/download');
T.ok('play → Play adresi', guncellemeAdresi(ayar, 'play') === 'https://play/x');
T.ok('play + sunucu adresi bos → sabit Play adresi (indirme sayfasina ASLA)', guncellemeAdresi({ updateUrl: 'https://kaymaktv.com/download', storeUpdateUrl: null }, 'play') === PLAY_STORE_URL);
T.ok('apk + ayar yok → STORE_URL', guncellemeAdresi(null, 'apk') === STORE_URL);
T.ok('Play sabiti dogru paket', PLAY_STORE_URL.endsWith('id=com.ardagnl.kaymak'));

T.H('Guncelleme bandi');
T.ok('Yapi bilinmiyor → yok', bantGosterilsinMi(null, { minRequiredBuild: 99, latestBuild: 99 }) === 'yok');
T.ok('Sinirlar null (bugunku canli) → yok', bantGosterilsinMi(12, { minRequiredBuild: null, latestBuild: null }) === 'yok');
T.ok('min altinda → zorunlu', bantGosterilsinMi(12, { minRequiredBuild: 13, latestBuild: 14 }) === 'zorunlu');
T.ok('yalniz latest altinda → istege_bagli', bantGosterilsinMi(13, { minRequiredBuild: 13, latestBuild: 14 }) === 'istege_bagli');
T.ok('Guncel → yok', bantGosterilsinMi(14, { minRequiredBuild: 13, latestBuild: 14 }) === 'yok');

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
T.ok('select=* (kolon adi sayilmaz; eksik kolon 400 vermez)', api.includes('select=*') && !/select=min_required/.test(api));
T.ok('Sunucu sonucu saklaniyor', hook.includes('AsyncStorage.setItem(SURUM_ONBELLEK_ANAHTARI'));
T.ok('Eski v1 kaydi siliniyor', hook.includes('AsyncStorage.removeItem(ESKI_SURUM_ONBELLEK_ANAHTARI)'));
T.ok('Sunucu sonucu oturum ici kuraldan geciyor', hook.includes('uygula(oturumIciKarar(mevcut, surumKarari(kurulu, yeni)))'));
T.ok('Kanca yapi numarasini okur, surum adini okumaz', hook.includes('Application.nativeBuildVersion') && !hook.includes('nativeApplicationVersion'));
const bant = source('hooks/useSoftUpdate.ts');
T.ok('Bant yapi numarasini okur, surum adini okumaz', bant.includes('Application.nativeBuildVersion') && !bant.includes('nativeApplicationVersion'));
T.ok('Zorunlu guncelleme bekliyorsa bant ertelemeden once acilir', bant.indexOf("karar === 'zorunlu'") > -1 && bant.indexOf("karar === 'zorunlu'") < bant.indexOf('SNOOZE_KEY)'));
T.ok('Kodda surum ADI karsilastirmasi kalmadi (semver yok)', !fs.existsSync(path.join(root, 'utils/semver.ts')) && !bant.includes('isVersionBelow') && !hook.includes('isVersionBelow'));
const betik = source('scripts/apk-derle.sh');
T.ok('Derleme betigi kanali acikca ayarliyor (apk)', /unset[^\n]*EXPO_PUBLIC_DAGITIM/.test(betik) && betik.includes('export EXPO_PUBLIC_DAGITIM=apk'));
T.ok('EAS production (Play AAB) kanali play', JSON.parse(source('eas.json')).build.production.env.EXPO_PUBLIC_DAGITIM === 'play');
T.ok('Kapi hala AuthProvider disinda', source('app/_layout.tsx').indexOf('<VersionGate>') < source('app/_layout.tsx').indexOf('<AuthProvider>'));
T.bitir();
