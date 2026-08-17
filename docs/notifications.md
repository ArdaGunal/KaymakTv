# KaymakTV Bildirim (Notification) Sistemi — Tasarım & Yol Haritası

**Son Güncelleme:** 2026-08-16
**Durum:** 📝 Planlama — henüz hiç gerçek push kodu yok. Bu doküman **hangi sırayla** kurulacağını tarif eder; tasarımın tamamı geçerlidir.

> ⚠️ **2026-08-16 GÜNCELLEMESİ — "mevcut iskelet" ARTIK YOK.**
> Bu doküman boyunca "iskelet zaten var, içi doldurulacak" diye anılan **beş dosya
> SİLİNDİ** (`features/notifications/` altındaki `types.ts`, `hooks/useNotifications.ts`,
> `services/{expoPush,webPush,notificationApi}.ts` — bkz. `docs/HISTORY.md` Madde 165).
>
> **Neden:** hepsi `return null` / `console.log` döndüren, **hiçbir yerden import
> edilmeyen** TODO stub'larıydı — `docs/AI_RULES.md` §2.5'in açıkça yasakladığı
> "ileride lazım olur diye bağlanmamış kod". Kayıp özellik değildi; tasarım zaten
> BU dokümanda duruyor ve 14 satırlık stub'ları iş gerçekten yapıldığında yeniden
> yazmak önemsiz.
>
> **Ne DURUYOR (canlı ve çalışıyor):** `features/notifications/components/NotificationBadge.tsx`
> + `store/notificationStore.ts` + `app/(protected)/notifications.tsx` — bunlar
> istemci-tarafı "aktivite bildirimleri" (yeni takipçi / istek onayı) için gerçek,
> push'suz bir sistemdir ve push işine hiç bağlı değildir.
>
> Aşağıdaki "mevcut iskelet" ifadelerini **"oluşturulacak dosya"** diye okuyun;
> önerilen dosya AYRIMI (mobil/web/api ayrı dosyalar) hâlâ doğru yaklaşımdır.

---

## 📌 Özet

KaymakTV'ye push bildirim ekliyoruz. İki platform için **ayrı token stratejisi**, tek bir Supabase tablosu ve mevcut `kaymaktv-feedback-worker` Cloudflare Worker'ına eklenecek yeni uç noktalarla çalışacak. Feed sisteminde olduğu gibi (`docs/feed.md`), Supabase yalnızca **okuma/depolama**, gerçek yazma işlemleri Worker'ın `service_role` anahtarıyla yapılır — bu proje Supabase Auth kullanmadığı için istemciden doğrudan yazma güvenli değildir.

**Kritik bir mimari gerçek en baştan söylenmeli:** Trakt'ın webhook'u yok (bkz. `docs/feed.md` § Notlar). Yani "biri az önce şunu yaptı" bilgisini gerçek zamanlı öğrenebileceğimiz TEK an, o eylem **bizim kendi uygulamamızın içinden** geçtiği andır. Trakt.tv'nin kendi sitesinde/uygulamasında yapılan bir eylemi (ör. birini trakt.tv üzerinden takip etmek) anlık yakalayamayız — ancak periyodik senkronizasyonla (bkz. Faz 2) sonradan fark edebiliriz. Bu doküman boyunca hangi bildirim türünün "gerçek zamanlı" hangisinin "gecikmeli/periyodik" olduğu açıkça ayrılıyor.

---

## 🎯 Amaç & Kapsam

