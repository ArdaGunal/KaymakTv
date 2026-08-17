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
 * GÜVENLİK: Realtime `postgres_changes` için RLS'e uyar; bu tablonun SELECT
 * politikası zaten `USING (true)` (bkz. 001_feed_schema.sql — akış verisi
 * tasarım gereği herkese açık okunur), dolayısıyla ek bir sızıntı yüzeyi
 * yoktur. "Kim ne görecek" filtresi burada, client'ta uygulanır.
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
import { fetchActivityById, getVisibleUserIds } from '../services/feedApi';
import { tempActivityId } from '../services/feedPublish';
import { useFeedStore } from '../store/feedStore';

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
          async (payload) => {
            const row: any = payload.new;
            if (!row?.id || !row?.user_id) return;
            if (!visibleIdsRef.current.has(row.user_id)) return;
            // ⚠️ Bölüm incelemeleri akışa DÜŞMEZ — sorgu tarafında
            // `.eq('in_feed', true)` ile eleniyor, ama Realtime sorgudan
            // geçmez: canlı INSERT doğrudan store'a girer. Bu kontrol
            // olmadan bölüm incelemesi yenilemede kaybolan ama WebSocket'ten
            // CANLI sızan bir kart olurdu (engel filtresindeki aynı sınıf
            // hata — bkz. docs/FEED_SOCIAL_PLAN.md §4.3, 4. madde).
            // `REPLICA IDENTITY FULL` (013) sayesinde payload TAM satırı
            // taşıyor, `in_feed` de dahil.
            //
            // ⚠️ Bu yalnızca UCUZ BİR ÖN ELEME — asıl kilit değil. Bilinçli
            // olarak `=== false` (fail-open): alan bir gün yükte hiç gelmezse
            // `!== true` yazmak TÜM canlı akışı sessizce öldürürdü, ki bu
            // gizli bir kartın görünmesinden daha kötü bir başarısızlık modu.
            // Kesin kilit sunucuda: `fetchActivityById` de `in_feed=true`
            // filtresi uyguluyor, dolayısıyla yük bozuk gelse bile gizli satır
            // `null` döner ve aşağıda elenir.
            if (row.in_feed === false) return;

            // Realtime yükü YALNIZCA `feed_activities` satırını taşır —
            // gönderen kişinin adı/avatarı (`users` join'i) yoktur. Kartı
            // çizebilmek için satırı join'li olarak tek seferde çekiyoruz.
            // Bu ek sorgu yalnızca TAKİP ETTİĞİM biri bir şey yaptığında
            // atılır, yani nadirdir.
            try {
              const activity = await fetchActivityById(row.id);
              if (!activity || cancelled) return;

              const store = useFeedStore.getState();
              // Bu satır, az önce iyimser olarak eklediğim kendi kartımın
              // sunucu sürümü mü? Geçici id DETERMİNİSTİK olduğu için
              // (bkz. feedPublish.tempActivityId) tek bir eşitlik kontrolü
              // yeterli — alan alan tahmin yürütmeye gerek yok.
              const tempId = tempActivityId(activity);
              const isEchoOfMine = store.activities.some((a) => a.id === tempId);

              if (isEchoOfMine) {
                // Geçici kartı gerçek satırla değiştir; "yeni gönderi"
                // rozetine SAYMA — bunu az önce ben yaptım.
                store.replaceActivity(tempId, activity);
              } else {
                store.upsertActivity(activity, true);
              }
            } catch (error) {
              console.warn('[Feed] Realtime satırı çözülemedi:', error);
            }
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

            useFeedStore.getState().patchActivity(row.id, {
              likeCount: row.like_count ?? 0,
              commentCount: row.comment_count ?? 0,
              note: row.note ?? null,
              noteSpoiler: row.note_spoiler ?? false,
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
      appStateSub.remove();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled]);
}
