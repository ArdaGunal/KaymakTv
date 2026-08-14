/**
 * useFeedRealtime — başkalarının aktiviteleri CANLI düşsün.
 *
 * Supabase Realtime (`postgres_changes`) ile `feed_activities` tablosundaki
 * INSERT olaylarına abone olunur. Yeni bir satır geldiğinde, gönderen kişi
 * takip ettiklerimden biriyse (ya da benim) kart akışa anında eklenir —
 * sayfa yenilemeye gerek yok.
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
