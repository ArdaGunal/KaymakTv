const { resolveOrCreate, traktIdsToExternal, findChild, findByExternal } = require('./identity');

function* sezonAgaciniYaz(dizi, seasons, radarDogrula = false, kismi = false) {
  let sezonSayisi = 0;
  let bolumSayisi = 0;
  let atlanan = 0;
  const eksikSezonlar = new Set();
  function uyumsuzYuva(tip, yuva, kimlikler) {
    if (!radarDogrula) return false;
    const birincil = kimlikler.find((k) => k.source === `trakt:${tip}`);
    const sahip = birincil && findByExternal(birincil.source, birincil.source_id);
    if (sahip && sahip !== yuva) return true;
    return kismi && yuva && !kimlikler.some((k) => findByExternal(k.source, k.source_id) === yuva);
  }
  const bolumler = (s) => Array.isArray(s?.episodes) ? s.episodes : [];

  // 🛑 KASKAD KESİCİ İÇİN KİMLİK EVRENİ. Bu yanıtta görülen TÜM bölüm
  // kimlikleri önceden toplanıyor: `resolveOrCreate` bir yuvayı dolu
  // bulduğunda, sahibinin kimliği bu kümede de geçiyorsa olay bir
  // kimlik değişimi DEĞİL, sezonun yeniden numaralandırılmasıdır.
  // O durumda yeniden eşleme yapılmaz (bağımsız inceleme, 2026-09-14).
  const kimlikEvreni = new Set();
  for (const sezon of seasons) {
    for (const bolum of bolumler(sezon)) {
      for (const k of traktIdsToExternal('episode', bolum?.ids || {})) {
        kimlikEvreni.add(k.source + '/' + k.source_id);
      }
    }
  }

  for (const sezon of seasons) {
    if (!sezon || typeof sezon.number !== 'number') { atlanan++; eksikSezonlar.add(sezon?.number); continue; }

    const sezonKimlikleri = traktIdsToExternal('season', sezon.ids);
    if (!sezonKimlikleri.length) { atlanan++; eksikSezonlar.add(sezon.number); continue; }

    const sezonYuvasi = radarDogrula && findChild({ parentId: dizi.kaymak_id, type: 'season', seasonNumber: sezon.number });
    if (uyumsuzYuva('season', sezonYuvasi, sezonKimlikleri)) { atlanan++; eksikSezonlar.add(sezon.number); continue; }
    const s = resolveOrCreate({
      type: 'season',
      externalIds: sezonKimlikleri,
      parentId: dizi.kaymak_id,
      seasonNumber: sezon.number,
      derived: sezonYuvasi ? {} : { title: sezon.title || null },
    });
    // 🆕 A1 (M549): çözüm `null` dönebilir (kimlik çakışması — `sync_log`'da kayıtlı). Eskiden
    // `s.kaymak_id` TypeError fırlatıp dizinin TÜM sezon yazımını geri aldırırdı.
    if (!s) { atlanan++; eksikSezonlar.add(sezon.number); continue; }
    sezonSayisi++;

    for (const bolum of bolumler(sezon)) {
      if (!bolum || typeof bolum.number !== 'number') { atlanan++; eksikSezonlar.add(sezon.number); continue; }

      const bolumKimlikleri = traktIdsToExternal('episode', bolum.ids);
      if (!bolumKimlikleri.length) { atlanan++; eksikSezonlar.add(sezon.number); continue; }

      const bolumYuvasi = radarDogrula && findChild({ parentId: s.kaymak_id, type: 'episode', seasonNumber: sezon.number, episodeNumber: bolum.number });
      if (uyumsuzYuva('episode', bolumYuvasi, bolumKimlikleri)) { atlanan++; eksikSezonlar.add(sezon.number); continue; }
      const bolumKaydi = resolveOrCreate({
        type: 'episode',
        externalIds: bolumKimlikleri,
        parentId: s.kaymak_id,
        // Bölümün KENDİ `season` alanı, üst sezonunkiyle uyuşmayabilir
        // (Trakt'ta nadiren olur); hiyerarşi indeksinin tutarlı kalması
        // için ÜST SEZONUN numarasını yazıyoruz.
        seasonNumber: sezon.number,
        episodeNumber: bolum.number,
        derived: bolumYuvasi ? {} : { title: bolum.title || null },
        kimlikEvreni,
      });
      if (radarDogrula && !bolumKaydi) { atlanan++; eksikSezonlar.add(sezon.number); continue; }
      bolumSayisi++;

      yield;
    }
  }

  return {
    ok: true, showKaymakId: dizi.kaymak_id,
    seasons: sezonSayisi, episodes: bolumSayisi, skipped: atlanan, ...(radarDogrula ? { eksikSezonlar } : {}),
  };
}

module.exports = { sezonAgaciniYaz };
