const { DAKIKA, SAAT, GUN, DUYURU_TTL } = require('./ayar');

const BICIMLER = new Map();
const iso = (t) => new Date(t).toISOString();
const gunKaydir = (gun, fark) => iso(Date.parse(gun) + fark * GUN).slice(0, 10);

function bicim(dilim) {
  if (!BICIMLER.has(dilim)) {
    BICIMLER.set(dilim, new Intl.DateTimeFormat('en-CA', {
      timeZone: dilim, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }));
  }
  return BICIMLER.get(dilim);
}

function gecerliDilim(dilim) {
  if (typeof dilim !== 'string' || !dilim || /^[+-]/.test(dilim)) return 'UTC';
  try {
    return bicim(dilim).resolvedOptions().timeZone;
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return 'UTC';
  }
}

function yerel(an, dilim) {
  const p = Object.fromEntries(bicim(dilim).formatToParts(an).map(({ type, value }) => [type, value]));
  return { gun: `${p.year}-${p.month}-${p.day}`, saat: Number(p.hour), dakika: Number(p.minute), saniye: Number(p.second) };
}

function duvarAni(gun, saat, dilim) {
  const hedef = Date.parse(`${gun}T${String(saat).padStart(2, '0')}:00:00Z`);
  // Geçişin iki yanındaki ofsetlerden aday üret. Tekrarlanan saatte ilk anı,
  // atlanan saatte ise boşluk kadar ileri kaymış anı seç.
  const adaylar = [-GUN, 0, GUN].map((fark) => {
    const sonda = hedef + fark;
    const p = yerel(sonda, dilim);
    const yerelUtc = Date.parse(p.gun) + p.saat * SAAT + p.dakika * DAKIKA + p.saniye * 1000;
    const an = hedef - (yerelUtc - sonda);
    const y = yerel(an, dilim);
    return { an, fark: Date.parse(y.gun) + y.saat * SAAT + y.dakika * DAKIKA + y.saniye * 1000 - hedef };
  });
  adaylar.sort((a, b) => a.fark - b.fark || a.an - b.an);
  return adaylar.find((a) => a.fark >= 0)?.an ?? adaylar.at(-1).an;
}

function yayinGunu(tarih, dilim, takvimGunu = false) {
  if (!tarih) return null;
  if (takvimGunu) tarih = tarih.slice(0, 10);
  const an = Date.parse(tarih);
  if (!Number.isFinite(an)) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(tarih)) return iso(an).slice(0, 10) === tarih ? tarih : null;
  return yerel(an, dilim).gun;
}

function yayinZamani({ tur, tarih, an_turu }, dilim) {
  const gun = yayinGunu(tarih, dilim, tur === 'movie' || an_turu === 'yalniz_tarih');
  if (!gun) return null;
  if (tur === 'movie' || an_turu === 'yalniz_tarih') {
    const an = duvarAni(gun, 10, dilim);
    return { gun, an, son: an + 36 * SAAT, erken: false };
  }
  if (an_turu !== 'kesin') return null;
  const yayin = Date.parse(tarih);
  const { saat } = yerel(yayin, dilim);
  if (saat >= 9 && saat < 23) return { gun, an: yayin - 15 * DAKIKA, son: yayin + 30 * DAKIKA, erken: true };
  const an = duvarAni(saat >= 23 ? gunKaydir(gun, 1) : gun, 10, dilim);
  return { gun, an, son: an + 36 * SAAT, erken: false };
}

function duyuruZamani(tespit, dilim) {
  const { gun, saat } = yerel(tespit, dilim);
  const an = saat >= 9 && saat < 23 ? tespit : duvarAni(saat >= 23 ? gunKaydir(gun, 1) : gun, 9, dilim);
  return { an, son: tespit + DUYURU_TTL };
}

function sessizSaatSonu(simdi, plan, duyuru) {
  const { zaman_dilimi: dilim } = plan;
  const { gun, saat, dakika } = yerel(simdi, dilim);
  if (saat >= 9 && saat < 23) return null;
  // Yalnız o sabah 09:00–09:14 yayınına bağlı 15 dakika öncesi istisnası.
  if (!duyuru && saat === 8 && dakika >= 45) {
    const ilk = yerel(Date.parse(plan.planlanan_an), dilim);
    if (ilk.gun === gun && ilk.saat === 8 && ilk.dakika >= 45) return null;
  }
  return duvarAni(saat >= 23 ? gunKaydir(gun, 1) : gun, duyuru ? 9 : 10, dilim);
}

module.exports = { iso, gecerliDilim, yerel, duvarAni, yayinGunu, yayinZamani, duyuruZamani, sessizSaatSonu };
