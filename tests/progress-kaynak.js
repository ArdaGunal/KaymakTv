// M439: bölünmüş gerçek uygulama kaynakları. Eski denetimleri köprü dosyasına
// yorum yerleştirerek kandırmak yerine taşınan gövdeleri de okur.
const fs = require('node:fs');
const path = require('node:path');
module.exports = (root) => ['progress.ts', 'progressState.ts', 'progressUndo.ts']
  .map((file) => fs.readFileSync(path.join(root, 'services/library/mutations', file), 'utf8')).join('\n');
