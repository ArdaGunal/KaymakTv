#!/usr/bin/env node
// ==========================================================================
// A3 KİMLİK ONARIMI — tek seferlik bakım aracı (M552 · dış denetim K-3)
// ==========================================================================
// NEDEN: A1 (M549) yeni birleşmeleri durdurdu; bu araç ESKİLERİ ayırır. Plan ve kararlar:
// `docs/Lazy Down Plan/08_A3_KURU_CALISTIRMA_2026-10-20.md` §6 (S1–S4, 2026-10-20).
// «Arşiv bağı başka yapıma çevrilmez» kuralına TEK SEFERLİK istisna (K1) — yalnız bu araç için.
//
// 🔴 VARSAYILAN KURU. Veritabanı salt okur açılır; yalnız rapor + plan dosyası üretilir.
//    Yazmak için ÜÇÜ BİRDEN gerekir: `--uygula`, kuru koşunun `--plan` dosyası ve raporundaki
//    `--onay <parmak izi>`. Araç planı canlı veriden YENİDEN hesaplar; parmak izi tutmazsa
//    (veri değişmiş) hiçbir şey yazmaz. Yazmadan önce `VACUUM INTO` yedeği alır ve doğrular.
//
// Kullanım (Pi; kök sistemd'deki LAZYFETCH_ROOT ile aynı olmalı — hafıza: pi-script-env-pinning):
//   node scripts/kimlik-onarim.js --trakt                       # kuru + gereken Trakt yanıtlarını çek (~7 istek, S4)
//   node scripts/kimlik-onarim.js --trakt-dosyasi <plan.json>   # kuru, ağsız (önceki yanıtlarla)
//   node scripts/kimlik-onarim.js --uygula --plan <plan.json> --onay <parmak izi>
// Seçenekler: --db <katalog.db> · --yedek-dizini <dizin> · --env <.env> · --plan-cikti <dosya>
//             --g1s-yok (sezon birleşmelerini plana ALMA; 08'de olmayan grup — kullanıcı reddederse)

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const { sorgular, defterOlustur } = require('./kimlik-onarim/defter');
const { planG1, planG2, planG3, planG5 } = require('./kimlik-onarim/plan');
const { planG1s } = require('./kimlik-onarim/sezon');
const { uygula, sayim } = require('./kimlik-onarim/uygula');
const { rapor } = require('./kimlik-onarim/rapor');

const VARSAYILAN_DB = '/mnt/SSD1/KaymakTv/LazyFetch/archive/katalog.db';
const VARSAYILAN_YEDEK = '/mnt/SSD1/KaymakTv/yedek-elle';

function argumanlar(argv) {
  const a = { kuru: true };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const deger = () => argv[++i];
    if (k === '--uygula') a.kuru = false;
    else if (k === '--kuru' || k === '--dry-run') a.kuru = true;
    else if (k === '--trakt') a.trakt = true;
    else if (k === '--g1s-yok') a.g1sYok = true;
    else if (k === '--trakt-dosyasi') a.traktDosyasi = deger();
    else if (k === '--plan') a.plan = deger();
    else if (k === '--onay') a.onay = deger();
    else if (k === '--db') a.db = deger();
    else if (k === '--yedek-dizini') a.yedekDizini = deger();
    else if (k === '--env') a.env = deger();
    else if (k === '--plan-cikti') a.planCikti = deger();
    else throw new Error(`bilinmeyen seçenek: ${k}`);
  }
  a.db = a.db || VARSAYILAN_DB;
  a.yedekDizini = a.yedekDizini || VARSAYILAN_YEDEK;
  return a;
}

