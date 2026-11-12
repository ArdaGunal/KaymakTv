// ==========================================================================
// GERİ YÜKLEME SINAMASI (029 §4 · 2026-11-12)
// ==========================================================================
// TEK İŞİ: "yedek var" ile "yedekten geri dönülebilir" arasındaki farkı ölçmek.
//
//   arşiv:     en yeni `katalog-*.db` → `gecici/` altına kopya → iş parçacığında salt-okur aç →
//              integrity_check, sayılar, çoklu-aktif kimlik 0, canlı arşivle karşılaştırma.
//              Geçici kopya HER DURUMDA silinir; canlı arşive ve yedeğin kendisine yazılmaz.
//   lazyfetch: en yeni tar'ın sha256'sı `.json` ile aynı mı, tar başlıkları sağlam mı, dosya sayısı
//              ve bayt `.json`'dakiyle aynı mı.
//
// Rapor `sinama/sinama-<damga>.json`'a yazılır (sağlık ucu en yenisini okur). Aylık: o ay rapor yoksa,
// ya da son rapor başarısızsa (o gün değilse) — bozuk yedek düzelene kadar her sabah yeniden sınanır.

const fs = require('fs');
const path = require('path');
const { tarDogrula, dosyaSha256 } = require('./tar');
const { kopyalariListele, budaDizin } = require('./saklama');
const { DESEN, VARSAYILAN } = require('./kurallar');
const { damgaUret } = require('./klasorler');

const ZAMAN_ASIMI_MS = 10 * 60 * 1000;

function isciyleOlc(dosya) {
  return new Promise((coz) => {
    let bitti = false;
    let sure = null;
    const sonuclan = (r) => { if (!bitti) { bitti = true; if (sure) clearTimeout(sure); coz(r); } };
    let isci;
    try {
      const { Worker } = require('node:worker_threads');
      isci = new Worker(path.join(__dirname, 'sinamaIsci.js'), { workerData: { dosya } });
    } catch (error) {
      sonuclan({ ok: false, reason: `isci_acilamadi: ${error.message}` });
      return;
    }
    sure = setTimeout(() => { isci.terminate().catch(() => {}); sonuclan({ ok: false, reason: 'zaman_asimi' }); }, ZAMAN_ASIMI_MS);
    if (typeof sure.unref === 'function') sure.unref();
    isci.once('message', sonuclan);
    isci.once('error', (e) => sonuclan({ ok: false, reason: e.message }));
    isci.once('exit', (kod) => sonuclan({ ok: false, reason: `isci_cikti_${kod}` }));
  });
}

/**
 * Bir arşiv yedeğini sınar. Throw ETMEZ.
 * @param {{dosya: string, geciciDizin: string, canli?: {entities, externalIds, payloads}|null}} p
 */
async function arsivYedekSina({ dosya, geciciDizin, canli = null }) {
  const sonuc = { dosya: path.basename(dosya), ok: false };
  let klasor = null;
  try {
    fs.mkdirSync(geciciDizin, { recursive: true });
    klasor = fs.mkdtempSync(path.join(geciciDizin, 'sinama-'));
    const kopya = path.join(klasor, 'kopya.db');
    await fs.promises.copyFile(dosya, kopya);
    const olcum = await isciyleOlc(kopya);
    if (!olcum.ok) return { ...sonuc, hata: olcum.reason };
    Object.assign(sonuc, { butunluk: olcum.butunluk, sayilar: olcum.sayilar, cokluAktif: olcum.cokluAktif });
    const hatalar = [];
    if (olcum.butunluk !== 'ok') hatalar.push(`integrity_check: ${olcum.butunluk}`);
    if (!(olcum.sayilar.entities > 0)) hatalar.push('entities bos');
    const coklu = Object.entries(olcum.cokluAktif).filter(([, n]) => n > 0);
    if (coklu.length) hatalar.push(`coklu-aktif: ${coklu.map(([k, n]) => `${k}=${n}`).join(', ')}`);
    // Canlı ile karşılaştırma: arşiv hiçbir şeyi silmez, yedek ≤ canlı olmalı. Yedekte FAZLA olan,
    // yedekten bu yana canlıdan bir şey kaybolmuş demek (2026-09-14 olayı) — sayaç.js'in alarmının ikizi.
    if (canli) {
      sonuc.canli = canli;
      const fazla = ['entities', 'externalIds', 'payloads'].filter((k) => Number.isFinite(canli[k]) && olcum.sayilar[k] > canli[k]);
      if (fazla.length) hatalar.push(`yedekte canlidan fazla: ${fazla.join(', ')}`);
    }
    sonuc.hatalar = hatalar;
    sonuc.ok = hatalar.length === 0;
    return sonuc;
  } catch (error) {
    return { ...sonuc, hata: error.code || error.message };
  } finally {
    if (klasor) { try { fs.rmSync(klasor, { recursive: true, force: true }); } catch (_) { /* bir sonraki tur */ } }
  }
}

