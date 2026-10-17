import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Kimlik Faz 5 (M520) — «Trakt'ı bağla» niyeti.
 *
 * Trakt OAuth dönüşü YALNIZ kayıtlı yönlendirme adresine (`kaymak://settings` / web
 * `/settings`) gelir; o da giriş ekranı. Ayarlar → «Trakt'ı bağla» bu niyeti yazar ve giriş
 * ekranına gider; ekran token'ı alınca niyet varsa OTURUM DEĞİŞTİRMEZ, `/bagla`'yı çağırır.
 * Niyet yoksa her şey eskisi gibi (normal Trakt girişi).
 *
 * 🔴 Eskiden Google-only kişi aynı düğmeyle giriş ekranında Trakt'a basınca AYRI bir hesap
 * açılıyordu (plan §1 bölünme yolu 2). Web'de sayfa yeniden yüklendiği için niyet diskte;
 * 15 dk sonra geçersiz; çıkışta zaten silinir (D8 · `cihazAnahtarlariniSil`).
 */
const ANAHTAR = 'kaymak-baglama-niyeti-v1';
export const NIYET_OMRU_MS = 15 * 60 * 1000;

export async function traktBaglamaNiyetiYaz(simdi = Date.now()): Promise<void> {
  await AsyncStorage.setItem(ANAHTAR, JSON.stringify({ tur: 'trakt', zaman: simdi }));
}

/** Niyeti OKUR ve SİLER (tek kullanımlık). Süresi geçmişse yok sayılır. */
export async function traktBaglamaNiyetiTuket(simdi = Date.now()): Promise<boolean> {
  try {
    const ham = await AsyncStorage.getItem(ANAHTAR);
    if (!ham) return false;
    await AsyncStorage.removeItem(ANAHTAR);
    const n = JSON.parse(ham);
    return n?.tur === 'trakt' && typeof n.zaman === 'number' && simdi - n.zaman >= 0 && simdi - n.zaman <= NIYET_OMRU_MS;
  } catch {
    return false;
  }
}

/** Giriş ekranı «bağlama modunda» mı (yalnız gösterim için; tüketmez). */
export async function traktBaglamaNiyetiVarMi(simdi = Date.now()): Promise<boolean> {
  try {
    const ham = await AsyncStorage.getItem(ANAHTAR);
    const n = ham ? JSON.parse(ham) : null;
    return n?.tur === 'trakt' && simdi - n.zaman <= NIYET_OMRU_MS;
  } catch {
    return false;
  }
}
