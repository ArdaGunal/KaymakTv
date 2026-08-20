import axios from 'axios';

// KaymakTV'ye özel gizlilik ayarları — Trakt'taki `private` ayarından
// BAĞIMSIZ (bkz. docs/feed.md). Okuma da yazma da artık Worker üzerinden
// (kimlik doğrulamalı, /feed/privacy/get + /feed/privacy) — F11/Y15: bu
// alanlar eskiden anon key ile doğrudan `users`'tan okunuyordu, `028`
// migration'ı bu okumayı GRANT'tan kaldırdığı için taşındı (bkz.
// docs/HISTORY.md).
//
// NOT: ÜÇ alan var, ayrı bir "her şeyi gizle" sütunu YOK. "Her Şeyi Gizle"
// UI'da bu üçünden TÜRETİLİR (bkz. useFeedPrivacy.ts) — ayrı bir DB bayrağı,
// diğerleriyle senkron dışı kalıp çelişkili bir duruma (ör. "gizle" açık ama
// "izlediklerimi paylaş" da açık) yol açardı. Bu, `008_drop_feed_hidden.sql`
// ile alınan kararın aynısıdır ve korunuyor.
//
// Üçü AYRIK kümeleri yönetir — hiçbiri diğerinin gerçeğini tutmaz:
//   publishWatches → watched_episode, watched_movie   (kapatılınca SİLİNİR)
//   publishRatings → rated                            (kapatılınca SİLİNİR)
//   publishManual  → reviewed, posted                 (kapatılınca GİZLENİR)
//
// Üçüncüsünün silme YERİNE gizleme olmasının gerekçesi: elle yazılan içerik
// hiçbir yerden yeniden üretilemez (Madde 165). Ayrıntı ve mekanizma:
// docs/FEED_VISIBILITY_PLAN.md.
const KAYMAK_WORKER_URL = process.env.EXPO_PUBLIC_KAYMAK_WORKER_URL || '';

export interface FeedPrivacySettings {
  publishWatches: boolean;
  publishRatings: boolean;
  /** İnceleme ve gönderiler akışta görünsün mü (021). */
  publishManual: boolean;
}

export async function getFeedPrivacySettings(traktAccessToken: string): Promise<FeedPrivacySettings> {
  if (!KAYMAK_WORKER_URL) throw new Error('EXPO_PUBLIC_KAYMAK_WORKER_URL tanımlı değil.');
  const response = await axios.post(
    `${KAYMAK_WORKER_URL}/feed/privacy/get`,
    { traktAccessToken },
    { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
  );
  if (!response.data?.success) {
    throw new Error(response.data?.message || 'Ayarlar okunamadı.');
  }
  // `?? true`: satır bulunamadıysa (ör. henüz senkron olmamış yeni kullanıcı)
  // GÖRÜNÜR varsay — bir kullanıcının içeriğini, ayarını hiç vermediği
  // hâlde gizlemek yanlış olurdu (eski anon-key okumasının aynı gerekçesi).
  const settings = response.data?.settings ?? {};
  return {
    publishWatches: settings.publishWatches ?? true,
    publishRatings: settings.publishRatings ?? true,
    publishManual: settings.publishManual ?? true,
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
