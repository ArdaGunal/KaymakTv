import { useLibraryStore } from '../../store/useLibraryStore';
import { getShowProgress } from '../traktApi';
import { fetchShowProgress } from '../api/library';
import { requestQueue } from '../api/requestQueue';
import { logError } from '../../utils/errorLog';
import { CACHE_KEYS, writeChunkedRecord, setShowProgressMap } from './utils';

/**
 * 🛡️ EMNİYET AĞI — aynada SEZON KIRILIMI olmayan diziler (T6.3)
 *
 * T6.3'te okuma yolu tamamen bize çevrildi: Trakt'lı kullanıcı da artık
 * `kaymakKutuphaneSenkronu()` üzerinden besleniyor. Ama aynamız her dizinin
 * sezon/bölüm kırılımına sahip OLMAYABİLİR — o dizide `seasons` boş gelir ve
 * bölüm bazlı ekranlar (dizi detayı, işaretleme) çalışamaz.
 *
 * 🔬 BUGÜNKÜ ÖLÇÜM (2026-09-14): proje sahibinin 139 dizisinin **0'ı**
 * kırılımsız. Yani bu ağ ŞU AN hiç tetiklenmiyor. Yine de duruyor:
 * · ayna bir gün geride kalırsa YENİ eklenen dizi kırılımsız gelir,
 * · başka kullanıcıda oran farklı olabilir (M319 döneminde 541 dizinin
 *   18'i kırılımsızdı),
 * · ve kullanıcı bu şartı açıkça koydu (2026-09-14).
 *
 * ⛔ YALNIZCA TRAKT TOKEN'I OLAN kullanıcıda. Google-only kullanıcının Trakt
 * token'ı yok; `getShowProgress` 401 döner ve boşuna istek atılmış olur.
 * O kullanıcıda kırılım eksikse çözüm aynayı beslemektir, Trakt'a sormak değil.
 *
 * 🔴 TAVAN VAR. Ayna toptan bayatlarsa bu fonksiyon yüzlerce dizi için
 * Trakt'a istek yağdırabilirdi — tam da §D14'te (57 istek = 16,1 sn)
 * öldürdüğümüz desen. Tavan, ağın bir GERİLEMEYE dönüşmesini engelliyor.
 *
 * @returns tamamlanan dizi sayısı
 */
export async function sezonsuzlariTamamla(
  traktTokenVar: boolean,
  tavan = 20,
): Promise<number> {
  // 🔴 M421 (denetim G) — ESKİDEN BURADA `if (!traktTokenVar) return 0` VARDI.
  // Onarım Trakt'tan okuduğu için Google-only kullanıcıda emniyet ağı HİÇ
  // çalışmıyordu: sezon kırılımı boş kalan dizide tikler ve "atlananlar"
  // hesabı kalıcı olarak yanlış kalıyordu. T6.1'den beri ilerlemenin kanonik
  // kaynağı BİZ olduğumuz için onarım da bizden okunabilir.

  const harita = (useLibraryStore.getState() as any)?.showProgressMap || {};
  const eksik = Object.keys(harita)
    .filter((id) => !(harita[id]?.seasons?.length > 0))
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id))
    .slice(0, tavan);

  if (eksik.length === 0) return 0;

  console.log(`[emniyet] ${eksik.length} dizide sezon kırılımı yok, Trakt'tan tamamlanıyor.`);

  const gelen: Record<number, any> = {};
  await Promise.all(
    eksik.map(async (id) => {
      try {
        // 🔴 `LOW` öncelik: bu bir onarım turu, kullanıcının beklediği veri
        // değil. Kritik isteklerin önüne geçmemeli.
        const p = traktTokenVar
          ? await requestQueue.enqueue(() => getShowProgress(id), 'LOW')
          : await fetchShowProgress(id);
        if (p?.seasons?.length) gelen[id] = p;
      } catch (e) {
        // Sessiz DEĞİL ama turu da düşürmüyor — diğer diziler denenmeye
        // devam etsin (M366/M370'in dersi).
        logError('emniyetAgi.sezonsuzlariTamamla', e as Error);
      }
    }),
  );

  const adet = Object.keys(gelen).length;
  if (adet === 0) return 0;

  setShowProgressMap((prev: any) => {
    const guncel = { ...prev, ...gelen };
    writeChunkedRecord(CACHE_KEYS.showProgressMap, guncel, { silent: true }).catch(() => {});
    return guncel;
  });

  console.log(`[emniyet] ${adet} dizinin kırılımı tamamlandı.`);
  return adet;
}
