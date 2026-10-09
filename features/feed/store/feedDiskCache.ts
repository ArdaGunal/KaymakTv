import AsyncStorage from '@react-native-async-storage/async-storage';
import { FeedActivity } from '../types';
import { marathonSayfaSinirinda } from '../utils/marathonSinir';

/**
 * B-2 · Akışın son 1. sayfasının DİSK kopyası — soğuk açılışta ağ beklenmeden
 * gösterilir, taze sayfa gelince yerini alır (bkz. useFeed, feedStore.hydrateFromDisk).
 *
 * 🔴 SAHİP ANAHTARI ŞART: kartlar kimliğe bağlı alan taşıyor (`isLikedByMe`,
 * kendi kartımda «Sil»). Kopya Supabase `users.id` ile etiketlenir; okuyan
 * hesap farklıysa kopya hiç gösterilmez ve silinir. Çıkışta AuthContext tüm
 * AsyncStorage anahtarlarını zaten siliyor — bu etiket, çıkıştan hemen sonra
 * gecikmeli bir yazmanın yeni hesaba sızmasına karşı ikinci kilit.
 *
 * Önbellek DEĞİL, yalnız ilk kare: tazelik kararı hiçbir yerde buna dayanmaz;
 * ağ her açılışta yine gider.
 */
export const AKIS_DISK_ANAHTARI = 'akis.ilkSayfa.v1';
/** feedApi PAGE_SIZE ile aynı — ekranı dolduracak kadar, fazlası değil. */
export const AKIS_DISK_SATIR = 40;
/** Maraton zinciri uzatsa bile diske yazılacak en fazla satır. */
export const AKIS_DISK_UST_SINIR = 120;
/** Bundan eski kopya gösterilmez (30 günlük akış penceresinin yanında kısa). */
export const AKIS_DISK_MAX_YAS_MS = 7 * 24 * 60 * 60 * 1000;

interface DiskKopyasi {
  sahip: string;
  kaydedildi: number;
  satirlar: FeedActivity[];
}

/** Diske gidecek satırlar: iyimser/geçici kartlar sunucu gerçeği değil. */
export function diskSatirlari(activities: FeedActivity[]): FeedActivity[] {
  const gercek = activities.filter((a) => !a.isPending && !a.id.startsWith('temp-'));
  // C5 / A-7: kesim bir maratonun ortasına denk gelirse zincir tamamlanana kadar
  // uzat — yoksa açılışta kart «×37», ağ gelince «×47» diye zıplardı.
  let n = Math.min(AKIS_DISK_SATIR, gercek.length);
  while (n < gercek.length && n < AKIS_DISK_UST_SINIR && marathonSayfaSinirinda(gercek.slice(0, n))) n++;
  return gercek.slice(0, n);
}

export async function akisiDiskeYaz(sahip: string, activities: FeedActivity[]): Promise<void> {
  if (!sahip) return;
  const kopya: DiskKopyasi = { sahip, kaydedildi: Date.now(), satirlar: diskSatirlari(activities) };
  try {
    await AsyncStorage.setItem(AKIS_DISK_ANAHTARI, JSON.stringify(kopya));
  } catch (error) {
    // Sessiz değil ama ölümcül de değil: yalnız bir sonraki açılış iskeletle başlar.
    console.warn('[Feed] Akış diske yazılamadı:', error);
  }
}

/** Geçerli kopyanın satırları; yoksa / başka hesabınsa / bozuksa / eskiyse null. */
export async function akisiDisktenOku(sahip: string, simdi: number = Date.now()): Promise<FeedActivity[] | null> {
  if (!sahip) return null;
  try {
    const ham = await AsyncStorage.getItem(AKIS_DISK_ANAHTARI);
    if (!ham) return null;
    const kopya = JSON.parse(ham) as Partial<DiskKopyasi>;
    const gecerli =
      kopya?.sahip === sahip &&
      typeof kopya.kaydedildi === 'number' &&
      simdi - kopya.kaydedildi < AKIS_DISK_MAX_YAS_MS &&
      Array.isArray(kopya.satirlar);
    if (!gecerli) {
      await AsyncStorage.removeItem(AKIS_DISK_ANAHTARI);
      return null;
    }
    const satirlar = (kopya.satirlar as FeedActivity[]).filter(
      (a) => a && typeof a.id === 'string' && typeof a.activityAt === 'string' && a.user?.id
    );
    return satirlar.length ? satirlar : null;
  } catch (error) {
    console.warn('[Feed] Akış diskten okunamadı:', error);
    // Bozuk kopya her açılışta yeniden patlamasın.
    AsyncStorage.removeItem(AKIS_DISK_ANAHTARI).catch(() => {});
    return null;
  }
}
