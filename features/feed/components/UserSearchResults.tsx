import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Avatar from '../../../components/Avatar';
import { Lock } from '../../../components/icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { KaymakUserSonucu, AramaHatasi } from '../../../services/api/kaymakSocial';

/**
 * Arama sonuç listesi — Faz T · T3.5.
 *
 * 🪪 Gösterilen ad VE rota HER ZAMAN `username` ("EVRENSEL KAYMAK KİMLİĞİ").
 *
 * ✅ TÜM SATIRLAR AÇIK (kullanıcı kararı, 2026-09-11 · M338). Eskiden
 * Google-only kullanıcının satırı pasifti çünkü profil ekranı tamamen
 * Trakt'tan okuyordu. 🔴 Pasif kalsaydı iki Google-only hesap birbirini
 * TAKİP EDEMEZDİ — profile giden tek yol bu satır — ve T3'ün çıkış ölçütü
 * karşılanamazdı. Profil ekranı artık kimliği bizden okuyor.
 *
 * Takip düğmesi burada değil, profilde: satır profile götürür.
 */

interface Props {
  /** `null` = hiç aranmadı · `[]` = arandı, kimse yok. İKİSİ AYRI. */
  results: KaymakUserSonucu[] | null;
  error: AramaHatasi | null;
  /**
   * 🆕 Kişi seçilince, profile gitmeden HEMEN ÖNCE çağrılır — arama paneli
   * kendini kapatabilsin (yoksa profil açılır ama panel üstünde asılı kalırdı).
   */
  onSelect?: (kisi: KaymakUserSonucu) => void;
}

export default function UserSearchResults({ results, error, onSelect }: Props) {
  const { t } = useTranslation('feed');
  const router = useRouter();

  if (error) {
    // 🔴 SESSİZ KAYIP YASAK (AI_RULES §2): sebepler ayrı mesajlar. Hepsini
    // "bulunamadı"ya düşürmek, oturumu düşmüş kullanıcıya "böyle biri yok"
    // yalanını söylerdi.
    const mesaj =
      error === 'cok_kisa'
        ? t('searchTooShort', 'Aramak için en az 2 karakter yaz.')
        : error === 'yetki'
          ? t('searchAuthError', 'Oturumun doğrulanamadı. Tekrar giriş yapman gerekebilir.')
          : t('searchError', 'Arama yapılamadı, tekrar dene.');
    return (
      <View style={styles.kutu}>
        <Text style={styles.hataMetni}>{mesaj}</Text>
      </View>
    );
  }

  if (results === null) return null;

  if (results.length === 0) {
    return (
      <View style={styles.kutu}>
        <Text style={styles.bosMetni}>
          {t('searchNotFound', 'Bu kullanıcı adında biri bulunamadı.')}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.liste}>
      {results.map((kisi) => {
        return (
          <TouchableOpacity
            key={kisi.id}
            style={styles.satir}
            activeOpacity={0.7}
            onPress={() => {
              onSelect?.(kisi);
              router.push(`/user/${kisi.username}`);
            }}
          >
            <Avatar url={kisi.avatarUrl} ad={kisi.username} size={38} />
            <View style={styles.metinAlani}>
              <View style={styles.adSatiri}>
                <Text style={styles.ad} numberOfLines={1}>
                  @{kisi.username}
                </Text>
                {kisi.isPrivate && <Lock size={13} color="#94a3b8" />}
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  liste: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    marginBottom: 16,
    overflow: 'hidden',
  },
  satir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  metinAlani: {
    flex: 1,
  },
  adSatiri: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ad: {
    color: '#f1f5f9',
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  kutu: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  hataMetni: {
    color: '#f59e0b',
    fontSize: 13,
    textAlign: 'center',
  },
  bosMetni: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
  },
});
