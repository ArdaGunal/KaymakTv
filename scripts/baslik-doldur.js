#!/usr/bin/env node
// ==========================================================================
// BASLIK İLK DOLUM — tek seferlik bakım aracı (2.6.8 · BASLIK-02)
// ==========================================================================
// Arşivdeki TMDB ve Trakt yüklerinden `original_language`, `original_title`, `titles` kurup Supabase
// aynasına gönderir. Yalnız dizi/film kök satırları, bölüm satırı yok (`docs/testler/2.6.8.md` §0 md. 8).
// Sonraki gönderimleri gece aynası ve anlık aktarım kendisi yapar (`aynaSatirlari.js`).
//
// 🔴 VARSAYILAN KURU: yalnız sayar. Göndermek için `--uygula`.
// Arşive YAZMAZ, servisi yeniden başlatmayı gerektirmez.
//
// Kullanım (Pi — kök sistemd'deki LAZYFETCH_ROOT ile aynı olmalı):
//   LAZYFETCH_ROOT=/srv/projeler/kaymaktv/data/LazyFetch node scripts/baslik-doldur.js
//   LAZYFETCH_ROOT=/srv/projeler/kaymaktv/data/LazyFetch node scripts/baslik-doldur.js --uygula
// Yerel kopyada:  node scripts/baslik-doldur.js --db <katalog.db>

// Pi'de her DNS çözümü 5 sn bekliyor; `server.js`'teki ayarın aynısı.
if (!process.env.RES_OPTIONS) process.env.RES_OPTIONS = 'single-request-reopen';

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { kokSatirlari } = require('../server/archive/aynaSatirlari');
const { akisiGonder } = require('../server/archive/mirror');

const argDegeri = (ad) => {
  const i = process.argv.indexOf(ad);
  return i >= 0 ? process.argv[i + 1] : null;
};

/** `.env`'den yalnız gereken anahtarlar. Ortamda varsa ortam kazanır. */
function envOku() {
  const dosya = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(dosya)) return;
  for (const satir of fs.readFileSync(dosya, 'utf8').split(/\r?\n/)) {
    const m = /^(EXPO_PUBLIC_KAYMAK_WORKER_URL|PI_SYNC_SECRET)=(.*)$/.exec(satir);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

/** Saf sayım — yerli yapım ve çeviri doluluğu (BASLIK-02 kanıtı). */
function ozet(satirlar) {
  const say = (kosul) => satirlar.filter(kosul).length;
  const yerli = (s) => s.original_language === 'tr';
  return {
    toplam: satirlar.length,
    dizi: say((s) => s.type === 'show'),
    film: say((s) => s.type === 'movie'),
    yerliDizi: say((s) => s.type === 'show' && yerli(s)),
    yerliFilm: say((s) => s.type === 'movie' && yerli(s)),
    yerliAdli: say((s) => yerli(s) && (s.titles.tr || s.original_title)),
    yerliAdsiz: satirlar.filter((s) => yerli(s) && !s.titles.tr && !s.original_title).map((s) => s.title),
    trCeviri: say((s) => !yerli(s) && s.titles.tr),
    ozgunDilsiz: say((s) => !s.original_language),
    bolumSatiri: say((s) => s.type !== 'show' && s.type !== 'movie'),
  };
}

async function ana() {
  const yol = argDegeri('--db') || (process.env.LAZYFETCH_ROOT && path.join(process.env.LAZYFETCH_ROOT, 'archive', 'katalog.db'));
  if (!yol || !fs.existsSync(yol)) throw new Error(`Arsiv bulunamadi: ${yol} (--db ya da LAZYFETCH_ROOT)`);

  const db = new DatabaseSync(yol, { readOnly: true });
  const satirlar = await kokSatirlari(db);
  db.close();
  const o = ozet(satirlar);
  console.log(JSON.stringify(o, null, 2));
  if (o.bolumSatiri > 0) throw new Error('Kok disi satir var, gonderilmedi');

  if (!process.argv.includes('--uygula')) {
    console.log('KURU: hicbir sey gonderilmedi. Gondermek icin --uygula.');
    return;
  }
  envOku();
  const cfg = {
    workerUrl: (process.env.EXPO_PUBLIC_KAYMAK_WORKER_URL || '').replace(/\/$/, ''),
    secret: process.env.PI_SYNC_SECRET || '',
  };
  if (!cfg.workerUrl || cfg.secret.length < 32) throw new Error('Worker adresi ya da sir yok');
  const sayac = { yazilan: 0, atlanan: 0 };
  const r = await akisiGonder(cfg, 'entities', satirlar, sayac);
  console.log(JSON.stringify({ ...r, ...sayac }));
  if (!r.ok) process.exitCode = 1;
}

if (require.main === module) {
  ana().catch((e) => { console.error(e.message); process.exitCode = 1; });
}

module.exports = { ozet };
