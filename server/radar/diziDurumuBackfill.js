const { gunzip } = require('node:zlib');
const { promisify } = require('node:util');
const { openReadOnly, transactionAsync } = require('../archive/db');
const { diziDurumunuYaz } = require('../archive/diziDurumu');

const ac = promisify(gunzip);
const ARSIV_DILIMI = 40;
const TAKIP_DILIMI = 4;
const TUR_BASINA_ARSIV_DILIMI = 10;
const MAKS_PAYLOAD = 1024 * 1024;
const IMLEC = 'k54_dizi_durum_arsiv_imleci';
const TAKIP_IMLEC = 'k54_dizi_durum_takip_imleci';
const BITTI = 'k54_dizi_durum_backfill_bitti';
const AYNALANDI = 'k54_dizi_durum_backfill_aynalandi';

function durumOku(db, anahtar) {
  return db.prepare('SELECT value FROM meta WHERE key=?').get(anahtar)?.value;
}
function durumYaz(db, anahtar, deger) {
  db.prepare('INSERT INTO meta(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    .run(anahtar, String(deger));
}

async function arsivDiliminiOku(db, imlec) {
  const adaylar = db.prepare(`
    SELECT kaymak_id FROM entities WHERE type='show' AND kaymak_id>?
    ORDER BY kaymak_id LIMIT ?
  `).all(imlec, ARSIV_DILIMI);
  const yukleriOku = db.prepare(`
    SELECT provider, endpoint, fetched_at, body FROM payloads
    WHERE kaymak_id=? AND bytes_raw<=? AND
      ((provider='trakt' AND endpoint='show_detail') OR (provider='tmdb' AND endpoint='tv_detail'))
    ORDER BY fetched_at, provider DESC, lang
  `);

  const gozlemler = [];
  for (const { kaymak_id: kaymakId } of adaylar) {
    for (const { provider, endpoint, fetched_at: fetchedAt, body } of yukleriOku.all(kaymakId, MAKS_PAYLOAD)) {
      try {
        const hamDurum = JSON.parse(await ac(body, { maxOutputLength: MAKS_PAYLOAD }))?.status;
        if (typeof hamDurum === 'string') gozlemler.push({ kaymakId, provider, endpoint, fetchedAt, hamDurum });
      } catch { /* Bozuk yük, arşivdeki diğer sağlayıcıyı veya Radar'ı engellemez. */ }
    }
  }

  return {
    imlec: adaylar.length < ARSIV_DILIMI ? 'bitti' : adaylar.at(-1).kaymak_id,
    taranan: adaylar.length,
    gozlemler,
  };
}

function takipleriSirala(db, imlec, simdi) {
  const eksikler = db.prepare(`
    SELECT t.trakt_id FROM radar_takip t
    LEFT JOIN external_ids x ON x.source='trakt:show' AND x.source_id=CAST(t.trakt_id AS TEXT) AND x.retired_at IS NULL
    LEFT JOIN entities e ON e.kaymak_id=x.kaymak_id AND e.type='show'
    WHERE t.tur='show' AND t.trakt_id>?
      AND (e.yayin_durumu IS NULL OR e.yayin_durumu='bilinmiyor')
    ORDER BY t.trakt_id LIMIT ?
  `).all(imlec, TAKIP_DILIMI);
  const ekle = db.prepare(`
    INSERT INTO radar_is(tur,trakt_id,oncelik,hazir_at) VALUES ('show',?,0,?)
    ON CONFLICT(tur,trakt_id) DO UPDATE SET oncelik=0, hazir_at=excluded.hazir_at, deneme=0, terk=0
    WHERE radar_is.terk=1
  `);
  let kuyrugaAlinan = 0;
  for (const { trakt_id } of eksikler) kuyrugaAlinan += Number(ekle.run(trakt_id, simdi).changes);
  return { eksikler, kuyrugaAlinan };
}

async function diziDurumuBackfillTuru(simdi = Date.now(), takipHazir = false) {
  const baglanti = openReadOnly();
  if (!baglanti) return null;
  let imlec;
  let dilim;
  try {
    const { db } = baglanti;
    if (durumOku(db, BITTI)) return null;
    imlec = durumOku(db, IMLEC);
    // Açık yazım işlemlerinin henüz commit edilmemiş yüklerini okuma.
    if (imlec !== 'bitti') dilim = await arsivDiliminiOku(db, imlec ?? '');
  } finally {
    baglanti.db.close();
  }
  if (dilim) {
    return transactionAsync((h) => {
      if (durumOku(h, IMLEC) !== imlec) return { bekliyor: true };
      const degisen = new Set();
      for (const gozlem of dilim.gozlemler) {
        if (diziDurumunuYaz(h, gozlem, simdi)) degisen.add(gozlem.kaymakId);
      }
      durumYaz(h, IMLEC, dilim.imlec);
      return { asama: 'arsiv', taranan: dilim.taranan, degisen: degisen.size };
    });
  }

  // Eski veya henüz gelmemiş bir takip görüntüsü imleci ilerletmez.
  if (!takipHazir) return { bekliyor: true };
  return transactionAsync((db) => {
    if (durumOku(db, BITTI)) return null;
    const sonuc = takipleriSirala(db, Number(durumOku(db, TAKIP_IMLEC) ?? 0), simdi);
    if (sonuc.eksikler.length) {
      durumYaz(db, TAKIP_IMLEC, sonuc.eksikler.at(-1).trakt_id);
    }
    const bitti = sonuc.eksikler.length < TAKIP_DILIMI;
    if (bitti) durumYaz(db, BITTI, simdi);
    return { asama: 'takip', siralanan: sonuc.kuyrugaAlinan, bitti };
  });
}

// Katalogda ağsız çalışılan kısa SQLite dilimlerini mevcut Radar turunda
// birlikte yürüt. Takip aşaması her turda yine en fazla dört iş ekler.
async function diziDurumuBackfillAdimi(simdi, takipHazir) {
  let taranan = 0;
  let degisen = 0;
  for (let i = 0; i < TUR_BASINA_ARSIV_DILIMI; i++) {
    const sonuc = await diziDurumuBackfillTuru(simdi, takipHazir);
    if (sonuc?.asama !== 'arsiv') {
      return taranan ? { ...sonuc, asama: sonuc?.asama ?? 'arsiv', taranan, degisen } : sonuc;
    }
    taranan += sonuc.taranan;
    degisen += sonuc.degisen;
  }
  return { asama: 'arsiv', taranan, degisen };
}

// Tamamlanan backfill'in artımlı aynasını servis içindeki mevcut ayna
// kilidiyle gönder. Başarıdan önce çökülürse sonraki Radar turu tekrarlar.
async function diziDurumuBackfillAynala({ aynala, simdi = Date.now() }) {
  const baglanti = openReadOnly();
  if (!baglanti) return null;
  try {
    if (!durumOku(baglanti.db, BITTI)) return null;
    if (durumOku(baglanti.db, AYNALANDI)) return { bitti: true };
  } finally {
    baglanti.db.close();
  }
  const sonuc = await (aynala ?? require('../archive/mirror').runMirror)();
  if (!sonuc.ok || !sonuc.tamamlandi) return { bitti: false, neden: sonuc.reason ?? 'ayna_tamamlanmadi' };
  await transactionAsync((db) => durumYaz(db, AYNALANDI, simdi));
  return { bitti: true, yazilan: sonuc.yazilan, atlanan: sonuc.atlanan };
}

module.exports = { diziDurumuBackfillTuru, diziDurumuBackfillAdimi, diziDurumuBackfillAynala };
