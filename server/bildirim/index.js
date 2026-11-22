const { DAKIKA, motorKapilari } = require('./ayar');
const { workerIstemcisi } = require('./worker');
const { arsivTakvimi, takvimiDogrula } = require('./depo');
const { sablonHavuzu } = require('./sablon');
const { filmTurleriniKur, planTuru } = require('./planTuru');
const { gonderimTuru } = require('./gonderici');
const { motorDurumuAc } = require('./durum');

let motor = null;
const sirVar = (sir) => typeof sir === 'string' && sir.length >= 32;

function motoruBaslat({
  ortam = process.env, gunluk = console, saat = Date.now, istemci = workerIstemcisi,
  takvimOku = arsivTakvimi, durumAc = motorDurumuAc, aralik = setInterval, ilk = setImmediate, aralikSil = clearInterval,
} = {}) {
  const kapilar = motorKapilari(ortam);
  if (!kapilar.planla) return null;
  if (motor) return motor;
  let workerUrl;
  try {
    const url = new URL(ortam.EXPO_PUBLIC_KAYMAK_WORKER_URL);
    if (url.protocol === 'https:' && !url.username && !url.password) workerUrl = url.origin;
  } catch { /* Eksik URL ile çağrı yapılmaz. */ }
  if (!workerUrl || !sirVar(ortam.MOTOR_SIR)) {
    gunluk.warn('[Bildirim] Worker adresi veya MOTOR_SIR eksik, motor kapalı.');
    return null;
  }
  const gonder = kapilar.gonder && sirVar(ortam.ICPUSH_SIR);
  if (kapilar.gonder && !gonder) gunluk.warn('[Bildirim] ICPUSH_SIR eksik, yalnız planlama açık.');
  const worker = istemci({ workerUrl, motorSir: ortam.MOTOR_SIR, pushSir: ortam.ICPUSH_SIR });
  let tmdbCek;
  if (ortam.TMDB_API_KEY) {
    const { createTmdbFetcher } = require('../lazyfetch/providers/tmdb');
    const { radarCek } = require('../radar/akis');
    const fetcher = createTmdbFetcher(ortam.TMDB_API_KEY);
    tmdbCek = (id, dur) => radarCek('tmdb', fetcher, `/movie/${id}/release_dates`, {}, () => {
      if (dur()) throw new Error('motor_duruyor');
    });
  }
  const filmTurleriniCoz = filmTurleriniKur(tmdbCek, saat);
  const sablonlar = sablonHavuzu(async () => (await worker.sablonlar()).satirlar, saat);
  const durum = { zamanlayicilar: [], ucuslar: new Map(), duruyor: false, aralikSil };
  motor = durum;

  function kur(ad, ms, tur) {
    const dur = () => durum.duruyor || !motorKapilari(ortam)[ad];
    function calis() {
      if (dur() || durum.ucuslar.has(ad)) return durum.ucuslar.get(ad);
      const ucus = Promise.resolve().then(() => {
        if (dur()) return null;
        durum.kilit ??= durumAc(ortam, saat());
        if (!durum.kilit) return null;
        return tur({ dur, worker, saat, motorBaslangic: durum.kilit.baslangic });
      }).then((sonuc) => {
        if (sonuc && !dur() && (ad === 'planla' || sonuc.istek || sonuc.iptal || sonuc.hata)) {
          gunluk.log(`[Bildirim] ${ad} ${JSON.stringify(sonuc)}`);
        }
      }).catch((hata) => {
        const kod = Number.isInteger(hata.status) ? `http_${hata.status}` : 'tur_hatasi';
        gunluk.warn(`[Bildirim] ${ad} ${kod}`);
      }).finally(() => durum.ucuslar.delete(ad));
      durum.ucuslar.set(ad, ucus);
      return ucus;
    }
    const zamanlayici = aralik(calis, ms);
    durum.zamanlayicilar.push(zamanlayici);
    zamanlayici?.unref?.();
    ilk(calis)?.unref?.();
    return calis;
  }

  const planla = kur('planla', 15 * DAKIKA, (baglam) => planTuru({ ...baglam, arsivTakvimi: takvimOku, filmTurleriniCoz }));
  if (gonder) kur('gonder', DAKIKA, async (baglam) => {
    const sonuc = await gonderimTuru({
      ...baglam, takvimiDogrula: (uyeler) => takvimiDogrula(uyeler, takvimOku), sablonlar,
    });
    if (sonuc.yenidenPlanla && !baglam.dur()) ilk(planla)?.unref?.();
    return sonuc;
  });
  return motor;
}

async function motoruDurdur() {
  if (!motor) return;
  const durum = motor;
  durum.duruyor = true;
  for (const zamanlayici of durum.zamanlayicilar) durum.aralikSil(zamanlayici);
  await Promise.allSettled(durum.ucuslar.values());
  if (motor === durum) {
    durum.kilit?.kapat();
    motor = null;
  }
}

module.exports = { motoruBaslat, motoruDurdur };
