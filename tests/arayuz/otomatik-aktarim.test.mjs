// ==========================================================================
// ARAYUZ — §C33: KIRILMAZ OTOMATIK TRAKT AKTARIMI
// ==========================================================================
// Risk (27 Eylul, DalekCan): aktarimi hic kosmamis Trakt kullanicisi iki
// hafta boyunca "kutuphanen bos" gordu. Motor otomatik ve sessiz; burada
// kullanicinin 6 maddesi SAHTE bir sunucuyla uctan uca olculuyor:
// kaldigi yerden devam, ag kesintisi, canli tazeleme, cift cihaz, token
// yenileme, log politikasi.
//
// Cikti ASCII (tests/yardimci.js kurali). Ag YOK, zamanlayici YOK.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yardimci from '../yardimci.js';
import * as C from '../../services/import/aktarimCekirdek.ts';
import { aktarimMotoruKur } from '../../services/import/aktarimMotoru.ts';

const { baslat } = yardimci;
const T = baslat('ARAYUZ OTOMATIK AKTARIM (C33)', { kokOneki: 'arayuz-otomatik-' });

const AILELER = [
  'gecmis', 'puan_dizi', 'puan_sezon', 'puan_bolum', 'puan_film', 'liste_dizi', 'liste_film',
  'favori_trakt_dizi', 'favori_trakt_film', 'gizli_dizi', 'gizli_film', 'birakilan',
];
const firsat = () => new Promise((r) => setImmediate(r));

