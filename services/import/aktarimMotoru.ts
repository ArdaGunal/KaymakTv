// ==========================================================================
// OTOMATİK TRAKT AKTARIM MOTORU (§C33)
// ==========================================================================
// Kararlar `aktarimCekirdek.ts`'te (saf); bu dosya onları SIRAYA koyar.
// Gerçek dünya (ağ, NetInfo, AppState, depolama, log) `aktarimBaglanti.ts`'te
// takılır — burada HİÇBİR çalışma zamanı importu yok, çekirdek bile parametre.
// Bu yüzden motorun tamamı Node'da sahte bağımlılıklarla test ediliyor.
//
// Garantiler (kullanıcının 6 maddesi):
//   1. Kaldığı yerden devam — imleç SUNUCUDA (`user_import_state`); motor her
//      açılışta `/import/durum`'a sorar ve yalnız eksik aileleri sürer.
//   2. Ağ kesintisi — çevrimdışı / arka plan: deneme HARCANMAZ, bağlantı
//      gelince devam. Geçici hata: geri çekilme; oturumda 6 kez düşen aile
//      sonraki oturuma kalır (diğerleri sürer).
//   3. Arayüz — durum `yayinla` ile store'a; ilk veri gelir gelmez ve 8 sn'de
//      bir kütüphane tazelenir; bitişte İKİ kez (aşağıdaki tuzak).
//   4. Çift cihaz — gözlemci modu (migration'sız, `baskaCihazSuruyorMu`).
//   5. Token — 401'de paylaşılan tek-uçuşlu yenileme, şerit başına bir kez.
//   6. Log — Discord yalnız kurtarılamayan için (`hataKarari.log`).

import type { ImportAilesi, ImportHataBilgisi } from '../api/traktImportCekirdek';
import type * as CekirdekModulu from './aktarimCekirdek';
import type { AileSayaci, AktarimOzeti, TazelemeOlayi } from './aktarimCekirdek';

type Cekirdek = typeof CekirdekModulu;

import type {
  AdimYaniti,
  AktarimMotoru,
  MotorBagimliliklari,
  MotorDurumu,
  MotorFazi,
} from './aktarimTurleri';

// Tipler ayrı dosyada (M428); eski içe aktarma yolları kırılmasın diye yeniden ihraç.
export type { AdimYaniti, AktarimMotoru, MotorBagimliliklari, MotorDurumu, MotorFazi } from './aktarimTurleri';

const BOS: MotorDurumu = { faz: 'bos', islenen: 0, toplam: 0, bekleyen: 0, bitenAile: 0, toplamAile: 0, yuzde: null };

/** `ImportHatasi` değilse beklenmeyen bir istisnadır (programlama hatası) → `genel`. */
function hataBilgisi(e: unknown): ImportHataBilgisi {
  const b = (e as { bilgi?: ImportHataBilgisi } | null)?.bilgi;
  if (b && typeof b.tur === 'string') return b;
  return { tur: 'genel', mesaj: (e as Error)?.message || 'Beklenmeyen hata' };
}

