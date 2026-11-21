const path = require('node:path');
const { existsSync } = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

// Ölçüm kipinde arşiv ve takip tablosu kalıcı olarak değişmez.
function olcumImlecleri(arsivYolu, yaz = false) {
  if (!arsivYolu) return null;
  const dosya = path.join(path.dirname(arsivYolu), 'radar-olcum.db');
  if (!yaz && !existsSync(dosya)) return null;
  const db = new DatabaseSync(dosya, { readOnly: !yaz });
  if (yaz) db.exec(`CREATE TABLE IF NOT EXISTS imlec (
    akis TEXT PRIMARY KEY, at INTEGER NOT NULL, telafi_son_id INTEGER) STRICT`);
  return {
    oku: () => db.prepare('SELECT * FROM imlec').all(),
    yaz: (akis, at, telafi) => db.prepare('INSERT OR REPLACE INTO imlec VALUES (?,?,?)').run(akis, at, telafi),
    kapat: () => db.close(),
  };
}

module.exports = { olcumImlecleri };
