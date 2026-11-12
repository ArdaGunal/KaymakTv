// ==========================================================================
// TAR (ustar) — yazıcı ve doğrulayıcı, bağımlılıksız (029 · 2026-11-12)
// ==========================================================================
// TEK İŞİ: LazyFetch önbelleğini tek bir `.tar` dosyasına yazmak ve bir tar'ı açmadan doğrulamak.
//
// NEDEN `tar` KOMUTU DEĞİL: (1) koşu sırasında süpürücü dosya silebilir — burada silinen dosya
// sayılıp atlanır, tur düşmez; (2) sha256 yazarken hesaplanır, dosya ikinci kez okunmaz;
// (3) testler Windows'ta da aynı kodla koşar (GNU tar bayrakları bsdtar'da yok); (4) npm paketi
// eklemek `npm ci` + bağımlılık yüzeyi demek.
// Çıktı düz POSIX ustar: geri yükleme her yerde `tar -xf dosya.tar -C <LazyFetch kökü>`.
//
// Yalnız düz dosyalar yazılır (klasörleri tar -x kendisi açar). Ad 100 bayta sığmazsa ustar `prefix`
// alanı (155 bayt) kullanılır; ikisine de sığmayan ad atlanır ve sayılır.

const fs = require('fs');
const crypto = require('crypto');

const BLOK = 512;
const PARCA = 1024 * 1024; // diske 1 MB'lık parçalarla yazılır

function oktalYaz(b, ofs, uzunluk, sayi) {
  b.write(sayi.toString(8).padStart(uzunluk - 1, '0') + '\0', ofs, uzunluk, 'latin1');
}

/** Adı ustar `name` (100) + `prefix` (155) alanlarına böler; sığmazsa `null`. */
function adBol(ad) {
  if (Buffer.byteLength(ad) <= 100) return { onEk: '', isim: ad };
  for (let i = ad.indexOf('/'); i > 0; i = ad.indexOf('/', i + 1)) {
    const onEk = ad.slice(0, i);
    const isim = ad.slice(i + 1);
    if (Buffer.byteLength(onEk) <= 155 && isim && Buffer.byteLength(isim) <= 100) return { onEk, isim };
  }
  return null;
}

function baslikUret(ad, boyut, mtimeSn) {
  const bol = adBol(ad);
  if (!bol) return null;
  if (boyut > 0o77777777777) return null; // 8 GB sınırı — önbellek dosyası için imkânsız
  const b = Buffer.alloc(BLOK);
  b.write(bol.isim, 0, 100, 'utf8');
  oktalYaz(b, 100, 8, 0o644);
  oktalYaz(b, 108, 8, 0);
  oktalYaz(b, 116, 8, 0);
  oktalYaz(b, 124, 12, boyut);
  oktalYaz(b, 136, 12, Math.max(0, Math.floor(mtimeSn)));
  b.fill(0x20, 148, 156);
  b.write('0', 156, 1, 'latin1');
  b.write('ustar\0', 257, 6, 'latin1');
  b.write('00', 263, 2, 'latin1');
  b.write(bol.onEk, 345, 155, 'utf8');
  let toplam = 0;
  for (let i = 0; i < BLOK; i++) toplam += b[i];
  b.write(toplam.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'latin1');
  return b;
}

/**
 * Dosyaları tar'a yazar. Kaynak dosya okunurken kaybolursa (süpürücü sildi) atlanır ve sayılır.
 * @param {string} hedef  yazılacak tar yolu (çağıran `.yeni` uzantılı geçici ad verir)
 * @param {string} kok    göreli yolların kökü
 * @param {string[]} gorecelYollar  `/` ayraçlı göreli yollar (ör. `cache/tmdb/ab/x.json.gz`)
 * @returns {Promise<{adet: number, bayt: number, atlanan: number, atlananAd: number, sha256: string, boyut: number}>}
 */
