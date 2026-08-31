import type { NotificationCategoryId, NotificationTone } from '../types';
import type { CopyVariant } from './pool';

/**
 * Supabase'ten gelen metin satırlarının DOĞRULANMASI ve gömülü havuzla
 * BİRLEŞTİRİLMESİ (docs/design/notifications.md § 15).
 *
 * 🔴 SAF: yalnızca `import type`. Ağ/depolama işi `remotePool.ts`'te.
 *
 * 🔴 GÜVENLİK DURUŞU — uzak havuz gömülü metni EZEMEZ:
 * Aynı (kategori, id) ikilisine sahip bir uzak satır, gömülü varyantın
 * METNİNİ değiştiremez; yalnızca `weight` değerini uygulayabilir. Böylece
 * yanlışlıkla ya da kötü niyetle eklenmiş bir satır, denetlenmiş bir metnin
 * yerine geçemez.
 *
 * ✅ Bunun bıraktığı kapı bilinçli: `weight: 0` göndererek gömülü bir varyant
 * UZAKTAN SUSTURULABİLİR. Yani "kötü çıkan bir metni APK beklemeden kaldır"
 * ihtiyacı karşılanıyor, ama "metni uzaktan değiştir" yetkisi verilmiyor.
 */

/** Uzak satırın doğrulanmış hali — iki dilin metnini birlikte taşır. */
export interface RemoteVariant {
  id: string;
  category: NotificationCategoryId;
  weight: number;
  tone: NotificationTone;
  activeFrom?: string;
  activeUntil?: string;
  text: { tr: { title: string; body: string }; en: { title: string; body: string } };
}

const ID_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;
const MONTH_DAY = /^\d{2}-\d{2}$/;

const metin = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

/**
 * Ham satırları süzer. **Tek bir bozuk satır tüm havuzu düşürmemeli** —
 * geçersiz kayıt sessizce atlanır, geçerliler kullanılmaya devam eder.
 *
 * @param allowedCategories Kayıt defterindeki kategori kimlikleri. Parametre
 *   olarak geçiyor ki bu modül saf kalsın (registry'yi import etmiyor).
 */
export function parseRemoteVariants(
  rows: readonly unknown[],
  allowedCategories: readonly NotificationCategoryId[],
): RemoteVariant[] {
  const allowed = new Set<string>(allowedCategories);
  const result: RemoteVariant[] = [];
  const seen = new Set<string>();

  for (const raw of rows) {
    const row = raw as Record<string, unknown>;
    const id = metin(row?.id);
    const category = metin(row?.category);
    const tone = metin(row?.tone);

    if (!id || !ID_PATTERN.test(id)) continue;
    // Tanımadığımız kategori: kayıt defterinde yoksa hiçbir planlayıcı onu
    // kullanmaz; sessizce atlamak yerine almak yalnızca çöp biriktirirdi.
    if (!category || !allowed.has(category)) continue;
    if (tone !== 'playful' && tone !== 'neutral') continue;

    // Aynı satır iki kez gelirse (elle kurcalanmış veri) ilki geçerli.
    const key = `${category}:${id}`;
    if (seen.has(key)) continue;

    const weightRaw = row?.weight;
    const weight =
      typeof weightRaw === 'number' && Number.isFinite(weightRaw) && weightRaw >= 0
        ? Math.min(weightRaw, 10)
        : 1;

    const titleTr = metin(row?.title_tr);
    const bodyTr = metin(row?.body_tr);
    const titleEn = metin(row?.title_en);
    const bodyEn = metin(row?.body_en);
    // Dört metnin DÖRDÜ de zorunlu: eksik dil, o dildeki kullanıcıya boş
    // bildirim göstermek demek olurdu.
    if (!titleTr || !bodyTr || !titleEn || !bodyEn) continue;

    const activeFrom = metin(row?.active_from);
    const activeUntil = metin(row?.active_until);
    const pencereGecerli =
      (!activeFrom && !activeUntil) ||
      (!!activeFrom && !!activeUntil && MONTH_DAY.test(activeFrom) && MONTH_DAY.test(activeUntil));
    if (!pencereGecerli) continue;

    seen.add(key);
    result.push({
      id,
      category: category as NotificationCategoryId,
      weight,
      tone,
      ...(activeFrom && activeUntil ? { activeFrom, activeUntil } : {}),
      text: {
        tr: { title: titleTr, body: bodyTr },
        en: { title: titleEn, body: bodyEn },
      },
    });
  }

  return result;
}

/**
 * Gömülü havuz + uzak havuz → planlayıcıların kullandığı tek liste.
 *
 * @param language Aktif dil; uzak metinden hangi sürümün alınacağını belirler.
 */
export function mergeRemotePool(
  builtin: readonly CopyVariant[],
  remote: readonly RemoteVariant[],
  language: string,
): CopyVariant[] {
  const dil = language.startsWith('en') ? 'en' : 'tr';
  const builtinKeys = new Set(builtin.map((v) => `${v.category}:${v.id}`));

  // Gömülü varyantlar: uzak satır aynı kimliği taşıyorsa YALNIZCA ağırlığı
  // uygulanır (metin ezilemez — bkz. dosya başlığındaki güvenlik duruşu).
  const remoteByKey = new Map(remote.map((v) => [`${v.category}:${v.id}`, v]));
  const merged: CopyVariant[] = builtin.map((variant) => {
    const override = remoteByKey.get(`${variant.category}:${variant.id}`);
    return override ? { ...variant, weight: override.weight } : variant;
  });

  // Uzak havuzdaki YENİ varyantlar eklenir; metinleri kendileriyle gelir.
  for (const variant of remote) {
    if (builtinKeys.has(`${variant.category}:${variant.id}`)) continue;
    merged.push({
      id: variant.id,
      category: variant.category,
      weight: variant.weight,
      tone: variant.tone,
      ...(variant.activeFrom && variant.activeUntil
        ? { activeFrom: variant.activeFrom, activeUntil: variant.activeUntil }
        : {}),
      text: variant.text[dil],
    });
  }

  return merged;
}
