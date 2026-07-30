import React, { createContext, useMemo, useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { useLibraryStore, LibraryState } from '../store/useLibraryStore';
import * as LibraryService from '../services/libraryService';
import { useAuth } from './AuthContext';

export const LibraryContext = createContext<any>({});

// Kütüphane başlatma (cache + fetch) TEK bir yerde, Provider'da çalışır.
// Eskiden bu effect useLibrary() içindeydi: hook'u çağıran her ekran (18 dosya)
// mount olduğunda loadCache + fetchFreshData zincirini AYRI AYRI tetikliyordu.
export const LibraryProvider = ({ children }: { children: React.ReactNode }) => {
  const { accessToken, isLoading: authIsLoading } = useAuth();

  React.useEffect(() => {
    LibraryService.setLibraryToken(accessToken);
    if (accessToken && !authIsLoading) {
      LibraryService.loadCache().then(() => {
        LibraryService.fetchFreshData(accessToken);
      });
    }
  }, [accessToken, authIsLoading]);

  // KRİTİK EKSİK (cihazlar arası senkron kopukluğu — bkz. docs/HISTORY.md
  // Madde 101): eskiden `fetchFreshData` yalnızca (1) soğuk açılışta VE (2)
  // `SYNC_INTERVAL` (10 dk, bkz. utils/cacheTTL.ts) doldurduğunda çalışıyordu
  // — uygulama arka plana atılıp geri getirildiğinde HİÇBİR yeniden senkron
  // tetiklenmiyordu (repo genelinde tek bir `AppState` dinleyicisi bile
  // yoktu). Standart RN deseni: arka plan → ön plan GEÇİŞİNİ (yalnızca ilk
  // mount'u DEĞİL) yakala ve bir senkron tetikle.
  //
  // BİLİNÇLİ KARAR (Madde 107) — `force=false`, `force=true` DEĞİL:
  // Kullanıcı hem "cihazlar arası gecikme istemiyorum" hem "pil/performansı
  // yorma, spam yapma" dedi — ilk bakışta çelişkili görünen bu iki isteği TEK
  // parametre değişikliğiyle karşılıyoruz. `fetchFreshData` (bkz.
  // services/library/fetchers.ts) içindeki `syncHiddenLists(accessToken)`
  // çağrısı BİLİNÇLİ OLARAK `force`/TTL kontrolünden ÖNCE, KOŞULSUZ çalışır
  // (Madde 102) — yani `force=false` verilse BİLE "Bırak" (hide/unhide)
  // durumu HER foreground geçişinde, TTL'den bağımsız, iki hafif GET isteğiyle
  // anında tazelenir; hiçbir gecikme eklenmez. Yalnızca ARKASINDAN gelen ağır
  // ~15 uç noktalı tam senkron (izleme geçmişi, puanlar, listeler, takvim vb.)
  // 10 dakikalık TTL'e tabi kalır — kullanıcı uygulamalar arasında sık sık
  // geçiş yapsa bile (bildirim kontrolü, kısa bir göz atma) her seferinde
  // ağır bir senkron tetiklenip pil/veri harcamaz. `force=true` kullanılsaydı
  // "Bırak" için zaten gereksiz olan bu ağır senkron da her foreground'da
  // tetiklenir, tam olarak kullanıcının istemediği "spam" davranışını
  // üretirdi. Mevcut `isFetchingFreshData` kilidi + devre kesici + rate-limit
  // koruması ayrıca üst üste binen çağrılara karşı savunma sağlıyor.
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!accessToken) return;

    const subscription = AppState.addEventListener('change', (nextState) => {
      const wasBackgrounded = appStateRef.current.match(/inactive|background/);
      appStateRef.current = nextState;
      if (wasBackgrounded && nextState === 'active') {
        LibraryService.fetchFreshData(accessToken, false);
      }
    });

    return () => subscription.remove();
  }, [accessToken]);

  return <>{children}</>;
};

// Katı seçici: ekranlar sadece ihtiyaç duydukları dilimi okusun diye.
// Örnek: const watchedShows = useLibrarySelector(s => s.watchedShows);
// Böylece store'un başka bir dilimi değiştiğinde bileşen yeniden render OLMAZ.
export const useLibrarySelector = <T,>(selector: (state: LibraryState) => T): T =>
  useLibraryStore(useShallow(selector));

// Aksiyonlar için store ABONELİĞİ OLMAYAN hook: servis fonksiyonları modül seviyesinde
// sabittir, refreshLibrary yalnızca accessToken değişince yenilenir. Sıcak ekranlar
// veri için useLibrarySelector, eylemler için bunu kullanır — store değişimleri
// bu hook'u kullanan bileşeni ASLA yeniden render etmez.
export const useLibraryActions = () => {
  const { accessToken } = useAuth();

  const refreshLibrary = useCallback(
    async () => await LibraryService.fetchFreshData(accessToken, true),
    [accessToken]
  );

  return useMemo(() => ({ ...LibraryService, refreshLibrary }), [refreshLibrary]);
};

// Geriye uyumlu Proxy Hook. useShallow sayesinde değeri değişmeyen set çağrıları
// tüketicileri yeniden render etmez; dönüş nesnesi de memoize edilir ki
// alt bileşenlerin useCallback/memo bağımlılıkları her render'da kırılmasın.
export const useLibrary = () => {
  const store = useLibraryStore(useShallow((s) => s));
  const { accessToken } = useAuth();

  const refreshLibrary = useCallback(
    async () => await LibraryService.fetchFreshData(accessToken, true),
    [accessToken]
  );

  return useMemo(
    () => ({
      ...store,
      ...LibraryService,
      refreshLibrary,
    }),
    [store, refreshLibrary]
  );
};
