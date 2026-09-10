import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Lock } from '../../../components/icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { KaymakUserSonucu, AramaHatasi } from '../../../services/api/kaymakSocial';

/**
 * Arama sonuç listesi — Faz T · T3.5.
 *
 * 🪪 Gösterilen ad HER ZAMAN `username` ("EVRENSEL KAYMAK KİMLİĞİ" ilkesi).
 * `traktSlug` ekranda HİÇ görünmez; yalnızca satırın dokunulabilir olup
 * olmadığını belirler (aşağıdaki nota bak).
 *
 * ⛔ TAKİP DÜĞMESİ YOK — T3.2'nin uçları henüz yazılmadı. Yarım çalışan bir
 * düğme göstermek, basınca 401 veren eski davranışı tekrar üretirdi.
 */

interface Props {
  /** `null` = hiç aranmadı · `[]` = arandı, kimse yok. İKİSİ AYRI. */
  results: KaymakUserSonucu[] | null;
  error: AramaHatasi | null;
}

export default function UserSearchResults({ results, error }: Props) {
  const { t } = useTranslation('feed');
  const router = useRouter();

  if (error) {
    // 🔴 SESSİZ KAYIP YASAK (AI_RULES §2): üç sebep üç ayrı mesaj. Hepsini
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
        // ⚠️ NEDEN `traktSlug` KONTROLÜ: profil ekranı (`usePublicProfile*`
        // ailesi) bugün TAMAMEN Trakt'tan okuyor. Google-only kullanıcının
        // orada gösterilecek verisi YOK — satırı dokunulabilir yapmak boş
        // bir ekrana götürürdü. Kullanıcı kararı (2026-09-10): Trakt'lıya
        // git, Google-only'de pasif bırak.
        // 🔓 T3.3'te kendi profil ekranımız gelince bu ayrım DÜŞECEK ve
        // yönlendirme `username` üzerinden herkese açılacak.
        const acilabilir = !!kisi.traktSlug;
        const bashHarf = kisi.username.charAt(0).toUpperCase();

        const icerik = (
          <>
            {kisi.avatarUrl ? (
              <Image source={{ uri: kisi.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarBos]}>
                <Text style={styles.avatarHarf}>{bashHarf}</Text>
              </View>
            )}
            <View style={styles.metinAlani}>
              <View style={styles.adSatiri}>
                <Text style={styles.ad} numberOfLines={1}>
                  @{kisi.username}
                </Text>
                {kisi.isPrivate && <Lock size={13} color="#94a3b8" />}
              </View>
              {!acilabilir && (
                // Pasif satırın SEBEBİ yazılıyor — dokunup hiçbir şey
                // olmaması kullanıcıya bozuk hissettirir.
                <Text style={styles.pasifNot}>
                  {t('searchProfileSoon', 'Profil sayfası yakında')}
                </Text>
              )}
            </View>
          </>
        );

        if (!acilabilir) {
          return (
            <View key={kisi.id} style={[styles.satir, styles.satirPasif]}>
              {icerik}
            </View>
          );
        }

        return (
          <TouchableOpacity
            key={kisi.id}
            style={styles.satir}
            activeOpacity={0.7}
            onPress={() => router.push(`/user/${kisi.traktSlug}`)}
          >
            {icerik}
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
  satirPasif: {
    opacity: 0.55,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  avatarBos: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHarf: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '600',
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
  pasifNot: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
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
