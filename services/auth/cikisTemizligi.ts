import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { Image } from 'expo-image';
import { OUTBOX_PREFIX } from '../library/outbox/types';
import { HIDDEN_OUTBOX_PREFIX } from '../library/hiddenOutbox/types';

/**
 * ÇIKIŞ DENETİMİ — Kimlik planı Faz 4d (M517) · D8.
 *
 * Kullanıcı (2026-10-12): *«Bir kullanıcı "Çıkış Yap" butonuna basıyorsa, sistemin onu
 * tamamen unutmasını, cihazda hiçbir kırıntı (cookie, cache, isim) bırakmamasını beklerim.»*
 * (2026-10-13): *«Çıkış Yap eylemi cihazı %100 temizlemelidir (stateless)… Kullanıcı "Yine
 * de Çık" derse, çevrimdışı kuyruk dahil cihazdaki her şeyi (sıfır kırıntı) silelim.»*
 * → M439'daki «bekleyen izleme kuyruğu çıkışta korunur» kuralı KALKTI; yerine çıkıştan
 * önce uyarı (`bekleyenIsSayisi`).
 *
 * Çıkışta cihazda KALAN AsyncStorage anahtarları = bu izin listesi. Yalnız 3 telemetri
 * anahtarı (kimliksiz, M529); dil seçimi dahil kalan her şey gider. Buraya anahtar eklemek = D8'e istisna → kullanıcıya sor,
 * gerekçeyi yanına yaz (`tests/arayuz/cikis-denetimi.test.mjs` bu listeyi denetler).
 *
 * SecureStore (web'de localStorage) anahtarları `AuthContext.removeKeys`'te tek tek
 * siliniyor — test, kodda yazılan HER SecureStore anahtarının orada silindiğini denetler.
 */
export const CIKISTA_KALAN_ANAHTARLAR: readonly string[] = [
  // D8 İSTİSNASI — DISCORD-01 (M529), kullanıcı onayı 2026-10-18: *«Normal 'Çıkış Yap' işleminde bu
  // 3 anahtar silinmesin.»* Üçü de KİMLİĞE BAĞLI DEĞİL (isim/e-posta/token yok):
  //   kurulum kimliği = rastgele `ins_…`; aynı cihazdan gelen hatalar ayırt edilsin diye.
  //   günlük 20 tavanı + 24 saat parmak izi = spam koruması. Silinince her çıkış-giriş korumayı
  //   sıfırlıyor, aynı hata Discord'a yeniden yağıyordu (12:28 seli).
  // Hesap SİLMEDE kurulum kimliği yenilenir (`telemetry.kurulumKimliginiYenile`), sayaçlar kalır.
  // Adlar `services/api/telemetry.ts` → `TELEMETRI_ANAHTARLARI` ile aynı (test denetler).
  '@kaymak_install_id_v1',
  '@kaymak_telemetry_quota_v1',
  '@kaymak_telemetry_seen_v1',
];

/** Sunucuya henüz gitmemiş işaretleme + gizleme işi sayısı (diskteki kuyruklardan). */
export async function bekleyenIsSayisi(): Promise<number> {
  try {
    const anahtarlar = (await AsyncStorage.getAllKeys()).filter(
      (k) => k.startsWith(OUTBOX_PREFIX) || k.startsWith(HIDDEN_OUTBOX_PREFIX)
    );
    if (anahtarlar.length === 0) return 0;
    let toplam = 0;
    for (const [, deger] of await AsyncStorage.multiGet(anahtarlar)) {
      try {
        const jobs = deger ? JSON.parse(deger)?.jobs : null;
        if (Array.isArray(jobs)) toplam += jobs.length;
      } catch {
        // Bozuk kayıt sayılmaz — zaten gönderilemez.
      }
    }
    return toplam;
  } catch {
    return 0;
  }
}

/** İzin listesi dışındaki BÜTÜN AsyncStorage anahtarları (kuyruklar dahil). */
export async function cihazAnahtarlariniSil(): Promise<void> {
  const silinecek = (await AsyncStorage.getAllKeys()).filter((k) => !CIKISTA_KALAN_ANAHTARLAR.includes(k));
  if (silinecek.length > 0) await AsyncStorage.multiRemove(silinecek);
}

/** Görsel önbelleği (profil fotoğrafları dahil). Hata çıkışı durdurmaz. */
export async function gorselOnbelleginiSil(): Promise<void> {
  try {
    await Promise.all([Image.clearDiskCache(), Image.clearMemoryCache()]);
  } catch (hata) {
    console.warn('[cikis] görsel önbelleği silinemedi:', hata);
  }
}

/**
 * Yerel Google oturumu — yapılmazsa telefon son Google hesabını hatırlar ve sonraki
 * girişte hesap SEÇTİRMEDEN aynı hesabı verebilir. Web'de yerel oturum yok.
 */
export async function googleOturumunuKapat(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    // Tembel yükleme: web paketine girmesin. Yapılandırma dahil (M518 — eskiden
    // `configure()` yapılmadan çağrılıyor ve sessizce düşüyordu).
    const { googleSigninCikis } = require('./googleSignin');
    await googleSigninCikis();
  } catch (hata) {
    console.warn('[cikis] Google oturumu kapatılamadı:', hata);
  }
}
