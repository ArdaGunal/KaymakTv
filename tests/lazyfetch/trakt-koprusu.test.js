// ==========================================================================
// TRAKT KÖPRÜSÜ (`/api/trakt-proxy`) — BEYAZ LİSTE  (M414)
// ==========================================================================
// 🔴 NEDEN VAR: köprü GENEL AMAÇLI bir yol (`endpoint` ne verilirse oraya
// gider). Tek koruması `isTraktEndpointAllowed`; bu liste testsizdi.
// M414'te Keşfet araması buraya alındı — listeye eklenen her uç dışarıya
// açılan bir kapıdır, kapsam sessizce genişlemesin.
//
// ⚠️ Bu takım AĞA ÇIKMAZ: yalnızca saf beyaz liste kararı ölçülüyor.

const path = require('path');
const { baslat, PROJE_KOKU } = require('../yardimci');

const T = baslat('TRAKT KOPRUSU BEYAZ LISTE (M414)', { kokOneki: 'lf-koprusu-' });

const { isTraktEndpointAllowed } = require(path.join(PROJE_KOKU, 'server', 'security'));

// ─────────────────────────────────────────────────────────────────────────
T.H('Arama (M414) — GET acik');
T.ok('/search/show GET', isTraktEndpointAllowed('GET', '/search/show') === true);
T.ok('/search/movie GET', isTraktEndpointAllowed('GET', '/search/movie') === true);

// ─────────────────────────────────────────────────────────────────────────
T.H('Arama — kapsam dar');
T.ok('/search/person KAPALI', isTraktEndpointAllowed('GET', '/search/person') === false);
T.ok('/search KAPALI', isTraktEndpointAllowed('GET', '/search') === false);
T.ok('/search/show/extra KAPALI', isTraktEndpointAllowed('GET', '/search/show/extra') === false);
T.ok('Arama POST/DELETE ile gecmez',
  isTraktEndpointAllowed('POST', '/search/show') === false
  && isTraktEndpointAllowed('DELETE', '/search/show') === false);
T.ok('Yol gecisi (..) gecmez', isTraktEndpointAllowed('GET', '/search/show/../users/settings') === false);

// ─────────────────────────────────────────────────────────────────────────
T.H('Onceki kapilar hala yerinde (gerileme kalkani)');
T.ok('/shows/trending acik', isTraktEndpointAllowed('GET', '/shows/trending') === true);
T.ok('/users/settings acik', isTraktEndpointAllowed('GET', '/users/settings') === true);
T.ok('Kisisel gecmis KAPALI (ornek: /sync/history)',
  isTraktEndpointAllowed('GET', '/sync/history') === false);
T.ok('Bilinmeyen fiil KAPALI', isTraktEndpointAllowed('PATCH', '/shows/trending') === false);
T.ok('PUT listesi bos', isTraktEndpointAllowed('PUT', '/users/settings') === false);

T.bitir();
