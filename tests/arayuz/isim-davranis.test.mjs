// ==========================================================================
// ARAYUZ — Isim ekrani ve gorunen ad penceresi DAVRANIS testleri (1.0.1 Dal 1 duzeltme turu)
// ==========================================================================
// Bagimsiz denetim (2026-11-15) bulgulari 2 ve 4. Kaynakta duzenli ifade aramak yerine hook'lar
// GERCEK govdeleriyle calisir: `tests/mini-react.mjs` (React yerine), elle ilerletilen zamanlayici,
// elle cozulen/reddedilen ag yanitlari. Cikti ASCII (tests/yardimci.js kurali).

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tsLoader } from '../ts-test-loader.mjs';
import { miniReact, sahteZaman, bosalt } from '../mini-react.mjs';
import yardimci from '../yardimci.js';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const T = yardimci.baslat('ARAYUZ ISIM DAVRANIS (1.0.1 Dal 1)', { kokOneki: 'arayuz-isim-davranis-' });
const k = (...n) => String.fromCodePoint(...n);

/** Ortak taklitler: oturum, profil, kayit, oneri servisi. */
function ortam({ kayitSonucu = true, mevcutGorunenAd = null } = {}) {
  const R = miniReact();
  const zaman = sahteZaman();
  const auth = { accessToken: 't1', myUsername: 'eski_ad', myAvatarUrl: null };
  const istekler = [];
  const kayitlar = [];
  const durum = { kayitSonucu };
  // Gerçek `useUpdateProfile` `save`/`clearError`'ı useCallback ile SABİT verir; taklit de öyle.
  const guncelleme = {
    save: async (yama) => { kayitlar.push(yama); return durum.kayitSonucu; },
    isSaving: false, error: null, clearError() {},
  };
  const yukle = tsLoader(KOK, {
    react: R,
    '../context/AuthContext': { useAuth: () => auth },
    './useMyProfile': { useMyProfile: () => ({ profile: { username: 'eski_ad', displayName: mevcutGorunenAd } }) },
    './useUpdateProfile': { useUpdateProfile: () => guncelleme },
    '../features/feed/services/profile': {
      kullaniciAdiSorunu: (a) => (/^[A-Za-z0-9_]{3,30}$/.test(a) ? null : 'karakter'),
      kullaniciAdiOnerisiAl: (token, ad) => new Promise((coz, reddet) => istekler.push({ token, ad, coz, reddet })),
    },
    '../utils/errorLog': { logError() {} },
  }, { setTimeout: zaman.setTimeout, clearTimeout: zaman.clearTimeout, AbortController });
  return { R, zaman, auth, istekler, kayitlar, durum, yukle };
}

/** Isim ekrani: gorunen adi yaz, beklemeyi bitir, son istegi coz/reddet. */
async function oneriTuru(o, e, ad, sonuc) {
  e().gorunenAdDegisti(ad);
  o.zaman.ilerle();
  const istek = o.istekler.at(-1);
  if (sonuc instanceof Error) istek.reddet(sonuc); else istek.coz(sonuc);
  await bosalt();
}

