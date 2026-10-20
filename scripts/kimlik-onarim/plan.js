// ==========================================================================
// A3 KİMLİK ONARIMI — Plan (salt okur) · M552
// ==========================================================================
// Kaynak: `docs/Lazy Down Plan/08_A3_KURU_CALISTIRMA_2026-10-20.md` + kullanıcı kararları S1–S4
// (2026-10-20). Veritabanına YAZMAZ; yalnız eylem listesi + rapor verisi üretir.
//
// Doğruluk ölçütü HER ZAMAN Trakt'ın kendi listesi: bir bölümün yuvası dizinin `show_seasons`
// yükünden, iki dizinin hangi kimliği taşıdığı iki dizinin Trakt yanıtlarından okunur. Tahmin yok:
// bir kimlik iki tarafa da uyuyorsa «ortak» sayılır ve İLK SAHİBİNDE kalır (07 §2.1).
//
//   G1 · birden çok aktif `trakt:episode` taşıyan bölüm  → sahip kalır, diğerleri kendi yuvasına
//   G2 · birden çok aktif `trakt:show` taşıyan dizi       → ikinci dizi kendi ağacına (Haunting)
//   G3 · sayısal `trakt:show`'u olmayan slug kökü           → sayısal kimlik eklenir / sayısal kayda birleşir
//   G5 · tür karışması (bölümde film, dizide bölüm kimliği) → doğru türde kayda ayrılır

const { ac, gecerli, onarimKimligi, payloadKimlikleri, sezonYuku, indeksle } = require('./defter');
const { sezonHazirla } = require('./sezon');

const aktifKimlikler = (q, kid, source) =>
  q.kimlikleri.all(kid).filter((x) => x.source === source && x.retired_at == null);

/** Bir yanıtın (detay/sezon listesi) kimlik kümesi — G2 sınıflaması için. */
function detayKumesi(tip, govde) { return new Set(payloadKimlikleri(tip, govde && govde.ids)); }

