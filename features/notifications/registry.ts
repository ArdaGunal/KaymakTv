import type {
  NotificationCategoryId,
  NotificationCategoryMeta,
  NotificationPrefs,
} from './types';

/**
 * 🔑 KATEGORİ KAYIT DEFTERİ — bildirim sisteminin tek gerçek kaynağı.
 * (Tasarım: docs/design/notifications.md § 3)
 *
 * Bu diziyi İKİ yer gezer:
 *   1. Ayarlar › Bildirimler ekranı — satırları buradan üretir
 *   2. Zamanlama katmanı — hangi kategorilerin planlanacağını buradan okur
 *
 * Sonuç: yeni bir bildirim türü eklemek = buraya BİR kayıt + `planners/` altına
 * BİR saf fonksiyon. Ayarlar arayüzüne de orkestrasyona da DOKUNULMAZ.
 *
 * ⛔ PLANLAYICISI OLMAYAN KATEGORİ EKLEME. Bir kayıt burada durup da onu
 * planlayan kod yoksa, kullanıcı Ayarlar'da hiçbir şey yapmayan bir anahtar
 * görür — AI_RULES §2.5'in yasakladığı "bağlanmamış kod"un en kötü türü,
 * çünkü sessizce yalan söyler. F1/F2 kategorileri kendi turlarında eklenecek.
 *
 * ⚠️ Planlayıcı fonksiyonu bilinçli olarak bu kayıtta DEĞİL (bkz. types.ts
 * `NotificationCategoryMeta` notu): kayıt saf veri kalsın ki Ayarlar ekranı
 * tüm planlayıcı kodunu bundle'a çekmesin.
 */
export const NOTIFICATION_CATEGORIES: readonly NotificationCategoryMeta[] = [
  {
    id: 'episodeToday',
    channelId: 'episodes',
    // Kullanıcı uygulamayı ZATEN bunun için indirdi — içerik bildirimleri
    // varsayılan olarak açık gelir. (Dürtme ve istatistik kategorileri F2'de
    // varsayılan KAPALI eklenecek; ayrım bilinçli.)
    defaultEnabled: true,
    priority: 10,
    tone: 'playful',
    // iOS'un 64 bekleyen bildirim tavanı altında kalmak için kategori kotası
    // (bkz. retention/budget.ts). 30 bölüm ≈ 30 günlük ufukta yoğun bir
    // takip listesini karşılar.
    budget: 30,
    i18nKey: 'categories.episodeToday',
  },
  {
    id: 'seasonPremiere',
    channelId: 'premieres',
    defaultEnabled: true,
    // 🔑 `episodeToday`'den YÜKSEK. Bir sezon prömiyeri her iki planlayıcının
    // da kapsamına girer; `retention/dedupe.ts` çakışmayı bu önceliğe göre
    // çözer ve kullanıcı aynı bölüm için iki bildirim almaz.
    priority: 20,
    tone: 'playful',
    // Prömiyerler seyrek: 30 günlük ufukta 10 kota fazlasıyla yeter ve
    // `episodeToday`'in genel tavanı yemesini engeller.
    budget: 10,
    i18nKey: 'categories.seasonPremiere',
  },
  {
    id: 'movieRelease',
    channelId: 'movies',
    defaultEnabled: true,
    priority: 15,
    tone: 'playful',
    budget: 10,
    i18nKey: 'categories.movieRelease',
  },
  {
    id: 'continueWatching',
    channelId: 'reminders',
    // 🔴 VARSAYILAN KAPALI. Kullanıcının açık talebi: "bunun rahatsız edici
    // olmasını istemiyorum". İçerik bildirimleri (kullanıcı uygulamayı bunun
    // için indirdi) açık gelir; DÜRTME gelmez — isteyen açar.
    defaultEnabled: false,
    // En düşük öncelik: günlük tavan aşılırsa ilk bu düşmeli. Bir dürtme,
    // gerçek bir yayın haberinin önüne asla geçmemeli.
    priority: 5,
    // 🔑 NEUTRAL ŞART: şakacı bir metin ("hâlâ mı izlemedin?") dürtmede
    // kullanıcıya sitem ediyormuş gibi okunur (bkz. copy/picker.ts ton tavanı).
    tone: 'neutral',
    // Aynı anda yalnızca TEK dürtme bekler — kullanıcı tek bir yerde kalmıştır.
    budget: 1,
    i18nKey: 'categories.continueWatching',
  },
  {
    id: 'monthlyStats',
    channelId: 'digest',
    // Dürtme gibi bu da varsayılan KAPALI: kullanıcı uygulamayı içerik
    // bildirimleri için indirdi, kendi hakkında rapor için değil.
    defaultEnabled: false,
    priority: 8,
    // Kutlayıcı bir rapor — şakacı ton uygun. Nötr varyantlar da seçilebilir
    // (ton bir TAVAN, bkz. copy/picker.ts).
    tone: 'playful',
    // Ayda bir, tek bildirim.
    budget: 1,
    i18nKey: 'categories.monthlyStats',
  },
] as const;