// ─────────────────────────────────────────────────────────────────────────
// Sahte sunucu + sahte dunya
// ─────────────────────────────────────────────────────────────────────────
function dunya({ sayfalar = { gecmis: 3 }, baslangic = {}, hatalar = {}, yenileOk = true, damgalar = {}, ucuslar = {}, takilma = {}, kilitDolu = false, disaridanIlerleyen = null } = {}) {
  let damgaNo = 0;
  const durum = {};
  for (const a of AILELER) {
    durum[a] = { sayfa: 0, sayfaSayisi: sayfalar[a] ?? 1, bitti: false, damga: null, ...(baslangic[a] || {}) };
  }
  const k = {
    adim: [], ozet: 0, tazele: 0, yenile: 0, log: [], fazlar: [], bekleme: [],
    ucusta: 0, enCokUcusta: 0, damgaYazilan: null, takilmaYazilan: null, ucusYazilan: null, yuzdeler: [],
  };
  let cevrimici = true;
  let onPlanda = true;
  let kosulBekleyenler = [];
  let kilit = kilitDolu;

  const ozet = () => {
    const aileler = {};
    const eksik = [];
    for (const a of AILELER) {
      const d = durum[a];
      const baslamadi = d.sayfa === 0 && !d.bitti && !d.damga;
      const dz = d.bitti ? 'bitti' : baslamadi ? 'baslamadi' : 'suruyor';
      aileler[a] = { durum: dz, sayfa: d.sayfa, toplam: d.sayfaSayisi * 10, aktarilan: d.sayfa * 10, bekleyen: 0, reddedilen: 0, guncellendiAt: d.damga, yasSn: d.yasSn ?? 99 };
      if (dz !== 'bitti') eksik.push(a);
    }
    return { ilkTamam: eksik.length === 0, eksikAileler: eksik, aileler, toplam: { aktarilan: 0, bekleyen: 0 } };
  };

  const bag = {
    ozetOku: async () => {
      k.ozet += 1;
      if (disaridanIlerleyen) disaridanIlerleyen(durum, k.ozet);
      await firsat();
      const anlik = ozet();
      // Zaman akar: her sorgu arasi ~6 sn (gozlemci 10 sn bekliyor). Bitmemis
      // ailenin damgasi yaslanir; adim atilinca yeniden 0 olur.
      for (const a of AILELER) if (typeof durum[a].yasSn === 'number') durum[a].yasSn += 6;
      return anlik;
    },
    adimAt: async (aile) => {
      k.adim.push(aile);
      k.ucusta += 1;
      k.enCokUcusta = Math.max(k.enCokUcusta, k.ucusta);
      await firsat();
      k.ucusta -= 1;
      const kuyruk = hatalar[aile];
      if (kuyruk && kuyruk.length) {
        const h = kuyruk.shift();
        // `agiKes`: istek UCUSTAYKEN baglanti koptu — hem istek duser hem
        // NetInfo cevrimdisi der (gercekteki sira).
        if (h.agiKes) cevrimici = false;
        throw Object.assign(new Error(h.mesaj || h.tur), { bilgi: h });
      }
      const d = durum[aile];
      if (d.yarisKalan > 0) {
        d.yarisKalan -= 1;
        return { success: true, aile, yaris: true };
      }
      d.sayfa += 1;
      d.bitti = d.sayfa >= d.sayfaSayisi;
      d.damga = `d${++damgaNo}`;
      d.yasSn = 0;
      return {
        aile, sayfa: d.sayfa, sayfaSayisi: d.sayfaSayisi, toplam: d.sayfaSayisi * 10,
        aktarilan: d.sayfa * 10, bekleyen: 0, reddedilen: 0, bitti: d.bitti,
        buAdim: { aktarilan: 10, bekleyen: 0, reddedilen: 0 }, guncellendiAt: d.damga,
      };
    },
    tokenYenile: async () => { k.yenile += 1; await firsat(); return yenileOk; },
    tazele: async () => { k.tazele += 1; },
    bekle: async (ms) => { k.bekleme.push(ms); await firsat(); },
    kosulBekle: () => new Promise((r) => kosulBekleyenler.push(r)),
    cevrimiciMi: () => cevrimici,
    onPlandaMi: () => onPlanda,
    simdi: () => 1_000_000 + k.adim.length * 10_000,
    kilitAl: () => { if (kilit) return false; kilit = true; return true; },
    kilitBirak: () => { kilit = false; },
    // Gercekteki gibi KALICI: yazilan damga bir sonraki okumada geri gelir.
    damgaOku: async () => ({ ...damgalar, ...(k.damgaYazilan || {}) }),
    damgaYaz: async (d) => { k.damgaYazilan = d; },
    ucusOku: async () => ({ ...ucuslar, ...(k.ucusYazilan || {}) }),
    ucusYaz: async (u) => { k.ucusYazilan = u; },
    takilmaOku: async () => ({ ...takilma }),
    takilmaYaz: async (s) => { k.takilmaYazilan = s; },
    log: (seviye, baglam) => k.log.push({ seviye, baglam }),
    yayinla: (d) => { k.fazlar.push(d.faz); k.yuzdeler.push(d.yuzde); },
  };
  return {
    bag, k, durum,
    agKes: () => { cevrimici = false; },
    agGel: () => { cevrimici = true; const b = kosulBekleyenler; kosulBekleyenler = []; b.forEach((r) => r()); },
    kilitBirak: () => { kilit = false; },
  };
}

const discord = (k) => k.log.filter((l) => l.seviye === 'hata');

// ─────────────────────────────────────────────────────────────────────────
T.H('Saf cekirdek — hata karari ve log politikasi');

const bag0 = { cevrimici: true, onPlanda: true, ardisik: 1, yenilemeDenendi: false };
const gecici = { tur: 'gecici', mesaj: 'x' };
T.ok('gecici hata -> bekle_tekrar + UYARI (Discord DEGIL)',
  C.hataKarari(gecici, bag0).eylem === 'bekle_tekrar' && C.hataKarari(gecici, bag0).log === 'uyari');
T.ok('🔴 cevrimdisi gecici -> ag_bekle, HIC log yok',
  C.hataKarari(gecici, { ...bag0, cevrimici: false }).eylem === 'ag_bekle'
  && C.hataKarari(gecici, { ...bag0, cevrimici: false }).log === 'yok');
T.ok('arka planda donan istek -> ag_bekle (deneme harcanmaz)',
  C.hataKarari(gecici, { ...bag0, onPlanda: false }).eylem === 'ag_bekle');
