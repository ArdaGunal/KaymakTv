// ==========================================================================
// ARŞİV SAYAÇLARI — "bir şey kayboldu mu?" (§C22)
// ==========================================================================
// 🔴 NEDEN VAR: 2026-09-14'te `external_ids`'ten bir satır kayboldu ve
// arşivin bunu söyleyebilecek hiçbir organı yoktu — kaybı ertesi gün,
// ilgisiz bir borcu kovalarken, GECE YEDEKLERİNİ karşılaştırarak bulduk.
// `sayac.js` o organ; bu takım da organın gerçekten gördüğünü kanıtlıyor.
//
// 🔑 BU DOSYANIN EN ÖNEMLİ İDDİASI DÜŞÜŞ ALARMI DEĞİL, **SAHTE ALARMIN
// OLMAMASI**: §C20'nin mezar taşı bir eşlemeyi emekli ettiğinde satır
// DURUYOR. Sayaç `retired_at IS NULL` süzgeciyle saysaydı her kimlik
// değişimi "kayıp" görünür, alarm güvenilirliğini ilk haftada yitirirdi.

const path = require('path');
const { baslat, AR } = require('../yardimci');

const T = baslat('ARSIV SAYACLARI (C22)', { kokOneki: 'ar-sayac-' });

const db = require(path.join(AR, 'db'));
const kimlik = require(path.join(AR, 'identity'));
const depo = require(path.join(AR, 'store'));
const stats = require(path.join(AR, 'stats'));
const sayac = require(path.join(AR, 'sayac'));

/** `sync_log`'daki son `sayac` satırının detayı. */
function sonSayacSatiri(bag) {
  const r = bag.prepare("SELECT detail FROM sync_log WHERE event='sayac' ORDER BY id DESC LIMIT 1").get();
  return r ? r.detail : null;
}
function dususAlarmiSayisi(bag) {
  return bag.prepare("SELECT count(*) c FROM sync_log WHERE event='error' AND detail LIKE 'SAYAC DUSUSU:%'").get().c;
}

