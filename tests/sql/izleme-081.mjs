// 081 + 082 yerel sınaması — geçici Docker PostgreSQL üzerinde. Canlıya DOKUNMAZ.
// Çalıştırıcı: bash tests/sql/izleme-081.sh (kapsayıcıyı o açar, adını KAP ortam değişkeniyle verir).
//
// Ne sınanır:
//   1. ÖNCE (075) → SONRA (081): eski alanlar her hesapta, her dizide BİREBİR aynı.
//   2. EŞLİK: 081 RPC'si ile Worker'ın dar yolu (`lib/ilerleme.js`) aynı veriden aynı sonucu verir.
//   3. Kabul #1 (40 dk × 3 → 3x, 120 dk) ve sezon 0'ın süreye girmesi.
//   4. 082: her izleme kendi ayına (Europe/Istanbul, ay sınırı dahil); geçersiz dilim → UTC; ters aralık → boş.
//   5. Yetki: anon / authenticated çalıştıramaz, service_role çalıştırır. İki kez uygulanabilir.
//   6. Süre: ağır hesap (canlı dağılımına benzer, ~15 bin satır) önce/sonra EXPLAIN ANALYZE.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { diziIlerlemesi } from "../../../kaymaktv-feedback-worker/src/lib/ilerleme.js";
import { izlemeleriTopla } from "../../../kaymaktv-feedback-worker/src/routes/librarySync.js";

