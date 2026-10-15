import { useCallback, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  fetchKaymakProfile,
  KaymakAramaHatasi,
  type KaymakProfil,
} from '../../../services/api/kaymakSocial';
import type { ProfilKimligi } from '../../../components/profile/ProfileHeader';
import { type PublicProfileError } from './usePublicProfile';
import { takipMutasyonNesli, useFollowStore } from '../../../store/followStore';

/**
 * Başkasının profili için KİMLİK — Faz T · T3.3 (M338).
 *
 * ==========================================================================
 * 🪪 KİMLİK BİZDEN, ZENGİNLEŞTİRME TRAKT'TAN
 * ==========================================================================
 * ⛔ ESKİDEN profil ekranının TAMAMI Trakt profiline bağlıydı
 * (`usePublicProfile(slug)`), ve bu üç ayrı hata üretiyordu:
 *
 *   1. Trakt profili gelmezse ekran "Bu kullanıcı bulunamadı" çiziyordu.
 *      Google-only kullanıcının Trakt profili YOK → profili HİÇ açılmıyordu,
 *      takip düğmesi de o dalın içinde kalıyordu.
 *   2. Takipçi/takip SAYILARI Trakt'tandı → bizim grafta takip edince sayı
 *      değişmiyordu.
 *   3. 🔴 Rota parametresi M337'den beri KaymakTV `username`'i. Trakt
 *      okumaları onunla yapılınca (a) `ArdaGnl`≠`ardagnl`,
 *      `esrakilinc515_45f919`≠`esrakilinc515-45f919` gibi farklarda BOŞ
 *      gelir — ölçüldü, 6 gerçek kullanıcının 5'i; (b) Trakt'ta AYNI ADDA
 *      BAŞKA BİRİ varsa onun verisi bu kişinin profilinde gösterilirdi.
 *
 * ✅ Artık kimlik + sayılar + ilişki `/social/profile`'dan geliyor. Trakt
 * YALNIZCA sunucunun döndürdüğü GERÇEK `traktSlug` ile ve yalnızca VARSA
 * okunuyor; o okuma düşerse ekran BLOKLANMIYOR (isim/biyografi boş kalır).
 *
 * 🔴 Çağıran, takip düğmesine `kaymakProfil.profile.userId` DIŞINDA hiçbir şey
 * vermemeli — `useFollowState`'in iki parametresi de `string | null`, tip
 * sistemi yanlış kimliği YAKALAMAZ (M337).
 */
