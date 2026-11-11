import { StyleSheet, Platform } from 'react-native';
import { nativeColor, nativeTint } from '../../constants/mobilePalette';

// `app/(public)/settings.tsx`'ten çıkarıldı (400 satır kuralı, AI_RULES §1) —
// 2026-08-21 giriş ekranı redesign'ı dosyayı sınırın üstüne taşırdı.
//
// ⚠️ BİLİNÇLİ OLARAK `app/(public)/` DEĞİL `components/settings/` altında:
// Expo Router `app/` altındaki her dosyayı olası bir route sanıp tarıyor —
// aynı gün (Madde 222) `download.web.styles.ts` gibi dosyalar tam bu yüzden
// tüm uygulamayı beyaz ekranla çökertmişti. Saf stil dosyası, mantık yok.
export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: nativeColor('background', '#0f172a'),
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    paddingTop: 80, // Dil butonuna ve safe area'ya yer açmak için
  },
  contentWrapper: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  desktopCard: {
    backgroundColor: nativeColor('surface', 'rgba(30, 41, 59, 0.7)'),
    padding: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: nativeColor('border', 'rgba(51, 65, 85, 0.8)'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 15,
    ...(Platform.OS === 'web' && {
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
    } as any),
  },
  headerContainer: {
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    color: nativeColor('text', '#e2e8f0'),
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: nativeColor('muted', '#94a3b8'),
    textAlign: 'center',
  },
  formContainer: {
    gap: 16,
  },
  description: {
    color: nativeColor('body', '#cbd5e1'),
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 8,
  },
  button: {
    backgroundColor: nativeColor('primary', '#2563eb'),
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: nativeTint('primary', 0.5, '#3b82f680'),
  },
  buttonText: {
    color: nativeColor('text', '#ffffff'),
    fontWeight: '600',
    fontSize: 16,
  },
  tertiaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  tertiaryLinkText: {
    color: nativeColor('muted', '#94a3b8'),
    fontWeight: '500',
    fontSize: 14,
  },
  tertiarySeparator: {
    color: nativeColor('border', '#334155'),
    fontSize: 14,
  },
  miniDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    paddingHorizontal: 32,
  },
  miniDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: nativeColor('border', '#334155'),
  },
  miniDividerText: {
    color: nativeColor('mutedDeep', '#64748b'),
    paddingHorizontal: 12,
    fontSize: 11,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    paddingHorizontal: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: nativeColor('border', '#334155'),
  },
  dividerText: {
    color: nativeColor('mutedDeep', '#64748b'),
    paddingHorizontal: 16,
    fontSize: 12,
    fontWeight: 'bold',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    gap: 10,
    paddingHorizontal: 8,
  },
  checkboxText: {
    color: nativeColor('body', '#cbd5e1'),
    fontSize: 13,
    flexShrink: 1,
  },
  linkText: {
    color: nativeColor('steel', '#3b82f6'),
    textDecorationLine: 'underline',
  },
  pollingText: {
    color: nativeColor('muted', '#94a3b8'),
    marginTop: 8,
    fontSize: 14,
    textAlign: 'center',
  },
  topRightLangButton: {
    position: 'absolute',
    top: 50,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: nativeColor('raised', '#1e293b'),
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: nativeColor('border', '#334155'),
    zIndex: 10,
  },
  topRightLangText: {
    color: nativeColor('text', '#e2e8f0'),
    fontWeight: 'bold',
    fontSize: 14,
  },
});