/** Bir LazyFetch tar'ını `.json` ve `.sha256` yan dosyalarına karşı doğrular. Throw ETMEZ. */
async function lazyfetchYedekSina({ tarDosya }) {
  const ad = path.basename(tarDosya);
  const kok = tarDosya.replace(/\.tar$/, '');
  try {
    const ozet = JSON.parse(fs.readFileSync(`${kok}.json`, 'utf8'));
    const satir = fs.readFileSync(`${kok}.sha256`, 'utf8').trim().split(/\s+/)[0];
    const sha = await dosyaSha256(tarDosya);
    const tar = await tarDogrula(tarDosya);
    const hatalar = [];
    if (sha !== ozet.sha256 || sha !== satir) hatalar.push('sha256 uyusmuyor');
    if (!tar.ok) hatalar.push(`tar: ${tar.hata}`);
    if (tar.adet !== ozet.adet) hatalar.push(`dosya sayisi ${tar.adet} != ${ozet.adet}`);
    if (tar.bayt !== ozet.bayt) hatalar.push(`bayt ${tar.bayt} != ${ozet.bayt}`);
    return { dosya: ad, ok: hatalar.length === 0, adet: tar.adet, bayt: tar.bayt, hatalar };
  } catch (error) {
    return { dosya: ad, ok: false, hata: error.code || error.message };
  }
}

/** Sınama zamanı mı? Bu ay rapor yoksa evet; son rapor başarısızsa ve bugün yazılmadıysa evet. */
function sinamaZamaniMi(sinamaDizin, simdi = new Date()) {
  const son = sonRapor(sinamaDizin);
  if (!son) return true;
  const t = new Date(son.at);
  if (Number.isNaN(t.getTime())) return true;
  if (t.getFullYear() !== simdi.getFullYear() || t.getMonth() !== simdi.getMonth()) return true;
  return son.ok !== true && t.toDateString() !== simdi.toDateString();
}

/** En yeni sınama raporu (`{at, ok, …}`) ya da null. */
function sonRapor(sinamaDizin) {
  const [enYeni] = kopyalariListele(sinamaDizin, DESEN.sinama);
  if (!enYeni) return null;
  try {
    return JSON.parse(fs.readFileSync(path.join(sinamaDizin, enYeni.ad), 'utf8'));
  } catch (_) {
    return { at: enYeni.t.toISOString(), ok: false, hata: 'rapor okunamadi' };
  }
}

/**
 * Tam sınama turu: en yeni arşiv yedeği + en yeni LazyFetch tar'ı. Raporu yazar (`kaydet`).
 * @param {{klasor: object, canli?: object|null, simdi?: Date, kaydet?: boolean, arsivDosyasi?: string}} p
 */
async function sinamaTuru({ klasor, canli = null, simdi = new Date(), kaydet = true, arsivDosyasi = null }) {
  const rapor = { at: simdi.toISOString(), ok: false, arsiv: null, lazyfetch: null };
  const [arsivEnYeni] = kopyalariListele(klasor.arsiv, DESEN.arsiv);
  const hedefArsiv = arsivDosyasi || (arsivEnYeni ? path.join(klasor.arsiv, arsivEnYeni.ad) : null);
  rapor.arsiv = hedefArsiv
    ? await arsivYedekSina({ dosya: hedefArsiv, geciciDizin: klasor.gecici, canli })
    : { ok: false, hata: 'arsiv yedegi yok' };
  const [lfEnYeni] = kopyalariListele(klasor.lazyfetch, DESEN.lazyfetch);
  // LazyFetch tar'ı henüz hiç alınmadıysa (ilk hafta) sınama bunun yüzünden düşmez.
  rapor.lazyfetch = lfEnYeni ? await lazyfetchYedekSina({ tarDosya: path.join(klasor.lazyfetch, lfEnYeni.ad) }) : null;
  rapor.ok = rapor.arsiv.ok === true && (rapor.lazyfetch === null || rapor.lazyfetch.ok === true);
  if (kaydet) {
    fs.mkdirSync(klasor.sinama, { recursive: true });
    fs.writeFileSync(path.join(klasor.sinama, `sinama-${damgaUret(simdi)}.json`), JSON.stringify(rapor, null, 2) + '\n', { mode: 0o640 });
    budaDizin(klasor.sinama, { desen: DESEN.sinama, kural: VARSAYILAN.sinama, simdi });
  }
  return rapor;
}

/** Raporun tek satırlık özeti (günlük + sync_log). */
function raporOzeti(r) {
  const a = r.arsiv || {};
  const lf = r.lazyfetch;
  const arsivMetni = a.ok
    ? `arsiv ${a.dosya} ok (varlik ${a.sayilar.entities}, kimlik ${a.sayilar.externalIds}, yuk ${a.sayilar.payloads})`
    : `arsiv ${a.dosya || '-'} BASARISIZ: ${a.hata || (a.hatalar || []).join('; ')}`;
  const lfMetni = lf === null ? 'lazyfetch yedegi henuz yok'
    : lf.ok ? `lazyfetch ${lf.dosya} ok (${lf.adet} dosya)`
      : `lazyfetch ${lf.dosya} BASARISIZ: ${lf.hata || (lf.hatalar || []).join('; ')}`;
  return `sinama ${r.ok ? 'ok' : 'BASARISIZ'} · ${arsivMetni} · ${lfMetni}`;
}

module.exports = { arsivYedekSina, lazyfetchYedekSina, sinamaZamaniMi, sonRapor, sinamaTuru, raporOzeti };
