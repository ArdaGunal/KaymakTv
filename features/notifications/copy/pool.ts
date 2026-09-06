import type { NotificationCategoryId, NotificationTone } from '../types';

/**
 * Gömülü metin havuzu (docs/design/notifications.md § 4).
 *
 * 🔴 SAF: yalnızca `import type`.
 *
 * AMAÇ: bildirim metinleri sabit olmasın. Aynı cümleyi her hafta görmek,
 * bildirimi kapattıran şeylerin başında gelir.
 *
 * ═══════════════════════════════════════════════════════════════════════
 *  ➕ YENİ VARYANT EKLEMEK — 2 dosya, 3 satır
 * ═══════════════════════════════════════════════════════════════════════
 *  1. Aşağıdaki `POOL_BY_CATEGORY` içinde DOĞRU kategorinin listesine
 *     bir satır ekle:   { id: 'yeniId', weight: 1, tone: 'playful' }
 *  2. `locales/tr/notifications.json` VE `locales/en/notifications.json`
 *     içine `copy.<kategori>.<id>.title` + `.body` anahtarlarını ekle
 *  3. `npm run test:bildirim`
 *
 *  ➖ SİLMEK: satırı ve iki çeviri bloğunu kaldır. Kullanıcının geçmişinde o
 *     id kalmış olabilir; `picker` bilinmeyen id'leri sessizce yok sayar.
 *
 *  🛡️ Çeviriyi unutursan test KALIR ve eksik anahtarları isim isim söyler.
 *     Ters yön de denetleniyor: havuzda karşılığı olmayan ÖLÜ çeviri de kalır.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * ⚠️ METİN BURADA DEĞİL, i18n DOSYALARINDA. Havuz yalnızca *hangi varyantlar
 * var ve ne zaman geçerli* bilgisini tutar. Anahtarlar kuraldan türetilir
 * (`copy.<category>.<id>.title`), ayrıca yazılmaz — iki yerde tutulan bir
 * anahtar er geç ıraksar.
 *
 * 📅 Uzak havuz (`remotePool.ts`) bu listeyi DEĞİŞTİRMEZ, onunla BİRLEŞİR —
 * uzak havuz çekilemediğinde (çevrimdışı, ilk açılış) burası her zaman elde
 * kalan yedektir.
 */

/** `POOL_BY_CATEGORY` içindeki satırların şekli — `category` alanı YOK. */
export interface CategoryVariant {
  /** Kalıcı kimlik. Değiştirme — "son gösterilenler" geçmişi buna dayanıyor. */
  id: string;
  /** Ağırlıklı seçim. 1 = normal, 2 = iki kat sık, 0 = etkin biçimde kapalı. */
  weight: number;
  tone: NotificationTone;
  /**
   * Mevsimsel pencere — 'AA-GG' biçiminde, YIL YOK (her yıl tekrarlar).
   * İkisi de verilmezse varyant her zaman geçerlidir.
   * Yıl sınırını aşan pencereler desteklenir (ör. 12-20 → 01-05).
   */
  activeFrom?: string;
  activeUntil?: string;
}

/** Havuzda dolaşan tam kayıt — kategori bilgisi eklenmiş hali. */
export interface CopyVariant extends CategoryVariant {
  category: NotificationCategoryId;
  /**
   * Uzak havuzdan gelen varyantlarda METİN doğrudan burada durur — i18n
   * dosyalarına yazılamazlar, çünkü APK güncellemesi olmadan ekleniyorlar.
   * Gömülü varyantlarda `undefined`; metin i18n anahtarından gelir.
   */
  text?: { title: string; body: string };
}

/**
 * 🔑 KATEGORİYE GÖRE GRUPLANMIŞ HAVUZ — düzenlenecek yer BURASI.
 *
 * `Record<NotificationCategoryId, …>` olması bilinçli: yeni bir kategori
 * eklendiğinde buraya da liste açmayı unutursan **derleme kırılır**. Aynı
 * koruma `notification-settings.tsx` ve `TimelineRow.tsx` ikon haritalarında
 * da var ve bu oturumda iki kez gerçekten işe yaradı.
 */
