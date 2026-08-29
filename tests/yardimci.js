// ==========================================================================
// LAZYFETCH TESTLERİ — Ortak Yardımcılar
// ==========================================================================
// TEK İŞİ: üç test dosyasının paylaştığı iskeleti tek yerde tutmak (geçici
// SSD kökü · iddia sayacı · özet çıktısı · temizlik).
//
// 🔴 NEDEN HARİCİ TEST PAKETİ (jest/vitest) YOK: `03_FAZLAR.md` "Paket
// önerisi" kuralı — ilk sürümde harici paket eklenmez. Bu testlerin
// ihtiyacı olan her şey (assert sayacı, temp dizin, alt süreç) Node'un
// kendisinde var. Jest eklemek 300+ bağımlılık, bir transform katmanı ve
// Expo/Metro ile çakışma riski getirirdi; kazanç yok.
//
// 🔴 TÜRKÇE KARAKTER KULLANILMIYOR (çıktıda): testler Pi'de SSH üzerinden
// de çalıştırılabilmeli. Denetçinin ASCII geri düşüşü (Madde 257) aynı
// dersin ürünü — burada baştan ASCII yazıp o sorunu hiç doğurmuyoruz.

const fs = require('fs');
const os = require('os');
const path = require('path');

/** Proje kökü — bu dosya `tests/` altında, yani bir üst. */
const PROJE_KOKU = path.join(__dirname, '..');

/** `server/lazyfetch` modüllerinin kökü. MUTLAK YOL GÖMÜLMEZ. */
const LF = path.join(PROJE_KOKU, 'server', 'lazyfetch');

/** `server/archive` modüllerinin kökü — arşiv AYRI bir sistem (cache ≠ arşiv). */
const AR = path.join(PROJE_KOKU, 'server', 'archive');

/**
 * Yeni bir test koşumu başlatır.
 *
 * 🔴 HER KOŞUM KENDİ GEÇİCİ KÖKÜNÜ AÇAR ve `LAZYFETCH_ROOT`'u ona
 * çevirir — gerçek SSD'ye (`/mnt/SSD1/...`) ASLA dokunulmaz. Testler
 * Pi'de canlı sunucu çalışırken de güvenle koşturulabilir.
 *
 * 🔴 TELEMETRİ SUSTURULUR: `EXPO_PUBLIC_KAYMAK_WORKER_URL` boşaltılır,
 * yoksa süpürücünün disk alarmı (%80) test makinesinde tetiklenip
 * Discord operasyon kanalına sahte alarm düşürebilirdi.
 */
function baslat(ad, { kokOneki = 'lf-test-' } = {}) {
  const kok = fs.mkdtempSync(path.join(os.tmpdir(), kokOneki));
  process.env.LAZYFETCH_ROOT = kok;
  process.env.EXPO_PUBLIC_KAYMAK_WORKER_URL = '';

  let gecti = 0;
  let kaldi = 0;
  const kaldiListesi = [];

  console.log('\n########## ' + ad + ' ##########');

  return {
    kok,
    PROJE_KOKU,
    LF,
    AR,

    /** Bir bolum basligi. */
    H(baslik) {
      console.log('\n=== ' + baslik + ' ===');
    },

    /**
     * Tek bir iddia.
     * @param {string} ad     Ne dogrulaniyor
     * @param {boolean} kosul Sonuc
     * @param {string} [not]  Olculen deger (cikti icin)
     */
    ok(ad, kosul, not) {
      const ek = not ? ' -- ' + not : '';
      if (kosul) {
        gecti++;
        console.log('  [GECTI] ' + ad + ek);
      } else {
        kaldi++;
        kaldiListesi.push(ad);
        console.log('  [KALDI] ' + ad + ek);
      }
    },

    /**
     * Koşumu kapatır: geçici kökü siler, özeti basar, çıkış kodunu verir.
     * 🔴 Temizlik `finally` mantığıyla: test patlasa bile temp dizin kalmaz.
     */
    bitir() {
      try {
        fs.rmSync(kok, { recursive: true, force: true });
      } catch (_) {
        // Windows'ta acik dosya tanimi kalabilir; test sonucunu etkilemez.
      }
      console.log('\n' + '-'.repeat(62));
      console.log('SONUC (' + ad + '): ' + gecti + ' gecti / ' + kaldi + ' kaldi');
      if (kaldi) console.log('KALANLAR:\n  - ' + kaldiListesi.join('\n  - '));
      console.log('-'.repeat(62));
      process.exit(kaldi > 0 ? 1 : 0);
    },
  };
}

/** Yasi belli bir dosya olusturur (supurucu testleri icin). */
function dosyaYaz(kok, gorecelYol, yasGun, bayt = 1000) {
  const tam = path.join(kok, gorecelYol);
  fs.mkdirSync(path.dirname(tam), { recursive: true });
  fs.writeFileSync(tam, Buffer.alloc(bayt));
  const t = new Date(Date.now() - yasGun * 24 * 3600 * 1000);
  fs.utimesSync(tam, t, t);
  return tam;
}

module.exports = { baslat, dosyaYaz, LF, AR, PROJE_KOKU };
