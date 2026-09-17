import { useCallback, useEffect, useRef, useState } from 'react';
import {
  searchKaymakUsers,
  KaymakAramaHatasi,
  KaymakUserSonucu,
  AramaHatasi,
} from '../../../services/api/kaymakSocial';

/** Yazmayı bırakınca bu kadar beklenip aranır. */
export const ARAMA_BEKLEME_MS = 400;
/** Bundan kısa terim ağa gitmez (Worker da `cok_kisa` döner). */
export const EN_AZ_KARAKTER = 2;

/**
 * Kullanıcı arama — Faz T · T3.5 · 🆕 yazdıkça arama (2026-09-17).
 *
 * ==========================================================================
 * 🪪 NE DEĞİŞTİ VE NEDEN (2026-09-10, Madde 330)
 * ==========================================================================
 * ⛔ ÖNCEKİ HÂLİ TRAKT'A GİDİYORDU: `getUserProfile(username)` ile Trakt'tan
 * TEK bir profil çözüyordu. İki kırık sonucu vardı:
 *   1. **Google-only kullanıcı GÖRÜNMEZDİ** — Trakt'ta satırı yok, 404.
 *   2. Bulunsa bile takip `followTraktUser()` → Trakt → **401** veriyordu.
 *
 * ✅ ARTIK BİZİM DB'MİZE GİDİYOR (kullanıcı kararı: "yalnızca bizim DB").
 * `user_follows` satırları `users.id`'ye FK veriyor — Trakt'ta bulunup bizde
 * olmayan biri takip EDİLEMEZ, onu listelemek ölü bir sonuç göstermek olurdu.
 *
 * ==========================================================================
 * 🆕 YAZDIKÇA ARAMA (2026-09-17, kişi arama paneli)
 * ==========================================================================
 * Eskiden yalnızca "ara" tuşuyla arıyordu — akışın üstünde duran bir çubuk
 * için yeterliydi. Arama artık ayrı bir panelde ve klasik davranış bekleniyor:
 * yazdıkça sonuç gelsin.
 *
 * 🔑 İKİ KORUMA:
 *  1. **Bekleme (debounce) + en az 2 karakter.** Worker `/social/search` IP
 *     başına DAKİKADA 30 istek sınırında (`socialSearch.js`). Her tuşta istek
 *     atmak hızlı yazan birini dakikalar içinde sınıra çarptırırdı; yazmayı
 *     bırakınca aramak bir oturumu birkaç isteğe indiriyor.
 *  2. **Yarış koruması.** "ar" araması "arda" aramasından SONRA dönerse, eski
 *     sonuç yeniyi ezip kullanıcıya yazdığıyla uyuşmayan bir liste
 *     gösterirdi. Her isteğe sıra numarası verilir; yalnızca SON isteğin
 *     cevabı kabul edilir.
 *
 * `search()` (Enter tuşu) beklemeyi atlayıp hemen arar.
 */
export function useUserSearch() {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<KaymakUserSonucu[] | null>(null);
  const [error, setError] = useState<AramaHatasi | null>(null);

  // Yalnızca en son başlatılan isteğin cevabı ekrana yazılır.
  const sonIstekRef = useRef(0);
  // Aynı terimi arka arkaya iki kez aramamak için (bekleme + Enter çakışması).
  const sonTerimRef = useRef<string | null>(null);

  const calistir = useCallback(async (hamTerim: string) => {
    const terim = hamTerim.trim();
    if (terim.length < EN_AZ_KARAKTER) return;
    if (terim === sonTerimRef.current) return;
    sonTerimRef.current = terim;

    const istekNo = ++sonIstekRef.current;
    setIsSearching(true);
    setError(null);
    try {
      const bulunan = await searchKaymakUsers(terim);
      if (istekNo !== sonIstekRef.current) return; // eskimiş cevap — yok say
      setResults(bulunan);
    } catch (err: any) {
      if (istekNo !== sonIstekRef.current) return;
      // 🔴 SESSİZ KAYIP YASAK: "sonuç yok" (boş dizi) ile "istek düştü"
      // AYRI durumlar. İkincisini boş listeye çevirmek, kullanıcıya
      // "böyle biri yok" yalanını söylerdi.
      setResults(null);
      setError(err instanceof KaymakAramaHatasi ? err.tur : 'genel');
      // Hata sonrası aynı terim yeniden denenebilsin.
      sonTerimRef.current = null;
    } finally {
      if (istekNo === sonIstekRef.current) setIsSearching(false);
    }
  }, []);

  // Yazdıkça ara — yazmayı bırakınca.
  useEffect(() => {
    const terim = query.trim();
    if (terim.length < EN_AZ_KARAKTER) {
      // Terim kısaldıysa uçuştaki cevabı da geçersiz kıl: kullanıcı silip
      // yeniden yazarken eski sonuç listesi geri gelmesin.
      sonIstekRef.current++;
      sonTerimRef.current = null;
      setResults(null);
      setError(null);
      setIsSearching(false);
      return;
    }
    // Enter ile tetiklenen "en az 2 karakter" uyarısı, kullanıcı yazmaya devam
    // edip terimi yeterli uzunluğa getirince hemen kalksın (bekleme boyunca
    // ekranda eskimiş bir uyarı durmasın). Diğer hatalar yeni sonuca kadar kalır.
    setError((e) => (e === 'cok_kisa' ? null : e));
    const zamanlayici = setTimeout(() => { void calistir(terim); }, ARAMA_BEKLEME_MS);
    return () => clearTimeout(zamanlayici);
  }, [query, calistir]);

  /** Enter tuşu: beklemeden hemen ara. Kısa terimde kullanıcıya nedenini söyle. */
  const search = useCallback(() => {
    const terim = query.trim();
    if (terim.length > 0 && terim.length < EN_AZ_KARAKTER) {
      setResults(null);
      setError('cok_kisa');
      return;
    }
    void calistir(terim);
  }, [query, calistir]);

  const clear = useCallback(() => {
    sonIstekRef.current++;
    sonTerimRef.current = null;
    setQuery('');
    setResults(null);
    setError(null);
    setIsSearching(false);
  }, []);

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
