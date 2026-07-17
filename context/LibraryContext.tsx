import React, { createContext } from 'react';
import { useLibraryStore } from '../store/useLibraryStore';
import * as LibraryService from '../services/libraryService';

export const LibraryContext = createContext<any>({});

export const LibraryProvider = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

import { useAuth } from './AuthContext';

export const useLibrary = () => {
  const store = useLibraryStore();
  const { accessToken, isLoading: authIsLoading } = useAuth();
  
  React.useEffect(() => {
    // Keep the service updated with the current token
    LibraryService.setLibraryToken(accessToken);
    if (accessToken && !authIsLoading) {
        LibraryService.loadCache().then(() => {
            LibraryService.fetchFreshData(accessToken);
        });
    }
  }, [accessToken, authIsLoading]);
  
  return {
    ...store,
    ...LibraryService,
    refreshLibrary: async () => await LibraryService.fetchFreshData(accessToken, true)
  };
};
