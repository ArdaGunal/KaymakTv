/**
 * useFeedRealtime — başkalarının aktiviteleri CANLI düşsün (eklenince,
 * güncellenince VE silinince).
 *
 * Supabase Realtime (`postgres_changes`) ile `feed_activities` tablosundaki
 * INSERT/UPDATE/DELETE olaylarına abone olunur. Yeni bir satır geldiğinde,
 * gönderen kişi takip ettiklerimden biriyse (ya da benim) kart akışa anında
 * eklenir; biri kendi kartını silerse (bkz. useFeed.ts deleteActivity)
 * BAŞKALARININ ekranından da anında düşer — sayfa yenilemeye gerek yok.
 *
 * GÜVENLİK: Realtime `postgres_changes` RLS'e uyar. ⚠️ (M470 düzeltmesi) Eski
 * not «SELECT politikası USING (true)» diyordu — 057'den beri DEĞİL: misafir
 * yalnız açık hesapların `posted`'ını, üye engel/gizli/takip kurallarıyla
 * görür; `is_visible`/`is_retracted` (061) da süzülür. Kimlik `supabaseClient`'ın
 * `accessToken` geri çağrısıyla Realtime'a da gider (supabase-js 2.110, ölçüldü:
 * izleme olayı canlı geldi). Buradaki istemci filtresi yalnız «takip ettiklerim».
 *
 * NEDEN SUNUCU TARAFI FİLTRE YOK: Realtime'ın `filter` seçeneği tek bir
 * `eq`/`in` ifadesi alır ve takip listesi onlarca kişi olabilir; ayrıca liste
 * kullanıcı takip ettikçe değişir ve her değişimde kanalı yeniden kurmak
 * gerekirdi. Bunun yerine TÜM insert'lere abone olup bellek içi bir `Set` ile
 * eliyoruz — bu tablo düşük hacimli olduğu için maliyeti ihmal edilebilir.
 */

import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';
import { fetchActivitiesByIds, fetchActivityById, getVisibleUserIds } from '../services/feedApi';
import { toplayiciKur } from '../utils/realtimeToplayici';
import type { FeedActivity } from '../types';
import { tempActivityId } from '../services/feedPublish';
import { useFeedStore } from '../store/feedStore';
import { getMySupabaseUserId } from '../services/userBlocks';

