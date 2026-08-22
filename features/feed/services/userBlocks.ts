import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabaseClient';
import * as SecureStore from '../../../utils/secureStorage';
import { getMyTraktSlug } from '../../../services/api/myIdentity';
import { isKaymakSessionToken } from '../../../services/api/traktClient';
import { getMyProfile } from './profile';
import { CACHE_TTL } from '../../../utils/cacheTTL';

// Kullanıcı Engelleme — KaymakTV'ye özel, Trakt'a hiç dokunmaz (bkz.
// docs/FEED_SOCIAL_PLAN.md §4). Okuma doğrudan Supabase'ten (anon key +
// RLS SELECT — diğer tüm sosyal tablolarla aynı "herkese açık oku,
// görünürlüğü client'ta filtrele" deseni, bkz. feedApi.ts); yazma
// (engelle/kaldır) Worker üzerinden (kimlik doğrulamalı, /feed/block).
const KAYMAK_WORKER_URL = process.env.EXPO_PUBLIC_KAYMAK_WORKER_URL || '';

// ── Kendi Supabase users.id'im ──────────────────────────────────────────
// NOT: feedPublish.ts'teki `resolveMe().id` BU DEĞİL — orası yalnızca
// iyimser kart çizmek için `me-{slug}` sahte bir id kullanıyor.
// `user_blocks.blocker_id`'yi sorgulamak için GERÇEK Supabase uuid'i gerekir.
//
// 🔴 F7 — KİMLİK ARTIK TRAKT'A BAĞLI DEĞİL.
// ESKİ HÂLİ tek yoldan geçiyordu: `getMyTraktSlug()` → Trakt'a HTTP isteği →
// slug → `users` tablosunda ara. Bunun iki sonucu vardı:
//   1. Trakt'ı OLMAYAN bir kullanıcı (F8'in Google girişi) için `getMyTraktSlug()`
//      `null` döner ve kimlik HİÇ çözülemezdi — engelleme, yorum sahipliği
//      ("sil" butonu), inceleme sahipliği ve beğeni durumunun tamamı sessizce
//      çalışmazdı.
//   2. Trakt kesintisinde mevcut kullanıcı da kendi kimliğini kaybediyordu.
//
// `users.id` DEĞİŞMEYEN bir birincil anahtar, dolayısıyla diske yazmak güvenli
// ve TTL gerektirmiyor (`myIdentity.ts`'in slug için kullandığı desenin aynısı).
// Öncelik sırası: bellek → disk → (yalnızca gerekirse) Trakt slug'ı üzerinden
// çözüm. Üçüncü adım geriye uyumluluk içindir: bu sürümden ÖNCE giriş yapmış
// kullanıcıların diskinde henüz id yoktur.
//
// F8'de Google girişi `setMySupabaseUserId()` ile bu değeri doğrudan yazacak
// ve üçüncü adıma hiç düşmeyecek.
const MY_USER_ID_STORAGE_KEY = 'myIdentity.supabaseUserId';

let myUserIdCache: { id: string | null; fetchedAt: number } | null = null;

export function invalidateMySupabaseUserId(): void {
  myUserIdCache = null;
  // Disk kopyası da gitmeli: `AuthContext` bunu ÇIKIŞTA çağırıyor ve kalan
  // bir id, bir sonraki hesabın oturumunda önceki kullanıcının kimliği olarak
  // okunurdu (K2'de bulunan önbellek sınıfının aynısı, kalıcı hâli).
  // Ateşle-ve-unut: `AuthContext` bu fonksiyonu senkron çağırıyor.
  AsyncStorage.removeItem(MY_USER_ID_STORAGE_KEY).catch((error) =>
    console.warn('[userBlocks] users.id diskten silinemedi:', error)
  );
}

/** Kimlik çözüldüğünde (giriş akışı) çağrılır — F8'in Google dalı bunu kullanacak. */
export async function setMySupabaseUserId(id: string): Promise<void> {
  myUserIdCache = { id, fetchedAt: Date.now() };
  try {
    await AsyncStorage.setItem(MY_USER_ID_STORAGE_KEY, id);
  } catch (error) {
    console.warn('[userBlocks] users.id diske yazılamadı:', error);
  }
}

