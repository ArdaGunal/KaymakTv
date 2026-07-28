/**
 * "Gizle/Göster" (= uygulamadaki "Bırak"/"Geri Al") mutasyonlarını, aynı anda
 * çalışan tam senkronun EZMESİNE karşı koruyan minik uzlaştırma (reconcile)
 * katmanı.
 *
 * SORUN: `fetchFreshData` (TIER3), Trakt'tan gelen gizli listeyi
 * `hiddenShowIds`/`hiddenMovieIds` dilimlerine TOPTAN yazar. Kullanıcı tam da
 * bir senkron uçuştayken bir diziyi bırakırsa şu sıra oluşabiliyordu:
 *
 *   1. Senkron `GET /users/hidden/...` isteğini gönderir (yanıt: [A, B]).
 *   2. Kullanıcı C dizisini bırakır → yerel dilim iyimser olarak [A, B, C] olur,
 *      `POST /users/hidden/...` yola çıkar.
 *   3. (1)'deki GET yanıtı DÖNER ve dilimi [A, B]'ye geri yazar.
 *   → C bırakılmış görünmez, takip panosuna geri düşer. Kullanıcı için bu tam
 *     olarak "Bırak butonu çalışmıyor" demektir; ancak bir sonraki senkronda
 *     kendiliğinden düzeldiği için teşhisi de zordur.
 *
 * ÇÖZÜM: Devam eden her gizle/göster mutasyonu burada "beklenen son durum"
 * olarak işaretlenir. Senkron, sunucudan gelen listeyi yazmadan önce
 * `reconcileHiddenIds` ile bu bekleyen niyetleri listenin ÜSTÜNE uygular —
 * yani uçuştaki bir mutasyon asla eski bir sunucu anlık görüntüsü tarafından
 * geri alınamaz. Mutasyon tamamlanınca (başarı ya da rollback fark etmez)
 * işaret kalkar ve sonraki senkronlar yine sunucuyu tek gerçek kaynak sayar.
 *
 * Not: Bilinçli olarak modül seviyesinde düz bir Map — bu durum kalıcı DEĞİLDİR
 * ve olmamalıdır. Yalnızca "istek uçuşta" penceresini kapatır; uygulama
 * kapanırsa zaten uçuşta istek de kalmaz.
 */

type HiddenMediaType = 'show' | 'movie';

/** medya tipi → (trakt id → beklenen gizlilik durumu). */
const pendingMutations: Record<HiddenMediaType, Map<number, boolean>> = {
  show: new Map(),
  movie: new Map(),
};

/** Mutasyon başlarken çağrılır. `desiredHidden`: işlem bittiğinde öğe gizli mi olacak. */
export const beginHiddenMutation = (type: HiddenMediaType, id: number, desiredHidden: boolean) => {
  pendingMutations[type].set(id, desiredHidden);
};

/** Mutasyon bittiğinde (başarı VEYA rollback) çağrılır — `finally` içinde. */
export const endHiddenMutation = (type: HiddenMediaType, id: number) => {
  pendingMutations[type].delete(id);
};

/**
 * Sunucudan gelen gizli id listesinin üstüne, uçuşta olan mutasyonların
 * beklenen durumunu uygular. Bekleyen mutasyon yoksa listeyi OLDUĞU GİBİ
 * (aynı referansla) döndürür — gereksiz kopya/yeniden render üretmez.
 */
export const reconcileHiddenIds = (type: HiddenMediaType, serverIds: number[]): number[] => {
  const pending = pendingMutations[type];
  if (pending.size === 0) return serverIds;

  const merged = new Set(serverIds);
  for (const [id, shouldBeHidden] of pending) {
    if (shouldBeHidden) merged.add(id);
    else merged.delete(id);
  }
  return Array.from(merged);
};
