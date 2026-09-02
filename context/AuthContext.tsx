import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from '../utils/secureStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onSessionExpired, onTokenRefreshed } from '../services/api/traktClient';
import { useFollowStore } from '../store/followStore';
import { useLibraryStore } from '../store/useLibraryStore';
import { resetFetchState } from '../services/library/fetchers';
import { clearMyTraktSlug } from '../services/api/myIdentity';
import { useFeedStore } from '../features/feed/store/feedStore';
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

  // traktClient.ts'teki 401 interceptor'ı, refresh token da geçersiz/yoksa
  // SecureStore'daki token'ları sessizce siler — ama bu React state'ini
  // (accessToken) hiç güncellemez. Bu abonelik olmadan: SecureStore boş ama
  // accessToken state'i hâlâ eski (dolu) değerde kalır, (protected)/_layout.tsx
  // kullanıcıyı "giriş yapılmış" sanmaya devam eder, her API isteği yeniden
  // 401 alır — kullanıcı hiçbir açıklama olmadan donmuş bir uygulamayla kalır.
  useEffect(() => {
    return onSessionExpired(() => {
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
      // önceki bilinen değer (varsa) korunur.
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
    try {
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
      await AsyncStorage.clear();
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
