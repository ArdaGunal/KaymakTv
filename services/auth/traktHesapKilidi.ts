import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

/**
 * GIRIS-KILIT-01 · «Hesabını bulduk → Trakt ile devam et» kartının hesabı Trakt dönüşünde denetlenir.
 *
 * Canlı T1 (2026-10-31): kart @ArdaGnl gösterdi; tarayıcıda trakt.tv'de Trakt_test seçildiği için
 * kullanıcı UYARISIZ @Arda_Gunal'a girdi. Kök: kartın hesabı Trakt akışına taşınmıyor, dönüşte
 * karşılaştırılmıyordu — girilen hesabı yalnız trakt.tv'de o an açık olan hesap belirliyordu.
 * Sunucu eşlemesi (Google `google_sub`, Trakt `trakt_uuid`) doğruydu; açık yalnız bu akıştaydı.
 *
 * Akış: kart düğmesi → beklenen Trakt kimliği AsyncStorage'a (web tam sayfa yönlendirmede de kalır)
 * → dönüşte token alınır → Trakt'a «bu token kimin» (`/users/settings`, Pi köprüsü: web CORS; beyaz
 * listede, önbelleğe alınmaz) → eşleşmezse OTURUM AÇILMAZ, token kaydedilmez. Düz «Trakt ile giriş»
 * beklentiyi siler: kilit yalnız kart yolundadır. Saldırı önlemi değil — kişinin kendi hesapları
 * arasındaki karışıklığa karşı.
 */
const ANAHTAR = '@kaymak_trakt_beklenen_hesap_v1';
const OMUR_MS = 15 * 60 * 1000;

const TRAKT_PROXY_URL = process.env.EXPO_PUBLIC_API_URL
  ? `${process.env.EXPO_PUBLIC_API_URL}/api/trakt-proxy`
  : '/api/trakt-proxy';

export interface BeklenenTraktHesabi {
  username: string;
  kaymakNo: number | null;
  traktSlug: string | null;
  traktUuid: string | null;
  /** GIRIS-KILIT-02: yalnız gösterim — en çok 15 dk cihazda, dönüşte okunur okunmaz silinir. */
  googleEmail: string | null;
  /** Uyuşmazlık ekranından «tekrar dene» sayısı; 1+ → ekran adım adım rehberi de gösterir. */
  deneme: number;
}

export interface GelenTraktKimligi {
  slug: string | null;
  uuid: string | null;
  /** Gösterim: Trakt'taki görünen ad ve profil resmi (`/users/settings`, Trakt belgesi). */
  ad: string | null;
  avatar: string | null;
}

export type KilitSonucu =
  | { durum: 'serbest' }
  | { durum: 'uyusuyor' }
  | { durum: 'uyusmazlik'; beklenen: BeklenenTraktHesabi; gelen: GelenTraktKimligi };

const metin = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/**
 * SAF — gelen Trakt kimliği beklenen mi. İki tarafta da uuid varsa YALNIZ uuid (kalıcı; ad Trakt'ta
 * değişebilir). Yoksa ad (slug, büyük/küçük harf duyarsız). Karşılaştırılacak bir şey yoksa false.
 */
export function traktHesabiUyusuyor(beklenen: BeklenenTraktHesabi, gelen: GelenTraktKimligi): boolean {
  if (beklenen.traktUuid && gelen.uuid) return beklenen.traktUuid === gelen.uuid;
  if (beklenen.traktSlug && gelen.slug) return beklenen.traktSlug.toLowerCase() === gelen.slug.toLowerCase();
  return false;
}

/**
 * SAF — Trakt yetki adresine `prompt=login` ekler: Trakt açık oturumu SORMADAN kullanmasın, giriş
 * ekranını açsın (Trakt belgesi: «Force the user to sign in and authorize your app»; canlı: parametresiz
 * akış açık hesabı sessizce döndürdü, parametreyle giriş formu açıldı — 2026-10-31).
 */