export async function getMySupabaseUserId(): Promise<string | null> {
  if (myUserIdCache && Date.now() - myUserIdCache.fetchedAt < CACHE_TTL.SHORT) {
    return myUserIdCache.id;
  }

  // 1) Disk — sağlayıcıdan bağımsız, ağ gerektirmez.
  try {
    const stored = await AsyncStorage.getItem(MY_USER_ID_STORAGE_KEY);
    if (stored) {
      myUserIdCache = { id: stored, fetchedAt: Date.now() };
      return stored;
    }
  } catch (error) {
    console.warn('[userBlocks] users.id diskten okunamadı:', error);
  }

  // 2) Google-only oturum (`create_new`, Madde 221): Trakt slug'ı HİÇ YOK,
  //    aşağıdaki 3. adım bu kullanıcı için asla sonuç veremez. Kimliği
  //    Worker'ın kimlik doğrulamalı ucundan çöz ve diske yaz.
  //
  //    ⚠️ NEDEN BURADA, giriş akışında değil: giriş akışı (`settings.tsx`)
  //    bunu zaten yazıyor, ama YALNIZCA `create_new`'in çalıştığı İLK kayıtta.
  //    Bu düzeltmeden ÖNCE açılmış Google-only hesapların diskinde değer yok
  //    ve akış onlar için sessizce boş kalırdı. Çözümü tek bir yere (bu
  //    fonksiyona) koymak, her çağıranın kendi başına telafi etmesinden
  //    daha güvenli — "ben kimim" sorusunun TEK cevabı burası.
  const token = await SecureStore.getItemAsync('traktAccessToken');
  if (isKaymakSessionToken(token) && token) {
    try {
      const profile = await getMyProfile(token);
      myUserIdCache = { id: profile.userId, fetchedAt: Date.now() };
      void setMySupabaseUserId(profile.userId);
      return profile.userId;
    } catch (error) {
      console.warn('[userBlocks] Google-only kimlik Worker\'dan çözülemedi:', error);
      return null;
    }
  }

  // 3) Geriye uyumlu yol: Trakt slug'ı üzerinden çöz ve diske yaz, böylece
  //    bir dahaki sefere 1. adım yeterli olur.
  const slug = await getMyTraktSlug();
  if (!slug) return null;
  const { data, error } = await supabase.from('users').select('id').eq('trakt_slug', slug).maybeSingle();
  if (error) throw error;
  const id = data?.id ?? null;
  myUserIdCache = { id, fetchedAt: Date.now() };
  if (id) {
    // Ateşle-ve-unut: çağıranı bekletmeye değmez, başarısızlığı yalnızca bir
    // sonraki çağrının yine Trakt'a gitmesi demek.
    void setMySupabaseUserId(id);
  }
  return id;
}

// ── Engellenen/Engelleyen kümesi ────────────────────────────────────────
// Akış, yorumlar ve Realtime AYNI kümeyi paylaşmalı (bkz.
// docs/FEED_SOCIAL_PLAN.md §4.3) — "ben kimi engelledim" VEYA "beni kim
// engelledi" birleşimi, ikisi de görünürlükte aynı sonucu (karşılıklı
// görünmezlik) doğurur.
let blockedIdsCache: { ids: Set<string>; fetchedAt: number } | null = null;

export function invalidateBlockedUserIds(): void {
  blockedIdsCache = null;
}

