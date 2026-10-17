// ==========================================================================
// KATALOG ARŞİVİ — TMDB detayları  (K4 + K1(d) · M532)
// ==========================================================================
// TEK İŞİ: TMDB `tv_detail` / `movie_detail` yanıtlarını (içindeki
// `poster_path`, `backdrop_path`, Türkçe özet dahil) arşive yazmak ve geri
// düşüşte okumak. Kullanıcı + danışman kararı (2026-10-18): görsel BAYTLARI
// Pi'ye inmez (K1-c iptal); ama görselin YOLU ve künye kalıcı olsun ki TMDB
// kapanırsa/anahtar iptal olursa afiş adresleri önbelleğin 180 günüyle ölmesin.
//
// 🔴 KİMLİK YARATMAZ — YALNIZCA VAR OLAN YAPIMA EKLER.
// Arşivin kimlik omurgası Trakt'tan kurulur (`identity.js`: "TMDB yanıtları
// trakt ID taşımaz, backfill TRAKT tarafından başlar"). Trakt'ın detay yanıtı
// `ids.tmdb` taşıdığı için yapım zaten `tmdb:show` / `tmdb:movie` eşlemesiyle
// arşivdedir (canlı 2026-10-18: 963 dizi, 1.247 film). TMDB-yalnız yeni bir
// varlık açsaydık: (1) ayna onu Trakt kimliği olmadan Supabase'e taşırdı,
// (2) bir afiş ızgarası arşive yüzlerce kabuk varlık eklerdi ve arşiv hiçbir
// şeyi silmez. Eşlemesi olmayan yanıt `trakt_kimligi_yok` ile ATLANIR —
// yapım Trakt üzerinden arşive girince sonraki TMDB çekimi yazılır.
//
// 🔴 ANLIK AKTARIMI TETİKLEMEZ. Kuyruk, başarılı yazımdan sonra sonuçtaki
// `kaymakId`/`showKaymakId` ile Supabase'e aktarım başlatır
// (`anlikAktarim.yazimSonrasi`). TMDB yazımı kimlik değiştirmez; tetikleseydi
// her afiş MISS'i Worker'a gereksiz bir çağrı olurdu. Bu yüzden kimlik
// `arsivId` adıyla döner.

const { findByExternal } = require('./identity');
const { upsertPayload, readPayload } = require('./store');

const TMDB_AILELERI = new Set(['tv_detail', 'movie_detail']);

/** `/tv/1396` → `{source:'tmdb:show', source_id:'1396'}`; çözülemezse null. */
function tmdbYoldanKimlik(family, path) {
  if (!TMDB_AILELERI.has(family)) return null;
  const m = /^\/(tv|movie)\/(\d+)$/.exec(path || '');
  if (!m) return null;
  const tip = m[1] === 'tv' ? 'show' : 'movie';
  if ((family === 'tv_detail') !== (tip === 'show')) return null;
  return { source: `tmdb:${tip}`, source_id: m[2] };
}

/**
 * Kuyruğun çağırdığı yazıcı (`writer.archiveCatalogResponse` yönlendirir).
 * 🔴 ASLA THROW ETMEZ — arşiv yazımı kullanıcı isteğini rehin alamaz.
 */
async function archiveTmdbDetail({ family, path, data, lang, fetchedAt = Date.now() }) {
  const kimlik = tmdbYoldanKimlik(family, path);
  if (!kimlik) return { ok: false, reason: 'kapsam_disi_aile' };
  if (!data || typeof data !== 'object' || Array.isArray(data) || !Object.keys(data).length) {
    return { ok: false, reason: 'bos_yanit' };
  }
  // Yanıtın kendi kimliği yoldakiyle aynı olmalı — başka yapımın künyesini
  // bir yapıma kalıcı olarak yazmak, arşivde düzelmeyen bir yalan olurdu.
  if (data.id !== undefined && String(data.id) !== kimlik.source_id) {
    return { ok: false, reason: 'yanit_kimligi_uyusmuyor' };
  }
  try {
    const kaymakId = findByExternal(kimlik.source, kimlik.source_id);
    if (!kaymakId) return { ok: false, reason: 'trakt_kimligi_yok' };
    const yazim = await upsertPayload({ kaymakId, provider: 'tmdb', endpoint: family, lang, data, fetchedAt });
    return yazim.ok ? { ok: true, arsivId: kaymakId } : { ok: false, reason: yazim.reason };
  } catch (error) {
    return { ok: false, reason: `tmdb_yazici: ${error.message}` };
  }
}

/** Geri düşüş okuyucusu (`reader.readCatalogFromArchive` yönlendirir). Throw etmez. */
async function readTmdbDetail({ family, path, lang }) {
  const kimlik = tmdbYoldanKimlik(family, path);
  if (!kimlik) return { ok: false, reason: 'kapsam_disi_aile' };
  try {
    const kaymakId = findByExternal(kimlik.source, kimlik.source_id);
    if (!kaymakId) return { ok: false, reason: 'kimlik_bulunamadi' };
    return await readPayload({ kaymakId, provider: 'tmdb', endpoint: family, lang });
  } catch (error) {
    return { ok: false, reason: `tmdb_okuyucu: ${error.message}` };
  }
}

module.exports = { TMDB_AILELERI, tmdbYoldanKimlik, archiveTmdbDetail, readTmdbDetail };
