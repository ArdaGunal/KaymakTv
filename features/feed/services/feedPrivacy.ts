import axios from 'axios';
import { supabase } from './supabaseClient';

// KaymakTV'ye özel gizlilik ayarları — Trakt'taki `private` ayarından
// BAĞIMSIZ (bkz. docs/feed.md). Okuma doğrudan Supabase'ten (anon key +
// RLS SELECT, salt okunur, kimlik doğrulama gerekmiyor); yazma Worker
// üzerinden (kimlik doğrulamalı, /feed/privacy).
//
// NOT: Bilinçli olarak yalnızca İKİ alan — ayrı bir "her şeyi gizle" sütunu
// yok. "Her Şeyi Gizle" UI'da bu ikisinden TÜRETİLİR (bkz. useFeedPrivacy.ts)
// — üçüncü bir DB bayrağı, ikisiyle senkron dışı kalıp çelişkili bir duruma
// (ör. "gizle" açık ama "izlediklerimi paylaş" da açık) yol açabilirdi.
const KAYMAK_WORKER_URL = process.env.EXPO_PUBLIC_KAYMAK_WORKER_URL || '';

export interface FeedPrivacySettings {
  publishWatches: boolean;
  publishRatings: boolean;
}

export async function getFeedPrivacySettings(traktSlug: string): Promise<FeedPrivacySettings> {
  const { data, error } = await supabase
    .from('users')
    .select('publish_watches, publish_ratings')
    .eq('trakt_slug', traktSlug)
    .maybeSingle();
  if (error) throw error;
  return {
    publishWatches: data?.publish_watches ?? true,
    publishRatings: data?.publish_ratings ?? true,
  };
}

export async function updateFeedPrivacy(
  traktAccessToken: string,
  patch: Partial<FeedPrivacySettings>
): Promise<void> {
  if (!KAYMAK_WORKER_URL) throw new Error('EXPO_PUBLIC_KAYMAK_WORKER_URL tanımlı değil.');
  const response = await axios.post(
    `${KAYMAK_WORKER_URL}/feed/privacy`,
    { traktAccessToken, patch },
    { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
  );
  if (!response.data?.success) {
    throw new Error(response.data?.message || 'İşlem başarısız.');
  }
}
