import { useCallback, useState } from 'react';
import {
  searchKaymakUsers,
  KaymakAramaHatasi,
  KaymakUserSonucu,
  AramaHatasi,
} from '../../../services/api/kaymakSocial';

/**
 * Kullanıcı arama — Faz T · T3.5.
 *
 * ==========================================================================
 * 🪪 NE DEĞİŞTİ VE NEDEN (2026-09-10, Madde 330)
 * ==========================================================================
 * ⛔ ÖNCEKİ HÂLİ TRAKT'A GİDİYORDU: `getUserProfile(username)` ile Trakt'tan
 * TEK bir profil çözüyordu. İki kırık sonucu vardı:
 *   1. **Google-only kullanıcı GÖRÜNMEZDİ** — Trakt'ta satırı yok, 404.
 *      İki yeni Google hesabı birbirini asla bulamıyordu; T3'ün çıkış
 *      ölçütü bu yüzden ölçülemez durumdaydı.
 *   2. Bulunsa bile takip `followTraktUser()` → Trakt → **401** veriyordu
 *      (`FAZ_T3_TASLAK` §1.1).
 *
 * ✅ ARTIK BİZİM DB'MİZE GİDİYOR (kullanıcı kararı: "yalnızca bizim DB").
 * Gerekçe: `user_follows` satırları `users.id`'ye FK veriyor — Trakt'ta
 * bulunup bizde olmayan biri **takip EDİLEMEZ**, onu listelemek ölü bir
 * sonuç göstermek olurdu.
 *
 * ⚠️ BEDELİ, BİLEREK KABUL EDİLDİ: Trakt'lı kullanıcı artık KaymakTV'yi hiç
 * kullanmamış bir Trakt kişisini arayamaz. Zaten bizim grafımızda onu takip
 * edemezdi (karar §5.1: tek graf bizde).
 *
 * ⛔ TRAKT PROFİL LİNKİ AYRIŞTIRMA KALDIRILDI (`extractTraktUsername`).
 * "EVRENSEL KAYMAK KİMLİĞİ" ilkesi gereği adres `username`'dir; bir Trakt
 * linki bizim adresleme anahtarımız değil.
 *
 * ⛔ TAKİP DURUMU BU HOOK'TA YOK (eskiden `useFollowState` buradaydı):
 * T3.2'nin takip uçları henüz yazılmadı, dolayısıyla gösterilecek çalışan
 * bir "Takip Et" düğmesi de yok. T3.3'te bağlanacak — o zamana kadar takip,
 * profil ekranından yapılıyor.
 */
export function useUserSearch() {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<KaymakUserSonucu[] | null>(null);
  const [error, setError] = useState<AramaHatasi | null>(null);

  const clear = useCallback(() => {
    setQuery('');
    setResults(null);
    setError(null);
  }, []);

  const search = useCallback(async () => {
    const terim = query.trim();
    if (!terim) return;

    setIsSearching(true);
    setError(null);
    setResults(null);
    try {
      setResults(await searchKaymakUsers(terim));
    } catch (err: any) {
      // 🔴 SESSİZ KAYIP YASAK: "sonuç yok" (boş dizi) ile "istek düştü"
      // AYRI durumlar. İkincisini boş listeye çevirmek, kullanıcıya
      // "böyle biri yok" yalanını söylerdi.
      setError(err instanceof KaymakAramaHatasi ? err.tur : 'genel');
    } finally {
      setIsSearching(false);
    }
  }, [query]);

  return {
    query,
    setQuery,
    isSearching,
    /** `null` = hiç aranmadı · `[]` = arandı, kimse yok. İKİSİ AYRI. */
    results,
    error,
    search,
    clear,
  };
}