const KAP = process.env.KAP;
if (!KAP) throw new Error("KAP (kapsayıcı adı) yok — izleme-081.sh ile çalıştır");
const psql = (sql, ekler = []) =>
  execFileSync("docker", ["exec", "-i", KAP, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q", "-At", ...ekler], { input: sql, encoding: "utf8", maxBuffer: 1 << 28 });
const json = (sql) => JSON.parse(psql(`SELECT COALESCE(json_agg(t), '[]') FROM (${sql}) t;`) || "[]");

let kaldi = 0, gecti = 0;
const kontrol = (ad, kosul, ayrinti = "") => {
  if (kosul) { gecti++; console.log(`TAMAM ${ad}`); } else { kaldi++; console.log(`KALDI ${ad} ${ayrinti}`); }
};

// ── Veri: tohumlu, canlı dağılımına benzer (8 hesap, en ağırı ~15 bin satır, tekrar ≤ 9) ──
let tohum = 81;
const rast = () => ((tohum = (tohum * 1103515245 + 12345) % 2147483648) / 2147483648);
const DIZI = 300, FILM = 150;
const katalog = [], dis = [], izleme = [];
for (let d = 1; d <= DIZI; d++) {
  const diziRt = d % 17 === 0 ? null : 20 + (d % 40);
  katalog.push([`show_${d}`, "show", null, null, null, `Dizi ${d}`, null, diziRt]);
  dis.push([`show_${d}`, "trakt:show", String(1000 + d)]);
  for (let s = 0; s <= 3; s++) {
    katalog.push([`season_${d}_${s}`, "season", `show_${d}`, s, null, null, null, null]);
    for (let e = 1; e <= (s === 0 ? 3 : 12); e++) {
      const tarih = (d + e) % 23 === 0 ? null : (s === 3 && e > 10 ? "2027-06-01T00:00:00Z" : `2023-0${1 + (e % 9)}-1${s}T00:00:00Z`);
      const rt = (d * e) % 11 === 0 ? null : 20 + ((d + e) % 35);
      katalog.push([`episode_${d}_${s}_${e}`, "episode", `season_${d}_${s}`, s, e, `B${e}`, tarih, rt]);
    }
  }
}
for (let f = 1; f <= FILM; f++) {
  katalog.push([`movie_${f}`, "movie", null, null, null, `Film ${f}`, null, f % 13 === 0 ? null : 80 + (f % 70)]);
  dis.push([`movie_${f}`, "trakt:movie", String(5000 + f)]);
}
const KULLANICI = Array.from({ length: 8 }, (_, i) => `aaaaaaaa-0000-4000-8000-00000000000${i}`);
const AGIR = KULLANICI[0];
const damga = (ms) => new Date(ms).toISOString();
const BAS = Date.parse("2024-01-01T00:00:00Z"), ARALIK = Date.parse("2026-10-31T00:00:00Z") - BAS;
for (const [k, u] of KULLANICI.entries()) {
  const oran = [0.95, 0.4, 0.2, 0.1, 0.05, 0.02, 0.005, 0][k];
  for (const satir of katalog) {
    if ((satir[1] !== "episode" && satir[1] !== "movie") || rast() >= oran) continue;
    const adet = rast() < 0.12 ? 2 + Math.floor(rast() * 8) : 1;
    for (let i = 0; i < adet; i++) izleme.push([u, satir[0], damga(BAS + Math.floor(rast() * ARALIK) + i)]);
  }
}
// Kabul #1 ve ay sınırı: hesap 7 yalnız bunları izler.
const K7 = KULLANICI[7];
katalog.push(["show_kabul", "show", null, null, null, "Kabul", null, 40], ["season_kabul_0", "season", "show_kabul", 0, null, null, null, null],
  ["season_kabul_1", "season", "show_kabul", 1, null, null, null, null],
  ["episode_kabul_0_1", "episode", "season_kabul_0", 0, 1, "Özel", "2023-01-01T00:00:00Z", 15],
  ["episode_kabul_1_1", "episode", "season_kabul_1", 1, 1, "B1", "2023-01-01T00:00:00Z", 40],
  ["episode_kabul_1_2", "episode", "season_kabul_1", 1, 2, "B2", "2023-01-01T00:00:00Z", 40]);
dis.push(["show_kabul", "trakt:show", "999"]);
izleme.push([K7, "episode_kabul_1_1", "2026-01-31T22:30:00Z"], [K7, "episode_kabul_1_1", "2026-11-03T10:00:00Z"],
  [K7, "episode_kabul_1_1", "2026-11-04T10:00:00Z"], [K7, "episode_kabul_0_1", "2026-03-01T10:00:00Z"],
  [K7, "movie_1", "2026-01-10T10:00:00Z"], [K7, "movie_1", "2026-11-10T10:00:00Z"]);

const q = (v) => (v === null ? "NULL" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const toplu = (tablo, kolonlar, satirlar) => {
  let sql = "";
  for (let i = 0; i < satirlar.length; i += 2000) {
    sql += `INSERT INTO ${tablo} (${kolonlar}) VALUES ${satirlar.slice(i, i + 2000).map((r) => `(${r.map(q).join(",")})`).join(",")};\n`;
  }
  return sql;
};

// ── Şema: yalnız işlevlerin dokunduğu tablolar ve kolonlar ──
psql(`
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;
CREATE TABLE users (id uuid PRIMARY KEY);
CREATE TABLE catalog_entities (kaymak_id text PRIMARY KEY, type text NOT NULL, parent_id text, season_number int, episode_number int,
  title text, first_aired timestamptz, runtime int, year int, tmdb_id bigint, genres text[], original_language text, original_title text, titles jsonb);
CREATE INDEX idx_catalog_entities_parent ON catalog_entities (parent_id);
CREATE TABLE catalog_external_ids (kaymak_id text, source text, source_id text, retired_at timestamptz, PRIMARY KEY (source, source_id));
CREATE TABLE user_watched (user_id uuid, kaymak_id text, watched_at timestamptz, PRIMARY KEY (user_id, kaymak_id, watched_at));
${toplu("users", "id", KULLANICI.map((u) => [u]))}
${toplu("catalog_entities", "kaymak_id,type,parent_id,season_number,episode_number,title,first_aired,runtime", katalog)}
${toplu("catalog_external_ids", "kaymak_id,source,source_id", dis)}
${toplu("user_watched", "user_id,kaymak_id,watched_at", izleme)}
ANALYZE;`);

const kaynak = (f) => readFileSync(new URL(`../../supabase/schema/${f}`, import.meta.url), "utf8");
const g075 = kaynak("075_library_ozel_plan.sql");
const bas = g075.indexOf("CREATE OR REPLACE FUNCTION public.library_sync_diziler");
const sonIfade = "GRANT EXECUTE ON FUNCTION public.library_sync_diziler(UUID) TO service_role;";
psql(g075.slice(bas, g075.indexOf(sonIfade) + sonIfade.length));

const oku = () => Object.fromEntries(KULLANICI.map((u) => [u, json(`SELECT dizi_id, ilerleme FROM library_sync_diziler('${u}') ORDER BY dizi_id`)]));
const sure = (fn) => Number(/Execution Time: ([\d.]+)/.exec(psql(`EXPLAIN (ANALYZE) SELECT * FROM ${fn};`))?.[1] ?? NaN);
const once = oku();
const onceMs = Math.min(...[1, 2, 3].map(() => sure(`library_sync_diziler('${AGIR}')`)));

psql(kaynak("081_izleme_sayisi.sql"));
psql(kaynak("081_izleme_sayisi.sql"));
psql(kaynak("082_izleme_donemleri.sql"));
psql(kaynak("082_izleme_donemleri.sql"));
const sonra = oku();
const sonraMs = Math.min(...[1, 2, 3].map(() => sure(`library_sync_diziler('${AGIR}')`)));

// ── 1) Eski alanlar birebir ──
const YENI = ["play_minutes", "rewatch_plays", "estimated_plays", "unknown_plays"];
const eskiyeIndir = (il) => {
  const k = { ...il };
  for (const a of YENI) delete k[a];
  k.seasons = (il.seasons || []).map((s) => ({ ...s, episodes: s.episodes.map(({ plays, ...b }) => b) }));
  return JSON.stringify(k);
};
let fark = 0, dizi = 0;
for (const u of KULLANICI) {
  kontrol(`satir sayisi ayni ${u.slice(-2)}`, once[u].length === sonra[u].length, `${once[u].length} → ${sonra[u].length}`);
  sonra[u].forEach((r, i) => { dizi++; if (eskiyeIndir(r.ilerleme) !== JSON.stringify(once[u][i]?.ilerleme)) fark++; });
}
kontrol(`eski alanlar birebir (${dizi} dizi)`, fark === 0, `${fark} farkli`);

// ── 2) Eşlik: Worker dar yolu = RPC ──
const bolumler = new Map();
const ebeveyn = new Map(katalog.map((r) => [r[0], r]));
for (const r of katalog) {
  if (r[1] !== "episode") continue;
  const dizi = ebeveyn.get(r[2])[2];
  if (!bolumler.has(dizi)) bolumler.set(dizi, []);
  bolumler.get(dizi).push({ kaymakId: r[0], seasonNumber: r[3], episodeNumber: r[4], title: r[5], firstAired: r[6], runtime: r[7] });
}
const zaman = (v) => (typeof v === "string" && /^\d{4}-\d\d-\d\dT/.test(v) ? Date.parse(v) : v);
// jsonb anahtarları kendi sırasıyla döndürür: karşılaştırma anahtar sırasından bağımsız.
const sirala = (v) => (v && typeof v === "object" && !Array.isArray(v)
  ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sirala(v[k])])) : Array.isArray(v) ? v.map(sirala) : zaman(v));
