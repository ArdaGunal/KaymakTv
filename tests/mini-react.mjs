// Tek bileşenlik küçük React (useState / useEffect / useCallback): hook'ları DOM'suz, gerçek
// gövdeleriyle çalıştırmak için (projede React test kitaplığı yok). `ts-test-loader` ile `react` yerine verilir.
export function miniReact() {
  let slots = [];
  let i = 0;
  let kuyruk = [];
  let cizerken = false;
  let kirli = false;
  let bilesen = null;
  let son;
  const R = {
    useState(ilk) {
      const k = i++;
      if (!(k in slots)) slots[k] = { v: typeof ilk === 'function' ? ilk() : ilk };
      const s = slots[k];
      return [s.v, (n) => {
        const y = typeof n === 'function' ? n(s.v) : n;
        if (Object.is(y, s.v)) return;
        s.v = y;
        kirli = true;
        if (!cizerken) R.ciz();
      }];
    },
    useEffect(fn, deps) {
      const k = i++;
      const s = slots[k];
      if (s && deps && deps.every((d, j) => Object.is(d, s.deps[j]))) return;
      kuyruk.push(() => {
        s?.temiz?.();
        const t = fn();
        slots[k] = { deps, temiz: typeof t === 'function' ? t : null };
      });
    },
    useCallback(fn, deps) {
      const k = i++;
      const s = slots[k];
      if (s && deps.every((d, j) => Object.is(d, s.deps[j]))) return s.fn;
      slots[k] = { fn, deps };
      return fn;
    },
    baglan(hook) { bilesen = hook; R.ciz(); return () => son; },
    ciz() {
      cizerken = true;
      do {
        kirli = false;
        i = 0;
        kuyruk = [];
        son = bilesen();
        for (const f of kuyruk) f();
      } while (kirli);
      cizerken = false;
    },
  };
  return R;
}

/** Elle ilerletilen zamanlayıcı. */
export function sahteZaman() {
  let sira = 1;
  const bekleyen = new Map();
  return {
    setTimeout: (fn, ms) => { const id = sira++; bekleyen.set(id, { fn, ms }); return id; },
    clearTimeout: (id) => { bekleyen.delete(id); },
    ilerle() { const hepsi = [...bekleyen.entries()]; bekleyen.clear(); for (const [, { fn }] of hepsi) fn(); },
    bekleyenSayisi: () => bekleyen.size,
    sureler: () => [...bekleyen.values()].map((b) => b.ms),
  };
}

/** Söz kuyruğu boşalsın (mikro görevler). */
export const bosalt = () => new Promise((r) => setImmediate(r));
