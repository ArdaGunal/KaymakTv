#!/usr/bin/env node
// ==========================================================================
// Web paketini AYRI bir env dosyasıyla derle (GNL-SERVER taşıması · D7, danışman 002 §3.2)
// ==========================================================================
// Kullanım: node scripts/sunucu/derleme-env.js <env-dosyasi> -- <komut> [argüman...]
//   ör.     node scripts/sunucu/derleme-env.js /srv/projeler/kaymaktv/config/.env.pi-20261120 -- \
//             npx expo export --platform web --output-dir dist.yeni
//
// NEDEN: `expo export` `EXPO_PUBLIC_*` değerlerini pakete GÖMER ve onları proje kökündeki `.env`'den
// okur. Provada sunucu süreci Worker'sız bir env ile çalışır (Supabase'e çift yazım olmasın); aynı
// env ile derlenen paket canlıdakinden FARKLI olur (Worker adresi boş). Bu sarmalayıcı yalnız
// `EXPO_PUBLIC_*` anahtarlarını verilen dosyadan alıp komutun ORTAMINA koyar; `@expo/env` ortamda
// zaten tanımlı değişkeni `.env` ile EZMEZ (`node_modules/@expo/env/build/index.js:317-321`, 2.0.12).
//
// 🔒 Değer YAZDIRILMAZ — yalnız anahtar sayısı. Sır olan (EXPO_PUBLIC_ olmayan) anahtarlar alt
// sürece HİÇ geçmez. Dosya başkalarınca okunabiliyorsa (Linux, mod & 077) uyarır.

const fs = require('fs');
const { spawnSync } = require('child_process');
const dotenv = require('dotenv');

function ayir(argv) {
  const ayrac = argv.indexOf('--');
  if (ayrac !== 1 || argv.length < 3) return null;
  return { dosya: argv[0], komut: argv[2], argumanlar: argv.slice(3) };
}

/** Dosyadaki yalnız `EXPO_PUBLIC_*` anahtarları. */
function herkeseAcikAnahtarlar(metin) {
  const hepsi = dotenv.parse(metin);
  return Object.fromEntries(Object.entries(hepsi).filter(([k]) => k.startsWith('EXPO_PUBLIC_')));
}

function main() {
  const a = ayir(process.argv.slice(2));
  if (!a) {
    console.error('kullanim: derleme-env.js <env-dosyasi> -- <komut> [arguman...]');
    return 2;
  }
  let metin;
  try {
    metin = fs.readFileSync(a.dosya, 'utf8');
  } catch (e) {
    console.error(`[derleme-env] env dosyasi okunamadi (${e.code || 'hata'}): ${a.dosya}`);
    return 2;
  }
  if (process.platform !== 'win32') {
    const mod = fs.statSync(a.dosya).mode & 0o777;
    if (mod & 0o077) console.warn(`[derleme-env] UYARI: ${a.dosya} baskalarinca okunabilir (mod ${mod.toString(8)}); 600 olmali.`);
  }
  const acik = herkeseAcikAnahtarlar(metin);
  const adet = Object.keys(acik).length;
  if (!adet) {
    console.error('[derleme-env] dosyada EXPO_PUBLIC_ anahtari yok — yanlis dosya?');
    return 2;
  }
  console.log(`[derleme-env] ${adet} EXPO_PUBLIC_ anahtari derleme ortamina kondu (degerler yazdirilmaz).`);
  const r = spawnSync(a.komut, a.argumanlar, { stdio: 'inherit', env: { ...process.env, ...acik } });
  if (r.error) {
    console.error(`[derleme-env] komut calismadi: ${r.error.code || r.error.message}`);
    return 1;
  }
  return r.status === null ? 1 : r.status;
}

module.exports = { ayir, herkeseAcikAnahtarlar };

if (require.main === module) process.exit(main());