// ── G1 ───────────────────────────────────────────────────────────────────────────────────────────
function planG1(db, q, d) {
  const kayitlar = db.prepare(`SELECT kaymak_id FROM external_ids WHERE source='trakt:episode' AND retired_at IS NULL
                               GROUP BY kaymak_id HAVING COUNT(*) > 1 ORDER BY kaymak_id`).all();
  const sonuc = [];
  for (const { kaymak_id: kid } of kayitlar) {
    const r = q.varlik.get(kid);
    const kayit = { kid, yuva: `S${r.season_number}E${r.episode_number}`, baslik: r.title, tasinacak: [] };
    sonuc.push(kayit);
    if (r.type !== 'episode') { kayit.durum = 'tur_beklenmedik'; continue; }
    const sezonE = q.varlik.get(r.parent_id);
    const dizi = sezonE && q.varlik.get(sezonE.parent_id);
    kayit.dizi = dizi ? dizi.title : null;
    kayit.diziKid = dizi ? dizi.kaymak_id : null;
    const yuk = dizi && sezonYuku(q, dizi.kaymak_id);
    if (!yuk) { kayit.durum = 'yuk_yok'; continue; }
    const idx = indeksle(yuk.sezonlar);
    const trakt = aktifKimlikler(q, kid, 'trakt:episode').map((x) => x.source_id);
    kayit.trakt = trakt;
    const sahipler = trakt.filter((t) => { const ep = idx.bolum.get(t); return ep && ep.season === r.season_number && ep.number === r.episode_number; });
    if (sahipler.length !== 1) { kayit.durum = sahipler.length ? 'cok_sahip' : 'sahipsiz'; continue; }
    const sahip = sahipler[0];
    const sahipEp = idx.bolum.get(sahip);
    kayit.sahip = sahip;
    let hedefDolu = false;
    for (const t of trakt) {
      if (t === sahip) continue;
      const ep = idx.bolum.get(t);
      if (!ep) { kayit.tasinacak.push({ trakt: t, not: 'eski_kimlik' }); continue; }
      const ozgu = [`trakt:episode=${t}`];
      for (const [kaynak, alan] of [['tmdb:episode', 'tmdb'], ['imdb', 'imdb'], ['tvdb:episode', 'tvdb']]) {
        const v = ep.ids[alan];
        if (!gecerli(v)) continue;
        if (gecerli(sahipEp.ids[alan]) && String(sahipEp.ids[alan]) === String(v)) continue; // ortak → sahipte
        const s = q.kimlik.get(kaynak, String(v));
        if (s && s.kaymak_id === kid && s.retired_at == null) ozgu.push(`${kaynak}=${v}`);
      }
      const t1 = { trakt: t, hedef: `S${ep.season}E${ep.number}`, hedefBaslik: ep.title, tasinacakKimlik: ozgu };
      kayit.tasinacak.push(t1);
      const sezon = sezonHazirla(q, d, dizi.kaymak_id, idx, ep.season);
      if (sezon.hata) { t1.not = sezon.hata; continue; }
      if (sezon.acildi) t1.not = 'sezon_yok';
      if (sezon.acildi || sezon.planli) t1.yeniSezonda = true;
      const hedef = d.yuvadaki(sezon.kaymak_id, 'episode', ep.season, ep.number);
      if (hedef && hedef.yeni) { t1.not = 'hedef_planli_cakisma'; continue; } // iki taşıma aynı yuvaya — insan bakar
      if (hedef) {
        const hedefTrakt = aktifKimlikler(q, hedef.kaymak_id, 'trakt:episode').map((x) => x.source_id);
        t1.not = 'hedef_dolu';
        t1.hedefKayit = { kaymak_id: hedef.kaymak_id, baslik: q.varlik.get(hedef.kaymak_id).title, trakt: hedefTrakt };
        if (hedefTrakt.length) { // S2: fazla kimlik emekliye ayrılır (aynı yayının ikinci kopyası hedefte duruyor)
          for (const k of ozgu) d.kimlikEmekli(k, kid);
          hedefDolu = true;
        } else {
          for (const k of ozgu) d.kimlikTasi(k, kid, hedef.kaymak_id);
          t1.not = 'hedef_kimliksiz';
        }
        continue;
      }
      const yeni = onarimKimligi('episode', `trakt:episode=${t}`);
      if (!d.varlikEkle({ kaymak_id: yeni, type: 'episode', parent_id: sezon.kaymak_id, season_number: ep.season, episode_number: ep.number, title: ep.title })) { t1.not = 'bolum_acilamadi'; continue; }
      for (const k of ozgu) d.kimlikTasi(k, kid, yeni);
      t1.not = t1.not || 'hedef_bos';
      t1.yeniKayit = yeni;
    }
    if (sahipEp.title && sahipEp.title !== r.title) d.varlikGuncelle(kid, { title: sahipEp.title }, 'G1 başlık sahibe döner');
    const sorunlu = kayit.tasinacak.some((x) => !['hedef_bos', 'sezon_yok', 'hedef_dolu', 'hedef_kimliksiz'].includes(x.not));
    kayit.durum = sorunlu ? 'eksik' : (hedefDolu ? 'hedef_dolu' : 'temiz_ayrilir');
  }
  return sonuc;
}

// ── G2 ───────────────────────────────────────────────────────────────────────────────────────────
/** Kayıttaki kimlikleri iki tarafa göre sınıflar; B'ye özgü olan taşınır, A'ya ait emekli olan etkinleşir. */
function ikiyeAyir(d, q, kid, hedefKid, aKume, bKume, rapor) {
  for (const x of q.kimlikleri.all(kid)) {
    const k = `${x.source}=${x.source_id}`;
    const a = aKume.has(k);
    const b = bKume.has(k);
    if (b && !a) { if (x.retired_at == null && d.kimlikTasi(k, kid, hedefKid)) rapor.tasinan.push(k); else if (x.retired_at != null) rapor.belirsiz.push(`${k} (B'nin, emekli — yerinde)`); }
    else if (a && x.retired_at != null) { if (d.kimlikEtkin(k, kid)) rapor.etkinlesen.push(k); }
    else if (!a && !b) rapor.belirsiz.push(k);
    else if (a && b) rapor.ortak.push(k);
  }
}

