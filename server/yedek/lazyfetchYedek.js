// ==========================================================================
// LAZYFETCH YEDEĞİ — haftalık tek tar (029 §2 · 2026-11-12)
// ==========================================================================
// TEK İŞİ: LazyFetch önbelleğini (`cache/` + `quarantine/`) haftada bir, yedek diskine tek bir
// `lazyfetch-<damga>.tar` olarak yazmak ve eski tar'ları saklama kuralıyla budamak.
//
// ⚠️ ESKİ KURAL DEĞİŞTİ: `03_FAZLAR.md` "`archive/` yedeklenir, `cache/` yedeklenmez" diyordu
// (önbellek yeniden üretilebilir). Kullanıcı 2026-11-12'de "lazyfetch … yedekleri tutmak önemli"
// dedi: önbelleğin kaybı veri kaybı değil ama bir haftalık "ilk istek yavaş" + TMDB/Trakt'a yığılma
// demek. Haftalık yeterli: kaybı en çok bir haftalık yeni içerik.
//
// Sıra: önce `<ad>.tar.yeni` yazılır, diske işlenir (fsync), sonra yeniden adlandırılır — yarım
// dosya hiçbir zaman yedek sayılmaz. Yanına `.sha256` (`sha256sum -c` biçimi) ve `.json` (sayılar).
// 🔴 Arşiv yedeğinin aynı-aygıt kuralı burada da geçerli: kaynakla aynı diske yazılmaz
// (`ARCHIVE_BACKUP_AYNI_AYGIT=1` istisnası dahil, aynı anlamda).

const fs = require('fs');
const path = require('path');
const { tarYaz } = require('./tar');
const { budaDizin, kopyalariListele, GUN_MS } = require('./saklama');
const { DESEN, VARSAYILAN, lazyfetchEslikci } = require('./kurallar');
const { ayniAygitMi, ayniAygitIzinli, damgaUret } = require('./klasorler');

const KAYNAKLAR = ['cache', 'quarantine'];
const YARIM_UZANTI = '.yeni';

/** Kaynak klasörlerdeki tüm düz dosyalar, `/` ayraçlı göreli yol, sıralı (aynı girdi → aynı tar). */
async function dosyalariTopla(kok, kaynaklar = KAYNAKLAR) {
  const sonuc = [];
  const gez = async (gorecel) => {
    let girdiler;
    try {
      girdiler = await fs.promises.readdir(path.join(kok, gorecel), { withFileTypes: true });
    } catch (error) {
      if (error && error.code === 'ENOENT') return; // süpürücü klasörü sildiyse
      throw error;
    }
    girdiler.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const g of girdiler) {
      const alt = `${gorecel}/${g.name}`;
      if (g.isDirectory()) await gez(alt);
      else if (g.isFile()) sonuc.push(alt);
    }
  };
  for (const k of kaynaklar) await gez(k);
  return sonuc;
}

/**
 * Bu tikte LazyFetch yedeği alınmalı mı? DİSKTEN karar verilir (yeniden başlatma sayımı sıfırlamaz).
 * Hiç yoksa → evet. Pazar (yerel) ve bugün alınmamışsa → evet. En yenisi 8 günü geçtiyse → evet
 * (pazar kaçtıysa telafi).
 */
function lazyfetchZamaniMi(dizin, simdi = new Date()) {
  const kopyalar = kopyalariListele(dizin, DESEN.lazyfetch);
  if (!kopyalar.length) return true;
  const enYeni = kopyalar[0].t;
  if (simdi - enYeni >= 8 * GUN_MS) return true;
  return simdi.getDay() === 0 && enYeni.toDateString() !== simdi.toDateString();
}

/** Bir günden eski, yarım kalmış `.tar.yeni` dosyalarını siler (yalnız kendi desenimiz). */
function yarimlariTemizle(dizin, simdi = new Date()) {
  let silinen = 0;
  let adlar;
  try { adlar = fs.readdirSync(dizin); } catch { return 0; }
  for (const ad of adlar) {
    if (!ad.endsWith(YARIM_UZANTI)) continue;
    if (!DESEN.lazyfetch.test(ad.slice(0, -YARIM_UZANTI.length))) continue;
    try {
      const st = fs.lstatSync(path.join(dizin, ad));
      if (st.isFile() && simdi - st.mtimeMs > GUN_MS) { fs.unlinkSync(path.join(dizin, ad)); silinen++; }
    } catch (_) { /* önemli değil */ }
  }
  return silinen;
}

/**
 * Bir LazyFetch yedek turu. Throw ETMEZ.
 * @param {{kaynakKok: string|null, hedefDizin: string, simdi?: Date, ortam?: object}} p
 * @returns {Promise<object>} `{ok:true, dosya, adet, bayt, boyut, atlanan, sureMs, silinen}` | `{ok:false, reason}`
 */
async function lazyfetchYedekAl({ kaynakKok, hedefDizin, simdi = new Date(), ortam = process.env }) {
  if (!kaynakKok) return { ok: false, reason: 'lazyfetch_kapali' };
  if (!hedefDizin) return { ok: false, reason: 'hedef_yok' };
  const basladi = Date.now();
  try {
    fs.mkdirSync(hedefDizin, { recursive: true });
  } catch (error) {
    return { ok: false, reason: `hedef acilamadi: ${error.code || error.message}` };
  }
  if (ayniAygitMi(kaynakKok, hedefDizin) && !ayniAygitIzinli(ortam)) {
    return { ok: false, reason: 'ayni_aygit' };
  }

  const ad = `lazyfetch-${damgaUret(simdi)}.tar`;
  const son = path.join(hedefDizin, ad);
  const yarim = son + YARIM_UZANTI;
  try {
    const yollar = await dosyalariTopla(kaynakKok);
    const r = await tarYaz(yarim, kaynakKok, yollar);
    fs.renameSync(yarim, son);
    const ozet = {
      dosya: ad,
      olusturuldu: simdi.toISOString(),
      kaynak: KAYNAKLAR,
      adet: r.adet,
      bayt: r.bayt,
      boyut: r.boyut,
      atlanan: r.atlanan + r.atlananAd,
      sha256: r.sha256,
    };
    const kokAd = ad.replace(/\.tar$/, '');
    fs.writeFileSync(path.join(hedefDizin, `${kokAd}.sha256`), `${r.sha256}  ${ad}\n`, { mode: 0o640 });
    fs.writeFileSync(path.join(hedefDizin, `${kokAd}.json`), JSON.stringify(ozet, null, 2) + '\n', { mode: 0o640 });

    const buda = budaDizin(hedefDizin, { desen: DESEN.lazyfetch, kural: VARSAYILAN.lazyfetch, simdi, eslikci: lazyfetchEslikci });
    const yarimSilinen = yarimlariTemizle(hedefDizin, simdi);
    return {
      ok: true,
      dosya: ad,
      adet: r.adet,
      bayt: r.bayt,
      boyut: r.boyut,
      atlanan: ozet.atlanan,
      sureMs: Date.now() - basladi,
      silinen: buda.silinen.length + yarimSilinen,
    };
  } catch (error) {
    try { fs.unlinkSync(yarim); } catch (_) { /* yoksa sorun değil */ }
    return { ok: false, reason: error.code || error.message };
  }
}

module.exports = { lazyfetchYedekAl, lazyfetchZamaniMi, dosyalariTopla, yarimlariTemizle, KAYNAKLAR };
