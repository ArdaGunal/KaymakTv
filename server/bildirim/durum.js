const { join } = require('node:path');
const { arsivKokunuCoz } = require('../archive/db');

function motorDurumuAc(ortam, simdi) {
  const kok = arsivKokunuCoz(ortam);
  if (!kok) throw new Error('arsiv_kapali');
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(join(kok, 'bildirim-motoru.db'), { timeout: 0 });
  try {
    // Arşiv yazıcılarını engellememek için ayrı SQLite dosyası. Açık yazma
    // işleminin kilidi süreç kapanışı veya çökmesinde işletim sistemiyle çözülür.
    db.exec('BEGIN IMMEDIATE');
    db.exec('CREATE TABLE IF NOT EXISTS durum (anahtar TEXT PRIMARY KEY, deger INTEGER NOT NULL) STRICT');
    const oku = db.prepare("SELECT deger FROM durum WHERE anahtar='motor_baslangic'");
    let baslangic = oku.get()?.deger;
    if (baslangic === undefined) {
      db.prepare("INSERT INTO durum VALUES ('motor_baslangic', ?)").run(simdi);
      db.exec('COMMIT; BEGIN IMMEDIATE');
      baslangic = oku.get().deger;
    }
    return { baslangic, kapat: () => db.close() };
  } catch (hata) {
    db.close();
    if ((hata.errcode & 255) === 5 || (hata.errcode & 255) === 6) return null;
    throw hata;
  }
}

module.exports = { motorDurumuAc };
