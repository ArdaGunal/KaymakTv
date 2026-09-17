import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useFonts } from 'expo-font';
import { Quicksand_700Bold } from '@expo-google-fonts/quicksand/700Bold';

// Ana sekmelerin (Akış · Keşfet · Profil) ORTAK başlık satırı. Üç ekranda
// başlık aynı noktada, aynı font ve boyutta durur; sağ tarafa ekranın kendi
// düğmeleri (`actions`) konur. Yatay boşluğu çağıran verir — her ekranın
// içerik kenarı farklı (akış 680 px ortalı, keşfet 1280 px).
//
// Font yalnızca 700 ağırlığıyla, alt yoldan içe aktarılır (paketin kökü beş
// ağırlığın hepsini pakete katar). Yüklenene kadar sistem fontu görünür —
// yerel bir varlık olduğu için bu an milisaniyeler sürer, ekranı bekletmeye
// değmez.
export const SCREEN_TITLE_FONT = 'Quicksand_700Bold';

interface ScreenHeaderProps {
  title: string;
  actions?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export default function ScreenHeader({ title, actions, style }: ScreenHeaderProps) {
  const [fontLoaded] = useFonts({ [SCREEN_TITLE_FONT]: Quicksand_700Bold });

  return (
    <View style={[styles.row, style]}>
      <Text
        style={[styles.title, fontLoaded && styles.titleFont]}
        numberOfLines={1}
        accessibilityRole="header"
      >
        {title}
      </Text>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // RN'de minHeight dolguyu İÇERİR: 12 + 38 + 8. İçerik yüksekliği sağdaki
    // en büyük düğmeden (Profil ayarlar ≈38 px) büyük tutulur ki başlık
    // düğmeli ve düğmesiz ekranda AYNI noktada dursun (40'ta 2 px kayıyordu).
    minHeight: 58,
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: {
    color: '#f1f5f9',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 0.2,
    flexShrink: 1,
  },
  // Özel fontta `fontWeight` Android'de sentetik kalınlaştırmaya yol açar —
  // ağırlık zaten dosyanın kendisinde.
  titleFont: {
    fontFamily: SCREEN_TITLE_FONT,
    fontWeight: 'normal',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 12,
  },
});
