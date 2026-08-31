/**
 * Bildirim sisteminin tip sözleşmesi (bkz. docs/design/notifications.md).
 *
 * ⚠️ BU DOSYA `expo-notifications` İMPORT ETMEZ ve etmemelidir. Amaç, saf
 * katmanların (planlayıcılar, `fireTime`, `budget`, `dedupe`, `picker`) Expo runtime'ı
 * hiç yüklemeden `tests/calistir.js` ile test edilebilmesidir. Expo'ya dokunan
 * tek yer `scheduling/scheduler.ts` + `permissions.ts` + `channels.ts` olacak.
 *
 * 🔴 KARIŞTIRMA: `store/notificationStore.ts` BAŞKA bir sistemdir —
 * uygulama-içi aktivite bildirimleri (yeni takipçi / istek onayı), push'suz,
 * AsyncStorage tabanlı ve bu modüle hiç bağlı değil.
 */

/**
 * Bildirim kategorileri.
 *
 * ⛔ BURAYA HENÜZ PLANLAYICISI YAZILMAMIŞ KATEGORİ EKLEME (AI_RULES §2.5).
 * Her yeni id, aynı turda `registry.ts` kaydı + `scheduling/planners/` altında
 * gerçek bir planlayıcı ile birlikte gelir.
 * F2'de eklenecekler: `nowStreaming`.
 *
 * ⛔ `seasonFinale` BİLİNÇLİ OLARAK YOK — ölçüldü, MEVCUT VERİYLE İMKÂNSIZ:
 * bir bölümün sezon finali olduğunu anlamak sezonun toplam bölüm sayısını
 * gerektirir, ama `store/useLibraryStore.ts`'teki `calendarSeasonsMap`
 * AsyncStorage boyut limiti yüzünden yalnızca GELECEK bölümleri saklıyor
 * (bkz. `services/library/fetchers.ts` "VERİ BUDAMA" notu). Eklemek için
 * yeni bir Trakt isteği (`/shows/:id/seasons`) gerekir — ayrı bir karar.
 */
export type NotificationCategoryId =
  | 'episodeToday'
  | 'seasonPremiere'
  | 'movieRelease'
  | 'continueWatching'
  | 'monthlyStats';

/**
 * Android bildirim kanalları (SDK 26+). Kanal AÇILMADAN gönderilen bildirim
 * SESSİZCE YUTULUR — en sık atlanan adım budur.
 *
 * Kategori başına ayrı kanal olmasının sebebi: kullanıcı sistem ayarlarından
 * "sadece prömiyerler açık kalsın" diyebilsin. Tek kanal kullanırsak bu
 * ayrıntı seviyesi kaybolur ve kullanıcının tek seçeneği hepsini kapatmak olur.
 */
export type NotificationChannelId =
  | 'episodes'
  | 'premieres'
  | 'movies'
  | 'reminders'
  | 'digest';

/**
 * Metin havuzunun ton süzgeci (F1). "Mısırları patlat!" bir bölüm bildiriminde
 * hoş; "kaldığın yerden devam" dürtmesinde suçlayıcıya kayar.
 */
export type NotificationTone = 'playful' | 'neutral';

/**
 * Kayıt defterindeki bir kategorinin BİLDİRİMSEL (declarative) tanımı.
 *
 * Planlayıcı fonksiyonu bilinçli olarak BURADA DEĞİL: kaydın saf veri kalması,
 * Ayarlar ekranının tüm planlayıcı kodunu bundle'a çekmeden yalnızca bu diziyi
 * `map`'leyebilmesini sağlıyor. Kategori → planlayıcı eşlemesi zamanlama
 * katmanında (`scheduling/`) yapılır.
 */
