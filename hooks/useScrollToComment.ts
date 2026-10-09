import { useCallback, useRef } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

/** Hedefin üstünde bırakılan boşluk — durum çubuğu ve «KaymakTV İncelemeleri» başlığı
 *  görünür kalsın (96 ile başlık durum çubuğunun altına giriyordu, cihazda görüldü). */
const UST_PAY = 150;
/** Üstteki bölümler (oyuncular, sezonlar, görseller) yerleşsin diye kısa bekleme. */
const YERLESME_MS = 350;

/**
 * C4 · Akışta bir İNCELEMENİN metnine dokununca yapım sayfası `?yorum=<id>` ile
 * açılır; sayfa o incelemeye kaydırır (vurguyu `MediaCommentsSection` yapar).
 *
 * Kullanım: sayfa `scrollRef`'i ScrollView'e verir; `focusId` ve
 * `onFocusTarget` yorum bölümüne geçer. Hedef satır çizilince (inceleme
 * listesi geç yüklenir) `onFocusTarget(node)` çağrılır ve YALNIZ BİR KEZ
 * kaydırılır — kullanıcı sonra kendisi kaydırınca sayfa geri zıplamaz.
 */
export function useScrollToComment() {
  const { yorum } = useLocalSearchParams();
  const focusId = (Array.isArray(yorum) ? yorum[0] : yorum) || null;
  const scrollRef = useRef<ScrollView>(null);
  const kaydirilan = useRef<string | null>(null);

  const onFocusTarget = useCallback(
    (node: View | null) => {
      if (!node || !focusId || kaydirilan.current === focusId) return;
      kaydirilan.current = focusId;
      setTimeout(() => {
        const kap = scrollRef.current;
        if (!kap) return;
        node.measureLayout(
          kap as unknown as View,
          (_x, y) => kap.scrollTo({ y: Math.max(0, y - UST_PAY), animated: true }),
          () => {
            // Ölçülemedi (ör. düğüm ağaçtan çıktı) — bir sonraki çizimde yeniden denensin.
            kaydirilan.current = null;
          }
        );
      }, YERLESME_MS);
    },
    [focusId]
  );

  return { scrollRef, focusId, onFocusTarget };
}
