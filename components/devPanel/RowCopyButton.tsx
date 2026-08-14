import React, { memo, useState } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Copy, Check } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';

interface RowCopyButtonProps {
  /** Kopyalanacak TEK kaydın kendisi — JSON.stringify burada, çağıran
   * tarafta değil yapılır (her satırın kendi kopyalama mantığını
   * tekrarlamaması için). */
  value: unknown;
}

const RESET_DELAY_MS = 1200;

/** Tek bir performans/hata satırını panoya kopyalayan mikro-buton. Her satır
 * için AYRI bir Snackbar/toast GÖSTERMEZ (kullanıcı art arda birkaç satır
 * kopyalarsa arka arkaya toast yağmuru olurdu) — bunun yerine ikon kendi
 * içinde kısaca ✓'a döner. Kullanıcı tek bir kaydı alıp buraya (sohbete)
 * yapıştırabilsin diye eklendi. */
const RowCopyButton = memo(({ value }: RowCopyButtonProps) => {
  const [copied, setCopied] = useState(false);

  const handlePress = async () => {
    try {
      await Clipboard.setStringAsync(JSON.stringify(value, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), RESET_DELAY_MS);
    } catch {
      // Sessizce yoksay — bu bir mikro-etkileşim, başarısız olursa ikon
      // eski hâline döner, kullanıcı tekrar dener.
    }
  };

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={handlePress}
      activeOpacity={0.6}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      {copied ? <Check size={14} color="#4ade80" /> : <Copy size={14} color="#64748b" />}
    </TouchableOpacity>
  );
});

export default RowCopyButton;

const styles = StyleSheet.create({
  button: {
    padding: 4,
  },
});
