// ==========================================================================
// GNL-SERVER systemd birimi + Pi kalıntısı koruması (taşıma D6 + D8)
// ==========================================================================
// 🔴 İDDİALAR:
//  D6 — deploy/gnl-server/kaymaktv.service sunucu düzenine uyar: kullanıcı gnl, /srv yolları,
//       yalnız 127.0.0.1, mutlak `kaymak-node` (Madde 266), .env yoksa başlamaz, Pi yolu yok.
//       Pi'nin şablonu (docs/runbook/kaymak.service.example) Pi kapanana kadar Pi'nin kalır.
//  D8 — sunucu kodu ve betiklerde (server.js, server/, scripts/, deploy/) Pi'ye özgü yol/adres
//       (`/mnt/SSD1`, `/home/GNL`, `192.168.1.15`) HİÇ geçmez — yorumlardaki örnekler dahil: kopyalanıp
//       çalıştırılan örnek komut yeni sunucuda yanlış diske bakardı. Pi'yi hedeflemek gerekirse
//       adres ortamdan verilir (scripts/web-yerel.sh KAYMAK_PI).
// Ağ YOK, yalnız dosya okuma.

const path = require('path');
const fs = require('fs');
const { baslat, PROJE_KOKU } = require('../yardimci');

const T = baslat('BIRIM DOSYASI + PI KALINTISI (D6/D8)', { kokOneki: 'birim-' });
const oku = (g) => fs.readFileSync(path.join(PROJE_KOKU, g), 'utf8').replace(/\r\n/g, '\n');

(async () => {
  T.H('D6: deploy/gnl-server/kaymaktv.service');
  const birim = oku('deploy/gnl-server/kaymaktv.service');
  const ayar = (anahtar) => birim.split('\n').filter((s) => s.startsWith(`${anahtar}=`)).map((s) => s.slice(anahtar.length + 1));
  T.ok('User=gnl, Group=gnl', ayar('User').join() === 'gnl' && ayar('Group').join() === 'gnl');
  T.ok('WorkingDirectory /srv/projeler/kaymaktv/app', ayar('WorkingDirectory').join() === '/srv/projeler/kaymaktv/app');
  const ortam = ayar('Environment');
  T.ok('LAZYFETCH_ROOT /srv/projeler/kaymaktv/data/LazyFetch', ortam.includes('LAZYFETCH_ROOT=/srv/projeler/kaymaktv/data/LazyFetch'), ortam.join(' '));
  T.ok('🔴 HOST=127.0.0.1 + PORT=4830 (disariya yalniz tunel)', ortam.includes('HOST=127.0.0.1') && ortam.includes('PORT=4830'));
  T.ok('NODE_ENV=production', ortam.includes('NODE_ENV=production'));
  T.ok('🔴 GECE_ISLERI / ANLIK_AKTARIM birimde YOK (prova .env den kapatir, canli acik kalir)', !ortam.some((e) => /^(GECE_ISLERI|ANLIK_AKTARIM|ARCHIVE_BACKUP)/.test(e)));
  T.ok('🔴 ExecStart mutlak kaymak-node (env node degil — Madde 266)', ayar('ExecStart').join() === '/usr/local/bin/kaymak-node server.js' && !/\/usr\/bin\/env node/.test(birim.split('\n').filter((s) => !s.startsWith('#')).join('\n')));
  T.ok('.env yoksa baslamaz', ayar('ConditionPathExists').join() === '/srv/projeler/kaymaktv/config/.env');
  T.ok('Restart=always, TimeoutStopSec > 8 sn kapanis siniri', ayar('Restart').join() === 'always' && Number(ayar('TimeoutStopSec')[0]) > 8);
  T.ok('network-online sonrasi + multi-user', ayar('After').join().includes('network-online.target') && ayar('WantedBy').join() === 'multi-user.target');
  T.ok('Uc bolum de var', ['[Unit]', '[Service]', '[Install]'].every((b) => birim.includes(`\n${b}\n`)));

  T.H('D6: Pi sablonu Pi nin kalir');
  const pi = oku('docs/runbook/kaymak.service.example');
  T.ok('Pi sablonu yerinde ve hala Pi duzeninde (User=GNL, Pi SSD yolu)', /\nUser=GNL\n/.test(pi) && pi.includes('Environment=LAZYFETCH_ROOT=/mnt/SSD1/KaymakTv/LazyFetch'));

  T.H('D8: Pi kalintisi yok');
  const YASAK = /\/mnt\/SSD1|\/home\/GNL|192\.168\.1\.15\b/;
  const UZANTI = /\.(js|mjs|cjs|sh|service)$/;
  const dosyalar = ['server.js'];
  const gez = (dizin) => {
    for (const g of fs.readdirSync(path.join(PROJE_KOKU, dizin), { withFileTypes: true })) {
      const yol = `${dizin}/${g.name}`;
      if (g.isDirectory()) { if (g.name !== 'node_modules') gez(yol); } else if (UZANTI.test(g.name)) dosyalar.push(yol);
    }
  };
  for (const d of ['server', 'scripts', 'deploy']) gez(d);
  const bulunan = [];
  for (const f of dosyalar) {
    oku(f).split('\n').forEach((s, i) => { if (YASAK.test(s)) bulunan.push(`${f}:${i + 1}`); });
  }
  T.ok(`${dosyalar.length} dosya tarandi (server.js + server/ + scripts/ + deploy/)`, dosyalar.length > 50 && dosyalar.includes('scripts/web-yerel.sh') && dosyalar.includes('deploy/gnl-server/kaymaktv.service'), String(dosyalar.length));
  T.ok('🔴 Pi yolu / adresi HICBIR satirda yok (yorumlar dahil)', bulunan.length === 0, bulunan.slice(0, 8).join(', '));
  // Koruma gerçekten yakalıyor mu (desen bozulursa test boşa geçmesin):
  T.ok('Desen ornekleri yakaliyor', ['LAZYFETCH_ROOT=/mnt/SSD1/x', "'/home/GNL/KaymakTv/.env'", 'GNL@192.168.1.15'].every((s) => YASAK.test(s))
    && !YASAK.test('/srv/projeler/kaymaktv/data/LazyFetch') && !YASAK.test('gnl@192.168.1.8') && !YASAK.test('192.168.1.150'));

  T.bitir();
})();
