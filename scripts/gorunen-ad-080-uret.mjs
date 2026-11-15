#!/usr/bin/env node
// ==========================================================================
// 080 · görünen ad CHECK'ini istemci kuralından ÜRETİR (tek kaynak)
// ==========================================================================
// Kullanım:  node scripts/gorunen-ad-080-uret.mjs        → supabase/schema/080_display_name_kurali.sql
// Plan: docs/design/ISIM_TEKRAR_ANALIZ_PLANI.md §3 Dal 1. Bağımsız denetim (2026-11-15): eski 080
// yalnız yasak listeyi denetliyordu; `123`, `Arda＄`, yetim birleşen işaret DB'den geçiyordu.
//
// NEDEN ÜRETİLİR: PostgreSQL düzenli ifadesinde `\p{L}` yok; `[[:alpha:]]` sunucu yereline bağlı.
// Bu betik her kod noktasını (U+0001–U+10FFFF) `utils/gorunenAd.ts`'teki AYNI desenlerle
// (`KURAL_DESENLERI`, `YASAK_ARALIKLAR`) sınıflar ve PostgreSQL karakter sınıflarına çevirir.
// Sonuç `kanonikAdKarari`'nın birebir karşılığıdır. Unicode tabloları betiği çalıştıran
// Node'un sürümünden gelir; kural değişirse betik yeniden çalıştırılır, `npm test`
// (`gorunen-ad`) dosyanın güncel üretimle aynı olduğunu denetler.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tsLoader } from '../tests/ts-test-loader.mjs';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const HEDEF = path.join(KOK, 'supabase/schema/080_display_name_kurali.sql');
const TB = String.fromCharCode(92);

/** Kod noktası kümesini (yükleme sırasıyla gelen sayılar) PG köşeli parantez içeriğine çevirir. */
function sinif(uye) {
  const hex = (n) => `${TB}x${n.toString(16).padStart(4, '0')}`;
  const parcalar = [];
  let bas = null;
  let onceki = null;
  for (let n = 1; n <= 0x110000; n++) {
    const var_ = n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) && uye(n);
    if (var_ && bas === null) bas = n;
    if (!var_ && bas !== null) {
      onceki = n - 1;
      parcalar.push(bas === onceki ? hex(bas) : `${hex(bas)}-${hex(onceki)}`);
      bas = null;
    }
  }
  return parcalar.join('');
}