T.ok('oturumda 6 gecici -> aile_ertele (yine UYARI)',
  C.hataKarari(gecici, { ...bag0, ardisik: C.OTURUM_GECICI_TAVANI }).eylem === 'aile_ertele'
  && C.hataKarari(gecici, { ...bag0, ardisik: C.OTURUM_GECICI_TAVANI }).log === 'uyari');
T.ok('cok_istek dakikalik bekler', C.hataKarari({ tur: 'gecici', mesaj: 'x', kod: 'cok_istek' }, bag0).beklemeMs === 60_000);
T.ok('trakt_limit Retry-After a uyar', C.hataKarari({ tur: 'trakt_limit', mesaj: 'x', retryAfter: 7 }, bag0).beklemeMs === 7000);
T.ok('yetki -> once token_yenile (log yok)', C.hataKarari({ tur: 'yetki', mesaj: 'x' }, bag0).eylem === 'token_yenile'
  && C.hataKarari({ tur: 'yetki', mesaj: 'x' }, bag0).log === 'yok');
T.ok('yetki, yenileme zaten denendi -> hepsini_durdur',
  C.hataKarari({ tur: 'yetki', mesaj: 'x' }, { ...bag0, yenilemeDenendi: true }).eylem === 'hepsini_durdur');
T.ok('🔴 beklenmeyen (genel) -> aile_ertele + HATA (Discord)',
  C.hataKarari({ tur: 'genel', mesaj: 'x' }, bag0).log === 'hata');
T.ok('elle yol: gecici UYARI, genel HATA',
  C.adimHatasiLogSeviyesi(gecici) === 'uyari' && C.adimHatasiLogSeviyesi({ tur: 'genel', mesaj: 'x' }) === 'hata');

T.H('Saf cekirdek — takilma, tazeleme, ilerleme, gozlemci');
const t1 = C.takilmaGuncelle({ a: 2, b: 1 }, ['a', 'c'], ['b']);
T.ok('ertelenen +1, biten silinir', t1.sayaclar.a === 3 && t1.sayaclar.c === 1 && !('b' in t1.sayaclar));
T.ok('esige TAM ulasan bir kez bildirilir', t1.bildir.length === 1 && t1.bildir[0] === 'a');
T.ok('esigi gecen tekrar bildirilmez', C.takilmaGuncelle({ a: 3 }, ['a'], []).bildir.length === 0);
T.ok('ilk veri beklemez', C.tazelemeZamaniMi('ilk_veri', 1000, 1001) === true);
T.ok('sayfa 8 sn kisitina uyar', !C.tazelemeZamaniMi('sayfa', 1000, 5000) && C.tazelemeZamaniMi('sayfa', 1000, 9000));
const io = C.ilerlemeOzeti({ g: { toplam: 100, aktarilan: 30, bekleyen: 10, reddedilen: 0, bitti: false }, p: { toplam: null, aktarilan: 5, bekleyen: 0, reddedilen: 0, bitti: true } });
T.ok('ilerleme: islenen bekleyeni de sayar, bitmis aile kendi islenenini', io.islenen === 45 && io.toplam === 105 && io.bitenAile === 1);
const oz = (g) => ({ ilkTamam: false, eksikAileler: ['gecmis'], aileler: { gecmis: g }, toplam: { aktarilan: 0, bekleyen: 0 } });
T.ok('taze + yabanci damga -> baska cihaz', C.baskaCihazSuruyorMu(oz({ durum: 'suruyor', yasSn: 5, guncellendiAt: 'X' }), {}) === true);
T.ok('🔴 taze ama KENDI damgam -> baska cihaz DEGIL (zorla kapat/ac)',
  C.baskaCihazSuruyorMu(oz({ durum: 'suruyor', yasSn: 5, guncellendiAt: 'X' }), { gecmis: 'X' }) === false);
T.ok('bayat (>=15 sn) -> devralinir', C.baskaCihazSuruyorMu(oz({ durum: 'suruyor', yasSn: 20, guncellendiAt: 'X' }), {}) === false);