export function zorunluGirisAdresi(adres: string): string {
  if (/[?&]prompt=/.test(adres)) return adres;
  return `${adres}${adres.includes('?') ? '&' : '?'}prompt=login`;
}

/** Kart düğmesinde çağrılır. Trakt kimliği yoksa (eski Worker) beklenti yazılmaz → bugünkü davranış. */
export async function beklenenTraktHesabiKaydet(hesap: BeklenenTraktHesabi | null): Promise<void> {
  try {
    if (!hesap || (!hesap.traktSlug && !hesap.traktUuid)) {
      await AsyncStorage.removeItem(ANAHTAR);
      return;
    }
    await AsyncStorage.setItem(ANAHTAR, JSON.stringify({ ...hesap, kaydedildi: Date.now() }));
  } catch {
    // Yazılamazsa dönüşte denetim yapılamaz — bugünkü davranış (AsyncStorage hatası nadir).
  }
}

/** Düz «Trakt ile giriş» düğmesinde çağrılır: eski bir kart beklentisi bu girişi engellemesin. */
export async function beklenenTraktHesabiSil(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ANAHTAR);
  } catch {
    // Silinemezse en geç 15 dk'da (OMUR_MS) kendiliğinden geçersiz.
  }
}

/** Okur ve SİLER (tek kullanımlık). Bozuk ya da 15 dk'dan eski kayıt yok sayılır. */
export async function beklenenTraktHesabiTuket(): Promise<BeklenenTraktHesabi | null> {
  let ham: string | null = null;
  try {
    ham = await AsyncStorage.getItem(ANAHTAR);
    await AsyncStorage.removeItem(ANAHTAR);
  } catch {
    return null;
  }
  if (!ham) return null;
  try {
    const k = JSON.parse(ham);
    if (typeof k?.kaydedildi !== 'number' || Date.now() - k.kaydedildi > OMUR_MS) return null;
    const traktSlug = metin(k.traktSlug), traktUuid = metin(k.traktUuid), username = metin(k.username);
    if (!username || (!traktSlug && !traktUuid)) return null;
    return {
      username,
      kaymakNo: Number.isInteger(k.kaymakNo) ? k.kaymakNo : null,
      traktSlug,
      traktUuid,
      googleEmail: metin(k.googleEmail),
      deneme: Number.isInteger(k.deneme) && k.deneme > 0 ? k.deneme : 0,
    };
  } catch {
    return null;
  }
}

/** Yeni token'ın Trakt kimliği. Hata FIRLATIR — çağıran oturum açmaz (güvenli taraf). */
export async function traktKimligiSor(accessToken: string): Promise<GelenTraktKimligi> {
  const yanit = await axios.get(TRAKT_PROXY_URL, {
    params: { endpoint: '/users/settings' },
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: 15000,
  });
  const kullanici = yanit.data?.user ?? {};
  const ids = kullanici.ids ?? {};
  const avatar = metin(kullanici.images?.avatar?.full);
  const kimlik = {
    slug: metin(ids.slug),
    uuid: metin(ids.uuid),
    ad: metin(kullanici.name),
    avatar: avatar && /^https:\/\//.test(avatar) ? avatar : null,
  };
  if (!kimlik.slug && !kimlik.uuid) throw new Error('trakt_kimlik_yok');
  return kimlik;
}

/**
 * Token kaydedilmeden ÖNCE çağrılır. Beklenti yoksa 'serbest' (Trakt'a hiç sorulmaz). Trakt'a
 * ulaşılamazsa hata fırlar — çağıranın catch'i oturum açmadan hata gösterir.
 */
export async function traktHesapKilidiDenetle(accessToken: string): Promise<KilitSonucu> {
  const beklenen = await beklenenTraktHesabiTuket();
  if (!beklenen) return { durum: 'serbest' };
  const gelen = await traktKimligiSor(accessToken);
  return traktHesabiUyusuyor(beklenen, gelen) ? { durum: 'uyusuyor' } : { durum: 'uyusmazlik', beklenen, gelen };
}
