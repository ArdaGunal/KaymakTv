import type { NotificationCategoryId } from '../types';
import type { ActivityNotificationType } from '../../../store/notificationStore';

/**
 * İki bildirim listesini TEK bir zaman akışında birleştiren saf katman
 * (docs/design/notifications.md § 11).
 *
 * 🔴 STORE'LAR BİRLEŞMİYOR — yalnızca GÖRÜNÜM birleşiyor. §11'in "iki liste
 * ayrı" kararı yerinde duruyor: `store/notificationStore.ts` sosyal kayıtları
 * (`slug`/`username`/`avatarUrl`) tutmaya, `inbox/useInboxStore.ts` içerik
 * kayıtlarını tutmaya devam ediyor. Burada üretilen `TimelineEntry` bir
 * AYRIMLI BİRLEŞİM (discriminated union): iki tipi tek diziye tıkarken
 * alanlarını KARIŞTIRMIYOR, `kind` ile ayrık tutuyor. O karar tam da
 * "aynı diziye tıkmak tipi bozar" endişesinden doğmuştu; ayrımlı birleşim
 * o endişeyi tip düzeyinde çözer.
 *
 * 🔴 SAF: yalnızca `import type`, çalışma zamanı import'u yok
 * (gerekçe: `scheduling/fireTime.ts` başlığı). Testler bu dosyayı `.ts`
 * uzantısıyla doğrudan import ediyor; buraya çalışma zamanı import'u
 * eklemek Node'un tür soyma yolunu kırar (Madde 298).
 */

/** Bir satırın hangi store'dan geldiği — silme çağrısı buna göre yönlenir. */
export type TimelineKind = 'content' | 'social';

interface TimelineBase {
  /**
   * React `key` ve silme hedefi. Kaynak ÖNEKLİ olmasının sebebi: iki store
   * bağımsız kimlik üretiyor ve `episodeToday:42` gibi bir `identifier` ile
   * `newFollower-ahmet-1757...` gibi bir `id` teorik olarak çakışabilir.
   * Önek çakışmayı YAPISAL olarak imkânsız kılıyor.
   */
  key: string;
  /** Store'a geçilecek HAM kimlik (öneksiz). */
  id: string;
  /** Sıralama ve gruplama anı — epoch ms. */
  at: number;
  read: boolean;
}

export interface ContentEntry extends TimelineBase {
  kind: 'content';
  categoryId: NotificationCategoryId;
  title: string;
  body: string;
  deepLink: string;
}

export interface SocialEntry extends TimelineBase {
  kind: 'social';
  activityType: ActivityNotificationType;
  slug: string;
  username: string;
  name: string | null;
  avatarUrl: string | null;
}

export type TimelineEntry = ContentEntry | SocialEntry;

/**
 * Gruplar sabit sırada: bugün → dün → bu hafta → daha eski.
 *
 * 🔴 "DÜN" AYRI BİR GRUP — canlı önizlemede görüldü (2026-09-06, saat 00:12):
 * gece yarısını yeni geçmişken "2 saat önce" yazan bir satır "Bu hafta"
 * başlığının altında duruyordu. İkisi de doğruydu ama yan yana saçma
 * görünüyordu. Gece yarısı civarı nadir bir an değil — bildirimlerin
 * çoğu akşam düşüyor ve kullanıcı gece uygulamayı açıyor.
 */
export type TimelineGroupId = 'today' | 'yesterday' | 'week' | 'older';

export interface TimelineGroup {
  id: TimelineGroupId;
  entries: TimelineEntry[];
}

/** `useInboxStore`'daki `InboxItem`in bu katmanın gördüğü kadarı. */
interface ContentSource {
  identifier: string;
  categoryId: NotificationCategoryId;
  fireAt: number;
  title: string;
  body: string;
  deepLink: string;
  read: boolean;
}

/** `store/notificationStore.ts`'teki `ActivityNotification`ın gördüğü kadarı. */
interface SocialSource {
  id: string;
  type: ActivityNotificationType;
  slug: string;
  username: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: number;
  read: boolean;
}

