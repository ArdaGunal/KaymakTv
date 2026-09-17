import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { UserSearch } from '../../../components/icons';
import { useAuth } from '../../../context/AuthContext';
import UserSearchSheet from './UserSearchSheet';

interface Props {
  /** Bulunduğu ekranın diğer ikon düğmeleriyle aynı görünsün diye. */
  style?: StyleProp<ViewStyle>;
  iconColor?: string;
  iconSize?: number;
}

/**
 * Kişi arama simgesi + paneli — TEK GİRİŞ NOKTASI (2026-09-17).
 *
 * Akış başlığında ve Profil → Ağım ekranında AYNI bileşen kullanılıyor.
 * Panelin açık/kapalı durumu burada tutuluyor; çağıranın hiçbir şey
 * bağlaması gerekmiyor (`<UserSearchButton />` yeterli). İki ekranda iki ayrı
 * kopya olsaydı (arama mantığı, klavye düzeni, yarış koruması) zamanla
 * ıraksardı — AI_RULES §2.5.
 */
export default function UserSearchButton({ style, iconColor = '#94a3b8', iconSize = 18 }: Props) {
  const { t } = useTranslation('feed');
  const { accessToken, isGuest } = useAuth();
  const [acik, setAcik] = useState(false);

  // 🔴 MİSAFİRE GÖSTERİLMEZ (web önizlemesinde yakalandı, 2026-09-17).
  // `/social/search` kimlik ister ("sonuçtan engellileri elemek için kim
  // soruyor bilinmek ZORUNDA") ve token yokken **400 "traktAccessToken
  // zorunlu."** döner. `kaymakSocial.sosyalIstek` ise HER 400'ü `cok_kisa`ya
  // çeviriyor — misafir "arda" yazınca *"Aramak için en az 2 karakter yaz"*
  // YALANINI görüyordu. Eski arama çubuğu da misafire açıktı, yani kusur bu
  // değişiklikten önce de vardı. Kök çözüm: yapamayacağı bir işin kapısını
  // hiç göstermemek — akıştaki "Ne düşünüyorsun?" kutusuyla AYNI koruma.
  if (!accessToken || isGuest) return null;

  return (
    <>
      <TouchableOpacity
        style={[styles.dugme, style]}
        onPress={() => setAcik(true)}
        activeOpacity={0.7}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        accessibilityRole="button"
        accessibilityLabel={t('searchOpen', 'Kişi ara')}
      >
        <UserSearch size={iconSize} color={iconColor} />
      </TouchableOpacity>
      <UserSearchSheet visible={acik} onClose={() => setAcik(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  // Akış başlığındaki web yenile düğmesiyle AYNI ölçü ve renkler.
  dugme: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#172033',
    borderWidth: 1,
    borderColor: '#22304A',
  },
});
