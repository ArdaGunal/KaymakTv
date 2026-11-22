module.exports = `
CREATE TABLE IF NOT EXISTS radar_takip (
  tur TEXT NOT NULL, trakt_id INTEGER NOT NULL, tmdb_id INTEGER, takipci INTEGER NOT NULL,
  PRIMARY KEY (tur, trakt_id)
) STRICT;
CREATE INDEX IF NOT EXISTS radar_takip_tmdb ON radar_takip(tur, tmdb_id);

CREATE TABLE IF NOT EXISTS radar_imlec (
  akis TEXT PRIMARY KEY, at INTEGER NOT NULL, telafi_son_id INTEGER
) STRICT;

CREATE TABLE IF NOT EXISTS radar_is (
  tur TEXT NOT NULL, trakt_id INTEGER NOT NULL, oncelik INTEGER NOT NULL,
  hazir_at INTEGER NOT NULL, deneme INTEGER NOT NULL DEFAULT 0, terk INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tur, trakt_id)
) STRICT;
CREATE INDEX IF NOT EXISTS radar_is_hazir ON radar_is(hazir_at, oncelik, trakt_id);

CREATE TABLE IF NOT EXISTS radar_takvim (
  tur TEXT NOT NULL, trakt_id INTEGER NOT NULL, kaymak_id TEXT NOT NULL UNIQUE,
  takvim_rev INTEGER NOT NULL, kaynak_at INTEGER NOT NULL DEFAULT 0, aynalanan_rev INTEGER NOT NULL DEFAULT 0,
  ayna_bekliyor INTEGER NOT NULL DEFAULT 1, ayna_hazir_at INTEGER NOT NULL,
  ayna_deneme INTEGER NOT NULL DEFAULT 0, veri TEXT NOT NULL, takipsiz_at INTEGER,
  PRIMARY KEY (tur, trakt_id)
) STRICT;
CREATE INDEX IF NOT EXISTS radar_ayna_hazir ON radar_takvim(ayna_bekliyor, ayna_hazir_at);

CREATE TABLE IF NOT EXISTS radar_ayna_giden (
  tur TEXT NOT NULL, trakt_id INTEGER NOT NULL, takvim_rev INTEGER NOT NULL,
  veri TEXT, terk INTEGER NOT NULL DEFAULT 0, deneme INTEGER NOT NULL DEFAULT 0,
  cakisma_deneme INTEGER NOT NULL DEFAULT 0, hazir_at INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tur, trakt_id)
) STRICT;

CREATE TABLE IF NOT EXISTS radar_giden (
  id INTEGER PRIMARY KEY, olay_anahtari TEXT NOT NULL UNIQUE, icerik_tur TEXT NOT NULL,
  trakt_id INTEGER NOT NULL, takvim_rev INTEGER NOT NULL, olay TEXT NOT NULL, terk INTEGER NOT NULL DEFAULT 0
) STRICT;

CREATE TABLE IF NOT EXISTS radar_durum (anahtar TEXT PRIMARY KEY, deger TEXT NOT NULL) STRICT;
`;
