import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yardimci from '../yardimci.js';

// C7 yayın turunda bulundu (2026-10-10): film menüsü Android geri tuşuyla kapanmıyordu —
// `<Modal>`'da `onRequestClose` yoktu; geri tuşu yutuldu, sonraki dokunuş «Reset Watch
// History»ye geldi. Her Modal geri tuşuna yanıt vermeli.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const T = yardimci.baslat('MODAL GERI TUSU', { kokOneki: 'modal-geri-' });
const eksik = [];
const gez = (d) => {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) gez(p);
    else if (f.endsWith('.tsx')) {
      const s = fs.readFileSync(p, 'utf8');
      for (const m of s.matchAll(/<Modal\b([\s\S]*?)>/g)) {
        if (!/onRequestClose/.test(m[1])) eksik.push(`${path.relative(root, p)}:${s.slice(0, m.index).split('\n').length}`);
      }
    }
  }
};
['app', 'components', 'features', 'screens'].forEach((d) => gez(path.join(root, d)));
for (const e of eksik) T.ok(`onRequestClose eksik: ${e}`, false);
T.ok(`Her <Modal> Android geri tusunu karsiliyor (${eksik.length} eksik)`, eksik.length === 0);
T.bitir();
