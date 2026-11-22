const assert = require('node:assert/strict');
const { test } = require('node:test');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { motorKapilari, DAKIKA } = require('../../server/bildirim/ayar');
const { motoruBaslat, motoruDurdur } = require('../../server/bildirim');
const { workerIstemcisi, sayfalariOku } = require('../../server/bildirim/worker');
const { arsivTakvimi, takvimiDogrula } = require('../../server/bildirim/depo');
const { gonderimKarari, gonderimTuru } = require('../../server/bildirim/gonderici');
const { planTuru } = require('../../server/bildirim/planTuru');
const { motorDurumuAc } = require('../../server/bildirim/durum');

const simdi = Date.parse('2026-11-22T12:00:00Z');
const tarih = '2026-11-22T12:15:00.000Z';
const icerik = { tur: 'show', trakt_id: 1, sezon: 2, bolum: 3, tarih, durum: 'kesin',
  an_turu: 'kesin', takvim_rev: 10, kimlik: 'show:1:2:3', olay_id: null };
const bolum = {
  kategori: 'bolum_yakinda', zaman_dilimi: 'UTC', kutu_an: new Date(simdi).toISOString(),
  planlanan_an: new Date(simdi).toISOString(), push_son_an: '2026-11-22T12:45:00.000Z', yakin_son: tarih,
  beklenen_rev: 10, icerikler: [icerik], birimler: [{ baslik: 'Dizi', sezon: 2, bolum: 3, icerikler: [icerik] }],
};
const aday = { id: 'teslim', plan_surumu: 5, plan: bolum, hesap_acik: true, takipte: true, izlendi: false,
  zaman_dilimi: 'UTC', dil: 'tr', tercihler: { tumu: true, yayin: true } };
const sablon = { id: 'sablon', dil: 'tr', kategori: 'bolum_yakinda', baslik: '{baslik}', govde: 'Bölüm {bolum}', agirlik: 1 };
const sayfa = (satirlar) => ({ satirlar, sonraki: null });
const dur = () => false;
const dogrula = (icerikler) => ({ icerikler });

test('Gönderim anı takip, izleme, tarih, dilim, tercih, okundu ve TTL kapıları', () => {
  assert.deepEqual(gonderimKarari(aday, simdi), { islem: 'hazirla', push: true });
  for (const [ek, neden] of [
    [{ takipte: false }, 'takip_yok'], [{ izlendi: true }, 'izlendi'], [{ hesap_acik: false }, 'hesap_kapali'],
    [{ silindi_at: tarih }, 'kutu_silindi'], [{ zaman_dilimi: 'Europe/Istanbul' }, 'dilim_degisti'],
  ]) {
    assert.deepEqual(gonderimKarari({ ...aday, ...ek }, simdi), { islem: 'iptal', neden });
  }
  assert.deepEqual(gonderimKarari(aday, simdi, 'tarih_degisti'), { islem: 'iptal', neden: 'tarih_degisti' });
  assert.equal(gonderimKarari(aday, simdi, 'takvim_belirsiz'), null);
  for (const tercihler of [{ tumu: false }, { yayin: false }]) {
    assert.deepEqual(gonderimKarari({ ...aday, tercihler }, simdi), {
      islem: 'hazirla', push: false, neden: 'tercih_kapali',
    });
  }
  for (const kategori of ['sezon_duyuru', 'sezon_duyuru_tarihsiz']) {
    const plan = { ...bolum, kategori, yakin_son: null, planlanan_an: tarih };
    assert.deepEqual(gonderimKarari({ ...aday, plan }, simdi), { islem: 'hazirla', push: false, neden: 'push_bekliyor' });
    assert.deepEqual(gonderimKarari({ ...aday, plan, okundu_at: tarih }, Date.parse(tarih)),
      { islem: 'hazirla', push: false, neden: 'okundu' });
  }
  assert.deepEqual(gonderimKarari(aday, Date.parse(tarih)), { islem: 'hazirla', push: false, neden: 'gec_kaldi' });
  assert.deepEqual(gonderimKarari(aday, Date.parse(bolum.push_son_an)), { islem: 'hazirla', push: false, neden: 'sure_doldu' });
});

