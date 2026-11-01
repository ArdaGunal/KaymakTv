import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import * as SecureStore from '../utils/secureStorage';
import { onSessionExpired, onTokenRefreshed } from '../services/api/traktClient';
import { useFollowStore } from '../store/followStore';
import { useLibraryStore } from '../store/useLibraryStore';
import { resetFetchState } from '../services/library/fetchers';
import { clearMyTraktSlug } from '../services/api/myIdentity';
import { unregisterPushToken } from '../features/notifications/services/pushTokens';
import { aktarimiDurdur } from '../services/import/aktarimBaglanti';
import { useFeedStore } from '../features/feed/store/feedStore';
import { useBenimProfilimStore } from '../store/benimProfilimStore';
// ⚠️ Barrel'dan (`features/notifications`) DEĞİL, doğrudan dosyadan:
// barrel `NotificationBadge`'i de dışa açıyor ve o bu dosyayı import ediyor —
// barrel üzerinden çağırmak import döngüsü kurardı (bkz. reset.ts başlığı).
import { resetNotificationState } from '../features/notifications/reset';
import { clearFeedPublishIdentity } from '../features/feed/services/feedPublish';
import {
  invalidateFeedCache,
  invalidateVisibleUserIds,
  invalidateIdentityScopedFeedCaches,
} from '../features/feed/services/feedApi';
import { invalidateMySupabaseUserId, invalidateBlockedUserIds } from '../features/feed/services/userBlocks';
import { recordPerfMark } from '../utils/perfLog';
import { getMyProfile } from '../features/feed/services/profile';
import { supabase } from '../features/feed/services/supabaseClient';
import { supabaseKimlikKaynaginiAyarla } from '../features/feed/services/supabaseKimlik';
import { stopWatchedOutbox } from '../services/library/outbox/runtime';
import { stopHiddenOutbox } from '../services/library/hiddenOutbox/runtime';
import { onHesapGecersiz, oturumKusaginiIlerlet } from '../services/auth/oturumDenetimi';
import { onKimlikDegisti } from '../services/auth/benKimligi';
import { workerYanitKoruyucusunuKur } from '../services/api/workerYanitKoruyucu';

// M525 (b): Worker `invalid_token` (silinmiş hesabın oturum belgesi) → tam çıkış.
workerYanitKoruyucusunuKur();
import { cihazAnahtarlariniSil, gorselOnbelleginiSil, googleOturumunuKapat } from '../services/auth/cikisTemizligi';
import { useWatchedOutboxStore } from '../store/watchedOutboxStore';
import { useHiddenOutboxStore } from '../store/hiddenOutboxStore';

