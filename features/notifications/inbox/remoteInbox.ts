import type { LedgerEntry } from './sweep';
import type { NotificationCategoryId } from '../types';

/**
 * UZAK (sunucu) bildirimlerini uygulama içi kutuya sokan SAF karar katmanı
 * (docs/design/notifications.md § 11).
 *
 * ==========================================================================
 * 🔴 ÇÖZÜLEN SORUN — Madde 301'de bulundu, kullanıcı henüz göremedi
 * ==========================================================================
 * `useInboxStore.ingest()`'in TEK çağrısı yerel defter süpürmesiydi. Yani
 * sosyal push'lar (yorum/beğeni) kutuya **hiç girmiyordu**. Üstelik tepsi
 * temizliği (`retention/cleanup.ts`) `social`'ı BİZİM kategorimiz saydığı
 * için uygulama açılışında tepsiden de siliyordu — bildirim tamamen
 * kayboluyordu.
 *
 * 🔑 NEDEN DEFTER (ledger) YAKLAŞIMI BURADA İŞE YARAMIYOR: defter, "biz ne
 * kurduk" bilgisinin kopyasıdır. Uzak bildirimi biz kurmuyoruz — sunucu
 * gönderiyor ve cihaz ne zaman alacağını önceden bilmiyor. Bu yüzden uzak
 * taraf ÜÇ kaynaktan toplanıyor ve `identifier` ile tekilleştiriliyor:
 *
 *   1. `addNotificationReceivedListener` → uygulama ÖNDEYKEN gelenler
 *   2. `getPresentedNotificationsAsync()` → açılışta tepside HÂLÂ duranlar
 *   3. Tıklama yanıtı (soğuk başlangıç dahil) → kullanıcının bastığı
 *
 * ⛔ **BİLİNEN BOŞLUK, kabul edildi:** uygulama kapalıyken düşen bir uzak
 * bildirimi kullanıcı tepsiden KAYDIRIP ATARSA hiçbir kaynağa yakalanmaz ve
 * kutuya girmez. Kapatmanın tek yolu sunucuda bir bildirim günlüğü tutup
 * açılışta çekmek — F3 dilim 2'nin kapsamı dışında bırakıldı (yeni tablo +
 * yeni uç + okuma politikası demek). Yerel bildirimlerde bu boşluk YOK,
 * çünkü orada defter var.
 *
 * 🔴 SAF: yalnızca `import type`, çalışma zamanı import'u yok
 * (gerekçe: `inbox/sweep.ts` ve `retention/cleanupRules.ts` başlıkları).
 */

/** Bir uzak bildirimden kutu kaydı üretmek için gereken asgari bilgi. */
export interface RemoteNotificationInfo {
  /** `expo-notifications`'ın `request.identifier`'ı — tekilleştirme anahtarı. */
  identifier: string;
  title?: unknown;
  body?: unknown;
  /** `content.data` — ham, doğrulanmamış. */
  data?: unknown;
  /** Bildirimin cihaza ulaştığı an (epoch ms). */
  receivedAt?: unknown;
}

/**
 * Yükten uygulama içi hedefi çözer.
 *
 * 🔴 `deepLink` ARTIK SUNUCUDAN GELİYOR (Worker `/feed/comment` ve
 * `/feed/like`). Madde 301'de ölçüldü: gelmiyordu ve `useNotificationTap`
 * "/" ile başlamayan yükte sessizce çıktığı için tıklama HİÇBİR ŞEY
 * yapmıyordu.
 *
 * ⚠️ GERİYE DÖNÜK DAL: Worker güncellenmeden ÖNCE gönderilmiş, hâlâ tepside
 * duran bildirimler `deepLink` taşımıyor. Onlar için `activityId`'den
 * türetiliyor.
 *
 * 🔴 `targetId`'DEN TÜREMİYOR — bilerek. Eski beğeni yükü `targetId`
 * gönderiyor ama `targetType`'ı GÖNDERMİYOR; hedef bir aktivite de olabilir
 * bir YORUM da. Yorumsa `/activity/<targetId>` YANLIŞ bir yola götürürdü.
 * Yanlış yere gitmektense hiçbir yere gitmemek doğrusu.
 */