// ─────────────────────────────────────────────────────────────────────────
T.H('Saf cekirdek — yuzde (kullanici karari: sayi yerine yuzde)');
const sy = (toplam, aktarilan, bitti = false) => ({ toplam, aktarilan, bekleyen: 0, reddedilen: 0, bitti });
T.ok('gecmisin toplami bilinmiyorsa yuzde YOK (kucuk aileler %100 gosterip sonra %3 e dusmesin)',
  C.ilerlemeOzeti({ gecmis: sy(null, 0), puan_film: sy(5, 5, true) }).yuzde === null);
T.ok('yuzde asagi yuvarlanir: 370/1000 -> 37', C.ilerlemeOzeti({ gecmis: sy(1000, 370) }).yuzde === 37);
T.ok('🔴 islenen toplama ulassa da en fazla %99 (bitis tazelemesi surerken %100 celiskisi yok)',
  C.ilerlemeOzeti({ gecmis: sy(1000, 1000) }).yuzde === 99);
T.ok('gecmis bitmis, toplami null -> yine hesaplanir', C.ilerlemeOzeti({ gecmis: sy(null, 50, true), liste_dizi: sy(100, 20) }).yuzde === 46);

T.H('Saf cekirdek — istek ortasinda oldurulme (M428)');
const taze = oz({ durum: 'suruyor', yasSn: 3, guncellendiAt: 'KAYIP' });
T.ok('🔴 yabanci gorunen taze damga + 3 sn onceki KENDI ucus notum -> baska cihaz DEGIL',
  C.baskaCihazSuruyorMu(taze, { gecmis: 'ESKI' }, { gecmis: 997_000 }, 1_000_000) === false);
T.ok('ucus notu 90 sn eski -> gercekten baska cihaz olabilir (gozlemci)',
  C.baskaCihazSuruyorMu(taze, { gecmis: 'ESKI' }, { gecmis: 910_000 }, 1_000_000) === true);
T.ok('baska ailenin ucus notu bu aileyi AKLAMAZ',
  C.baskaCihazSuruyorMu(taze, {}, { liste_dizi: 999_000 }, 1_000_000) === true);

T.H('Motor — sifirdan aktarim (DalekCan vakasi)');
{
  const d = dunya({ sayfalar: { gecmis: 3 } });
  const m = aktarimMotoruKur(d.bag, C);
  const f = await m.baslat();
  T.ok('faz bitti', f === 'bitti', f);
  T.ok('12 aile de bitti', AILELER.every((a) => d.durum[a].bitti));
  T.ok('gecmis 3 sayfa, digerleri 1 adim', d.k.adim.filter((a) => a === 'gecmis').length === 3 && d.k.adim.length === 14, String(d.k.adim.length));
  T.ok('🔑 paralel: ayni anda >=3 adim ucusta (gecmis + 2 serit)', d.k.enCokUcusta >= 3, String(d.k.enCokUcusta));
  T.ok('ilk veriden tazeleme + bitiste IKI tazeleme', d.k.tazele >= 3, String(d.k.tazele));
  T.ok('hic Discord kaydi yok', discord(d.k).length === 0);
  T.ok('bant fazlari: kontrol -> suruyor -> bitti', d.k.fazlar[0] === 'kontrol' && d.k.fazlar.includes('suruyor') && d.k.fazlar.at(-1) === 'bitti');
  T.ok('kendi damgalari saklandi', !!d.k.damgaYazilan && Object.keys(d.k.damgaYazilan).length >= 1);
  T.ok('her adimdan once ucus notu yazildi (12 aile)', !!d.k.ucusYazilan && Object.keys(d.k.ucusYazilan).length === 12);
  const sayisal = d.k.yuzdeler.filter((y) => typeof y === 'number');
  T.ok('yuzde yayinlandi, hic %100 u gecmedi ve %99 u asmadi', sayisal.length > 0 && Math.max(...sayisal) <= 99, JSON.stringify(sayisal));
}

