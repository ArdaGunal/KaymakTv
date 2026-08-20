// F12 — `services/api/users.ts` (963 satır) sorumluluğa göre bölündü, boyuta
// göre değil (bkz. docs/MASTER_PLAN.md F12). Bu barrel dosyası eski tek
// dosyanın DIŞ YÜZEYİNİ birebir koruyor — `traktApi.ts`'in `export * from
// './api/users'` deseni ve `hooks/useProfilePrivacy.ts`'in doğrudan importu
// hiç değişmeden bu dizine (`./users/index.ts`) çözümleniyor, tüketici
// tarafında TEK SATIR değişmedi.
export * from './history';
export * from './ratings';
export * from './watchlist';
export * from './lists';
export * from './calendar';
export * from './settings';