export function aktarimMotoruKur(bag: MotorBagimliliklari, c: Cekirdek): AktarimMotoru {
  let nesil = 0;
  let calisan: Promise<MotorFazi> | null = null;
  let durum: MotorDurumu = BOS;
  let iptalCoz: () => void = () => {};

  const kur = (): AktarimMotoru => ({ baslat, durdur, durum: () => durum });

  function durdur(): void {
    nesil += 1;
    iptalCoz();
    // 🔴 `calisan` HEMEN bırakılıyor: çıkış → başka hesapla giriş arka arkaya
    // gelirse `baslat` eski (iptal edilmiş, hâlâ sönümlenen) sözü döndürüp
    // yeni hesabın aktarımını HİÇ başlatmazdı.
    calisan = null;
    durum = BOS;
    bag.yayinla(durum);
  }

  function baslat(): Promise<MotorFazi> {
    if (calisan) return calisan;
    const p = kos();
    calisan = p;
    // Kimlik kontrolü: sönümlenen eski koşu, yenisinin kaydını silmesin.
    p.finally(() => {
      if (calisan === p) calisan = null;
    }).catch(() => {});
    return p;
  }

  async function kos(): Promise<MotorFazi> {
    const benim = ++nesil;
    const iptal = () => nesil !== benim;
    const iptalSozu = new Promise<void>((r) => {
      iptalCoz = r;
    });
    const uyu = (ms: number) => Promise.race([bag.bekle(ms), iptalSozu]);

    const sayaclar: Record<string, AileSayaci> = {};
    let faz: MotorFazi = 'kontrol';
    const yayin = (f: MotorFazi = faz) => {
      if (iptal()) return;
      faz = f;
      const o = c.ilerlemeOzeti(sayaclar);
      durum = { faz, ...o, toplamAile: Object.keys(sayaclar).length };
      bag.yayinla(durum);
    };
    const tohumla = (oz: AktarimOzeti) => {
      for (const [aile, a] of Object.entries(oz.aileler)) sayaclar[aile] = c.ozettenSayac(a);
    };

    // ── bağlantı / ön plan beklemesi (deneme harcamaz) ──────────────────
    const kosulBekle = async () => {
      const onceki = faz;
      if (!bag.cevrimiciMi()) yayin('ag_bekleniyor');
      await Promise.race([bag.kosulBekle(), iptalSozu]);
      if (!iptal() && faz === 'ag_bekleniyor') yayin(onceki === 'ag_bekleniyor' ? 'suruyor' : onceki);
    };

    // ── tazeleme: beklemeden (şeridi kilitlemez), tek uçuş ──────────────
    let sonTazeleme: number | null = null;
    let tazeleUcusta = false;
    let ilkVeriGosterildi = false;
    const tazeleBelki = (olay: TazelemeOlayi) => {
      if (tazeleUcusta || iptal()) return;
      if (!c.tazelemeZamaniMi(olay, sonTazeleme, bag.simdi())) return;
      tazeleUcusta = true;
      sonTazeleme = bag.simdi();
      bag.tazele()
        .catch((e) => bag.log('uyari', 'aktarim.tazele', e))
        .finally(() => {
          tazeleUcusta = false;
        });
    };

    // ── /import/durum — kendi hatalarını kendisi çözer ──────────────────
    const ozetAl = async (): Promise<AktarimOzeti | null> => {
      let ardisik = 0;
      let yenilendi = false;
      while (!iptal()) {
        try {
          return await bag.ozetOku();
        } catch (e) {
          const bilgi = hataBilgisi(e);
          ardisik += 1;
          const k = c.hataKarari(bilgi, {
            cevrimici: bag.cevrimiciMi(), onPlanda: bag.onPlandaMi(), ardisik, yenilemeDenendi: yenilendi,
          });
          if (k.eylem === 'ag_bekle') {
            ardisik -= 1;
            await kosulBekle();
            continue;
          }
          if (k.eylem === 'token_yenile') {
            yenilendi = true;
            if (await bag.tokenYenile()) continue;
            return null;
          }
          if (k.eylem === 'bekle_tekrar' && ardisik < 3) {
            await uyu(k.beklemeMs);
            continue;
          }
          bag.log(k.log === 'hata' ? 'hata' : 'uyari', 'aktarim.ozet', e);
          return null;
        }
      }
      return null;
    };

    // ── sürücü: gecmis şeridi + küçük aileler için ortak kuyruklu şeritler ──
    const sur = async (eksik: readonly ImportAilesi[], damgalar: Record<string, string>, ucuslar: Record<string, number>) => {
      const plan = c.aktarimPlani(eksik);
      const kuyruk = [...plan.kucukler];
      const ertelenen: ImportAilesi[] = [];
      let durdu = false;
      let baskaCihaz = false;
      let yenileme: Promise<boolean> | null = null;
      const bitmeli = () => durdu || baskaCihaz || iptal();

      const aileSur = async (aile: ImportAilesi) => {
        let ardisik = 0;
        let yaris = 0;
        let yenilemeDenendi = false;
        while (!bitmeli()) {
          if (!bag.cevrimiciMi() || !bag.onPlandaMi()) {
            await kosulBekle();
            continue;
          }
          try {
            // M428: isteğin ÖNCESİNDE not düş — ortasında öldürülürsek bir
            // sonraki açılış sunucudaki taze damganın bize ait olduğunu bilsin.
            ucuslar[aile] = bag.simdi();
            await bag.ucusYaz({ ...ucuslar }).catch(() => {});
            const s = await bag.adimAt(aile);
            if (bitmeli()) return;
            ardisik = 0;
            yenilemeDenendi = false;
            yenileme = null;
            if (s.yaris) {
              // Aynı sayfayı başka bir istek önce saydı. İki kez üst üste →
              // başka bir sürücü var: gözlemciye geç, Trakt'ı iki kat yeme.
              yaris += 1;
              if (yaris >= 2) {
                baskaCihaz = true;
                return;
              }
            } else {
              yaris = 0;
              sayaclar[aile] = {
                toplam: s.toplam ?? null,
                aktarilan: s.aktarilan ?? 0,
                bekleyen: s.bekleyen ?? 0,
                reddedilen: s.reddedilen ?? 0,
                bitti: !!s.bitti,
              };
              if (s.guncellendiAt) {
                damgalar[aile] = s.guncellendiAt;
                bag.damgaYaz({ ...damgalar }).catch(() => {});
              }
              yayin();
              const veri = (s.buAdim?.aktarilan ?? 0) > 0;
              if (veri && !ilkVeriGosterildi) {
                ilkVeriGosterildi = true;
                tazeleBelki('ilk_veri');
              } else {
                tazeleBelki(s.bitti ? 'aile_bitti' : 'sayfa');
              }
            }
            if (s.bitti) return;
            await uyu(c.ADIM_ARASI_MS);
          } catch (e) {
            if (bitmeli()) return;
            const bilgi = hataBilgisi(e);
            ardisik += 1;
            const k = c.hataKarari(bilgi, {
              cevrimici: bag.cevrimiciMi(), onPlanda: bag.onPlandaMi(), ardisik, yenilemeDenendi,
            });
            if (k.log !== 'yok') bag.log(k.log, `aktarim.adim.${aile}`, e);
            switch (k.eylem) {
              case 'ag_bekle':
                ardisik -= 1;
                await kosulBekle();
                break;
              case 'bekle_tekrar':
                await uyu(k.beklemeMs);
                break;
              case 'token_yenile': {
                // 🔑 PAYLAŞILAN SÖZ: iki şerit aynı anda 401 alırsa ikisi de
                // AYNI yenilemeyi bekler; ikincisi "zaten denendi" sanıp
                // aktarımı DURDURMAZ.
                if (!yenileme) yenileme = bag.tokenYenile();
                const ok = await yenileme;
                yenilemeDenendi = true;
                if (!ok) {
                  durdu = true;
                  return;
                }
                break;
              }
              case 'aile_ertele':
                ertelenen.push(aile);
                return;
              case 'hepsini_durdur':
                durdu = true;
                return;
            }
          }
        }
      };

      const kucukSerit = async () => {
        while (!bitmeli()) {
          const aile = kuyruk.shift();
          if (!aile) return;
          await aileSur(aile);
        }
      };

      const seritler: Promise<void>[] = [];
      if (plan.gecmis) seritler.push(aileSur('gecmis'));
      for (let i = 0; i < c.KUCUK_SERIT_SAYISI; i += 1) seritler.push(kucukSerit());
      await Promise.all(seritler);
      return { ertelenen, durdu, baskaCihaz };
    };

    // ══════════════════════════════════════════════════════════════════════
    // AKIŞ
    // ══════════════════════════════════════════════════════════════════════
    try {
      yayin('kontrol');
      let ozet = await ozetAl();
      if (iptal()) return 'bos';
      if (!ozet) {
        yayin('bos');
        return 'bos';
      }
      tohumla(ozet);
      if (ozet.ilkTamam) {
        yayin('tamam');
        return 'tamam';
      }

      const damgalar = await bag.damgaOku().catch(() => ({} as Record<string, string>));
      const ucuslar = await bag.ucusOku().catch(() => ({} as Record<string, number>));
      // Önceki oturumun uçuş notları YALNIZ ilk kararda sayılır; sonraki
      // turlarda kendi yeni notlarımız gerçek bir yabancı sürücüyü örtmesin.
      let oncekiUcuslar: Record<string, number> = { ...ucuslar };
      let ertelenen: ImportAilesi[] = [];

      while (!iptal() && ozet && !ozet.ilkTamam) {
        const baska = c.baskaCihazSuruyorMu(ozet, damgalar, oncekiUcuslar, bag.simdi());
        oncekiUcuslar = {};
        if (!baska && bag.kilitAl()) {
          yayin('suruyor');
          let sonuc: Awaited<ReturnType<typeof sur>>;
          try {
            sonuc = await sur(ozet.eksikAileler, damgalar, ucuslar);
          } finally {
            bag.kilitBirak();
          }
          if (iptal()) return 'bos';
          if (sonuc.durdu) {
            yayin('bos');
            return 'bos';
          }
          ertelenen = sonuc.ertelenen;
          if (!sonuc.baskaCihaz) break;
        } else {
          // Başka cihaz ya da bu cihazda elle başlatılmış tur sürüyor: izle.
          yayin(baska ? 'baska_cihaz' : 'suruyor');
          await uyu(c.GOZLEM_ARALIGI_MS);
        }
        const yeni = await ozetAl();
        if (iptal()) return 'bos';
        if (!yeni) break;
        ozet = yeni;
        tohumla(ozet);
        yayin();
        tazeleBelki('sayfa');
      }
      if (iptal()) return 'bos';

      // 🔴 BİTİŞTE İKİ TAZELEME (ölçülen tuzak): `fetchFreshData(…, true)`
      // uçuşta bir tur varsa YENİ tur başlatmıyor, eskisini bekliyor. Tek
      // çağrı son sayfadan ÖNCE başlamış bir turu bekleyip dönebilir ve
      // son sayfa ekrana HİÇ gelmezdi. İkinci çağrı taze bir tur garantiler.
      await bag.tazele().catch((e) => bag.log('uyari', 'aktarim.tazele', e));
      await bag.tazele().catch((e) => bag.log('uyari', 'aktarim.tazele', e));
      if (iptal()) return 'bos';

      const son = (await ozetAl()) ?? ozet;
      if (son) tohumla(son);
      const bitenler = Object.entries(sayaclar).filter(([, s]) => s.bitti).map(([a]) => a);
      const kalanlar = son && !son.ilkTamam ? son.eksikAileler : ertelenen;
      const onceki = await bag.takilmaOku().catch(() => ({} as Record<string, number>));
      const t = c.takilmaGuncelle(onceki, kalanlar, bitenler);
      await bag.takilmaYaz(t.sayaclar).catch(() => {});
      for (const aile of t.bildir) {
        bag.log('hata', 'aktarim.aile_takildi', new Error(`${aile} ${c.TAKILMA_ESIGI} oturumdur aktarılamıyor`));
      }

      const f: MotorFazi = son?.ilkTamam ? 'bitti' : 'ertelendi';
      yayin(f);
      return f;
    } catch (e) {
      // Motorun KENDİSİNİN beklenmedik çöküşü — gerçek kusur, Discord'a.
      bag.log('hata', 'aktarim.motor', e);
      yayin('ertelendi');
      return 'ertelendi';
    }
  }

  return kur();
}
