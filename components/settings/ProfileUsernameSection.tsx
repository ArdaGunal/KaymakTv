import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { User } from '../icons';
import EditProfileModal from '../modals/EditProfileModal';
import SettingsRow from './SettingsRow';
import { SettingsSection } from './SettingsSection';
import { useAuth } from '../../context/AuthContext';
import { useMyGoogleProfile } from '../../hooks/useMyGoogleProfile';

/**
 * `account.tsx`'in "Kullanıcı Adı" satırı + düzenleme modalı — Madde 227'de
 * eklendiğinde `account.tsx`'i 497→529 satıra çıkarmıştı (AI_RULES §1),
 * kullanıcı onayıyla ayrı bir bileşene taşındı. Tamamen kendi kendine
 * yeterli (`useAuth`/`useMyGoogleProfile`'ı kendi çağırıyor) — `account.tsx`
 * tarafında tek satırlık bir `<ProfileUsernameSection />` yeterli, prop
 * geçirmeye gerek yok.
 *
 * Yalnızca Google-only kullanıcı için görünür — bkz. `EditProfileModal.tsx`
 * başlığı: Trakt kullanıcısının adı Trakt'tan senkronlanıyor, burada
 * göstermek/düzenletmek bir sonraki girişte sessizce eski hâline dönerdi.
 */
export default function ProfileUsernameSection() {
  const { t } = useTranslation(['settings']);
  const { isGuest, authProvider } = useAuth();
  const { profile, setProfile } = useMyGoogleProfile();
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
