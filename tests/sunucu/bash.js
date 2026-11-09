// ==========================================================================
// Betik testleri için bash bulucu (GNL-SERVER taşıması · D5/D7)
// ==========================================================================
// 🔴 Windows'ta PowerShell'den `npm test` koşunca `bash` adı System32'deki WSL köprüsüne çözülür ve
// (WSL dağıtımı yoksa) düşer — ölçüldü 2026-11-09. Git Bash'in tam yolu önce denenir. Sunucuda / Pi'de
// (Linux) düz `bash`. Hiçbiri yoksa null → test «atlandı» der, sahte KALDI üretmez.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function bashBul() {
  const adaylar = process.platform === 'win32'
    ? [
        process.env.KAYMAK_TEST_BASH,
        path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Git', 'bin', 'bash.exe'),
        path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Git', 'bin', 'bash.exe'),
      ]
    : [process.env.KAYMAK_TEST_BASH, 'bash'];
  for (const aday of adaylar.filter(Boolean)) {
    if (path.isAbsolute(aday) && !fs.existsSync(aday)) continue;
    const r = spawnSync(aday, ['-c', 'echo ok'], { encoding: 'utf8' });
    if (r.status === 0 && r.stdout.trim() === 'ok') return aday;
  }
  return null;
}

/**
 * Betiği, `sahteBin` dizini PATH'in EN ÖNÜNDE olacak şekilde koşar.
 * Git Bash açılışta kendi dizinlerini PATH'in önüne koyar (gerçek git/ssh önce bulunurdu) — sahte
 * dizin bash İÇİNDE öne alınır. Linux'ta cygpath yok, yol aynen kullanılır.
 */
function bashKos(bash, betik, argumanlar, env, sahteBin) {
  const ileri = (p) => p.replace(/\\/g, '/');
  const ortam = { ...env, SAHTE_BIN: ileri(sahteBin) };
  if (process.env.SystemRoot) ortam.SystemRoot = process.env.SystemRoot;
  const onAl = 'export PATH="$(cygpath -u "$SAHTE_BIN" 2>/dev/null || echo "$SAHTE_BIN"):$PATH"; exec bash "$0" "$@"';
  return spawnSync(bash, ['-c', onAl, ileri(betik), ...argumanlar], { encoding: 'utf8', env: ortam });
}

/** Ağa çıkan araçların (ssh, curl, scp) sahteleri: çağrılırsa `GERCEK-AG <ad>` yazar ve 97 ile düşer. */
function agiKes(dizin) {
  fs.mkdirSync(dizin, { recursive: true });
  for (const ad of ['ssh', 'curl', 'scp']) {
    fs.writeFileSync(path.join(dizin, ad), `#!/usr/bin/env bash
echo "GERCEK-AG ${ad} $*"
exit 97
`, { mode: 0o755 });
  }
  return dizin;
}

module.exports = { bashBul, bashKos, agiKes };