/** 080 dosyasının tam metni. */
export function uret() {
  const { YASAK_ARALIKLAR, KURAL_DESENLERI: D } = tsLoader(KOK)('utils/gorunenAd.ts');
  const yasak = (n) => YASAK_ARALIKLAR.some(([a, b]) => n >= a && n <= b);
  const c = (n) => String.fromCodePoint(n);
  // Desen üyeliği tek karakterle sınanır; işaret sınıfı `ISARET_YIGINI`'den (5 tekrar) okunur.
  const izinli = (n) => D.IZINLI.test(c(n)) && !yasak(n);
  const harf = (n) => D.HARF.test(c(n)) && !yasak(n);
  const isaret = (n) => D.ISARET_YIGINI.test(c(n).repeat(5));
  const harfVeyaIsaret = (n) => D.HARF.test(c(n)) || isaret(n);

  const IZINLI = sinif(izinli);
  const HARF = sinif(harf);
  const ISARET = sinif(isaret);
  const HARF_ISARET = sinif(harfVeyaIsaret);

  return `-- ════════════════════════════════════════════════════════════════════════════
-- 080 · Görünen ad kuralı veritabanında (Kaymak 1.0.1 · Dal 1, K2) — SÜRÜM 2
-- ════════════════════════════════════════════════════════════════════════════
-- 🔴 ÜRETİLMİŞ DOSYA — elle düzenleme: \`node scripts/gorunen-ad-080-uret.mjs\`.
-- Plan: docs/design/ISIM_TEKRAR_ANALIZ_PLANI.md §3 Dal 1.
--
-- NE YAPAR: \`users_display_name_check\`, Worker \`kanonikAdKarari\`'nın birebir karşılığı olur:
--   1–50 kod noktası · NFC · kenarda boşluk yok · çift boşluk yok ·
--   yalnız izinli karakter (Unicode harf, birleşen işaret, rakam, boşluk, . - _ ') ·
--   en az bir harf · NFD biçiminde birleşen işaret harfe bağlı ve en çok 4 üst üste.
-- Karakter sınıfları \`utils/gorunenAd.ts\` desenlerinden üretildi (PostgreSQL'de \\p{L} yok).
--
-- SÜRÜM 1 NEDEN DEĞİŞTİ (bağımsız denetim, 2026-11-15): yalnız yasak listeyi denetliyordu;
-- \`123\`, \`Arda＄\` (U+FF04), \`Arda\` + U+0606 / U+13430, yetim U+0301 ve NFC(A + 5 işaret)
-- Worker'da reddedilirken DB'den geçiyordu.
--
-- CANLI DURUM VE STRATEJİ: 080'in canlıda uygulanıp uygulanmadığı DOĞRULANAMADI (anon anahtarı
-- kısıt tanımını okuyamaz; kullanıcı 2026-11-15'te yalnız ön tarama sorgusunu çalıştırdı). Bu
-- dosya TEKRAR ÇALIŞTIRILABİLİR: kısıtı DROP IF EXISTS + ADD ile kurar. Sürüm 1 uygulandıysa
-- bu sürüm onu YERİNE koyar; hiç uygulanmadıysa doğrudan kurar. Hangisinin canlıda olduğu
-- aşağıdaki doğrulama (1) ile görülür: sürüm 2 tanımında «NORMALIZE(display_name, NFD)» geçer.
--
-- CANLI VERİ: 2026-11-15 ön taraması 6 adlı satır, 0 şüpheli (kaba tarama). Uymayan satır
-- çıkarsa ADD CONSTRAINT hata verir, işlem geri alınır, HİÇBİR ŞEY değişmez.
-- SIRA: önce Worker (yeni kural), sonra bu dosya. Yerel sınama: bash tests/sql/gorunen-ad-080.sh
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
SET LOCAL lock_timeout = '5s';

DO $kontrol$
BEGIN
  IF current_setting('standard_conforming_strings') <> 'on' THEN
    RAISE EXCEPTION '080 DURDU: standard_conforming_strings kapalı — desendeki ters bölüler yanlış okunur';
  END IF;
  IF current_setting('server_version_num')::int < 130000 THEN
    RAISE EXCEPTION '080 DURDU: IS NFC NORMALIZED / normalize() PostgreSQL 13+ ister';
  END IF;
END
$kontrol$;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_display_name_check;
ALTER TABLE users
  ADD CONSTRAINT users_display_name_check CHECK (
    display_name IS NULL
    OR (
      char_length(display_name) BETWEEN 1 AND 50
      AND display_name IS NFC NORMALIZED
      AND display_name = btrim(display_name)
      AND strpos(display_name, '  ') = 0
      AND display_name ~ '^[${IZINLI}]+$'
      AND display_name ~ '[${HARF}]'
      AND normalize(display_name, NFD) !~ '(^|[^${HARF_ISARET}])[${ISARET}]'
      AND normalize(display_name, NFD) !~ '[${ISARET}]{5}'
    )
  );

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════
-- DOĞRULAMA (çalıştırdıktan sonra; salt okunur ya da geri alınan)
-- ════════════════════════════════════════════════════════════════════════════
-- 1) Hangi sürüm canlıda? → sürüm 2'de NORMALIZE(..., NFD) geçer (PG tanımı büyük harfle yazar):
--    SELECT position('normalize(display_name, nfd)' IN lower(pg_get_constraintdef(oid))) > 0 AS surum_2
--      FROM pg_constraint WHERE conname = 'users_display_name_check';
--
-- 2) Yalnız TEST HESABIYLA, geri alınan deneme (kalıcı hiçbir şey yazılmaz):
--    BEGIN;
--    UPDATE users SET display_name = '123' WHERE username = 'Arda_Gunal';        -- beklenen: 23514 HATASI
--    ROLLBACK;
--    BEGIN;
--    UPDATE users SET display_name = 'Arda Günal' WHERE username = 'Arda_Gunal'; -- beklenen: UPDATE 1
--    ROLLBACK;
`;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const metin = uret();
  fs.writeFileSync(HEDEF, metin);
  console.log(`yazildi ${path.relative(KOK, HEDEF)} (${metin.length} bayt)`);
}