/** Trakt istemci kimliği — `.env`'den okunur, ASLA yazdırılmaz. */
function traktAnahtari(envYolu) {
  const adaylar = [envYolu, '/home/GNL/KaymakTv/.env', path.join(__dirname, '..', '.env')].filter(Boolean);
  for (const y of adaylar) {
    if (!fs.existsSync(y)) continue;
    for (const s of fs.readFileSync(y, 'utf8').split(/\r?\n/)) {
      const m = s.match(/^EXPO_PUBLIC_TRAKT_CLIENT_ID=(.*)$/);
      if (m) return m[1].trim().replace(/^["']|["']$/g, '');
    }
  }
  throw new Error('EXPO_PUBLIC_TRAKT_CLIENT_ID bulunamadı (--env ile ver)');
}

/** Tek Trakt GET — IPv4 (Pi'de A+AAAA DNS 5 sn bekletiyor; hafıza: pi-dns-5s-fetch), 20 sn sınır. */
function traktGetir(yol, anahtar) {
  return new Promise((coz, red) => {
    const istek = https.get({
      host: 'api.trakt.tv', path: yol, family: 4, timeout: 20000,
      headers: { 'content-type': 'application/json', 'trakt-api-version': '2', 'trakt-api-key': anahtar, 'user-agent': 'KaymakTV-kimlik-onarim' },
    }, (y) => {
      let b = '';
      y.setEncoding('utf8');
      y.on('data', (p) => { b += p; });
      y.on('end', () => {
        if (y.statusCode === 200) { try { coz({ govde: JSON.parse(b), fetched_at: Date.now() }); } catch (e) { red(e); } }
        else if (y.statusCode === 404) coz({ govde: null, durum: 404, fetched_at: Date.now() });
        else red(new Error(`Trakt ${y.statusCode}: ${yol}`));
      });
    });
    istek.on('timeout', () => istek.destroy(new Error(`Trakt zaman aşımı: ${yol}`)));
    istek.on('error', red);
  });
}

function planla(db, dbYolu, yanitlar, { g1sYok = false } = {}) {
  const q = sorgular(db);
  const d = defterOlustur(q);
  const kullanilan = {};
  const gerekli = [];
  const trakt = (yol) => {
    // 404 de bir yanıttır (`govde: null`) — çağıran «yok» ile «henüz çekilmedi»yi ayırır.
    if (Object.prototype.hasOwnProperty.call(yanitlar, yol)) { kullanilan[yol] = yanitlar[yol]; return yanitlar[yol]; }
    gerekli.push(yol);
    return null;
  };
  const once = sayim(db);
  // G1s ÖNCE: G1'in hedef sezonları ancak sezon birleşmeleri ayrılınca bulunur (sezon.js başlığı).
  const g1s = g1sYok ? [] : planG1s(db, q, d);
  const gruplar = { g1s, g1: planG1(db, q, d), g2: planG2(db, q, d, trakt), g3: planG3(db, q, d, trakt), g5: planG5(db, q, d) };
  const g1sCozulen = g1s.filter((k) => k.durum === 'ayrilir').length;
  const g1Cozulen = gruplar.g1.filter((k) => k.durum === 'temiz_ayrilir' || k.durum === 'hedef_dolu').length;
  const g2Cozulen = gruplar.g2.filter((k) => k.tasinan.some((x) => x.startsWith('trakt:show='))).length;
  const plan = {
    surum: 1, uretildi: new Date().toISOString(), db: dbYolu,
    eylemler: d.eylemler, trakt: kullanilan, gruplar, uyarilar: d.uyarilar,
    beklenen: { cokluTraktBolum: once.cokluTraktBolum - g1Cozulen, cokluTraktDizi: once.cokluTraktDizi - g2Cozulen, cokluTraktSezon: once.cokluTraktSezon - g1sCozulen },
    secenek: { g1sYok },
  };
  plan.parmakIzi = crypto.createHash('sha256').update(JSON.stringify({ e: plan.eylemler, t: plan.trakt, b: plan.beklenen })).digest('hex').slice(0, 16);
  plan.ekBulgu = sezonKaymasi(db);
  return { plan, once, gerekli: [...new Set(gerekli)] };
}

/**
 * EK BULGU (kapsam DIŞI, yalnız sayılır): ebeveyn sezonuyla numarası uyuşmayan bölümler. 2026-10-20
 * kuru koşusunda WWE Raw'da görüldü (Trakt yeniden numaralamış, arşivde eski sezona yığılmış).
 */
function sezonKaymasi(db) {
  const r = db.prepare(`SELECT COUNT(*) bolum, COUNT(DISTINCT p.kaymak_id) sezon, COUNT(DISTINCT p.parent_id) dizi
    FROM entities c JOIN entities p ON p.kaymak_id = c.parent_id
    WHERE c.type = 'episode' AND p.type = 'season' AND c.season_number <> p.season_number`).get();
  const ornek = db.prepare(`SELECT s.title dizi, p.season_number sezon, p.title sezonAdi, GROUP_CONCAT(DISTINCT c.season_number) cocukNo, COUNT(*) n
    FROM entities c JOIN entities p ON p.kaymak_id = c.parent_id JOIN entities s ON s.kaymak_id = p.parent_id
    WHERE c.type = 'episode' AND p.type = 'season' AND c.season_number <> p.season_number
    GROUP BY p.kaymak_id ORDER BY n DESC LIMIT 12`).all();
  return { ...r, ornek };
}

function yedekAl(db, dizin, etiket) {
  fs.mkdirSync(dizin, { recursive: true });
  const hedef = path.join(dizin, `elle-a3-${etiket}-${new Date().toISOString().replace(/[:.]/g, '-')}.db`);
  db.prepare('VACUUM INTO ?').run(hedef);
  const y = new DatabaseSync(hedef, { readOnly: true });
  const butunluk = y.prepare('PRAGMA integrity_check').get();
  const s = sayim(y);
  y.close();
  if (Object.values(butunluk)[0] !== 'ok') throw new Error(`yedek bütünlük denetimi geçmedi: ${JSON.stringify(butunluk)}`);
  return { hedef, sayim: s };
}

async function main() {
  const a = argumanlar(process.argv.slice(2));
  if (!fs.existsSync(a.db)) throw new Error(`veritabanı yok: ${a.db}`);

  if (a.kuru) {
    const db = new DatabaseSync(a.db, { readOnly: true });
    let yanitlar = {};
    if (a.traktDosyasi) yanitlar = JSON.parse(fs.readFileSync(a.traktDosyasi, 'utf8')).trakt || {};
    let { plan, once, gerekli } = planla(db, a.db, yanitlar, a);
    let yeniIstek = 0;
    if (gerekli.length && a.trakt) {
      const anahtar = traktAnahtari(a.env);
      for (const yol of gerekli) {
        yanitlar[yol] = await traktGetir(yol, anahtar);
        yeniIstek++;
        await new Promise((r) => setTimeout(r, 700));
      }
      ({ plan, once, gerekli } = planla(db, a.db, yanitlar, a));
    }
    db.close();
    plan.yeniIstek = yeniIstek;
    const cikti = a.planCikti || path.join(a.yedekDizini, `a3-plan-${plan.parmakIzi}.json`);
    fs.mkdirSync(path.dirname(cikti), { recursive: true });
    fs.writeFileSync(cikti, JSON.stringify(plan));
    console.log(rapor(plan, once));
    if (gerekli.length) console.log(`\n⏳ Trakt yanıtı bekleyen ${gerekli.length} istek (G2/G3 eksik): --trakt ile yeniden koş.\n   ${gerekli.join('\n   ')}`);
    console.log(`\nplan dosyası: ${cikti}`);
    return;
  }

  // ── UYGULA ────────────────────────────────────────────────────────────────────────────────────
  if (!a.plan || !a.onay) throw new Error('--uygula için --plan <dosya> ve --onay <parmak izi> zorunlu');
  const kayitli = JSON.parse(fs.readFileSync(a.plan, 'utf8'));
  if (kayitli.parmakIzi !== a.onay) throw new Error(`--onay (${a.onay}) plan dosyasının parmak iziyle (${kayitli.parmakIzi}) aynı değil`);
  const db = new DatabaseSync(a.db);
  try {
    const { plan, gerekli } = planla(db, a.db, kayitli.trakt || {}, kayitli.secenek || {});
    if (gerekli.length) throw new Error(`plan dosyasında olmayan Trakt yanıtı gerekiyor: ${gerekli.join(', ')}`);
    if (plan.parmakIzi !== a.onay) throw new Error(`canlı veriden yeniden hesaplanan plan (${plan.parmakIzi}) onaylanandan (${a.onay}) farklı — veri değişmiş; yeniden kuru koş, raporu yeniden onayla. HİÇBİR ŞEY YAZILMADI.`);
    const yedek = yedekAl(db, a.yedekDizini, 'oncesi');
    console.log(`yedek: ${yedek.hedef} (bütünlük ok) ${JSON.stringify(yedek.sayim)}`);
    const { once, sonra } = uygula(db, plan);
    console.log(`UYGULANDI plan=${plan.parmakIzi}\n  önce  ${JSON.stringify(once)}\n  sonra ${JSON.stringify(sonra)}`);
    console.log(`  quick_check: ${JSON.stringify(db.prepare('PRAGMA quick_check').get())}`);
  } finally {
    db.close();
  }
}

module.exports = { planla, yedekAl };

if (require.main === module) main().catch((e) => { console.error(`❌ ${e.message}`); process.exit(1); });