T.H('Motor — kaldigi yerden devam');
{
  const bitmis = Object.fromEntries(['puan_dizi', 'puan_sezon', 'puan_bolum', 'puan_film'].map((a) => [a, { sayfa: 1, bitti: true, damga: 'eski' }]));
  const d = dunya({ sayfalar: { gecmis: 5 }, baslangic: { gecmis: { sayfa: 3, damga: 'eski', yasSn: 600 }, ...bitmis } });
  const f = await aktarimMotoruKur(d.bag, C).baslat();
  T.ok('bitti', f === 'bitti');
  T.ok('🔴 bitmis 4 aileye HIC adim atilmadi', !d.k.adim.some((a) => a.startsWith('puan_')));
  T.ok('gecmis 3. sayfadan devam: yalniz 2 adim', d.k.adim.filter((a) => a === 'gecmis').length === 2);
}
{
  const hepsi = Object.fromEntries(AILELER.map((a) => [a, { sayfa: 1, bitti: true, damga: 'x' }]));
  const d = dunya({ baslangic: hepsi });
  const f = await aktarimMotoruKur(d.bag, C).baslat();
  T.ok('zaten tamam -> faz tamam, SIFIR adim, tazeleme yok', f === 'tamam' && d.k.adim.length === 0 && d.k.tazele === 0);
}

T.H('Motor — ag kesintisi');
{
  const d = dunya({ sayfalar: { gecmis: 2 }, hatalar: { gecmis: [{ tur: 'gecici', mesaj: 'Network Error', agiKes: true }] } });
  const m = aktarimMotoruKur(d.bag, C);
  const p = m.baslat();
  for (let i = 0; i < 40 && !d.k.fazlar.includes('ag_bekleniyor'); i += 1) await firsat();
  T.ok('cevrimdisi -> ag_bekleniyor fazi', d.k.fazlar.includes('ag_bekleniyor'));
  d.agGel();
  const f = await p;
  T.ok('baglanti gelince tamamlandi', f === 'bitti');
  T.ok('🔴 cevrimdisi hata HIC loglanmadi', d.k.log.length === 0, JSON.stringify(d.k.log));
}
{
  const g = { tur: 'gecici', mesaj: '502' };
  const d = dunya({ hatalar: { liste_dizi: [g, g, g] } });
  const f = await aktarimMotoruKur(d.bag, C).baslat();
  T.ok('3 gecici hata sonra basari -> bitti', f === 'bitti');
  T.ok('gecici hatalar UYARI, Discord 0', d.k.log.length === 3 && discord(d.k).length === 0);
}

T.H('Motor — kalici hata ve takilma');
{
  const d = dunya({ hatalar: { puan_film: [{ tur: 'genel', mesaj: 'aile_desteklenmiyor' }] }, takilma: { puan_film: 2, gecmis: 1 } });
  const f = await aktarimMotoruKur(d.bag, C).baslat();
  T.ok('bir aile ertelendi -> faz ertelendi', f === 'ertelendi');
  T.ok('diger 11 aile yine de bitti', AILELER.filter((a) => a !== 'puan_film').every((a) => d.durum[a].bitti));
  T.ok('beklenmeyen hata Discord a (1) + 3. oturum takilmasi (1)', discord(d.k).length === 2
    && d.k.log.some((l) => l.baglam === 'aktarim.aile_takildi'), JSON.stringify(d.k.log));
  T.ok('biten ailenin sayaci sifirlandi', d.k.takilmaYazilan && !('gecmis' in d.k.takilmaYazilan) && d.k.takilmaYazilan.puan_film === 3);
}

T.H('Motor — token yenileme');
{
  const y = { tur: 'yetki', mesaj: '401' };
  const d = dunya({ hatalar: { gecmis: [y], puan_dizi: [y], puan_sezon: [y] } });
  const f = await aktarimMotoruKur(d.bag, C).baslat();
  T.ok('🔴 uc serit ayni anda 401 -> TEK yenileme, aktarim bitti', d.k.yenile === 1 && f === 'bitti', `yenile=${d.k.yenile} f=${f}`);
}
{
  const d = dunya({ hatalar: { gecmis: [{ tur: 'yetki', mesaj: '401' }] }, yenileOk: false, sayfalar: { gecmis: 5 } });
  const f = await aktarimMotoruKur(d.bag, C).baslat();
  T.ok('yenileme basarisiz -> sessizce durur (bos), Discord yok', f === 'bos' && discord(d.k).length === 0);
}