### Faz 1: Temel Altyapı + KaymakTV-içi Tetiklenen Bildirimler
- ✅ Token alma + kayıt altyapısı (mobil: Expo Push, web: VAPID/Web Push)
- ✅ Supabase `push_tokens` tablosu + Worker `/notifications/register`, `/notifications/unregister`
- ✅ Worker'da tek bir gönderim yardımcı fonksiyonu (`dispatchNotification`) — Expo Push API + Web Push API'yi saran ortak katman
- ✅ İlk gerçek tetikleyici: **"X seni takip etmeye başladı" / "Takip isteğin onaylandı"** — yalnızca eylem KaymakTV içinden (Trakt'a bizim `follow`/`unfollow` çağrımızla) yapıldığında anlık tetiklenir

### Faz 2: Periyodik/İçerik Bildirimleri (Ertelendi)
- ⏳ "Takip ettiğin biri seni trakt.tv'de takip etti" (bizim dışımızda olan olay — yalnızca periyodik diff ile fark edilebilir)
- ⏳ "İzlediğin dizinin yeni bölümü yayınlandı" — Trakt calendar/progress API'siyle cron tabanlı polling gerektirir, N kullanıcı × M dizi ölçeğinde rate-limit riski taşır, ayrı bir tasarım gerektirir
- ⏳ Bildirim tercihleri ekranı (Ayarlar'da hangi bildirim türü açık/kapalı — `feedPrivacy.ts`'teki `publish_watches`/`publish_ratings` anahtarlarıyla AYNI desen)
- ⏳ Uygulama içi bildirim listesi ekranı (`/notifications` route'u, rozete tıklayınca gidilecek gerçek hedef)

### Kapsam Dışı (Şimdilik)
- ❌ Kendi FCM/APNs sertifikalarımızı yönetmek — Expo'nun kendi push servisi (`exp.host`) araya girdiği için buna gerek yok, `EAS projectId` yeterli
- ❌ Gerçek zamanlı (WebSocket/Supabase Realtime) anlık teslim — push bildirim zaten kendi teslim kanalını taşıyor, ayrı bir realtime katmana gerek yok

---

## 🏗️ Mimari Kararlar

### 1️⃣ Gerekli Kütüphaneler

| Paket | Platform | Neden |
|---|---|---|
| `expo-notifications` | Mobil (iOS/Android) | Token alma, izin isteme, bildirim gösterme/kanal yönetimi — Expo'nun resmi push API'si |
| `expo-device` | Mobil | `Device.isDevice` kontrolü şart — **simülatör/emülatörde push token alınamaz**, kontrolsüz çağrı anlaşılmaz bir hata fırlatır |
| *(yeni paket gerekmiyor)* | Web | Web Push, tarayıcının yerleşik `Service Worker` + `PushManager` API'leriyle çalışır — `web-push` gibi bir kütüphane yalnızca **sunucu (Worker) tarafında**, VAPID imzalı istek göndermek için gerekir (npm paketi değil, Cloudflare Worker'da Web Crypto API ile elle VAPID JWT imzalamak gerekecek — `web-push` npm paketi Node'a bağımlı, Workers ortamında çalışmaz, bkz. § 3 Backend) |

`package.json`'da şu an **hiçbiri kurulu değil** — ilk implementasyon adımı `npx expo install expo-notifications expo-device` olacak.

`app.json`'da eksik olup eklenmesi gereken:
```json
{
  "expo": {
    "plugins": [
      "expo-router",
      "expo-secure-store",
      ["expo-notifications", {
        "icon": "./assets/notification-icon.png",
        "color": "#3b82f6"
      }]
    ],
    "android": {
      "package": "com.ardagnl.kaymak"
    },
    "extra": {
      "eas": { "projectId": "<EAS_PROJECT_ID>" }
    }
  }
}
```
`extra.eas.projectId` **olmadan** `Notifications.getExpoPushTokenAsync()` çalışmaz (SDK 54'te zorunlu parametre) — `eas init` ile proje EAS'a bağlanıp `projectId` alınmalı. Bu, kod yazmadan önce **kullanıcının** (hesap sahibi olarak) yapması gereken tek dışsal adım.

### 2️⃣ Token Alma Stratejisi — Platform Ayrımı

Mevcut iskelet zaten doğru dosya ayrımını öngörmüş (`services/expoPush.ts` / `services/webPush.ts`), gerçek implementasyon bu dosyaların içini dolduracak:

**Mobil (`expoPush.ts`):**
1. `Device.isDevice` değilse (simülatör) sessizce `null` dön — hata fırlatma.
2. `Notifications.getPermissionsAsync()` ile mevcut izni kontrol et; `undetermined` ise `Notifications.requestPermissionsAsync()` ile iste. **Reddedilirse** `docs/AI_RULES.md § Sessiz başarısızlık YASAKTIR` gereği kullanıcıya görünür bir geri bildirim ver (ör. Ayarlar'da "Bildirimler kapalı, cihaz ayarlarından açabilirsin" satırı) — sessizce `null` dönüp hiçbir şey söylememek yasak.
3. Android'de **kanal zorunlu** (SDK 26+): `Notifications.setNotificationChannelAsync('default', { name: 'Genel', importance: AndroidImportance.DEFAULT })` — bu çağrılmadan bildirim hiç görünmez, sessizce yutulur (en sık atlanan adım).
4. `Notifications.getExpoPushTokenAsync({ projectId: Constants.expoConfig.extra.eas.projectId })` ile token al.
5. `{ token, platform: Platform.OS as 'ios' | 'android' }` döndür — mevcut `PushToken` tipiyle zaten uyumlu.

**Web (`webPush.ts`):**
1. `'serviceWorker' in navigator && 'PushManager' in window` değilse `null` dön (Safari eski sürümler, vb.).
2. Bir Service Worker dosyası (`public/sw.js` veya Expo Web'in `web/` çıktı dizini — projenin web build yapısına göre netleştirilecek) kayıt edilmeli: `navigator.serviceWorker.register('/sw.js')`.
3. `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VAPID_PUBLIC_KEY })` — `VAPID_PUBLIC_KEY` **public** bir değerdir, `EXPO_PUBLIC_VAPID_PUBLIC_KEY` olarak `.env`'e eklenebilir (private key ASLA client'a gömülmez, yalnızca Worker'da).
4. Dönen `PushSubscription` nesnesi (`{endpoint, keys: {p256dh, auth}}`) — bu bir string token DEĞİL, bir JSON nesnesi. `PushToken` tipi bunu taşıyacak şekilde genişletilmeli (bkz. § 4 Tip Değişikliği).
5. `sw.js` içinde bir `push` event listener'ı bildirim payload'ını (`title`, `body`, `data`) alıp `self.registration.showNotification(...)` ile gösterecek — bu dosya React Native/Expo kod tabanının dışında, düz bir statik JS dosyası olarak `public/`'e (veya web export dizinine) eklenmeli.

**`useNotifications.ts` hook'u** (şu an tamamen boş/yorum satırı) bu iki fonksiyonu `Platform.OS`'a göre çağırıp sonucu `notificationApi.ts`'teki `registerPushToken`'a geçirecek — mevcut `if (!accessToken || isGuest) return` deseni (bkz. `useFeedSyncTrigger.ts`, `useMyTraktProfile.ts`) burada da **zorunlu**: misafir kullanıcı için push token hiç istenmemeli/kaydedilmemeli.

### 3️⃣ Backend Stratejisi

**Supabase şeması (yeni migration `011_push_tokens.sql`):**
```sql
CREATE TABLE push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  -- Mobil: Expo push token (string). Web: PushSubscription JSON'ı
  -- ({endpoint, keys}) — tek bir TEXT kolonu yerine JSONB kullanmak,
  -- iki farklı "token" şeklini (string vs nesne) tek tabloda ayrı
  -- kolon ikiye bölmeden taşımayı sağlıyor.
  token JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Aynı cihaz aynı token'ı tekrar kaydederse (app her açılışta register
  -- edebilir) yeni satır değil, `updated_at` güncellemesi olsun.
  UNIQUE (user_id, platform, token)
);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "push_tokens_select_none" ON push_tokens FOR SELECT USING (false);
-- Diğer tablolardan FARKLI olarak: push token'lar SELECT için bile public
-- olmamalı (feed_activities gibi "herkese açık okunabilir" değil, kişisel
-- bir cihaz kimliği). Yazma zaten yalnızca Worker'ın service_role'üyle,
-- RLS bypass ederek yapılıyor — bkz. 001_feed_schema.sql'deki genel not.
```
`(user_id, platform, token)` üzerinde UNIQUE olması, bir kullanıcının **birden fazla cihazı** (telefon + web) olabileceğini bilerek destekliyor — `feed_activities`'teki `users` FK deseniyle birebir aynı ilişki modeli.

**Worker uç noktaları (`kaymaktv-feedback-worker/src/index.js`'e eklenecek, mevcut path-bazlı routing'e — `if (pathname === "/feed/sync") ...` deseni — yeni satırlar):**
- `POST /notifications/register` — `{ traktAccessToken, platform, token }`. `handleFeedSync`'teki gibi önce `GET /users/settings` ile token doğrulanıp kullanıcı kimliği (`users` tablosundaki `id`) bulunur, sonra `push_tokens`'a upsert edilir. **Guest/token'sız istek reddedilir.**
- `POST /notifications/unregister` — çıkış yapıldığında (mevcut `AuthContext.removeKeys()`'e bağlanacak) o cihazın token'ını siler — aksi halde çıkış yapmış/hesap değiştirmiş bir kullanıcının cihazına eski hesabın bildirimleri gitmeye devam eder (tıpkı bu oturumda düzeltilen `followStore.reset()` sızıntısının bildirim karşılığı — aynı hataya buradan düşülmemeli).
- Ortak bir `dispatchNotification(env, userId, payload)` yardımcı fonksiyonu — `push_tokens`'tan o `userId`'ye ait TÜM satırları çeker, platform'a göre ikiye ayırır:
  - **Mobil (`ios`/`android`):** Expo'nun `https://exp.host/--/api/v2/push/send` uç noktasına tek bir HTTP isteğiyle (token başına ayrı istek DEĞİL, Expo toplu gönderimi destekliyor) POST atar. Ekstra bir gizli anahtar/servis hesabı gerekmez — Expo push service anonim/keysiz çalışır (opsiyonel bir `EXPO_ACCESS_TOKEN` ile rate-limit önceliklendirmesi yapılabilir, Faz 1'de gerekmiyor).
  - **Web:** Her `PushSubscription` için VAPID-imzalı bir Web Push isteği (`endpoint`'e POST). Cloudflare Workers Node.js `web-push` paketini çalıştıramadığından bu adım Web Crypto API (`crypto.subtle`) ile elle VAPID JWT (ES256) imzalama gerektirir — bu, Faz 1'in EN karmaşık tekil parçası, ayrı bir alt görev olarak zaman ayrılmalı (referans: [RFC 8292](https://www.rfc-editor.org/rfc/rfc8292), `web-push` npm paketinin kaynağı Workers'a taşınabilir bir referans implementasyon olarak incelenebilir, paketin kendisi değil).
- Geçersiz/süresi dolmuş token'lar: Expo Push API yanıtında `DeviceNotRegistered` hatası dönerse (veya Web Push 410 Gone dönerse) o satır `push_tokens`'tan silinmeli — aksi halde tablo zamanla ölü token'larla şişer ve her gönderimde gereksiz başarısız istek atılır.

### 4️⃣ `PushToken` Tipinin Genişletilmesi

Mevcut `features/notifications/types.ts`:
```ts
export interface PushToken {
  token: string;
  platform: 'web' | 'ios' | 'android';
}
```
Web Push'un token'ı bir **string değil**, `{endpoint, keys: {p256dh, auth}}` nesnesi olduğundan bu tip gerçek implementasyonda genişlemeli:
```ts
export type PushToken =
  | { platform: 'ios' | 'android'; token: string }
  | { platform: 'web'; token: PushSubscriptionJSON };
```
Bu, Faz 1 kodlamaya başlarken ilk yapılacak küçük ama kritik bir düzeltme — şu anki tip mobil varsayımıyla yazılmış, web'i unutmuş.

### 5️⃣ Hangi Aksiyonlar Bildirim Üretecek? (Tetikleyici Taslağı)

| # | Bildirim | Tetikleyici | Gerçek-zamanlı mı? | Faz |
|---|---|---|---|---|
| 1 | "**@X** seni takip etmeye başladı" | `hooks/useFollowState.ts`'teki `toggleFollow` başarıyla `following` durumuna geçtiğinde (bkz. `followTraktUser` sonrası `actualState === 'following'`), client Worker'a `POST /notifications/register`'dan AYRI bir `POST /notifications/trigger-follow` (veya register endpoint'ine benzer, kimlik doğrulamalı) isteğiyle "ben X'i takip ettim" bilgisini geçer, Worker hedef kullanıcının `push_tokens`'ına bildirim yollar | ✅ Evet — olay bizim istemcimizde gerçekleşiyor | 1 |
| 2 | "**@X** takip isteğini onayladı" | Gizli hesap onayı **KaymakTV dışında** (trakt.tv'de) da yapılabildiğinden, yalnızca istek onaylayan kişi de KaymakTV kullanıyorsa VE KaymakTV üzerinden onaylıyorsa (şu an uygulamada gelen istekleri onaylama arayüzü de yok — bkz. Açık Sorular) gerçek zamanlı yakalanabilir. Aksi halde bu, bir sonraki `followStore.fetchFollowingSlugs()` periyodik yenilemesinde (bkz. `docs/HISTORY.md` madde 115) SESSİZCE state güncellenir, bildirim olarak DEĞİL | ⚠️ Kısmi | 1 (kısmi) / 2 (tam) |
| 3 | "**@X** dizinin yeni bölümü yayınlandı" | Cron/polling — Trakt calendar API + kullanıcının izleme listesi karşılaştırması | ❌ Hayır, periyodik | 2 |
| 4 | "**@X** trakt.tv'de seni takip etti" (KaymakTV dışı takip) | Periyodik takipçi listesi diff'i | ❌ Hayır, periyodik | 2 |

**Neden #1 önce?** Tek gerçek zamanlı, tek yönlü ve teknik olarak basit senaryo bu — olay zaten bizim `followTraktUser` çağrımızın başarı yanıtında elimizde. Diğer her şey (özellikle #3, #4) ya periyodik altyapı ya da Trakt'ta hiç var olmayan bir "gelen istekleri KaymakTV içinde onayla" akışı gerektiriyor.

---

## 🗄️ Katman Planı (Mevcut Mimariyle Uyum)

`docs/ARCHITECTURE.md`'deki katman ayrımına birebir uyacak şekilde:
- **UI:** `features/notifications/components/NotificationBadge.tsx` (var, düzeltildi) + ileride `/notifications` ekranı
- **Business Logic (Hooks):** `features/notifications/hooks/useNotifications.ts` — token alma/kaydetme orkestrasyon
- **Servis/Veri:** `features/notifications/services/{expoPush,webPush,notificationApi}.ts` (iskelet zaten doğru ayrılmış, içi dolduruluyor)
- **State:** `store/notificationStore.ts` — yalnızca `unreadCount` (gösterim state'i); token'ların kendisi state'te TUTULMAZ, alınır-kaydedilir-unutulur (tekrar gerektiğinde yeniden istenir)

---

## 📊 Status Tracker

| Adım | Durum |
|---|---|
| Bu doküman (tasarım) | ✅ Tamamlandı |
| Sahte `unreadCount` test kodu temizliği | ✅ Tamamlandı (bkz. `docs/HISTORY.md`) |
| `expo-notifications` + `expo-device` kurulumu | ⏳ Yapılacak |
| `app.json` plugin + `eas.projectId` | ⏳ Yapılacak — **kullanıcı** `eas init` çalıştırmalı |
| `expoPush.ts` gerçek implementasyon | ⏳ Yapılacak |
| `webPush.ts` + Service Worker dosyası | ⏳ Yapılacak |
| `PushToken` tipinin web için genişletilmesi | ⏳ Yapılacak |
| `011_push_tokens.sql` migration | ⏳ Yapılacak |
| Worker `/notifications/register` + `/unregister` | ⏳ Yapılacak |
| Worker `dispatchNotification` (Expo tarafı) | ⏳ Yapılacak |
| Worker `dispatchNotification` (Web/VAPID tarafı) | ⏳ Yapılacak — en karmaşık parça |
| Tetikleyici #1 (yeni takipçi bildirimi) | ⏳ Yapılacak |
| Ayarlar'da bildirim izni/durum satırı | ⏳ Yapılacak |
| `/notifications` listesi ekranı | ⏳ Faz 2 |
| Tetikleyici #2-4 | ⏳ Faz 2 |

---

## ❓ Açık Sorular (Kodlamaya Başlamadan Önce Karar Verilmeli)

1. **EAS projesi var mı?** `eas.projectId` olmadan mobil token hiç alınamaz — projenin bir Expo/EAS hesabına bağlı olup olmadığı netleşmeli.
2. **VAPID key çifti kim üretecek?** `npx web-push generate-vapid-keys` ile tek seferlik üretilip public key `.env`'e (`EXPO_PUBLIC_VAPID_PUBLIC_KEY`), private key Worker'ın `wrangler secret`'ına eklenmeli.
3. **Web Service Worker dosyası nereye konacak?** Expo Web export'unun statik dosya sunma yapısı (`public/` klasörü var mı, `app.json`'da `web.build` ayarları) netleştirilmeli — SW dosyası kök path'te (`/sw.js`) servis edilmezse `pushManager.subscribe` çalışmaz.
4. **"Gelen takip isteklerini onayla" arayüzü KaymakTV içinde hiç yok** — şu an yalnızca `POST /follow` (istek gönderme) var, Trakt'ın `GET /users/requests` (gelen istekler) ve onay uç noktaları hiç kullanılmıyor. Tetikleyici #2'nin tam (gerçek zamanlı) versiyonu için bu ayrı bir özellik olarak önce inşa edilmeli.
5. **Bildirim gönderim hacmi arttıkça Expo Push API rate limit'i** (Trakt API'sindekine benzer bir devre kesici gerekebilir mi?) — Faz 1'de tek kullanıcıya tek bildirim ölçeğinde önemsiz, Faz 2'de (toplu "yeni bölüm" bildirimleri) yeniden değerlendirilmeli.

---

## 📚 İlgili Dosyalar

- `features/notifications/{types.ts, hooks/, services/, components/}` — mevcut iskelet
- `store/notificationStore.ts` — `unreadCount` state'i
- `context/AuthContext.tsx` — `removeKeys()` (çıkışta token unregister edilecek yer)
- `docs/feed.md` — aynı Supabase+Worker deseninin canlı, doğrulanmış bir örneği (birebir taklit edilecek mimari referans)
- `docs/HISTORY.md` — tamamlanan her adımın kaydı
- `kaymaktv-feedback-worker/src/index.js` (`C:\Yapay_Zeka_Uygulamalar\kaymaktv-feedback-worker`) — yeni uç noktaların ekleneceği dosya
- `supabase/schema/*.sql` — veritabanı migration'ları
