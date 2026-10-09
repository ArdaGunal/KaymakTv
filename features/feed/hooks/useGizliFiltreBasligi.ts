import { RefObject, useCallback, useEffect, useRef, useState } from 'react';
import type { FlatList, LayoutChangeEvent } from 'react-native';
import type { FeedFilter } from '../utils/feedFilter';

/**
 * C6 · YouTube tarzı GİZLİ filtre başlığı (kullanıcı: «ilk açılışta hiç yok…
 * ekranı aşağı kaydırınca filtreler çıkıyor… ekran biraz kayınca belli yerde
 * kayboluyor. Sayfa yenileme de benzer çalışıyor»).
 *
 * Yöntem: çip satırı listenin İLK öğesi (ListHeaderComponent); liste açılışta
 * çip yüksekliği kadar AŞAĞI kaydırılmış başlar. Kullanıcı en üstteyken aşağı
 * çekince çipler doğal olarak görünür, daha fazla çekince RefreshControl
 * yenilemeyi tetikler; aşağı kaydırınca çipler listeyle birlikte gider.
 * Web'de (çekip yenileme yok) yukarı kaydırınca görünür — aynı kod.
 *
 * Kısa listede (içerik ekrandan kısa) kaydırılacak yer olmadığı için içerik en
 * az «liste yüksekliği + çip» kadar tutulur (`icerikMinYukseklik`).
 * Filtre seçiliyken çipler GİZLENMEZ — seçili filtre görünür kalsın.
 */
export function useGizliFiltreBasligi<T>(listRef: RefObject<FlatList<T> | null>, filtre: FeedFilter) {
  const [cipH, setCipH] = useState(0);
  const [listeH, setListeH] = useState(0);
  const gizlendi = useRef(false);

  const onCipLayout = useCallback((e: LayoutChangeEvent) => setCipH(Math.round(e.nativeEvent.layout.height)), []);
  const onListeLayout = useCallback((e: LayoutChangeEvent) => setListeH(Math.round(e.nativeEvent.layout.height)), []);

  // İçerik çip + ekran kadar olunca (disk kopyası ya da ilk sayfa çizildi) bir
  // kez gizle. Sonraki veri değişimleri kaydırma konumunu bozmaz.
  const onContentSizeChange = useCallback(
    (_w: number, h: number) => {
      if (gizlendi.current || filtre !== 'tumu' || cipH <= 0 || listeH <= 0) return;
      if (h + 1 < cipH + listeH) return;
      gizlendi.current = true;
      listRef.current?.scrollToOffset({ offset: cipH, animated: false });
    },
    [filtre, cipH, listeH, listRef]
  );

  // Filtre seçilince çipler ve sonuçların başı görünsün.
  const ilkFiltre = useRef(true);
  useEffect(() => {
    if (ilkFiltre.current) {
      ilkFiltre.current = false;
      return;
    }
    gizlendi.current = true; // kullanıcı çiplerle etkileşti; artık otomatik gizleme yok
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [filtre, listRef]);

  /** «En üst» = çiplerin hemen altı (Tümü'de) — «yeni gönderi» rozeti için. */
  const ustOfset = filtre === 'tumu' ? cipH : 0;

  return {
    onCipLayout,
    onListeLayout,
    onContentSizeChange,
    icerikMinYukseklik: listeH > 0 ? listeH + cipH : undefined,
    ustOfset,
  };
}
