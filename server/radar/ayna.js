const { anlikAktarim } = require('../archive/anlikAktarim');
const { tablolarVar } = require('./depo');
const { RadarHatasi, radarKapilari } = require('./ayar');

function* aynaTakvimi(db, kokler, firstAired) {
  if (!radarKapilari(process.env).yaz || !tablolarVar(db) ||
      !db.prepare("SELECT 1 FROM pragma_table_info('radar_takvim') WHERE name='kaynak_at'").get()) return;
  const sec = `SELECT t.kaymak_id,t.veri,t.kaynak_at,t.tur FROM radar_takvim t
    JOIN radar_takip a USING(tur,trakt_id)
    LEFT JOIN radar_is i USING(tur,trakt_id) WHERE coalesce(i.terk,0)=0`;
  const takvimler = kokler ? db.prepare(sec + ' AND t.kaymak_id IN (SELECT value FROM json_each(?))')
    .all(JSON.stringify(kokler)) : db.prepare(sec).all();
  const damga = db.prepare(`SELECT coalesce(max(fetched_at),0) AS at FROM payloads
    WHERE kaymak_id=? AND endpoint IN ('show_seasons','episode_detail','movie_detail','tv_detail')`);
  const altAgac = db.prepare(`SELECT s.kaymak_id, s.season_number, NULL AS episode_number
    FROM entities s WHERE s.parent_id=?
    UNION ALL SELECT b.kaymak_id,b.season_number,b.episode_number
    FROM entities s JOIN entities b ON b.parent_id=s.kaymak_id WHERE s.parent_id=?`);

  for (const { kaymak_id, veri, kaynak_at } of takvimler) {
    const yuvalar = new Map(altAgac.all(kaymak_id, kaymak_id)
      .map((e) => [`${e.season_number}:${e.episode_number ?? '-'}`, e.kaymak_id]));
    yuvalar.set('-:-', kaymak_id);
    const kokAt = damga.get(kaymak_id).at;
    for (const r of JSON.parse(veri).satirlar) {
      const id = yuvalar.get(`${r.sezon ?? '-'}:${r.bolum ?? '-'}`);
      if (!id) continue;
      const arsivDahaYeni = (r.ayna_kaynak_at ?? kaynak_at) <= Math.max(kokAt, id === kaymak_id ? 0 : damga.get(id).at);
      const durum = r.onceki_durum ?? r.durum;
      if (r.durum === 'eksik_yanit') {
        // Eksik gözlem eski takvim değerini taşır. Yeni arşivde
        // geçerli bir tarih varsa onun önceliği korunur.
        if (!['kesin', 'ertelendi'].includes(durum) || !r.tarih || (arsivDahaYeni && firstAired.get(id))) continue;
      } else if (arsivDahaYeni) continue;
      const tarih = ['iptal', 'silindi_dogrulandi'].includes(durum) ? null : r.tarih;
      // catalog/sync sözleşmesi timestamptz ister. Tarih-yalnız bilgisi
      // olayda ve SQLite takviminde ayrı an_turu ile korunur.
      firstAired.set(id, tarih && r.an_turu === 'yalniz_tarih' ? `${tarih}T00:00:00.000Z` : tarih);
    }
    yield;
  }
}

async function aynalariGonder(depo, saat, dur, aktar = (kok) => anlikAktarim.hemen(kok)) {
  const bekleyen = depo.bekleyenAynalar(saat(), 25);
  // Aynı anlık aktarımın mevcut kök partilemesi ve sıralı fazları kullanılır.
  // Yeni revizyon gelse bile onay yalnız gönderime alınmış revizyona aittir.
  dur();
  let hata = false;
  const sonuclar = await Promise.allSettled(bekleyen.map((r) => aktar(r.kaymak_id)));
  for (const [i, sonuc] of sonuclar.entries()) {
    if (sonuc.status === 'fulfilled' && sonuc.value?.ok && !sonuc.value.atlanan) {
      const r = bekleyen[i];
      await depo.aynaOnayla({ ...r, takvim_rev: sonuc.value.revler?.[r.kaymak_id] ?? r.takvim_rev });
    } else {
      await depo.aynaErtele(bekleyen[i], saat(), sonuc.value?.yenidenAt);
      hata = true;
    }
  }
  if (hata) throw new RadarHatasi('ayna_onaysiz');
}

module.exports = { aynaTakvimi, aynalariGonder };
