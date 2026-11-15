// 080 yerel sınamasının deneme satırlarını üretir (stdout'a SQL). `gorunen-ad-080.sh` çağırır.
//
// 🔴 BEKLENEN SONUÇ SÖZLEŞMEDEN GELİR, SQL'DEN DEĞİL (bağımsız denetim, 2026-11-15). Eski sürüm
// ret vektörlerinin beklenen sonucunu 080'in kendi yasak listesinden hesaplıyordu; DB'nin yanlış
// kabulü böylece «beklenen başarı» sayılıyordu. Artık:
//   1. SÖZLEŞME — `tests/arayuz/gorunen-ad-vektorleri.json` (elle yazılmış):
//      `kabul[].kanonik` → DB KABUL etmeli · `kanonik_ret[]` → DB REDDETMELİ.
//   2. EŞLİK — DB ile istemci kuralının (`utils/gorunenAd.ts` `kanonikAdKarari`) çok sayıda kod
//      noktasında AYNI karar vermesi. Bu bölüm sözleşme değil, iki uygulamanın uyuşmasıdır ve
//      satır adında «eslik» yazar.
// Metinler `convert_from(decode(hex))` ile gider: tırnak/kaçış sorunu yok, görünmez karakter çıplak durmaz.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tsLoader } from '../ts-test-loader.mjs';

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const satirlar = [];
const dene = (etiket, s, beklenen) => {
  const hex = Buffer.from(s, 'utf8').toString('hex');
  const ad = etiket.replace(/'/g, "''");
  satirlar.push(`INSERT INTO sonuc VALUES ('${ad}', pg_temp.kabul(convert_from(decode('${hex}', 'hex'), 'UTF8')) = ${beklenen});`);
};
const kp = (n) => `U+${n.toString(16).toUpperCase().padStart(4, '0')}`;

// 1 · Sözleşme
const v = JSON.parse(fs.readFileSync(path.join(KOK, 'tests/arayuz/gorunen-ad-vektorleri.json'), 'utf8'));
for (const [, kanonik, aciklama] of v.kabul) dene(`sozlesme KABUL: ${aciklama}`, kanonik, true);
for (const [deger, aciklama] of v.kanonik_ret) dene(`sozlesme RET: ${aciklama}`, deger, false);

// 2 · Eşlik (istemci kuralı yüklenebiliyorsa)
const { kanonikAdKarari } = tsLoader(KOK)('utils/gorunenAd.ts');
if (typeof kanonikAdKarari === 'function') {
  const noktalar = new Set();
  for (let n = 0x20; n <= 0x10ffff; n += n < 0x30000 ? 41 : 4099) noktalar.add(n);
  // Unicode sınıf sınırları: bir kod noktası ile komşusunun kararı farklıysa ikisi de denenir.
  let onceki = null;
  for (let n = 0x20; n <= 0x30000; n++) {
    if (n >= 0xd800 && n <= 0xdfff) continue;
    const karar = kanonikAdKarari(`a${String.fromCodePoint(n)}`);
    if (onceki !== null && karar !== onceki) { noktalar.add(n); noktalar.add(n - 1); }
    onceki = karar;
  }
  for (const n of noktalar) {
    if (n >= 0xd800 && n <= 0xdfff) continue;
    const s = `a${String.fromCodePoint(n)}`;
    dene(`eslik ${kp(n)}`, s, kanonikAdKarari(s) === 'yaz');
  }
} else {
  process.stderr.write('UYARI: utils/gorunenAd.ts kanonikAdKarari yok — eslik bolumu atlandi\n');
}

process.stdout.write(satirlar.join('\n') + '\n');
process.stderr.write(`uretilen deneme: ${satirlar.length}\n`);
