// ==========================================================================
// GERI YUKLEME SINAMASI + SABAH EK ISLERI + SAGLIK OZETI (029 §3-§4 · 2026-11-12)
// ==========================================================================
// Gercek bir arsiv (gecici kok) -> gercek VACUUM yedegi -> sinama: butunluk + sayilar + coklu-aktif +
// canliyla karsilastirma. Bozuk yedek, coklu-aktif kimlik ve "yedekte canlidan fazla" DUSURUR.
// Ek isler (elle/ budamasi, haftalik tar, aylik sinama) diskten karar verir: ayni gun ikinci tur is
// yapmaz. Saglik ozeti yol/ad sizdirmaz. Ag yok, telemetri sahte.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { baslat, AR, PROJE_KOKU } = require('../yardimci');

const T = baslat('YEDEK SINAMASI (029)', { kokOneki: 'yedek-sinama-' });
const Y = path.join(PROJE_KOKU, 'server', 'yedek');

// Yedek koku arsivden AYRI bir gecici klasorde; proje koku duzeni (<kok>/arsiv).
const disKok = fs.mkdtempSync(path.join(os.tmpdir(), 'yedek-kok-'));
const projeKoku = path.join(disKok, 'kaymaktv');
process.env.ARCHIVE_BACKUP_DIR = path.join(projeKoku, 'arsiv');
process.env.ARCHIVE_BACKUP_AYNI_AYGIT = '1'; // testte tek disk var

const db = require(path.join(AR, 'db'));
const kimlik = require(path.join(AR, 'identity'));
const depo = require(path.join(AR, 'store'));
const { yedekKlasorleri, BENIOKU } = require(path.join(Y, 'klasorler'));
const sinama = require(path.join(Y, 'sinama'));
const { yedekEkIsleri } = require(path.join(Y, 'ekIsler'));
const { yedekOzeti } = require(path.join(Y, 'ozet'));
const GUN = 24 * 3600 * 1000;
const damga = (t) => t.toISOString().replace(/[:.]/g, '-').slice(0, 19);

