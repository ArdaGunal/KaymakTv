import { useTranslation } from 'react-i18next';

import { useAktarimStore } from '../store/aktarimStore';
import type { MotorFazi } from '../services/import/aktarimMotoru';

/**
 * Otomatik aktarım sürerken ekranların "boş" ve "senkron başarısız"
 * durumlarını BASTIRMASI için (§C33).
 *
 * 🔴 NEDEN: aktarımı bitmemiş kullanıcının kütüphanesi bizde gerçekten boş —
 * ama ona "kütüphanen boş" demek YALAN (verisi Trakt'ta, şu an akıyor).
 * 27 Eylül'de bu metin yüzünden kullanıcı verilerinin silindiğini sandı.
 * Bant (`AktarimBandi`) açıklamayı yapıyor; liste alanı da aynı şeyi söyler.
 *
 * `kontrol` DAHİL: açılıştaki ~1 sn'lik sorguda da boş liste "boş" sayılmaz.
 * Aktarımı tamamlanmış kullanıcıda bu faz tek istekte `tamam`a döner.
 */
const BASTIRAN_FAZLAR: ReadonlySet<MotorFazi> = new Set(['kontrol', 'suruyor', 'ag_bekleniyor', 'baska_cihaz']);

export function useAktarimGorunumu(): { aktarimSuruyor: boolean; bosMetni: string } {
  const { t } = useTranslation('common');
  const faz = useAktarimStore((s) => s.faz);
  return {
    aktarimSuruyor: BASTIRAN_FAZLAR.has(faz),
    bosMetni: t('importEmptyWhileSyncing', 'Trakt kütüphanen aktarılıyor — verilerin birazdan burada belirecek.'),
  };
}
