// ==========================================================================
// scripts/web-yerel.sh hedefi (GNL-SERVER taşıması · D5)
// ==========================================================================
// 🔴 İDDİALAR: varsayılan hedef GNL-SERVER (`gnl@192.168.1.8`, anahtar gnl_server, birim `kaymaktv`) ·
// yalnız KAYMAK_PI verilince eski Pi düzeni (anahtar kaymak_pi, birim `kaymak`) · KAYMAK_BIRIM her
// zaman ezer · drop-in ve kapatma zamanlayıcısı birim adından türer · KURU kipte SSH/curl
// ÇALIŞMAZ. Ağ YOK: WEB_YEREL_KURU=1 VE ssh/curl sahte (KURU bozulsa bile ağa çıkılamaz — mutasyon
// denetiminde KURU koruması kaldırılınca gerçek ssh denendi, 2026-11-09; o yüzden iki kat).

const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { baslat, PROJE_KOKU } = require('../yardimci');
const { bashBul, bashKos, agiKes } = require('./bash');

const T = baslat('WEB-YEREL HEDEFI (D5)', { kokOneki: 'web-yerel-' });
const BETIK = path.join(PROJE_KOKU, 'scripts', 'web-yerel.sh');

const bash = bashBul();
const SAHTE_BIN = agiKes(path.join(T.kok, 'bin'));

const agaCikti = [];
function kos(komut, ek = {}) {
  // Ortam bilinçli olarak dar: kullanıcının KAYMAK_* değişkenleri testi etkilemesin.
  const ortam = { PATH: process.env.PATH, HOME: '/ev', WEB_YEREL_KURU: '1', ...ek };
  const r = bashKos(bash, BETIK, [komut], ortam, SAHTE_BIN);
  const cikti = (r.stdout || '') + (r.stderr || '');
  if (cikti.includes('GERCEK-AG')) agaCikti.push(`${komut}: ${cikti.split('\n').find((s) => s.includes('GERCEK-AG'))}`);
  return { kod: r.status, cikti };
}

(async () => {
  T.H('Soz dizimi');
  if (!bash) {
    T.ok('bash bulunamadi -> betik testleri ATLANDI (sunucuda/Pi de kosar)', true);
    T.bitir();
    return;
  }
  const n = spawnSync(bash, ['-n', BETIK], { encoding: 'utf8' });
  T.ok('bash -n gecer', n.status === 0, (n.stderr || '').trim());

  T.H('Varsayilan hedef: GNL-SERVER');
  const v = kos('durum');
  T.ok('Cikis 0', v.kod === 0, v.cikti.trim().split('\n')[0]);
  T.ok('Hedef gnl@192.168.1.8 + anahtar gnl_server', /KURU ssh gnl@192\.168\.1\.8 -i \/ev\/\.ssh\/gnl_server /.test(v.cikti), v.cikti.split('\n')[0]);
  T.ok('Drop-in kaymaktv.service.d altinda', v.cikti.includes('/etc/systemd/system/kaymaktv.service.d/yerel-web.conf'));
  T.ok('Kapatma zamanlayicisi kaymaktv-yerel-web-kapat', v.cikti.includes('kaymaktv-yerel-web-kapat.timer'));
  T.ok('🔴 KURU: gercek olcum yapilmadi', v.cikti.includes('KURU olcum') && !v.cikti.includes('Olcum:'));

  const ac = kos('ac');
  T.ok('ac: kaymaktv.service yeniden baslatilir, kaymak.service DEGIL', /restart kaymaktv\.service/.test(ac.cikti) && !/restart kaymak\.service/.test(ac.cikti));
  T.ok('ac: otomatik kapanis 3h ve ayni birim', /--unit=kaymaktv-yerel-web-kapat --on-active=3h/.test(ac.cikti));

  T.H('Eski Pi (gecise kadar)');
  const pi = kos('kapat', { KAYMAK_PI: 'GNL@pi.ornek' });
  T.ok('Yalniz KAYMAK_PI -> Pi anahtari + kaymak birimi', /KURU ssh GNL@pi\.ornek -i \/ev\/\.ssh\/kaymak_pi /.test(pi.cikti)
    && pi.cikti.includes('/etc/systemd/system/kaymak.service.d/yerel-web.conf') && /restart kaymak\.service/.test(pi.cikti), pi.cikti.split('\n')[0]);
  const pib = kos('durum', { KAYMAK_PI: 'GNL@pi.ornek', KAYMAK_BIRIM: 'baska' });
  T.ok('KAYMAK_BIRIM Pi kipinde de ezer', pib.cikti.includes('/etc/systemd/system/baska.service.d/'));
  const ikisi = kos('durum', { KAYMAK_PI: 'GNL@pi.ornek', KAYMAK_SUNUCU: 'gnl@sunucu.ornek' });
  T.ok('KAYMAK_SUNUCU varsa KAYMAK_PI yok sayilir', /KURU ssh gnl@sunucu\.ornek -i \/ev\/\.ssh\/gnl_server /.test(ikisi.cikti) && ikisi.cikti.includes('kaymaktv.service.d'));

  T.H('Kaynak');
  const kaynak = fs.readFileSync(BETIK, 'utf8');
  T.ok('IdentitiesOnly=yes (yanlis anahtar denemesi yok)', kaynak.includes('IdentitiesOnly=yes'));
  T.ok('Kaynakta Pi adresi yok (yalniz ortamdan)', !/192\.168\.1\.15/.test(kaynak));
  T.ok('Bilinmeyen komut -> cikis 1', kos('xyz').kod === 1);
  T.ok('🔴 Hicbir kosuda ssh/curl CAGRILMADI (KURU koruma calisiyor)', agaCikti.length === 0, agaCikti.slice(0, 2).join(' | '));

  T.bitir();
})();