export function useFeedRealtime(enabled: boolean): void {
  const channelRef = useRef<RealtimeChannel | null>(null);
  // Görünür kullanıcıların Supabase `users.id` kümesi. Ref'te tutuluyor çünkü
  // abonelik callback'i kanal kurulurken bir kez bağlanır; sonradan değişen
  // bir state'i okuyamazdı.
  const visibleIdsRef = useRef<Set<string>>(new Set());
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    // Gelen satırı listeye yerleştir: kendi iyimser kartımın yankısıysa onun yerine
    // geç, değilse ekle (kendi etkinliğim «yeni gönderi» rozetine sayılmaz — M476).
    const yerlestir = (activity: FeedActivity, myId: string | null) => {
      const store = useFeedStore.getState();
      // Geçici id DETERMİNİSTİK (bkz. feedPublish.tempActivityId) — tek eşitlik yeter.
      const tempId = tempActivityId(activity);
      if (store.activities.some((a) => a.id === tempId)) store.replaceActivity(tempId, activity);
      else store.upsertActivity(activity, activity.user.id !== myId);
    };

    // A-4 · INSERT'ler 250 ms toplanır, tek `in(id, …)` sorgusuyla tamamlanır (Worker
    // `/feed/sync` 50 satırı tek seferde yazabiliyor → eskiden 50 ayrı istek).
    const toplayici = toplayiciKur<string>(async (ids) => {
      try {
        const [list, myId] = await Promise.all([
          fetchActivitiesByIds(ids),
          getMySupabaseUserId().catch(() => null),
        ]);
        if (cancelled) return;
        for (const activity of list) yerlestir(activity, myId);
      } catch (error) {
        console.warn('[Feed] Realtime satırları çözülemedi:', error);
      }
    });

    const subscribe = async () => {
      // Kimlerin aktivitesini göreceğimizi önceden çöz — böylece gelen her
      // insert için ek bir sorgu atmadan, tek bir Set kontrolüyle eleyebiliriz.
      try {
        visibleIdsRef.current = await getVisibleUserIds();
      } catch (error) {
        console.warn('[Feed] Realtime için görünür kullanıcılar çözülemedi:', error);
        return;
      }
      if (cancelled) return;

      const channel = supabase
        .channel('feed_activities_stream')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'feed_activities' },
          (payload) => {
            const row: any = payload.new;
            if (!row?.id || !row?.user_id) return;
            if (!visibleIdsRef.current.has(row.user_id)) return;
            // ⚠️ Bölüm incelemeleri akışa DÜŞMEZ — sorgu tarafında
            // `.eq('in_feed', true)` ile eleniyor, ama Realtime sorgudan
            // geçmez: canlı INSERT doğrudan store'a girer. Bu kontrol
            // olmadan bölüm incelemesi yenilemede kaybolan ama WebSocket'ten
            // CANLI sızan bir kart olurdu (engel filtresindeki aynı sınıf
            // hata — bkz. docs/design/FEED_SOCIAL_PLAN.md §4.3, 4. madde).
            // `REPLICA IDENTITY FULL` (013) sayesinde payload TAM satırı
            // taşıyor, `in_feed` de dahil.
            //
            // ⚠️ Bu yalnızca UCUZ BİR ÖN ELEME — asıl kilit değil. Bilinçli
            // olarak `=== false` (fail-open): alan bir gün yükte hiç gelmezse
            // `!== true` yazmak TÜM canlı akışı sessizce öldürürdü, ki bu
            // gizli bir kartın görünmesinden daha kötü bir başarısızlık modu.
            // Kesin kilit sunucuda: `fetchActivitiesByIds` de `in_feed=true`
            // filtresi uyguluyor, dolayısıyla yük bozuk gelse bile gizli satır
            // `null` döner ve aşağıda elenir.
            if (row.in_feed === false) return;

            // Realtime yükü YALNIZCA `feed_activities` satırını taşır —
            // gönderen kişinin adı/avatarı (`users` join'i) yoktur. Kart join'li
            // satırla tamamlanır — A-4: toplayıcıyla, patlamada tek istek.
            toplayici.ekle(row.id);
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'feed_activities' },
          (payload) => {
            // Sosyal katman: biri bir aktiviteyi beğendiğinde/yorumladığında
            // (veya sahibi notunu değiştirdiğinde) like_count/comment_count/
            // note DB'de değişir — bu da bir UPDATE'tir (bkz.
            // supabase/schema/015_feed_social.sql trigger'ları). REPLICA
            // IDENTITY FULL sayesinde (013_realtime_feed.sql) `payload.new`
            // TAM satırı taşır, `user` join'i olmadan bile kısmi güncelleme
            // yeterli — kart zaten listede var, yalnızca sayıları değişiyor.
            const row: any = payload.new;
            if (!row?.id || !row?.user_id) return;
            if (!visibleIdsRef.current.has(row.user_id)) return;

            // 🔴 GÖRÜNÜRLÜK ARTIK UPDATE İLE DEĞİŞEBİLİR (021).
            // `in_feed` eskiden yalnızca satırın KENDİ alanlarından
            // hesaplanıyordu (activity_type + episode_number), yani bir satır
            // ömrü boyunca aynı görünürlükte kalıyordu ve burada kontrol
            // etmeye gerek yoktu. 021'den sonra yazarın `publish_manual`
            // ayarı da ifadeye girdi: kullanıcı "incelemelerimi gizle"ye
            // bastığında trigger satırları güncelliyor ve bu buraya UPDATE
            // olarak düşüyor.
            //
            // Kartı GÜNCELLEMEK yetmez, LİSTEDEN DÜŞÜRMEK gerekir — aksi
            // halde "gizle"ye basan kullanıcının kartı ekranda kalmaya devam
            // eder (F4-T12'de aynı sınıf hatanın önbellek tarafı bulunmuştu).
            if (row.in_feed === false) {
              useFeedStore.getState().removeActivity(row.id);
              return;
            }
            // NOT: ters yön (gizli → görünür) burada ele ALINMIYOR. Kart
            // listede olmadığı için `patchActivity` zaten no-op olur ve onu
            // eklemek her UPDATE'te (beğeni/yorum sayacı dahil) bir
            // `fetchActivityById` isteği demek olurdu. Ayar geri açıldığında
            // kartlar bir sonraki akış yüklemesinde gelir.

            // C3/M477 · Puan GÜNCELLEMESİ (Worker kullanıcı başına yapım başına
            // tek `rated` satırını yerinde günceller): (a) diğer kullanıcıların
            // akışında da yeni puan görünsün; (b) kendi eski kartım akışta
            // yüklü değilken eklenen geçici kart bu UPDATE ile yerleşsin —
            // INSERT yankısı hiç gelmeyeceği için eskiden asılı kalıyordu.
            if (row.activity_type === 'rated') {
              const tempId = tempActivityId({
                activityType: 'rated',
                showId: row.show_id,
                episodeNumber: row.episode_number,
                activityAt: row.activity_at,
              });
              if (useFeedStore.getState().activities.some((a) => a.id === tempId)) {
                fetchActivityById(row.id)
                  .then((real) => {
                    if (real && !cancelled) useFeedStore.getState().replaceActivity(tempId, real);
                  })
                  .catch((error) => console.warn('[Feed] Puan güncellemesi çözülemedi:', error));
                return;
              }
            }

            useFeedStore.getState().patchActivity(row.id, {
              likeCount: row.like_count ?? 0,
              commentCount: row.comment_count ?? 0,
              note: row.note ?? null,
              noteSpoiler: row.note_spoiler ?? false,
              ...(row.activity_type === 'rated' && row.rating != null ? { rating: row.rating } : {}),
              // isLikedByMe BİLİNÇLİ OLARAK dokunulmuyor — bu satırda yok
              // (Supabase Auth olmadığı için auth.uid() bazlı bir kolon
              // mümkün değil), yalnızca client'ın kendi eylemiyle değişir.
            });
          }
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'feed_activities' },
          (payload) => {
            // Silme artık gerçek (bkz. features/feed/hooks/useFeed.ts
            // deleteActivity, docs/HISTORY.md Madde 161) — ÖNCEDEN yalnızca
            // INSERT/UPDATE dinleniyordu, birinin kendi kartını silmesi
            // BAŞKALARININ ekranında hiç yansımıyordu (yalnızca tazelemede
            // düşerdi). `payload.old` REPLICA IDENTITY FULL sayesinde
            // (013_realtime_feed.sql) TAM satırı taşır, `id` her zaman dolu.
            const row: any = payload.old;
            if (!row?.id) return;
            // `removeActivity` id listede yoksa zaten no-op — görünürlük
            // kontrolüne gerek yok, kaldırma yalnızca kendi store'umda
            // gerçekten var olan bir satırı etkiler.
            useFeedStore.getState().removeActivity(row.id);
          }
        )
        .subscribe();

      channelRef.current = channel;
    };

    subscribe();

    // Uygulama arka plandan öne geldiğinde WebSocket kopmuş olabilir; abone
    // listesi de (yeni takip edilenler) eskimiş olabilir. Kanalı tazeliyoruz.
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      const wasBackgrounded = appStateRef.current.match(/inactive|background/);
      appStateRef.current = nextState;
      if (wasBackgrounded && nextState === 'active') {
        getVisibleUserIds()
          .then((ids) => {
            visibleIdsRef.current = ids;
          })
          .catch(() => {});
      }
    });

    return () => {
      cancelled = true;
      toplayici.iptal();
      appStateSub.remove();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled]);
}
