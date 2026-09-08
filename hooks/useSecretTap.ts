import { useCallback, useRef } from 'react';

/**
 * Gizli kapı — bir öğeye arka arkaya N kez basınca açılır.
 *
 * ==========================================================================
 * 🔴 BU GEÇİCİ BİR PERDE, KİLİT DEĞİL — VE SİLİNMEK ÜZERE YAZILDI
 * ==========================================================================
 * Amaç (kullanıcı kararı, 2026-09-06): Google girişi **Faz T bitene kadar**
 * rastgele bir kullanıcının eline geçmesin. Çünkü bugün Google-only bir
 * hesabın izlediklerini kaydedecek bir yer YOK — o kullanıcı uygulamayı
 * "bozuk" görür. Bu, Google girişinin 2026-08-23'te giriş ekranından
 * kaldırılmasının da sebebiydi (`docs/design/GOOGLE_AUTH_MIGRATION.md` §1).
 *
 * ⚠️ **GÜVENLİK SAĞLAMAZ, GÖRÜNÜRLÜK AZALTIR.** Worker'ın `create_new`
 * ucu hâlâ herkese açık; bilen biri doğrudan çağırabilir. Gerçek kilit
 * sunucuda olurdu (ör. `app_settings`'te bir bayrak). Bugünkü risk profili
 * için orantılı görüldü: veriler önemsiz ve tek kullanıcı tarafından
 * silinebilir durumda.
 *
 * 🗑️ **NASIL SİLİNİR (Faz T bitince, üç dosya):**
 *   1. Bu dosya
 *   2. `app/(public)/gizli-giris.tsx`
 *   3. İki vitrindeki `useSecretTap` çağrısı ve markayı saran dokunma
 *      sarmalayıcısı — `app/(public)/index.tsx` ve `index.web.tsx`
 * Google girişi o gün normal bir düğme olarak giriş ekranına döner;
 * yol haritası `GOOGLE_AUTH_MIGRATION.md` §5'te.
 */

interface SecretTapOptions {
  /** Kaç dokunuşta açılsın. */
  hedef?: number;
  /**
   * İki dokunuş arasındaki en uzun süre (ms). Aşılırsa sayaç sıfırlanır.
   *
   * ⚠️ NEDEN GEREKLİ: zaman penceresi olmasa sayaç oturum boyunca birikirdi
   * ve markaya gün içinde dağınık 7 kez dokunan bir kullanıcı kapıyı
   * KAZAYLA açardı. Kapının gizli kalması tam da buna bağlı.
   */
  pencereMs?: number;
  onUnlock: () => void;
}

export function useSecretTap({ hedef = 7, pencereMs = 3000, onUnlock }: SecretTapOptions) {
  const sayacRef = useRef(0);
  const sonDokunusRef = useRef(0);

  // 🔴 `useRef` — `useState` DEĞİL. Sayaç her dokunuşta state olsaydı vitrin
  // yeniden render olurdu; kullanıcıya hiçbir şey göstermeyen bir sayaç için
  // 7 gereksiz render. Ayrıca render arası yarış da doğardı.
  const bas = useCallback(() => {
    const simdi = Date.now();
    sayacRef.current = simdi - sonDokunusRef.current > pencereMs ? 1 : sayacRef.current + 1;
    sonDokunusRef.current = simdi;

    if (sayacRef.current >= hedef) {
      // Açıldıktan sonra sıfırla: kullanıcı geri dönüp tekrar basarsa kapı
      // yeniden açılabilsin, "bir kez açılır" gibi davranmasın.
      sayacRef.current = 0;
      sonDokunusRef.current = 0;
      onUnlock();
    }
  }, [hedef, pencereMs, onUnlock]);

  return { bas };
}