/** Kayıt defterini id ile aramak için — dizide `find` tekrarını önler. */
export function getCategoryMeta(
  id: NotificationCategoryId,
): NotificationCategoryMeta | undefined {
  return NOTIFICATION_CATEGORIES.find((category) => category.id === id);
}

/**
 * Kurulumda kullanılacak varsayılan tercihler — kayıt defterinden TÜRETİLİR,
 * elle yazılmaz. Yeni kategori eklendiğinde varsayılanı güncellemeyi unutmak
 * bu sayede imkânsız.
 */
export function buildDefaultPrefs(): NotificationPrefs {
  const categories = {} as Record<NotificationCategoryId, boolean>;
  for (const category of NOTIFICATION_CATEGORIES) {
    categories[category.id] = category.defaultEnabled;
  }

  return {
    masterEnabled: true,
    categories,
    // Spoiler koruması: bölüm sabah 04:00'te yayınlansa bile bildirim akşam
    // 20:00'de gider. Yayın saatinde göndermek, kullanıcının henüz izlemediği
    // bir bölümü iş/okul saatinde spoiler riskiyle önüne koymak demek.
    preferredHour: 20,
    // Henüz sorulmadı — ilk açılışta bir kez sorulacak (bkz. types.ts).
    permissionPromptedAt: null,
    bannerDismissedAt: null,
    lastNudgeFiredAt: null,
  };
}

/**
 * Diskten okunan tercihleri kayıt defteriyle uzlaştırır.
 *
 * NEDEN GEREKLİ: kullanıcı v1'de tercihlerini kaydetti, v2'de yeni bir
 * kategori eklendi. Kaydedilmiş nesnede o anahtar YOK. Uzlaştırmazsak
 * `prefs.categories[yeniKategori]` `undefined` döner ve kategori sessizce
 * kapalı davranır — kullanıcı Ayarlar'da "açık" görürken bildirim almaz.
 *
 * Aynı şekilde kaldırılan kategorilerin artıkları da burada temizlenir.
 */
export function reconcilePrefs(stored: Partial<NotificationPrefs> | null): NotificationPrefs {
  const defaults = buildDefaultPrefs();
  if (!stored) return defaults;

  const categories = {} as Record<NotificationCategoryId, boolean>;
  for (const category of NOTIFICATION_CATEGORIES) {
    const savedValue = stored.categories?.[category.id];
    categories[category.id] =
      typeof savedValue === 'boolean' ? savedValue : category.defaultEnabled;
  }

  // Bozuk/elle kurcalanmış bir saat değeri tüm zamanlamayı sessizce
  // bozabilirdi (NaN bir Date'i Invalid Date yapar) — sınır dışındaysa
  // varsayılana düşülür.
  const storedHour = stored.preferredHour;
  const preferredHour =
    typeof storedHour === 'number' && Number.isInteger(storedHour) && storedHour >= 0 && storedHour <= 23
      ? storedHour
      : defaults.preferredHour;

  // 🔴 `permissionPromptedAt` VARSAYILANA DÖNMEMELİ. Bozuk/eksik bir değeri
  // `null` saymak "hiç sormadık" demektir ve kullanıcıya izin diyaloğunu
  // TEKRAR gösterirdi — düzeltmeye çalıştığımız davranışın ta kendisi.
  // Bu yüzden yalnızca gerçekten sayı olan bir değer korunur; başka her şey
  // (undefined dahil) "henüz sorulmadı" sayılır, ki ilk kurulumda doğrudur.
  const storedPromptedAt = stored.permissionPromptedAt;
  const permissionPromptedAt =
    typeof storedPromptedAt === 'number' && Number.isFinite(storedPromptedAt)
      ? storedPromptedAt
      : null;

  const storedDismissedAt = stored.bannerDismissedAt;
  const bannerDismissedAt =
    typeof storedDismissedAt === 'number' && Number.isFinite(storedDismissedAt)
      ? storedDismissedAt
      : null;

  // Soğuma penceresinin dayanağı. Kaybolursa kullanıcı arka arkaya dürtülür.
  const storedNudgeAt = stored.lastNudgeFiredAt;
  const lastNudgeFiredAt =
    typeof storedNudgeAt === 'number' && Number.isFinite(storedNudgeAt) ? storedNudgeAt : null;

  return {
    masterEnabled:
      typeof stored.masterEnabled === 'boolean' ? stored.masterEnabled : defaults.masterEnabled,
    categories,
    preferredHour,
    permissionPromptedAt,
    bannerDismissedAt,
    lastNudgeFiredAt,
  };
}

/**
 * O an gerçekten planlanması gereken kategoriler.
 * Ana anahtar kapalıysa hiçbiri — çağıranların bu iki koşulu ayrı ayrı
 * kontrol etmesine gerek kalmasın diye tek yerde birleştirildi.
 */
export function getActiveCategories(
  prefs: NotificationPrefs,
): readonly NotificationCategoryMeta[] {
  if (!prefs.masterEnabled) return [];
  return NOTIFICATION_CATEGORIES.filter((category) => prefs.categories[category.id]);
}
