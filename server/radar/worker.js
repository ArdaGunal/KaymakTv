const { saglayiciSecenekleri } = require('../lazyfetch/zamanSiniri');
const { idMi, RadarHatasi, OLAY_PARTISI, OLAY_GOVDE_TAVANI, TAKIP_SAYFASI, IS_PARTISI, hataKodu, tekrarMs } = require('./ayar');

const AYNA_UYE_TAVANI = 2000;
const AYNA_SOZLESME_RET_TAVANI = 8;

function workerIstemcisi({ workerUrl, sir, fetch = globalThis.fetch }) {
  async function iste(yol, secenekler) {
    const yanit = await fetch(`${workerUrl}/ic/radar/${yol}`, {
      ...secenekler,
      redirect: 'error',
      headers: { 'x-kaymak-sync-secret': sir, 'Content-Type': 'application/json' },
      signal: saglayiciSecenekleri().signal,
    });
    if (!yanit.ok) {
      const error = new Error('worker_http');
      error.response = { status: yanit.status, headers: { 'retry-after': yanit.headers.get('retry-after') } };
      throw error;
    }
    return yanit.json();
  }

  return {
    takip: (sonraki) => iste(`takip?${new URLSearchParams({ sonraki, sayfa: TAKIP_SAYFASI })}`),
    olay: (olaylar) => iste('olay', { method: 'POST', body: JSON.stringify({ olaylar }) }),
    ayna: (satirlar) => iste('ayna', { method: 'POST', body: JSON.stringify({ satirlar }) }),
  };
}

async function takipGoruntusu(worker, dur) {
  const satirlar = [];
  const imlecler = new Set();
  let imlec = '';
  do {
    dur();
    const yanit = await worker.takip(imlec);
    if (!Array.isArray(yanit?.satirlar) || yanit.satirlar.length > TAKIP_SAYFASI ||
        !(yanit.sonraki === null || (typeof yanit.sonraki === 'string' && yanit.sonraki.length &&
          !imlecler.has(yanit.sonraki)))) {
      throw new RadarHatasi('takip_yaniti');
    }
    for (const { tur, trakt_id, tmdb_id, takipci } of yanit.satirlar) {
      if (!['show', 'movie'].includes(tur) || !idMi(trakt_id) ||
          !(tmdb_id === null || idMi(tmdb_id)) || !idMi(takipci)) {
        throw new RadarHatasi('takip_satiri');
      }
      satirlar.push({ tur, trakt_id, tmdb_id, takipci });
    }
    imlec = yanit.sonraki;
    imlecler.add(imlec);
  } while (imlec !== null);
  return satirlar;
}

async function olayGonder(depo, worker, dur = () => {}) {
  let parti = [];
  const cerceveBoyu = Buffer.byteLength('{"olaylar":[]}');
  let boyut = cerceveBoyu;
  async function gonder(grup) {
    if (!grup.length) return;
    dur();
    let sonuc;
    try {
      sonuc = await worker.olay(grup.map(({ veri }) => veri));
    } catch (error) {
      if (!['http_400', 'http_413', 'http_422'].includes(hataKodu(error))) throw error;
      if (grup.length === 1) return depo.olayTerk(grup[0].id);
      const orta = Math.floor(grup.length / 2);
      await gonder(grup.slice(0, orta));
      await gonder(grup.slice(orta));
      return;
    }
    if (!Number.isSafeInteger(sonuc?.yazilan) || sonuc.yazilan < 0 ||
        !Number.isSafeInteger(sonuc.yinelenen) || sonuc.yinelenen < 0 ||
        sonuc.yazilan + sonuc.yinelenen !== grup.length) throw new RadarHatasi('olay_yaniti');
    await depo.olayOnayla(grup);
  }

  for (const r of depo.bekleyenOlaylar(OLAY_PARTISI)) {
    const boy = Buffer.byteLength(r.olay);
    if (cerceveBoyu + boy > OLAY_GOVDE_TAVANI) {
      await depo.olayTerk(r.id);
      continue;
    }
    if (boyut + boy + Number(parti.length > 0) > OLAY_GOVDE_TAVANI) {
      await gonder(parti);
      parti = [];
      boyut = cerceveBoyu;
    }
    let veri;
    try { veri = JSON.parse(r.olay); } catch (_) {
      await depo.olayTerk(r.id);
      continue;
    }
    boyut += boy + Number(parti.length > 0);
    parti.push({ ...r, veri });
  }
  await gonder(parti);
}

