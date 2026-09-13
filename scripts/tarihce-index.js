#!/usr/bin/env node
// ==========================================================================
// TARİHÇE DİZİNİ — HISTORY.md'nin madde haritası
// ==========================================================================
// Çalıştır:  npm run tarihce:index
// Üretir:    docs/HISTORY_INDEX.md  (ÜRETİLEN DOSYA — elle düzenleme)
//
// 🔴 NEDEN VAR: `HISTORY.md` 16 bin satır (~1,5 MB) ve AGENTS.md "asla baştan
// okuma" diyor. Doğru yöntem madde numarasıyla nokta atışı okumak — ama önce
// "hangi madde neredeydi" sorusunu cevaplamak gerekiyordu ve bu her oturumda
// birkaç arama ediyordu. Bu dizin o adımı TEK dosyaya indiriyor.
//
// Kullanım (ajan için): dizinden satır numarasını bul, sonra
//   sed -n '<bas>,<son>p' docs/HISTORY.md
// ile YALNIZCA o aralığı oku.

const fs = require('fs');
const path = require('path');

const KOK = path.resolve(__dirname, '..');
const KAYNAK = path.join(KOK, 'docs', 'HISTORY.md');
const HEDEF = path.join(KOK, 'docs', 'HISTORY_INDEX.md');

const metin = fs.readFileSync(KAYNAK, 'utf8');
const satirlar = metin.split(/\r?\n/);

const maddeler = [];
satirlar.forEach((satir, i) => {
  const m = satir.match(/^## (\d+)\.\s*(.*)$/);
  if (m) maddeler.push({ no: Number(m[1]), baslik: m[2].trim(), satir: i + 1 });
});

// Bitiş satırı = bir sonraki maddenin başlangıcı - 1 (son madde için dosya sonu).
maddeler.forEach((m, i) => {
  m.son = i + 1 < maddeler.length ? maddeler[i + 1].satir - 1 : satirlar.length;
});

const bugun = new Date().toISOString().slice(0, 10);
const govde = [
  '# 🗂️ HISTORY MADDE DİZİNİ',
  '',
  '> ⚠️ **ÜRETİLEN DOSYA — elle düzenleme.** Yenile: `npm run tarihce:index`',
  `> Üretildi: ${bugun} · ${maddeler.length} madde · kaynak \`HISTORY.md\` (${satirlar.length} satır)`,
  '',
  '**Kullanım:** aradığın maddeyi bul, sonra YALNIZCA o aralığı oku:',
  '```bash',
  "sed -n '<bas>,<son>p' docs/HISTORY.md",
  '```',
  '🔴 `HISTORY.md`\'yi baştan okuma — tek başına oturumun bağlamını doldurur (AGENTS.md).',
  '',
  '| Madde | Satır | Başlık |',
  '|---|---|---|',
  ...maddeler.map((m) => `| **${m.no}** | ${m.satir}–${m.son} | ${m.baslik.replace(/\|/g, '\\|')} |`),
  '',
].join('\n');

fs.writeFileSync(HEDEF, govde, 'utf8');
console.log(`docs/HISTORY_INDEX.md yazildi — ${maddeler.length} madde, son: M${maddeler[maddeler.length - 1].no}`);