T.H('Motor — cift cihaz (gozlemci modu)');
{
  const d = dunya({
    baslangic: { gecmis: { sayfa: 1, damga: 'YABANCI', yasSn: 4 } },
    disaridanIlerleyen: (durum, n) => { if (n >= 2) for (const a of AILELER) durum[a].bitti = true; },
  });
  const f = await aktarimMotoruKur(d.bag, C).baslat();
  T.ok('taze yabanci damga -> baska_cihaz, HIC adim atilmadi', d.k.fazlar.includes('baska_cihaz') && d.k.adim.length === 0);
  T.ok('oteki cihaz bitirince -> bitti + tazeleme', f === 'bitti' && d.k.tazele >= 2);
}
{
  // Oteki cihaz yarida oldu (uygulama kapandi): damga yaslanir, bu cihaz DEVRALIR.
  const d = dunya({ baslangic: { gecmis: { sayfa: 1, damga: 'YABANCI', yasSn: 4 } } });
  const f = await aktarimMotoruKur(d.bag, C).baslat();
  T.ok('🔴 oteki cihaz olurse bayatlayan damga devralinir ve aktarim biter',
    d.k.fazlar.includes('baska_cihaz') && d.k.adim.length > 0 && f === 'bitti', `adim=${d.k.adim.length} f=${f}`);
}
{
  const d = dunya({ baslangic: { gecmis: { sayfa: 1, damga: 'BENIM', yasSn: 3 } }, damgalar: { gecmis: 'BENIM' } });
  const f = await aktarimMotoruKur(d.bag, C).baslat();
  T.ok('🔴 taze ama KENDI damgam -> gozlemci DEGIL, surer', !d.k.fazlar.includes('baska_cihaz') && f === 'bitti');
}
{
  const d = dunya({
    baslangic: { gecmis: { yarisKalan: 2 } },
    disaridanIlerleyen: (durum, n) => { if (n >= 2) for (const a of AILELER) durum[a].bitti = true; },
  });
  const f = await aktarimMotoruKur(d.bag, C).baslat();
  T.ok('iki ardisik yaris -> gozlemciye gecer, sonra bitti', f === 'bitti');
}
{
  const d = dunya({ kilitDolu: true, disaridanIlerleyen: (durum, n) => { if (n >= 3) for (const a of AILELER) durum[a].bitti = true; } });
  const f = await aktarimMotoruKur(d.bag, C).baslat();
  T.ok('🔴 bu cihazda elle tur surerken motor ADIM ATMAZ (tek dongu)', d.k.adim.length === 0 && f === 'bitti');
}

T.H('Motor — istek ortasinda oldurulup yeniden acilma (M428, cihaz testi)');
{
  // Onceki oturum gecmisin 4. sayfasini istedi, sunucu isledi (damga KAYIP),
  // yanit gelmeden uygulama olduruldu. Yerelde yalniz eski damga + ucus notu var.
  const d = dunya({
    sayfalar: { gecmis: 6 },
    baslangic: { gecmis: { sayfa: 4, damga: 'KAYIP', yasSn: 2 } },
    damgalar: { gecmis: 'ESKI' },
    ucuslar: { gecmis: 997_000 },
  });
  const f = await aktarimMotoruKur(d.bag, C).baslat();
  T.ok('🔴 "baska cihaz" DEMEDEN hemen devam eder', !d.k.fazlar.includes('baska_cihaz') && f === 'bitti', JSON.stringify(d.k.fazlar.slice(0, 4)));
  T.ok('kaldigi yerden: gecmis yalniz 2 adim (5 ve 6)', d.k.adim.filter((a) => a === 'gecmis').length === 2);
}

