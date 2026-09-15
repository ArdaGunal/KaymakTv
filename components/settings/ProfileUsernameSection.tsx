import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { User } from '../icons';
import EditProfileModal from '../modals/EditProfileModal';
import SettingsRow from './SettingsRow';
import { SettingsSection } from './SettingsSection';
import { useAuth } from '../../context/AuthContext';
import { useMyProfile } from '../../hooks/useMyProfile';

/**
 * `account.tsx`'in "Kullanıcı Adı" satırı + düzenleme modalı — Madde 227'de
 * eklendiğinde `account.tsx`'i 497→529 satıra çıkarmıştı (AI_RULES §1),
 * kullanıcı onayıyla ayrı bir bileşene taşındı. Tamamen kendi kendine
 * yeterli (`useAuth`/`useMyProfile`'ı kendi çağırıyor) — `account.tsx`
 * tarafında tek satırlık bir `<ProfileUsernameSection />` yeterli, prop
 * geçirmeye gerek yok.
 *
 * ==========================================================================
 * 🔴 "HAKKIMDA" BURADAN TAŞINDI (2026-09-15) — artık "Profili Düzenle"de
 * ==========================================================================
 * §C15 kapsamında bio satırı kısa bir süre burada durdu ve Trakt'lı
 * kullanıcıya da açıldı. Kullanıcı cihazda deneyip şunu söyledi:
 * *"ayarlar yerine profili düzenle seçeneğinde olması daha mantıklı."*
 * → Satır `screens/EditProfileMobile.tsx`'e taşındı; profil bilgisi profil
 * ekranında düzenleniyor.
 *
 * ➡️ Geriye YALNIZCA kullanıcı adı kaldı ve o Google-only: Trakt'lı hesapta
 * ad Trakt kimliğidir (bkz. `EditProfileModal.tsx` başlığı). Bu yüzden bölüm
 * yeniden sağlayıcı kapısının arkasında.
 *
 * 📌 Not: §C12'den (M331) sonra `verifyTraktCaller` var olan satırın
 * `username`'ine DOKUNMUYOR, yani eski *"bir sonraki girişte sessizce eski
 * hâline döner"* gerekçesi teknik olarak geçerliliğini yitirdi. Adı Trakt'lı
 * hesaba açmak yine de ayrı bir ÜRÜN kararı — bilinçli olarak yapılmadı.
 */
export default function ProfileUsernameSection() {
  const { t } = useTranslation(['settings']);
  const { isGuest, authProvider } = useAuth();
  const { profile, setProfile } = useMyProfile();
  const [editModalVisible, setEditModalVisible] = useState(false);

  if (isGuest || authProvider !== 'google' || !profile) return null;

  return (
    <>
      <SettingsSection title={t('settings:profileSection', 'Profil')}>
        <SettingsRow
          icon={<User size={20} color="#60a5fa" />}
          label={t('settings:usernameRowLabel', 'Kullanıcı Adı')}
          tintColor="#60a5fa"
          value={profile.username}
          showChevron
          onPress={() => setEditModalVisible(true)}
        />
      </SettingsSection>

      <EditProfileModal
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        currentUsername={profile.username}
        usernameUpdatedAt={profile.usernameUpdatedAt}
        onSaved={(username) =>
          setProfile((prev) => (prev ? { ...prev, username, usernameUpdatedAt: new Date().toISOString() } : prev))
        }
      />
    </>
  );
}
