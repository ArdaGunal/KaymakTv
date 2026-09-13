import { useState, useEffect } from 'react';
import { fetchKaymakGraph, KaymakUserSonucu } from '../services/api/kaymakSocial';
import { useAuth } from '../context/AuthContext';
import { useFollowStore } from '../store/followStore';

export type NetworkUser = KaymakUserSonucu & { userId: string };

/**
 * Takipçi / takip edilen listesi — **BİZİM** graftan (Faz T · T3.3, M337).
 *
 * ⛔ ESKİDEN TRAKT'TAN GELİYORDU (`getFollowers`/`getFollowing`) ve 20'şerlik
 * sayfalama yapıyordu. Google-only kullanıcı o listelerde HİÇ görünmüyordu.
 *
 * ⚠️ SAYFALAMA KALDIRILDI — bilinçli. `/social/graph` her iki yönü TEK
 * yanıtta, 100 kişiye kadar döndürüyor. Sahte bir sayfalama arayüzü tutmak
 * (tek istek, sonra "sonraki sayfa yok") çağıranı yanıltırdı. 100'ü aşan bir
 * kullanıcı çıktığında ucun kendisine imleç eklenmeli — o gün gelmeden
 * istemciye sayfalama iskeleti yazmak erken soyutlama olur.
 *
 * @param targetUserId Profili görüntülenen kişinin `users.id`'si.
 *                     `null` → kendi ağım.
 */
export function useNetworkList(targetUserId: string | null, type: 'followers' | 'following') {
  const { accessToken, isGuest } = useAuth();
  const [data, setData] = useState<NetworkUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hata, setHata] = useState(false);
  /** 🔒 Gizli hesabın listesi sunucuda BOŞALTILIYOR (sayılar yine geliyor). */
  const [gizli, setGizli] = useState(false);

  // Seçicilerle abone olunuyor (bkz. hooks/useFollowState.ts'teki aynı not) —
  // bu ekran `connectionStates`'in tamamına ihtiyaç duymuyor. Whole-store
  // abonelik, listedeki herhangi bir kullanıcının takip durumu değiştiğinde
  // bu ekranın (ve altındaki FlatList'in) gereksiz yere yeniden render
  // olmasına yol açardı.
  const isFetched = useFollowStore((s) => s.isFetched);
  const fetchFollowGraph = useFollowStore((s) => s.fetchFollowGraph);

  // Kendi takip durumlarım — kartlardaki "Takip Et" düğmesi bunu okuyor.
  useEffect(() => {
    if (!accessToken || isGuest) return;
    if (!isFetched) {
      fetchFollowGraph();
    }
  }, [accessToken, isGuest, isFetched, fetchFollowGraph]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setHata(false);

    fetchKaymakGraph(targetUserId ?? undefined)
      .then((graf) => {
        if (cancelled) return;
        setGizli(graf.gizli);
        setData(type === 'followers' ? graf.followers : graf.following);
      })
      .catch((error) => {
        if (cancelled) return;
        // 🔴 SESSİZ BAŞARISIZLIK YASAK (AI_RULES §2): eskiden `.catch(() => {})`
        // vardı ve liste boş kalıyordu — kullanıcı "kimse yok" ile "yüklenemedi"
        // arasındaki farkı GÖREMİYORDU.
        console.warn('[useNetworkList] Ağ listesi alınamadı:', error);
        setHata(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [targetUserId, type]);

  return { data, isLoading, hata, gizli };
}
