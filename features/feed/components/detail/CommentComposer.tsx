import React, { forwardRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Send, EyeOff } from '../../../../components/icons';

export const COMMENT_MAX_LENGTH = 500;

interface Props {
  value: string;
  onChange: (v: string) => void;
  spoiler: boolean;
  onToggleSpoiler: () => void;
  onSend: () => void;
  isSubmitting: boolean;
  error: string | null;
  autoFocus?: boolean;
  bottomInset: number;
}

/**
 * C2 · Detay sayfasının altına sabit yorum kutusu (taslak A). Eski alttan açılan
 * yorum penceresinin (FeedCommentSheet) yerini aldı: aynı 500 karakter sınırı,
 * aynı spoiler işareti — anahtar yerine göz ikonu.
 */
const CommentComposer = forwardRef<TextInput, Props>(function CommentComposer(
  { value, onChange, spoiler, onToggleSpoiler, onSend, isSubmitting, error, autoFocus, bottomInset },
  ref
) {
  const { t } = useTranslation('feed');
  const uzunluk = value.trim().length;
  const asim = uzunluk > COMMENT_MAX_LENGTH;
  const gonderilebilir = uzunluk > 0 && !asim && !isSubmitting;
  const sayacGorunur = uzunluk > COMMENT_MAX_LENGTH - 100;

  return (
    <View style={[styles.wrap, { paddingBottom: 10 + bottomInset }]}>
      {!!error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.row}>
        <TextInput
          ref={ref}
          style={styles.input}
          value={value}
          onChangeText={onChange}
          placeholder={t('detailCommentPlaceholder', 'Yorumunu yaz…')}
          placeholderTextColor="#64748b"
          multiline
          autoFocus={autoFocus}
          maxLength={COMMENT_MAX_LENGTH + 50}
          editable={!isSubmitting}
        />
        <TouchableOpacity
          onPress={onToggleSpoiler}
          style={[styles.iconBtn, spoiler && styles.iconBtnOn]}
          hitSlop={6}
          accessibilityRole="switch"
          accessibilityState={{ checked: spoiler }}
          accessibilityLabel={t('spoilerToggle', 'Spoiler içeriyor')}
        >
          <EyeOff size={17} color={spoiler ? '#fbbf24' : '#64748b'} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.send, !gonderilebilir && styles.sendOff]}
          onPress={onSend}
          disabled={!gonderilebilir}
          accessibilityRole="button"
          accessibilityLabel={t('detailSend', 'Gönder')}
        >
          {isSubmitting ? <ActivityIndicator size="small" color="#fff" /> : <Send size={16} color="#fff" />}
        </TouchableOpacity>
      </View>
      {(spoiler || sayacGorunur) && (
        <View style={styles.footer}>
          <Text style={styles.footerText}>{spoiler ? t('detailSpoilerOn', 'Spoiler olarak işaretlenecek') : ''}</Text>
          {sayacGorunur && (
            <Text style={[styles.footerText, asim && styles.over]}>
              {uzunluk}/{COMMENT_MAX_LENGTH}
            </Text>
          )}
        </View>
      )}
    </View>
  );
});

export default CommentComposer;

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: 1,
    borderTopColor: '#22304A',
    backgroundColor: '#0e1628',
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: '#172033',
    borderWidth: 1,
    borderColor: '#22304A',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    color: '#f1f5f9',
    fontSize: 14,
  },
  iconBtn: { width: 36, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  iconBtnOn: { backgroundColor: 'rgba(251,191,36,0.12)' },
  send: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#3b82f6', alignItems: 'center', justifyContent: 'center' },
  sendOff: { opacity: 0.4 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingHorizontal: 6 },
  footerText: { color: '#64748b', fontSize: 11 },
  over: { color: '#f87171' },
  error: { color: '#f87171', fontSize: 12, marginBottom: 6, paddingHorizontal: 6 },
});
