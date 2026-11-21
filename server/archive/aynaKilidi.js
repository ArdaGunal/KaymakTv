const { radarKapilari } = require('../radar/ayar');

let kuyruk = Promise.resolve();

// Her iki GNL göndericisi aynı kapıda anlık görüntü kurar. Radar commit'i
// de bu kapıdan geçer; ağda bekleyen eski görüntünün önüne geçemez.
function aynaSirala(calis, zorunlu = false) {
  if (!zorunlu && !radarKapilari(process.env).yaz) return calis();
  const sonuc = kuyruk.then(calis);
  kuyruk = sonuc.catch(() => {});
  return sonuc;
}

module.exports = { aynaSirala };
