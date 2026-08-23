import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { Link2, X, ArrowRight } from '../icons';
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
  const { buttonElementId, loadError, requestRender } = useGoogleSignIn(onCredential);
  const isWeb = Platform.OS === 'web';

  // Köprü kartı kapandığında (İptal) konteyner tekrar GÖRÜNÜR hâle gelir —
  // güvenlik ağı olarak çizimi bir kez daha talep ediyoruz. İdempotent:
  // konteyner zaten doluysa hook hiçbir şey yapmaz.
  useEffect(() => {
    if (!awaitingTraktLink) requestRender();
  }, [awaitingTraktLink, requestRender]);

  // Native'de Google yok; köprü kartı da yoksa gösterilecek hiçbir şey kalmaz.
  if (!isWeb && !awaitingTraktLink) return null;

  const bridgeCard = awaitingTraktLink ? (
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
  ) : null;

  // ═════════════════════════════════════════════════════════════════════════
  // 🔴 KONTEYNER ARTIK ASLA UNMOUNT EDİLMİYOR — 2026-08-22, canlıda ölçüldü
  // ═════════════════════════════════════════════════════════════════════════
  // ESKİ YAPI: `if (awaitingTraktLink) return <linkCard/>` şeklinde ERKEN
  // ÇIKIŞ vardı — köprü kartı açıkken GIS konteyneri DOM'dan tamamen
  // siliniyordu. `useGoogleSignIn`'in çizim denemesi `[]` bağımlılıkla tek
  // seferlikti, dolayısıyla kullanıcı "İptal"e bastığında konteyner BOŞ
  // olarak geri geliyor ve buton bir daha ASLA çizilmiyordu.
  //
  // Tarayıcıda ölçülen kanıt (İptal sonrası):
  //   containerExists: true, containerChildren: 0, gisIframe: false
  // Kullanıcının "Google ile giriş kafasına göre görünüp yok oluyor"
  // şikayetinin kök nedeni buydu.
  //
  // YENİ YAPI: tek bir kök `View`, İÇİNDEKİLERİN SIRASI SABİT. Konteyner
  // (`gisOuter`) her zaman AYNI indekste duruyor — koşullu kardeşler `false`
  // döndüğünde bile React o slotu koruyor, yani konteyner unmount/remount
  // OLMUYOR, yalnızca `display:none` ile gizleniyor. GIS'in çizdiği iframe
  // köprü kartı boyunca hayatta kalıyor ve İptal'de anında geri geliyor.
  //
  // Ayrıca (2026-08-21 kullanıcı geri bildirimi): Trakt butonu onay kutusu
  // işaretlenene kadar hep GÖRÜNÜR kalıp yalnızca soluklaşırken, Google
  // butonu `display:none` ile TAMAMEN kayboluyordu. Artık Google da AYNI
  // muameleyi görüyor: her zaman görünür, yalnızca soluk. GIS'in çizdiği
  // gerçek `<div>`'i programatik "disabled" yapmanın yolu yok (üçüncü parti,
  // kendi tıklama işleyicisi var) — bu yüzden `!isChecked` iken görünmez bir
  // overlay konteyneri kaplayıp tıklamayı YUTUYOR.
  return (
    <View style={styles.buttonWrap}>
      {isWeb && !awaitingTraktLink && !isChecked && (
        <Text style={styles.disabledHint}>
          {t('settings:googleNeedsTermsAccept', 'Google ile devam etmek için önce kullanım koşullarını kabul et.')}
        </Text>
      )}

      {/* ⛔ BU BLOĞU KOŞULLU HÂLE GETİRMEYİN (yalnızca `isWeb` sabiti hariç,
          o oturum boyunca değişmez). Unmount edilirse yukarıdaki kusur
          aynen geri döner. Gizlemek için `gisHidden` kullanın. */}
      {isWeb && (
        <View style={[styles.gisOuter, awaitingTraktLink && styles.gisHidden]}>
          <View nativeID={buttonElementId} style={[styles.gisContainer, !isChecked && styles.gisContainerDisabled]} />
          {/* Trakt butonunun `disabled` prop'uyla sessizce hiçbir şey yapmama
              davranışıyla SİMETRİK — üstteki `disabledHint` zaten sebebi
              anlatıyor, ekstra bir toast/uyarı eklenmiyor. */}
          <View style={StyleSheet.absoluteFill} pointerEvents={isChecked ? 'none' : 'auto'} />
        </View>
      )}

      {isWeb && !awaitingTraktLink && loadError && <Text style={styles.errorText}>{loadError}</Text>}

      {bridgeCard}
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
  // Köprü kartı açıkken konteyner GİZLENİR ama DOM'da KALIR — unmount
  // edilirse GIS'in çizdiği buton yok olur ve geri gelmez (bkz. yukarıdaki
  // "KONTEYNER ARTIK ASLA UNMOUNT EDİLMİYOR" başlığı).
  gisHidden: {
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
    // Artık ortalanmış bir kök `View`'ın (buttonWrap) içinde — kendi
    // genişliğini almazsa içeriğine göre daralırdı.
    alignSelf: 'stretch',
    width: '100%',
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
