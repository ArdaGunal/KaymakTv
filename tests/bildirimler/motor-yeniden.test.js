const assert = require('node:assert/strict');
const { test } = require('node:test');
const { DAKIKA } = require('../../server/bildirim/ayar');
const { motoruBaslat, motoruDurdur } = require('../../server/bildirim');
const { workerIstemcisi } = require('../../server/bildirim/worker');

const bosSayfa = () => Response.json({ satirlar: [], sonraki: null });
const http = (status) => new Response(null, { status });
const planSayfasi = (kimlikler, sonraki = null) => Response.json({
  satirlar: kimlikler.map((user_id) => ({ user_id, goruntu: 'test-surum', takip: [], onceki: [], izlenen: [], olaylar: [] })),
  sonraki,
});
const planYazildi = () => Response.json({ durum: 'uygulandi', eklenen: 1, degisen: 0, ayni: 0, iptal: 0, duzeltme: 0 });

function motorKur(t, fetch, { acik = false, kilit = true, durumAc } = {}) {
  let an = Date.parse('2026-11-22T12:00:00Z');
  const ortam = {
    MOTOR_PLANLA: '1', MOTOR_GONDER: acik ? '1' : '0',
    MOTOR_SIR: 'm'.repeat(32), ICPUSH_SIR: 'p'.repeat(32),
    EXPO_PUBLIC_KAYMAK_WORKER_URL: 'https://worker.invalid',
  };
  const araliklar = new Map();
  const bekleyenler = new Set();
  const yollar = [];
  const uyarilar = [];
  const sonuclar = [];
  let unrefSayisi = 0;
  motoruBaslat({
    ortam, saat: () => an, takvimOku: () => new Map(),
    istemci: (ayar) => workerIstemcisi({ ...ayar, fetch: (url, { body }) => {
      yollar.push(url.pathname);
      an += 17;
      return fetch(url.pathname, yollar.length, body && JSON.parse(body));
    } }),
    durumAc: durumAc ?? (() => kilit ? { baslangic: an, kapat() {} } : null),
    aralik: (calis, ms) => araliklar.set(ms, calis), ilk: () => {}, aralikSil: () => {},
    zamanAsimi: (calis, ms) => {
      const zamanlayici = { calis, an: an + ms, unref: () => { unrefSayisi++; } };
      bekleyenler.add(zamanlayici);
      return zamanlayici;
    },
    zamanAsimiSil: (zamanlayici) => bekleyenler.delete(zamanlayici),
    gunluk: { log: (satir) => sonuclar.push(satir), warn: (satir) => uyarilar.push(satir) },
  });
  t.after(motoruDurdur);
  return {
    ortam, bekleyenler, yollar, uyarilar, sonuclar, unrefSayisi: () => unrefSayisi,
    planla: araliklar.get(15 * DAKIKA), gonder: araliklar.get(DAKIKA),
    async ilerle(ms) {
      an += ms;
      for (const zamanlayici of [...bekleyenler]) {
        if (zamanlayici.an > an) continue;
        bekleyenler.delete(zamanlayici);
        await zamanlayici.calis();
      }
    },
  };
}

test('502 sonrasında 30 saniyede tek planlama; beklerken ve uçuşta normal tur birleşir', async (t) => {
  const ikinci = Promise.withResolvers();
  const motor = motorKur(t, (_, sira) => sira === 1 ? http(502) : ikinci.promise);
  await motor.planla();
  assert.deepEqual(motor.uyarilar, ['[Bildirim] planla http_502 uc=planGirdisi sure=17 deneme=1 neden=-']);
  assert.equal(motor.unrefSayisi(), 1);
  await motor.ilerle(29_999);
  await motor.planla();
  assert.equal(motor.yollar.length, 1);
  const yeniden = motor.ilerle(1);
  await Promise.resolve();
  assert.equal(motor.yollar.length, 2);
  const normal = motor.planla();
  ikinci.resolve(bosSayfa());
  await Promise.all([yeniden, normal]);
  assert.equal(motor.yollar.length, 2);
  assert.equal(motor.sonuclar.length, 1);
  assert.equal(motor.bekleyenler.size, 0);
});

