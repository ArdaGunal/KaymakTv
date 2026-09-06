import React from 'react';
import { View, Text, Modal, TouchableOpacity, TouchableWithoutFeedback, StyleSheet } from 'react-native';

/**
 * Uygulama diline uygun onay kutusu — yerel `Alert.alert` yerine.
 *
 * 🔴 NEDEN `utils/confirmDialog.ts` YETMİYOR: o dosya platformun KENDİ
 * diyaloğunu açıyor (Android'de sistem alert'i, web'de `window.confirm`).
 * İkisi de işlevsel ama uygulamanın görsel dilinin DIŞINDA duruyor ve
 * `window.confirm` düğme etiketlerini bile yansıtamıyor (sabit "OK/Cancel"
 * — gerekçe o dosyanın başlığında yazılı). Kullanıcı kararı (2026-09-06):
 * *"emin misiniz sorusu siteye daha da yakışır bir kutucuk ile sorulabilir."*
 *
 * ⚠️ `confirmDialog.ts` SİLİNMEDİ ve silinmemeli: bu bileşen React ağacında
 * bir mount noktası gerektiriyor, `confirmAsync` ise her yerden (hook, servis,
 * olay işleyici) çağrılabilen bir `Promise`. Farklı ihtiyaçlar.
 *
 * 🔴 Görsel dil `components/RatingModal.tsx` ile BİREBİR aynı (aynı zemin,
 * aynı köşe yarıçapı, aynı karartma) — iki farklı modal dili uygulamayı
 * yamalı gösterirdi.
 */

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Onay düğmesi kırmızı çizilir (silme gibi geri alınamaz işlemler). */
  destructive?: boolean;
  /** Başlığın üstünde gösterilecek ikon — çağıran verir (ikon bütçesi). */
  icon?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  icon,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  // 🔴 GÖRÜNMEZKEN HİÇ RENDER ETME — `visible={false}`'a GÜVENME.
  // Ölçüldü (2026-09-06, tarayıcı): yalnızca `visible` prop'una bırakılınca
  // kutu KAPANMIYORDU. Belirti yanıltıcıydı: "Temizle" işini yapıyor (liste
  // gerçekten boşalıyor, yani `onPress` ve `setState` çalışıyor) ama kutu
  // ekranda kalıyordu; kullanıcı işlemin başarısız olduğunu sanırdı.
  // Erken `return null` mount'u yapısal olarak keser — `visible` prop'u yine
  // veriliyor ki native tarafta animasyon/geri-tuşu davranışı bozulmasın.
  if (!visible) return null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      // Android geri tuşu = vazgeç. Verilmezse diyalog geri tuşuyla kapanır
      // ama hiçbir dal çalışmaz ve çağıran sonsuza kadar bekler
      // (`confirmDialog.ts`'te `onDismiss` ile çözülen AYNI tuzak).
      onRequestClose={onCancel}
    >
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={styles.overlay}>
          {/* Kutunun içine dokunmak kapatmasın. */}
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.content}>
              {icon ? <View style={styles.iconWrap}>{icon}</View> : null}

              <Text style={styles.title}>{title}</Text>
              <Text style={styles.message}>{message}</Text>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={onCancel}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                >
                  <Text style={styles.cancelText}>{cancelLabel}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, destructive ? styles.destructiveButton : styles.confirmButton]}
                  onPress={onConfirm}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                >
                  <Text style={styles.confirmText}>{confirmLabel}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // `RatingModal.tsx` ile aynı karartma ve zemin.
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    backgroundColor: '#0B1120',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    // Geniş ekranda (tablet/web) kutu ekranı boydan boya kaplamasın.
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(239,68,68,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  message: {
    color: '#94a3b8',
    fontSize: 13.5,
    lineHeight: 20,
    marginBottom: 22,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  cancelText: { color: '#cbd5e1', fontSize: 14, fontWeight: '700' },
  confirmButton: { backgroundColor: '#2563eb' },
  destructiveButton: { backgroundColor: '#dc2626' },
  confirmText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
});