export const POOL_BY_CATEGORY: Record<NotificationCategoryId, readonly CategoryVariant[]> = {
  // ── Bugün Yayında ────────────────────────────────────────────────────
  episodeToday: [
    { id: 'popcorn', weight: 1, tone: 'playful' },
    { id: 'tonight', weight: 1, tone: 'playful' },
    { id: 'fresh', weight: 1, tone: 'playful' },
    { id: 'remote', weight: 1, tone: 'playful' },
    // Sade/nötr bir seçenek: havuzun tamamı şakacı olursa ton tek düze olur
    // ve esprili varyantlar da yıpranır.
    { id: 'plain', weight: 1, tone: 'neutral' },
    // Mevsimsel örnek + mekanizmanın canlı kanıtı. Yıl sınırını aşıyor.
    { id: 'newYear', weight: 2, tone: 'playful', activeFrom: '12-20', activeUntil: '01-05' },
  ],

  // ── Sezon Prömiyeri — kullanıcının aylardır beklediği haber ──────────
  seasonPremiere: [
    { id: 'bigNews', weight: 1, tone: 'playful' },
    { id: 'longWait', weight: 1, tone: 'playful' },
    { id: 'plainPremiere', weight: 1, tone: 'neutral' },
  ],

  // ── Film Çıkışı ──────────────────────────────────────────────────────
  // ⚠️ Metinler "vizyona girdi" demeli, "izleyebilirsin" DEĞİL — Trakt takvimi
  // sinema vizyonunu verir, dijital erişilebilirliği değil
  // (bkz. planners/movieReleasePlanner.ts başlığı).
  movieRelease: [
    { id: 'inTheaters', weight: 1, tone: 'playful' },
    { id: 'plainMovie', weight: 1, tone: 'neutral' },
  ],

  // ── Kaldığın Yerden Devam ────────────────────────────────────────────
  // ⚠️ YALNIZCA nötr varyant. Kategori tonu `neutral` olduğu için şakacı bir
  // varyant zaten SEÇİLMEZ (ton tavanı, bkz. picker.ts) — eklersen ölü veri
  // olur. Sebebi ürünsel: dürtmede şakacı metin sitem gibi okunur.
  continueWatching: [
    { id: 'pickUp', weight: 1, tone: 'neutral' },
    { id: 'story', weight: 1, tone: 'neutral' },
  ],

  // ── Aylık İzleme Özeti ───────────────────────────────────────────────
  // Rakamlar GERÇEK (bkz. stats/snapshot.ts) — metinler abartı içermemeli.
  monthlyStats: [
    { id: 'hours', weight: 1, tone: 'playful' },
    { id: 'melting', weight: 1, tone: 'playful' },
    { id: 'plainStats', weight: 1, tone: 'neutral' },
  ],

  // ── Sosyal (F3) — BİLEREK BOŞ ─────────────────────────────────────────
  // 🔴 Bu kategorinin metni SUNUCUDAN geliyor (Worker `/feed/comment` ve
  // `/feed/like` gövdeyi kendisi yazıyor: "X aktivitene yorum yaptı").
  // Yerel bir varyant havuzu olsaydı hiç kullanılmazdı.
  //
  // ⚠️ `Record` yine de tam tutuluyor (yukarıdaki gerekçe: eksik kategori
  // derlemeyi kırsın). Boş liste burada bir ihmal değil, BİLGİ: "bu
  // kategorinin yerel metni yok".
  social: [],
};

/**
 * Düzleştirilmiş havuz — `picker` ve testler bunu kullanır.
 * Gruplu tanımdan TÜRETİLİR; iki listeyi elle senkron tutmak gerekmez.
 */
export const COPY_POOL: readonly CopyVariant[] = (
  Object.entries(POOL_BY_CATEGORY) as [NotificationCategoryId, readonly CategoryVariant[]][]
).flatMap(([category, variants]) => variants.map((variant) => ({ ...variant, category })));

/** i18n anahtarları kuraldan türer — havuzda ayrıca tutulmaz. */
export function variantTitleKey(variant: CopyVariant): string {
  return `copy.${variant.category}.${variant.id}.title`;
}

export function variantBodyKey(variant: CopyVariant): string {
  return `copy.${variant.category}.${variant.id}.body`;
}