test('Sürekli 502 alan tek kullanıcı sonraki kullanıcıları ve normal turları engellemez', async (t) => {
  const yazilanlar = [];
  const kullanicilar = ['hatali', 'ikinci', 'ucuncu'];
  const motor = motorKur(t, (yol, _, girdi) => {
    if (yol.endsWith('/plan-girdisi')) return planSayfasi(kullanicilar);
    yazilanlar.push(girdi.user_id);
    return girdi.user_id === 'hatali' ? http(502) : planYazildi();
  });
  for (let tur = 1; tur <= 2; tur++) {
    await motor.planla();
    assert.equal(motor.bekleyenler.size, 0);
    await motor.ilerle(30_000);
    assert.equal(motor.yollar.length, tur * 4);
    assert.match(motor.sonuclar[tur - 1], /"eklenen":2,.*"hata":1,"terk":1/);
  }
  assert.deepEqual(yazilanlar, [...kullanicilar, ...kullanicilar]);
  assert.deepEqual(motor.uyarilar, []);
});

test('Başarılı plan yazımı ve kalıcı hata geçici hata dizisini sıfırlar', async (t) => {
  const durumlar = [502, 503, 200, 522, 524, 400, 502, 503, 200];
  const motor = motorKur(t, (yol, _, girdi) => {
    if (yol.endsWith('/plan-girdisi')) return planSayfasi(durumlar.map((_, i) => String(i)));
    const status = durumlar[girdi.user_id];
    return status === 200 ? planYazildi() : http(status);
  });
  await motor.planla();
  assert.equal(motor.yollar.length, durumlar.length + 1);
  assert.match(motor.sonuclar[0], /"eklenen":2,.*"hata":7,"terk":7/);
  assert.equal(motor.bekleyenler.size, 0);
});

test('Sayfa sınırında art arda üç geçici yazma hatası turu keser ve 30 saniye sonra tek deneme yapılır', async (t) => {
  const yazilanlar = [];
  const motor = motorKur(t, (yol, _, girdi) => {
    if (yol.endsWith('/plan-girdisi')) {
      return girdi.sonraki === null ? planSayfasi(['bir', 'iki'], 'son') : planSayfasi(['uc', 'dort']);
    }
    yazilanlar.push(girdi.user_id);
    return http(524);
  });
  await motor.planla();
  assert.deepEqual(yazilanlar, ['bir', 'iki', 'uc']);
  assert.equal(motor.bekleyenler.size, 1);
  await motor.ilerle(29_999);
  assert.equal(motor.yollar.length, 5);
  await motor.ilerle(1);
  await motor.ilerle(30_000);
  assert.deepEqual(motor.uyarilar, [
    '[Bildirim] planla http_524 uc=planYaz sure=17 deneme=1 neden=-',
    '[Bildirim] planla http_524 uc=planYaz sure=17 deneme=2 neden=-',
  ]);
  assert.deepEqual(yazilanlar, ['bir', 'iki', 'uc', 'bir', 'iki', 'uc']);
  assert.equal(motor.yollar.length, 10);
  assert.equal(motor.bekleyenler.size, 0);
  await motor.planla();
  assert.equal(motor.bekleyenler.size, 1);
});

for (const [ad, hata] of [
  ['TypeError', new TypeError('fetch failed')],
  ['AbortError', new DOMException('İptal', 'AbortError')],
  ['TimeoutError', new DOMException('Süre doldu', 'TimeoutError')],
]) {
  test(`${ad} ağ koduyla günlüğe yazılır ve planlama yeniden denenir`, async (t) => {
    const motor = motorKur(t, (_, sira) => {
      if (sira === 1) throw hata;
      return bosSayfa();
    });
    await motor.planla();
    await motor.ilerle(30_000);
    assert.deepEqual(motor.uyarilar, [`[Bildirim] planla ag_${ad} uc=planGirdisi sure=17 deneme=1 neden=-`]);
    assert.equal(motor.yollar.length, 2);
    assert.equal(motor.sonuclar.length, 1);
  });
}

