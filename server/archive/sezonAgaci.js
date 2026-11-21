const { resolveOrCreate, traktIdsToExternal, findChild } = require('./identity');

function* sezonAgaciniYaz(dizi, seasons, radarDogrula = false) {
  let sezonSayisi = 0;
  let bolumSayisi = 0;
  let atlanan = 0;

  // 🛑 KASKAD KESİCİ İÇİN KİMLİK EVRENİ. Bu yanıtta görülen TÜM bölüm
  // kimlikleri önceden toplanıyor: `resolveOrCreate` bir yuvayı dolu
  // bulduğunda, sahibinin kimliği bu kümede de geçiyorsa olay bir
  // kimlik değişimi DEĞİL, sezonun yeniden numaralandırılmasıdır.
  // O durumda yeniden eşleme yapılmaz (bağımsız inceleme, 2026-09-14).
  const kimlikEvreni = new Set();
  for (const sezon of seasons) {
    for (const bolum of sezon?.episodes || []) {
      for (const k of traktIdsToExternal('episode', bolum?.ids || {})) {
        kimlikEvreni.add(k.source + '/' + k.source_id);
      }
    }
  }

  for (const sezon of seasons) {
    if (!sezon || typeof sezon.number !== 'number') { atlanan++; continue; }

    const sezonKimlikleri = traktIdsToExternal('season', sezon.ids);
    if (!sezonKimlikleri.length) { atlanan++; continue; }

    const s = resolveOrCreate({
      type: 'season',
      externalIds: sezonKimlikleri,
      parentId: dizi.kaymak_id,
      seasonNumber: sezon.number,
      derived: radarDogrula && findChild({ parentId: dizi.kaymak_id, type: 'season', seasonNumber: sezon.number }) ? {} : { title: sezon.title || null },
    });
    // 🆕 A1 (M549): çözüm `null` dönebilir (kimlik çakışması — `sync_log`'da kayıtlı). Eskiden
    // `s.kaymak_id` TypeError fırlatıp dizinin TÜM sezon yazımını geri aldırırdı.
    if (!s) { atlanan++; continue; }
    sezonSayisi++;

    for (const bolum of sezon.episodes || []) {
      if (!bolum || typeof bolum.number !== 'number') { atlanan++; continue; }

      const bolumKimlikleri = traktIdsToExternal('episode', bolum.ids);
      if (!bolumKimlikleri.length) { atlanan++; continue; }

      const bolumKaydi = resolveOrCreate({
        type: 'episode',
        externalIds: bolumKimlikleri,
        parentId: s.kaymak_id,
        // Bölümün KENDİ `season` alanı, üst sezonunkiyle uyuşmayabilir
        // (Trakt'ta nadiren olur); hiyerarşi indeksinin tutarlı kalması
        // için ÜST SEZONUN numarasını yazıyoruz.
        seasonNumber: sezon.number,
        episodeNumber: bolum.number,
        derived: radarDogrula && findChild({ parentId: s.kaymak_id, type: 'episode', seasonNumber: sezon.number, episodeNumber: bolum.number }) ? {} : { title: bolum.title || null },
        kimlikEvreni,
      });
      if (radarDogrula && !bolumKaydi) { atlanan++; continue; }
      bolumSayisi++;

      yield;
    }
  }

  return {
    ok: true, showKaymakId: dizi.kaymak_id,
    seasons: sezonSayisi, episodes: bolumSayisi, skipped: atlanan,
  };
}

module.exports = { sezonAgaciniYaz };
