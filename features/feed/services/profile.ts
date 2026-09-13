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
}

const USERNAME_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

// Worker `src/lib/profileBio.js` ile AYNI sınırlar (T4 · `043`). Yalnızca
// ekrandaki sayaç/uyarı için — gerçek kural sunucuda (`estimateCooldownRetryAt`
// ile aynı duruş).
export const BIO_EN_COK = 160;
export const BIO_EN_COK_SATIR = 3;

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