test('Worker ucu olmayan 503 hatası yeniden denenmez', async (t) => {
  let kilitDenemesi = 0;
  const motor = motorKur(t, bosSayfa, { durumAc: () => {
    kilitDenemesi++;
    throw Object.assign(new Error('kilit'), { status: 503 });
  } });
  await motor.planla();
  assert.equal(motor.bekleyenler.size, 0);
  await motor.ilerle(30_000);
  assert.equal(kilitDenemesi, 1);
  assert.deepEqual(motor.yollar, []);
  assert.deepEqual(motor.uyarilar, ['[Bildirim] planla http_503 uc=- sure=0 deneme=1 neden=-']);
});

test('Worker istemcisi dondurulmuş ve ilkel hataları nedenleriyle sarar', async () => {
  const agHatasi = Object.freeze(new TypeError('fetch failed'));
  const httpHatasi = Object.freeze(Object.assign(new Error('worker_http'), { status: 503 }));
  for (const [asil, ag, status] of [[agHatasi, 'ag_TypeError'], [httpHatasi, undefined, 503], ['hata'], [null], [undefined]]) {
    const worker = workerIstemcisi({ workerUrl: 'https://worker.invalid', fetch: () => { throw asil; }, saat: () => 42 });
    await assert.rejects(worker.planGirdisi(), (hata) => {
      assert.ok(hata instanceof Error);
      assert.equal(hata.message, 'worker_istek');
      assert.equal(hata.cause, asil);
      assert.equal(hata.uc, 'planGirdisi');
      assert.equal(hata.sure, 0);
      assert.equal(hata.ag, ag);
      assert.equal(hata.status, status);
      return true;
    });
  }
});

for (const [ad, hata, neden] of [
  ['iç neden', new TypeError('özel mesaj', { cause: { code: 'UND_ERR_CONNECT_TIMEOUT' } }), 'UND_ERR_CONNECT_TIMEOUT'],
  ['doğrudan kod', Object.assign(new TypeError('özel mesaj'), { code: 'ECONNRESET' }), 'ECONNRESET'],
  ['geçersiz kod', Object.assign(new TypeError('özel mesaj'), { code: 'https://worker.invalid/kullanici' }), '-'],
]) {
  test(`Günlük neden alanı: ${ad}`, async (t) => {
    const motor = motorKur(t, () => { throw hata; });
    await motor.planla();
    assert.deepEqual(motor.uyarilar, [`[Bildirim] planla ag_TypeError uc=planGirdisi sure=17 deneme=1 neden=${neden}`]);
  });
}

for (const [ad, yanit, kilit, kod, istek] of [
  ['HTTP 400', () => http(400), true, 'http_400', 1],
  ['Geçersiz sayfa', () => Response.json({}), true, 'worker_sayfa', 1],
  ['Kilit yok', bosSayfa, false, null, 0],
]) {
  test(`${ad} halinde planlama yeniden denenmez`, async (t) => {
    const motor = motorKur(t, yanit, { kilit });
    await motor.planla();
    assert.equal(motor.bekleyenler.size, 0);
    await motor.ilerle(30_000);
    assert.equal(motor.yollar.length, istek);
    if (kod) assert.equal(motor.uyarilar[0]?.split(' ')[2], kod);
  });
}

for (const [ad, durdur] of [
  ['Kapının kapanması', async (motor) => { motor.ortam.MOTOR_PLANLA = '0'; await motor.planla(); }],
  ['Motorun durdurulması', motoruDurdur],
]) {
  test(`${ad} bekleyen yeniden denemeyi iptal eder`, async (t) => {
    const motor = motorKur(t, () => http(502));
    await motor.planla();
    assert.equal(motor.bekleyenler.size, 1);
    await durdur(motor);
    assert.equal(motor.bekleyenler.size, 0);
    await motor.ilerle(30_000);
    assert.equal(motor.yollar.length, 1);
  });
}

test('Gönderim turu 502 sonrasında yeniden denenmez', async (t) => {
  const motor = motorKur(t, () => http(502), { acik: true });
  await motor.gonder();
  assert.equal(motor.bekleyenler.size, 0);
  await motor.ilerle(30_000);
  assert.deepEqual(motor.yollar, ['/ic/bildirim/gonderim-adaylari']);
});
