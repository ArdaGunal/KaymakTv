import { nativeColor } from '../../constants/mobilePalette';
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Check, X } from '../icons';
import { useTranslation } from 'react-i18next';
import OrtaPencere from '../modals/OrtaPencere';

export interface FilterOption<TKey extends string> {
  key: TKey;
  label: string;
}

interface LibraryFilterModalProps<TKey extends string> {
  visible: boolean;
  /** Gösterilecek kategoriler ve ÇÖZÜLMÜŞ etiketleri — sırası ekranda da aynen korunur. */
  options: ReadonlyArray<FilterOption<TKey>>;
  /** Menü açıldığında taslak seçimin başlayacağı, hâlihazırda UYGULANMIŞ seçim. */
  selected: TKey[];
  title: string;
  onApply: (next: TKey[]) => void;
  onClose: () => void;
}

/**
 * Çoklu seçimli kategori filtresi — medya tipinden BAĞIMSIZ. Diziler 4, filmler
 * 3 kategoriyle kullanır; bileşen hangi kategorilerin var olduğunu bilmez,
 * etiketleri de çözmez (çağıran ekran çözülmüş `options` verir). Böylece yeni
 * bir medya tipi eklendiğinde burası hiç değişmek zorunda kalmaz.
 *
 * Seçimler TASLAK olarak tutulur; liste yalnızca kullanıcı "Göster"e bastığında
 * güncellenir — böylece menü açıkken arkadaki grid her dokunuşta yeniden
 * düzenlenip zıplamaz.
 */
export default function LibraryFilterModal<TKey extends string>({
  visible,
  options,
  selected,
  title,
  onApply,
  onClose,
}: LibraryFilterModalProps<TKey>) {
  const { t } = useTranslation('navigation');
  const [draft, setDraft] = useState<TKey[]>(selected);

  // Menü her açılışta uygulanmış durumla senkronlanır: kullanıcı önceki
  // seferde "Göster"e basmadan kapattıysa o yarım seçim geri gelmemeli.
  useEffect(() => {
    if (visible) setDraft(selected);
  }, [visible, selected]);

  const toggle = useCallback((key: TKey) => {
    setDraft((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    );
  }, []);

  const handleApply = useCallback(() => {
    onApply(draft);
    onClose();
  }, [draft, onApply, onClose]);

  // 2.6.8 MENU-01: telefonda da ekranın ortasında (`OrtaPencere`); eskiden yalnız
  // geniş ekranda ortadaydı, telefonda alttan açılıyordu.
  return (
    <OrtaPencere visible={visible} onClose={onClose} maxWidth={420}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <X size={20} color={nativeColor('muted', "#94a3b8")} />
        </TouchableOpacity>
      </View>

      {options.map((option) => {
        const isChecked = draft.includes(option.key);
        return (
          <TouchableOpacity
            key={option.key}
            style={styles.optionRow}
            onPress={() => toggle(option.key)}
            activeOpacity={0.7}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isChecked }}
          >
            <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
              {isChecked ? <Check size={14} color={nativeColor('background', "#0b1120")} strokeWidth={3} /> : null}
            </View>
            <Text style={[styles.optionText, isChecked && styles.optionTextChecked]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.clearButton}
          onPress={() => setDraft([])}
          disabled={draft.length === 0}
          activeOpacity={0.7}
        >
          <Text style={[styles.clearText, draft.length === 0 && styles.clearTextDisabled]}>
            {t('clearFilters', 'Temizle')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.applyButton} onPress={handleApply} activeOpacity={0.85}>
          <Text style={styles.applyText}>{t('applyFilters', 'Göster')}</Text>
        </TouchableOpacity>
      </View>
    </OrtaPencere>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    color: nativeColor('text', '#f8fafc'),
    fontSize: 17,
    fontWeight: '700',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: nativeColor('border', '#1c2537'),
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: nativeColor('mutedDeep', '#475569'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: nativeColor('steel', '#38bdf8'),
    borderColor: nativeColor('steel', '#38bdf8'),
  },
  optionText: {
    flex: 1,
    color: nativeColor('body', '#cbd5e1'),
    fontSize: 15,
    fontWeight: '500',
  },
  optionTextChecked: {
    color: nativeColor('text', '#f8fafc'),
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
  },
  clearButton: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: nativeColor('raised', '#1a2333'),
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  clearText: {
    color: nativeColor('body', '#cbd5e1'),
    fontSize: 15,
    fontWeight: '600',
  },
  clearTextDisabled: {
    color: nativeColor('mutedDeep', '#475569'),
  },
  applyButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: nativeColor('steel', '#38bdf8'),
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  applyText: {
    color: nativeColor('background', '#04121f'),
    fontSize: 15,
    fontWeight: '700',
  },
});
