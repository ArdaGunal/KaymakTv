import { getMySupabaseUserId, setMySupabaseUserId } from '../../features/feed/services/userBlocks';

/**
 * M525 (c) — cihazdaki «ben» (`users.id`) sunucunun söylediğiyle aynı mı?
 *
 * `getMySupabaseUserId` diskten okur ve hiç yeniden doğrulamaz. «Hesap Seç»ten sonra (Faz 5)
 * BAŞKA bir cihazın Trakt token'ı artık kalan hesaba çözülür, ama o cihaz kendini silinen
 * hesap sanmaya devam ederdi (beğeni durumu, kendi yorumunda «sil», akışta «ben»). Sunucu
 * farklı bir id bildirirse disk kopyası düzeltilir ve kimliğe bağlı önbellekler sıfırlanır
 * (`onKimlikDegisti` → AuthContext, çıkıştaki temizleyicilerin aynısı — oturum KAPANMAZ).
 */
type Dinleyici = () => void;
let dinleyiciler: Dinleyici[] = [];

export function onKimlikDegisti(d: Dinleyici): () => void {
  dinleyiciler.push(d);
  return () => { dinleyiciler = dinleyiciler.filter((x) => x !== d); };
}

/** Dönüş: kimlik değişti mi (değiştiyse önbellekler sıfırlandı). */
export async function benKimliginiDogrula(sunucuId: string | null | undefined): Promise<boolean> {
  if (!sunucuId) return false;
  const yerel = await getMySupabaseUserId().catch(() => null);
  if (yerel === sunucuId) return false;
  await setMySupabaseUserId(sunucuId);
  if (!yerel) return false; // ilk kez öğrenildi — sıfırlanacak eski kimlik yok
  console.warn('[kimlik] Cihazdaki «ben» sunucudakinden farklıydı — kimlik önbellekleri sıfırlanıyor.');
  dinleyiciler.forEach((d) => {
    try { d(); } catch (e) { console.warn('[kimlik] dinleyici hatası:', e); }
  });
  return true;
}
