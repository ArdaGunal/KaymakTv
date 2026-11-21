import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { AuthRequest, CodeChallengeMethod, ResponseType } from 'expo-auth-session';
import { useTranslation } from 'react-i18next';
import { koduDegis, KasaHatasi, type TraktGirisi } from '../services/api/traktKasa';
import { zorunluGirisAdresi } from '../services/auth/traktHesapKilidi';
import { oauthStateKaydet, oauthStateTuket } from '../services/oauthState';
import { notify } from '../utils/confirmDialog';
import { logWarning } from '../utils/errorLog';

const REDIRECT_ORIGIN = 'https://kaymaktv.com';
const REDIRECT_PATH = '/settings';
const REDIRECT_URI = REDIRECT_ORIGIN + REDIRECT_PATH;
const discovery = { authorizationEndpoint: 'https://auth.trakt.tv/oauth/authorize' };
const clientId = process.env.EXPO_PUBLIC_TRAKT_CLIENT_ID || '';

export function useTraktWebGirisi(onGiris: (giris: TraktGirisi) => Promise<void>) {
  const { t } = useTranslation(['settings', 'common']);
  const [isGenerating, setIsGenerating] = useState(false);
  const baslatiliyor = useRef(false);
  // www ayrı bir kökendir ve PKCE kaydını paylaşmaz. Web girişi kayıtlı
  // callback ile aynı kökende, yalnız https://kaymaktv.com üzerinde açılır.
  const etkin = Platform.OS === 'web' && !!clientId && typeof window !== 'undefined' &&
    window.location.origin === REDIRECT_ORIGIN;

  useEffect(() => {
    if (!etkin) return;
    const adres = new URL(window.location.href);
    if (adres.pathname !== REDIRECT_PATH) return;
    const code = adres.searchParams.get('code');
    const error = adres.searchParams.get('error');
    if (!code && !error) return;

    const donusuTamamla = async () => {
      setIsGenerating(true);
      try {
        // URL'yi tüket; yeniden render ve soğuk açılışta ikinci değişim yapılmasın.
        window.history.replaceState(window.history.state, '', adres.pathname);
        const verifier = await oauthStateTuket(adres.searchParams.get('state'));
        if (error || !code || !verifier) {
          notify(t('common:error'), t('loginCanceled'));
          return;
        }
        await onGiris(await koduDegis(code, REDIRECT_URI, verifier));
      } catch (hata) {
        const gecersiz = hata instanceof KasaHatasi && hata.kod === 'kod_gecersiz';
        logWarning('traktWebGirisi.donus', new Error(gecersiz ? 'kod_gecersiz' : 'web_girisi_tamamlanamadi'));
        notify(t('common:error'), t(gecersiz ? 'loginTokenError' : 'communicationError'));
      } finally {
        setIsGenerating(false);
      }
    };
    void donusuTamamla();
  }, [etkin, onGiris, t]);

  const baslat = async (zorunluGiris: boolean) => {
    if (!etkin || isGenerating || baslatiliyor.current) return;
    baslatiliyor.current = true;
    try {
      const request = new AuthRequest({
        clientId,
        redirectUri: REDIRECT_URI,
        responseType: ResponseType.Code,
        usePKCE: true,
        codeChallengeMethod: CodeChallengeMethod.S256,
      });
      const adres = await request.makeAuthUrlAsync(discovery);
      if (!request.codeVerifier) throw new Error('PKCE verifier olusturulamadi');
      await oauthStateKaydet(request.state, request.codeVerifier);
      window.location.assign(zorunluGiris ? zorunluGirisAdresi(adres) : adres);
    } catch {
      logWarning('traktWebGirisi.baslat', new Error('web_yonlendirmesi_baslatilamadi'));
      notify(t('common:error'), t('communicationError'));
    } finally {
      baslatiliyor.current = false;
    }
  };

  return { etkin, isGenerating, baslat };
}
