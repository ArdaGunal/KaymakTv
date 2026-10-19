import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserProfile, TraktUserProfile } from '../services/api/social';
import { fetchKaymakGraph } from '../services/api/kaymakSocial';
import { getMyProfile } from '../features/feed/services/profile';
import { logError } from '../utils/errorLog';

/**
 * HIZ-01 Paket 2 (M544) · KENDİ PROFİLİM — tek paylaşılan kaynak (Faz 2 + Faz 3).
 *
 * Kullanıcı (2026-10-19, arkadaşıyla test): *«Profilde profil/takipçi/KaymakNo alanları her
 * açılışta geç yükleniyor.»* Kök neden: `useMyTraktProfile` beş yerde (profil, profil düzenle,
 * akıştaki «Ne düşünüyorsun?» kutusu…) AYRI AYRI bağlanıyor, her bağlanma kendi `useState`'iyle
 * BOŞ başlayıp ağı bekliyordu; diske hiçbir şey yazılmıyordu. Trakt `/users/me` tek-uçuşta
 * değildi → panelde her açılışta aynı anda İKİ `/users/me` (Faz 3).
 *
 * ŞİMDİ:
 *   • Son bilinen profil + sayılar + KaymakNo DİSKTE (`DISK_ANAHTARI`); açılışta ms'ler içinde
 *     ekranda, ağ ARKADA tazeler (stale-while-revalidate).
 *   • Aynı anda gelen tazeleme istekleri TEK uçuşu paylaşır; zorlanmamış tazeleme
 *     `TAZE_SURE_MS` içinde tekrarlanmaz (sekme gez-dön her seferinde ağ istemesin).
 *   • Kısmi hata önceki değeri KORUR (eski kuralla aynı: «0 takipçi» yalanı yok).
 *   • Kimlik değişince / çıkışta `sifirla()` — önceki hesabın profili sızmaz (AuthContext).
 */
export interface BenimProfilVerisi {
  profile: TraktUserProfile | null;
  followersCount: number;
  followingCount: number;
  kaymakNo: number | null;
}

/** Ağ isteği için gereken kimlik bağlamı (AuthContext'ten). */
export interface ProfilBaglami {
  accessToken: string | null;
  isGuest: boolean;
  authProvider: string | null;
  myUsername: string | null;
  myAvatarUrl: string | null;
  updateMyProfile: (p: { username?: string }) => Promise<unknown>;
}

const DISK_ANAHTARI = 'kaymak.benimProfilim.v1';
export const TAZE_SURE_MS = 30_000;

interface Durum {
  veri: BenimProfilVerisi | null;
  /** İlk ağ turu sürüyor VE elde (disk dahil) hiçbir veri yok → iskelet. */
  isLoading: boolean;
  sonTazeleme: number;
  tazele: (baglam: ProfilBaglami, zorla?: boolean) => Promise<void>;
  sifirla: () => void;
}

let ucustaki: Promise<void> | null = null;
let diskOkundu: Promise<void> | null = null;
// Sıfırlamadan önce başlamış bir turun sonucu yeni oturuma yazılmasın.
let nesil = 0;

const bosVeri = (): BenimProfilVerisi => ({ profile: null, followersCount: 0, followingCount: 0, kaymakNo: null });

function diskiOku(set: (p: Partial<Durum>) => void, get: () => Durum): Promise<void> {
  if (!diskOkundu) {
    const baslangicNesli = nesil;
    diskOkundu = AsyncStorage.getItem(DISK_ANAHTARI)
      .then((ham) => {
        if (!ham || get().veri || baslangicNesli !== nesil) return;
        const kayit = JSON.parse(ham) as BenimProfilVerisi;
        if (kayit && typeof kayit === 'object' && kayit.profile) set({ veri: kayit, isLoading: false });
      })
      .catch(() => {});
  }
  return diskOkundu;
}