(async () => {
  const durum = db.initArchive();
  if (!durum.enabled) {
    T.ok('Arsiv acilamadi - atlaniyor', false, durum.reason);
    T.bitir();
    return;
  }
  const bag = db.getDb();

  // Gerçek veri koy: 1 entity + 2 dış kimlik + 1 payload
  const e1 = kimlik.resolveOrCreate({
    type: 'show',
    externalIds: [{ source: 'trakt:show', source_id: '1388' }, { source: 'tmdb:show', source_id: '1396' }],
    derived: { title: 'Breaking Bad', year: 2008 },
  });
  await depo.upsertPayload({
    kaymakId: e1.kaymak_id, provider: 'trakt', endpoint: 'show_detail', lang: 'tr',
    data: { title: 'Breaking Bad' },
  });

  // ==================================================================
  T.H('ILK SAYIM — taban kuruluyor, alarm YOK');
  // ==================================================================
  const ilk = sayac.sayimYap();
  T.ok('Sayim kostu', ilk.ok === true, ilk.reason || '');
  T.ok('ILK olarak isaretlendi', ilk.ilk === true);
  T.ok('Dusus YOK (karsilastirilacak taban yoktu)', ilk.dusus.length === 0);
  T.ok('entities 1 sayildi', ilk.simdiki.entities === 1, String(ilk.simdiki.entities));
  T.ok('external_ids 2 sayildi', ilk.simdiki.external_ids === 2, String(ilk.simdiki.external_ids));
  T.ok('payloads 1 sayildi', ilk.simdiki.payloads === 1, String(ilk.simdiki.payloads));
  T.ok('Defterde ILK SAYIM yazili', /ILK SAYIM/.test(sonSayacSatiri(bag) || ''), sonSayacSatiri(bag));
  T.ok('Hic alarm yok', dususAlarmiSayisi(bag) === 0);

  // ==================================================================
  T.H('DEGISIKLIK YOKKEN de yaziliyor (sessizlik != saglik)');
  // ==================================================================
  // "Sessizce hicbir sey yapmadi" ile "calismadi" ayirt edilebilmeli.
  // §C16 tam bu satirda basarisiz olmustu.
  const ikinci = sayac.sayimYap();
  T.ok('Artik ILK degil', ikinci.ilk === false);
  T.ok('Dusus YOK', ikinci.dusus.length === 0);
  T.ok('Defterde sifir delta yazili', /entities 1 \(\+0\)/.test(sonSayacSatiri(bag) || ''), sonSayacSatiri(bag));

  // ==================================================================
  T.H('BUYUME — pozitif delta, alarm YOK');
  // ==================================================================
  kimlik.resolveOrCreate({
    type: 'movie',
    externalIds: [{ source: 'trakt:movie', source_id: '5000' }],
    derived: { title: 'Arrival', year: 2016 },
  });
  const buyume = sayac.sayimYap();
  T.ok('entities 1 -> 2', buyume.simdiki.entities === 2);
  T.ok('Dusus YOK', buyume.dusus.length === 0);
  T.ok('Defterde +1 yazili', /entities 2 \(\+1\)/.test(sonSayacSatiri(bag) || ''), sonSayacSatiri(bag));
  T.ok('Hala alarm yok', dususAlarmiSayisi(bag) === 0);

  // ==================================================================
  T.H('🔑 MEZAR TASI SAHTE ALARM URETMIYOR');
  // ==================================================================
  // §C20 bir eslemeyi emekli ettiginde satir DURUYOR — silinmiyor. Sayac
  // `retired_at IS NULL` sayiyor olsaydi bu "kayip" gorunur ve alarm her
  // kimlik degisiminde calardi. Toplam sayildigi icin calmamali.
  bag.prepare("UPDATE external_ids SET retired_at = ? WHERE source = 'tmdb:show'").run(Date.now());
  const emekliSonrasi = sayac.sayimYap();
  T.ok('Emekli satir HALA sayiliyor (external_ids 3)',
    emekliSonrasi.simdiki.external_ids === 3, String(emekliSonrasi.simdiki.external_ids));
  T.ok('🔴 SAHTE ALARM YOK', emekliSonrasi.dusus.length === 0,
    emekliSonrasi.dusus.join(' | '));
  T.ok('Alarm sayaci hala 0', dususAlarmiSayisi(bag) === 0);
  T.ok('Emekli sayisi raporlandi', emekliSonrasi.emekli === 1, String(emekliSonrasi.emekli));
  T.ok('Defterde emekli yazili', /emekli 1/.test(sonSayacSatiri(bag) || ''), sonSayacSatiri(bag));

  // ==================================================================
  T.H('🔴 GERCEK KAYIP — alarm CALIYOR');
  // ==================================================================
  // §C22'nin birebir senaryosu: `external_ids`ten bir satir yok oluyor.
  const hatalar = [];
  const eskiError = console.error;
  console.error = (...a) => hatalar.push(a.join(' '));
  bag.prepare("DELETE FROM external_ids WHERE source = 'trakt:movie'").run();
  const kayip = sayac.sayimYap();
  console.error = eskiError;

  T.ok('Dusus TESPIT EDILDI', kayip.dusus.length === 1, kayip.dusus.join(' | '));
  T.ok('Dogru tablo gosterildi', /external_ids 3 -> 2 \(-1\)/.test(kayip.dusus[0] || ''), kayip.dusus[0]);
  T.ok('🔴 sync_log a ERROR yazildi', dususAlarmiSayisi(bag) === 1);
  T.ok('Konsola da bagirildi', hatalar.some((h) => /DUSUS/.test(h)), hatalar[0] || 'sessiz kaldi');

  const alarm = bag.prepare("SELECT detail FROM sync_log WHERE event='error' AND detail LIKE 'SAYAC DUSUSU:%'").get().detail;
  T.ok('Alarm metni muhurlu karari aniyor', /muhurlu karar #9/.test(alarm), alarm.slice(0, 80));
  T.ok('Alarm metni yedekten yukleme ihtimalini de soyluyor', /geri yukleme/.test(alarm));

  // 🔑 Alarm turundan SONRA taban guncellenmis olmali — yoksa ayni dusus
  // her gece yeniden alarm verir ve defteri bogar.
  const tekrar = sayac.sayimYap();
  T.ok('🔴 Ayni dusus IKINCI KEZ alarm vermiyor (taban guncellendi)',
    tekrar.dusus.length === 0 && dususAlarmiSayisi(bag) === 1);

  // ==================================================================
  T.H('BUGUN SAYILDI MI — bellekten degil DEFTERDEN');
  // ==================================================================
  T.ok('bugunSayildiMi() true', sayac.bugunSayildiMi() === true);
  bag.prepare("DELETE FROM sync_log WHERE event='sayac'").run();
  T.ok('Defter silinince false doner (bellege guvenmiyor)', sayac.bugunSayildiMi() === false);

  // ==================================================================
  T.H('🪤 META ONEKI CAKISMASI — stats.js sayaclari silerken');
  // ==================================================================
  // `stats.js resetFallbackStats()` `meta`da `fallback_aile_%` siliyor.
  // Sayac anahtarlari `sayac_` onekli; carpismamali. Bu iddia bir TUZAGI
  // kilitliyor: onek ileride degistirilirse burasi yanar.
  sayac.sayimYap();
  const oncesi = bag.prepare("SELECT count(*) c FROM meta WHERE key LIKE 'sayac_%'").get().c;
  T.ok('Sayac anahtarlari meta da (3 tablo + at)', oncesi === 4, String(oncesi));
  stats.resetFallbackStats();
  const sonrasi = bag.prepare("SELECT count(*) c FROM meta WHERE key LIKE 'sayac_%'").get().c;
  T.ok('🔴 resetFallbackStats() sayaclari SILMEDI', sonrasi === oncesi, `${oncesi} -> ${sonrasi}`);

  // ==================================================================
  T.H('sayac olayi SOZLUKTE — uyari vermeden yaziliyor');
  // ==================================================================
  // §C16 ile gelen `BILINEN_OLAYLAR` sozlugu `sayac`i taniyor olmali;
  // tanimasaydi her gece bir `console.warn` dusurur, gurultu olurdu.
  const uyarilar = [];
  const eskiWarn = console.warn;
  console.warn = (...a) => uyarilar.push(a.join(' '));
  depo.logSync({ event: 'sayac', detail: 'sozluk kontrolu' });
  console.warn = eskiWarn;
  T.ok('sayac TANINIYOR (uyari yok)', uyarilar.length === 0, uyarilar[0] || '');

  db.closeArchive();
  T.bitir();
})();
