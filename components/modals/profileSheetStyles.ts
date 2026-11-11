import { StyleSheet } from 'react-native';
import { nativeColor, nativeTint } from '../../constants/mobilePalette';

// Alt sayfa (bottom sheet) düzenleme modallarının ORTAK görünümü —
// `EditProfileModal` (kullanıcı adı) ve `EditBioModal` (açıklama, T4 · `043`).
// `EditProfileModal`'dan AYNEN taşındı (M340); iki modal aynı iskeleti kopyalamasın.
export const profileSheetStyles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalOverlayCentered: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  backdropTouch: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    backgroundColor: nativeColor('surface', '#0F172A'),
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  modalContentWeb: {
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
    borderRadius: 20,
    marginBottom: 24,
  },
  modalContentCentered: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '85%',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: nativeColor('border', '#334155'),
  },
  modalScroll: { flexShrink: 1 },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    color: nativeColor('text', '#f8fafc'),
    fontSize: 20,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: nativeColor('text', '#fff'),
    padding: 14,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: nativeColor('border', '#334155'),
  },
  inputDisabled: {
    opacity: 0.5,
  },
  notice: {
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 9,
    paddingHorizontal: 11,
    marginTop: 12,
  },
  noticeInfo: {
    backgroundColor: nativeTint('steel', 0.08, 'rgba(56,189,248,0.08)'),
    borderColor: nativeTint('steel', 0.25, 'rgba(56,189,248,0.25)'),
  },
  noticeError: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderColor: 'rgba(239,68,68,0.28)',
  },
  noticeText: {
    fontSize: 12,
    lineHeight: 17,
  },
  noticeTextInfo: {
    color: nativeColor('steel', '#7dd3fc'),
  },
  noticeTextError: {
    color: '#fca5a5',
  },
  saveBtn: {
    backgroundColor: nativeColor('primary', '#3b82f6'),
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  saveBtnText: {
    color: nativeColor('text', '#fff'),
    fontSize: 16,
    fontWeight: '700',
  },
  disabledBtn: {
    opacity: 0.5,
  },
});