export interface NotificationCategoryMeta {
  id: NotificationCategoryId;
  channelId: NotificationChannelId;
  /** Kullanıcı ilk kurulumda bu kategoriyi açık mı bulsun? */
  defaultEnabled: boolean;
  /** Günlük tavan aşıldığında düşük öncelikli olan düşer (F1 `throttle`). */
  priority: number;
  tone: NotificationTone;
  /** Bu kategori en fazla kaç BEKLEYEN bildirim tutabilir (bkz. budget.ts). */
  budget: number;
  /** `locales/{tr,en}/notifications.json` içindeki anahtar kökü. */
  i18nKey: string;
}

/**
 * Bir planlayıcının ürettiği tekil zamanlama niyeti. Henüz kurulmuş bir
 * bildirim DEĞİL — `scheduler.ts` bunları mevcut bekleyenlerle karşılaştırıp
 * yalnızca farkı uygular.
 */
export interface ScheduledPlan {
  /**
   * DETERMİNİSTİK kimlik: `<categoryId>:<entityId>` (ör. `episodeToday:12345`).
   * Aynı bölüm için ikinci bir bildirim kurulmasını YAPISAL olarak imkânsız
   * kılar; "her açılışta hepsini yeniden kur" hatasının panzehiri budur.
   */
  identifier: string;
  categoryId: NotificationCategoryId;
  /**
   * Tetiklenme anı — epoch ms, kullanıcının YEREL saatine göre hesaplanmış.
   * ⚠️ Trakt `first_aired` UTC gelir; dönüşümü planlayıcı yapar, scheduler
   * burada gelen değeri sorgusuz kullanır.
   */
  fireAt: number;
  title: string;
  body: string;
  data: NotificationPayloadData;
}

/**
 * Bildirimin `content.data`'sına gömülen yük. Tıklama yönlendirmesi ve
 * eşleştirme bunun üzerinden yapılır.
 */
export type NotificationPayloadData = {
  categoryId: NotificationCategoryId;
  /** Trakt/TMDB kimliği — `identifier`'ın ikinci parçasıyla aynı değer. */
  entityId: string;
  /**
   * Uygulama içi hedef (ör. `/episode/12345`).
   * 🔴 Bu yol `hooks/useAppBack.ts` üzerinden açılmalı — çıplak `router.push`
   * kullanılırsa Madde 267'de kapatılan "geri tuşu vitrine atıyor" hatası
   * bildirim yoluyla geri gelir (detay ekranı yığının İLK ekranı olur ve
   * `canGoBack()` false döner).
   */
  deepLink: string;
  /**
   * Planlanan tetiklenme anı (epoch ms) — `ScheduledPlan.fireAt`'in kopyası.
   *
   * NEDEN YÜKÜN İÇİNDE TAŞINIYOR: `scheduler` farkı hesaplarken "bu bildirim
   * zaten kurulu mu?" sorusunun yanı sıra "AYNI ANA mı kurulu?" sorusunu da
   * cevaplamak zorunda (bölüm ertelenmiş olabilir, kullanıcı tercih saatini
   * değiştirmiş olabilir). Kurulu bildirimin tetikleyicisinden tarihi geri
   * okumak platformdan platforma değişen bir şekle bağımlı olurdu; kendi
   * yazdığımız bu alan her yerde aynı.
   */
  plannedFireAt: number;
};
// ⚠️ `interface` DEĞİL `type` olması BİLİNÇLİ ve zorunlu: `expo-notifications`
// `content.data` alanını `Record<string, unknown>` olarak tiplemiş.
// TypeScript, type alias'lara örtük indeks imzası verir ama `interface`'lere
// VERMEZ — interface olarak bırakılırsa `scheduler.ts` derlenmez
// (TS2322: "Index signature for type 'string' is missing"). Bunu `as any` ile
// susturmak, yükün şeklini derleyicinin denetiminden tamamen çıkarırdı.

