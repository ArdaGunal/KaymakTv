import type { TFunction } from 'i18next';

/**
 * Kullanıcı adı reddinin arayüz dilindeki metni — istemci kural sorunu (`kisa`, `karakter`…)
 * ya da Worker kodu (`taken`, `kullanici_adi_ayrilmis`, `cooldown`…). M492: yalnız `taken`
 * eşleniyordu, geri kalanı «Kaydedilemedi» diye görünüyordu (cihazda «admin» ile bulundu).
 */
export function kullaniciAdiHataMetni(t: TFunction, kod: string | null | undefined): string {
  switch ((kod ?? '').replace(/^kullanici_adi_/, '')) {
    case 'taken':
      return t('settings:usernameTaken', 'Bu kullanıcı adı zaten alınmış, başka bir tane dene.');
    case 'ayrilmis':
      return t('settings:usernameReserved', 'Bu kullanıcı adı kullanılamaz, başka bir tane dene.');
    case 'kisa':
    case 'uzun':
      return t('settings:usernameRuleLength', 'Kullanıcı adı 3–30 karakter olmalı.');
    case 'karakter':
      return t('settings:usernameRuleChars', 'Yalnızca İngilizce harf, rakam ve alt çizgi (_) kullanılabilir.');
    case 'cooldown':
      return t('settings:usernameCooldownGeneric', 'Kullanıcı adını 14 günde bir değiştirebilirsin.');
    default:
      return t('settings:profileSaveError', 'Kaydedilemedi, tekrar dene.');
  }
}