function planG2(db, q, d, trakt) {
  const diziler = db.prepare(`SELECT kaymak_id FROM external_ids WHERE source='trakt:show' AND retired_at IS NULL
                              GROUP BY kaymak_id HAVING COUNT(*) > 1 ORDER BY kaymak_id`).all();
  const sonuc = [];
  for (const { kaymak_id: H } of diziler) {
    const tr = aktifKimlikler(q, H, 'trakt:show').sort((x, y) => x.first_seen_at - y.first_seen_at || Number(x.source_id) - Number(y.source_id));
    const kayit = { kid: H, baslik: q.varlik.get(H).title, trakt: tr.map((x) => x.source_id), tasinan: [], etkinlesen: [], ortak: [], belirsiz: [], eylem: [] };
    sonuc.push(kayit);
    if (tr.length !== 2) { kayit.durum = 'ikiden_fazla'; continue; }
    const [A, B] = [tr[0].source_id, tr[1].source_id]; // A = ilk sahip (kalır), B = ayrılan
    const istek = (id, tur) => (tur === 'detay' ? `/shows/${id}?extended=full&translations=tr` : `/shows/${id}/seasons?extended=full,episodes`);
    const yanit = { aD: trakt(istek(A, 'detay')), aS: trakt(istek(A, 'sezon')), bD: trakt(istek(B, 'detay')), bS: trakt(istek(B, 'sezon')) };
    if (Object.values(yanit).some((v) => !v)) { kayit.durum = 'trakt_bekleniyor'; continue; }
    if (Object.values(yanit).some((v) => v.govde == null)) { kayit.durum = 'trakt_bulunamadi'; continue; }
    kayit.kalan = `${yanit.aD.govde.title} (${yanit.aD.govde.year}, trakt ${A})`;
    kayit.ayrilan = `${yanit.bD.govde.title} (${yanit.bD.govde.year}, trakt ${B})`;
    const aIdx = indeksle(yanit.aS.govde);
    const bIdx = indeksle(yanit.bS.govde);
    const B_ID = onarimKimligi('show', `trakt:show=${B}`);
    const bd = yanit.bD.govde;
    d.varlikEkle({ kaymak_id: B_ID, type: 'show', title: bd.title ?? null, year: bd.year ?? null, status: bd.status ?? null });
    kayit.yeniDizi = B_ID;
    ikiyeAyir(d, q, H, B_ID, detayKumesi('show', yanit.aD.govde), detayKumesi('show', bd), kayit);
    d.varlikGuncelle(H, { title: yanit.aD.govde.title, year: yanit.aD.govde.year, status: yanit.aD.govde.status }, 'G2 ilk sahibin bilgisi');

    // Yükler: H'deki her yük kimin? Detay `ids.trakt`, sezon listesi bölüm kimlikleriyle tanınır.
    const bBolumler = new Set(bIdx.bolum.keys());
    for (const y of q.yukler.all(H)) {
      let kimin = null;
      try {
        const j = ac(y.body);
        if (Array.isArray(j)) { const ks = [...indeksle(j).bolum.keys()]; kimin = ks.length && ks.every((k) => bBolumler.has(k)) ? 'B' : 'A?'; }
        else kimin = j && j.ids && String(j.ids.trakt) === B ? 'B' : 'A?';
      } catch (_) { kimin = 'bozuk'; }
      if (kimin === 'B' && d.yukTasi(y.provider, y.endpoint, y.lang, H, B_ID)) kayit.eylem.push(`yük ${y.provider}/${y.endpoint}/${y.lang} → ayrılan diziye`);
    }
    if (d.yukEkle('trakt', 'show_detail', 'tr', H, istek(A, 'detay'))) kayit.eylem.push('ilk sahibe Trakt show_detail/tr yazılır');
    if (d.yukEkle('trakt', 'show_seasons', '-', H, istek(A, 'sezon'))) kayit.eylem.push('ilk sahibe Trakt show_seasons/- yazılır');

    // Sezonlar + bölümler
    for (const [no, bs] of bIdx.sezon) {
      const hs = q.cocuk.get(H, 'season', no, -1);
      const BS = onarimKimligi('season', `${B_ID}/S${no}`);
      d.varlikEkle({ kaymak_id: BS, type: 'season', parent_id: B_ID, season_number: no, title: bs.title ?? null });
      if (hs) ikiyeAyir(d, q, hs.kaymak_id, BS, new Set(payloadKimlikleri('season', aIdx.sezon.get(no) && aIdx.sezon.get(no).ids)), new Set(payloadKimlikleri('season', bs.ids)), kayit);
      else for (const k of payloadKimlikleri('season', bs.ids)) d.kimlikEkle(k, BS);
      for (const ep of bs.episodes || []) {
        if (!ep || !ep.ids || !gecerli(ep.ids.trakt)) continue;
        const BE = onarimKimligi('episode', `trakt:episode=${ep.ids.trakt}`);
        d.varlikEkle({ kaymak_id: BE, type: 'episode', parent_id: BS, season_number: no, episode_number: ep.number, title: ep.title ?? null });
        const he = hs && q.cocuk.get(hs.kaymak_id, 'episode', no, ep.number);
        const aEp = aIdx.yuva.get(`${no}x${ep.number}`);
        if (he) {
          ikiyeAyir(d, q, he.kaymak_id, BE, new Set(payloadKimlikleri('episode', aEp && aEp.ids)), new Set(payloadKimlikleri('episode', ep.ids)), kayit);
          if (aEp && aEp.title && aEp.title !== he.title) d.varlikGuncelle(he.kaymak_id, { title: aEp.title }, 'G2 bölüm başlığı ilk sahibe döner');
        } else {
          for (const k of payloadKimlikleri('episode', ep.ids)) d.kimlikEkle(k, BE);
        }
      }
    }
    kayit.durum = kayit.belirsiz.length ? 'belirsiz_var' : 'ayrilir';
  }
  return sonuc;
}

