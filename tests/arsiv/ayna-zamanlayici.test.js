// ==========================================================================
// M555 — Ayna zamanlayıcısı: düşen tur AYNI SABAH yeniden denenir (günde en çok 3), başarıda durur,
// yeniden başlatma sayımı sıfırlamaz (`sync_log`), pencere dışında koşmaz.
// ==========================================================================
// Ağ yok: çalıştırıcı sahte; saat ve süreler enjekte edilir (gerçek 20 dk yerine 30 ms).

const path = require('path');
const { baslat, AR } = require('../yardimci');

const T = baslat('AYNA ZAMANLAYICISI (M555)', { kokOneki: 'ar-ayna-zaman-' });
const db = require(path.join(AR, 'db'));
const zam = require(path.join(AR, 'mirrorSchedule'));

const bekle = (ms) => new Promise((r) => setTimeout(r, ms));
const gunSaat = (gunEk, saat, dk = 30) => { const d = new Date(); d.setDate(d.getDate() + gunEk); d.setHours(saat, dk, 0, 0); return d; };

(async () => {
  db.initArchive();
  process.env.EXPO_PUBLIC_KAYMAK_WORKER_URL = 'http://worker.test';
  process.env.PI_SYNC_SECRET = 's'.repeat(40);
  const h = db.getDb();
  const satirYaz = (at, detail) => h.prepare("INSERT INTO sync_log (at, event, provider, detail) VALUES (?, 'mirror', 'supabase', ?)").run(at, detail);
  const hata = console.error;
  console.error = () => {};

  // Sahte koşucu: her çağrıda gerçek runMirror gibi `sync_log`'a satır yazar.
  const kosucuYap = (saat, sonuclar) => {
    const c = { n: 0 };
    c.fn = async () => {
      const ok = sonuclar[Math.min(c.n, sonuclar.length - 1)];
      c.n += 1;
      satirYaz(saat().getTime() + c.n, ok ? 'yazilan=1 atlanan=0 imlec=1' : 'entities season basarisiz: http_502 supabase_zaman_asimi');
      return ok ? { ok: true } : { ok: false, reason: 'http_502' };
    };
    return c;
  };

  try {
    T.H('Düşen tur aynı sabah yeniden denenir, başarıda durur');
    const s1 = () => gunSaat(0, 7);
    const k1 = kosucuYap(s1, [false, true]);
    zam.startMirrorSchedule({}, { kosucu: k1.fn, saat: s1, yenidenMs: 30, acilisMs: 10 });
    await bekle(400);
    T.ok('İki deneme: düştü → 30 ms sonra yeniden → başarılı', k1.n === 2, String(k1.n));
    const d1 = zam.bugunkuAyna(s1());
    T.ok('sync_log: bugün başarılı, 2 deneme', d1.basarili && d1.deneme === 2, JSON.stringify(d1));
    T.ok('bugunAynalandiMi artık yalnız BAŞARIYI sayar', zam.bugunAynalandiMi(s1()) === true);
    zam.stopMirrorSchedule();

    T.H('Hep düşen tur: günde en çok 3 deneme');
    const s2 = () => gunSaat(1, 8, 50); // pencerenin son dakikaları — yeniden deneme 09:00'u aşsa da sayıyla sınırlı
    const k2 = kosucuYap(s2, [false]);
    zam.startMirrorSchedule({}, { kosucu: k2.fn, saat: s2, yenidenMs: 30, acilisMs: 10 });
    await bekle(500);
    T.ok(`Tam ${zam.GUNLUK_EN_COK_DENEME} deneme, sonra durdu`, k2.n === zam.GUNLUK_EN_COK_DENEME, String(k2.n));
    const d2 = zam.bugunkuAyna(s2());
    T.ok('Başarı yok olarak kaydedildi (yarın yeniden)', !d2.basarili && d2.deneme === 3, JSON.stringify(d2));
    zam.stopMirrorSchedule();

    T.H('Yeniden başlatma sayımı sıfırlamaz');
    const k3 = kosucuYap(s2, [false]);
    zam.startMirrorSchedule({}, { kosucu: k3.fn, saat: s2, yenidenMs: 30, acilisMs: 10 });
    await bekle(200);
    T.ok('🔴 Aynı gün yeniden başlatınca 4. deneme YOK (sync_log 3 diyor)', k3.n === 0, String(k3.n));
    zam.stopMirrorSchedule();

    T.H('Pencere dışında koşmaz');
    const s4 = () => gunSaat(2, 12);
    const k4 = kosucuYap(s4, [true]);
    zam.startMirrorSchedule({}, { kosucu: k4.fn, saat: s4, yenidenMs: 30, acilisMs: 10 });
    await bekle(150);
    T.ok('12:30 → hiç deneme yok', k4.n === 0, String(k4.n));
    zam.stopMirrorSchedule();

    // Saatlik tik / yeniden başlatma yolu: karar bellekten değil, ÖNCEDEN yazılmış `sync_log` satırından.
    T.H('sync_log önceden dolu: karar satırlara göre');
    const s5 = () => gunSaat(3, 8, 10);
    satirYaz(gunSaat(3, 7, 10).getTime(), 'yazilan=5 atlanan=0 imlec=5');
    const k5 = kosucuYap(s5, [true]);
    zam.startMirrorSchedule({}, { kosucu: k5.fn, saat: s5, yenidenMs: 30, acilisMs: 10 });
    await bekle(150);
    T.ok('Başarılı satır var → koşmaz', k5.n === 0, String(k5.n));
    zam.stopMirrorSchedule();

    const s6 = () => gunSaat(4, 8, 10);
    satirYaz(gunSaat(4, 7, 10).getTime(), 'entities season basarisiz: http_502 supabase_zaman_asimi');
    const k6 = kosucuYap(s6, [true]);
    zam.startMirrorSchedule({}, { kosucu: k6.fn, saat: s6, yenidenMs: 30, acilisMs: 10 });
    await bekle(150);
    T.ok('🔴 Yalnız düşen satır var → koşar (2026-10-21 hatası)', k6.n === 1, String(k6.n));
    zam.stopMirrorSchedule();

    const s7 = () => gunSaat(5, 8, 10);
    satirYaz(gunSaat(5, 7, 10).getTime(), 'exception: ECONNRESET');
    satirYaz(gunSaat(5, 7, 40).getTime(), 'entities season basarisiz: http_502 error code: 522');
    const k7 = kosucuYap(s7, [false]);
    zam.startMirrorSchedule({}, { kosucu: k7.fn, saat: s7, yenidenMs: 30, acilisMs: 10 });
    await bekle(200);
    T.ok(`İki düşen satır → son (${zam.GUNLUK_EN_COK_DENEME}.) deneme koşar, düşünce yenisi kurulmaz`, k7.n === 1, String(k7.n));
    zam.stopMirrorSchedule();
  } finally {
    console.error = hata;
  }

  db.closeArchive();
  T.bitir();
})();