async function tarYaz(hedef, kok, gorecelYollar) {
  const hash = crypto.createHash('sha256');
  const fh = await fs.promises.open(hedef, 'w', 0o640);
  let tampon = [];
  let tamponBoy = 0;
  let boyut = 0;
  const bosalt = async () => {
    if (!tamponBoy) return;
    const parca = Buffer.concat(tampon, tamponBoy);
    tampon = [];
    tamponBoy = 0;
    hash.update(parca);
    await fh.write(parca);
    boyut += parca.length;
  };
  const ekle = async (buf) => {
    tampon.push(buf);
    tamponBoy += buf.length;
    if (tamponBoy >= PARCA) await bosalt();
  };

  let adet = 0;
  let bayt = 0;
  let atlanan = 0;
  let atlananAd = 0;
  try {
    for (const gorecel of gorecelYollar) {
      const tam = `${kok}/${gorecel}`;
      let st;
      let veri;
      try {
        st = await fs.promises.lstat(tam);
        if (!st.isFile()) continue;
        veri = await fs.promises.readFile(tam);
      } catch (error) {
        if (error && (error.code === 'ENOENT' || error.code === 'EACCES' || error.code === 'EISDIR')) { atlanan++; continue; }
        throw error;
      }
      const baslik = baslikUret(gorecel, veri.length, st.mtimeMs / 1000);
      if (!baslik) { atlananAd++; continue; }
      await ekle(baslik);
      await ekle(veri);
      const dolgu = (BLOK - (veri.length % BLOK)) % BLOK;
      if (dolgu) await ekle(Buffer.alloc(dolgu));
      adet++;
      bayt += veri.length;
    }
    await ekle(Buffer.alloc(BLOK * 2)); // arşiv sonu: iki boş blok
    await bosalt();
    await fh.sync();
  } finally {
    await fh.close();
  }
  return { adet, bayt, atlanan, atlananAd, sha256: hash.digest('hex'), boyut };
}

function oktalOku(b, ofs, uzunluk) {
  const ham = b.toString('latin1', ofs, ofs + uzunluk).replace(/[\0 ]+$/g, '').trim();
  if (!/^[0-7]*$/.test(ham)) return NaN;
  return ham ? parseInt(ham, 8) : 0;
}

function cString(b, ofs, uzunluk) {
  const dilim = b.subarray(ofs, ofs + uzunluk);
  const son = dilim.indexOf(0);
  return dilim.subarray(0, son < 0 ? dilim.length : son).toString('utf8');
}

/**
 * Tar'ı AÇMADAN doğrular: her başlığın sağlama toplamı, dosya sayısı, toplam bayt, düzgün bitiş.
 * @param {string} dosya
 * @param {{adlar?: boolean}} [secenek] adlar: true → dosya adlarını da döndür (testler için)
 * @returns {Promise<{ok: boolean, adet: number, bayt: number, hata: string|null, adlar?: string[]}>}
 */
async function tarDogrula(dosya, { adlar: adIste = false } = {}) {
  const fh = await fs.promises.open(dosya, 'r');
  const adlar = [];
  let adet = 0;
  let bayt = 0;
  try {
    const { size } = await fh.stat();
    const b = Buffer.alloc(BLOK);
    let ofs = 0;
    while (ofs + BLOK <= size) {
      const { bytesRead } = await fh.read(b, 0, BLOK, ofs);
      if (bytesRead !== BLOK) return { ok: false, adet, bayt, hata: `kisa okuma @${ofs}` };
      if (b.every((x) => x === 0)) return { ok: true, adet, bayt, hata: null, ...(adIste ? { adlar } : {}) };
      const beklenen = oktalOku(b, 148, 8);
      let toplam = 0;
      for (let i = 0; i < BLOK; i++) toplam += (i >= 148 && i < 156) ? 0x20 : b[i];
      if (beklenen !== toplam) return { ok: false, adet, bayt, hata: `saglama toplami @${ofs}` };
      const boyut = oktalOku(b, 124, 12);
      if (!Number.isFinite(boyut)) return { ok: false, adet, bayt, hata: `boyut @${ofs}` };
      const tur = String.fromCharCode(b[156]);
      if (tur === '0' || tur === '\0') {
        adet++;
        bayt += boyut;
        if (adIste) {
          const onEk = cString(b, 345, 155);
          const isim = cString(b, 0, 100);
          adlar.push(onEk ? `${onEk}/${isim}` : isim);
        }
      }
      ofs += BLOK + Math.ceil(boyut / BLOK) * BLOK;
    }
    return { ok: false, adet, bayt, hata: 'bitis blogu yok (yarim dosya)' };
  } finally {
    await fh.close();
  }
}

/** Dosyanın sha256'sı (akışla, belleğe almadan). */
function dosyaSha256(dosya) {
  return new Promise((coz, reddet) => {
    const hash = crypto.createHash('sha256');
    fs.createReadStream(dosya)
      .on('data', (p) => hash.update(p))
      .on('error', reddet)
      .on('end', () => coz(hash.digest('hex')));
  });
}

module.exports = { tarYaz, tarDogrula, dosyaSha256, adBol, baslikUret, BLOK };
