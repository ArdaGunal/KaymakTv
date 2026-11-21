let radarTuru = null;
let geceIsleri = 0;
const geceBekliyor = () => geceIsleri > 0;

// Radar tek uçuşta. Gece işi gelirse yeni Radar çağrıları durur, uçuşta
// olan istek ve atomik yazım tamamlanınca gece işi başlar.
async function radarKilidi(calis) {
  if (radarTuru || geceIsleri) return false;
  let birak;
  radarTuru = new Promise((coz) => { birak = coz; });
  try {
    await calis(geceBekliyor);
    return true;
  } finally {
    radarTuru = null;
    birak();
  }
}

async function geceIsi(calis, beklemeMs = 60_000) {
  geceIsleri++;
  try {
    if (radarTuru) {
      let zamanlayici;
      try {
        await Promise.race([radarTuru, new Promise((_, red) => {
          zamanlayici = setTimeout(() => red(new Error('radar_gece_kilit_zaman_asimi')), beklemeMs);
        })]);
      } finally {
        clearTimeout(zamanlayici);
      }
    }
    return await calis();
  } finally {
    geceIsleri--;
  }
}

module.exports = { radarKilidi, geceIsi, geceBekliyor };
