import { useEffect, useState } from 'react';
import {
  fetchKaymakProfile,
  KaymakAramaHatasi,
  type KaymakProfil,
} from '../../../services/api/kaymakSocial';
import type { ProfilKimligi } from '../../../components/profile/ProfileHeader';
import { usePublicProfile, type PublicProfileError } from './usePublicProfile';

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

  useEffect(() => {
    // Profilden profile geçişte ÖNCEKİ kişinin kimliği bir an bile kalmasın —
    // o arada takip düğmesi eski `userId`'yi hedefleyebilirdi.
    setKaymakProfil(null);
    setKaymakHata(null);
    if (!username) {
      setKaymakYukleniyor(false);
      return;
    }
    let cancelled = false;
    setKaymakYukleniyor(true);
    fetchKaymakProfile(username)
      .then((p) => {
        if (!cancelled) setKaymakProfil(p);
      })
      .catch((e) => {
        if (cancelled) return;
        // 🔴 SESSİZ DEĞİL: "böyle biri yok" ile "yüklenemedi" AYRI mesajlar.
        console.warn('[PublicProfile] Kaymak kimliği çözülemedi:', e);
        setKaymakHata(e instanceof KaymakAramaHatasi && e.tur === 'bulunamadi' ? 'not_found' : 'generic');
      })
      .finally(() => {
        if (!cancelled) setKaymakYukleniyor(false);
      });
    return () => {
      cancelled = true;
    };
  }, [username]);

  const traktSlug = kaymakProfil?.profile.traktSlug ?? null;
  const { profile: traktProfil, isLoading: isTraktLoading } = usePublicProfile(traktSlug);

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
        // T4 · `043` — BİZİM açıklamamız öncelikli; yoksa (Trakt'lı ve henüz
        // yazmamış kullanıcı) Trakt'ın `about`'u.
        about: kaymakProfil.profile.bio ?? traktProfil?.about ?? null,
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
    /** Görünen açıklama BİZİM mi? Yalnızca o raporlanabilir — Trakt'ın `about`'u
     *  Trakt'ın moderasyonunda, `content_reports`'ta karşılığı yok. */
    bioBizden: !!kaymakProfil?.profile.bio,
    /** Trakt okumalarının TEK geçerli anahtarı. `null` = Trakt verisi yok. */
    traktSlug,
    // Trakt zenginleştirmesi yalnızca VARSA ilk çizimi bekletir (isim ve
    // biyografi sonradan "zıplamasın"); yoksa hiç beklenmez.
    isLoading: kaymakYukleniyor || (!!traktSlug && isTraktLoading),
    error: kaymakHata,
  };
}