export async function getBlockedUserIds(force = false): Promise<Set<string>> {
  if (!force && blockedIdsCache && Date.now() - blockedIdsCache.fetchedAt < CACHE_TTL.SHORT) {
    return blockedIdsCache.ids;
  }

  const myId = await getMySupabaseUserId();
  if (!myId) {
    const empty = new Set<string>();
    blockedIdsCache = { ids: empty, fetchedAt: Date.now() };
    return empty;
  }

  const [blockedByMeRes, blockingMeRes] = await Promise.all([
    supabase.from('user_blocks').select('blocked_id').eq('blocker_id', myId),
    supabase.from('user_blocks').select('blocker_id').eq('blocked_id', myId),
  ]);
  if (blockedByMeRes.error) throw blockedByMeRes.error;
  if (blockingMeRes.error) throw blockingMeRes.error;

  const ids = new Set<string>([
    ...((blockedByMeRes.data ?? []) as { blocked_id: string }[]).map((r) => r.blocked_id),
    ...((blockingMeRes.data ?? []) as { blocker_id: string }[]).map((r) => r.blocker_id),
  ]);
  blockedIdsCache = { ids, fetchedAt: Date.now() };
  return ids;
}

/** Bir Trakt slug'ından Supabase `users.id`'sini çözer — yalnızca o kullanıcı
 *  KaymakTV'yi en az bir kez kullanmışsa (sync/publish tetiklemişse) satırı
 *  vardır; yoksa null (engellenecek/görülecek bir şeyi de yok demektir). */
export async function getUserIdBySlug(traktSlug: string): Promise<string | null> {
  const { data, error } = await supabase.from('users').select('id').eq('trakt_slug', traktSlug).maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

/** Ben BU kişiyi engellemiş miyim (yönlü) — menüde "Engelle" mi "Engeli
 *  Kaldır" mı gösterileceğine karar vermek için. `getBlockedUserIds`'teki
 *  (yönsüz, "engelleyen VEYA engellenen") birleşimden FARKLI bir soru. */
export async function amIBlocking(myUserId: string, targetUserId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_blocks')
    .select('id')
    .eq('blocker_id', myUserId)
    .eq('blocked_id', targetUserId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export interface BlockedUser {
  id: string;
  traktSlug: string;
  username: string;
  avatarUrl: string | null;
  blockedAt: string;
}

// Ayarlar → "Engellenen Kullanıcılar" listesi — yalnızca BEN kimi
// engelledim gösterilir (beni engelleyenlerin listesi kasıtlı olarak
// gösterilmiyor, kullanıcıya "seni kim engelledi" bilgisini vermiyoruz).
export async function getMyBlockedUsers(): Promise<BlockedUser[]> {
  const myId = await getMySupabaseUserId();
  if (!myId) return [];

  // `users`e giden İKİ FK (blocker_id, blocked_id) var — PostgREST'e hangisi
  // olduğunu `!blocked_id` ile açıkça söylüyoruz, aksi halde "belirsiz ilişki"
  // hatası verir.
  const { data, error } = await supabase
    .from('user_blocks')
    .select('created_at, blocked:users!blocked_id(id, trakt_slug, username, avatar_url)')
    .eq('blocker_id', myId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  return ((data ?? []) as any[])
    .filter((row) => row.blocked)
    .map((row) => ({
      id: row.blocked.id,
      traktSlug: row.blocked.trakt_slug,
      username: row.blocked.username,
      avatarUrl: row.blocked.avatar_url,
      blockedAt: row.created_at,
    }));
}

export async function blockUser(traktAccessToken: string, blockedTraktSlug: string): Promise<void> {
  if (!KAYMAK_WORKER_URL) throw new Error('EXPO_PUBLIC_KAYMAK_WORKER_URL tanımlı değil.');
  const response = await axios.post(
    `${KAYMAK_WORKER_URL}/feed/block`,
    { traktAccessToken, blockedTraktSlug },
    { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
  );
  if (!response.data?.success) throw new Error(response.data?.message || 'İşlem başarısız.');
  invalidateBlockedUserIds();
}

export async function unblockUser(traktAccessToken: string, blockedTraktSlug: string): Promise<void> {
  if (!KAYMAK_WORKER_URL) throw new Error('EXPO_PUBLIC_KAYMAK_WORKER_URL tanımlı değil.');
  const response = await axios.post(
    `${KAYMAK_WORKER_URL}/feed/unblock`,
    { traktAccessToken, blockedTraktSlug },
    { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
  );
  if (!response.data?.success) throw new Error(response.data?.message || 'İşlem başarısız.');
  invalidateBlockedUserIds();
}