test('Kutu ve niyet CAS ile yazılır, kayıp push yanıtında yalnız aynı niyet okunur', async () => {
  const niyetId = '00000000-0000-4000-8000-000000000001';
  const istekler = [];
  const kutular = new Map();
  const niyetler = new Map();
  const terminal = new Set();
  let pushSayisi = 0;
  const worker = {
    gonderimAdaylari: async () => sayfa(terminal.size ? [] : [
      { ...aday, kutu_id: kutular.has(aday.id) ? 'kutu' : null }, { ...aday, id: 'eski', plan_surumu: 4 },
    ]),
    teslim: async (girdi) => {
      istekler.push(girdi);
      if (girdi.beklenen_plan_surumu !== 5 || girdi.beklenen_rev !== 10) return { durum: 'cakisma' };
      if (!kutular.has(girdi.id)) kutular.set(girdi.id, girdi.kutu);
      if (girdi.push && !niyetler.has(girdi.id)) niyetler.set(girdi.id, niyetId);
      return { durum: 'uygulandi', gonderim_idler: [niyetler.get(girdi.id)] };
    },
    push: async (girdi) => {
      assert.deepEqual(girdi, { gonderim_idler: [niyetId] });
      pushSayisi++;
      terminal.add(niyetId);
      throw new Error('yanit_kaybi');
    },
  };
  const kos = () => gonderimTuru({ worker, takvimiDogrula: dogrula, sablonlar: async () => [sablon], saat: () => simdi, dur });
  assert.deepEqual(await kos(), { kutu: 1, istek: 0, iptal: 0, cakisma: 1, hata: 1 });
  assert.equal((await kos()).istek, 0);
  assert.equal(pushSayisi, 1);
  assert.equal(kutular.size, 1);
  assert.equal(niyetler.size, 1);
  assert.equal(istekler[0].kutu.govde, 'Bölüm 3');
  assert.deepEqual(istekler[0].icerikler, [icerik]);
});

test('Kutu yazılırken tercih kapalıysa Worker push çağrısı kurulmaz', async () => {
  let kutu;
  const worker = {
    gonderimAdaylari: async () => sayfa([{ ...aday, tercihler: { tumu: false } }]),
    teslim: async (girdi) => {
      assert.equal(girdi.push, false);
      assert.equal(girdi.neden, 'tercih_kapali');
      kutu = girdi.kutu;
      return { durum: 'uygulandi', gonderim_idler: [] };
    },
    push: async () => assert.fail('push kapalı'),
  };
  const sonuc = await gonderimTuru({ worker, takvimiDogrula: dogrula, sablonlar: async () => [sablon],
    saat: () => simdi, dur });
  assert.equal(sonuc.kutu, 1);
  assert.equal(sonuc.istek, 0);
  assert.equal(kutu.baslik, 'Dizi');
});

test('Kesin geçici hatada sonraki tur aynı niyet kimliğini kullanır', async () => {
  const id = '00000000-0000-4000-8000-000000000001';
  const giden = [];
  const worker = {
    gonderimAdaylari: async () => sayfa([{ ...aday, kutu_id: 'kutu' }]),
    teslim: async (girdi) => {
      assert.equal(girdi.kutu, undefined);
      return { durum: 'uygulandi', gonderim_idler: [id, id] };
    },
    push: async ({ gonderim_idler }) => {
      giden.push(gonderim_idler);
      return { sonuclar: [{ id, durum: giden.length === 1 ? 'kesin_gecici_hata' : 'kabul_edildi' }] };
    },
  };
  const kos = () => gonderimTuru({ worker, takvimiDogrula: dogrula, sablonlar: async () => assert.fail('kutu var'),
    saat: () => simdi, dur });
  assert.equal((await kos()).istek, 1);
  assert.equal((await kos()).istek, 1);
  assert.deepEqual(giden, [[id], [id]]);
});

