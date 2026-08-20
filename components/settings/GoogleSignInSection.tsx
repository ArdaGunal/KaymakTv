import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { Link2, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useGoogleSignIn } from '../../hooks/useGoogleSignIn';

/**
 * F8 — `app/(public)/settings.tsx`'teki Google ile giriş bloğu, dosyayı
 * 400 satır sınırının altında tutmak için ayrıldı (bkz. docs/AI_RULES.md §1).
 *
 * Mantığın kendisi (kimlik kanıtını AsyncStorage'da saklama, Trakt
 * doğrulamasıyla tamamlama, `handleTokenExchange`'e bağlanma) BİLİNÇLİ
 * OLARAK burada DEĞİL, `settings.tsx`'te kalıyor — `TraktAccountSection.tsx`
 * başlığındaki uyarıyla aynı gerekçe: OAuth akışının TEK giriş noktası
 * `settings.tsx` olmalı, mantığı ikinci bir bileşene dağıtmak geçmişte
 * `invalid_grant` hatasına yol açan aynı "iki yerden aynı kodu yönetme"
 * hatasını tekrarlardı. Bu bileşen yalnızca GÖRÜNÜM.
 */
interface GoogleSignInSectionProps {
  isChecked: boolean;
  isGenerating: boolean;
  canPromptTrakt: boolean;
  awaitingTraktLink: boolean;
  onCredential: (idToken: string, nonce: string) => void;
  onContinueWithTrakt: () => void;
  onCancelLink: () => void;
}

export function GoogleSignInSection({
  isChecked,
  isGenerating,
  canPromptTrakt,
  awaitingTraktLink,
  onCredential,
  onContinueWithTrakt,
  onCancelLink,
}: GoogleSignInSectionProps) {
  const { t } = useTranslation(['settings', 'common']);
  const { buttonElementId, loadError } = useGoogleSignIn(onCredential);

  if (awaitingTraktLink) {
    return (
      <View style={styles.linkCard}>
        <Link2 size={18} color="#38bdf8" />
        <Text style={styles.linkText}>
          {t('settings:googleLinkPrompt', 'Google hesabınla giriş yapıldı. Tamamlamak için Trakt hesabınla da doğrula.')}
        </Text>
        <TouchableOpacity
          style={[styles.traktButton, (!canPromptTrakt || isGenerating) && styles.traktButtonDisabled]}
          activeOpacity={0.8}
          onPress={onContinueWithTrakt}
          disabled={!canPromptTrakt || isGenerating}
        >
          {isGenerating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.traktButtonText}>{t('loginTrakt')}</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelButton} activeOpacity={0.7} onPress={onCancelLink}>
          <X size={14} color="#94a3b8" />
          <Text style={styles.cancelText}>{t('common:cancel')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 🔴 YALNIZCA WEB — bkz. hooks/useGoogleSignIn.ts başlığı (iOS/Android
  // client ID'leri hâlâ yer tutucu, native taraf bilinçli olarak ertelendi).
  if (Platform.OS !== 'web') return null;

  // 🔴 CANLI TARAYICI TESTİNDE BULUNDU: `nativeID={buttonElementId}` konteyneri
  // eskiden yalnızca `isChecked` true'ken JSX'e giriyordu. `useGoogleSignIn`
  // içindeki `useEffect` MONTAJDA (ilk render, `isChecked` henüz false'ken)
  // bir kez çalışıp `document.getElementById(buttonElementId)` arıyor —
  // konteyner o an DOM'da YOK, `renderButton` sessizce atlanıyor. Kullanıcı
  // sonradan onay kutusunu işaretlediğinde konteyner DOM'a girse de hiçbir
  // şey `renderButton`'ı YENİDEN tetiklemiyor: buton SONSUZA DEK boş kalıyor.
  // Çözüm: konteyner HER ZAMAN DOM'da olsun (`renderButton` onu bulabilsin),
  // yalnızca GÖRÜNÜRLÜĞÜ `isChecked`'e göre değişsin.
  return (
    <View style={styles.buttonWrap}>
      {!isChecked && (
        <Text style={styles.disabledHint}>
          {t('settings:googleNeedsTermsAccept', 'Google ile devam etmek için önce kullanım koşullarını kabul et.')}
        </Text>
      )}
      {/* GIS bu ID'ye SAHİP DOM elemanını kendi butonuyla dolduruyor
          (bkz. hooks/useGoogleSignIn.ts) — RN bileşeni değil, GIS'in kendi
          çizdiği gerçek bir <div>. `isChecked` false iken `display:none` —
          `renderButton`'ın konteyneri bulabilmesi için DOM'dan hiç ÇIKARILMAZ. */}
      <View nativeID={buttonElementId} style={!isChecked ? styles.hidden : undefined} />
      {loadError && <Text style={styles.errorText}>{loadError}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  buttonWrap: {
    alignItems: 'center',
    gap: 8,
  },
  hidden: {
    display: 'none',
  },
  errorText: {
    color: '#f87171',
    fontSize: 12,
    textAlign: 'center',
  },
  disabledHint: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  linkCard: {
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(56,189,248,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.3)',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  linkText: {
    color: '#e2e8f0',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  traktButton: {
    alignSelf: 'stretch',
    marginTop: 4,
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  traktButtonDisabled: {
    backgroundColor: '#3b82f680',
  },
  traktButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  cancelText: {
    color: '#94a3b8',
    fontSize: 13,
  },
});
