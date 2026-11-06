import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tsLoader } from '../ts-test-loader.mjs';
import yardimci from '../yardimci.js';

// HIZ-02 B3 + C34: giriş sırası, takipçi sayısı, hatalı bağlantı, server.js bölünmesi.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const T = yardimci.baslat('HIZ PAKETI (B3 / C34)', { kokOneki: 'hiz-paketi-' });
const oku = (f) => fs.readFileSync(path.join(root, f), 'utf8');

T.H('Takipci sayisi dugmeyle ayni anda degisir');
const { gosterilenTakipci: g } = tsLoader(root)('utils/gosterilenTakipci.ts');
T.ok('Takip edince +1', g(10, 'yok', 'following', false) === 11);
T.ok('Biraktikten sonra -1', g(10, 'takip', 'none', false) === 9);
T.ok('Degisiklik yoksa ayni', g(10, 'takip', 'following', false) === 10 && g(10, 'yok', 'none', false) === 10);
T.ok('Bekleyen istek sayilmaz', g(10, 'yok', 'pending', false) === 10);
T.ok('Baglanti yuklenirken olcum', g(10, 'takip', 'none', true) === 10);
T.ok('Eksiye dusmez', g(0, 'takip', 'none', false) === 0);
for (const f of ['screens/PublicProfileMobile.tsx', 'app/(protected)/user/[slug].web.tsx']) {
  T.ok(`${f}: sayi yardimcidan`, /gosterilenTakipci\(olculenTakipci, takipIliskisi, connectionState, isLoadingConnection\)/.test(oku(f)));
}

T.H('Giris sirasi: once kutuphane');
const duzen = oku('app/(protected)/_layout.tsx');
T.ok('Akis ve aktarim hazir bekliyor', /useFeedSyncTrigger\(accessToken, isGuest, kutuphaneHazir\)/.test(duzen) && /useOtomatikAktarim\(kutuphaneHazir\)/.test(duzen));
const akis = oku('features/feed/hooks/useFeedSyncTrigger.ts');
T.ok('Akis senkronu hazir olmadan baslamaz', /if \(!hazir \|\|/.test(akis) && /\[accessToken, isGuest, hazir\]/.test(akis));
const aktarim = oku('hooks/useOtomatikAktarim.ts');
const cikis = aktarim.indexOf('m.durdur()');
const bekleme = aktarim.indexOf('if (!hazir) return;');
T.ok('Cikis temizligi beklemeyi gecer, baslatma beklemeden sonra', cikis > 0 && bekleme > cikis && aktarim.indexOf('m.baslat()') > bekleme);
const kanca = oku('hooks/useKutuphaneHazir.ts');
T.ok('Kutuphane takilirsa ust sinir var', /EN_COK_BEKLEME_MS = 10_000/.test(kanca) && /!yukleniyor \|\| sureDoldu/.test(kanca));
T.ok('Hazir sinyali onbellek degil kutuphane turu (gece bulgusu)', /s\.ilkTurBitti/.test(kanca) && !/s\.isLoading/.test(kanca));
const cekici = oku('services/library/fetchers.ts');
const turSatiri = cekici.indexOf('turBitti = await turIsi;');
const sinyal = cekici.indexOf('setIlkTurBitti(true)');
T.ok('Sinyal kutuphane turunun finally blogunda', turSatiri > 0 && sinyal > turSatiri && sinyal < cekici.indexOf('if (turBitti) return;'));
T.ok('Cikista sinyal sifirlanir', /clearAll[\s\S]*ilkTurBitti: false/.test(oku('store/useLibraryStore.ts')));

T.H('Hatali baglanti iskelette kalmaz');
for (const f of ['app/show/[id].tsx', 'app/movie/[id].tsx']) {
  T.ok(`${f}: kimliksizde iskelet yok`, /if \(isLoading && traktIdNum\) \{/.test(oku(f)));
}

T.H('server.js bolunmesi');
const sunucu = oku('server.js');
const yollar = oku('server/traktProxyYollari.js');
T.ok('server.js 400 satir altinda', sunucu.split('\n').length < 400);
T.ok('Yollar tek dosyada', !/app\.(get|post|delete|put)\('\/api\/trakt/.test(sunucu)
  && ['get', 'post', 'delete', 'put'].every((m) => new RegExp(`app\\.${m}\\('/api/trakt-proxy'`).test(yollar))
  && /app\.post\('\/api\/trakt', traktAuthLimiter, redirectUriGuard/.test(yollar));
const koruma = sunucu.indexOf("app.use('/api/trakt-proxy', traktProxyLimiter, traktProxyGuard)");
const bag = sunucu.indexOf("require('./server/traktProxyYollari')(app");
const statik = sunucu.indexOf('express.static');
T.ok('Sira: koruma > yollar > statik', koruma > 0 && bag > koruma && statik > bag);
T.ok('Onbellek yolu yakin dosyadan', /require\('\.\/traktProxyOnbellek'\)/.test(yollar));
T.bitir();
