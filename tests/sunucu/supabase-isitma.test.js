// ==========================================================================
// Supabase ısındırma — 4 dk'da bir küçük okuma (HIZ-02 · M573)
// ==========================================================================
// 🔴 İDDİALAR: ölçülen aralık (4 dk) · iki yol, eksik ayarlı yol kapalı · sır yalnız Worker isteğinde ·
// kişisel tablo okunmaz · hata ve yavaşlık sayılır, fırlatmaz · özette anahtar/sır yok · süreç kapanmasını
// engellemez. Ağ YOK: okuma işlevi sahte.

const path = require('path');
const fs = require('fs');
const { baslat } = require('../yardimci');

const T = baslat('SUPABASE ISINDIRMA', { kokOneki: 'supabase-isitma-' });
const KOK = path.join(__dirname, '..', '..');
const { hedefleriKur, turKos, ozetMetni, bosSayac, startSupabaseIsitma, ARALIK_MS } = require(path.join(KOK, 'server/supabaseIsitma'));

const ORTAM = {
  EXPO_PUBLIC_SUPABASE_URL: 'https://proje.supabase.co/',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: 'ANON-ANAHTAR',
  EXPO_PUBLIC_KAYMAK_WORKER_URL: 'https://worker.test/',
  PI_SYNC_SECRET: 'GIZLI-PI-SIRRI',
};

(async () => {
  T.H('Kurulum');
  const hedefler = hedefleriKur(ORTAM);
  T.ok('Ölçülen aralık: 4 dk', ARALIK_MS === 4 * 60 * 1000);
  T.ok('İki yol: doğrudan + Worker', hedefler.map((h) => h.ad).join() === 'dogrudan,worker');
  const [dogrudan, worker] = hedefler;
  T.ok('Doğrudan yol küçük anon okuma, kişisel tablo değil', dogrudan.method === 'GET' && dogrudan.url === 'https://proje.supabase.co/rest/v1/app_settings?select=updated_at&limit=1');
  T.ok('Doğrudan yol Pi sırrını TAŞIMAZ', !JSON.stringify(dogrudan).includes('GIZLI-PI-SIRRI'));
  T.ok('Worker yolu /isitma + sır başlıkta', worker.method === 'POST' && worker.url === 'https://worker.test/isitma' && worker.headers['x-kaymak-sync-secret'] === 'GIZLI-PI-SIRRI');
  T.ok('Worker yolu anon anahtarı TAŞIMAZ', !JSON.stringify(worker).includes('ANON-ANAHTAR'));
  T.ok('Sır yoksa Worker yolu kapalı, öteki çalışır', hedefleriKur({ ...ORTAM, PI_SYNC_SECRET: '' }).map((h) => h.ad).join() === 'dogrudan');
  T.ok('Hiç ayar yoksa hedef yok', hedefleriKur({}).length === 0);

  T.H('Sayım');
  const sayac = bosSayac(hedefler);
  const cevaplar = { dogrudan: [{ durum: 200, ms: 300 }, { durum: 200, ms: 1500 }, { durum: 522, ms: 19500 }], worker: [{ durum: 200, ms: 250 }, { durum: 502, ms: 9000 }, { durum: 0, ms: 30000 }] };
  const okuFn = async (h) => cevaplar[h.ad].shift();
  for (let i = 0; i < 3; i++) await turKos(hedefler, sayac, okuFn);
  T.ok('Yavaş ve hata ayrı sayılır', sayac.dogrudan.tur === 3 && sayac.dogrudan.yavas === 1 && sayac.dogrudan.hata === 1);
  T.ok('Ağ hatası (0) ve 502 hata sayılır', sayac.worker.tur === 3 && sayac.worker.yavas === 0 && sayac.worker.hata === 2);
  const metin = ozetMetni(sayac);
  T.ok('Özet ölçüme yeter', metin === 'dogrudan tur=3 yavas=1 hata=1 · worker tur=3 yavas=0 hata=2');
  T.ok('Özette anahtar/sır yok', !metin.includes('GIZLI') && !metin.includes('ANON'));

  T.H('Zamanlayıcı');
  const uyari = console.warn;
  console.warn = () => {};
  T.ok('Ayar yoksa başlamaz', startSupabaseIsitma({}) === null);
  console.warn = uyari;
  const z = startSupabaseIsitma(ORTAM);
  T.ok('Süreç kapanmasını engellemez (unref)', z && z.hasRef() === false);
  clearInterval(z);

  T.H('Kaynak denetimi');
  const kaynak = fs.readFileSync(path.join(KOK, 'server/supabaseIsitma.js'), 'utf8').replace(/\r\n/g, '\n');
  T.ok('Hedef başlıkları log\'a yazılmaz', !/console\.\w+\([^)]*(headers|anon|sir)\b/.test(kaynak));
  const sunucu = fs.readFileSync(path.join(KOK, 'server.js'), 'utf8');
  T.ok('server.js başlatıyor', /require\('\.\/server\/supabaseIsitma'\)\.startSupabaseIsitma\(\)/.test(sunucu));

  T.bitir();
})();
