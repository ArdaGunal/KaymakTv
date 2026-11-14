import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { kasaBiletiniBirak, type TraktGirisi } from '../services/api/traktKasa';
import { girisOturumuAc } from '../services/auth/traktOturumu';
import { traktHesapKilidiDenetle, type BeklenenTraktHesabi, type GelenTraktKimligi } from '../services/auth/traktHesapKilidi';
import { logWarning } from '../utils/errorLog';
import { notify } from '../utils/confirmDialog';
import { useGoogleTraktLink } from './useGoogleTraktLink';
import { useTraktBaglamaTamamla } from './useTraktBaglamaTamamla';

export type Uyusmazlik = { beklenen: BeklenenTraktHesabi; gelen: GelenTraktKimligi };

/**
 * Yeni bir Trakt girişi (`{ erisim, kimlik, kasaBileti }`) → hesap kilidi → bağlama → Google bağlama →
 * oturum. İKİ kaynak aynı yoldan geçer: web yönlendirmesi (`/auth/trakt/degis`) ve native cihaz kodu
 * (`/auth/trakt/cihaz/yokla`). Eskiden `settings.tsx` `handleTokenExchange` içindeydi.
 *
 * Fırlatır (oturum açılamadı): çağıran hatayı kendi bağlamında gösterir.
 */
export function useTraktGirisiniTamamla(onUyusmazlik: (u: Uyusmazlik) => void) {
  const { saveTokens } = useAuth();
  const router = useRouter();
  const { t } = useTranslation(['settings', 'common']);
  // ⚠️ `completeIfPending` BİLİNÇLİ OLARAK DURUYOR (Google girişi UI'dan kalktı, bu kalmalı —
  // docs/design/GOOGLE_AUTH_MIGRATION.md).
  const { completeIfPending: completeGoogleLinkIfPending } = useGoogleTraktLink();
  // Kimlik Faz 5 (M520): Ayarlar → «Trakt'ı bağla» niyeti varsa token oturum AÇMAZ, bağlanır.
  const traktBaglamaTamamla = useTraktBaglamaTamamla();

  return useCallback(
    async (giris: TraktGirisi, baglamaNiyeti?: boolean): Promise<void> => {
      // GIRIS-KILIT-01: kart «@X» dediyse gelen Trakt hesabı X'in mi? Değilse token KAYDEDİLMEZ,
      // oturum açılmaz (canlı T1, 2026-10-31: kart @ArdaGnl → trakt.tv'deki Trakt_test → @Arda_Gunal).
      const kilit = await traktHesapKilidiDenetle(giris.kimlik);
      if (kilit.durum === 'uyusmazlik') {
        void kasaBiletiniBirak(giris.kasaBileti);
        // Kimlik yazılmaz (yalnız sıklığı görmek için): kaçıncı deneme.
        logWarning('girisKilidi.uyusmazlik', new Error('trakt_hesap_uyusmazligi'), { deneme: String(kilit.beklenen.deneme) });
        onUyusmazlik({ beklenen: kilit.beklenen, gelen: kilit.gelen });
        return;
      }

      if (await traktBaglamaTamamla(giris, baglamaNiyeti)) return;

      // F8 — bekleyen bir Google bağlama akışı varsa tamamlar (yoksa no-op).
      // ⚠️ Bağlama BAŞARISIZ olsa bile normal Trakt girişi ENGELLENMEZ —
      // kullanıcı Trakt kimliğini az önce kanıtladı, ondan esirgemek kötü olur.
      try {
        await completeGoogleLinkIfPending(giris.erisim);
      } catch (linkError: any) {
        console.error('[Google Sign-In] Hesap bağlama hatası:', linkError);
        notify(
          t('common:error'),
          linkError?.message || t('settings:googleLinkFailed', 'Google hesabın bağlanamadı, ama Trakt ile giriş yaptın.')
        );
      }

      const oturum = await girisOturumuAc(giris.erisim, giris.kasaBileti);
      await saveTokens(giris.erisim, oturum.kaymakOturum, oturum.userId);
      router.replace('/(protected)/(tabs)/explore');
    },
    [onUyusmazlik, traktBaglamaTamamla, completeGoogleLinkIfPending, saveTokens, router, t]
  );
}
