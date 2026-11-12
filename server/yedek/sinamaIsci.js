// ==========================================================================
// GERİ YÜKLEME SINAMASI — İŞ PARÇACIĞI (029 §4 · 2026-11-12)
// ==========================================================================
// TEK İŞİ: bir arşiv yedeğinin GEÇİCİ KOPYASINI salt-okur açıp bütünlüğünü ve sayılarını ölçmek.
// Ayrı iş parçacığı, çünkü `node:sqlite` senkron: 120 MB'lık `integrity_check` ana olay döngüsünü
// saniyelerce dondururdu (yedekIsci.js'in aynı gerekçesi, M558 O-1b). Canlı arşive dokunmaz.

const { parentPort, workerData } = require('node:worker_threads');
const { DatabaseSync } = require('node:sqlite');

const COKLU = {
  traktBolum: 'trakt:episode',
  traktSezon: 'trakt:season',
  traktDizi: 'trakt:show',
  tmdbBolum: 'tmdb:episode',
};

function olc(dosya) {
  const db = new DatabaseSync(dosya, { readOnly: true });
  try {
    const satirlar = db.prepare('PRAGMA integrity_check').all();
    const butunluk = satirlar.length === 1 ? Object.values(satirlar[0])[0] : `${satirlar.length} sorun`;
    const say = (sql, ...p) => db.prepare(sql).get(...p).n;
    const sayilar = {
      entities: say('SELECT COUNT(*) n FROM entities'),
      externalIds: say('SELECT COUNT(*) n FROM external_ids'),
      payloads: say('SELECT COUNT(*) n FROM payloads'),
    };
    const cokluAktif = {};
    for (const [ad, kaynak] of Object.entries(COKLU)) {
      cokluAktif[ad] = say(
        'SELECT COUNT(*) n FROM (SELECT kaymak_id FROM external_ids WHERE source = ? AND retired_at IS NULL GROUP BY kaymak_id HAVING COUNT(*) > 1)',
        kaynak,
      );
    }
    return { ok: true, butunluk, sayilar, cokluAktif };
  } finally {
    db.close();
  }
}

try {
  parentPort.postMessage(olc(workerData.dosya));
} catch (error) {
  parentPort.postMessage({ ok: false, reason: error.message });
}
