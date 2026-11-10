// ==========================================================================
// Dinleme adresi — PORT + HOST (GNL-SERVER taşıması · D2)
// ==========================================================================
// 🔴 İDDİALAR: HOST yoksa/boşsa `host: undefined` (bütün arayüzler = Pi'nin bugünkü davranışı) ·
// PORT yoksa 4830 · HOST=127.0.0.1 ile gerçekten yalnız IPv4 loopback'e bağlanır · o soketten gelen
// istekte rate-limit anahtarı yine CF-Connecting-IP (tünel trafiği bozulmaz) · server.js ayarı
// kullanıyor. Ağ YOK: yalnız 127.0.0.1 üzerinde rastgele port.

const path = require('path');
const fs = require('fs');
const http = require('http');
const { baslat, PROJE_KOKU } = require('../yardimci');

const T = baslat('DINLEME ADRESI (D2)', { kokOneki: 'dinleme-' });
const { dinlemeAyari, adresMetni } = require(path.join(PROJE_KOKU, 'server', 'dinleme'));

(async () => {
  T.H('dinlemeAyari');
  const bos = dinlemeAyari({});
  T.ok('Hic ayar yok -> port 4830, host undefined (tum arayuzler)', bos.port === 4830 && bos.host === undefined, JSON.stringify(bos));
  T.ok('HOST bos/bosluk -> undefined', dinlemeAyari({ HOST: '' }).host === undefined && dinlemeAyari({ HOST: '   ' }).host === undefined);
  T.ok("HOST='127.0.0.1' -> aynen", dinlemeAyari({ HOST: ' 127.0.0.1 ' }).host === '127.0.0.1');
  T.ok("PORT='5000' -> 5000; PORT='0' -> 0 (rastgele)", dinlemeAyari({ PORT: '5000' }).port === 5000 && dinlemeAyari({ PORT: '0' }).port === 0);
  T.ok("🔴 PORT='' / '  ' -> 4830 (bos .env satiri rastgele porta ACMAZ)", dinlemeAyari({ PORT: '' }).port === 4830 && dinlemeAyari({ PORT: '  ' }).port === 4830,
    JSON.stringify([dinlemeAyari({ PORT: '' }).port, dinlemeAyari({ PORT: '  ' }).port]));
  T.ok("PORT=' 5000 ' -> 5000", dinlemeAyari({ PORT: ' 5000 ' }).port === 5000);
  T.ok('PORT anlamsiz -> 4830', dinlemeAyari({ PORT: 'abc' }).port === 4830 && dinlemeAyari({ PORT: '-1' }).port === 4830);
  T.ok('adresMetni IPv4 / IPv6', adresMetni({ address: '127.0.0.1', family: 'IPv4', port: 4830 }) === '127.0.0.1:4830'
    && adresMetni({ address: '::', family: 'IPv6', port: 4830 }) === '[::]:4830');

  T.H('Gercek baglanma: HOST=127.0.0.1');
  const express = require('express');
  const { clientIpKey } = require(path.join(PROJE_KOKU, 'server', 'security'));
  const app = express();
  let anahtar = null;
  app.get('/', (req, res) => { anahtar = clientIpKey(req); res.json({ ok: true }); });
  const ayar = dinlemeAyari({ HOST: '127.0.0.1', PORT: '0' });
  const sunucu = await new Promise((coz) => { const s = app.listen(ayar.port, ayar.host, () => coz(s)); });
  const adres = sunucu.address();
  T.ok('🔴 Yalniz 127.0.0.1 e baglandi (IPv4 loopback, tum arayuzler degil)', adres.address === '127.0.0.1' && adres.family === 'IPv4', adresMetni(adres));
  await new Promise((coz, red) => {
    http.get({ host: '127.0.0.1', port: adres.port, path: '/', agent: false, headers: { 'CF-Connecting-IP': '203.0.113.7' } }, (y) => { y.resume(); y.on('end', coz); }).on('error', red);
  });
  T.ok('🔴 127.0.0.1 soketinden gelen tunel istegi CF-Connecting-IP ile anahtarlanir', anahtar === '203.0.113.7', String(anahtar));
  sunucu.closeAllConnections();
  await new Promise((r) => sunucu.close(r));

  T.H('server.js baglantisi');
  const kaynak = fs.readFileSync(path.join(PROJE_KOKU, 'server.js'), 'utf8');
  T.ok('server.js dinlemeAyari ile port + host veriyor', /app\.listen\(dinleme\.port, dinleme\.host,/.test(kaynak));
  T.ok('Eski adressiz app.listen(PORT) kalmadi', !/app\.listen\(PORT\b/.test(kaynak) && !/process\.env\.PORT \|\| 4830/.test(kaynak));

  T.bitir();
})();
