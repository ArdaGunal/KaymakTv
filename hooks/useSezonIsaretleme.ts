import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLibraryActions } from '../context/LibraryContext';
import { useAuth } from '../context/AuthContext';
import { useLibraryStore } from '../store/useLibraryStore';
import { chooseAsync, confirmAsync, notify } from '../utils/confirmDialog';
import {
  bolumYayinlandiMi, oncekiSezonPlani, planToplami,
  type IsaretlemePlani, type SezonListesi,
} from '../utils/atlananBolumler';

interface Girdi {
  season: any;
  showTraktId: number;
  /** Sezon başlığındaki ad («2. Sezon» / «Özel Bölümler»). */
  seasonLabel: string;
  /** Tüm yayınlanmış bölümler tamamlandı mı (yeşil düğme)? */
  isSeasonWatched: boolean;
  tumSezonlar?: SezonListesi[];
  showMedia?: any;
  iskeletSezonlar?: any[];
}

/**
 * Sezon başlığındaki «sezonu işaretle» düğmesinin TÜM mantığı (2.6.8 SEZON-01;
 * `SeasonAccordion` yalnız çizer).
 *
 * • İzlenmemiş sezon: önceki sezonlarda izlenmemiş yayınlanmış bölüm varsa İKİ
 *   eylem sorulur — «Öncekileri de İşaretle» / «Yalnızca Bu Sezon»; yoksa tek onay.
 *   🔴 Onay düğmesi KIRMIZI DEĞİL (kullanıcı: «basılmaması gereken buton gibi»):
 *   işaretlemek yıkıcı bir işlem değil; kırmızı yalnız silmede.
 * • Tamamen izlenmiş sezon: menü (Tekrar İzle / Sezonu Geri Al) + önceki
 *   sezonlarda eksik varsa «Önceki Sezonları İşaretle».
 * Yayınlanmamış bölüm ve özel sezon (0) hiçbir plana girmez.
 */
export function useSezonIsaretleme({
  season, showTraktId, seasonLabel, isSeasonWatched, tumSezonlar, showMedia, iskeletSezonlar,
}: Girdi) {
  const { t } = useTranslation(['media', 'common']);
  const { isGuest } = useAuth();
  const { markSeasonAsWatched, planiIsaretle, unwatchSeason, rewatchSeason } = useLibraryActions();
  const [menuGorunur, setMenuGorunur] = useState(false);
  // Menü açıldığı andaki önceki-sezon planı (ilerleme o an mağazadan okunur).
  const [menuOncekiler, setMenuOncekiler] = useState<IsaretlemePlani[]>([]);

  // 🔴 M421 (denetim F) — dönen simge yok, iyimser durum doğru; çift basış görünmez kilitle.
  const mesgul = useRef(false);
  const calistir = async (is: () => Promise<any>) => {
    if (mesgul.current) return;
    mesgul.current = true;
    try {
      await is();
    } catch (e) {
      console.error(e);
      notify(t('common:error'), t('seasonMarkError', 'Sezon işaretlenirken bir hata oluştu.'));
    } finally {
      mesgul.current = false;
    }
  };

  // İlerleme basma ANINDA okunur (abonelik yok: yüzlerce satırı yeniden çizerdi).
  const oncekiler = () => (season.number > 0
    ? oncekiSezonPlani(useLibraryStore.getState().showProgressMap[showTraktId], season.number, tumSezonlar)
    : []);

  const menuyuKapat = () => setMenuGorunur(false);

  const tekrarIzle = () => {
    menuyuKapat();
    calistir(() => rewatchSeason(showTraktId, season.number));
  };

  const sezonuGeriAl = async () => {
    menuyuKapat();
    const onay = await confirmAsync(
      t('unwatchSeasonTitle'),
      t('unwatchSeasonMsg', { season: seasonLabel }),
      t('common:delete', 'Geri Al'),
      t('common:cancel', 'Vazgeç'),
    );
    if (onay) calistir(() => unwatchSeason(showTraktId, season.number));
  };

  const oncekileriIsaretle = () => {
    const plan = menuOncekiler;
    menuyuKapat();
    if (plan.length) calistir(() => planiIsaretle(showTraktId, plan, showMedia, iskeletSezonlar));
  };

  const sezonDugmesi = async () => {
    if (mesgul.current) return;
    if (isGuest) {
      notify(t('common:error'), t('common:guestRestrictedMessage', 'Bu işlemi gerçekleştirmek için giriş yapmalısınız.'));
      return;
    }
    const onceki = oncekiler();

    if (isSeasonWatched) {
      setMenuOncekiler(onceki);
      setMenuGorunur(true);
      return;
    }

    const bolumler: any[] = season.episodes || [];
    const yayinlanan = bolumler
      .filter((b) => bolumYayinlandiMi(b, season.aired_episodes || 0))
      .map((b) => b.number)
      .filter((n): n is number => typeof n === 'number');
    const yayinlanmamis = bolumler.length - yayinlanan.length;
    if (yayinlanan.length === 0) {
      notify(t('seasonNotAiredTitle'), t('seasonNotAiredMsg', { season: seasonLabel }));
      return;
    }

    // Yalnız bu sezon: hepsi yayınlandıysa sezon-düzeyi istek, değilse yalnız yayınlananlar.
    const buSezon = () => (yayinlanmamis > 0
      ? planiIsaretle(showTraktId, [{ sezon: season.number, bolumler: yayinlanan }], showMedia, iskeletSezonlar)
      : markSeasonAsWatched(showTraktId, season.number, showMedia, iskeletSezonlar));

    if (onceki.length > 0) {
      const secim = await chooseAsync(
        t('markSeasonTitle'),
        t('markSeasonWithPrevMsg', { count: yayinlanan.length, prev: planToplami(onceki) }),
        t('common:markPreviousToo'),
        t('markOnlyThisSeason'),
      );
      if (secim === 'primary') {
        const plan = [...onceki, { sezon: season.number, bolumler: yayinlanan }];
        calistir(() => planiIsaretle(showTraktId, plan, showMedia, iskeletSezonlar));
      } else if (secim === 'secondary') {
        calistir(buSezon);
      }
      return;
    }

    const onay = await confirmAsync(
      t('markSeasonTitle'),
      yayinlanmamis > 0
        ? t('markSeasonPartialMsg', { count: yayinlanan.length, unaired: yayinlanmamis })
        : t('markSeasonMsg', { season: seasonLabel, count: yayinlanan.length }),
      t('markAsWatched'),
      t('common:cancel', 'Vazgeç'),
      { destructive: false },
    );
    if (onay) calistir(buSezon);
  };

  return {
    sezonDugmesi,
    menuGorunur,
    menuyuKapat,
    tekrarIzle,
    sezonuGeriAl,
    /** Menüde «Önceki Sezonları İşaretle» satırı için: kaç bölüm (0 = satır yok). */
    menuOncekiSayisi: planToplami(menuOncekiler),
    oncekileriIsaretle,
  };
}
