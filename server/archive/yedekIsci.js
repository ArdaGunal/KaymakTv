// ==========================================================================
// KATALOG ARŞİVİ — Yedek İŞ PARÇACIĞI (Paket D · M558 · dış denetim O-1b/O-2)
// ==========================================================================
// TEK İŞİ: `VACUUM INTO` ile tutarlı tek dosyalık kopya almak — ANA OLAY DÖNGÜSÜNÜN DIŞINDA.
// `node:sqlite` senkron; ana iş parçacığında 109 MB'lık yedek sunucuyu 5,4–8,2 sn donduruyordu (Pi,
// ölçüldü) ve ana bağlantıda açık bir işlem varken «cannot VACUUM from within a transaction» ile
// düşüyordu (R8). Burada KENDİ salt-okur bağlantısı var: ana bağlantının işleminden etkilenmez,
// WAL'daki son işlenmiş durumu kopyalar.
//
// Sonuç `quick_check` ile doğrulanır; bozuk kopya silinir (yedek klasörünü bozuk dosyayla doldurmasın).
// `db.js backupToAsync` başlatır, `{ok, bytes} | {ok:false, reason}` mesajını bekler.

const { parentPort, workerData } = require('node:worker_threads');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

function calistir({ kaynak, hedef }) {
  const db = new DatabaseSync(kaynak, { readOnly: true });
  try {
    db.prepare('VACUUM INTO ?').run(hedef);
  } finally {
    db.close();
  }
  const kopya = new DatabaseSync(hedef, { readOnly: true });
  let sonuc;
  try {
    sonuc = Object.values(kopya.prepare('PRAGMA quick_check').get() || {})[0];
  } finally {
    kopya.close();
  }
  if (sonuc !== 'ok') {
    try { fs.unlinkSync(hedef); } catch (_) { /* yoksa sorun değil */ }
    return { ok: false, reason: `quick_check: ${sonuc}` };
  }
  return { ok: true, bytes: fs.statSync(hedef).size };
}

try {
  parentPort.postMessage(calistir(workerData));
} catch (error) {
  parentPort.postMessage({ ok: false, reason: error.message });
}