const duz = (o) => JSON.stringify(sirala(o));
let esFark = 0, esToplam = 0, ilkFark = "";
for (const u of KULLANICI) {
  const harita = izlemeleriTopla(izleme.filter((r) => r[0] === u).map(([, kaymak_id, watched_at]) => ({ kaymak_id, watched_at })));
  for (const r of sonra[u]) {
    esToplam++;
    const js = diziIlerlemesi(bolumler.get(r.dizi_id), harita, Date.now(), ebeveyn.get(r.dizi_id)[7]);
    const sql = r.ilerleme;
    const alanlar = ["aired", "completed", "last_watched_at", "next_episode", "last_episode", "watched_minutes", ...YENI, "seasons"];
    const farkli = alanlar.filter((a) => duz(js[a] ?? null) !== duz(sql[a] ?? null));
    if (farkli.length) {
      esFark++;
      ilkFark ||= `${r.dizi_id}: ${farkli.join(",")} JS=${duz(js[farkli[0]]).slice(0, 200)} SQL=${duz(sql[farkli[0]]).slice(0, 200)}`;
    }
  }
}
kontrol(`Worker dar yolu = RPC (${esToplam} dizi)`, esFark === 0, `${esFark} farkli · ilk ${ilkFark}`);

// ── 3) Kabul #1 + sezon 0 ──
const kabul = sonra[K7].find((r) => r.dizi_id === "show_kabul")?.ilerleme;
const s1 = kabul?.seasons.find((s) => s.number === 1);
kontrol("kabul #1: 3x, 120+15 dk, 1 tekil, 2 tekrar", s1?.episodes[0].plays === 3 && s1?.episodes[1].plays === 0
  && kabul.completed === 1 && kabul.play_minutes === 135 && kabul.rewatch_plays === 2 && kabul.watched_minutes === 40, JSON.stringify(kabul && { ...kabul, seasons: undefined }));

