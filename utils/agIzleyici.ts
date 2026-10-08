// Ağ zaman çizelgesi — YALNIZ `EXPO_PUBLIC_AG_IZLE=1` ile derlenen test
// APK'sında açılır; normal derlemede ilk satırda döner, hiçbir şey yamamaz.
// Amaç (yayın öncesi K1/K3/K4): açılış/akış/profil yavaşlığında hangi
// isteklerin ART ARDA beklediğini logcat'te görmek (`[AG]` satırları).
//
// RN'de `fetch` (whatwg-fetch) ve axios ikisi de XMLHttpRequest üstünde
// çalışır → tek yama bütün istekleri (Supabase, Worker, Pi, Trakt, TMDB)
// yakalar. URL'nin sorgu kısmı YAZILMAZ: token/kimlik taşıyabilir.

const baslangic = Date.now();
export const agIzleAcik = process.env.EXPO_PUBLIC_AG_IZLE === '1';

export function agIsaret(ad: string, ms?: number) {
  if (!agIzleAcik) return;
  console.log(`[AG] +${Date.now() - baslangic}ms ISARET ${ad}${ms === undefined ? '' : ` ${ms}ms`}`);
}

export function agIzleyiciKur() {
  if (!agIzleAcik) return;
  const X = (globalThis as any).XMLHttpRequest;
  if (!X || X.__agIzle) return;
  X.__agIzle = true;
  const open = X.prototype.open;
  const send = X.prototype.send;
  X.prototype.open = function (method: string, url: string, ...rest: unknown[]) {
    this.__ag = { method, yol: String(url).replace(/^https?:\/\//, '').split('?')[0] };
    return open.call(this, method, url, ...rest);
  };
  X.prototype.send = function (...args: unknown[]) {
    const m = this.__ag;
    if (m) {
      const bas = Date.now();
      this.addEventListener('loadend', () => {
        console.log(`[AG] +${bas - baslangic}ms ${m.method} ${m.yol} ${this.status} ${Date.now() - bas}ms`);
      });
    }
    return send.apply(this, args);
  };
  agIsaret('izleyici kuruldu');
}