/**
 * Yerel takvim gününün başlangıcı.
 *
 * ⚠️ 24 SAATLİK ARİTMETİK KULLANILMADI: kullanıcı için "bugün" takvim
 * günüdür. `now - 24h` ölçüsüyle sabah 09:00'da dün akşam 22:00'de düşen bir
 * bildirim "bugün" grubuna girerdi ve kullanıcı onu bugün gelmiş sanırdı.
 */
function gunBasi(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

const GUN_MS = 24 * 60 * 60 * 1000;

function grupla(at: number, now: number): TimelineGroupId {
  const bugun = gunBasi(now);
  if (at >= bugun) return 'today';
  if (at >= bugun - GUN_MS) return 'yesterday';
  // Son 7 takvim günü (bugün dahil) → "bu hafta".
  if (at >= bugun - 6 * GUN_MS) return 'week';
  return 'older';
}

function icerikten(item: ContentSource): ContentEntry {
  return {
    kind: 'content',
    key: 'c:' + item.identifier,
    id: item.identifier,
    at: item.fireAt,
    read: item.read,
    categoryId: item.categoryId,
    title: item.title,
    body: item.body,
    deepLink: item.deepLink,
  };
}

function sosyalden(item: SocialSource): SocialEntry {
  return {
    kind: 'social',
    key: 's:' + item.id,
    id: item.id,
    at: item.createdAt,
    read: item.read,
    activityType: item.type,
    slug: item.slug,
    username: item.username,
    name: item.name,
    avatarUrl: item.avatarUrl,
  };
}

/**
 * İki listeyi birleştirip tarih gruplarına böler.
 *
 * ⚠️ GELECEK TARİHLİ İÇERİK KAYITLARI ELENİR: saat farkı ya da elle
 * kurcalanmış depolama yüzünden `fireAt > now` olan bir kayıt listeye
 * sızarsa kullanıcıya "henüz olmamış bir şey oldu" gibi görünürdü. Sosyal
 * kayıtlar için böyle bir eleme YOK — onların `createdAt`i cihazın kendi
 * saatiyle, olay olduğu an damgalanıyor, "gelecek" olamaz.
 *
 * ⚠️ BOŞ GRUP DÖNMEZ: ekran başlıkları koşulsuz çizilebilsin diye.
 */
export function buildTimeline(
  content: readonly ContentSource[],
  social: readonly SocialSource[],
  now: number,
): TimelineGroup[] {
  const entries: TimelineEntry[] = [];

  for (const item of content) {
    // Bozuk kayıt (elle kurcalanmış depolama) listeyi çökertmesin.
    if (!item || typeof item.fireAt !== 'number' || Number.isNaN(item.fireAt)) continue;
    if (item.fireAt > now) continue;
    entries.push(icerikten(item));
  }

  for (const item of social) {
    if (!item || typeof item.createdAt !== 'number' || Number.isNaN(item.createdAt)) continue;
    entries.push(sosyalden(item));
  }

  entries.sort((a, b) => b.at - a.at);

  // Sıra SABİT — ekran başlıkları hep aynı düzende çıksın.
  const sira: TimelineGroupId[] = ['today', 'yesterday', 'week', 'older'];
  const kova = new Map<TimelineGroupId, TimelineEntry[]>(sira.map((id) => [id, []]));

  for (const entry of entries) {
    // `sira` tüm grup kimliklerini kapsadığı için bu okuma hep dolu döner;
    // `!` yerine `?? []` kullanmak sessiz bir kayıp kaybına yol açardı.
    const kutu = kova.get(grupla(entry.at, now));
    if (kutu) kutu.push(entry);
  }

  return sira
    .map((id) => ({ id, entries: kova.get(id) ?? [] }))
    .filter((g) => g.entries.length > 0);
}

/** Akıştaki toplam satır sayısı — "Tümünü temizle" düğmesinin görünürlüğü. */
export function timelineCount(groups: readonly TimelineGroup[]): number {
  let toplam = 0;
  for (const g of groups) toplam += g.entries.length;
  return toplam;
}
