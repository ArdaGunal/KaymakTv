import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { tsLoader } from '../ts-test-loader.mjs';
import yardimci from '../yardimci.js';

// GORSEL-01 / BACKLOG C34 (2026-10-10): onay ve bilgi pencereleri Android'de yerel
// `Alert.alert` ile BEYAZ açılıyordu (uygulama koyu). Artık hepsi `utils/confirmDialog.ts`
// üzerinden kökteki `ConfirmHost` → `ConfirmModal` (koyu) ile açılır.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const T = yardimci.baslat('ONAY KUTUSU (GORSEL-01)', { kokOneki: 'onay-kutusu-' });
const oku = (p) => fs.readFileSync(path.join(root, p), 'utf8');

// ── 1. Kaynak denetimi: doğrudan Alert.alert yasak ──
const izinli = new Set(['utils/confirmDialog.ts']);
const ihlal = [];
const gez = (d) => {
  for (const f of fs.readdirSync(path.join(root, d))) {
    const rel = `${d}/${f}`;
    if (fs.statSync(path.join(root, rel)).isDirectory()) gez(rel);
    else if (/\.(ts|tsx)$/.test(f) && !izinli.has(rel)) {
      oku(rel).split('\n').forEach((satir, i) => {
        if (/Alert\.alert\(/.test(satir) && !/^\s*(\/\/|\*)/.test(satir)) ihlal.push(`${rel}:${i + 1}`);
      });
    }
  }
};
['app', 'components', 'features', 'screens', 'hooks', 'services', 'utils', 'context', 'store'].forEach(gez);
for (const e of ihlal) T.ok(`dogrudan Alert.alert: ${e} (notify/confirmAsync/chooseAsync kullan)`, false);
T.ok(`Projede dogrudan Alert.alert yok (${ihlal.length} ihlal)`, ihlal.length === 0);

const layout = oku('app/_layout.tsx');
T.ok('ConfirmHost kokte, VersionGate DISINDA bagli', /<\/VersionGate>\s*<ConfirmHost \/>/.test(layout));
const modal = oku('components/ConfirmModal.tsx');
T.ok('Geri tusu ve disari dokunma onDismiss (eylem dugmesi degil)', /onRequestClose=\{onDismiss\}/.test(modal) && /<TouchableWithoutFeedback onPress=\{onDismiss\}>/.test(modal));
T.ok('cancelLabel yoksa tek dugme (notify)', /\{cancelLabel \? \(/.test(modal));
const dugme = oku('components/EpisodeCheckButton.tsx');
const kanca = oku('hooks/useEpisodeActions.ts');
T.ok('Atlanan bolum sorusu chooseAsync; vazgecme hicbir sey isaretlemez (dugme)',
  /chooseAsync\(/.test(dugme) && /if \(secim === 'primary'\) performCheckIn\(plan\);\s*else if \(secim === 'secondary'\) performCheckIn\(null\);/.test(dugme));
T.ok('Atlanan bolum sorusu BEKLENIR, kilit secime dek surer (bolum sayfasi)',
  /const secim = await chooseAsync\(/.test(kanca) && /else if \(secim === 'secondary'\) await performCheckIn\(null\);/.test(kanca));

// Web turunda bulundu (M487): kart menüsünde gönderi silerken «Aktiviteyi Sil», iptalde menü açık kalıyordu
const eylem = oku('features/feed/hooks/useActivityActions.tsx');
T.ok('Silme basligi turune gore TEK yerde (kart menusu + detay ayni menuProps)',
  /postDeleteConfirmTitle/.test(eylem) && /reviewDeleteConfirmTitle/.test(eylem) && /const menuProps = \{\s*deleteConfirm,/.test(eylem)
  && !/postDeleteConfirmTitle/.test(oku('features/feed/components/detail/PublishedActivityDetail.tsx')));
T.ok('Silme onayi iptal edilince kart menusu kapanir',
  /if \(!confirmed\) \{\s*closeMenu\(\);\s*return;/.test(oku('features/feed/components/CardMenu.tsx')));

// ── 2. Davranış: gerçek store + confirmDialog ──
const yerel = [];
const load = tsLoader(root, {
  zustand: require('zustand'),
  'react-native': {
    Platform: { OS: 'android' },
    Alert: { alert: (...a) => { yerel.push(a); const b = a[2]; if (Array.isArray(b)) b[b.length - 1].onPress(); } },
  },
});
const { useDialogStore } = load('store/dialogStore.ts');
const D = load('utils/confirmDialog.ts');
const st = useDialogStore.getState;
const tik = () => new Promise((r) => setTimeout(r, 0));

// Host yokken yerel diyaloğa düşer (çok erken açılış), askıda kalmaz
T.ok('Host yokken yerel yedege duser', (await D.confirmAsync('B', 'M', 'Sil', 'Iptal')) === true && yerel.length === 1);
T.ok('Yedekte onDismiss=false baglı (F17 askida kalma yok)', yerel[0][3]?.cancelable === true && typeof yerel[0][3]?.onDismiss === 'function');

const birak = st().hostMounted();
let p = D.confirmAsync('Sil?', 'Geri alinamaz', 'Sil', 'Iptal');
T.ok('Host varken yerel Alert ACILMAZ, kuyruga girer', yerel.length === 1 && st().queue.length === 1);
const q0 = st().queue[0];
T.ok('Etiketler ve kirmizi dugme tasinir', q0.confirmLabel === 'Sil' && q0.cancelLabel === 'Iptal' && q0.destructive === true);
st().settle(q0.id, 'confirm');
st().settle(q0.id, 'cancel');
T.ok('Onay -> true; ikinci dokunus sonucu DEGISTIRMEZ', (await p) === true && st().queue.length === 0);

p = D.confirmAsync('Sil?', 'm', 'Sil', 'Iptal');
st().settle(st().queue[0].id, 'dismiss');
T.ok('Geri tusu / disari dokunma -> false', (await p) === false);
p = D.confirmAsync('Takip', 'm', 'Evet', 'Hayir', { destructive: false });
T.ok('destructive:false tasinir', st().queue[0].destructive === false);
st().settle(st().queue[0].id, 'cancel');
T.ok('Ikincil dugme -> false', (await p) === false);

const secimler = [];
for (const r of ['confirm', 'cancel', 'dismiss']) {
  const c = D.chooseAsync('Atlanan', 'm', 'Oncekileri de', 'Yalniz bu');
  st().settle(st().queue[0].id, r);
  secimler.push(await c);
}
T.ok('chooseAsync: birincil/ikincil/vazgec ayri (primary, secondary, null)', JSON.stringify(secimler) === '["primary","secondary",null]');

const n1 = D.notify('Hata', 'Bir sey oldu');
const n2 = D.confirmAsync('Ikinci', 'm', 'Tamam', 'Iptal');
T.ok('notify tek dugme (cancelLabel yok, etiket host verir)', st().queue[0].cancelLabel === undefined && st().queue[0].confirmLabel === undefined);
T.ok('Ayni anda iki istek sirayla: kayip yok', st().queue.length === 2 && st().queue[1].title === 'Ikinci');
st().settle(st().queue[0].id, 'confirm');
await n1;
T.ok('Ilk kapaninca ikinci one gecer', st().queue.length === 1 && st().queue[0].title === 'Ikinci');

birak();
T.ok('Host ayrilinca bekleyen istek askida kalmaz (vazgec)', (await n2) === false && st().queue.length === 0);
await tik();

// ── 3. Mevcut çağıran: yorumlu çıkış onayı hâlâ confirmAsync ──
T.ok('Detay sayfasi cikis onayi confirmAsync kullaniyor', /confirmAsync/.test(oku('features/feed/components/detail/PublishedActivityDetail.tsx')));
T.bitir();
