// Yalnız M449 geçici konteyneri; gerçek PostgreSQL'de iki ayrı oturum yarışı.
import { execFileSync, spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const container = 'kaymak-m449-postgres';
const label = execFileSync('docker', ['inspect', '--format', '{{index .Config.Labels "kaymak.test"}}', container], { encoding: 'utf8' }).trim();
assert.equal(label, 'M449', 'Başka konteynere dokunulmaz');
const args = ['exec', container, 'psql', '-U', 'postgres', '-d', 'kaymak_m449_test', '-v', 'ON_ERROR_STOP=1', '-At', '-c'];
const sql = (query) => execFileSync('docker', [...args, query], { encoding: 'utf8', timeout: 15000 }).trim();
assert.equal(sql('SELECT current_database()'), 'kaymak_m449_test');
function session(query) {
  const process = spawn('docker', [...args, query], { windowsHide: true });
  let out = '', err = '', ready;
  const locked = new Promise((resolve) => { ready = resolve; });
  process.stdout.on('data', (b) => { out += b; });
  process.stderr.on('data', (b) => { err += b; if (err.includes('M449_LOCKED')) ready(); });
  const timer = setTimeout(() => process.kill(), 15000);
  const done = new Promise((resolve, reject) => {
    process.on('error', reject);
    process.on('close', (code) => {
      clearTimeout(timer);
      ready();
      if (code !== 0) reject(new Error(`SQL session failed: ${err}`));
      else resolve(out);
    });
  });
  return { locked, done };
}
sql("INSERT INTO catalog_entities VALUES ('movie_race','movie',null,null,null); INSERT INTO catalog_external_ids VALUES ('trakt:movie','999','movie_race');");
for (const [i, first] of ['publish', 'delete'].entries()) {
  const uid = `33333333-3333-3333-3333-33333333333${i}`;
  const date = '2026-10-01T12:00:00Z';
  sql(`INSERT INTO users VALUES ('${uid}'); INSERT INTO user_watched VALUES ('${uid}','movie_race','${date}');`);
  const publish = `INSERT INTO feed_activities(user_id,activity_type,show_id,media_type,activity_at) VALUES ('${uid}','watched_movie',999,'movie','${date}');`;
  const retract = `SELECT delete_watched_with_feed('${uid}',ARRAY['movie_race'],true);`;
  const firstSession = session(`BEGIN; SET LOCAL lock_timeout='5s'; ${first === 'publish' ? publish : retract} DO $$ BEGIN RAISE NOTICE 'M449_LOCKED'; END $$; SELECT pg_sleep(1); COMMIT;`);
  await firstSession.locked;
  const secondSession = session(`SET lock_timeout='5s'; ${first === 'publish' ? retract : publish}`);
  await Promise.all([firstSession.done, secondSession.done]);
  assert.equal(sql(`SELECT count(*) FROM user_watched WHERE user_id='${uid}'`), '0');
  assert.equal(sql(`SELECT count(*) FROM feed_activities WHERE user_id='${uid}' AND in_feed AND is_visible`), '0');
  console.log(`PASS: ${first} önce kilidi alınca diğer uç bekler; eski olay geri gelmez`);
}
