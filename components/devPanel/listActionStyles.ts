import { StyleSheet } from 'react-native';

/** Performans ve Hata Günlüğü sekmelerinin üstündeki "Temizle"/"Kopyala"
 * eylem satırının ORTAK stili — iki sekme de birebir aynı görünümü kullanır. */
export const listActionStyles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 20,
    gap: 10,
  },
});
