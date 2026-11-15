import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tsLoader } from '../ts-test-loader.mjs';
import yardimci from '../yardimci.js';

// M492 (2026-10-12) · 2.6.5 son tur §0.1 madde 1 ve 4.
//  1 · Profil istatistiği: süre bölümlerin KENDİ sürelerinden (`watched_minutes`) — eski
//      `completed × dizi ortalaması` %28 şişiriyordu (My Sassy Girl 40 dk vs gerçek 30,5).
//  4 · İsim ekranı: her yeni hesapta (Trakt + Google) ilk girişte, «Atla» yok; K2 kalktı.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const T = yardimci.baslat('AD ONAYI + ISTATISTIK SURESI (M492)', { kokOneki: 'ad-onayi-' });
const oku = (p) => fs.readFileSync(path.join(root, p), 'utf8');

// ── 1 · yerelIstatistik ──
const { yerelIstatistik } = tsLoader(root)('utils/yerelIstatistik.ts');
const diziler = [
  { show: { ids: { trakt: 1 }, runtime: 40 } }, // My Sassy Girl
  { show: { ids: { trakt: 2 }, runtime: 59 } }, // MobLand
];
const yeni = yerelIstatistik(diziler, [], { 1: { completed: 32, watched_minutes: 975 }, 2: { completed: 14, watched_minutes: 660 } });
T.ok(`Sunucunun bolum bazli suresi kullanilir (1635 dk, eskiden 2106): ${yeni.episodes.minutes}`, yeni.episodes.minutes === 1635 && yeni.episodes.watched === 46);
const eski = yerelIstatistik(diziler, [], { 1: { completed: 32 }, 2: { completed: 14 } });
T.ok(`Alan yoksa (Trakt kaynakli / eski Worker) eski yol: ${eski.episodes.minutes}`, eski.episodes.minutes === 32 * 40 + 14 * 59);
const karisik = yerelIstatistik(diziler, [], { 1: { completed: 32, watched_minutes: 975 }, 2: { completed: 14 } });
T.ok('Dizi bazinda karisik kaynak dogru toplanir', karisik.episodes.minutes === 975 + 14 * 59);

// ── 4 · isim ekranı ──
const kapi = oku('hooks/useAdOnayKapisi.ts');
T.ok('Kapi yalniz adOnaylandi === false iken yonlendirir (ag hatasinda kilit yok)',
  /p\.adOnaylandi === false\) router\.replace\('\/\(public\)\/profil-olustur'\)/.test(kapi) && /\.catch\(/.test(kapi) && /if \(!accessToken \|\| isGuest\) return;/.test(kapi));
T.ok('Kapi korumali duzende bagli', /useAdOnayKapisi\(\);/.test(oku('app/(protected)/_layout.tsx')));
const ekran = oku('app/(public)/profil-olustur.tsx');
// 1.0.1 Dal 1 (K4, 2026-11-15): mantik `hooks/useIsimEkrani.ts`'e tasindi; ekran yalniz cizer.
const isim = oku('hooks/useIsimEkrani.ts');
T.ok('Isim ekraninda «Atla» YOK (isimsiz girilemez)', !/skipForNow|Şimdilik Atla/.test(ekran) && /useIsimEkrani\(\)/.test(ekran));
T.ok('«Devam» her zaman sunucuda onay yazar (adOnayla: true)', /adOnayla: true/.test(isim));
T.ok('Onaylanacak kullanici adi degismese de kurala uymali (kural disi eski ad gecemez)',
  /const kullaniciAdiKuralSorunu = kullaniciAdi\.length > 0 \? kullaniciAdiSorunu\(kullaniciAdi\) : 'kisa';/.test(isim)
  && /kullaniciAdiKuralSorunu !== null/.test(isim));
T.ok('K4: gorunen ad ZORUNLU — gecerli ad yoksa «Devam» kapali, kayitta gorunen ad gider',
  /const devamKapali = adKarari\.tur !== 'yaz'/.test(isim) && /displayName: adKarari\.deger/.test(isim));
T.ok('K4: kullanici adi elle duzenlenince oneri artik uzerine yazmaz',
  /useKullaniciAdiOnerisi\(adKarari\.tur === 'yaz' && elleKullaniciAdi === null \? adKarari\.deger : null\)/.test(isim)
  && /elleKullaniciAdi !== null \? elleKullaniciAdi\.trim\(\) : \(oneri\.ad \?\? sunucuAdi\)/.test(isim));
T.ok('Oneri gelene kadar «Devam» bekler (eski adla kayit yarisi yok)', /const oneriBekleniyor = elleKullaniciAdi === null && oneri\.yukleniyor;/.test(isim));
const oneri = oku('hooks/useKullaniciAdiOnerisi.ts');
T.ok('Oneri 300 ms bekleyerek istenir (her tusta Worker a istek gitmez — kullanici, 2026-11-15)',
  /export const ONERI_GECIKMESI_MS = 300;/.test(oneri) && /setTimeout\(async \(\) => \{[\s\S]*\}, ONERI_GECIKMESI_MS\)/.test(oneri));
