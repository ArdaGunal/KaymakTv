import React from 'react';
import { TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { UserX, UserCheck } from '../../../components/icons';
import { useBlockState } from '../hooks/useBlockState';
import { confirmAsync } from '../../../utils/confirmDialog';

interface BlockUserButtonProps {
  traktSlug: string;
}

/**
 * Profil sayfasındaki engelle/engeli kaldır butonu (bkz.
 * docs/FEED_SOCIAL_PLAN.md §4.5). Tek eylem olduğu için ayrı bir "..." açılır
 * menüsü yerine doğrudan ikonla gösteriliyor — kilitli/açık durumu ikonun
 * kendisinden okunur.
 */
export default function BlockUserButton({ traktSlug }: BlockUserButtonProps) {
  const { t } = useTranslation(['feed', 'common']);
  const { didIBlockThem, isMutating, isLoading, toggleBlock } = useBlockState(traktSlug);

  // Durum netleşmeden yanlış aksiyon (ör. engelliyken "Engelle" göstermek)
  // sunmamak için sessizce hiçbir şey render etmiyoruz.
  if (isLoading) return null;

  const handlePress = async () => {
    const confirmed = await confirmAsync(
      didIBlockThem ? t('unblockConfirmTitle', 'Engeli Kaldır?') : t('blockConfirmTitle', 'Kullanıcıyı Engelle?'),
      didIBlockThem
        ? t('unblockConfirmMessage', 'Bu kullanıcının aktivitelerini tekrar görmeye başlayacaksın.')
        : t(
            'blockConfirmMessage',
            'Bu kullanıcının aktivitelerini ve yorumlarını bir daha görmeyeceksin. Bu işlem Trakt hesabındaki takip durumunu ETKİLEMEZ.'
          ),
      didIBlockThem ? t('unblock', 'Engeli Kaldır') : t('block', 'Engelle'),
      t('cancel', 'Vazgeç')
    );
    if (!confirmed) return;
    try {
      await toggleBlock();
    } catch {
      // ESKİDEN burada HİÇBİR ŞEY yapılmıyordu ("hata zaten hook'ta loglanıyor"
      // notuyla) — kullanıcı "Engelle"ye basıp onaylıyor, istek başarısız
      // oluyor ve ekranda hiçbir şey değişmiyordu: buton "çalışmıyor" gibi
      // görünüyordu. docs/AI_RULES.md § "Sessiz başarısızlık YASAKTIR" ihlali.
      Alert.alert(t('common:error'), t('common:actionFailedMessage'));
    }
  };

  return (
    <TouchableOpacity style={styles.btn} onPress={handlePress} disabled={isMutating} activeOpacity={0.7} hitSlop={8}>
      {isMutating ? (
        <ActivityIndicator size="small" color="#94a3b8" />
      ) : didIBlockThem ? (
        <UserCheck size={18} color="#4ade80" />
      ) : (
        <UserX size={18} color="#94a3b8" />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
});
