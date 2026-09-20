// ==========================================================================
// KEŞFET ARAMASI — eşik kararı  (M415)
// ==========================================================================
// Kullanıcı (2026-09-20): *"kullanıcı ara diyince 1 harf de olsa arasın."*
//
// 🔴 ESKİ DAVRANIŞ VE ŞİKÂYET: eşik 3 karakterdi (`length > 2`). İki harf
// yazan kullanıcı hiçbir şey göremiyor ve "arama çubuğu çalışmıyor"
// sanıyordu (cihazda bildirildi). Ayrıca "24", "Us", "ER" gibi KISA adlar
// hiçbir zaman aranamıyordu.
//
// ⚖️ YÜK: `SearchBar` tuş vuruşlarını zaten 500 ms geciktiriyor
// (components/SearchBar.tsx); istek Pi köprüsünden geçiyor (M414, dakikalık
// sınır) ve her sorgu TEK dizi + TEK film isteği ediyor. Tek harfte dönen
// sonuç kalabalık olabilir — bu bilinçli: kullanıcı yazmaya devam ettikçe
// liste daralıyor.

/** Aramanın başlaması için gereken EN AZ karakter. */
export const ARAMA_EN_AZ_KARAKTER = 1;

/** SAF — bu sorgu için arama yapılmalı mı? Yalnızca boşluk ise HAYIR. */
export const aramaAcikMi = (q: string | null | undefined): boolean =>
  (q ?? '').trim().length >= ARAMA_EN_AZ_KARAKTER;