test('Kapalı varsayılan ve gece kapısı; plan kipinde tek uçuş ve yinelenebilir yazım', async () => {
  assert.deepEqual(motorKapilari({ MOTOR_GONDER: '1' }), { planla: false, gonder: false });
  const ortam = { MOTOR_PLANLA: '1', MOTOR_SIR: 'm'.repeat(32), EXPO_PUBLIC_KAYMAK_WORKER_URL: 'https://worker.invalid' };
  const zamanlayicilar = [];
  let girdiSayisi = 0;
  const yazimlar = [];
  const sayaclar = [];
  const worker = {
    planGirdisi: async () => {
      girdiSayisi++;
      return sayfa([{ user_id: 'kullanici', goruntu: 'surum', zaman_dilimi: 'UTC',
        takip: [{ tur: 'show', trakt_id: 1 }], izlenen: [], onceki: [], olaylar: [] }]);
    },
    planYaz: async (girdi) => {
      yazimlar.push(girdi);
      return { durum: 'uygulandi', eklenen: yazimlar.length === 1 ? 1 : 0, degisen: 0,
        ayni: yazimlar.length > 1 ? 1 : 0, iptal: 0, duzeltme: 0 };
    },
    gonderimAdaylari: async () => assert.fail('gönderici açık'),
    sablonlar: async () => assert.fail('şablon okundu'),
  };
  const secenek = {
    ortam, istemci: () => worker, saat: () => simdi,
    takvimOku: () => new Map([['show:1', { ...icerik, aynalanan_rev: 10, baslik: 'Dizi', satirlar: [icerik] }]]),
    durumAc: () => ({ baslangic: simdi, kapat() {} }),
    aralik: (calis, ms) => { zamanlayicilar.push({ calis, ms }); },
    ilk: () => {}, aralikSil: () => {},
    gunluk: { log: (satir) => sayaclar.push(JSON.parse(satir.slice(satir.indexOf('{')))), warn: assert.fail },
  };
  assert.equal(motoruBaslat({ ...secenek, ortam: { ...ortam, GECE_ISLERI: '0', MOTOR_GONDER: '1' } }), null);
  try {
    assert.equal(motoruBaslat(secenek), motoruBaslat(secenek));
    assert.deepEqual(zamanlayicilar.map((z) => z.ms), [15 * DAKIKA]);
    const [{ calis }] = zamanlayicilar;
    await Promise.all([calis(), calis()]);
    assert.equal(girdiSayisi, 1);
    await calis();
    assert.deepEqual(yazimlar[0], yazimlar[1]);
    assert.equal(yazimlar[0].planlar[0].beklenen_rev, 10);
    assert.equal(sayaclar[1].ayni, 1);
  } finally {
    await motoruDurdur();
  }
});

test('Worker istemcisi sırları ayırır ve push gövdesi yalnız kimlik taşır', async () => {
  const istekler = [];
  const worker = workerIstemcisi({
    workerUrl: 'https://worker.invalid', motorSir: 'm', pushSir: 'p',
    fetch: async (url, secenek) => { istekler.push([url.pathname, secenek]); return Response.json({}); },
  });
  await worker.sablonlar();
  await worker.push({ gonderim_idler: ['id'] });
  assert.deepEqual(istekler.map(([p, s]) => [p, s.method, s.headers['x-kaymak-sync-secret'], s.body]), [
    ['/ic/bildirim/sablonlar', 'GET', 'm', undefined],
    ['/ic/push', 'POST', 'p', '{"gonderim_idler":["id"]}'],
  ]);
  const tekrarli = sayfalariOku(async () => ({ satirlar: [], sonraki: 'ayni' }), {}, dur);
  await tekrarli.next();
  await assert.rejects(tekrarli.next(), /worker_sayfa/);
});