// Iptal, ters sirali yanit, bayat oneri, oturum degisimi: kaynak metni degil DAVRANIS sinanir
// (bagimsiz denetim bulgusu 4) — `isim-davranis.test.mjs`.
T.ok('Iptal sinyali istege iletilir (davranisi isim-davranis takiminda)', /kullaniciAdiOnerisiAl\(accessToken, gorunenAd, denetci\.signal\)/.test(oneri));
const servis = oku('features/feed/services/profile.ts');
T.ok('Eski Worker (alan yok) onayli sayilir', /adOnaylandi: response\.data\.adOnaylandi !== false/.test(servis));
T.ok('K2 kalkti: Ayarlar kullanici adi satiri Trakt hesabina da acik',
  !/authProvider !== 'google'/.test(oku('components/settings/ProfileUsernameSection.tsx')));
T.ok('Silme penceresi «Trakt etkilenmez» notunu yalniz Trakt hesabinda gosterir (M491 bulgusu)',
  /authProvider === 'trakt' && \(/.test(oku('components/settings/DeleteAccountModal.tsx')));
// Cihazda bulundu: «admin» sunucuda reddediliyor ama ekranda yalnız «Kaydedilemedi» yazıyordu.
// Adım 4b (M609): profil servisi artık kural onayı kapısını içe aktarır; kapının kendi testi `kural-onayi`.
const kural = tsLoader(root, { axios: {}, '../../../services/kuralOnayiKapisi': { kuralOnayiSagla: async () => true, kuralOnayiZorunlu: async () => {}, KuralOnayiReddi: class extends Error {} } })('features/feed/services/profile.ts');
T.ok('Istemci ayrilmis adi kendisi reddeder (admin / ADMIN / support)',
  ['admin', 'ADMIN', 'support'].every((a) => kural.kullaniciAdiSorunu(a) === 'ayrilmis') && kural.kullaniciAdiSorunu('Arda_TV') === null);
const kurallarJs = path.join(root, '../kaymaktv-feedback-worker/src/lib/usernameRules.js');
if (fs.existsSync(kurallarJs)) {
  const blok = fs.readFileSync(kurallarJs, 'utf8').match(/AYRILMIS_ADLAR = new Set\(\[([\s\S]*?)\]\)/)[1];
  const workerAdlari = [...blok.matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort();
  const istemciAdlari = [...kural.AYRILMIS_ADLAR].sort();
  T.ok(`Ayrilmis ad listesi Worker ile BIREBIR ayni (${istemciAdlari.length})`, JSON.stringify(workerAdlari) === JSON.stringify(istemciAdlari));
}
const { kullaniciAdiHataMetni } = tsLoader(root)('utils/kullaniciAdiHataMetni.ts');
const tt = (k) => k;
T.ok('Ret kodlari dogru mesaja eslenir (sunucu kodu + istemci sorunu)',
  kullaniciAdiHataMetni(tt, 'kullanici_adi_ayrilmis') === 'settings:usernameReserved'
  && kullaniciAdiHataMetni(tt, 'ayrilmis') === 'settings:usernameReserved'
  && kullaniciAdiHataMetni(tt, 'taken') === 'settings:usernameTaken'
  && kullaniciAdiHataMetni(tt, 'kullanici_adi_karakter') === 'settings:usernameRuleChars'
  && kullaniciAdiHataMetni(tt, 'cooldown') === 'settings:usernameCooldownGeneric'
  && kullaniciAdiHataMetni(tt, 'bilinmeyen') === 'settings:profileSaveError');
const ayarlarModal = oku('components/modals/EditProfileModal.tsx');
T.ok('Iki ekran da ayni eslemeyi kullanir',
  /kullaniciAdiHataMetni\(t, error\.code\)/.test(ayarlarModal) && /kullaniciAdiHataMetni\(t, kuralSorunu\)/.test(ayarlarModal)
  && /kullaniciAdiHataMetni\(t, hata\?\.code\)/.test(ekran) && /kullaniciAdiHataMetni\(t, ekran\.kullaniciAdiKuralSorunu\)/.test(ekran));
T.ok('Isim ekrani gorunen ad reddini (ad_*) kendi metnine esler', /hata\?\.code\?\.startsWith\('ad_'\) \? gorunenAdHataMetni\(t, hata\.code\)/.test(ekran));

const worker = path.join(root, '../kaymaktv-feedback-worker/src/routes/account.js');
if (fs.existsSync(worker)) {
  const w = fs.readFileSync(worker, 'utf8');
  T.ok('Worker: ilk secim beklemeyi baslatmaz, onay yazar', /if \(!ilkSecim\) yama\.username_updated_at = simdi;/.test(w) && /yama\.ad_onaylandi_at = simdi;/.test(w));
  // 1.0.1 Dal 1: tum alanlar TEK PATCH (taken -> hicbir alan yazilmaz).
  T.ok('Worker: profil tek PATCH ile yazilir', (w.match(/supabasePatch\(/g) || []).length === 1 && /supabasePatch\(env, "users", verified\.userId, yama\)/.test(w));
}
T.bitir();