T.H('Motor — durdurma ve hesap degisimi');
{
  const d = dunya({ sayfalar: { gecmis: 50 } });
  const m = aktarimMotoruKur(d.bag, C);
  const p1 = m.baslat();
  T.ok('ayni anda ikinci baslat ayni sozu dondurur', m.baslat() === p1);
  for (let i = 0; i < 10; i += 1) await firsat();
  m.durdur();
  const adimSayisi = d.k.adim.length;
  const f1 = await p1;
  T.ok('durdur -> eski kosu bos doner', f1 === 'bos');
  T.ok('durdurulduktan sonra en fazla ucustaki adimlar tamamlanir', d.k.adim.length <= adimSayisi + 3);
  const p2 = m.baslat();
  T.ok('🔴 durdur sonrasi baslat YENI kosu (eski soz degil)', p2 !== p1);
  T.ok('yeni kosu tamamlanir', (await p2) === 'bitti');
}

T.H('Kaynak denetimi — baglantilar geri sizmasin');
const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const oku = (...y) => fs.readFileSync(path.join(KOK, ...y), 'utf8');
const var_ = (...y) => fs.existsSync(path.join(KOK, ...y));

const layout = oku('app', '(protected)', '_layout.tsx');
T.ok('_layout otomatik motoru baglar', layout.includes('useOtomatikAktarim()'));
T.ok('eski onayli fark turu hook u kalkti', !layout.includes('useOtomatikFarkTuru') && !var_('hooks', 'useOtomatikFarkTuru.ts'));

const ekranlar = [
  ['screens', 'IndexMobile.tsx'],
  ['screens', 'MoviesMobile.tsx'],
  ['app', '(protected)', '(tabs)', 'shows.web.tsx'],
  ['app', '(protected)', '(tabs)', 'movies.web.tsx'],
];
for (const e of ekranlar) {
  const k = oku(...e);
  T.ok(`🔴 ${e.at(-1)}: bant + bos-metin bastirma (web ikizi dahil)`, k.includes('<AktarimBandi />') && k.includes('aktarim.aktarimSuruyor'));
}

const hook = oku('hooks', 'useTraktImport.ts');
T.ok('elle yol modul kilidini kullanir (cift dongu yok)', hook.includes("kilitAl('elle')") && hook.includes("kilitBirak('elle')") && !hook.includes('calisiyorRef.current = true'));
// logError YALNIZ politika dalinda: tek cagri ve hemen onunde seviye kontrolu.
T.ok('elle yol: gecici hata Discord a gitmez',
  hook.split("logError('useTraktImport.adim'").length === 2
  && hook.includes("if (adimHatasiLogSeviyesi(adimHatasi) === 'hata') logError('useTraktImport.adim', e);")
  && hook.includes("else logWarning('useTraktImport.adim', e);"));
T.ok('elle yol bitince kutuphane tazelenir', hook.includes('kutuphaneyiTazele()'));

const bolum = oku('components', 'settings', 'TraktImportSection.tsx');
T.ok('Evet/Hayir sorusu kalkti', !bolum.includes('ONAY_ANAHTARI') && !bolum.includes("importAskTitle"));
T.ok('🔴 "Yeniden Senkronize Et" GERCEK fark turu cagirir', bolum.includes('farkTuru(false)'));
T.ok('motor surerken elle dugme gizli', bolum.includes('!motorSuruyor'));

const kaplama = oku('components', 'SyncStatusBanner.tsx');
T.ok('senkron kaplamasi aktarim surerken susar (yanip sonme yok)', kaplama.includes('!aktarimSuruyor'));

const baglanti = oku('services', 'import', 'aktarimBaglanti.ts');
T.ok('baglanti fetchFreshData yi ZORLA cagirir', baglanti.includes('fetchFreshData(token, true)'));
const motorKaynak = oku('services', 'import', 'aktarimMotoru.ts');
const cekirdekKaynak = oku('services', 'import', 'aktarimCekirdek.ts');
const calismaImportu = /^import (?!type )/m;
T.ok('motor ve cekirdek: calisma-zamani importu YOK (Node testi kosabilsin)',
  !calismaImportu.test(motorKaynak) && !calismaImportu.test(cekirdekKaynak));

T.bitir();
