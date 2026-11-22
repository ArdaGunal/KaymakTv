const { DAKIKA } = require('./ayar');
const { yayinGunu } = require('./zaman');

const KATEGORILER = [
  'sezon_duyuru', 'sezon_duyuru_tarihsiz', 'bolum_yakinda', 'bolum_bugun', 'bolum_grup',
  'sezon_yayinlandi', 'film_vizyon', 'film_dijital', 'gunluk_ozet', 'sosyal_yorum',
  'sosyal_begeni_gonderi', 'sosyal_begeni_yorum', 'sosyal_takip_istegi', 'sosyal_takip', 'sosyal_onay',
];
const AYLAR_TR = [
  "Ocak'ta", "Şubat'ta", "Mart'ta", "Nisan'da", "Mayıs'ta", "Haziran'da", "Temmuz'da", "Ağustos'ta",
  "Eylül'de", "Ekim'de", "Kasım'da", "Aralık'ta",
];
const AYLAR_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const GRAFEM = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const YER_TUTUCU = /\{([a-z]+)\}/g;
const YEDEK_BASLIKLAR = {
  sezon_duyuru: ['Yeni sezon tarihi', 'New season date'],
  sezon_duyuru_tarihsiz: ['Yeni sezon duyuruldu', 'New season announced'],
  bolum_yakinda: ['Yeni bölüm yakında', 'New episode soon'],
  bolum_bugun: ['Yeni bölüm bugün', 'New episode today'],
  bolum_grup: ['Yeni bölümler', 'New episodes'],
  sezon_yayinlandi: ['Yeni bölümler yayında', 'New episodes available'],
  film_vizyon: ['Film vizyonda', 'Film in theaters'],
  film_dijital: ['Film dijitalde', 'Film now streaming'],
  gunluk_ozet: ['Günlük yayın özeti', 'Daily release roundup'],
  sosyal_yorum: ['Yeni yorum', 'New comment'],
  sosyal_begeni_gonderi: ['Yeni gönderi beğenisi', 'New post like'],
  sosyal_begeni_yorum: ['Yeni yorum beğenisi', 'New comment like'],
  sosyal_takip_istegi: ['Yeni takip isteği', 'New follow request'],
  sosyal_takip: ['Yeni takipçi', 'New follower'],
  sosyal_onay: ['Takip isteği onaylandı', 'Follow request accepted'],
};

function tarihMetni(tarih, dilim, dil, takvimGunu = false) {
  const gun = yayinGunu(tarih, dilim, takvimGunu);
  if (!gun) return null;
  const [, ay, g] = gun.split('-').map(Number);
  return dil === 'tr' ? `${g} ${AYLAR_TR[ay - 1]}` : `on ${AYLAR_EN[ay - 1]} ${g}`;
}

function basligiKisalt(baslik) {
  const grafemler = [...GRAFEM.segment(baslik || '')];
  return grafemler.length > 28 ? grafemler.slice(0, 27).map((g) => g.segment).join('') + '…' : baslik || '';
}

function tamSayi(n) {
  const deger = typeof n === 'string' && /^\d+$/.test(n) ? Number(n) : n;
  return Number.isSafeInteger(deger) && deger >= 0 ? deger : null;
}

function sablonHavuzu(oku, saat = Date.now) {
  let onbellek;
  let ucus;
  return async () => {
    if (onbellek && saat() < onbellek.son) return onbellek.satirlar;
    ucus ??= Promise.resolve().then(oku).then((satirlar) => {
      if (!Array.isArray(satirlar)) throw new Error('sablon_yaniti');
      const aktif = satirlar.filter((s) => s.aktif === true && KATEGORILER.includes(s.kategori) &&
        typeof s.id === 'string' && typeof s.dil === 'string' && typeof s.baslik === 'string' &&
        typeof s.govde === 'string' && Number.isSafeInteger(s.agirlik) && s.agirlik > 0);
      onbellek = { satirlar: aktif, son: saat() + 10 * DAKIKA };
      return aktif;
    }).catch(() => {
      const satirlar = onbellek?.satirlar ?? [];
      onbellek = { satirlar, son: saat() + DAKIKA };
      return satirlar;
    }).finally(() => { ucus = null; });
    return ucus;
  };
}

