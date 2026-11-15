import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import CardMenu from '../../feed/components/CardMenu';
import { useBlockState } from '../../feed/hooks/useBlockState';
import { confirmAsync, notify } from '../../../utils/confirmDialog';

interface ProfilMenusuProps {
  /** 🪪 `users.id` — Trakt slug'ı DEĞİL (M339 · `BACKLOG` §F6). */
  targetUserId: string;
  /** «Profili bildir» — `ReportContentModal`'ı açar (Adım 4c, M609). */
  onReport: () => void;
}

/**
 * Başkasının profilinde sağ üst «⋮» menüsü — 1.0.1 (kullanıcı kararı, 2026-11-15).
 * Eskiden sağ üstte yalnız engelle simgesi, «Profili bildir» ise ad bloğunun altında ayrı
 * bağlantıydı. İkisi tek menüde: «Profili bildir» + «Kullanıcıyı Engelle» / «Engeli Kaldır».
 * Google Play UGC politikası uygulama içinde bildirme ve engelleme yolu ister, ayrı düğme
 * şart koşmaz; akış kartlarındaki ⋮ menüsüyle aynı kalıp (`CardMenu`).
 *
 * - Engel durumu netleşmeden engelle satırı gösterilmez (yanlış eylem sunmamak); bildir her zaman var.
 * - Engelleme kırmızı ve onaylı; engeli kaldırmak yıkıcı değil (2.6.8 SEZON-02).
 * - Hata görünür bildirilir (AI_RULES §2 «sessiz başarısızlık yasak»).
 */
export default function ProfilMenusu({ targetUserId, onReport }: ProfilMenusuProps) {
  const { t } = useTranslation(['feed', 'common']);
  const { didIBlockThem, isMutating, isLoading, toggleBlock } = useBlockState(targetUserId);

  const engelDegistir = async () => {
    const onay = await confirmAsync(
      didIBlockThem ? t('unblockConfirmTitle', 'Engeli Kaldır?') : t('blockConfirmTitle', 'Kullanıcıyı Engelle?'),
      didIBlockThem
        ? t('unblockConfirmMessage', 'Bu kullanıcının aktivitelerini tekrar görmeye başlayacaksın.')
        : t('blockConfirmMessage', 'Bu kullanıcının aktivitelerini ve yorumlarını bir daha görmeyeceksin. Bu işlem Trakt hesabındaki takip durumunu ETKİLEMEZ.'),
      didIBlockThem ? t('unblock', 'Engeli Kaldır') : t('block', 'Engelle'),
      t('cancel', 'Vazgeç'),
      { destructive: !didIBlockThem }
    );
    if (!onay) return;
    try {
      await toggleBlock();
    } catch {
      notify(t('common:error'), t('common:actionFailedMessage'));
    }
  };

  return (
    <CardMenu
      onReport={onReport}
      reportLabel={t('reportProfile', 'Profili bildir')}
      onBlock={isLoading || isMutating ? undefined : engelDegistir}
      blocked={didIBlockThem}
      iconSize={20}
      style={styles.tetik}
    />
  );
}

const styles = StyleSheet.create({
  // Üst çubuktaki geri düğmesiyle aynı yuvarlak yüzey.
  tetik: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
});
