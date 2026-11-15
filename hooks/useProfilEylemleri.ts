import { useEffect, useRef, useState } from 'react';
import { Platform, Share, ToastAndroid } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import { logError } from '../utils/errorLog';
import { profilPaylasimLinki } from '../utils/kaymakNo';

/** Satır içi «kopyalandı» bildiriminin ekranda kaldığı süre. */
const BILDIRIM_MS = 1500;

/** Kısa süreli bayrak: `ac()` → true, `BILDIRIM_MS` sonra false; bileşen kapanınca zamanlayıcı temizlenir. */
function useKisaBayrak() {
  const [acik, setAcik] = useState(false);
  const zamanlayici = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (zamanlayici.current) clearTimeout(zamanlayici.current); }, []);
  const ac = () => {
    setAcik(true);
    if (zamanlayici.current) clearTimeout(zamanlayici.current);
    zamanlayici.current = setTimeout(() => setAcik(false), BILDIRIM_MS);
  };
  return [acik, ac] as const;
}

/**
 * 1.0.1 Dal 2 · profil başlığı — kullanıcı adına dokununca `@kullanıcı_adı` panoya.
 * Bildirim: Android'de sistemin kendi toast'ı; web/iOS'ta satır içi kısa yazı (`kopyalandi`).
 * Ekran düzeyinde ortak bir toast altyapısı yok; `Snackbar` mutlak konumlu ve kaydırılan
 * başlığın içinde yanlış yerde çıkardı.
 */
export function useKullaniciAdiKopyala(kullaniciAdi: string | null | undefined) {
  const { t } = useTranslation('common');
  const [kopyalandi, kopyalandiGoster] = useKisaBayrak();
  const kopyala = async () => {
    if (!kullaniciAdi) return;
    try {
      await Clipboard.setStringAsync(`@${kullaniciAdi}`);
      if (Platform.OS === 'android') ToastAndroid.show(t('kullaniciAdiKopyalandi'), ToastAndroid.SHORT);
      else kopyalandiGoster();
    } catch (error) {
      logError('profil.kullaniciAdiKopyala', error);
    }
  };
  return { kopyala, kopyalandi };
}

/**
 * Profil paylaşımı — kısa bağlantı `kaymaktv.com/u/<KaymakNo>` (ad değişse de kırılmaz, M522).
 * Native: sistem paylaşım sayfası; web: `navigator.share`, yoksa bağlantı panoya + `linkKopyalandi`.
 * Numara yoksa `link` null → düğme çizilmez.
 */
export function useProfilPaylas(kaymakNo: number | null | undefined) {
  const { t } = useTranslation('common');
  const [linkKopyalandi, isaretle] = useKisaBayrak();
  const link = profilPaylasimLinki(kaymakNo);
  const paylas = async () => {
    if (!link) return;
    try {
      const nav: any = Platform.OS === 'web' ? (globalThis as any).navigator : null;
      if (Platform.OS !== 'web') {
        await Share.share({ message: `${t('profilPaylasMesaj')}\n${link}` });
      } else if (nav?.share) {
        await nav.share({ url: link, text: t('profilPaylasMesaj') });
      } else {
        await Clipboard.setStringAsync(link);
        isaretle();
      }
    } catch (error) {
      logError('profil.paylas', error);
    }
  };
  return { link, paylas, linkKopyalandi };
}