type AuthContextType = {
  accessToken: string | null;
  isGuest: boolean;
  isLoading: boolean;
  // create_new: Google-only (Trakt'sız) bir oturum mu, yoksa gerçek bir
  // Trakt bağlantısı mı — `null` yalnızca henüz hiç oturum açılmadığında.
  authProvider: 'trakt' | 'google' | null;
  // Yalnızca `authProvider==='google'` kullanıcılar için anlamlı — Trakt
  // kullanıcılarının adı Trakt'tan senkronlanıyor (bkz. profil onboarding
  // turunun tasarım notu: bu ikisi KASITLI OLARAK ayrı, Trakt taraf hiç
  // dokunulmuyor). `users` tablosuna anon key ile "kendi satırımı" sorgulamanın
  // yolu yok (google_sub anon'a kapalı, 026) — bu yüzden değer sunucudan
  // (create_new/updateProfile yanıtı) alınıp burada yerelde tutuluyor.
  myUsername: string | null;
  myAvatarUrl: string | null;
  saveTokens: (access: string, refresh: string) => Promise<void>;
  saveGoogleSession: (sessionToken: string, profile?: { username?: string; avatarUrl?: string | null }) => Promise<void>;
  updateMyProfile: (patch: { username?: string; avatarUrl?: string | null }) => Promise<void>;
  loginAsGuest: () => Promise<void>;
  removeKeys: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  accessToken: null,
  isGuest: false,
  isLoading: true,
  authProvider: null,
  myUsername: null,
  myAvatarUrl: null,
  saveTokens: async () => {},
  saveGoogleSession: async () => {},
  updateMyProfile: async () => {},
  loginAsGuest: async () => {},
  removeKeys: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authProvider, setAuthProvider] = useState<'trakt' | 'google' | null>(null);
  const [myUsername, setMyUsername] = useState<string | null>(null);
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    loadKeys();
  }, []);

  // §S1/§S2 · yol B (M403) — Supabase belgesi bu kimliğe bağlı. Kimlik
  // değişince önbellek sıfırlanır ve Realtime yeni belgeyle yeniden yetkilenir
  // (yoksa açık kanal bir önceki kişinin — ya da anon'un — yetkisiyle kalırdı).
  useEffect(() => {
    supabaseKimlikKaynaginiAyarla(isGuest ? null : accessToken);
    supabase.realtime.setAuth().catch((error: unknown) => {
      console.warn('[AuthContext] Realtime yetkisi yenilenemedi:', error);
    });
  }, [accessToken, isGuest]);

  // traktClient.ts'teki 401 interceptor'ı, refresh token da geçersiz/yoksa
  // SecureStore'daki token'ları sessizce siler — ama bu React state'ini
  // (accessToken) hiç güncellemez. Bu abonelik olmadan: SecureStore boş ama
  // accessToken state'i hâlâ eski (dolu) değerde kalır, (protected)/_layout.tsx
  // kullanıcıyı "giriş yapılmış" sanmaya devam eder, her API isteği yeniden
  // 401 alır — kullanıcı hiçbir açıklama olmadan donmuş bir uygulamayla kalır.
  useEffect(() => {
    return onSessionExpired(() => {
      stopWatchedOutbox();
      stopHiddenOutbox();
      console.warn('[Auth] Oturum süresi doldu, kullanıcı çıkışa alınıyor.');
      setAccessToken(null);
      // `setIsGuest(false)` BİLİNÇLİ OLARAK KALDIRILDI (2026-08-30): "oturum
      // sona erdi" TANIM GEREĞİ giriş yapmış bir kullanıcıyla ilgilidir;
      // misafirin sona erecek bir oturumu YOKTUR. Gerçek bir kullanıcı için
      // bu satır zaten no-op'tu (`saveTokens` isGuest'i çoktan false yapar),
      // ama misafir için YIKICIYDI: `traktGuestMode` diskte 'true' kalırken
      // bellekteki `isGuest` false'a düşüyor, `(protected)/_layout.tsx`
      // kullanıcıyı karşılama ekranına atıyor ve iki kaynak uygulama yeniden
      // açılana kadar tutarsız kalıyordu. Kök neden traktClient.ts'te
      // kapatıldı; bu satır üçüncü kalkan.
    });
  }, []);

  // M525 (b): hesabın oturum belgesi Worker'da geçersiz (hesap silindi — ör. başka cihazda
  // «Hesap Seç») → hayalet oturumda kalma; D8 tam çıkış. `removeKeys` aşağıda tanımlı → ref.
  const removeKeysRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => onHesapGecersiz(() => {
    console.warn('[Auth] Hesap artık yok (invalid_token) — çıkış yapılıyor.');
    void removeKeysRef.current();
  }), []);

  // M525 (c): sunucu bu token'ı BAŞKA bir hesaba çözüyor (Hesap Seç başka cihazda yapıldı) →
  // kimliğe bağlı önbellekler çıkıştakiyle aynı biçimde sıfırlanır; oturum KAPANMAZ.
  useEffect(() => onKimlikDegisti(() => {
    useFollowStore.getState().reset();
    useFeedStore.getState().reset();
    // M544: kendi profilim (disk + RAM) — önceki hesabın adı/sayıları sızmasın.
    useBenimProfilimStore.getState().sifirla();
    clearMyTraktSlug();
    clearFeedPublishIdentity();
    invalidateFeedCache();
    invalidateVisibleUserIds();
    invalidateBlockedUserIds();
    invalidateIdentityScopedFeedCaches();
    resetFetchState();
  }), []);

  // Simetrik abonelik: token arka planda SESSİZCE yenilendiğinde de bu
  // state'in haberi olsun — aksi halde `useAuth().accessToken`'ı okuyup
  // Worker'a doğrudan gönderen kod yolları (feed sync, feed privacy) eski/
  // artık geçersiz token'ı göndermeye devam ediyordu (canlı testte bulundu).
  useEffect(() => {
    return onTokenRefreshed((newToken) => {
      setAccessToken(newToken);
    });
  }, []);

  const loadKeys = async () => {
    const startedAt = Date.now();
    try {
      // Paralel: bu iki okuma birbirinden bağımsız, sıralı `await` açılışta
      // gereksiz bir round-trip kadar gecikme ekliyordu.
      const [token, guestStatus, providerRaw, usernameRaw, avatarUrlRaw] = await Promise.all([
        SecureStore.getItemAsync('traktAccessToken'),
        SecureStore.getItemAsync('traktGuestMode'),
        SecureStore.getItemAsync('traktAuthProvider'),
        SecureStore.getItemAsync('kaymakMyUsername'),
        SecureStore.getItemAsync('kaymakMyAvatarUrl'),
      ]);

      if (token) {
        setAccessToken(token);
        // Y23'ten önce yazılmış eski bir token'da bu anahtar hiç olmayabilir
        // — `null !== 'google'` zaten `traktClient.ts`'teki varsayılanla
        // (gerçek Trakt oturumu) birebir aynı davranışı üretir.
        setAuthProvider(providerRaw === 'google' ? 'google' : 'trakt');
        if (usernameRaw) setMyUsername(usernameRaw);
        if (avatarUrlRaw) setMyAvatarUrl(avatarUrlRaw);
        if (providerRaw === 'google' && (!usernameRaw || !avatarUrlRaw)) yerelProfiliTamamla(token);
      }
      if (guestStatus === 'true') {
        setIsGuest(true);
      }
    } catch (error) {
      console.error('Error loading keys:', error);
    } finally {
      setIsLoading(false);
      recordPerfMark('Oturum Başlatma', 'startup', Date.now() - startedAt);
    }
  };

  const saveTokens = async (access: string, refresh: string) => {
    try {
      await SecureStore.setItemAsync('traktAccessToken', access);
      await SecureStore.setItemAsync('traktRefreshToken', refresh);
      await SecureStore.deleteItemAsync('traktGuestMode');
      // Y23: gerçek Trakt token'ları her yazıldığında (ilk giriş VEYA
      // Google-only bir hesabın sonradan Trakt'a bağlanması — bkz.
      // traktClient.ts'teki 'google' dalı) önceki 'google' işareti EZİLİR.
      // Aksi halde bu kullanıcının GERÇEK Trakt oturumu sonradan gerçekten
      // sona erdiğinde interceptor bunu "Trakt'sız kullanıcı, beklenen"
      // sanıp çıkışa atmaz — kullanıcı sessizce bozuk/bayat veriyle kalır.
      await SecureStore.setItemAsync('traktAuthProvider', 'trakt');
      setAccessToken(access);
      setAuthProvider('trakt');
      setIsGuest(false);
    } catch (error) {
      console.error('Error saving tokens:', error);
      throw error;
    }
  };

  /**
   * create_new: Google-only (Trakt hesabı hiç olmayan) bir kayıt/giriş
   * sonrası çağrılır — Worker'ın `mintSessionToken`'ının ürettiği
   * `kaymak_session_v1.` önekli değeri `traktAccessToken` YUVASINA saklar
   * (Worker'ın kendi tasarım niyeti: bu alan TEK bir opak string, gerçek
   * Trakt token'ı ya da Kaymak oturum token'ı — bkz. Worker
   * `resolveCallerWithReason` başlığı). `traktRefreshToken` BİLİNÇLİ OLARAK
   * hiç yazılmaz; `services/api/traktClient.ts`'in Y23 düzeltmesi
   * `traktAuthProvider==='google'` gördüğünde bunu BEKLENEN sayıp tüm
   * oturumu kapatmadan yalnızca ilgili Trakt isteğini başarısız sayar.
   */
  const saveGoogleSession = async (sessionToken: string, profile?: { username?: string; avatarUrl?: string | null }) => {
    try {
      await SecureStore.setItemAsync('traktAccessToken', sessionToken);
      await SecureStore.deleteItemAsync('traktRefreshToken');
      await SecureStore.setItemAsync('traktAuthProvider', 'google');
      await SecureStore.deleteItemAsync('traktGuestMode');
      setAccessToken(sessionToken);
      setAuthProvider('google');
      setIsGuest(false);
      // `profile` yalnızca create_new'in `status:'created'` dalında dolu
      // gelir (bkz. googleAuth.ts) — yarış durumunda (`'linked'`) verilmez,
      // önceki bilinen değer (varsa) korunur; yoksa sunucudan tamamlanır (C37).
      if (!profile?.username) yerelProfiliTamamla(sessionToken);
      if (profile?.username) {
        await SecureStore.setItemAsync('kaymakMyUsername', profile.username);
        setMyUsername(profile.username);
      }
      if (profile?.avatarUrl) {
        await SecureStore.setItemAsync('kaymakMyAvatarUrl', profile.avatarUrl);
        setMyAvatarUrl(profile.avatarUrl);
      }
    } catch (error) {
      console.error('Error saving google session:', error);
      throw error;
    }
  };

  /**
   * `EditProfileModal`'ın (onboarding VEYA Ayarlar) `updateProfile` Worker
   * çağrısı başarılı olduktan SONRA çağrılır — yerel kopyayı sunucudaki
   * gerçek değerle senkron tutar. Yalnızca dolu gelen alanlar güncellenir.
   */
  // C37 (M489): var olan hesaba Google ile girişte ad/fotoğraf yerelde hiç yazılmıyordu →
  // iyimser gönderi kartında «Kaymak Kullanıcısı», gönderi kutusunda «?». Bir kez sunucudan
  // okunup yerel kopyaya yazılır. Sunucuda fotoğraf yoksa (null) yerel kopyaya dokunulmaz.
  const yerelProfiliTamamla = (token: string) => {
    getMyProfile(token)
      .then((p) => updateMyProfile({ username: p.username || undefined, ...(p.avatarUrl ? { avatarUrl: p.avatarUrl } : {}) }))
      .catch((error) => console.warn('[Auth] Profil yerel kopyası tamamlanamadı:', error));
  };

  const updateMyProfile = async (patch: { username?: string; avatarUrl?: string | null }) => {
    try {
      if (patch.username !== undefined) {
        await SecureStore.setItemAsync('kaymakMyUsername', patch.username);
        setMyUsername(patch.username);
      }
      if (patch.avatarUrl !== undefined) {
        if (patch.avatarUrl) {
          await SecureStore.setItemAsync('kaymakMyAvatarUrl', patch.avatarUrl);
        } else {
          await SecureStore.deleteItemAsync('kaymakMyAvatarUrl');
        }
        setMyAvatarUrl(patch.avatarUrl);
      }
    } catch (error) {
      console.error('Error updating my profile:', error);
      throw error;
    }
  };

  const loginAsGuest = async () => {
    try {
      await SecureStore.setItemAsync('traktGuestMode', 'true');
      setIsGuest(true);
    } catch (error) {
      console.error('Error activating guest mode:', error);
    }
  };

  const removeKeys = async () => {
    oturumKusaginiIlerlet(); // M538: yoldaki eski-oturum istekleri artık hiçbir şey yazmaz (D8 yarışı)
    try {
      // ── §C33 / M430: otomatik aktarım motoru TOKEN'LARDAN ÖNCE durur ──
      // Aksi hâlde silme ile bir sonraki render arasında adım atan şerit
      // boş token'la "yenileme" deniyor, Discord'a hata ve oturum-sona-erdi
      // sinyali düşüyordu.
      aktarimiDurdur();
      stopWatchedOutbox();
      stopHiddenOutbox();

      // ── F3: push token kaydını sil ────────────────────────────────────
      // 🔴 SIRA KRİTİK — BU SATIR `traktAccessToken` SİLİNMEDEN ÖNCE OLMALI.
      // `unregisterPushToken` kimliği SecureStore'dan okuyup Worker'a
      // gönderiyor; aşağıdaki silmeden SONRA çağrılsaydı gönderecek kimlik
      // kalmaz, istek 401 döner ve cihaz kaydı sunucuda ASILI KALIRDI —
      // yani sonraki kullanıcı giriş yapana kadar eski sahibin bildirimleri
      // bu telefona düşmeye devam ederdi.
      //
      // ⚠️ `await` ediliyor: çıkış zaten bir bekleme anı ve bu iş bitmeden
      // token'ları silersek çağrı anlamsızlaşır. `unregisterPushToken` asla
      // throw etmez ve 8 sn zaman aşımı var, yani çıkışı kilitleyemez.
      //
      // ⚠️ Bu bir NEZAKET, güvence değil: ağ yoksa kayıt kalır. Asıl koruma
      // sunucudaki `(platform, token_key)` tekilliği (035_push_tokens.sql).
      await unregisterPushToken();

      await SecureStore.deleteItemAsync('traktAccessToken');
      await SecureStore.deleteItemAsync('traktRefreshToken');
      await SecureStore.deleteItemAsync('traktGuestMode');
      // Y23: bir sonraki oturuma sızmasın — diğer kimlik anahtarlarıyla aynı gerekçe.
      await SecureStore.deleteItemAsync('traktAuthProvider');
      // Aynı gerekçe: temizlenmezse çıkış yapıp BAŞKA bir Google-only hesapla
      // girildiğinde (uygulama kapatılmadan) önceki hesabın adı/fotoğrafı bir
      // an için yeni oturumda görünürdü.
      await SecureStore.deleteItemAsync('kaymakMyUsername');
      await SecureStore.deleteItemAsync('kaymakMyAvatarUrl');
      // 🔴 D8 / Faz 4d (M517): çıkış cihazı TAMAMEN temizler — M439'daki «bekleyen
      // izleme kuyruğu korunur» kuralı KALKTI (kullanıcı, 2026-10-13). Bekleyen iş varsa
      // uyarıyı çıkıştan ÖNCE `useSettings.handleLogout` gösterir. Kalan anahtar =
      // `CIKISTA_KALAN_ANAHTARLAR` (yalnız 3 kimliksiz telemetri anahtarı, M529). Ayrıntı: services/auth/cikisTemizligi.ts.
      await cihazAnahtarlariniSil();
      useWatchedOutboxStore.setState({ ready: false, pendingCount: 0, pendingShowIds: [], hasError: false, saveError: false });
      useHiddenOutboxStore.setState({ ready: false, pendingCount: 0, hasError: false, saveError: false });
      // Telefon son Google hesabını hatırlamasın; profil fotoğrafları dahil görsel önbellek gitsin.
      await googleOturumunuKapat();
      await gorselOnbelleginiSil();
      // AsyncStorage.clear() yalnızca DİSKTEKİ kopyayı siler — followStore
      // RAM'de bir Zustand singleton'ı olduğundan bir önceki oturumun
      // connectionStates/isFetched'i JS süreci canlı kaldığı sürece (uygulama
      // tamamen kapatılmadan çıkış-giriş yapılırsa) hafızada kalmaya devam
      // eder. `isFetched: true` kalınca yeni oturumda fetchFollowingSlugs
      // tekrar hiç çalışmaz ve önceki hesabın (varsa farklı bir Trakt hesabı)
      // takip durumu yeni oturuma sızar. Çıkışta açıkça sıfırla.
      useFollowStore.getState().reset();
      // 2026-08-21 — kullanıcı canlı testte bulundu ("State Leakage"): Arda
      // (Trakt'a bağlı) çıkış yapıp sekme kapatılmadan Deneme (Google-only)
      // ile giriş yapınca Arda'nın izleme geçmişi/ilerlemesi/listeleri
      // ekranda kalmaya devam ediyordu. Kök neden AYNI sınıf — `useLibraryStore`
      // da RAM'de bir Zustand singleton'ı, `clearAll()` metodu ZATEN vardı ama
      // hiçbir yerden çağrılmıyordu. `resetFetchState()` (services/library/
      // fetchers.ts) AYRICA gerekli: `fetchFreshData`'nın TTL saati de modül
      // seviyesinde — sıfırlanmazsa yeni hesabın ilk senkronu, önceki hesap az
      // önce gerçekten senkronladığı için TTL'i geçerli sanıp TAMAMEN ATLANIRDI,
      // yani `clearAll()` boşalttıktan SONRA bile yeni hesap için hiç dolmazdı.
      useLibraryStore.getState().clearAll();
      resetFetchState();
      // Aynı gerekçe, modül seviyesindeki kimlik önbelleği için (bkz.
      // services/api/myIdentity.ts): temizlenmezse önceki hesabın slug'ı yeni
      // oturuma sızar ve Akış'ta yanlış kişinin aktiviteleri "benim" görünürdü.
      clearMyTraktSlug();
      // Akış da RAM'de bir singleton — temizlenmezse yeni oturumda bir an
      // için ÖNCEKİ hesabın akışı görünürdü.
      useFeedStore.getState().reset();
      // M544: kendi profilim de RAM singleton'ı + disk kopyası — aynı sınıf.
      useBenimProfilimStore.getState().sifirla();
      clearFeedPublishIdentity();
      // Bildirimler de aynı sınıfa girer — üstelik iki katmanlı: store'lar
      // RAM'de singleton VE zamanlanmış bildirimler işletim sisteminde,
      // yani `AsyncStorage.clear()`'ın hiç görmediği bir yerde. Temizlenmezse
      // önceki hesabın dizileri için bildirim düşmeye devam eder
      // (bkz. features/notifications/reset.ts).
      await resetNotificationState();
      invalidateFeedCache();
      // Görünür kullanıcı kümesi de sıfırlanmalı: aksi halde yeni oturumun
      // ilk akış sorgusu ÖNCEKİ hesabın takip listesiyle filtrelenirdi.
      invalidateVisibleUserIds();
      // features/feed/services/userBlocks.ts'teki İKİ modül seviyesi önbellek
      // de aynı gerekçeyle temizlenmeli — bunlar KİMLİĞE bağlı:
      //   • myUserIdCache   → benim Supabase users.id'im
      //   • blockedIdsCache → benim engel kümem
      // Temizlenmezse (uygulama kapatılmadan hesap değiştirilirse) TTL dolana
      // kadar ÖNCEKİ hesabın kimliği yeni oturumda kullanılırdı: "bu kartı ben
      // beğendim mi" (attachIsLikedByMe), hangi yorumda "sil" butonu çıkacağı
      // (useFeedComments.myUserId) ve engel filtresi hep yanlış kişiye göre
      // hesaplanırdı.
      invalidateMySupabaseUserId();
      invalidateBlockedUserIds();
      // K2 denetiminde bulundu: `feedApi.ts`'teki İKİ Map önbelleği
      // (profil aktiviteleri + yapım incelemeleri) buraya hiç bağlanmamıştı.
      // İkisi de `isLikedByMe` taşıyor, yani KİMLİĞE BAĞLI — temizlenmezse
      // hesap değiştirildiğinde 60sn'lik TTL boyunca önceki hesabın beğeni
      // durumu yeni oturumda görünürdü (yukarıdaki üç önbellekle AYNI hata
      // sınıfı, yalnızca daha sonra eklendikleri için gözden kaçmışlar).
      invalidateIdentityScopedFeedCaches();
      setAccessToken(null);
      setAuthProvider(null);
      setIsGuest(false);
      setMyUsername(null);
      setMyAvatarUrl(null);
    } catch (error) {
      console.error('Error removing keys:', error);
    }
  };

  removeKeysRef.current = removeKeys;

  return (
    <AuthContext.Provider
      value={{
        accessToken,
        isGuest,
        isLoading,
        authProvider,
        myUsername,
        myAvatarUrl,
        saveTokens,
        saveGoogleSession,
        updateMyProfile,
        loginAsGuest,
        removeKeys,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
