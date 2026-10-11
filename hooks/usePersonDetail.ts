import { useEffect, useState } from 'react';
import { getTmdbPerson, type TmdbPerson } from '../services/tmdbPerson';
import { logWarning } from '../utils/errorLog';

/** Oyuncu penceresinin verisi. `personId` null iken ağa çıkmaz. */
export function usePersonDetail(personId: number | null) {
  const [person, setPerson] = useState<TmdbPerson | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [deneme, setDeneme] = useState(0);

  useEffect(() => {
    if (!personId) {
      setPerson(null);
      setHasError(false);
      return;
    }
    let alive = true;
    setIsLoading(true);
    setHasError(false);
    getTmdbPerson(personId)
      .then((p) => { if (alive) setPerson(p); })
      .catch((error) => {
        logWarning('person.load', error);
        if (alive) setHasError(true);
      })
      .finally(() => { if (alive) setIsLoading(false); });
    return () => { alive = false; };
  }, [personId, deneme]);

  return { person, isLoading, hasError, retry: () => setDeneme((n) => n + 1) };
}
