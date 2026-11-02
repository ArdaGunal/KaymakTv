import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { confirmAsync, notify } from '../utils/confirmDialog';
import { logError } from '../utils/errorLog';
import { digerCihazlardanCik } from '../services/api/oturumYonetimi';
import { belgeDegisimiAyarla } from '../services/auth/oturumDenetimi';

/**
 * Trakt kasası Faz 6 · Ayarlar satırı: onay → Worker → bu cihazın oturumunu yeni belgeye geçir.
 * Kasası kopmuş Trakt'lı hesapta bu cihaz da yeniden Trakt'a girer (K5: Trakt'sız Google oturumu yok).
 */
export function useDigerCihazlardanCik() {
  const { saveTokens, saveGoogleSession, removeKeys } = useAuth();
  const router = useRouter();
  const { t } = useTranslation(['settings', 'common']);
  const [calisiyor, setCalisiyor] = useState(false);

  const calistir = useCallback(async () => {
    if (calisiyor) return;
    const onay = await confirmAsync(
      t('settings:digerCihazlarBaslik'),
      t('settings:digerCihazlarOnay'),
      t('settings:digerCihazlarOnayDugme'),
      t('common:cancel')
    );
    if (!onay) return;
    setCalisiyor(true);
    belgeDegisimiAyarla(true);
    try {
      const r = await digerCihazlardanCik();
      if (r.traktli && !r.erisim) {
        await removeKeys();
        notify(t('settings:digerCihazlarBaslik'), t('settings:digerCihazlarTraktIleGir'));
        router.replace('/(public)/settings');
        return;
      }
      if (r.erisim) await saveTokens(r.erisim, r.kaymakOturum);
      else await saveGoogleSession(r.kaymakOturum);
      notify(t('settings:digerCihazlarBaslik'), t('settings:digerCihazlarTamam'));
    } catch (e) {
      logError('digerCihazlardanCik', e as Error);
      notify(t('common:error'), t('settings:digerCihazlarHata'));
    } finally {
      belgeDegisimiAyarla(false);
      setCalisiyor(false);
    }
  }, [calisiyor, t, removeKeys, saveTokens, saveGoogleSession, router]);

  return { calistir, calisiyor };
}
