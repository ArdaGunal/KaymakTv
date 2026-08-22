import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { Link2, X, ArrowRight } from 'lucide-react-native';
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
 *
 * 2026-08-21 — kullanıcı isteğiyle görsel olarak yenilendi: köprü kartı
 * (aşağıdaki `awaitingTraktLink` dalı) eskiden küçük/soluk bir metin +
 * düz butonlardan ibaretti ("insan algılayamıyor" geri bildirimi) —
 * `LoginPaywall.tsx`'in ikon-rozetli kart deseniyle hizalanan daha net bir
 * başlık/açıklama/CTA hiyerarşisine kavuşturuldu.
 */
interface GoogleSignInSectionProps {
  isChecked: boolean;
  isGenerating: boolean;
  canPromptTrakt: boolean;
  awaitingTraktLink: boolean;
  onCredential: (idToken: string, nonce: string) => void;
  onContinueWithTrakt: () => void;
  onCancelLink: () => void;
  // create_new: Trakt hesabı olmadan, yalnızca Google ile devam etme seçeneği.
  onContinueWithoutTrakt: () => void;
  isCreatingAccount: boolean;
}

export function GoogleSignInSection({
  isChecked,
  isGenerating,
  canPromptTrakt,
  awaitingTraktLink,
  onCredential,
  onContinueWithTrakt,
  onCancelLink,
  onContinueWithoutTrakt,
  isCreatingAccount,
}: GoogleSignInSectionProps) {
  const { t } = useTranslation(['settings', 'common']);
  const { buttonElementId, loadError } = useGoogleSignIn(onCredential);

  if (awaitingTraktLink) {
    return (
      <View style={styles.linkCard}>
        <View style={styles.linkIconBadge}>
          <Link2 size={26} color="#38bdf8" />
        </View>
        <Text style={styles.linkHeading}>{t('settings:googleLinkHeading', 'Bir Adım Kaldı')}</Text>
        <Text style={styles.linkText}>
          {t(
            'settings:googleLinkPrompt',
            'Google ile giriş yaptın. Kütüphaneni senkronlamak için Trakt hesabını bağlayabilir, ya da şimdilik Trakt olmadan devam edebilirsin.'
          )}
        </Text>

        <TouchableOpacity
          style={[styles.traktButton, (!canPromptTrakt || isGenerating || isCreatingAccount) && styles.disabledButton]}
          activeOpacity={0.8}
          onPress={onContinueWithTrakt}
          disabled={!canPromptTrakt || isGenerating || isCreatingAccount}
        >
          {isGenerating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.traktButtonText}>{t('loginTrakt')}</Text>
          )}
        </TouchableOpacity>

        {/* create_new — bkz. docs/HISTORY.md Madde 221. Trakt hesabı olmadan
            devam etmek isteyenler için; Kütüphane/Takvim gibi kişisel senkron
            gerektiren sekmeler bu durumda kendi "Trakt'a bağla" boş durumunu
            gösterir (bkz. LoginPaywall). */}
        <TouchableOpacity
          style={[styles.secondaryButton, (isCreatingAccount || isGenerating) && styles.disabledButton]}
          activeOpacity={0.8}
          onPress={onContinueWithoutTrakt}
          disabled={isCreatingAccount || isGenerating}
        >
          {isCreatingAccount ? (
            <ActivityIndicator size="small" color="#e2e8f0" />
          ) : (
            <View style={styles.secondaryButtonContent}>
              <Text style={styles.secondaryButtonText}>
                {t('settings:continueWithoutTrakt', "Trakt'sız Devam Et")}
              </Text>
              <ArrowRight size={16} color="#e2e8f0" />
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelButton} activeOpacity={0.7} onPress={onCancelLink} disabled={isCreatingAccount}>
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
  // Çözüm: konteyner HER ZAMAN DOM'da olsun (`renderButton` onu bulabilsin) —
  // bu hâlâ geçerli, aşağıdaki değişiklik yalnızca GÖRÜNÜRLÜK stratejisini
  // değiştiriyor, montaj stratejisini DEĞİL.
  //
  // 2026-08-22 — kullanıcı geri bildirimi: Trakt butonu onay kutusu
  // işaretlenene kadar hep GÖRÜNÜR kalıp yalnızca soluklaşırken
  // (`buttonDisabled`), Google butonu `display:none` ile TAMAMEN
  // KAYBOLUYORDU — bu asimetri "mantıksız/kafa karıştırıcı" bulundu. Artık
  // Google da AYNI muameleyi görüyor: her zaman görünür, yalnızca soluk.
  // GIS'in kendi çizdiği gerçek `<div>`'i programatik olarak "disabled"
  // yapmanın yolu yok (üçüncü parti, kendi tıklama işleyicisi var) — bu
  // yüzden `!isChecked` iken görünmez bir overlay konteynerin TAMAMINI
  // kaplayıp tıklamayı YUTUYOR; `isChecked` olunca `pointerEvents:'none'`'a
  // düşüp gerçek butonu serbest bırakıyor.
  return (
    <View style={styles.buttonWrap}>
      {!isChecked && (
        <Text style={styles.disabledHint}>
          {t('settings:googleNeedsTermsAccept', 'Google ile devam etmek için önce kullanım koşullarını kabul et.')}
        </Text>
      )}
      <View style={styles.gisOuter}>
        <View nativeID={buttonElementId} style={[styles.gisContainer, !isChecked && styles.gisContainerDisabled]} />
        {/* Trakt butonunun `disabled` prop'uyla sessizce hiçbir şey yapmama
            davranışıyla SİMETRİK — üstteki `disabledHint` zaten sebebi
            anlatıyor, ekstra bir toast/uyarı eklenmiyor. */}
        <View style={StyleSheet.absoluteFill} pointerEvents={isChecked ? 'none' : 'auto'} />
      </View>
      {loadError && <Text style={styles.errorText}>{loadError}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  buttonWrap: {
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  // Overlay'in `position:'absolute'` referans noktası — `gisContainer`'ın
  // KENDİSİ değil, onu saran bu `View` konumlanıyor (GIS'in çizdiği gerçek
  // butonun boyutlarına dokunulmasın diye).
  gisOuter: {
    width: '100%',
    position: 'relative',
  },
  gisContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  gisContainerDisabled: {
    opacity: 0.45,
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
    backgroundColor: 'rgba(56,189,248,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.25)',
    borderRadius: 20,
    padding: 24,
    marginTop: 4,
  },
  linkIconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(56,189,248,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  linkHeading: {
    color: '#f1f5f9',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  linkText: {
    color: '#94a3b8',
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  traktButton: {
    alignSelf: 'stretch',
    marginTop: 4,
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  traktButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
  secondaryButton: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  secondaryButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  secondaryButtonText: {
    color: '#e2e8f0',
    fontWeight: '600',
    fontSize: 15,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    marginTop: 2,
  },
  cancelText: {
    color: '#94a3b8',
    fontSize: 13,
  },
});
