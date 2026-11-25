const { createHash, randomUUID } = require('node:crypto');
const { mkdir, readFile, rename, unlink, writeFile } = require('node:fs/promises');
const { join, isAbsolute } = require('node:path');
const { OG_KARE_BOYUTU, OG_KARE_DOSYASI, OG_KARE_ONEKI } = require('../../utils/paylasimGorseli.mjs');

const MAKS_GIRIS = 1024 * 1024;
const MAKS_ETKIN = 4;
const HATA_BEKLEME_MS = 60_000;
const AFIS_YOLU = /^\/[a-zA-Z0-9_-]{1,100}\.jpg$/;
const ESKI_KARE_DOSYASI = /^[a-f0-9]{64}\.jpg$/;

function afisYoluGecerli(deger) {
  return typeof deger === 'string' && AFIS_YOLU.test(deger);
}

function jpegBoyutuUygun(girdi) {
  if (girdi.length < 4 || girdi.readUInt16BE(0) !== 0xffd8) return false;
  // SOF boyutlarını tam çözmeden önce kontrol et. TMDB w342 bir JPEG döndürür.
  for (let i = 2; i + 4 < girdi.length;) {
    if (girdi[i++] !== 0xff) return false;
    while (girdi[i] === 0xff) i++;
    const isaret = girdi[i++];
    if (i + 2 > girdi.length || isaret === 0xda || isaret === 0xd9) return false;
    const uzunluk = girdi.readUInt16BE(i);
    if (uzunluk < 2 || i + uzunluk > girdi.length) return false;
    if ([0xc0, 0xc1, 0xc2].includes(isaret) && uzunluk >= 8) {
      const yukseklik = girdi.readUInt16BE(i + 3);
      const genislik = girdi.readUInt16BE(i + 5);
      return genislik > 0 && genislik <= 1024 && yukseklik > 0 && yukseklik <= 2048;
    }
    i += uzunluk;
  }
  return false;
}

async function afisiIndir(afisYolu, getir, zamanAsimiMs) {
  const yanit = await getir(`https://image.tmdb.org/t/p/w342${afisYolu}`, {
    redirect: 'error',
    signal: AbortSignal.timeout(zamanAsimiMs),
  });
  const mime = yanit.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (!yanit.ok || mime !== 'image/jpeg' || !yanit.body || Number(yanit.headers.get('content-length')) > MAKS_GIRIS) {
    await yanit.body?.cancel();
    return null;
  }

  let toplam = 0;
  const parcalar = [];
  for await (const parca of yanit.body) {
    toplam += parca.byteLength;
    if (toplam > MAKS_GIRIS) return null;
    parcalar.push(parca);
  }
  const girdi = Buffer.concat(parcalar, toplam);
  return jpegBoyutuUygun(girdi) ? girdi : null;
}

async function kompaktJpeg(girdi) {
  const Jimp = require('jimp-compact');
  const gorsel = await Jimp.read(girdi);
  return gorsel
    .cover(OG_KARE_BOYUTU, OG_KARE_BOYUTU, Jimp.HORIZONTAL_ALIGN_CENTER | Jimp.VERTICAL_ALIGN_TOP)
    .quality(82).getBufferAsync(Jimp.MIME_JPEG);
}

function afisOnbellegi({ dizin, getir = globalThis.fetch, zamanAsimiMs = 2500 }) {
  if (!dizin || !isAbsolute(dizin)) throw new TypeError('OG afiş önbelleği için mutlak dizin gerekli.');
  const surenler = new Map();
  const hatalar = new Map();

  async function oku(dosya) {
    if (typeof dosya !== 'string' || (!OG_KARE_DOSYASI.test(dosya) && !ESKI_KARE_DOSYASI.test(dosya))) return null;
    try {
      return await readFile(join(dizin, dosya));
    } catch (hata) {
      if (hata.code === 'ENOENT') return null;
      throw hata;
    }
  }

  async function uret(afisYolu, dosya) {
    if (await oku(dosya)) return dosya;
    const girdi = await afisiIndir(afisYolu, getir, zamanAsimiMs);
    if (!girdi) return null;
    const cikti = await kompaktJpeg(girdi);
    await mkdir(dizin, { recursive: true });
    const gecici = join(dizin, `.${dosya}.${randomUUID()}.tmp`);
    try {
      await writeFile(gecici, cikti, { flag: 'wx' });
      await rename(gecici, join(dizin, dosya));
    } finally {
      await unlink(gecici).catch(() => {});
    }
    return dosya;
  }

  async function hazirla(afisYolu) {
    if (!afisYoluGecerli(afisYolu)) return null;
    const ozet = createHash('sha256').update(`w342-cover-ust-orta-v1:${afisYolu}`).digest('hex');
    const dosya = `${OG_KARE_ONEKI}${ozet}.jpg`;
    try {
      if (await oku(dosya)) return dosya;
    } catch {
      return null;
    }

    const suren = surenler.get(dosya);
    if (suren) return suren;
    if ((hatalar.get(dosya) ?? 0) > Date.now() || surenler.size >= MAKS_ETKIN) return null;

    const is = uret(afisYolu, dosya).catch(() => null).then((sonuc) => {
      if (!sonuc) {
        hatalar.delete(dosya);
        hatalar.set(dosya, Date.now() + HATA_BEKLEME_MS);
        if (hatalar.size > 256) hatalar.delete(hatalar.keys().next().value);
      } else {
        hatalar.delete(dosya);
      }
      surenler.delete(dosya);
      return sonuc;
    });
    surenler.set(dosya, is);
    return is;
  }

  return { hazirla, oku };
}

module.exports = { afisOnbellegi, afisYoluGecerli, kompaktJpeg };
