// ==========================================================================
// A3 KİMLİK ONARIMI — G6: birden çok AKTİF `tmdb:episode` taşıyan bölüm (O-6) · M557
// ==========================================================================
// 2026-10-21 ölçüldü (A3'ten sonra kalan 11 kayıt): başlıksız bir dizinin S2E1–E10'u + Silo S4E1. Hepsinde
// Trakt'ın GÜNCEL `show_seasons` yükü kaydın Trakt bölümüne tek bir TMDB kimliği veriyor; diğer kimlik yükte
// HİÇ yok (TMDB bölümü yeniden kimliklendirmiş; eski kimlik 31.08–02.09'da bir kez görülmüş).
//
// KURAL: yükteki kimlik kalır; yükte HİÇ geçmeyen eski kimlik EMEKLİYE ayrılır (silinmez). Diğer kimlik yükte
// başka bir bölüme aitse dokunulmaz (taşıma ayrı karar). Ayna `tmdb_id`'yi iki aktif kimlik arasında belirsiz
// seçiyordu (`aynaSatirlari.haritalariKur`) — kayıt «dokunulur» (updated_at) ki doğru değer Supabase'e gitsin.

const { sezonYuku, indeksle } = require('./defter');

function planG6(db, q, d) {
  const kayitlar = db.prepare(`SELECT kaymak_id FROM external_ids WHERE source='tmdb:episode' AND retired_at IS NULL
                               GROUP BY kaymak_id HAVING COUNT(*) > 1 ORDER BY kaymak_id`).all();
  const sonuc = [];
  const yukler = new Map();
  for (const { kaymak_id: K } of kayitlar) {
    const r = q.varlik.get(K);
    const sezon = r && r.parent_id && q.varlik.get(r.parent_id);
    const dizi = sezon && sezon.parent_id && q.varlik.get(sezon.parent_id);
    const kayit = { kid: K, dizi: dizi ? dizi.title : null, yuva: r ? `S${r.season_number}E${r.episode_number}` : '?', baslik: r && r.title, emekli: [] };
    sonuc.push(kayit);
    const aktif = (src) => q.kimlikleri.all(K).filter((x) => x.source === src && x.retired_at == null).map((x) => x.source_id);
    const trakt = aktif('trakt:episode');
    if (!r || r.type !== 'episode' || !dizi) { kayit.durum = 'tur_beklenmedik'; continue; }
    if (trakt.length !== 1) { kayit.durum = trakt.length ? 'g1_kapsaminda' : 'trakt_yok'; continue; }
    if (!yukler.has(dizi.kaymak_id)) {
      const y = sezonYuku(q, dizi.kaymak_id);
      yukler.set(dizi.kaymak_id, y ? indeksle(y.sezonlar) : null);
    }
    const idx = yukler.get(dizi.kaymak_id);
    const ep = idx && idx.bolum.get(trakt[0]);
    if (!ep) { kayit.durum = idx ? 'bolum_yukte_yok' : 'yuk_yok'; continue; }
    const dogru = ep.ids && ep.ids.tmdb != null ? String(ep.ids.tmdb) : null;
    const tmdbler = aktif('tmdb:episode');
    if (!dogru || !tmdbler.includes(dogru)) { kayit.durum = 'dogru_kimlik_kayitta_yok'; continue; }
    kayit.kalan = dogru;
    const yuktekiler = new Set([...idx.bolum.values()].map((b) => (b.ids && b.ids.tmdb != null ? String(b.ids.tmdb) : null)));
    let baska = false;
    for (const t of tmdbler) {
      if (t === dogru) continue;
      if (yuktekiler.has(t)) { baska = true; kayit.emekli.push(`${t} (yükte başka bölümde — dokunulmadı)`); continue; }
      if (d.kimlikEmekli(`tmdb:episode=${t}`, K)) kayit.emekli.push(t);
    }
    d.varlikDokun(K, 'G6 doğru tmdb_id aynaya yeniden gitsin');
    kayit.durum = baska ? 'kismen' : 'ayrilir';
  }
  return sonuc;
}

module.exports = { planG6 };
