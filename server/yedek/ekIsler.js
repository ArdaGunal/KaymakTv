// ==========================================================================
// YEDEK TURUNUN EK İŞLERİ — arşiv yedeğinden sonra (029 · 2026-11-12)
// ==========================================================================
// TEK İŞİ: sabah yedek penceresinde (05–07), arşiv yedeği alındıktan sonra sırayla:
//   1. BENIOKU.txt (klasör düzeni açıklaması) güncel mi
//   2. elle/ budaması (120 gün, en yeni 2)
//   3. LazyFetch tar'ı — haftalık (pazar ya da 8 günü geçtiyse)
//   4. geri yükleme sınaması — aylık (ya da son sınama başarısızsa her sabah)
// Her biri kendi try/catch'inde: biri düşerse diğerleri yine koşar. Hiçbir koşulda throw ETMEZ.
// Zamanlamayı `backup.js` yapar (tek zamanlayıcı, aynı pencere); "bugün/bu hafta/bu ay yapıldı mı"
// kararı DİSKTEN okunur, yeniden başlatma iş tekrarlatmaz.

const fs = require('fs');
const { yedekKlasorleri, beniokuYaz } = require('./klasorler');
const { budaDizin } = require('./saklama');
const { DESEN, VARSAYILAN } = require('./kurallar');
const { lazyfetchYedekAl, lazyfetchZamaniMi } = require('./lazyfetchYedek');
const { sinamaTuru, sinamaZamaniMi, raporOzeti } = require('./sinama');

function varsayilanBagimlar() {
  const { getLazyFetchStatus } = require('../lazyfetch/paths');
  const { getDb } = require('../archive/db');
  const { logSync } = require('../archive/store');
  const { reportLazyFetch } = require('../lazyfetch/telemetry');
  return {
    lazyfetchKoku: () => { const s = getLazyFetchStatus(); return s.enabled ? s.root : null; },
    canliSayilar: () => {
      const db = getDb();
      if (!db) return null;
      const say = (t) => db.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n;
      return { entities: say('entities'), externalIds: say('external_ids'), payloads: say('payloads') };
    },
    logSync,
    bildir: (metin, etiket) => reportLazyFetch({ reason: 'yedek', text: metin, tags: etiket }),
  };
}

/**
 * @param {{simdi?: Date, klasor?: object, bagimlar?: object}} [p]  testler `bagimlar` verir
 * @returns {Promise<{benioku, elle, lazyfetch, sinama}>}
 */
async function yedekEkIsleri({ simdi = new Date(), klasor = yedekKlasorleri(), bagimlar = null } = {}) {
  const b = bagimlar || varsayilanBagimlar();
  const sonuc = { benioku: false, elle: null, lazyfetch: null, sinama: null };
  if (!klasor) return sonuc;
  const kaydet = (event, detail) => { try { b.logSync({ event, detail }); } catch (_) { /* günlük yine yazıldı */ } };

  try { sonuc.benioku = beniokuYaz(klasor); } catch (_) { /* önemli değil */ }

  try {
    if (fs.existsSync(klasor.elle)) {
      sonuc.elle = budaDizin(klasor.elle, { desen: DESEN.elle, kural: VARSAYILAN.elle, simdi });
      if (sonuc.elle.silinen.length) {
        console.log(`[Yedek] elle/: ${sonuc.elle.silinen.length} eski kopya silindi (${sonuc.elle.tutulan} kaldi)`);
        kaydet('vacuum', `yedek elle: ${sonuc.elle.silinen.length} eski kopya silindi`);
      }
    }
  } catch (error) {
    console.error(`[Yedek] elle/ budamasi: ${error.message}`);
  }

  try {
    if (lazyfetchZamaniMi(klasor.lazyfetch, simdi)) {
      const r = await lazyfetchYedekAl({ kaynakKok: b.lazyfetchKoku(), hedefDizin: klasor.lazyfetch, simdi });
      sonuc.lazyfetch = r;
      if (r.ok) {
        const metin = `yedek lazyfetch ${(r.boyut / 1048576).toFixed(1)} MB, ${r.adet} dosya -> ${r.dosya} (${r.sureMs} ms`
          + `${r.atlanan ? `, ${r.atlanan} atlandi` : ''}${r.silinen ? `, ${r.silinen} eski silindi` : ''})`;
        console.log(`[Yedek] ${metin}`);
        kaydet('vacuum', metin);
      } else {
        console.error(`[Yedek] lazyfetch BASARISIZ: ${r.reason}`);
        kaydet('error', `yedek lazyfetch: ${r.reason}`);
        await b.bildir(`🔴 LazyFetch yedeği alınamadı: ${r.reason}`, { lazyfetchYedek: 0 });
      }
    }
  } catch (error) {
    console.error(`[Yedek] lazyfetch: ${error.message}`);
  }

  try {
    if (sinamaZamaniMi(klasor.sinama, simdi)) {
      let canli = null;
      try { canli = b.canliSayilar(); } catch (_) { canli = null; }
      const rapor = await sinamaTuru({ klasor, canli, simdi });
      sonuc.sinama = rapor;
      const ozet = raporOzeti(rapor);
      if (rapor.ok) {
        console.log(`[Yedek] ${ozet}`);
        kaydet('vacuum', ozet);
      } else {
        console.error(`[Yedek] 🔴 ${ozet}`);
        kaydet('error', ozet);
        await b.bildir(`🔴 Yedek geri yükleme sınaması düştü\n${ozet}`, { sinama: 0 });
      }
    }
  } catch (error) {
    console.error(`[Yedek] sinama: ${error.message}`);
  }

  return sonuc;
}

module.exports = { yedekEkIsleri };
