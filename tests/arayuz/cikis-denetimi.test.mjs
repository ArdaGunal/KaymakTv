import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tsLoader } from '../ts-test-loader.mjs';
import yardimci from '../yardimci.js';

// Kimlik Faz 4d (M517) · D8 — «Çıkış Yap» sonrası cihazda kullanıcıya ait HİÇBİR şey
// kalmaz: anahtar listesi = izin listesi (bugün boş). M439'un kuyruk istisnası kalktı.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const T = yardimci.baslat('CIKIS DENETIMI (Kimlik Faz 4d / D8 · M517)', { kokOneki: 'cikis-' });
const oku = (f) => fs.readFileSync(path.join(root, f), 'utf8');

// ── Sahte cihaz ────────────────────────────────────────────────────────────
const disk = new Map();
const as = {
  getAllKeys: async () => [...disk.keys()],
  multiGet: async (ks) => ks.map((k) => [k, disk.get(k) ?? null]),
  multiRemove: async (ks) => { ks.forEach((k) => disk.delete(k)); },
};
let gorselSilindi = 0, googleCikti = 0, yapilandi = false;
const load = tsLoader(root, {
  '@react-native-async-storage/async-storage': { default: as, ...as },
  'react-native': { Platform: { OS: 'android' } },
  'expo-image': { Image: { clearDiskCache: async () => { gorselSilindi++; return true; }, clearMemoryCache: async () => { gorselSilindi++; return true; } } },
  '@react-native-google-signin/google-signin': { GoogleSignin: {
    configure: () => { yapilandi = true; },
    // Gercek paket gibi: configure() yapilmadan signOut FIRLATIR (M518 canli bulgu).
    hasPreviousSignIn: () => { if (!yapilandi) throw new Error('apiClient is null - call configure() first'); return true; },
    signOut: async () => { if (!yapilandi) throw new Error('apiClient is null - call configure() first'); googleCikti++; return null; },
  } },
});
const C = load('services/auth/cikisTemizligi.ts');

T.H('Izin listesi');
// D8 istisnasi (kullanici onayi 2026-10-18, DISCORD-01 · M529): yalniz 3 KIMLIKSIZ telemetri anahtari.
// Baska anahtar eklemek = yeni D8 istisnasi → kullaniciya sor.
const TELEMETRI = ['@kaymak_install_id_v1', '@kaymak_telemetry_quota_v1', '@kaymak_telemetry_seen_v1'];
T.ok('CIKISTA_KALAN_ANAHTARLAR = TAM OLARAK 3 telemetri anahtari', JSON.stringify([...C.CIKISTA_KALAN_ANAHTARLAR].sort()) === JSON.stringify([...TELEMETRI].sort()), C.CIKISTA_KALAN_ANAHTARLAR.join(','));
T.ok('Adlar telemetry.ts ile ayni', TELEMETRI.every((k) => oku('services/api/telemetry.ts').includes(`'${k}'`)));

T.H('Bekleyen is sayisi (cikis uyarisi)');
disk.set('kaymak-watched-outbox-v1:u1', JSON.stringify({ version: 1, jobs: [{}, {}] }));
disk.set('kaymak-hidden-outbox-v1:u1', JSON.stringify({ version: 1, jobs: [{}] }));
disk.set('kaymak-watched-outbox-v1:bozuk', '{bozuk');
disk.set('dil', 'tr');
T.ok('Iki kuyrugun isleri toplanir, bozuk kayit sayilmaz', (await C.bekleyenIsSayisi()) === 3);