// ── G3 ───────────────────────────────────────────────────────────────────────────────────────────
/**
 * Trakt slug'ı artık tanımıyorsa (404 — 2026-10-20: `chernobyl-2019`) sayısal kopyayı SEZON KİMLİĞİYLE
 * bulur: kökün sezonlarının `trakt:season` kimliği başka bir dizinin `show_seasons` yükünde geçiyor mu.
 */
function sezonKimligiyleBul(db, q, K) {
  const tr = new Set();
  for (const s of q.cocuklar.all(K)) for (const x of aktifKimlikler(q, s.kaymak_id, 'trakt:season')) tr.add(x.source_id);
  if (!tr.size) return [];
  const bulunan = new Set();
  for (const r of db.prepare("SELECT kaymak_id, body FROM payloads WHERE provider='trakt' AND endpoint='show_seasons' AND kaymak_id <> ?").iterate(K)) {
    let j = null;
    try { j = ac(r.body); } catch (_) { continue; }
    if (Array.isArray(j) && j.some((s) => s && s.ids && tr.has(String(s.ids.trakt))) && aktifKimlikler(q, r.kaymak_id, 'trakt:show').length) bulunan.add(r.kaymak_id);
  }
  return [...bulunan];
}

function planG3(db, q, d, trakt) {
  const kokler = db.prepare(`SELECT e.kaymak_id FROM entities e WHERE e.type='show'
      AND NOT EXISTS (SELECT 1 FROM external_ids x WHERE x.kaymak_id=e.kaymak_id AND x.source='trakt:show' AND x.retired_at IS NULL)
      ORDER BY e.kaymak_id`).all();
  const sonuc = [];
  for (const { kaymak_id: K } of kokler) {
    const sluglar = aktifKimlikler(q, K, 'trakt:slug').map((x) => x.source_id);
    const sezonlar = q.cocuklar.all(K);
    const kayit = { kid: K, slug: sluglar.join(','), sezon: sezonlar.length, eylem: [] };
    sonuc.push(kayit);
    if (sluglar.length !== 1) { kayit.durum = sluglar.length ? 'cok_slug' : 'kimliksiz_kok'; continue; }
    const istek = `/shows/${sluglar[0]}?extended=full&translations=tr`;
    const y = trakt(istek);
    if (!y) { kayit.durum = 'trakt_bekleniyor'; continue; }
    const g = y.govde && y.govde.ids && gecerli(y.govde.ids.trakt) ? y.govde : null;
    let N = null;
    if (g) {
      kayit.trakt = `${g.title} (${g.year}) trakt ${g.ids.trakt}`;
      const sayisal = q.kimlik.get('trakt:show', String(g.ids.trakt));
      if (sayisal && sayisal.kaymak_id !== K) N = sayisal.kaymak_id;
    } else {
      const adaylar = sezonKimligiyleBul(db, q, K);
      kayit.trakt = `Trakt ${y.durum || 'yanıt yok'} — sezon kimliğiyle arandı: ${adaylar.length} aday`;
      if (adaylar.length !== 1) { kayit.durum = 'trakt_bulunamadi'; continue; }
      N = adaylar[0];
    }
    if (N) {
      // Sayısal kopya var: sezonlar onun altına, slug ona; boşalan kök SİLİNMEZ (arşiv silmez). Dizi düzeyindeki
      // kullanıcı satırları (izleme listesi) sayısal kimliğe bağlı olduğu için hedef SAYISAL kayıt.
      const n = q.varlik.get(N);
      kayit.birlesir = `${n.title || (g && g.title)} (${N})`;
      for (const s of sezonlar) {
        if (d.varlikGuncelle(s.kaymak_id, { parent_id: N }, 'G3 sezon sayısal kayda taşınır')) kayit.eylem.push(`sezon S${s.season_number} → sayısal kayıt`);
        else kayit.eylem.push(`⚠ sezon S${s.season_number} taşınamadı`);
      }
      if (d.kimlikTasi(`trakt:slug=${sluglar[0]}`, K, N)) kayit.eylem.push(`trakt:slug=${sluglar[0]} → sayısal kayıt`);
      if (g) {
        // Sayısal kaydın BOŞ alanları Trakt'tan dolar (dolu alan ezilmez); eksik kimlikler eklenir.
        const bos = {};
        for (const a of ['title', 'year', 'status']) if (n[a] == null && g[a] != null) bos[a] = g[a];
        if (d.varlikGuncelle(N, bos, 'G3 sayısal kaydın boş alanları')) kayit.eylem.push(`sayısal kayda başlık «${g.title}» (${g.year})`);
        for (const k of payloadKimlikleri('show', g.ids)) {
          if (k.startsWith('trakt:show=') || k === `trakt:slug=${sluglar[0]}`) continue;
          const [src, val] = [k.slice(0, k.indexOf('=')), k.slice(k.indexOf('=') + 1)];
          const s = q.kimlik.get(src, val);
          if (!s) { if (d.kimlikEkle(k, N)) kayit.eylem.push(`+ ${k} (sayısal kayda)`); }
          else if (s.kaymak_id !== N) kayit.eylem.push(`⚠ ${k} başka kayıtta (${s.kaymak_id}) — eklenmedi`);
        }
        if (d.yukEkle('trakt', 'show_detail', 'tr', N, istek)) kayit.eylem.push('Trakt show_detail/tr sayısal kayda yazılır');
      }
      kayit.durum = 'birlesir';
      continue;
    }
    for (const k of payloadKimlikleri('show', g.ids)) {
      if (k === `trakt:slug=${sluglar[0]}`) continue;
      if (d.kimlikEkle(k, K)) kayit.eylem.push(`+ ${k}`);
    }
    if (d.varlikGuncelle(K, { title: g.title ?? null, year: g.year ?? null, status: g.status ?? null }, "G3 başlık Trakt'tan")) kayit.eylem.push(`başlık «${g.title}» (${g.year})`);
    if (d.yukEkle('trakt', 'show_detail', 'tr', K, istek)) kayit.eylem.push('Trakt show_detail/tr yazılır');
    kayit.durum = 'kimlik_eklenir';
  }
  return sonuc;
}

