import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { User, FileText } from '../icons';
import EditProfileModal from '../modals/EditProfileModal';
import EditBioModal from '../modals/EditBioModal';
import SettingsRow from './SettingsRow';
import { SettingsSection } from './SettingsSection';
import { useAuth } from '../../context/AuthContext';
import { useMyProfile } from '../../hooks/useMyProfile';

/**
 * `account.tsx`'in "Kullanıcı Adı" ve "Hakkımda" (T4 · `043`) satırları + düzenleme modalları — Madde 227'de
 * eklendiğinde `account.tsx`'i 497→529 satıra çıkarmıştı (AI_RULES §1),
 * kullanıcı onayıyla ayrı bir bileşene taşındı. Tamamen kendi kendine
 * yeterli (`useAuth`/`useMyProfile`'ı kendi çağırıyor) — `account.tsx`
 * tarafında tek satırlık bir `<ProfileUsernameSection />` yeterli, prop
 * geçirmeye gerek yok.
 *
 * ==========================================================================
 * 🔴 KAPI BÖLÜMDEN SATIRA İNDİ (§C15, 2026-09-15)
 * ==========================================================================
 * Eskiden bölümün TAMAMI `authProvider !== 'google'` ise gizleniyordu ve
 * gerekçesi şuydu: *"Trakt kullanıcısının adı Trakt'tan senkronlanıyor,
 * burada düzenletmek bir sonraki girişte sessizce eski hâline dönerdi."*
 *
 * Gerekçe **kullanıcı adı** için doğru, **açıklama için değil.** Bio hiçbir
 * yerden senkronlanmıyor — T4'te bizim tablomuzda doğdu (`043`). Bölümü
 * toptan gizlemek, Trakt'lı kullanıcının kendi açıklamasını yazmasını
 * engelliyordu; profilinde hâlâ Trakt'ın `about`'u görünüyordu.
 *
 * ➡️ Artık: **bölüm herkese görünür**, `Kullanıcı Adı` satırı Google-only,
 * `Hakkımda` satırı sağlayıcıdan bağımsız.
 *
 * 📌 Not: §C12'den (M331) sonra `verifyTraktCaller` artık var olan satırın
 * `username`'ine DOKUNMUYOR, yani yukarıdaki "sessizce geri döner" gerekçesi
 * teknik olarak da geçerliliğini yitirdi. Kullanıcı adı satırını Trakt'lı
 * hesaba açmak yine de ayrı bir ÜRÜN kararı (ad orada Trakt kimliği) —
 * §C15'in kapsamı değil, bilinçli olarak dokunulmadı.
 */
export default function ProfileUsernameSection() {
  const { t } = useTranslation(['settings']);
  const { isGuest, authProvider } = useAuth();
  const { profile, setProfile } = useMyProfile();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [bioModalVisible, setBioModalVisible] = useState(false);

  if (isGuest || !profile) return null;

  /** Kullanıcı adı YALNIZCA Google-only'de düzenlenebilir (yukarıdaki not). */
  const adSatiriGorunur = authProvider === 'google';

  // Satırda yalnızca ilk satırın başı — tamamı modalda. `Array.from`: emojiyi
  // ortasından bölmesin.
  const bioIlkSatir = profile.bio ? profile.bio.split('\n')[0] : '';
  const bioKesildi = Array.from(bioIlkSatir).length > 24 || (profile.bio ?? '').includes('\n');
  const bioOzeti = bioKesildi ? `${Array.from(bioIlkSatir).slice(0, 24).join('')}…` : bioIlkSatir;

  return (
    <>
      <SettingsSection title={t('settings:profileSection', 'Profil')}>
        {adSatiriGorunur && (
          <SettingsRow
            icon={<User size={20} color="#60a5fa" />}
            label={t('settings:usernameRowLabel', 'Kullanıcı Adı')}
            tintColor="#60a5fa"
            value={profile.username}
            showChevron
            onPress={() => setEditModalVisible(true)}
          />
        )}
        <SettingsRow
          icon={<FileText size={20} color="#a78bfa" />}
          label={t('settings:bioRowLabel', 'Hakkımda')}
          tintColor="#a78bfa"
          value={bioOzeti || t('settings:bioEmptyValue', 'Ekle')}
          showChevron
          onPress={() => setBioModalVisible(true)}
        />
      </SettingsSection>

      {/* 🔴 Trakt'lı hesapta HİÇ MONTE EDİLMİYOR: erişilemeyen bir düzenleme
          modalını ağaçta tutmak, ileride yanlışlıkla açılabilecek bir yol
          bırakır. Kapı tek yerde (`adSatiriGorunur`) olsun. */}
      {adSatiriGorunur && (
        <EditProfileModal
          visible={editModalVisible}
          onClose={() => setEditModalVisible(false)}
          currentUsername={profile.username}
          usernameUpdatedAt={profile.usernameUpdatedAt}
          onSaved={(username) =>
            setProfile((prev) => (prev ? { ...prev, username, usernameUpdatedAt: new Date().toISOString() } : prev))
          }
        />
      )}

      <EditBioModal
        visible={bioModalVisible}
        onClose={() => setBioModalVisible(false)}
        currentBio={profile.bio ?? null}
        onSaved={(bio) => setProfile((prev) => (prev ? { ...prev, bio } : prev))}
      />
    </>
  );
}
