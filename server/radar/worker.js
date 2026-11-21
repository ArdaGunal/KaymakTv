const { saglayiciSecenekleri } = require('../lazyfetch/zamanSiniri');
const { idMi, RadarHatasi, OLAY_PARTISI, OLAY_GOVDE_TAVANI, TAKIP_SAYFASI, hataKodu } = require('./ayar');

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
      sonuc = await worker.olay(grup.map(({ olay }) => JSON.parse(olay)));
    } catch (error) {
      if (hataKodu(error) !== 'http_413') throw error;
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
    boyut += boy + Number(parti.length > 0);
    parti.push(r);
  }
  await gonder(parti);
}

module.exports = { workerIstemcisi, takipGoruntusu, olayGonder };