// ── G5 ───────────────────────────────────────────────────────────────────────────────────────────
function ebeveynBolumu(q, kid) {
  const e = q.varlik.get(kid);
  const s = e && e.parent_id && q.varlik.get(e.parent_id);
  const yuk = s && s.parent_id && sezonYuku(q, s.parent_id);
  const tr = aktifKimlikler(q, kid, 'trakt:episode')[0];
  return yuk && tr ? indeksle(yuk.sezonlar).bolum.get(tr.source_id) || null : null;
}

function planG5(db, q, d) {
  const sonuc = [];
  const filmli = db.prepare(`SELECT kaymak_id FROM entities e WHERE e.type='episode' AND EXISTS (SELECT 1 FROM external_ids x
      WHERE x.kaymak_id=e.kaymak_id AND x.source IN ('trakt:movie','tmdb:movie') AND x.retired_at IS NULL) ORDER BY kaymak_id`).all();
  for (const { kaymak_id: E } of filmli) {
    const r = q.varlik.get(E);
    const kayit = { kid: E, tur: 'bolumde_film', baslik: r.title, eylem: [] };
    sonuc.push(kayit);
    const tm = aktifKimlikler(q, E, 'trakt:movie')[0];
    if (!tm) { kayit.durum = 'trakt_movie_yok'; continue; }
    const detayRow = q.yuk.get(E, 'trakt', 'movie_detail', 'tr') || q.yuk.get(E, 'trakt', 'movie_detail', 'en');
    const detay = detayRow ? ac(detayRow.body) : null;
    const M = onarimKimligi('movie', `trakt:movie=${tm.source_id}`);
    d.varlikEkle({ kaymak_id: M, type: 'movie', title: (detay && detay.title) || r.title, year: (detay && detay.year) ?? null });
    kayit.yeniFilm = M;
    const filmKume = new Set(payloadKimlikleri('movie', detay && detay.ids));
    const bolumEp = ebeveynBolumu(q, E);
    const bolumKume = new Set(payloadKimlikleri('episode', bolumEp && bolumEp.ids));
    for (const x of q.kimlikleri.all(E)) {
      if (x.retired_at != null) continue;
      const k = `${x.source}=${x.source_id}`;
      const filmin = x.source === 'trakt:movie' || x.source === 'tmdb:movie' || (filmKume.has(k) && !bolumKume.has(k));
      if (filmin && d.kimlikTasi(k, E, M)) kayit.eylem.push(`${k} → film`);
      else if (filmKume.has(k) && bolumKume.has(k)) kayit.eylem.push(`${k} ortak — bölümde kalır`);
    }
    for (const y of q.yukler.all(E)) if (y.endpoint === 'movie_detail' && d.yukTasi(y.provider, y.endpoint, y.lang, E, M)) kayit.eylem.push(`yük ${y.provider}/movie_detail/${y.lang} → film`);
    if (bolumEp && bolumEp.title && bolumEp.title !== r.title && d.varlikGuncelle(E, { title: bolumEp.title }, 'G5 bölüm başlığı')) kayit.eylem.push(`bölüm başlığı «${bolumEp.title}»`);
    kayit.durum = 'ayrilir';
  }

  const bolumlu = db.prepare(`SELECT kaymak_id FROM entities e WHERE e.type='show' AND EXISTS (SELECT 1 FROM external_ids x
      WHERE x.kaymak_id=e.kaymak_id AND x.source IN ('trakt:episode','tmdb:episode','tvdb:episode') AND x.retired_at IS NULL) ORDER BY kaymak_id`).all();
  for (const { kaymak_id: S } of bolumlu) {
    const r = q.varlik.get(S);
    const kayit = { kid: S, tur: 'dizide_bolum', baslik: r.title, eylem: [] };
    sonuc.push(kayit);
    const te = aktifKimlikler(q, S, 'trakt:episode');
    const yuk = sezonYuku(q, S);
    if (te.length !== 1 || !yuk) { kayit.durum = te.length !== 1 ? 'trakt_episode_sayisi' : 'yuk_yok'; continue; }
    const idx = indeksle(yuk.sezonlar);
    const ep = idx.bolum.get(te[0].source_id);
    if (!ep) { kayit.durum = 'bolum_yukte_yok'; continue; }
    kayit.yuva = `S${ep.season}E${ep.number} «${ep.title}»`;
    const sezon = sezonHazirla(q, d, S, idx, ep.season);
    if (sezon.hata) { kayit.durum = sezon.hata; continue; }
    if (sezon.acildi) kayit.eylem.push(`sezon S${ep.season} açılır`);
    const bolumKume = new Set(payloadKimlikleri('episode', ep.ids));
    const detayRow = q.yuk.get(S, 'trakt', 'show_detail', 'tr') || q.yuk.get(S, 'trakt', 'show_detail', 'en');
    const detay = detayRow ? ac(detayRow.body) : null;
    // Trakt bazen dizinin imdb'sini bölüme de veriyor (Madde 288 deseni): dizinin KENDİ detayında da
    // varsa ortaktır → dizide (ilk sahip) kalır. Yalnız bölüme özgü imdb taşınır.
    const diziKume = new Set(payloadKimlikleri('show', detay && detay.ids));
    const tasinacak = q.kimlikleri.all(S).filter((x) => x.retired_at == null && (x.source.endsWith(':episode')
        || (x.source === 'imdb' && bolumKume.has(`imdb=${x.source_id}`) && !diziKume.has(`imdb=${x.source_id}`))))
      .map((x) => `${x.source}=${x.source_id}`);
    for (const x of q.kimlikleri.all(S)) if (x.source === 'imdb' && diziKume.has(`imdb=${x.source_id}`) && bolumKume.has(`imdb=${x.source_id}`)) kayit.eylem.push(`imdb=${x.source_id} ortak — dizide kalır`);
    const hedef = d.yuvadaki(sezon.kaymak_id, 'episode', ep.season, ep.number);
    let hedefKid;
    if (!hedef) {
      hedefKid = onarimKimligi('episode', `trakt:episode=${te[0].source_id}`);
      d.varlikEkle({ kaymak_id: hedefKid, type: 'episode', parent_id: sezon.kaymak_id, season_number: ep.season, episode_number: ep.number, title: ep.title });
      kayit.yeniBolum = hedefKid;
    } else if (!hedef.yeni && aktifKimlikler(q, hedef.kaymak_id, 'trakt:episode').length === 0) {
      hedefKid = hedef.kaymak_id;
      kayit.eylem.push(`yuvadaki kimliksiz kayda (${hedefKid}) taşınır`);
    } else { kayit.durum = 'hedef_dolu'; kayit.hedefKayit = hedef.kaymak_id; continue; }
    for (const k of tasinacak) if (d.kimlikTasi(k, S, hedefKid)) kayit.eylem.push(`${k} → bölüm`);
    if (detay && detay.title && d.varlikGuncelle(S, { title: detay.title }, 'G5 dizi başlığı show_detail\'den')) kayit.eylem.push(`dizi başlığı «${r.title}» → «${detay.title}»`);
    kayit.durum = 'ayrilir';
  }
  return sonuc;
}

module.exports = { planG1, planG2, planG3, planG5 };