/**
 * Kullanıcı tercihleri — `store/usePushPrefsStore.ts` tarafından AsyncStorage'a
 * yazılır. Supabase'e GİTMEZ: F0–F2 tamamen cihaz-yerel bir sistemdir ve
 * tercihlerin cihaz başına farklı olması (telefonda açık, tablette kapalı)
 * doğru davranıştır.
 */
export interface NotificationPrefs {
  /**
   * Ana anahtar. Kapatıldığında tüm bekleyenler iptal edilir ama `categories`
   * SİLİNMEZ — kullanıcı tekrar açtığında eski ayarları geri gelir.
   */
  masterEnabled: boolean;
  categories: Record<NotificationCategoryId, boolean>;
  /**
   * Spoiler koruması: bildirim, bölümün yayınlandığı saatte değil, kullanıcının
   * seçtiği yerel saatte gönderilir (0-23, varsayılan 20).
   *
   * Sessiz saat ARALIĞI (23:00–09:00) `scheduling/fireTime.ts`'e eklenecek; ikisi
   * aynı mekanizmanın parçasıdır, ayrı sistem yazılmayacak.
   */
  preferredHour: number;
  /**
   * İzin diyaloğunun OTOMATİK olarak bir kez gösterildiği an (epoch ms),
   * hiç gösterilmediyse `null`.
   *
   * 🔴 SONUÇ NE OLURSA OLSUN İŞARETLENİR (izin verildi, reddedildi, hata).
   * Amaç "izin alındı mı" değil, **"bir kez sorduk mu"**. İki gerekçe:
   *   1. iOS'ta bir kez reddedilen izin uygulama içinden BİR DAHA istenemez;
   *      tekrar denemek kullanıcıya hiçbir şey göstermeyen ölü bir çağrıdır.
   *   2. Android'de tekrar sorulabilir — ama her açılışta diyalog gösteren
   *      uygulama kaldırılır. Kullanıcı kararı 2026-08-31: "sürekli sormasın,
   *      zaten her iki platformda da".
   *
   * Kullanıcının Ayarlar'dan bir anahtarı ELLE açması bundan bağımsızdır:
   * o açık bir niyet beyanıdır ve izni yeniden ister (bkz. useNotificationPrefs).
   */
  permissionPromptedAt: number | null;
  /**
   * "Bildirimleri aç" hatırlatma bandının "x" ile kapatıldığı an (epoch ms),
   * hiç kapatılmadıysa `null`. Karar mantığı `promptBanner.ts`'te.
   */
  bannerDismissedAt: number | null;
  /**
   * "Kaldığın yerden devam" dürtmesinin son DÜŞTÜĞÜ an; hiç düşmediyse `null`.
   * Soğuma penceresinin (iki dürtme arası en az N gün) tek kaynağı budur —
   * bkz. `planners/continueWatchingPlanner.ts`.
   */
  lastNudgeFiredAt: number | null;
}

/**
 * İzin durum makinesi. `denied`, uygulama içinden GERİ DÖNÜLEMEZ bir durumdur
 * (iOS'ta bir kez reddedilen izin tekrar istenemez) — bu yüzden ayrı bir durum
 * olarak taşınıyor ve kullanıcı cihaz ayarlarına yönlendiriliyor.
 *
 * `unsupported`: YALNIZCA web (`expo-notifications` orada no-op).
 * ⚠️ Emülatör/simülatör `unsupported` DEĞİLDİR — yerel bildirimler orada
 * sorunsuz çalışır. `Device.isDevice` kontrolü yalnızca F3'teki push TOKEN'ı
 * için gerekli olacak; yerel zamanlamayı ona bağlamak, geliştirmenin tamamını
 * gereksiz yere gerçek cihaza mahkûm ederdi.
 *
 * Sessizce yutmak YASAK (AI_RULES) — Ayarlar ekranı bu durumu kullanıcıya
 * açıkça yazar.
 */
export type NotificationPermissionStatus =
  | 'unsupported'
  | 'undetermined'
  | 'granted'
  | 'denied';
