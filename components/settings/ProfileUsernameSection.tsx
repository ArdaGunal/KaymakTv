import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { User, FileText } from '../icons';
import EditProfileModal from '../modals/EditProfileModal';
import EditBioModal from '../modals/EditBioModal';
import SettingsRow from './SettingsRow';
import { SettingsSection } from './SettingsSection';
import { useAuth } from '../../context/AuthContext';
import { useMyGoogleProfile } from '../../hooks/useMyGoogleProfile';

/**
 * `account.tsx`'in "Kullanıcı Adı" ve "Hakkımda" (T4 · `043`) satırları + düzenleme modalları — Madde 227'de
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
  const [bioModalVisible, setBioModalVisible] = useState(false);

  if (isGuest || authProvider !== 'google' || !profile) return null;

  // Satırda yalnızca ilk satırın başı — tamamı modalda. `Array.from`: emojiyi
  // ortasından bölmesin.
  const bioIlkSatir = profile.bio ? profile.bio.split('\n')[0] : '';
  const bioKesildi = Array.from(bioIlkSatir).length > 24 || (profile.bio ?? '').includes('\n');
  const bioOzeti = bioKesildi ? `${Array.from(bioIlkSatir).slice(0, 24).join('')}…` : bioIlkSatir;

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
        <SettingsRow
          icon={<FileText size={20} color="#a78bfa" />}
          label={t('settings:bioRowLabel', 'Hakkımda')}
          tintColor="#a78bfa"
          value={bioOzeti || t('settings:bioEmptyValue', 'Ekle')}
          showChevron
          onPress={() => setBioModalVisible(true)}
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

      <EditBioModal
        visible={bioModalVisible}
        onClose={() => setBioModalVisible(false)}
        currentBio={profile.bio ?? null}
        onSaved={(bio) => setProfile((prev) => (prev ? { ...prev, bio } : prev))}
      />
    </>
  );
}
