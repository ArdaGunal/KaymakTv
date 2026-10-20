// ==========================================================================
// A3 KİMLİK ONARIMI — Sezon düzeyi (M552) · hedef sezon bulma + G1s (sezon birleşmeleri)
// ==========================================================================
// 2026-10-20 kuru koşusunda ÖLÇÜLDÜ (08 raporunda YOKTU): 5 sezon kaydı birden çok aktif
// `trakt:season` taşıyor (WWE Raw S15/S16/S17, The Seven Deadly Sins S2, «Episode 1»/Basketball Wives
// LA S6). Sonuç: sezon başlığı ezilmiş (S15 «2010»), ikinci sezonun bölümleri yanlış sezon altında
// (169 bölüm) ve G1'deki 25 bölüm hedef sezonunu bulamıyor. K-3'ün sezon düzeyindeki aynası.
//
// G1s KURALI (G1 ile aynı): sahip = sezon numarası Trakt yükünde kaydın numarasıyla tutan Trakt
// sezonu. Diğeri kendi numarasında YENİ sezon kaydına ayrılır; ona özgü kimlikler + o numaradaki
// çocuk bölümler taşınır. Ortak kimlik sahipte kalır. Hiçbir satır silinmez.

const { gecerli, onarimKimligi, payloadKimlikleri, sezonYuku, indeksle } = require('./defter');

/**
 * Hedef sezonu NUMARAYLA DEĞİL Trakt sezon kimliğiyle bulur (WWE Raw: arşivin «17» numaralı sezonu
 * «2012» adını taşıyor). Plan bu kimliği zaten bir kayda bağladıysa (G1s) o kayıt döner.
 * @returns {{kaymak_id, planli?}|{hata: string}|{acilacak: true}}
 */
function sezonBul(q, d, diziId, ys, no) {
  const tr = ys && ys.ids && gecerli(ys.ids.trakt) ? String(ys.ids.trakt) : null;
  if (tr) {
    const planli = d.kimlikHedefi(`trakt:season=${tr}`);
    if (planli) return { kaymak_id: planli, planli: true };
    const s = q.kimlik.get('trakt:season', tr);
    if (s && s.retired_at == null) {
      const e = q.varlik.get(s.kaymak_id);
      return e && e.parent_id === diziId && e.season_number === no ? { kaymak_id: e.kaymak_id } : { hata: 'sezon_kimligi_baska_yerde' };
    }
  }
  const yuvada = d.yuvadaki(diziId, 'season', no, null);
  if (!yuvada) return { acilacak: true };
  if (yuvada.planli) return { kaymak_id: yuvada.kaymak_id, planli: true };
  const baskaTrakt = q.kimlikleri.all(yuvada.kaymak_id).some((x) => x.source === 'trakt:season' && x.retired_at == null);
  return baskaTrakt ? { hata: 'sezon_numarasi_uyusmaz' } : { kaymak_id: yuvada.kaymak_id };
}

/** Sezonu bulur ya da (yükteki kimlikleriyle) açar. */
function sezonHazirla(q, d, diziId, idx, no) {
  const ys = idx.sezon.get(no);
  const b = sezonBul(q, d, diziId, ys, no);
  if (b.hata || b.kaymak_id) return b;
  if (!ys) return { hata: 'sezon_yukte_yok' };
  const sid = onarimKimligi('season', `${diziId}/S${no}`);
  if (!d.varlikEkle({ kaymak_id: sid, type: 'season', parent_id: diziId, season_number: no, title: ys.title ?? null })) return { hata: 'sezon_acilamadi' };
  for (const k of payloadKimlikleri('season', ys.ids)) d.kimlikEkle(k, sid);
  return { kaymak_id: sid, acildi: true };
}

function planG1s(db, q, d) {
  const kayitlar = db.prepare(`SELECT kaymak_id FROM external_ids WHERE source='trakt:season' AND retired_at IS NULL
                               GROUP BY kaymak_id HAVING COUNT(*) > 1 ORDER BY kaymak_id`).all();
  const sonuc = [];
  for (const { kaymak_id: X } of kayitlar) {
    const r = q.varlik.get(X);
    const dizi = r.parent_id && q.varlik.get(r.parent_id);
    const kayit = { kid: X, dizi: dizi ? dizi.title : null, sezon: `S${r.season_number}`, baslik: r.title, ayrilan: [] };
    sonuc.push(kayit);
    const yuk = dizi && sezonYuku(q, dizi.kaymak_id);
    if (!yuk) { kayit.durum = 'yuk_yok'; continue; }
    const idx = indeksle(yuk.sezonlar);
    const trakttaki = new Map([...idx.sezon.values()].filter((s) => s.ids && gecerli(s.ids.trakt)).map((s) => [String(s.ids.trakt), s]));
    const aktif = q.kimlikleri.all(X).filter((x) => x.source === 'trakt:season' && x.retired_at == null).map((x) => x.source_id);
    kayit.trakt = aktif;
    const sahipler = aktif.filter((t) => trakttaki.has(t) && trakttaki.get(t).number === r.season_number);
    if (sahipler.length !== 1) { kayit.durum = sahipler.length ? 'cok_sahip' : 'sahipsiz'; continue; }
    const sahipS = trakttaki.get(sahipler[0]);
    let sorun = false;
    for (const t of aktif) {
      if (t === sahipler[0]) continue;
      const ys = trakttaki.get(t);
      if (!ys) { kayit.ayrilan.push({ trakt: t, not: 'eski_kimlik' }); sorun = true; continue; }
      const a = { trakt: t, hedef: `S${ys.number} «${ys.title}»`, kimlik: [], bolum: 0 };
      kayit.ayrilan.push(a);
      if (d.yuvadaki(dizi.kaymak_id, 'season', ys.number, null)) { a.not = 'hedef_sezon_dolu'; sorun = true; continue; }
      const yeni = onarimKimligi('season', `${dizi.kaymak_id}/S${ys.number}`);
      if (!d.varlikEkle({ kaymak_id: yeni, type: 'season', parent_id: dizi.kaymak_id, season_number: ys.number, title: ys.title ?? null })) { a.not = 'sezon_acilamadi'; sorun = true; continue; }
      a.yeniSezon = yeni;
      const sahipKume = new Set(payloadKimlikleri('season', sahipS.ids));
      for (const k of payloadKimlikleri('season', ys.ids)) {
        if (sahipKume.has(k)) continue; // ortak → sahipte
        const [src, val] = [k.slice(0, k.indexOf('=')), k.slice(k.indexOf('=') + 1)];
        const s = q.kimlik.get(src, val);
        if (s && s.kaymak_id === X && s.retired_at == null) { if (d.kimlikTasi(k, X, yeni)) a.kimlik.push(k); }
        else if (!s) { if (d.kimlikEkle(k, yeni)) a.kimlik.push(`+${k}`); }
      }
      for (const c of q.cocuklar.all(X)) {
        if (c.type === 'episode' && c.season_number === ys.number && d.varlikGuncelle(c.kaymak_id, { parent_id: yeni }, 'G1s bölüm kendi sezonuna')) a.bolum++;
      }
      a.not = 'ayrilir';
    }
    if (sahipS.title && sahipS.title !== r.title) d.varlikGuncelle(X, { title: sahipS.title }, 'G1s sezon başlığı sahibe döner');
    kayit.yeniBaslik = sahipS.title;
    kayit.durum = sorun ? 'eksik' : 'ayrilir';
  }
  return sonuc;
}

module.exports = { sezonBul, sezonHazirla, planG1s };