async function aynaBildirimleriniGonder(depo, worker, dur, saat = Date.now) {
  let ret;
  let onaylanan = 0;
  let sozlesmeRetleri = 0;
  const tekilRetler = [];
  async function terk(r, kod) {
    await depo.aynaBildirimiTerk(r);
    ret ??= kod;
  }

  async function partiyiGonder(parti) {
    if (!parti.length) return;
    async function gonder(grup) {
      dur();
      const satirlar = grup.map(({ tur, trakt_id, takvim_rev, satirlar }) => ({ tur, trakt_id, takvim_rev, satirlar }));
      try {
        if (Buffer.byteLength(JSON.stringify({ satirlar })) > 1024 * 1024) throw new RadarHatasi('http_413');
        const sonuc = await worker.ayna(satirlar);
        if (!Number.isSafeInteger(sonuc?.yazilan) || sonuc.yazilan < 0 ||
            !Number.isSafeInteger(sonuc.yinelenen) || sonuc.yinelenen < 0 ||
            sonuc.yazilan + sonuc.yinelenen !== grup.length) throw new RadarHatasi('ayna_yaniti');
      } catch (error) {
        const kod = hataKodu(error);
        const sozlesmeReddi = kod === 'http_400' || kod === 'http_422';
        if (!sozlesmeReddi && kod !== 'http_413') {
          const simdi = saat();
          await depo.aynaBildirimiErtele(grup, simdi, tekrarMs(error, simdi), kod === 'http_409');
          throw error;
        }
        if (sozlesmeReddi && ++sozlesmeRetleri >= AYNA_SOZLESME_RET_TAVANI) throw new RadarHatasi('ayna_sozlesme');
        if (grup.length === 1) {
          if (sozlesmeReddi) tekilRetler.push([grup[0], kod]);
          else await terk(grup[0], kod);
          return;
        }
        // Worker bir kökün tam görüntüsünü bekler. Yalnız kökler arasında bölünür.
        const orta = Math.floor(grup.length / 2);
        await gonder(grup.slice(0, orta));
        await gonder(grup.slice(orta));
        return;
      }
      await depo.aynaBildirimiOnayla(grup);
      onaylanan += grup.length;
    }
    await gonder(parti);
  }

  let parti = [];
  let uyeSayisi = 0;
  const bekleyen = depo.bekleyenAynaBildirimleri(IS_PARTISI, saat());
  for (const r of bekleyen) {
    dur();
    let satirlar;
    try {
      satirlar = JSON.parse(r.veri).satirlar.map(({ sezon, bolum, tarih, an_turu, durum }) =>
        ({ sezon, bolum, tarih, an_turu, durum }));
    } catch {
      await terk(r, 'ayna_verisi');
      continue;
    }
    const yeniden = r.deneme > 0 || r.cakisma_deneme > 0;
    if (yeniden || uyeSayisi + satirlar.length > AYNA_UYE_TAVANI) {
      await partiyiGonder(parti);
      parti = [];
      uyeSayisi = 0;
    }
    if (yeniden) await partiyiGonder([{ ...r, satirlar }]);
    else {
      parti.push({ ...r, satirlar });
      uyeSayisi += satirlar.length;
    }
  }
  await partiyiGonder(parti);
  // Toplu reddin tekil denemeleri, bir kabul görülmeden kalıcı terke dönüşmez.
  if (tekilRetler.length && bekleyen.length > 1 && !onaylanan) throw new RadarHatasi('ayna_sozlesme');
  for (const [r, kod] of tekilRetler) await terk(r, kod);
  if (ret) throw new RadarHatasi(ret);
  return onaylanan;
}

module.exports = { workerIstemcisi, takipGoruntusu, olayGonder, aynaBildirimleriniGonder };
