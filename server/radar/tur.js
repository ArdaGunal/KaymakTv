const { AKISLAR, TAKIP_ARALIGI, DAKIKA, SAAT, IS_PARTISI, YENI_IS_PARTISI, RadarHatasi, hataKodu, tekrarMs, iso } = require('./ayar');
const { akisiTara, telafiyiIlerlet, radarCek } = require('./akis');
const { takipGoruntusu, olayGonder } = require('./worker');
const { kataloguCek } = require('./tazele');
const { radarYaz } = require('../archive/queue');
const { aynalariGonder } = require('./ayna');

function radarTuruKur({
  kapilar, depo, worker, saglayicilar, saat = Date.now, gunluk = console,
  yaz = radarYaz, aynala = aynalariGonder,
}) {
  let takipAt = null;
  let takipSonra = 0;
  let olaySonra = 0;
  let budamaSonra = 0;
  const gecmisSezonlar = new Map();
  const sonrakiAkis = new Map();
  const saglayiciSonra = new Map();

  async function cekici(saglayici, fetcher, yol, sorgu, dur) {
    if ((saglayiciSonra.get(saglayici) ?? 0) > saat()) throw new RadarHatasi('saglayici_bekleme');
    try {
      return await radarCek(saglayici, fetcher, yol, sorgu, dur);
    } catch (error) {
      if (hataKodu(error) === 'http_429') {
        const simdi = saat();
        saglayiciSonra.set(saglayici, simdi + Math.max(DAKIKA, tekrarMs(error, simdi)));
      }
      throw error;
    }
  }

  let aynaHazir = false;
  async function tur(geceBekliyor = () => false) {
    let sonHata = null;
    let sonHataGunlukte = false;
    const kodlar = [];
    let kesildi = false;
    const dur = () => { if (geceBekliyor()) throw new RadarHatasi('gece_isi'); };
    const hata = (asama, error, akis = null) => {
      const kod = hataKodu(error);
      if (kod === 'gece_isi') throw error;
      kodlar.push(kod);
      sonHata = `${asama}:${kod}`;
      sonHataGunlukte = !!akis;
      if (akis) gunluk.warn(`[Radar] ${sonHata} yol=${akis.yol}`);
    };

    try {
      let yeni = 0;
      const simdi = saat();
      if ((kapilar.yaz || kapilar.olay) && simdi >= budamaSonra) {
        dur();
        try {
          await depo.gidenKutusuBuda(simdi, kapilar.olay);
          budamaSonra = simdi + TAKIP_ARALIGI;
        } catch (error) { hata('olay_budama', error); }
      }
      if (simdi >= takipSonra && (takipAt === null || simdi - takipAt >= TAKIP_ARALIGI)) {
        try {
          const satirlar = await takipGoruntusu(worker, dur);
          dur();
          yeni = await depo.takipDegistir(satirlar, saat());
          takipAt = simdi;
          gunluk.info(`[Radar] takip=${satirlar.length} tazelenecekler=yeni:${yeni} yazim=${kapilar.yaz ? 1 : 0}`);
        } catch (error) {
          hata('takip', error);
          takipSonra = saat() + Math.max(DAKIKA, tekrarMs(error, saat()));
        }
      }

      // Takip görüntüsü alınmadan boş kümeyle imleç ilerletilmez.
      if (takipAt !== null) {
        if (kapilar.yaz) {
          // İlk görülen içerik önce işlenir. Büyük değişiklik akışının
          // bütün sayfalarını beklemeden ağ ve yazım aşamasına girer.
          await isleriTazele(2, YENI_IS_PARTISI);
        }
        for (const akis of AKISLAR) {
          dur();
          const t0 = simdi;
          if (t0 < (sonrakiAkis.get(akis.ad) ?? ((depo.imlec(akis.ad)?.at ?? -SAAT) + SAAT))) continue;
          if (!saglayicilar[akis.saglayici]) {
            hata(akis.ad, new RadarHatasi('saglayici_yapilandirma'), akis);
            sonrakiAkis.set(akis.ad, t0 + SAAT);
            continue;
          }
          const saglayiciBekle = saglayiciSonra.get(akis.saglayici) ?? 0;
          if (saglayiciBekle > saat()) {
            sonrakiAkis.set(akis.ad, saglayiciBekle);
            gunluk.info(`[Radar] ${akis.ad} saglayici_bekleme yol=${akis.yol} sonraki=${iso(saglayiciBekle)}`);
            continue;
          }
          gunluk.info(`[Radar] ${akis.ad} tarama yol=${akis.yol}`);
          try {
            const cek = (yol, sorgu) => cekici(akis.saglayici, saglayicilar[akis.saglayici], yol, sorgu, dur);
            const r = await akisiTara({ akis, depo, cek, simdi: t0, dur });
            sonrakiAkis.set(akis.ad, Date.parse(r.bitis) + SAAT);
            const trakt = akis.saglayici === 'trakt'
              ? ` limit_istenen=${akis.sayfa} limit_uygulanan=${r.uygulananLimit ?? '?'} x_start_date=${r.saglayiciBaslangici} pencere_disi=${r.pencereDisi}` : '';
            gunluk.info(`[Radar] ${akis.ad} kesisim=${r.eslesen} tazelenecekler=${r.eslesen} sayfa=${r.sayfa} telafi=${r.telafi ? 1 : 0}` +
              ` yol=${akis.yol} baslangic=${r.baslangic} bitis=${r.bitis} sayfa_daraldi=${r.sayfaDaraldi ? 1 : 0} ham_satir=${r.hamSatir}${trakt}`);
          } catch (error) {
            hata(akis.ad, error, akis);
            const simdi = saat();
            sonrakiAkis.set(akis.ad, simdi + Math.max(DAKIKA, tekrarMs(error, simdi)));
          }
        }
        dur();
        await telafiyiIlerlet(depo, AKISLAR, saat());
        if (kapilar.yaz) {
          await isleriTazele(0, IS_PARTISI, 1);
          aynaHazir = true;
        }
      }
      if (kapilar.olay && saat() >= olaySonra) {
        dur();
        try { await olayGonder(depo, worker, dur); } catch (error) {
          hata('olay', error);
          const simdi = saat();
          olaySonra = simdi + Math.max(DAKIKA, tekrarMs(error, simdi));
        }
      }
    } catch (error) {
      kesildi = hataKodu(error) === 'gece_isi';
      if (!kesildi) hata('tur', error);
    } finally {
      await depo.durumYaz('sonTur', iso(saat()));
      if (sonHata && !sonHataGunlukte) {
        if (depo.saglik().sonHata !== sonHata) gunluk.warn(`[Radar] ${sonHata}`);
      }
      for (const kod of kodlar) await depo.hataSay(kod);
      if (!kesildi || sonHata) await depo.durumYaz('sonHata', sonHata);
    }

    async function isleriTazele(asgariOncelik, limit, ustOncelik = 2) {
      for (const is of depo.hazirIsler(saat(), Math.min(limit, IS_PARTISI), ustOncelik)) {
        dur();
        if (is.oncelik < asgariOncelik) break;
        try {
          const beklenenRev = depo.takvim(is)?.takvim_rev ?? 0;
          const veri = await kataloguCek(is, saglayicilar, dur, saat, cekici, gecmisSezonlar);
          dur();
          const r = await yaz({ veri, beklenenRev, simdi: saat(), olayAcik: kapilar.olay, beklemeYok: true });
          if (r?.reason === 'ayna_mesgul') return;
          if (!r?.ok) {
            hata('tazeleme', new RadarHatasi(r?.reason || 'arsiv_yazim_hatasi'));
            await depo.isiErtele(is, saat(), 0, r?.reason !== 'daha_yeni_yanit');
            continue;
          }
          for (const girdi of r.girdiler) await girdi.yayinla?.();
          if (r.tam) await depo.isiTamamla(is);
          else {
            hata('tazeleme', new RadarHatasi(r.cakisma ? 'sezon_kimlik_cakismasi' : 'eksik_yanit'));
            await depo.isiErtele(is, saat(), SAAT, false);
          }
        } catch (error) {
          hata('tazeleme', error);
          const simdi = saat();
          if (!['saglayici_bekleme', 'devre_acik', 'yerel_kota'].includes(hataKodu(error))) {
            await depo.isiErtele(is, simdi, tekrarMs(error, simdi), hataKodu(error) !== 'http_429');
          }
          if (['http_429', 'saglayici_bekleme', 'devre_acik', 'yerel_kota'].includes(hataKodu(error))) break;
        }
      }
    }
  }
  tur.aynala = async (geceBekliyor) => {
    if (!aynaHazir || geceBekliyor()) return;
    aynaHazir = false;
    try {
      await aynala(depo, saat, () => { if (geceBekliyor()) throw new RadarHatasi('gece_isi'); });
    } catch (error) {
      const kod = hataKodu(error);
      if (kod === 'gece_isi') return;
      const mesaj = 'ayna:' + kod;
      if (depo.saglik().sonHata !== mesaj) gunluk.warn(`[Radar] ${mesaj}`);
      await depo.hataSay(kod);
      await depo.durumYaz('sonHata', mesaj);
    }
  };
  return tur;
}

module.exports = { radarTuruKur };
