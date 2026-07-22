import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

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
  /** true → ekranın ortasında modal (web/masaüstü); false → alttan açılan sheet (mobil). */
  wide?: boolean;
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
  wide = false,
}: LibraryFilterModalProps<TKey>) {
  const { t } = useTranslation('navigation');
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<TKey[]>(selected);

  // Menü her açılışta uygulanmış durumla senkronlanır: kullanıcı önceki
  // seferde "Göster"e basmadan kapattıysa o yarım seçim geri gelmemeli.
  useEffect(() => {
    if (visible) setDraft(selected);
  }, [visible, selected]);

  // Web'de Escape ile kapatma — masaüstü modal beklentisi.
  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [visible, onClose]);

  const toggle = useCallback((key: TKey) => {
    setDraft((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    );
  }, []);

  const handleApply = useCallback(() => {
    onApply(draft);
    onClose();
  }, [draft, onApply, onClose]);

  // Alttan açılan sheet'te "Temizle / Göster" butonları, Android'in gezinme
  // çubuğunun (ve iOS'un home göstergesinin) ALTINDA kalıyordu — modal
  // `statusBarTranslucent` ile sistem çubuklarının altına uzandığı için sabit
  // `paddingBottom` yetmiyor. Güvenli alan kadar ek boşluk bırakılıyor; inset
  // 0 dönen cihazlarda da parmağa rahat bir pay kalsın diye taban 16px.
  const sheetPaddingBottom = Math.max(insets.bottom, 16) + 16;

  return (
    <Modal
      visible={visible}
      transparent
      animationType={wide ? 'fade' : 'slide'}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={[styles.overlay, wide && styles.overlayWide]} onPress={onClose}>
        {/* Panelin kendisine dokunmak menüyü kapatmamalı. */}
        <Pressable
          style={[styles.panel, wide ? styles.panelWide : { paddingBottom: sheetPaddingBottom }]}
          onPress={() => {}}
        >
          {!wide ? <View style={styles.grabber} /> : null}

          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <X size={20} color="#94a3b8" />
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
                  {isChecked ? <Check size={14} color="#0b1120" strokeWidth={3} /> : null}
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
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  overlayWide: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(2,6,23,0.72)',
  },
  panel: {
    backgroundColor: '#111827',
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderColor: '#1f2937',
  },
  panelWide: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 18,
    borderWidth: 1,
    paddingTop: 20,
    paddingBottom: 20,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#334155',
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    color: '#f8fafc',
    fontSize: 17,
    fontWeight: '700',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1c2537',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#38bdf8',
    borderColor: '#38bdf8',
  },
  optionText: {
    flex: 1,
    color: '#cbd5e1',
    fontSize: 15,
    fontWeight: '500',
  },
  optionTextChecked: {
    color: '#f8fafc',
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
    backgroundColor: '#1a2333',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  clearText: {
    color: '#cbd5e1',
    fontSize: 15,
    fontWeight: '600',
  },
  clearTextDisabled: {
    color: '#475569',
  },
  applyButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#38bdf8',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  applyText: {
    color: '#04121f',
    fontSize: 15,
    fontWeight: '700',
  },
});