T.H('Cikis temizligi');
disk.set('akis-disk-kopyasi', '[]');
disk.set('kaymakMyUsername', 'Arda_Gunal'); // web: secureStorage → localStorage = ayni depo
for (const k of TELEMETRI) disk.set(k, 'x');
await C.cihazAnahtarlariniSil();
T.ok('🔴 Kuyruklar DAHIL hicbir kullanici anahtari kalmadi; yalniz 3 telemetri anahtari', disk.size === 3 && TELEMETRI.every((k) => disk.has(k)), [...disk.keys()].join(','));
for (const k of TELEMETRI) disk.delete(k);
T.ok('Bos kuyrukta uyari yok', (await C.bekleyenIsSayisi()) === 0);
await C.gorselOnbelleginiSil();
T.ok('Gorsel onbellegi (disk + bellek) silindi', gorselSilindi === 2);
await C.googleOturumunuKapat();
T.ok('🔴 Yerel Google oturumu configure() ONCESI de kapanir (M518; sonraki giriste hesap secilir)', googleCikti === 1 && yapilandi);

T.H('Baglanti (AuthContext.removeKeys)');
const auth = oku('context/AuthContext.tsx');
const govde = auth.slice(auth.indexOf('const removeKeys = async'), auth.indexOf('return (\n    <AuthContext.Provider') > 0 ? auth.indexOf('return (\n    <AuthContext.Provider') : undefined);
T.ok('removeKeys tum cihaz anahtarlarini siliyor', govde.includes('await cihazAnahtarlariniSil();'));
T.ok('Eski kuyruk istisnasi (OUTBOX_PREFIX filtresi) YOK', !/startsWith\(OUTBOX_PREFIX\)|startsWith\(HIDDEN_OUTBOX_PREFIX\)/.test(auth));
T.ok('Google yerel oturumu ve gorsel onbellegi kapaniyor', govde.includes('await googleOturumunuKapat();') && govde.includes('await gorselOnbelleginiSil();'));
T.ok('Push kaydi token silinmeden ONCE kaldiriliyor (sira korunuyor)', govde.indexOf('await unregisterPushToken();') > -1 && govde.indexOf('await unregisterPushToken();') < govde.indexOf("SecureStore.deleteItemAsync('traktAccessToken')"));

// Kodda yazilan HER SecureStore anahtari cikista silinmeli (web'de localStorage).
const tara = (dir, out = []) => {
  for (const ad of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const yol = path.join(dir, ad.name);
    if (ad.isDirectory()) tara(yol, out);
    else if (/\.(ts|tsx)$/.test(ad.name)) out.push(yol);
  }
  return out;
};
const dosyalar = ['app', 'components', 'context', 'features', 'hooks', 'services', 'store', 'utils'].flatMap((d) => tara(d));
const yazilan = new Set();
for (const f of dosyalar) for (const m of oku(f).matchAll(/SecureStore\.setItemAsync\(\s*['"`]([^'"`]+)['"`]/g)) yazilan.add(m[1]);
const eksik = [...yazilan].filter((k) => !govde.includes(`SecureStore.deleteItemAsync('${k}')`));
T.ok(`Yazilan ${yazilan.size} SecureStore anahtarinin HEPSI cikista siliniyor`, yazilan.size >= 6 && eksik.length === 0, eksik.join(','));

T.H('Uyari (useSettings.handleLogout)');
const ayar = oku('hooks/useSettings.ts');
const cikis = ayar.slice(ayar.indexOf('const handleLogout'), ayar.indexOf('const handleDeleteAccount'));
T.ok('Bekleyen is varsa ONCE onay, vazgecerse cikis YOK', /const bekleyen = await bekleyenIsSayisi\(\);/.test(cikis) && /if \(!devam\) return;/.test(cikis) && cikis.indexOf('confirmAsync(') < cikis.indexOf('await removeKeys()'));
for (const dil of ['tr', 'en']) {
  const s = JSON.parse(oku(`locales/${dil}/settings.json`));
  T.ok(`${dil}: uyari metinleri var, sayi {{n}} ile`, !!s.cikisBekleyenBaslik && /\{\{n\}\}/.test(s.cikisBekleyenMetin || '') && !!s.cikisYineDeCik);
}
T.bitir();
