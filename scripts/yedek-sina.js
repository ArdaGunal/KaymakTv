#!/usr/bin/env node
// ==========================================================================
// npm run yedek:sina [arsiv-yedegi.db] [--kaydet]
// ==========================================================================
// Geri yükleme sınamasını ELLE koşar (gece turu ayda bir kendisi koşar — `server/yedek/ekIsler.js`).
//
//   • En yeni (ya da verilen) arşiv yedeği `gecici/` altına kopyalanır, kopya salt-okur açılır:
//     integrity_check, varlık/kimlik/yük sayıları, çoklu-aktif kimlik 0, canlı arşivle karşılaştırma.
//     Geçici kopya iş bitince silinir.
//   • En yeni LazyFetch tar'ı: sha256 + tar başlıkları + dosya sayısı `.json` ile aynı mı.
//
// YAZDIĞI TEK ŞEY: `gecici/` altındaki geçici kopya (silinir) ve `--kaydet` verilirse `sinama/`
// altına rapor. Canlı arşive salt-okur bağlanır; yedek dosyalarına dokunmaz.
// Klasörler `.env`'deki `ARCHIVE_BACKUP_DIR`'den çözülür (sunucuda `app/.env` → `config/.env`).

try { require('dotenv').config(); } catch (_) { /* dotenv yoksa ortamdaki değerler */ }

const path = require('path');
const { yedekKlasorleri } = require('../server/yedek/klasorler');
const { sinamaTuru, raporOzeti } = require('../server/yedek/sinama');
const { openReadOnly } = require('../server/archive/db');

function canliSayilar() {
  const ro = openReadOnly();
  if (!ro) return null;
  try {
    const say = (t) => ro.db.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n;
    return { entities: say('entities'), externalIds: say('external_ids'), payloads: say('payloads') };
  } finally {
    ro.db.close();
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const kaydet = argv.includes('--kaydet');
  const dosya = argv.find((a) => !a.startsWith('--')) || null;
  const klasor = yedekKlasorleri();
  if (!klasor) {
    console.error('Yedek klasoru cozulemedi: ARCHIVE_BACKUP_DIR tanimli degil.');
    process.exit(2);
  }
  const canli = canliSayilar();
  const rapor = await sinamaTuru({ klasor, canli, kaydet, arsivDosyasi: dosya ? path.resolve(dosya) : null });
  console.log(raporOzeti(rapor));
  console.log(JSON.stringify(rapor, null, 2));
  if (!canli) console.log('(canli arsiv acilamadi — karsilastirma yapilmadi)');
  process.exit(rapor.ok ? 0 : 1);
}

main().catch((e) => { console.error(e && e.message); process.exit(1); });
