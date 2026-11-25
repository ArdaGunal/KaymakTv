const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { once } = require('node:events');
const { mkdtemp, readFile, readdir, rm, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { test } = require('node:test');
const { gzipSync } = require('node:zlib');
const express = require('express');
const Jimp = require('jimp-compact');
const { afisOnbellegi, kompaktJpeg } = require('../afis');
const { katalogOku } = require('../katalogOku');
const { paylasimRouter } = require('../router');

async function testDizini(t) {
  const dizin = await mkdtemp(join(tmpdir(), 'kaymak-og-'));
  t.after(() => rm(dizin, { recursive: true, force: true }));
  return dizin;
}

async function gercekArsiv(t) {
  const dizin = await testDizini(t);
  const dbPath = join(dizin, 'katalog.db');
  const yazici = new DatabaseSync(dbPath);
  yazici.exec(await readFile(join(__dirname, '../../archive/schema.sql'), 'utf8'));
  yazici.exec(`
    INSERT INTO entities(kaymak_id,type,parent_id,season_number,episode_number,title,year,created_at,updated_at)
    VALUES ('d1','show',NULL,NULL,NULL,'Dizi',2025,1,1),
           ('s3','season','d1',3,NULL,NULL,NULL,1,1),
           ('s2','season','d1',2,NULL,NULL,NULL,1,1),
           ('e5','episode','s3',3,5,'Spoiler',NULL,1,1),
           ('f1','movie',NULL,NULL,NULL,'Film',2022,1,1),
           ('d2','show',NULL,NULL,NULL,'Diger Dizi',2020,1,1),
           ('s23','season','d2',3,NULL,NULL,NULL,1,1),
           ('e25','episode','s23',3,5,'Diger Bolum',NULL,1,1);
    INSERT INTO external_ids(source,source_id,kaymak_id,first_seen_at,last_seen_at,retired_at)
    VALUES ('trakt:show','1390','d1',1,1,NULL), ('trakt:show','9','d2',1,1,NULL),
           ('trakt:episode','123','e5',1,1,NULL), ('trakt:episode','234','e25',1,1,NULL),
           ('trakt:episode','345','e5',1,1,2), ('trakt:movie','12','f1',1,1,NULL);
  `);
  const ekle = yazici.prepare(`
    INSERT INTO payloads(kaymak_id,provider,endpoint,lang,body,bytes_raw,bytes_gz,fetched_at,updated_at)
    VALUES (?,'tmdb',?,?,?,?,?,1,1)
  `);
  for (const [id, aile, dil, meta] of [
    ['d1', 'tv_detail', 'tr', { overview: 'Turkce ozet', poster_path: '/dizi.jpg',
      seasons: [{ season_number: 3, poster_path: '/sezon.jpg' }] }],
    ['d1', 'tv_detail', 'en', { overview: 'English overview', poster_path: '/other.jpg' }],
    ['f1', 'movie_detail', '-', { overview: 'Film summary', poster_path: '/film.jpg' }],
  ]) {
    const ham = Buffer.from(JSON.stringify(meta));
    const gz = gzipSync(ham);
    ekle.run(id, aile, dil, gz, ham.length, gz.length);
  }
  yazici.close();
  return (hedef, dil) => katalogOku(hedef, dil, () => ({ db: new DatabaseSync(dbPath, { readOnly: true }) }));
}

test('salt okunur arşiv dizi, film, sezon ve bölüm özetini çözer', async (t) => {
  const oku = await gercekArsiv(t);
  assert.deepEqual(await oku({ tur: 'show', id: 1390 }, 'tr'), {
    baslik: 'Dizi (2025)', aciklama: 'Turkce ozet', afis: '/dizi.jpg',
  });
  assert.equal((await oku({ tur: 'show', id: 1390 }, 'en')).afis, '/other.jpg');
  assert.deepEqual(await oku({ tur: 'movie', id: 12 }, 'en'), {
    baslik: 'Film (2022)', aciklama: 'Film summary', afis: '/film.jpg',
  });
  assert.deepEqual(await oku({ tur: 'season', id: 1390, season: 3 }, 'en'), {
    baslik: 'Dizi (2025)', aciklama: 'Season 3', afis: '/sezon.jpg',
  });
  assert.equal((await oku({ tur: 'season', id: 1390, season: 2 }, 'en')).afis, '/other.jpg');
  assert.deepEqual(await oku({ tur: 'episode', id: '1390-ornek-s3e5-123' }, 'tr'), {
    baslik: 'Dizi (2025)', aciklama: '3. sezon · 5. bölüm', afis: '/dizi.jpg',
  });
  for (const id of ['1390-ornek-s3e5-234', '1390-ornek-s3e5-345', '1390-ornek-s3e6-123']) {
    assert.equal(await oku({ tur: 'episode', id }, 'tr'), null);
  }
  assert.equal(await oku({ tur: 'season', id: 1390, season: 4 }, 'tr'), null);
  assert.equal(await oku({ tur: 'movie', id: 999 }, 'tr'), null);
});

async function ornekJpeg() {
  return (await new Jimp(200, 300, 0xd05020ff)).getBufferAsync(Jimp.MIME_JPEG);
}

test('kompakt JPEG dikey görseli üstten, yatay görseli ortadan boşluksuz kırpar', async () => {
  const kirmizi = 0xe02020ff;
  const mavi = 0x2020e0ff;
  const dikey = await new Jimp(200, 300, mavi);
  dikey.composite(await new Jimp(200, 200, kirmizi), 0, 0);
  const yatay = await new Jimp(400, 200, mavi);
  yatay.composite(await new Jimp(200, 200, kirmizi), 100, 0);
  for (const kaynak of [dikey, yatay]) {
    const kare = await Jimp.read(await kompaktJpeg(await kaynak.getBufferAsync(Jimp.MIME_JPEG)));
    assert.deepEqual([kare.bitmap.width, kare.bitmap.height], [200, 200]);
    for (const [x, y] of [[4, 4], [195, 4], [4, 195], [195, 195]]) {
      const { r, b } = Jimp.intToRGBA(kare.getPixelColor(x, y));
      assert.ok(r > 180 && b < 80, `Karede boşluk ya da yanlış kırpma: ${x},${y}`);
    }
  }
});

test('aynı afiş için eşzamanlı istekler tek CDN çağrısı yapar ve kare JPEG yeniden başlatma sonrası diskten okunur', async (t) => {
  const dizin = await testDizini(t);
  const girdi = await ornekJpeg();
  const eski = createHash('sha256').update('w342-kare360-v1:/yerel_Afis-1.jpg').digest('hex') + '.jpg';
  await writeFile(join(dizin, eski), girdi);
  let cagri = 0;
  const afisler = afisOnbellegi({ dizin, getir: async (url, secenek) => {
    cagri++;
    assert.equal(url, 'https://image.tmdb.org/t/p/w342/yerel_Afis-1.jpg');
    assert.equal(secenek.redirect, 'error');
    assert.ok(secenek.signal instanceof AbortSignal);
    return new Response(girdi, { headers: { 'Content-Type': 'image/jpeg' } });
  } });
  const dosyalar = await Promise.all(Array.from({ length: 8 }, () => afisler.hazirla('/yerel_Afis-1.jpg')));
  assert.match(dosyalar[0], /^200-[a-f0-9]{64}\.jpg$/);
  assert.equal(new Set(dosyalar).size, 1);
  assert.equal(cagri, 1);
  assert.deepEqual((await readdir(dizin)).sort(), [dosyalar[0], eski].sort());
  const disk = afisOnbellegi({ dizin, getir: () => assert.fail('Disk doluyken ağ çağrılmaz') });
  assert.equal(await disk.hazirla('/yerel_Afis-1.jpg'), dosyalar[0]);
  const kare = await Jimp.read(await disk.oku(dosyalar[0]));
  assert.equal(kare.bitmap.width, 200);
  assert.equal(kare.bitmap.height, 200);
  assert.equal(kare.getPixelColor(180, 180) >>> 24, 0xd0);
  assert.deepEqual(await disk.oku(eski), girdi);
});

test('geçersiz yollar, hatalı yanıtlar ve zaman aşımı disk çıktısı üretmez', async (t) => {
  const dizin = await testDizini(t);
  let cagri = 0;
  const afisler = afisOnbellegi({ dizin, zamanAsimiMs: 15, getir: async (url, { signal }) => {
    cagri++;
    if (url.endsWith('/yavas.jpg')) return new Promise((_, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      setTimeout(() => reject(new Error('Test süresi aşıldı')), 200).unref();
    });
    if (url.endsWith('/buyuk.jpg')) {
      return new Response(Buffer.alloc(1024 * 1024 + 1), { headers: { 'Content-Type': 'image/jpeg' } });
    }
    if (url.endsWith('/yonlendir.jpg')) return Response.redirect('https://example.org/afis.jpg');
    return new Response('JPEG değil', { headers: { 'Content-Type': 'image/jpeg' } });
  } });
  for (const yol of ['/../x.jpg', 'https://example.org/x.jpg', '//x.jpg', '/x.jpg?x=1', '/%2fx.jpg', '/a.svg']) {
    assert.equal(await afisler.hazirla(yol), null);
  }
  assert.equal(cagri, 0);
  // AbortSignal zamanlayıcısı unref olduğundan test boyunca döngüyü açık tut.
  const zamanlayici = setInterval(() => {}, 100);
  t.after(() => clearInterval(zamanlayici));
  for (const yol of ['/yavas.jpg', '/buyuk.jpg', '/yonlendir.jpg', '/bozuk.jpg']) {
    assert.equal(await afisler.hazirla(yol), null);
  }
  assert.equal(await afisler.hazirla('/yavas.jpg'), null);
  assert.equal(cagri, 4);
  assert.deepEqual(await readdir(dizin), []);
});

test('Express router özeti yetkilendirir, sosyal hedefi okumaz ve genel kare görseli sunar', async (t) => {
  const uygulama = express();
  let okuma = 0;
  let afisIstegi = 0;
  uygulama.use('/api/paylasim', paylasimRouter({
    ogSir: 'test-key',
    async okuKatalog(hedef) {
      okuma++;
      if (hedef.id === 404) return null;
      return { baslik: 'Dizi', aciklama: 'Ozet', afis: '/dizi.jpg' };
    },
    afisler: { async hazirla() { afisIstegi++; return null; }, async oku() { return null; } },
  }));
  const sunucu = uygulama.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve) => sunucu.close(resolve)));
  await once(sunucu, 'listening');
  const kok = `http://127.0.0.1:${sunucu.address().port}/api/paylasim`;
  const ozet = (yol, anahtar = 'test-key') => {
    const sorgu = new URLSearchParams({ url: 'https://kaymaktv.com' + yol, dil: 'tr' });
    return fetch(`${kok}/ozet?${sorgu}`, { headers: { 'X-Kaymak-OG-Key': anahtar } });
  };

  assert.equal((await ozet('/show/1390', 'yanlis')).status, 404);
  assert.equal((await ozet('/u/10337897')).status, 404);
  assert.equal(okuma, 0);
  const yanit = await ozet('/show/1390-dizi?tmdbId=12');
  assert.equal(yanit.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(await yanit.json(), { baslik: 'Dizi', aciklama: 'Ozet', gorsel: null });
  assert.equal((await ozet('/show/404')).status, 404);

  for (const [boyut, onek] of [[200, '200-'], [360, '']]) {
    const yedek = `kaymaktv-${boyut}.jpg`;
    const afis = await fetch(`${kok}/afis/${yedek}`);
    assert.match(afis.headers.get('content-type'), /^image\/jpeg/);
    const gorsel = await Jimp.read(Buffer.from(await afis.arrayBuffer()));
    assert.deepEqual([gorsel.bitmap.width, gorsel.bitmap.height], [boyut, boyut]);
    const kayip = await fetch(`${kok}/afis/${onek}${'a'.repeat(64)}.jpg`, { redirect: 'manual' });
    assert.equal(kayip.headers.get('location'), `/api/paylasim/afis/${yedek}`);
    assert.equal(kayip.headers.get('cache-control'), 'no-store');
  }
  assert.equal(afisIstegi, 1);
});