function sablonSec(satirlar, { kategori, dil, son_sablon_id, yerTutucular, rastgele = Math.random }) {
  const uygun = satirlar.filter((s) => s.kategori === kategori &&
    [...s.baslik.matchAll(YER_TUTUCU), ...s.govde.matchAll(YER_TUTUCU)].every(([, k]) => yerTutucular.has(k)));
  const istenen = typeof dil === 'string' ? dil.toLowerCase().split('-')[0] : 'en';
  const dilHavuzu = uygun.filter((s) => s.dil === istenen);
  const havuz = dilHavuzu.length ? dilHavuzu : uygun.filter((s) => s.dil === 'en');
  const alternatifler = havuz.filter((s) => s.id !== son_sablon_id);
  const adaylar = alternatifler.length ? alternatifler : havuz;
  let pay = rastgele() * adaylar.reduce((n, s) => n + s.agirlik, 0);
  return adaylar.find((s) => (pay -= s.agirlik) < 0) ?? adaylar.at(-1);
}

function kutuMetni(satirlar, plan, { dil, son_sablon_id, rastgele, kutu_sablonu }) {
  const { kategori, birimler, zaman_dilimi } = plan;
  const [ilk] = birimler;
  const ilkIcerik = ilk?.icerikler[0];
  const tarih = ilkIcerik?.tarih;
  const takvimGunu = ilkIcerik?.tur === 'movie' || ilkIcerik?.an_turu === 'yalniz_tarih';
  const parametreler = {
    baslik: basligiKisalt(ilk?.baslik), sezon: tamSayi(ilk?.sezon), bolum: tamSayi(ilk?.bolum),
    adet: kategori === 'gunluk_ozet' ? birimler.length : ilk?.icerikler.length || 1,
    tarih: yayinGunu(tarih, zaman_dilimi, takvimGunu),
  };
  const yerTutucular = new Set(Object.keys(parametreler).filter((k) => parametreler[k] !== null && parametreler[k] !== ''));
  const secilen = kutu_sablonu === undefined
    ? sablonSec(satirlar, { kategori, dil, son_sablon_id, yerTutucular, rastgele })
    : kutu_sablonu && sablonSec([kutu_sablonu], {
      kategori, dil: kutu_sablonu.dil, yerTutucular, rastgele: () => 0,
    });
  const dilSecimi = secilen?.dil ?? kutu_sablonu?.dil ?? dil;
  const tr = typeof dilSecimi === 'string' && dilSecimi.toLowerCase().split('-')[0] === 'tr';
  const degerler = { ...parametreler, tarih: tarihMetni(tarih, zaman_dilimi, secilen?.dil ?? (tr ? 'tr' : 'en'), takvimGunu) };
  if (!secilen) {
    const { baslik, adet } = parametreler;
    const yedek = YEDEK_BASLIKLAR[kategori][tr ? 0 : 1];
    let govde = baslik;
    if (kategori.startsWith('sosyal_')) govde = tr ? 'Bildirimlerini görmek için aç.' : 'Open to view your notifications.';
    if (kategori === 'sezon_duyuru') govde = [baslik, degerler.tarih].filter(Boolean).join(' · ');
    if (['bolum_grup', 'sezon_yayinlandi'].includes(kategori)) govde = `${baslik} · ${adet} ${tr ? 'yeni bölüm' : 'new episodes'}`;
    if (kategori === 'gunluk_ozet') govde = tr ? `Bugün ${adet} yapım yayında.` : `${adet} titles out today.`;
    return { sablon_id: kutu_sablonu?.id ?? null, dil: tr ? 'tr' : 'en', baslik: yedek, govde: govde || yedek, adet, parametreler };
  }
  const isle = (metin) => metin.replace(YER_TUTUCU, (_, k) => String(degerler[k]));
  return {
    sablon_id: secilen.id, dil: secilen.dil, baslik: isle(secilen.baslik), govde: isle(secilen.govde),
    adet: parametreler.adet, parametreler,
  };
}

module.exports = { KATEGORILER, tarihMetni, basligiKisalt, sablonHavuzu, sablonSec, kutuMetni };
