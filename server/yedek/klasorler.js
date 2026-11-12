// ==========================================================================
// YEDEK KLASÖRLERİ — tek kaynak (029 · 2026-11-12)
// ==========================================================================
// TEK İŞİ: KaymakTV yedeklerinin NEREYE yazıldığını tek yerden söylemek.
//
// 🔴 KULLANICI KURALI (2026-11-12): "bu proje ile karışmayacak şekilde, sadece kendi klasöründe …
// ilerde farklı projeler yaparsam da sorun olmasın." Yedek diskinde (`/srv/yedekler`) başka projeler
// de yedeklenecek. Bu yüzden KaymakTV'nin HER yedeği tek bir proje kökünün ALTINDA durur ve kod o
// kökün dışına hiçbir şey yazmaz, oradan hiçbir şey silmez:
//
//   /srv/yedekler/kaymaktv/          ← proje kökü (ARCHIVE_BACKUP_DIR'in üst klasörü)
//     BENIOKU.txt                    ← bu düzenin açıklaması (gece turu yazar)
//     arsiv/      katalog-<damga>.db          günlük arşiv yedeği (VACUUM INTO)
//     lazyfetch/  lazyfetch-<damga>.tar (+ .sha256, .json)  haftalık önbellek yedeği
//     elle/       elle-*-<damga>.db           elle / onarım öncesi yedekler
//     sinama/     sinama-<damga>.json         aylık geri yükleme sınaması raporları
//     gecici/     sınama sırasında açılan geçici kopya (iş bitince silinir)
//
// Tek ayar `ARCHIVE_BACKUP_DIR` (bugünkü env). Son klasörü `arsiv` ise üst klasörü proje kökü
// sayılır; değilse (eski Pi düzeni: `~/kaymak-arsiv-yedek`) kardeş klasörler `<dizin>-lazyfetch`
// gibi YANINA açılır — yine de başka bir projenin klasörüne asla girmez.
//
// Damga her yerde aynı: `new Date().toISOString()` → `2026-11-12T02-27-09` (UTC).

const fs = require('fs');
const path = require('path');

const ALT_KLASORLER = ['arsiv', 'lazyfetch', 'elle', 'sinama', 'gecici'];

/** Arşiv yedek dizini — `ARCHIVE_BACKUP_DIR`, yoksa ev dizini (eski Pi'de SD kart = başka aygıt). */
function arsivYedekDizini(ortam = process.env) {
  const env = String(ortam.ARCHIVE_BACKUP_DIR ?? '').trim();
  if (env) return env;
  const ev = ortam.HOME || ortam.USERPROFILE;
  return ev ? path.join(ev, 'kaymak-arsiv-yedek') : null;
}

/**
 * Tüm yedek klasörleri. Arşiv dizini çözülemezse `null`.
 * @returns {{kok: string|null, arsiv: string, lazyfetch: string, elle: string, sinama: string, gecici: string}|null}
 */
function yedekKlasorleri(ortam = process.env) {
  const arsiv = arsivYedekDizini(ortam);
  if (!arsiv) return null;
  const projeKoku = path.basename(arsiv) === 'arsiv' ? path.dirname(arsiv) : null;
  const yan = (ad) => (projeKoku ? path.join(projeKoku, ad) : `${arsiv}-${ad}`);
  return {
    kok: projeKoku,
    arsiv,
    lazyfetch: yan('lazyfetch'),
    elle: yan('elle'),
    sinama: yan('sinama'),
    gecici: yan('gecici'),
  };
}

/** Aynı diske yedek AÇIKÇA izinli mi? Yalnız `ARCHIVE_BACKUP_AYNI_AYGIT === '1'` (taşıma D3). */
function ayniAygitIzinli(ortam = process.env) {
  return String(ortam.ARCHIVE_BACKUP_AYNI_AYGIT ?? '').trim() === '1';
}

/**
 * İki yol AYNI aygıtta mı? `st_dev` fiziksel aygıtı gösterir (aynı aygıttaki iki mount ayrı `statfs`
 * verebilir). Kararsızsak `false`: engellemeyiz, çağıran günlüğe yazar.
 */
function ayniAygitMi(a, b) {
  try {
    return fs.statSync(a).dev === fs.statSync(b).dev;
  } catch {
    return false;
  }
}

/** `2026-11-12T02-27-09` — UTC, dosya adına uygun. */
function damgaUret(simdi = new Date()) {
  return simdi.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

const BENIOKU = `KaymakTV yedekleri — bu klasör yalnız KaymakTV'nindir.
Başka projelerin yedekleri kendi klasörlerinde durur; bu klasördeki kod dışarıya yazmaz, dışarıdan silmez.
Bu dosyayı gece yedek turu yazar (server/yedek/klasorler.js); elle değiştirme, bir sonraki turda geri yazılır.

arsiv/      katalog-<damga>.db
            Katalog arşivinin (data/LazyFetch/archive/katalog.db) günlük kopyası, her sabah 05-07 arası.
            Saklama: en yeni 7 kopya + son 4 haftanın her birinden 1 + son 4 ayın her birinden 1;
            120 günden eskisi silinir (en yeni 7 her zaman kalır).
            Geri yükleme: servis durur, katalog.db kenara alınır, kopya katalog.db adıyla yerine konur
            (-wal / -shm dosyaları kenara alınanla birlikte gider), servis başlar.

lazyfetch/  lazyfetch-<damga>.tar  +  .sha256 (sha256sum -c ile doğrulanır)  +  .json (dosya sayısı, bayt)
            LazyFetch önbelleğinin (cache/ + quarantine/) haftalık kopyası, pazar sabahı.
            Saklama: son 4 hafta + son 4 ay, 120 gün.
            Geri yükleme: servis durur, data/LazyFetch/cache kenara alınır,
            tar -xf <dosya> -C /srv/projeler/kaymaktv/data/LazyFetch, servis başlar.

elle/       elle-*-<damga>.db
            Elle alınan ve onarım araçlarının yazımdan önce aldığı yedekler.
            Saklama: 120 günden eskisi silinir, en yeni 2 her zaman kalır.

sinama/     sinama-<damga>.json
            Aylık geri yükleme sınamasının raporu: en yeni arşiv yedeği geçici bir kopyada açılır
            (bütünlük, sayılar, çoklu-aktif kimlik), LazyFetch tar'ı sha256 ve dosya sayısıyla doğrulanır.
            Elle: npm run yedek:sina

gecici/     Sınama sırasındaki geçici kopya; iş bitince silinir. Boş durması normaldir.

<damga> = UTC zaman, ör. 2026-11-12T02-27-09. Yaş dosya adından okunur; adı bu desene uymayan
dosyalara hiçbir budama dokunmaz.
`;

/**
 * Proje köküne `BENIOKU.txt` yazar (içerik farklıysa). Proje kökü yoksa (eski düzen) yazmaz.
 * Throw ETMEZ. @returns {boolean} yazıldı mı
 */
function beniokuYaz(klasor) {
  if (!klasor || !klasor.kok) return false;
  const hedef = path.join(klasor.kok, 'BENIOKU.txt');
  try {
    if (fs.existsSync(hedef) && fs.readFileSync(hedef, 'utf8') === BENIOKU) return false;
    fs.writeFileSync(hedef, BENIOKU, { mode: 0o640 });
    return true;
  } catch (_) {
    return false;
  }
}

module.exports = {
  ALT_KLASORLER,
  arsivYedekDizini,
  yedekKlasorleri,
  ayniAygitIzinli,
  ayniAygitMi,
  damgaUret,
  beniokuYaz,
  BENIOKU,
};