/** Eski `useMyTraktProfile.fetchProfile`'ın mantığı, AYNEN — yalnız sonuç döndürüyor. */
async function profiliCek(b: ProfilBaglami, onceki: BenimProfilVerisi): Promise<BenimProfilVerisi> {
  const sonuc: BenimProfilVerisi = { ...onceki };
  const sayilariTazele = async () => {
    try {
      const graf = await fetchKaymakGraph();
      sonuc.followersCount = graf.followersCount;
      sonuc.followingCount = graf.followingCount;
    } catch (error) {
      logError('useMyTraktProfile.graf', error);
    }
  };

  // Google-only: Trakt'a HİÇ gitme. Kaynak SUNUCU; yerel değerler yalnız ağ düşerse yedek.
  if (b.authProvider === 'google') {
    let username = b.myUsername ?? '';
    let avatarUrl = b.myAvatarUrl ?? null;
    let bio: string | null = null;
    let displayName: string | null = null;
    // M544: profil ve sayılar PARALEL (eskiden sayılar profilden SONRA başlıyordu).
    const [remote] = await Promise.all([
      getMyProfile(b.accessToken!).catch((error) => {
        console.warn('[Profile] Kaymak profili okunamadı, yerel kopyaya düşülüyor:', error);
        return null;
      }),
      sayilariTazele(),
    ]);
    if (remote) {
      username = remote.username || username;
      // 🔑 Sunucu yanıt verdiyse onun fotoğrafı esastır — `null` «kaldırıldı» (§C24).
      avatarUrl = remote.avatarUrl;
      bio = remote.bio;
      displayName = remote.displayName;
      sonuc.kaymakNo = remote.kaymakNo;
    } else if (onceki.profile) {
      // Ağ düştü ve elde son bilinen tam profil var → onu koru (yerel ad/foto yedeğinden zengin).
      return sonuc;
    }
    sonuc.profile = {
      username,
      private: false,
      name: displayName,
      vip: false,
      ids: { slug: '' },
      images: avatarUrl ? { avatar: { full: avatarUrl } } : undefined,
      about: bio,
    };
    return sonuc;
  }

  // 🪪 TRAKT'LI KULLANICI — kimlik tamamen bizden (PROFIL-AD-01, M519); Trakt yalnız `ids`/`vip`.
  const [traktProfil, kaymakProfil] = await Promise.all([
    getUserProfile('me').catch((error) => {
      logError('useMyTraktProfile.trakt', error);
      return null;
    }),
    getMyProfile(b.accessToken!).catch((error) => {
      logError('useMyTraktProfile.kaymak', error);
      return null;
    }),
    sayilariTazele(),
  ]);
  if (kaymakProfil) {
    sonuc.kaymakNo = kaymakProfil.kaymakNo;
    // Yerel kopya sunucuyla aynı kalsın (çevrimdışı yedek + iyimser kartlar).
    if (kaymakProfil.username && kaymakProfil.username !== b.myUsername) {
      b.updateMyProfile({ username: kaymakProfil.username }).catch(() => {});
    }
  } else if (onceki.profile) {
    // Bizim sunucu düştü → son bilinen profil korunur (Trakt `ids`/`vip` geldiyse tazelenir).
    if (traktProfil && onceki.profile) {
      sonuc.profile = { ...onceki.profile, private: traktProfil.private ?? false, vip: traktProfil.vip ?? false, ids: traktProfil.ids ?? onceki.profile.ids };
    }
    return sonuc;
  }
  const avatarUrl = kaymakProfil ? kaymakProfil.avatarUrl : b.myAvatarUrl ?? null;
  sonuc.profile = {
    private: traktProfil?.private ?? onceki.profile?.private ?? false,
    vip: traktProfil?.vip ?? onceki.profile?.vip ?? false,
    ids: traktProfil?.ids ?? onceki.profile?.ids ?? { slug: '' },
    username: kaymakProfil?.username || b.myUsername || '',
    name: kaymakProfil?.displayName ?? null,
    images: avatarUrl ? { avatar: { full: avatarUrl } } : undefined,
    about: kaymakProfil?.bio ?? null,
  };
  return sonuc;
}

export const useBenimProfilimStore = create<Durum>((set, get) => ({
  veri: null,
  isLoading: true,
  sonTazeleme: 0,

  tazele: async (b, zorla = false) => {
    if (!b.accessToken || b.isGuest) {
      set({ isLoading: false });
      return;
    }
    await diskiOku(set, get);
    if (ucustaki) {
      if (!zorla) return ucustaki;
      // Zorlanmış tazeleme (ör. Profili Düzenle → Kaydet) KAYDETMEDEN önce başlamış bir turun
      // sonucuyla yetinmez: onu bekler, sonra yenisini atar.
      await ucustaki.catch(() => {});
      if (ucustaki) return ucustaki;
    }
    if (!zorla && get().veri && Date.now() - get().sonTazeleme < TAZE_SURE_MS) return;

    const baslangicNesli = nesil;
    ucustaki = (async () => {
      try {
        const yeni = await profiliCek(b, get().veri ?? bosVeri());
        if (baslangicNesli !== nesil) return;
        set({ veri: yeni, sonTazeleme: Date.now() });
        if (yeni.profile) AsyncStorage.setItem(DISK_ANAHTARI, JSON.stringify(yeni)).catch(() => {});
      } catch (error) {
        console.warn('[Profile] Profil yüklenemedi:', error);
      } finally {
        // Sıfırlamadan önce başlamış tur, sonrasında başlamış yeni turun kaydını SİLMEZ.
        if (baslangicNesli === nesil) {
          set({ isLoading: false });
          ucustaki = null;
        }
      }
    })();
    return ucustaki;
  },

  sifirla: () => {
    nesil += 1;
    ucustaki = null;
    diskOkundu = null;
    set({ veri: null, isLoading: true, sonTazeleme: 0 });
    AsyncStorage.removeItem(DISK_ANAHTARI).catch(() => {});
  },
}));
