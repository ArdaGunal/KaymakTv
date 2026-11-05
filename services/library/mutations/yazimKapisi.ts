import * as libraryApi from '../../api/library';
import { ciftYaz } from '../ciftYaz';

/** Oturum Kaymak (Google-only) mı? Trakt token'ı yoksa Trakt'a gidilmez. */
export const kaymakYoluMu = () => libraryApi.kaymakKullanicisiMi();

/**
 * Kütüphane yazımlarının TEK KAPISI (M575). Trakt'a yazan her mutasyon buradan geçer;
 * `tests/arayuz/yazim-kapisi.test.mjs` başka yolu reddeder. Kural: `ciftYaz.ts`.
 * Puan istisnadır: yalnız bizde durur, Trakt'a hiç gitmez (kullanıcı kararı 2026-11-05).
 */
export const heryereYaz = async (
  bize: () => Promise<unknown>,
  trakte: () => Promise<unknown>,
): Promise<void> => ciftYaz(bize, (await kaymakYoluMu()) ? null : trakte);
