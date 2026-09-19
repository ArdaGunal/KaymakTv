import axios from 'axios';

// Profil güncelleme (kullanıcı adı + Google profil fotoğrafı kabul/red) —
// Google-only kullanıcı onboarding'i VE Ayarlar/Hesap'tan sonraki
// düzenlemeler AYNI ucu kullanır (bkz. Worker'daki handleAccountProfile).
// Aynı KAYMAK_WORKER_URL deseni — bkz. accountDeletion.ts/feedPrivacy.ts.
const KAYMAK_WORKER_URL = process.env.EXPO_PUBLIC_KAYMAK_WORKER_URL || '';

export interface UpdateProfilePatch {
  /** Verilmezse dokunulmaz. Sunucu trim'ler, 1-30 karakter sınırı var. */
  username?: string;
  /** `null` = fotoğrafı kaldır, `undefined` = dokunma. Yalnızca https:// kabul edilir. */
  avatarUrl?: string | null;
  /** T4 · `043`. `null` = açıklamayı kaldır, `undefined` = dokunma. Sunucu normalize eder. */
  bio?: string | null;
  /** §C24 · `053`. `null` = görünen adı kaldır, `undefined` = dokunma. Sunucu normalize eder. */
  displayName?: string | null;
}

export interface MyProfile {
  /** Supabase `users.id` — Google-only kullanıcı için kimliğin TEK kalıcı kaynağı. */
  userId: string;
  username: string;
  avatarUrl: string | null;
  /** ISO string veya `null` — hiç değiştirilmemişse `null` (kilit yok). */
  usernameUpdatedAt: string | null;
  /** T4 · `043`. `null` = hiç yazılmamış. */
  bio: string | null;
  /** §C24 · `053`. `null` = yok → arayüz @username gösterir. */
  displayName: string | null;
}

const USERNAME_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

// Worker `src/lib/profileBio.js` ile AYNI sınırlar (T4 · `043`). Yalnızca
// ekrandaki sayaç/uyarı için — gerçek kural sunucuda (`estimateCooldownRetryAt`
// ile aynı duruş).
export const BIO_EN_COK = 160;
export const BIO_EN_COK_SATIR = 3;

// Worker `src/lib/usernameRules.js` ile AYNI kural (§S3/§S12, M402): YENİ ya
// da DEĞİŞEN kullanıcı adı yalnız [A-Za-z0-9_], 3–30. Burası yalnız GÖSTERGE —
// ayrılmış adlar (`me`, `admin`…) bilinçli olarak kopyalanmadı; sunucu reddeder
// ve mesajı ekranda görünür (iki yerde yaşayan bir liste ıraksardı).
export const KULLANICI_ADI_EN_AZ = 3;
export const KULLANICI_ADI_EN_COK = 30;
export type KullaniciAdiSorunu = 'kisa' | 'uzun' | 'karakter';

export function kullaniciAdiSorunu(ham: string): KullaniciAdiSorunu | null {
  const deger = ham.trim();
  if (deger.length < KULLANICI_ADI_EN_AZ) return 'kisa';
  if (deger.length > KULLANICI_ADI_EN_COK) return 'uzun';
  if (!/^[A-Za-z0-9_]+$/.test(deger) || !/[A-Za-z0-9]/.test(deger)) return 'karakter';
  return null;
}

// Worker `src/lib/profileDisplayName.js` ile AYNI sınır (§C24 · `053`).
export const AD_EN_COK = 50;

/**
 * Görünen adın sunucu normalizasyonunun GÖSTERGE kopyası: TEK satır, iç boşluk
 * tekilleşir, uzunluk KOD NOKTASI. Görünmez karakter temizliği yalnızca sunucuda.
 */
export function adOnizle(ham: string): { deger: string; uzunluk: number } {
  const deger = ham.replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim();
  return { deger, uzunluk: Array.from(deger).length };
}

/**
 * Sunucu normalizasyonunun GÖSTERGE kopyası: boş satırlar atılır, iç boşluk
 * tekilleşir, uzunluk KOD NOKTASI sayılır (emoji 1). ⚠️ Görünmez karakter
 * temizliği yalnızca sunucuda — sayaç en kötü ihtimalle birkaç fazla gösterir.
 */
export function bioOnizle(ham: string): { deger: string; uzunluk: number; satir: number } {
  const satirlar = ham
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((s) => s.replace(/[ \t]+/g, ' ').trim())
    .filter((s) => s.length > 0);
  const deger = satirlar.join('\n');
  return { deger, uzunluk: Array.from(deger).length, satir: satirlar.length };
}

/**
 * `usernameUpdatedAt` verilince cooldown hâlâ aktifse bitiş `Date`'ini,
 * değilse `null` döner. Worker'daki `usernameCooldownRetryAt`'in İSTEMCİ
 * tarafındaki eşleniği — yalnızca EKRANDA butonu önceden pasif göstermek
 * için (kaba kuvvet gösterge), gerçek kural sunucuda: bu fonksiyon yanılsa
 * bile `updateProfile` sunucu tarafında yine 403/`cooldown` ile reddeder.
 */
export function estimateCooldownRetryAt(usernameUpdatedAt: string | null): Date | null {
  if (!usernameUpdatedAt) return null;
  const retryAt = new Date(new Date(usernameUpdatedAt).getTime() + USERNAME_COOLDOWN_MS);
  return retryAt > new Date() ? retryAt : null;
}

export async function getMyProfile(traktAccessToken: string): Promise<MyProfile> {
  if (!KAYMAK_WORKER_URL) throw new Error('EXPO_PUBLIC_KAYMAK_WORKER_URL tanımlı değil.');
  const response = await axios.post(
    `${KAYMAK_WORKER_URL}/account/profile/get`,
    { traktAccessToken },
    { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
  );
  if (!response.data?.success) {
    throw new Error(response.data?.message || 'Profil okunamadı.');
  }
  return {
    userId: response.data.userId,
    username: response.data.username,
    avatarUrl: response.data.avatarUrl ?? null,
    usernameUpdatedAt: response.data.usernameUpdatedAt ?? null,
    bio: response.data.bio ?? null,
    displayName: response.data.displayName ?? null,
  };
}

export class ProfileUpdateError extends Error {
  code?: 'taken' | 'cooldown';
  retryAt?: string;
  constructor(message: string, code?: 'taken' | 'cooldown', retryAt?: string) {
    super(message);
    this.code = code;
    this.retryAt = retryAt;
  }
}

export async function updateProfile(traktAccessToken: string, patch: UpdateProfilePatch): Promise<void> {
  if (!KAYMAK_WORKER_URL) throw new Error('EXPO_PUBLIC_KAYMAK_WORKER_URL tanımlı değil.');
  let response;
  try {
    response = await axios.post(
      `${KAYMAK_WORKER_URL}/account/profile`,
      { traktAccessToken, ...patch },
      { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
    );
  } catch (error: any) {
    // Worker hata durumlarında da JSON gövde döner (`{success:false, code, message}`)
    // — axios 4xx/5xx'i exception'a çeviriyor ama gövde `error.response.data`'da duruyor.
    // (bkz. services/api/googleAuth.ts'teki aynı desen.)
    if (error?.response?.data) {
      response = error.response;
    } else {
      throw error;
    }
  }
  if (!response.data?.success) {
    throw new ProfileUpdateError(
      response.data?.message || 'İşlem başarısız.',
      response.data?.code,
      response.data?.retryAt
    );
  }
}
