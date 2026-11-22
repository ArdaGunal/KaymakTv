const { anlikAktarim } = require('../archive/anlikAktarim');
const { tablolarVar } = require('./depo');
const { RadarHatasi, radarKapilari } = require('./ayar');

function* aynaTakvimi(db, kokler, firstAired, firstAiredAt = new Map()) {
  if (!radarKapilari(process.env).yaz || !tablolarVar(db) ||
      !db.prepare("SELECT 1 FROM pragma_table_info('radar_takvim') WHERE name='kaynak_at'").get()) return;
  const sec = `SELECT t.kaymak_id,t.veri,t.kaynak_at,t.tur FROM radar_takvim t
    JOIN radar_takip a USING(tur,trakt_id)
    LEFT JOIN radar_is i USING(tur,trakt_id) WHERE coalesce(i.terk,0)=0`;
  const takvimler = kokler ? db.prepare(sec + ' AND t.kaymak_id IN (SELECT value FROM json_each(?))')
    .all(JSON.stringify(kokler)) : db.prepare(sec).all();
  const altAgac = db.prepare(`SELECT s.kaymak_id, s.season_number, NULL AS episode_number
    FROM entities s WHERE s.parent_id=?
    UNION ALL SELECT b.kaymak_id,b.season_number,b.episode_number
    FROM entities s JOIN entities b ON b.parent_id=s.kaymak_id WHERE s.parent_id=?`);

  for (const { kaymak_id, veri, kaynak_at } of takvimler) {
    const yuvalar = new Map(altAgac.all(kaymak_id, kaymak_id)
      .map((e) => [`${e.season_number}:${e.episode_number ?? '-'}`, e.kaymak_id]));
    yuvalar.set('-:-', kaymak_id);
    for (const r of JSON.parse(veri).satirlar) {
      const id = yuvalar.get(`${r.sezon ?? '-'}:${r.bolum ?? '-'}`);
      if (!id) continue;
      const arsivDahaYeni = (firstAiredAt.get(id) ?? 0) > (r.ayna_kaynak_at ?? kaynak_at);
      const durum = r.onceki_durum ?? r.durum;
      const silindi = ['iptal', 'silindi_dogrulandi'].includes(durum);
      if (r.durum === 'eksik_yanit' && !silindi) {
        // Eksik gözlem eski takvim değerini taşır. Yeni arşivde
        // geçerli bir tarih varsa onun önceliği korunur.
        if (!['kesin', 'ertelendi'].includes(durum) || !r.tarih || (arsivDahaYeni && firstAired.get(id))) continue;
      } else if (arsivDahaYeni && !silindi) continue;
      const tarih = silindi ? null : r.tarih;
      // catalog/sync sözleşmesi timestamptz ister. Tarih-yalnız bilgisi
      // olayda ve SQLite takviminde ayrı an_turu ile korunur.
      firstAired.set(id, tarih && r.an_turu === 'yalniz_tarih' ? `${tarih}T00:00:00.000Z` : tarih);
    }
    yield;
  }
}

async function aynalariGonder(depo, saat, dur, aktar = (kok, secenek) => anlikAktarim.hemen(kok, secenek)) {
  const bekleyen = depo.bekleyenAynalar(saat(), 25);
  // Aynı anlık aktarımın mevcut kök partilemesi ve sıralı fazları kullanılır.
  // Yeni revizyon gelse bile onay yalnız gönderime alınmış revizyona aittir.
  dur();
  let hata = false;
  const sonuclar = await Promise.allSettled(bekleyen.map((r) => aktar(r.kaymak_id, { dur })));
  const satirReddi = (r) => r?.atlanan > 0 || r?.reason === 'http_422';
  for (const [i, sonuc] of sonuclar.entries()) {
    const r = bekleyen[i];
    let cevap = sonuc.value;
    if (satirReddi(cevap)) {
      dur();
      try { cevap = await aktar(r.kaymak_id, { tekil: true, dur }); } catch (_) { cevap = null; }
    }
    if (cevap?.reason === 'gece_isi') continue;
    if (cevap?.ok && !cevap.atlanan) {
      await depo.aynaOnayla({ ...r, takvim_rev: cevap.revler?.[r.kaymak_id] ?? r.takvim_rev,
        goruntu: cevap.takvimler?.[r.kaymak_id] ?? r }, saat());
    } else {
      await depo.aynaErtele(r, saat(), cevap?.yenidenAt, satirReddi(cevap));
      hata = true;
    }
  }
  if (hata) throw new RadarHatasi('ayna_onaysiz');
}

module.exports = { aynaTakvimi, aynalariGonder };
