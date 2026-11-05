import i18n from '../locales/index';
import { notify } from './confirmDialog';

/**
 * Kullanıcının başlattığı kütüphane yazımı düşerse görünür hata verir (AI_RULES: sessiz
 * başarısızlık yasak; M575: ağ kesintisinde film işareti sessizce geri dönüyordu).
 * Teknik iz mutasyon katmanında `logError` ile kalır.
 */
export const eylemHatasiGoster = (islem: Promise<unknown>): Promise<void> =>
  islem.then(
    () => undefined,
    () => notify(i18n.t('common:error'), i18n.t('common:actionFailedMessage')),
  );