export function usePublicProfileIdentity(username: string | null) {
  const [kaymakProfil, setKaymakProfil] = useState<KaymakProfil | null>(null);
  const [kaymakYukleniyor, setKaymakYukleniyor] = useState(true);
  const [kaymakHata, setKaymakHata] = useState<PublicProfileError | null>(null);

  useFocusEffect(useCallback(() => {
    // Profilden profile geçişte ÖNCEKİ kişinin kimliği bir an bile kalmasın —
    // o arada takip düğmesi eski `userId`'yi hedefleyebilirdi.
    setKaymakProfil(null);
    setKaymakHata(null);
    if (!username) {
      setKaymakYukleniyor(false);
      return;
    }
    let cancelled = false;
    let sonIstek = 0;
    const tazele = () => {
      const istekNo = ++sonIstek;
      const baslangicNesli = takipMutasyonNesli();
      setKaymakYukleniyor(true);
      setKaymakHata(null);
      fetchKaymakProfile(username)
        .then(async (p) => {
          if (cancelled || istekNo !== sonIstek) return;
          // M434: gizlilik kilidi taze /profile ilişkisini, düğme ise TTL'li
          // /graph kopyasını okuyordu. Kabul edilmiş istek "bekliyor" kalıyordu.
          await useFollowStore.getState().applyProfileConnection(
            p.profile.userId,
            p.iliski === 'takip' ? 'following' : p.iliski === 'bekliyor' ? 'pending' : 'none',
            baslangicNesli,
          );
          if (!cancelled && istekNo === sonIstek) setKaymakProfil(p);
        })
        .catch((e) => {
          if (cancelled || istekNo !== sonIstek) return;
          console.warn('[PublicProfile] Kaymak kimliği çözülemedi:', e);
          setKaymakHata(e instanceof KaymakAramaHatasi && e.tur === 'bulunamadi' ? 'not_found' : 'generic');
        })
        .finally(() => {
          if (!cancelled && istekNo === sonIstek) setKaymakYukleniyor(false);
        });
    };
    tazele();
    let oncekiDurum = AppState.currentState;
    const abonelik = AppState.addEventListener('change', (durum) => {
      if (durum === 'active' && oncekiDurum !== 'active') tazele();
      oncekiDurum = durum;
    });
    return () => {
      cancelled = true;
      abonelik.remove();
    };
  }, [username]));

  const traktSlug = kaymakProfil?.profile.traktSlug ?? null;
  // PROFIL-AD-01 (M519): Trakt profili artık ÇEKİLMİYOR — tek kullanımı açıklama yedeğiydi.

  const profile: ProfilKimligi | null = kaymakProfil
    ? {
        username: kaymakProfil.profile.username,
        // 🪪 §C24 · `053` — AD VE FOTOĞRAF YALNIZCA BİZDEN (2026-09-18).
        // ⛔ Eskiden ikisi de bizde yoksa Trakt'ınkine düşüyordu. Artık Worker
        // Trakt'taki ad/fotoğrafı ilk istekte bir kez kopyalıyor; kullanıcı
        // fotoğrafını KALDIRDIYSA bizdeki `null` gerçektir — Trakt'ınkini
        // göstermek kaldırmayı başkasının ekranında geri almak olurdu (K3).
        // Bedeli: deploy'dan sonra uygulamayı henüz açmamış bir Trakt'lı
        // kullanıcı, açana kadar harfli daire ve yalnızca @adıyla görünür.
        name: kaymakProfil.profile.displayName ?? null,
        // PROFIL-AD-01 (M519, kullanıcı 2026-10-15): açıklama YALNIZ bizden. Trakt'ın
        // `about`'una DÜŞÜLMEZ — *«Bizde açıklama boşsa ekranda da boş kalacak; Trakt'tan
        // kesinlikle metin çekilmeyecek.»* (Silinen açıklamanın Trakt'tan geri gelmesi de biter.)
        about: kaymakProfil.profile.bio ?? null,
        images: kaymakProfil.profile.avatarUrl
          ? { avatar: { full: kaymakProfil.profile.avatarUrl } }
          : undefined,
      }
    : null;

  return {
    kaymakProfil,
    profile,
    followersCount: kaymakProfil?.followersCount ?? 0,
    followingCount: kaymakProfil?.followingCount ?? 0,
    isPrivate: kaymakProfil?.profile.isPrivate ?? false,
    /**
     * 🔒 §C29 (M409) — gizli hesap + takipçi değil + kendi profili değil.
     * `true` ise ekran sekmeleri KİLİTLER ve kütüphane/aktivite için HİÇ istek
     * atmaz. Kullanıcı gözlemi: *"hesabı gizliye almama rağmen takip etmediğim
     * kişiler profilimi ve akışı her yeri görüyor."* Sebep: Diziler/Filmler
     * sekmeleri Trakt'ın açık API'sinden okunuyor ve BİZİM gizlilik ayarımızı
     * bilmiyor (Trakt gizliliği yönettiği dönemin kalıntısı). Aktivite 057'yle
     * zaten boş dönüyordu; kilit ikisini birden kapatıyor.
     * Yükleme sürerken (`kaymakProfil` yok) kilit YOK — sekmeler de boş ve
     * hook'lar `null` kimlikle istek atmıyor.
     */
    gizliKilitli:
      !!kaymakProfil &&
      !!kaymakProfil.profile.isPrivate &&
      !kaymakProfil.kendisi &&
      kaymakProfil.iliski !== 'takip',
    /** Açıklama var mı? M519'dan beri gösterilen açıklama HER ZAMAN bizim (raporlanabilir). */
    bioBizden: !!kaymakProfil?.profile.bio,
    /** Trakt okumalarının TEK geçerli anahtarı. `null` = Trakt verisi yok. */
    traktSlug,
    // Kimlik tamamen bizden (M519) — Trakt isteği beklenmez.
    isLoading: kaymakYukleniyor,
    error: kaymakHata,
  };
}
