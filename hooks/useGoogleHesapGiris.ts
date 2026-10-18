import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { checkGoogleAccount, createGoogleOnlyAccount, type GoogleBagliHesap } from '../services/api/googleAuth';
import { useAuth } from '../context/AuthContext';
import { logError } from '../utils/errorLog';
import { googleGirisAdimi } from '../utils/googleGirisKarari';
import { googleOturumunuKapat } from '../services/auth/cikisTemizligi';

export type GoogleGirisDurumu = 'bos' | 'calisiyor' | 'trakt_ile_gir';

/**
 * Google ile giriş — giriş ekranındaki düğmenin mantığı.
 *
 * Kimlik birliği Faz 3 (M509, `docs/design/KIMLIK_BIRLIGI_PLANI.md`): ÖNCE `check`.
 *   • Google-only hesap → doğrudan oturum.
 *   • Trakt'lı hesaba bağlı → OTURUM YOK, `trakt_ile_gir` (D2: «Trakt hesabınız var onunla giriş
 *     yapın… trakt ile gir butonu çıksın»). Worker da bu satıra Google oturumu vermiyor.
 *   • Bağlı değil → soru sormadan yeni hesap (D4); yeni hesap ilk girişte isim ekranını görür.
 * ⚠️ M501'de düğme doğrudan `create_new` çağırıyordu → Trakt'lı kişi Google'a basınca ikinci,
 * boş hesap açılıyordu (M502'de kapatıldı).
 */
export function useGoogleHesapGiris() {
  const { saveGoogleSession } = useAuth();
  const router = useRouter();
  const { t } = useTranslation('common');
  const [durum, setDurum] = useState<GoogleGirisDurumu>('bos');
  const [hata, setHata] = useState<string | null>(null);
  // GIRIS-TASARIM-01 (M536): «Trakt ile devam et» kutusunda gösterilen kendi profil (@ad, #no).
  const [bagliHesap, setBagliHesap] = useState<GoogleBagliHesap | null>(null);

  const oturumAc = async (sessionToken: string, profil?: { username?: string; avatarUrl?: string | null }) => {
    await saveGoogleSession(sessionToken, profil);
    router.replace('/(protected)/(tabs)/explore');
  };

  const girisYap = async (idToken: string, nonce?: string) => {
    setHata(null);
    setDurum('calisiyor');
    try {
      // Native nonce ÜRETEMİYOR (`useGoogleNativeSignIn.ts`); Worker o durumda yalnız imza + süre
      // doğrular. Aynı belge `check` + `create_new` için kullanılabilir (sunucuda tek kullanım yok).
      const kontrol = await checkGoogleAccount(idToken, nonce ?? '');
      const adim = googleGirisAdimi(kontrol);
      if (adim === 'trakt_ile_gir') {
        setBagliHesap(kontrol.status === 'linked' ? kontrol.hesap ?? null : null);
        // M525 (e): oturum açılmadı → yerel Google oturumu da kapansın; «Vazgeç» + tekrar Google
        // hesap seçtirmeden aynı hesabı almasın (D8 ile aynı ilke).
        void googleOturumunuKapat();
        setDurum('trakt_ile_gir');
        return;
      }
      if (adim === 'oturum' && kontrol.status === 'linked') {
        await oturumAc(kontrol.sessionToken);
        return;
      }
      const sonuc = await createGoogleOnlyAccount(idToken, nonce ?? '');
      await oturumAc(sonuc.sessionToken, { username: sonuc.username, avatarUrl: sonuc.avatarUrl });
    } catch (error: any) {
      if (error?.code === 'trakt_ile_gir') {
        void googleOturumunuKapat();
        setDurum('trakt_ile_gir');
        return;
      }
      // AI_RULES §2: sessiz başarısızlık YASAK.
      logError('googleGiris.girisYap', error);
      setHata(t('accountCreateError', 'Hesap oluşturulamadı, tekrar dene.'));
      setDurum('bos');
    }
  };

  /**
   * «Başka bir hesapla dene» — kutudan çıkıp temiz giriş ekranına dön. Yerel Google oturumu
   * `trakt_ile_gir` anında zaten kapatıldı (M525 e); burada da kapatılır ki bir sonraki
   * Google basışı hesap seçiciyi AÇSIN, aynı hesabı sessizce yeniden almasın.
   */
  const sifirla = () => {
    void googleOturumunuKapat();
    setHata(null);
    setBagliHesap(null);
    setDurum('bos');
  };

  return { girisYap, durum, hata, sifirla, bagliHesap };
}