test('Radar SQLite takvimi salt okunur ve gönderim revizyonu yeniden doğrulanır', (t) => {
  const kok = fs.mkdtempSync(path.join(os.tmpdir(), 'kaymak-motor-'));
  const eski = process.env.ARCHIVE_ROOT;
  process.env.ARCHIVE_ROOT = kok;
  t.after(() => {
    if (eski === undefined) delete process.env.ARCHIVE_ROOT;
    else process.env.ARCHIVE_ROOT = eski;
    fs.rmSync(kok, { recursive: true, force: true });
  });
  const db = new DatabaseSync(path.join(kok, 'katalog.db'));
  try {
    db.exec(fs.readFileSync(path.join(__dirname, '../../server/archive/schema.sql'), 'utf8'));
    db.exec(require('../../server/radar/sema'));
    db.exec("INSERT INTO entities(kaymak_id,type,title,created_at,updated_at) VALUES ('dizi','show','Dizi',1,1)");
    db.prepare("INSERT INTO radar_takvim(tur,trakt_id,kaymak_id,takvim_rev,aynalanan_rev,ayna_hazir_at,veri) VALUES('show',1,'dizi',10,10,0,?)")
      .run(JSON.stringify({ satirlar: [icerik] }));
    assert.equal(arsivTakvimi([{ tur: 'show', trakt_id: 1 }]).get('show:1').baslik, 'Dizi');
    assert.deepEqual(takvimiDogrula([icerik]), { icerikler: [icerik] });
    db.exec('UPDATE radar_takvim SET takvim_rev=11');
    assert.deepEqual(takvimiDogrula([icerik]), { icerikler: [icerik] });
    db.exec('UPDATE radar_takvim SET aynalanan_rev=11');
    assert.deepEqual(takvimiDogrula([icerik]), { icerikler: [{ ...icerik, takvim_rev: 11 }] });
    assert.deepEqual(takvimiDogrula([{ ...icerik, tarih: '2026-11-25' }]), { neden: 'tarih_degisti' });
  } finally {
    db.close();
  }
});

test('Erken kutuya yazılmış duyuru ilgisiz revizyondan sonra aynı kutuyla gönderilir', async () => {
  const uye = { ...icerik, kimlik: 'show:1:2:-', bolum: null };
  const plan = { ...bolum, kategori: 'sezon_duyuru', yakin_son: null, icerikler: [uye],
    birimler: [{ ...bolum.birimler[0], icerikler: [uye] }], olay_alindi_at: new Date(simdi - 1).toISOString() };
  const taze = { ...uye, takvim_rev: 11 };
  let push = 0;
  let teslim;
  const worker = {
    gonderimAdaylari: async () => sayfa([{ ...aday, plan, kutu_id: 'erken-kutu' }]),
    teslim: async (istek) => {
      teslim = istek;
      return { durum: 'uygulandi', gonderim_idler: ['niyet'] };
    },
    push: async () => { push++; return { sonuclar: [{ id: 'niyet', durum: 'kabul_edildi' }] }; },
  };
  await gonderimTuru({ worker, takvimiDogrula: () => ({ icerikler: [taze] }), dur, saat: () => simdi,
    motorBaslangic: simdi - 2, sablonlar: async () => assert.fail('erken kutu yeniden yazıldı') });
  assert.equal(teslim.islem, 'hazirla');
  assert.equal(teslim.beklenen_rev, 10);
  assert.deepEqual(teslim.guncel_icerikler, [taze]);
  assert.equal(teslim.kutu, undefined);
  assert.equal(push, 1);
  assert.deepEqual(gonderimKarari({ ...aday, plan }, simdi, null, simdi - 1),
    { islem: 'iptal', neden: 'motor_oncesi' });
});

test('Sessiz saatte gecikmiş gönderim ertelenir, 08:45 istisnası ve TTL korunur', () => {
  const gece = Date.parse('2026-11-23T00:30Z');
  const plan = { ...bolum, kategori: 'bolum_bugun', yakin_son: null, push_son_an: '2026-11-23T23:00:00Z' };
  assert.deepEqual(gonderimKarari({ ...aday, plan }, gece), {
    islem: 'hazirla', push: false, neden: 'sessiz_saat', ertele_an: '2026-11-23T10:00:00.000Z',
  });
  assert.equal(gonderimKarari({ ...aday, plan: { ...plan, kategori: 'sezon_duyuru' } }, gece).ertele_an,
    '2026-11-23T09:00:00.000Z');
  assert.equal(gonderimKarari({ ...aday, plan: { ...plan, push_son_an: '2026-11-23T10:00:00Z' } }, gece).neden,
    'sessiz_saat_sure_doldu');
  assert.equal(gonderimKarari({ ...aday, plan }, Date.parse('2026-11-23T08:45Z')).push, false);
  const erken = { ...bolum, kutu_an: '2026-11-23T08:45:00Z', planlanan_an: '2026-11-23T08:45:00Z',
    yakin_son: '2026-11-23T09:00:00Z', push_son_an: '2026-11-23T09:30:00Z' };
  assert.equal(gonderimKarari({ ...aday, plan: erken }, Date.parse(erken.planlanan_an)).push, true);
  assert.equal(gonderimKarari({ ...aday, plan: erken }, Date.parse(erken.yakin_son)).neden, 'gec_kaldi');
});