(async () => {
  const durum = db.initArchive();
  if (!durum.enabled) { T.ok('arsiv acilamadi', false, durum.reason); T.bitir(); return; }
  const e = kimlik.resolveOrCreate({
    type: 'show',
    externalIds: [{ source: 'trakt:show', source_id: '1388' }, { source: 'tmdb:show', source_id: '1396' }],
    derived: { title: 'Breaking Bad', year: 2008 },
  });
  await depo.upsertPayload({ kaymakId: e.kaymak_id, provider: 'trakt', endpoint: 'show_detail', lang: 'tr', data: { ids: { trakt: 1388 } } });

  const k = yedekKlasorleri();
  T.H('Klasor duzeni — her sey proje kokunun ALTINDA');
  T.ok('kok = <...>/kaymaktv, alt klasorler arsiv/lazyfetch/elle/sinama/gecici',
    k.kok === projeKoku && ['arsiv', 'lazyfetch', 'elle', 'sinama', 'gecici'].every((a) => k[a] === path.join(projeKoku, a)));
  const eskiDuzen = yedekKlasorleri({ ARCHIVE_BACKUP_DIR: '/home/pi/kaymak-arsiv-yedek' });
  T.ok('eski Pi duzeni (son klasor arsiv degil) -> kok yok, kardesler <dizin>-lazyfetch',
    eskiDuzen.kok === null && eskiDuzen.lazyfetch === '/home/pi/kaymak-arsiv-yedek-lazyfetch');

  fs.mkdirSync(k.arsiv, { recursive: true });
  const simdi = new Date();
  const yedekYolu = path.join(k.arsiv, `katalog-${damga(new Date(simdi - 60000))}.db`);
  T.ok('gercek VACUUM yedegi alindi', db.backupTo(yedekYolu).ok === true);
  const canli = () => {
    const say = (t) => db.getDb().prepare(`SELECT COUNT(*) n FROM ${t}`).get().n;
    return { entities: say('entities'), externalIds: say('external_ids'), payloads: say('payloads') };
  };

  // ==================================================================
  T.H('Arsiv yedegi sinamasi');
  // ==================================================================
  const iyi = await sinama.arsivYedekSina({ dosya: yedekYolu, geciciDizin: k.gecici, canli: canli() });
  T.ok('saglam yedek -> ok, integrity ok', iyi.ok === true && iyi.butunluk === 'ok', JSON.stringify(iyi.hatalar || iyi.hata));
  T.ok('sayilar canliyla ayni', iyi.sayilar.entities === canli().entities && iyi.sayilar.payloads === 1);
  T.ok('coklu-aktif dort aile de 0', Object.values(iyi.cokluAktif).every((n) => n === 0) && Object.keys(iyi.cokluAktif).length === 4);
  T.ok('🔴 gecici kopya silindi (gecici/ bos)', fs.readdirSync(k.gecici).length === 0);
  T.ok('🔴 yedek dosyasinin kendisi degismedi (yan dosya yok)', fs.readdirSync(k.arsiv).length === 1);

  const az = { ...canli(), entities: canli().entities - 1 };
  const fazla = await sinama.arsivYedekSina({ dosya: yedekYolu, geciciDizin: k.gecici, canli: az });
  T.ok('🔴 yedekte canlidan FAZLA varlik -> dusurur (canlidan bir sey kaybolmus)', fazla.ok === false && fazla.hatalar.some((h) => h.includes('fazla')));

  const cokluYolu = path.join(disKok, 'coklu.db');
  fs.copyFileSync(yedekYolu, cokluYolu);
  const { DatabaseSync } = require('node:sqlite');
  const yaz = new DatabaseSync(cokluYolu);
  yaz.prepare("INSERT INTO external_ids (source, source_id, kaymak_id, first_seen_at, last_seen_at) VALUES ('trakt:show', '9999999', ?, 1, 1)").run(e.kaymak_id);
  yaz.close();
  const coklu = await sinama.arsivYedekSina({ dosya: cokluYolu, geciciDizin: k.gecici });
  T.ok('🔴 coklu-aktif kimlikli yedek -> dusurur', coklu.ok === false && coklu.cokluAktif.traktDizi === 1);

  const bozukYolu = path.join(disKok, 'bozuk.db');
  const ham = fs.readFileSync(yedekYolu);
  fs.writeFileSync(bozukYolu, Buffer.concat([ham.subarray(0, 100), Buffer.alloc(ham.length - 100, 0x41)]));
  const bozuk = await sinama.arsivYedekSina({ dosya: bozukYolu, geciciDizin: k.gecici });
  T.ok('🔴 bozuk dosya -> dusurur, cokmez', bozuk.ok === false, bozuk.hata || (bozuk.hatalar || []).join(';'));
  T.ok('dusen sinamada da gecici kopya silindi', fs.readdirSync(k.gecici).length === 0);

  // ==================================================================
  T.H('Sinama zamani — aylik, basarisizsa her sabah');
  // ==================================================================
  const sd = fs.mkdtempSync(path.join(os.tmpdir(), 'yedek-sz-'));
  const an = new Date(2026, 10, 12, 5, 30);
  const raporYaz = (t, ok) => fs.writeFileSync(path.join(sd, `sinama-${damga(t)}.json`), JSON.stringify({ at: t.toISOString(), ok }));
  T.ok('hic rapor yok -> evet', sinama.sinamaZamaniMi(sd, an) === true);
  raporYaz(new Date(2026, 10, 1, 5, 30), true);
  T.ok('bu ay basarili rapor var -> hayir', sinama.sinamaZamaniMi(sd, an) === false);
  T.ok('ay degisti -> evet', sinama.sinamaZamaniMi(sd, new Date(2026, 11, 1, 5, 30)) === true);
  raporYaz(new Date(2026, 10, 11, 5, 30), false);
  T.ok('dunku rapor basarisiz -> bugun yeniden evet', sinama.sinamaZamaniMi(sd, an) === true);
  raporYaz(new Date(2026, 10, 12, 5, 0), false);
  T.ok('bugun zaten basarisiz sinandi -> ayni gun tekrar yok', sinama.sinamaZamaniMi(sd, an) === false);
  fs.rmSync(sd, { recursive: true, force: true });

  // ==================================================================
  T.H('Sabah ek isleri (diskten karar, ikinci tur is yapmaz)');
  // ==================================================================
  fs.mkdirSync(k.elle, { recursive: true });
  const elleAdlari = [3, 200, 300, 400].map((g) => `elle-a3-oncesi-${damga(new Date(simdi - g * GUN))}-000Z.db`);
  for (const a of elleAdlari) fs.writeFileSync(path.join(k.elle, a), 'x');
  fs.writeFileSync(path.join(k.elle, 'ONEMLI-NOT.txt'), 'dokunma');
  fs.mkdirSync(path.join(T.kok, 'cache', 'tmdb'), { recursive: true });
  fs.writeFileSync(path.join(T.kok, 'cache', 'tmdb', 'a.json.gz'), 'veri');

  const bildirimler = [];
  const sahte = {
    lazyfetchKoku: () => T.kok,
    canliSayilar: canli,
    logSync: (x) => depo.logSync(x),
    bildir: async (metin) => { bildirimler.push(metin); return true; },
  };
  const tur1 = await yedekEkIsleri({ simdi, klasor: k, bagimlar: sahte });
  T.ok('BENIOKU.txt proje kokune yazildi', tur1.benioku === true && fs.readFileSync(path.join(projeKoku, 'BENIOKU.txt'), 'utf8') === BENIOKU);
  T.ok('elle/: 200/300/400 gunluk 2 tanesi silindi; en yeni 2 + desen disi kaldi',
    tur1.elle.silinen.length === 2 && fs.existsSync(path.join(k.elle, elleAdlari[0])) && fs.existsSync(path.join(k.elle, elleAdlari[1]))
    && fs.existsSync(path.join(k.elle, 'ONEMLI-NOT.txt')), JSON.stringify(tur1.elle.silinen));
  T.ok('ilk tur: LazyFetch tar alindi', tur1.lazyfetch && tur1.lazyfetch.ok === true, tur1.lazyfetch && (tur1.lazyfetch.reason || tur1.lazyfetch.dosya));
  T.ok('ilk tur: sinama kostu, arsiv + lazyfetch ok', tur1.sinama && tur1.sinama.ok === true && tur1.sinama.lazyfetch.ok === true,
    tur1.sinama && sinama.raporOzeti(tur1.sinama));
  T.ok('sinama raporu sinama/ altina yazildi', fs.readdirSync(k.sinama).filter((f) => /^sinama-.+\.json$/.test(f)).length === 1);
  T.ok('basarili turda bildirim YOK', bildirimler.length === 0);
  T.ok('sync_log: lazyfetch ve sinama satirlari',
    db.getDb().prepare("SELECT count(*) c FROM sync_log WHERE detail LIKE 'yedek lazyfetch%' OR detail LIKE 'sinama ok%'").get().c === 2);

  // LazyFetch tar'inin VERI bayti degisti (basliklar saglam) -> yalniz sha256 yakalar.
  const tarAdi = fs.readdirSync(k.lazyfetch).find((f) => f.endsWith('.tar'));
  const kurcalanan = fs.mkdtempSync(path.join(os.tmpdir(), 'yedek-kurcala-'));
  for (const u of ['.tar', '.sha256', '.json']) fs.copyFileSync(path.join(k.lazyfetch, tarAdi.replace('.tar', u)), path.join(kurcalanan, tarAdi.replace('.tar', u)));
  const tarHam = fs.readFileSync(path.join(kurcalanan, tarAdi));
  tarHam[512] ^= 0xff; // ilk dosyanin ilk veri bayti
  fs.writeFileSync(path.join(kurcalanan, tarAdi), tarHam);
  const kurcalaSonuc = await sinama.lazyfetchYedekSina({ tarDosya: path.join(kurcalanan, tarAdi) });
  T.ok('🔴 tar icindeki veri bayti degisti -> sha256 uyusmuyor, dusurur',
    kurcalaSonuc.ok === false && (kurcalaSonuc.hatalar || []).includes('sha256 uyusmuyor'), JSON.stringify(kurcalaSonuc.hatalar));
  fs.rmSync(kurcalanan, { recursive: true, force: true });

  const tur2 = await yedekEkIsleri({ simdi: new Date(simdi.getTime() + 3600000), klasor: k, bagimlar: sahte });
  T.ok('🔴 ayni gun ikinci tur: yeni tar YOK, yeni sinama YOK (yeniden baslatma isi tekrarlatmaz)',
    tur2.lazyfetch === null && tur2.sinama === null && fs.readdirSync(k.lazyfetch).filter((f) => f.endsWith('.tar')).length === 1);
  T.ok('BENIOKU zaten guncel -> yeniden yazilmaz', tur2.benioku === false);

  // Dusen yol: LazyFetch kapali + arsiv yedegi bozuk -> iki bildirim, rapor basarisiz.
  fs.writeFileSync(path.join(k.arsiv, `katalog-${damga(new Date(simdi.getTime() + 60000))}.db`), 'bozuk');
  fs.rmSync(k.lazyfetch, { recursive: true, force: true });
  fs.rmSync(k.sinama, { recursive: true, force: true });
  const tur3 = await yedekEkIsleri({ simdi: new Date(simdi.getTime() + 2 * 60000), klasor: k, bagimlar: { ...sahte, lazyfetchKoku: () => null } });
  T.ok('LazyFetch kapali -> tar yok, BASARISIZ kaydi', tur3.lazyfetch && tur3.lazyfetch.ok === false && tur3.lazyfetch.reason === 'lazyfetch_kapali');
  T.ok('🔴 en yeni arsiv yedegi bozuk -> sinama dustu', tur3.sinama && tur3.sinama.ok === false);
  T.ok('🔴 iki bildirim gitti (LazyFetch + sinama)', bildirimler.length === 2 && bildirimler[1].includes('sınaması'), bildirimler.join(' | '));
  const sonRapor = sinama.sonRapor(k.sinama);
  T.ok('basarisiz rapor diskte (ertesi sabah yeniden sinanir)', sonRapor && sonRapor.ok === false);

  // ==================================================================
  T.H('Saglik ozeti — yol / ad sizmaz');
  // ==================================================================
  const oz = yedekOzeti();
  const metin = JSON.stringify(oz);
  T.ok('alanlar: sonArsiv, sonLazyfetch, sonSinama{at,ok}, kopya{arsiv,lazyfetch,elle}',
    oz && 'sonArsiv' in oz && 'sonLazyfetch' in oz && oz.sonSinama && oz.sonSinama.ok === false && oz.kopya.arsiv === 2 && oz.kopya.elle === 2, metin);
  T.ok('🔴 yol, dosya adi, klasor adi YOK', !metin.includes(disKok) && !/katalog-|lazyfetch-|\.db|\.tar|kaymaktv/.test(metin));
  T.ok('ARCHIVE_BACKUP_DIR yokken cokmez', (() => { const o = yedekOzeti({}); return o === null || typeof o === 'object'; })());
  const { saglikRaporu } = require(path.join(PROJE_KOKU, 'server', 'saglik'));
  const rapor = await saglikRaporu();
  T.ok('/api/health arsiv.yedek alani dolu', rapor.arsiv && rapor.arsiv.yedek && rapor.arsiv.yedek.kopya.arsiv === 2);

  db.closeArchive();
  fs.rmSync(disKok, { recursive: true, force: true });
  T.bitir();
})().catch((e) => { console.error(e); process.exit(1); });
