const { radarKapilari } = require('../radar/ayar');

let kuyruk = Promise.resolve();
let bekleyen = 0;
const aynaMesgul = () => bekleyen > 0;

// Her iki GNL göndericisi aynı kapıda anlık görüntü kurar. Radar commit'i
// de bu kapıdan geçer; ağda bekleyen eski görüntünün önüne geçemez.
function aynaSirala(calis, zorunlu = false) {
  if (!zorunlu && !radarKapilari(process.env).yaz) return calis();
  bekleyen++;
  const sonuc = kuyruk.then(calis).finally(() => { bekleyen--; });
  kuyruk = sonuc.catch(() => {});
  return sonuc;
}

module.exports = { aynaSirala, aynaMesgul };