test('Gönderimde tercih değişince kapalı film kalan üç dizinin özetini durdurmaz', () => {
  const birimler = [1, 2, 3, 4].map((id) => ({
    anahtar: String(id), icerikler: [{ tur: id === 4 ? 'movie' : 'show' }],
  }));
  const plan = { ...bolum, kategori: 'gunluk_ozet', birimler };
  const girdi = { ...aday, plan, tercihler: { film: false } };
  assert.deepEqual(gonderimKarari(girdi, simdi), {
    islem: 'hazirla', push: true, push_birim_anahtarlari: ['1', '2', '3'],
  });
  assert.deepEqual(gonderimKarari({ ...girdi, plan: { ...plan, birimler: birimler.slice(1) } }, simdi),
    { islem: 'iptal', neden: 'ozet_tercihi_degisti' });
});

test('Kalıcı damga ikinci süreçte değişmez ve açık süreç kilidi serbest bırakılır', (t) => {
  const kok = fs.mkdtempSync(path.join(os.tmpdir(), 'kaymak-motor-durum-'));
  const ortam = { ARCHIVE_ROOT: kok };
  t.after(() => fs.rmSync(kok, { recursive: true, force: true }));
  const digerSurec = () => {
    const betik = `const d = require(process.argv[1]).motorDurumuAc({ ARCHIVE_ROOT: process.argv[2] }, Number(process.argv[3]));
      console.log(d?.baslangic ?? 'kilitli'); d?.kapat();`;
    const r = spawnSync(process.execPath, ['--no-warnings', '-e', betik,
      require.resolve('../../server/bildirim/durum'), kok, String(simdi + 1)], { encoding: 'utf8', timeout: 5000 });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.trim();
  };
  const ilk = motorDurumuAc(ortam, simdi);
  try {
    assert.equal(ilk.baslangic, simdi);
    assert.equal(motorDurumuAc(ortam, simdi + 1), null);
    assert.equal(digerSurec(), 'kilitli');
  } finally {
    ilk.kapat();
  }
  assert.equal(digerSurec(), String(simdi));
});

test('Geçersiz girdi, bozuk arşiv ve 413 diğer kullanıcıları engellemez', async () => {
  const hazir = { goruntu: 's', takip: [], onceki: [], izlenen: [], olaylar: [] };
  const girdiler = [null, { ...hazir, user_id: 'bozuk', takip: [{ tur: 'show', trakt_id: 9 }] },
    { ...hazir, user_id: 'buyuk' }, { ...hazir, user_id: 'saglam' }];
  const yazilan = [];
  const worker = {
    planGirdisi: async (girdi) => {
      assert.equal(girdi.olay_baslangici, new Date(simdi - 100).toISOString());
      return sayfa(girdiler);
    },
    planYaz: async ({ user_id }) => {
      yazilan.push(user_id);
      if (user_id === 'buyuk') throw Object.assign(new Error('buyuk'), { status: 413 });
      return { durum: 'uygulandi', eklenen: 1, degisen: 0, ayni: 0, iptal: 0, duzeltme: 0 };
    },
  };
  const sonuc = await planTuru({ worker, dur, saat: () => simdi, motorBaslangic: simdi - 100,
    arsivTakvimi: () => new Map([['show:9', { bozuk: true }]]), filmTurleriniCoz: async () => {} });
  assert.deepEqual(yazilan, ['buyuk', 'saglam']);
  assert.deepEqual([sonuc.kullanici, sonuc.hata, sonuc.terk, sonuc.eklenen], [4, 3, 3, 1]);
});