// ── 4) 082 ──
const donem = (u, tz, b = "2020-01-01", s = "2027-12-31") =>
  json(`SELECT donem, tur, izleme, dakika, tahmini, bilinmeyen FROM library_izleme_donemleri('${u}', ${q(tz)}, ${q(b)}, ${q(s)})`);
const ist = donem(K7, "Europe/Istanbul");
const bul = (r, d, t) => r.find((x) => x.donem === d && x.tur === t);
kontrol("082: ay siniri Istanbul'da subata duser", bul(ist, "2026-02", "episode")?.izleme === 1 && !bul(ist, "2026-01", "episode"), JSON.stringify(ist));
kontrol("082: kasimda 2 bolum izlemesi 80 dk", bul(ist, "2026-11", "episode")?.izleme === 2 && bul(ist, "2026-11", "episode")?.dakika === 80);
kontrol("082: film ocak ve kasimda ayri", bul(ist, "2026-01", "movie")?.izleme === 1 && bul(ist, "2026-11", "movie")?.izleme === 1);
const utc = donem(K7, "UTC");
kontrol("082: UTC'de ay siniri ocakta kalir", bul(utc, "2026-01", "episode")?.izleme === 1);
for (const kotu of ["UTC+3", "Foo/Bar", "'; DROP TABLE users; --", null]) {
  kontrol(`082: gecersiz dilim UTC'ye duser: ${kotu}`, duz(donem(K7, kotu)) === duz(utc));
}
kontrol("082: ters aralik bos", donem(K7, "UTC", "2027-01-01", "2026-01-01").length === 0);
kontrol("082: 10 yildan uzun aralik bos", donem(K7, "UTC", "2000-01-01", "2027-01-01").length === 0);
// Ağır hesap: bütün olaylar sayılır ve dakika JS kuralıyla aynı.
const ayAnahtari = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit" });
const beklenen = new Map();
for (const [u, k, w] of izleme) {
  if (u !== AGIR) continue;
  const e = ebeveyn.get(k);
  const ort = e[1] === "episode" ? ebeveyn.get(ebeveyn.get(e[2])[2])[7] : null;
  const anahtar = `${ayAnahtari.format(new Date(w)).slice(0, 7)}|${e[1]}`;
  const b = beklenen.get(anahtar) || { izleme: 0, dakika: 0 };
  b.izleme++; b.dakika += e[7] ?? ort ?? 0;
  beklenen.set(anahtar, b);
}
const agir = donem(AGIR, "Europe/Istanbul");
const agirFark = agir.filter((r) => { const b = beklenen.get(`${r.donem}|${r.tur}`); return !b || b.izleme !== r.izleme || b.dakika !== r.dakika; }).length;
kontrol(`082: agir hesap ${agir.length} ay/tur JS ile ayni`, agirFark === 0 && agir.length === beklenen.size, `${agirFark} farkli`);
const donemMs = Math.min(...[1, 2, 3].map(() => sure(`library_izleme_donemleri('${AGIR}', 'Europe/Istanbul', now() - interval '12 months', now())`)));

// ── 5) Yetki + biçim ──
const yetki = json(`SELECT p.proname, l.lanname, p.prosecdef, p.proconfig::text AS ayar,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon, has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth,
  has_function_privilege('service_role', p.oid, 'EXECUTE') AS servis
  FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang WHERE p.proname IN ('library_sync_diziler', 'library_izleme_donemleri')`);
for (const y of yetki) {
  kontrol(`yetki + plpgsql + ozel plan: ${y.proname}`, y.lanname === "plpgsql" && y.prosecdef && !y.anon && !y.auth && y.servis
    && y.ayar.includes("plan_cache_mode=force_custom_plan") && y.ayar.includes("search_path=public"), JSON.stringify(y));
}
kontrol("iki islev de var", yetki.length === 2);

console.log(`SURE agir hesap (${izleme.filter((r) => r[0] === AGIR).length} satir): 075 ${onceMs} ms -> 081 ${sonraMs} ms · 082 (12 ay) ${donemMs} ms`);
console.log(`OZET ${gecti} gecti / ${kaldi} kaldi`);
process.exit(kaldi ? 1 : 0);
