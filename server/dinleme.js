// ==========================================================================
// DİNLEME ADRESİ — `PORT` + `HOST` (GNL-SERVER taşıması · D2)
// ==========================================================================
// NEDEN VAR: `app.listen(PORT)` bütün arayüzlerde dinliyordu (Pi'de `*:4830`, ev ağına açık).
// Yeni sunucuda dışarıya tek yol Cloudflare tüneli; port yalnız `127.0.0.1`'de açık olmalı
// (sunucu haritası: "hepsi yalnız 127.0.0.1"). Tünel `http://127.0.0.1:4830`'a bağlanır.
//
// 🔴 VARSAYILAN BUGÜNKÜ DAVRANIŞ: `HOST` yoksa/boşsa `host: undefined` → Node bütün arayüzleri
// dinler (Pi'de değişiklik yok; Pi'deki tünel `localhost:4830`'a gidiyor ve `::1` de dinlenmeli).
//
// Rate-limit anahtarı (`security.js` `clientIpKey`) `CF-Connecting-IP`'ye yalnız soket loopback
// ise güvenir; `127.0.0.1`'e bağlanmak bunu DEĞİŞTİRMEZ (tünel yine loopback'ten gelir).

/** `{ port, host }` — `host` undefined ise tüm arayüzler (bugünkü davranış). */
function dinlemeAyari(ortam = process.env) {
  // 🔴 Boş/yalnız boşluk PORT -> 4830 (eski `process.env.PORT || 4830` gibi). `Number('') === 0`
  // olduğu için bu kontrol olmadan `.env`'deki boş `PORT=` satırı RASTGELE porta açardı -> tünel düşer.
  const portMetni = String(ortam.PORT ?? '').trim();
  const port = portMetni === '' ? NaN : Number(portMetni);
  const host = String(ortam.HOST ?? '').trim();
  return {
    port: Number.isInteger(port) && port >= 0 ? port : 4830,
    host: host || undefined,
  };
}

/** Günlük için okunur adres: `127.0.0.1:4830`, `[::]:4830`. */
function adresMetni(adres) {
  if (!adres || typeof adres === 'string') return String(adres || '?');
  const a = adres.family === 'IPv6' || String(adres.family) === '6' ? `[${adres.address}]` : adres.address;
  return `${a}:${adres.port}`;
}

module.exports = { dinlemeAyari, adresMetni };
