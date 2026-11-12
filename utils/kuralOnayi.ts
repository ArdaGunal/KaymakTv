/**
 * TOPLULUK KURALLARI ONAYI — saf çekirdek (YAYIN_ONCESI_PLAN Adım 4b, M609).
 *
 * Google Play UGC politikası: kullanıcı içerik oluşturmadan ÖNCE kuralları kabul etmiş
 * olmalı. Kayıt sunucuda (`users.kurallar_onay_surumu`, Worker `/account/kurallar-onay`);
 * burası yalnız sürüm sabitini, cihaz önbelleğinin biçimini ve kararları taşır.
 * Yan etkili kısım: `services/kuralOnayiKapisi.ts`.
 *
 * 🔴 `KURALLAR_SURUMU` Worker'daki (`src/lib/kurallar.js`) sabitle AYNI olmalı. Kural
 * metni (`locales/<dil>/legal.json` → `rulesSections`) anlamca değişince ikisi birlikte
 * artırılır; eski onaylar geçersiz kalır ve pencere yeniden çıkar. Bu yüzden «kabul
 * etti» boole değil, sürüm numarasıdır.
 */
export const KURALLAR_SURUMU = 1;

/** Cihazda: bu hesabın sunucuda kayıtlı onay sürümü. Çıkışta silinir (izin listesinde DEĞİL). */
export const KURAL_ONAYI_ANAHTARI = '@kaymak_kural_onayi_v1';
/** Cihazda: giriş ekranındaki kutunun işaretlendiği sürüm; ilk içerik yazımında sunucuya gider. */
export const KURAL_ONAYI_BEKLEYEN_ANAHTARI = '@kaymak_kural_onayi_bekleyen_v1';

export function onayGecerliMi(surum: unknown): boolean {
  return typeof surum === 'number' && Number.isInteger(surum) && surum >= KURALLAR_SURUMU;
}

/** AsyncStorage dizgisi → sürüm. Boş/bozuk kayıt `null` (onay yok sayılır). */
export function onaySurumuCoz(ham: string | null | undefined): number | null {
  if (!ham) return null;
  const n = Number(ham);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export type OnayYazimSonucu =
  /** Sunucu kaydetti. */
  | 'kaydedildi'
  /** Worker'da uç yok (eski Worker): onay bu oturumda geçerli sayılır, diske YAZILMAZ. */
  | 'uc_yok'
  /** Worker daha yeni bir kural sürümünde: bu istemcinin metni eski, onay yazılamaz. */
  | 'surum_eski'
  | 'hata';

/**
 * Yazma isteğinin HTTP sonucundan karar.
 *
 * `uc_yok`: 404 + gövdede `code` yok = rota tanımsız. Kural: Worker istemciden önce
 * yayınlanır; yine de sıra bozulursa kullanıcı içerik yazamaz hâle gelmemeli. Uç gelince
 * bir sonraki oturumda kayıt yeniden denenir (diske yazılmadığı için).
 */
export function onayYazimKarari(durum: number | undefined, govde: any): OnayYazimSonucu {
  if (durum !== undefined && durum >= 200 && durum < 300 && govde?.success === true && govde?.onayli === true) {
    return 'kaydedildi';
  }
  if (durum === 409 && govde?.code === 'surum_eski') return 'surum_eski';
  if (durum === 404 && !govde?.code) return 'uc_yok';
  return 'hata';
}

/**
 * Hangi profil yaması kural onayı ister: yalnız başkalarının göreceği METNİ yazan
 * (kullanıcı adı, görünen ad, açıklama). Silme (`null`), fotoğraf kaldırma ve ad onayı
 * (`adOnayla`) istemez.
 */
export function profilYamasiOnayIsterMi(
  yama: { username?: string; bio?: string | null; displayName?: string | null } | null | undefined,
): boolean {
  const dolu = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
  return dolu(yama?.username) || dolu(yama?.bio) || dolu(yama?.displayName);
}
