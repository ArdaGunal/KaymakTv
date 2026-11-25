const OG_KOKENI = 'https://kaymaktv.com';
const AFIS_YOLU = '/api/paylasim/afis/';
const VARSAYILAN_AFIS = `${OG_KOKENI}${AFIS_YOLU}kaymaktv-360.jpg`;

const METINLER = {
  tr: { locale: 'tr_TR', aciklama: 'Dizilerini ve filmlerini KaymakTV ile takip et.' },
  en: { locale: 'en_US', aciklama: 'Track your shows and movies with KaymakTV.' },
};

const HTML_KACISLARI = { '&': '&amp;', '"': '&quot;', "'": '&#39;', '<': '&lt;', '>': '&gt;' };

function kacir(deger) {
  return deger.replace(/[&"'<>]/g, (karakter) => HTML_KACISLARI[karakter]);
}

function tekSatir(deger, sinir) {
  return typeof deger === 'string' ? Array.from(deger.replace(/\s+/gu, ' ').trim()).slice(0, sinir).join('') : '';
}

export function katalogMetasiniDogrula(ozet) {
  const baslik = tekSatir(ozet?.baslik, 120);
  if (!baslik) return null;
  const afis = /^\/api\/paylasim\/afis\/[a-f0-9]{64}\.jpg$/.test(ozet.gorsel) ? ozet.gorsel : null;
  return { baslik, aciklama: tekSatir(ozet.aciklama, 80), gorsel: afis };
}

export function ogEkle(yanit, kanonik, dil, ozet) {
  const metin = METINLER[dil];
  const baslik = ozet?.baslik || 'KaymakTV';
  const gorsel = ozet?.gorsel ? OG_KOKENI + ozet.gorsel : VARSAYILAN_AFIS;
  const og = {
    'og:title': baslik,
    'og:description': ozet?.aciklama || metin.aciklama,
    'og:type': 'website',
    'og:url': kanonik,
    'og:site_name': 'KaymakTV',
    'og:locale': metin.locale,
    'og:image': gorsel,
    'og:image:type': 'image/jpeg',
    'og:image:width': '360',
    'og:image:height': '360',
    'og:image:alt': ozet?.gorsel ? baslik : 'KaymakTV',
  };

  const etiketler = Object.entries(og).map(([ad, icerik]) =>
    `<meta property="${ad}" content="${kacir(icerik)}">`
  ).join('') + '<meta name="twitter:card" content="summary">';

  const donusen = new HTMLRewriter()
    .on('head', { element: (el) => el.prepend(etiketler, { html: true }) })
    .on('head meta', {
      element(el) {
        const eski = [el.getAttribute('name'), el.getAttribute('property')];
        if (eski.some((ad) => /^(og|twitter):/i.test(ad ?? ''))) el.remove();
      },
    })
    .transform(yanit);

  const basliklar = new Headers(donusen.headers);
  for (const ad of ['content-length', 'etag', 'last-modified', 'content-md5', 'digest', 'content-digest']) {
    basliklar.delete(ad);
  }
  basliklar.set('Cache-Control', 'private, no-store');
  return new Response(donusen.body, { status: donusen.status, statusText: donusen.statusText, headers: basliklar });
}