export function resolveDeepLink(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;

  const link = d.deepLink;
  if (typeof link === 'string' && link.startsWith('/')) return link;

  const activityId = d.activityId;
  if (typeof activityId === 'string' && activityId.length > 0) {
    return `/activity/${activityId}`;
  }
  return null;
}

/**
 * Bildirim tarihini epoch ms'e normalize eder.
 *
 * ⚠️ Platformlar arasında saniye/milisaniye farkı görülebiliyor. 1e12'den
 * küçük bir değer (≈ 2001) makul bir ms damgası olamaz, saniye kabul edilip
 * çarpılıyor. Hiç okunamıyorsa çağıranın verdiği `now` kullanılıyor —
 * tarihsiz bir kayıt gruplamayı bozardı.
 */
function normalizeAt(raw: unknown, now: number): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return now;
  return raw < 1e12 ? raw * 1000 : raw;
}

function asText(raw: unknown): string {
  return typeof raw === 'string' ? raw : '';
}

/**
 * Tek bir uzak bildirimi kutu kaydına çevirir; uygun değilse `null`.
 *
 * 🔴 `remoteCategoryIds` PARAMETRE, modül seviyesinde `registry`'den
 * OKUNMUYOR — bu dosya saf kalsın diye (`cleanupRules.ts` ile aynı desen).
 * Yalnızca `kind: 'remote'` kategoriler geçiyor: yerel kategoriler kutuya
 * ZATEN defterden giriyor ve buradan da almak mükerrer bir yol açardı.
 */
export function remoteToEntry(
  info: RemoteNotificationInfo,
  remoteCategoryIds: ReadonlySet<string>,
  now: number,
): LedgerEntry | null {
  if (!info || typeof info.identifier !== 'string' || info.identifier.length === 0) return null;

  const data = (info.data && typeof info.data === 'object' ? info.data : {}) as Record<string, unknown>;
  const categoryId = data.categoryId;
  if (typeof categoryId !== 'string' || !remoteCategoryIds.has(categoryId)) return null;

  const title = asText(info.title);
  const body = asText(info.body);
  // Başlıksız VE gövdesiz bir kayıt listede boş bir satır olarak görünürdü.
  if (!title && !body) return null;

  return {
    identifier: info.identifier,
    categoryId: categoryId as NotificationCategoryId,
    fireAt: normalizeAt(info.receivedAt, now),
    title,
    body,
    // 🔴 BOŞ DİZGE, `null` DEĞİL: `LedgerEntry.deepLink` zorunlu `string`.
    // `TimelineRow` "/" ile başlamayan yolu zaten kullanmıyor, yani hedefi
    // çözülemeyen bir bildirim listede GÖRÜNÜR ama tıklanınca bir yere
    // gitmez — kaybolmasından iyidir.
    deepLink: resolveDeepLink(data) ?? '',
  };
}

/**
 * Bir listeyi kutu kayıtlarına çevirir; uygun olmayanları eler ve
 * `identifier`e göre tekilleştirir.
 *
 * ⚠️ TEKİLLEŞTİRME BURADA DA VAR (`mergeIntoInbox` zaten yapıyor olsa bile):
 * üç kaynak aynı turda aynı bildirimi verebiliyor ve store'a mükerrer kayıt
 * göndermek gereksiz bir yazma turu demek.
 */
export function remoteEntries(
  list: readonly RemoteNotificationInfo[],
  remoteCategoryIds: ReadonlySet<string>,
  now: number,
): LedgerEntry[] {
  const cikti: LedgerEntry[] = [];
  const gorulen = new Set<string>();

  for (const info of list) {
    const entry = remoteToEntry(info, remoteCategoryIds, now);
    if (!entry) continue;
    if (gorulen.has(entry.identifier)) continue;
    gorulen.add(entry.identifier);
    cikti.push(entry);
  }

  // En yeni başta — `useInboxStore.ingest` sırayı koruyarak listenin başına
  // ekliyor.
  cikti.sort((a, b) => b.fireAt - a.fireAt);
  return cikti;
}
