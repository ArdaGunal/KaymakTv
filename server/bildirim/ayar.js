const { geceIsleriAcikMi } = require('../geceIsleri');

const DAKIKA = 60_000;
const SAAT = 60 * DAKIKA;
const GUN = 24 * SAAT;
const UFUK = 48 * SAAT;
const DUYURU_TTL = 7 * GUN;
const PARTI = 100;

function motorKapilari(ortam = process.env) {
  const planla = geceIsleriAcikMi(ortam) && ortam.MOTOR_PLANLA === '1';
  return { planla, gonder: planla && ortam.MOTOR_GONDER === '1' };
}

module.exports = { DAKIKA, SAAT, GUN, UFUK, DUYURU_TTL, PARTI, motorKapilari };