T.H('Bulgu 4 · @kullanici_adi onerisi yalniz guncel girdi + oturuma ait');
{
  const o = ortam();
  const e = o.R.baglan(o.yukle('hooks/useIsimEkrani.ts').useIsimEkrani);
  await oneriTuru(o, e, 'Arda', 'Arda_TV');
  T.ok('basarili oneri kullanilir (Arda -> Arda_TV)', e().kullaniciAdi === 'Arda_TV' && !e().devamKapali);
  await oneriTuru(o, e, 'Mehmet', new Error('502'));
  T.ok(`yeni girdinin onerisi duserse ESKI oneri kullanilmaz, hesabin adina donulur (gelen: ${e().kullaniciAdi})`, e().kullaniciAdi === 'eski_ad');
}
{
  const o = ortam({ kayitSonucu: false });
  const e = o.R.baglan(o.yukle('hooks/useIsimEkrani.ts').useIsimEkrani);
  await oneriTuru(o, e, 'Arda', 'Arda_TV');
  await e().devam();
  T.ok('kayit dusunce (taken) yeni oneri istenir', o.zaman.bekleyenSayisi() === 1);
  o.zaman.ilerle();
  T.ok('yenileme beklenirken Devam kapali', e().devamKapali === true);
  o.istekler.at(-1).reddet(new Error('ag'));
  await bosalt();
  T.ok(`yenileme duserse alinmis Arda_TV yeniden kullanilmaz (gelen: ${e().kullaniciAdi})`, e().kullaniciAdi === 'eski_ad');
}
{
  const o = ortam();
  const e = o.R.baglan(o.yukle('hooks/useIsimEkrani.ts').useIsimEkrani);
  await oneriTuru(o, e, 'Arda', 'Arda_TV');
  o.auth.accessToken = 't2';
  o.R.ciz();
  T.ok('oturum degisince eski oturumun onerisi gecersiz (yeni istek beklenir, Devam kapali)', e().devamKapali === true && o.zaman.bekleyenSayisi() === 1);
  o.zaman.ilerle();
  T.ok('yeni istek yeni oturumla gider', o.istekler.at(-1).token === 't2');
  o.istekler.at(-1).reddet(new Error('ag'));
  await bosalt();
  T.ok(`yeni oturumda istek duserse t1 onerisi kullanilmaz (gelen: ${e().kullaniciAdi})`, e().kullaniciAdi === 'eski_ad');
}
{
  const o = ortam();
  const e = o.R.baglan(o.yukle('hooks/useIsimEkrani.ts').useIsimEkrani);
  e().gorunenAdDegisti('Ali'); o.zaman.ilerle();
  const eski = o.istekler.at(-1);
  e().gorunenAdDegisti('Veli'); o.zaman.ilerle();
  o.istekler.at(-1).coz('Veli'); await bosalt();
  eski.coz('Ali'); await bosalt();
  T.ok(`ters sirali yanit: gec gelen eski yanit guncel oneriyi ezmez (gelen: ${e().kullaniciAdi})`, e().kullaniciAdi === 'Veli');
}
{
  const o = ortam();
  const e = o.R.baglan(o.yukle('hooks/useIsimEkrani.ts').useIsimEkrani);
  e().gorunenAdDegisti('A'); e().gorunenAdDegisti('Ar'); e().gorunenAdDegisti('Arda');
  T.ok('hizli yazim: tek zamanlayici, 300 ms, henuz istek yok', o.zaman.bekleyenSayisi() === 1 && o.zaman.sureler()[0] === 300 && o.istekler.length === 0);
  T.ok('oneri beklenirken Devam kapali', e().devamKapali === true);
  o.zaman.ilerle();
  T.ok('bekleme bitince tek istek, son girdiyle', o.istekler.length === 1 && o.istekler[0].ad === 'Arda');
}
{
  const o = ortam();
  const e = o.R.baglan(o.yukle('hooks/useIsimEkrani.ts').useIsimEkrani);
  await oneriTuru(o, e, 'Arda', 'Arda_TV');
  e().kullaniciAdiDuzenle(); e().kullaniciAdiDegisti('Elle_Ad');
  const once = o.istekler.length;
  e().gorunenAdDegisti('Zeynep'); o.zaman.ilerle();
  T.ok('elle duzenlenen kullanici adi korunur, yeni oneri istenmez', e().kullaniciAdi === 'Elle_Ad' && o.istekler.length === once);
  await e().devam();
  T.ok('kayit elle yazilan adla, gorunen adla birlikte', o.kayitlar.at(-1)?.username === 'Elle_Ad' && o.kayitlar.at(-1)?.displayName === 'Zeynep');
}

T.H('Bulgu 2 · Gorunen ad penceresi: giris -> dogrulama -> kayit');
{
  const o = ortam();
  const { useGorunenAdDuzenle } = o.yukle('hooks/useGorunenAdDuzenle.ts');
  const e = o.R.baglan(() => useGorunenAdDuzenle({ visible: true, currentName: 'Arda Günal' }));
  T.ok('acilista mevcut ad kutuda, degismedigi icin Kaydet kapali', e().value === 'Arda Günal' && e().disabled);
  for (const [ad, girdi] of [['yalniz BOM', k(0xfeff)], ['yalniz ZWSP', k(0x200b)], ['yalniz Hangul dolgu', k(0x3164, 0x3164)]]) {
    e().onChange(girdi);
    T.ok(`${ad} yapistirildi: kutu bos ama Kaydet KAPALI, uyari gorunur (ad silinmez)`, e().value === '' && e().disabled && e().gorunmezAyiklandi);
    T.ok(`${ad}: kaydet() istek atmaz`, (await e().kaydet()) === false && o.kayitlar.length === 0);
  }
  e().onChange('');
  T.ok('kutu bilincli bosaltildi: Kaydet acik (adi kaldirma hakki)', !e().disabled && !e().gorunmezAyiklandi);
  T.ok('bilincli bosaltma kaydi null gonderir', (await e().kaydet()) === true && o.kayitlar.at(-1)?.displayName === null);
  e().onChange('Arda ★');
  T.ok('sembol kutuda kalir, neden gosterilir, Kaydet kapali', e().value === 'Arda ★' && e().sorun === 'karakter' && e().disabled);
  e().onChange(`Arda${k(0x200b)} Yılmaz`);
  T.ok('gorunmez karakter ayiklanir, uyari gorunur, gecerli ad kaydedilebilir', e().value === 'Arda Yılmaz' && e().gorunmezAyiklandi && !e().disabled);
  T.ok('kayit temiz degeri gonderir', (await e().kaydet()) === true && o.kayitlar.at(-1)?.displayName === 'Arda Yılmaz');
}

T.bitir();
