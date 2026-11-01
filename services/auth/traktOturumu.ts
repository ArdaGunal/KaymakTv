import * as SecureStore from '../../utils/secureStorage';
import { kasadanErisimIste, kasaOturumuAc, kasayaTasi, KasaHatasi, type KasaOturumu } from '../api/traktKasa';

/**
 * Trakt oturumunun TEK karar yeri (`docs/design/TRAKT_KASA_PLANI.md` §4.7). Yenileme anahtarının
 * sahibi Worker; cihazda erişim anahtarı + KaymakTV oturumu durur. Eski cihazdaki yenileme anahtarı
 * bir kez kasaya taşınıp silinir.
 *
 * 🔴 Yalnız sunucunun açıkça «bitti» dediği kodlar oturumu kapatır. İnternet kopması, Worker ya da
 * Trakt hatası kullanıcıyı ÇIKIŞA ATMAZ (eskiden her yenileme hatası atıyordu): `gecici` döner,
 * yalnız o istek başarısız olur.
 */
export type YenilemeSonucu = { tur: 'tamam'; erisim: string } | { tur: 'bitti' } | { tur: 'gecici' };
export type TasimaSonucu = YenilemeSonucu | { tur: 'gecersiz' };

// `invalid_token` = oturum belgesi dolmuş / iptal edilmiş / hesap silinmiş. Liste DIŞINDAKİ her kod geçicidir.
const OTURUMU_BITIREN_KODLAR = new Set(['kasa_yok', 'kasa_koptu', 'invalid_token', 'gecersiz_istek']);
const GIRIS_DENEME_ARALIKLARI_MS = [1000, 3000];
const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function yaz(o: KasaOturumu): Promise<void> {
  await SecureStore.setItemAsync('traktAccessToken', o.erisim);
  await SecureStore.setItemAsync('kaymakOturum', o.kaymakOturum);
}

const kodu = (e: unknown) => (e instanceof KasaHatasi ? e.kod : 'bilinmeyen');

/** Eski cihaz: yenileme anahtarını kasaya devret. `gecersiz` = anahtar ölü, silindi (oturum kapatmak çağıranın işi). */
export async function eskiAnahtariTasi(): Promise<TasimaSonucu | null> {
  const [erisim, yenileme] = await Promise.all([
    SecureStore.getItemAsync('traktAccessToken'),
    SecureStore.getItemAsync('traktRefreshToken'),
  ]);
  if (!yenileme) return null;
  if (!erisim) return { tur: 'bitti' };
  try {
    const o = await kasayaTasi(erisim, yenileme);
    await yaz(o);
    await SecureStore.deleteItemAsync('traktRefreshToken');
    return { tur: 'tamam', erisim: o.erisim };
  } catch (e) {
    if (kodu(e) !== 'tasi_gecersiz') {
      console.warn('[traktOturumu] Taşıma ertelendi:', kodu(e));
      return { tur: 'gecici' };
    }
    await SecureStore.deleteItemAsync('traktRefreshToken');
    return { tur: 'gecersiz' };
  }
}

/** 401 sonrası: geçerli erişim anahtarı al. Asla fırlatmaz. */
export async function traktOturumunuYenile(): Promise<YenilemeSonucu> {
  try {
    const tasima = await eskiAnahtariTasi();
    if (tasima && tasima.tur !== 'gecersiz') return tasima;
    // `gecersiz`: başka sekme az önce taşımış olabilir → aşağıda onun yazdığı oturum okunur.
    const oturum = await SecureStore.getItemAsync('kaymakOturum');
    if (!oturum) return { tur: 'bitti' };
    const o = await kasadanErisimIste(oturum);
    await yaz(o);
    return { tur: 'tamam', erisim: o.erisim };
  } catch (e) {
    const kod = kodu(e);
    console.warn('[traktOturumu] Yenileme başarısız:', kod);
    return OTURUMU_BITIREN_KODLAR.has(kod) ? { tur: 'bitti' } : { tur: 'gecici' };
  }
}

/**
 * Hesap Seç silmeyi yaptıktan sonra hangi oturuma geçilecek. Karar `useHesapSec` başlığında:
 * `ayni` = oturum değişmez · nesne = bu erişim + oturuma geç · `giris` = oturum açılamadı/kanıtlanmadı,
 * çıkış + Trakt girişi (kasa yok, bilet doldu: kişi bir kez Trakt'a girer, veri kaybı yok).
 */
export async function hesapSecSonrasiOturum(
  r: { oturum: string; kalanBenMiyim: boolean },
  yeni: { access: string; kasaBileti: string } | undefined,
  mevcutErisim: string
): Promise<'ayni' | 'giris' | { access: string; oturum: KasaOturumu }> {
  if (r.oturum === 'trakt_ile_gir' || (r.oturum === 'yeni_trakt' && !yeni)) return 'giris';
  if (r.oturum !== 'yeni_trakt' && r.kalanBenMiyim) return 'ayni';
  try {
    if (r.oturum === 'yeni_trakt' && yeni) return { access: yeni.access, oturum: await girisOturumuAc(yeni.access, yeni.kasaBileti) };
    // Aynı Trakt erişimi artık kalan hesaba çözülür; kasası 072'de oraya taşındı, oturum belgesi yenilenir.
    const oturum = await kasayaTasi(mevcutErisim);
    return { access: oturum.erisim, oturum };
  } catch (e) {
    console.warn('[traktOturumu] Hesap Seç sonrası oturum açılamadı:', kodu(e));
    return 'giris';
  }
}

/**
 * Yeni girişi kasaya yazar. Trakt kodu çoktan harcandı, tekrar istenemez → geçici hatada aynı biletle
 * birkaç kez dener (bilet 15 dk geçerli, Worker aynı biletin tekrarını güvenle karşılar).
 */
export async function girisOturumuAc(erisim: string, kasaBileti: string): Promise<KasaOturumu> {
  for (const aralik of GIRIS_DENEME_ARALIKLARI_MS) {
    try {
      return await kasaOturumuAc(erisim, kasaBileti);
    } catch (e) {
      if (!['tekrar_dene', 'ag', 'sunucu'].includes(kodu(e))) throw e;
      await bekle(aralik);
    }
  }
  return kasaOturumuAc(erisim, kasaBileti);
}
