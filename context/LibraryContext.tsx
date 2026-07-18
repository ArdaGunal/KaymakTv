import React, { createContext, useMemo, useCallback } from 'react';
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
