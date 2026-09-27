// ==========================================================================
// SAF · OTOMATİK TRAKT AKTARIMININ KARARLARI (§C33)
// ==========================================================================
// Ağ, depolama, zamanlayıcı YOK — yalnızca girdi → karar. Motor
// (`aktarimMotoru.ts`) bu kararları uygular, bağlama (`aktarimBaglanti.ts`)
// gerçek dünyayı motora takar.
//
// 🔴 NEDEN VAR (27 Eylül, DalekCan): T6.3'ten beri kütüphane YALNIZCA bizden
// okunuyor. Aktarımı hiç koşmamış bir Trakt kullanıcısı iki hafta boyunca her
// açılışta "kütüphanen boş" gördü; aktarım yalnızca Ayarlar'daki bir soruyla
// başlıyordu. Ürün kararı: aktarım OTOMATİK, sessiz ve kırılmaz.
//
// ⚠️ Çalışma zamanı importu YOK (yalnızca `import type`): testler Node'un
// yerleşik TS soymasıyla bu dosyayı doğrudan yüklüyor.

import type { ImportAilesi, ImportHataBilgisi } from '../api/traktImportCekirdek';

/** Paralel küçük-aile şeridi sayısı (kullanıcı onayı: 2). `gecmis` ayrıca koşar. */
export const KUCUK_SERIT_SAYISI = 2;
/** Kütüphane tazelemesi en sık bu aralıkla (ilk sayfa ve bitiş hariç). */
export const TAZELEME_ARALIGI_MS = 8_000;
/** Bitmemiş bir aile bu kadar saniye içinde BAŞKASI tarafından ilerletildiyse → gözlemci. */
export const BASKA_CIHAZ_TAZE_SN = 15;
/** Gözlemcinin durum sorma aralığı. */
export const GOZLEM_ARALIGI_MS = 10_000;
/** Ardışık başarılı adımlar arası nefes (Worker'ın IP sınırının altında kalmak için). */
export const ADIM_ARASI_MS = 250;
/** Oturum içinde aynı ailede bu kadar ardışık GEÇİCİ hata → aile sonraki oturuma ertelenir. */
export const OTURUM_GECICI_TAVANI = 6;
/** Aynı aile bu kadar oturum üst üste ertelenirse → Discord (gerçek "kurtarılamayan"). */
export const TAKILMA_ESIGI = 3;

export type AileDurumu = 'baslamadi' | 'suruyor' | 'bitti' | 'kapanis';

/** `POST /import/durum` yanıtının ailesi (Worker: `lib/aktarimOzeti.js`). */
export interface AileOzeti {
  durum: AileDurumu;
  sayfa: number;
  toplam: number | null;
  aktarilan: number;
  bekleyen: number;
  reddedilen: number;
  guncellendiAt: string | null;
  yasSn: number | null;
}

export interface AktarimOzeti {
  ilkTamam: boolean;
  eksikAileler: ImportAilesi[];
  aileler: Partial<Record<ImportAilesi, AileOzeti>>;
  toplam: { aktarilan: number; bekleyen: number };
}

// ──────────────────────────────────────────────────────────────────────────
// PLAN
// ──────────────────────────────────────────────────────────────────────────

/**
 * Eksik aileleri iki kola ayırır: `gecmis` kendi şeridinde (sayfaları sıralı,
 * doğası gereği paralelleşmez), küçük aileler ortak bir kuyrukta — şeritler
 * kuyruktan çeker, böylece yük kendiliğinden dengelenir.
 */
export function aktarimPlani(eksik: readonly ImportAilesi[]): { gecmis: boolean; kucukler: ImportAilesi[] } {
  return {
    gecmis: eksik.includes('gecmis'),
    kucukler: eksik.filter((a) => a !== 'gecmis'),
  };
}

// ──────────────────────────────────────────────────────────────────────────
// GÖZLEMCİ MODU — migration'sız çift cihaz koruması
// ──────────────────────────────────────────────────────────────────────────

/**
 * Bitmemiş bir aile son `BASKA_CIHAZ_TAZE_SN` içinde ilerletilmiş VE o damga
 * bu cihazın ürettiği son damga DEĞİLSE, başka bir cihaz aktarıyor demektir.
 *
 * 🔑 KENDİ DAMGAMI TANIMAK ŞART: zorla kapatılıp hemen yeniden açılan
 * uygulama kendi 5 sn önceki ilerlemesini "başka cihaz" sanıp kullanıcıya
 * yalan söylerdi (cihaz testi 2). Damgalar sunucunun (`guncellendiAt`),
 * karşılaştırma dizgi eşitliği — saat kayması yok.
 */
export function baskaCihazSuruyorMu(
  ozet: AktarimOzeti,
  kendiDamgalarim: Readonly<Record<string, string>>,
): boolean {
  return ozet.eksikAileler.some((aile) => {
    const a = ozet.aileler[aile];
    if (!a || a.durum !== 'suruyor') return false;
    if (a.yasSn === null || a.yasSn >= BASKA_CIHAZ_TAZE_SN) return false;
    return !!a.guncellendiAt && a.guncellendiAt !== kendiDamgalarim[aile];
  });
}

// ──────────────────────────────────────────────────────────────────────────
// HATA KARARI + LOG POLİTİKASI
// ──────────────────────────────────────────────────────────────────────────

export type HataEylemi =
  | 'bekle_tekrar'   // aynı adımı bekleyip yeniden dene
  | 'ag_bekle'       // bağlantı / ön plan gelene kadar bekle (deneme HARCANMAZ)
  | 'token_yenile'   // bir kez token yenile, sonra tekrar
  | 'aile_ertele'    // bu aileyi sonraki oturuma bırak, diğerleri sürsün
  | 'hepsini_durdur';

/** `yok` = hiç log · `uyari` = cihaz günlüğü (Discord'a GİTMEZ) · `hata` = Discord. */
export type LogSeviyesi = 'yok' | 'uyari' | 'hata';

export interface HataBaglami {
  cevrimici: boolean;
  onPlanda: boolean;
  /** Bu ailede art arda kaç adım düştü (bu hata DAHİL). */
  ardisik: number;
  /** Bu oturumda token yenilemesi zaten denendi mi? */
  yenilemeDenendi: boolean;
}

export interface HataKarari {
  eylem: HataEylemi;
  beklemeMs: number;
  log: LogSeviyesi;
}

const ustelGeriCekilme = (ardisik: number): number =>
  Math.min(2000 * 2 ** Math.max(0, ardisik - 1), 30_000);

/**
 * Bir adım hatasına ne yapılacağı ve NASIL loglanacağı.
 *
 * 🔴 DISCORD YALNIZ KURTARILAMAYAN İÇİN (kullanıcı kararı). Geçici hata,
 * kendi kendine düzelir; onu Discord'a "hata" diye yazmak 27 Eylül'deki
 * yanlış alarmı üretti. Beklenmeyen bir 4xx (`genel`) ise gerçek bir kusurdur.
 */
export function hataKarari(bilgi: ImportHataBilgisi, b: HataBaglami): HataKarari {
  // Uygulama arka planda ya da ağ yok: istek DONDU, sunucu reddetmedi. Deneme
  // bütçesi harcanmaz, log da yazılmaz — bu beklenen bir durum.
  if ((bilgi.tur === 'gecici' || bilgi.tur === 'trakt_limit') && (!b.cevrimici || !b.onPlanda)) {
    return { eylem: 'ag_bekle', beklemeMs: 0, log: 'yok' };
  }

  switch (bilgi.tur) {
    case 'yetki':
      return b.yenilemeDenendi
        ? { eylem: 'hepsini_durdur', beklemeMs: 0, log: 'uyari' }
        : { eylem: 'token_yenile', beklemeMs: 0, log: 'yok' };

    case 'trakt_gerekli':
      // Google-only oturum: motor zaten başlamamalıydı. Kusur değil, dur.
      return { eylem: 'hepsini_durdur', beklemeMs: 0, log: 'uyari' };

    case 'trakt_limit': {
      const s = bilgi.retryAfter && bilgi.retryAfter > 0 ? Math.min(bilgi.retryAfter, 3600) : 60;
      return { eylem: 'bekle_tekrar', beklemeMs: s * 1000, log: 'uyari' };
    }

    case 'gecici': {
      if (b.ardisik >= OTURUM_GECICI_TAVANI) {
        return { eylem: 'aile_ertele', beklemeMs: 0, log: 'uyari' };
      }
      // `cok_istek` = Worker'ın DAKİKALIK IP sayacı; üstel 2/4/8 sn onu atlatamaz.
      const ms = bilgi.kod === 'cok_istek' ? 60_000 : ustelGeriCekilme(b.ardisik);
      return { eylem: 'bekle_tekrar', beklemeMs: ms, log: 'uyari' };
    }

    case 'genel':
    default:
      return { eylem: 'aile_ertele', beklemeMs: 0, log: 'hata' };
  }
}

/**
 * Elle başlatılan eski yol (`useTraktImport`) için aynı politika: yalnız
 * beklenmeyen hata Discord'a gider. Geçici hatalar döngü içinde zaten
 * yeniden deneniyor.
 */
export const adimHatasiLogSeviyesi = (bilgi: ImportHataBilgisi): LogSeviyesi =>
  bilgi.tur === 'genel' ? 'hata' : 'uyari';

// ──────────────────────────────────────────────────────────────────────────
// OTURUMLAR ARASI TAKILMA SAYACI
// ──────────────────────────────────────────────────────────────────────────

/**
 * Ertelenen ailelerin sayacı bir artar, bitenlerin sayacı silinir.
 * `bildir`: bu turda eşiğe TAM ulaşanlar — Discord'a bir kez gider, her
 * açılışta tekrar tekrar değil.
 */
export function takilmaGuncelle(
  onceki: Readonly<Record<string, number>>,
  ertelenenler: readonly string[],
  bitenler: readonly string[],
): { sayaclar: Record<string, number>; bildir: string[] } {
  const sayaclar: Record<string, number> = { ...onceki };
  for (const a of bitenler) delete sayaclar[a];
  const bildir: string[] = [];
  for (const a of ertelenenler) {
    const yeni = (sayaclar[a] ?? 0) + 1;
    sayaclar[a] = yeni;
    if (yeni === TAKILMA_ESIGI) bildir.push(a);
  }
  return { sayaclar, bildir };
}

// ──────────────────────────────────────────────────────────────────────────
// TAZELEME ZAMANLAMASI
// ──────────────────────────────────────────────────────────────────────────

export type TazelemeOlayi = 'ilk_veri' | 'sayfa' | 'aile_bitti';

/**
 * 🔑 İLK VERİ BEKLEMEZ: Trakt geçmişi en yeniden eskiye döner, yani ilk sayfa
 * kullanıcının ŞU AN izlediği diziler. Onları ~5 sn içinde göstermek "bozuk"
 * izlenimini önleyen asıl şey. Sonrası 8 sn'de bir — her adımda tazelemek
 * 2 bin satırlık kütüphaneyi saniyede bir indirmek olurdu.
 */
export function tazelemeZamaniMi(olay: TazelemeOlayi, sonTazelemeMs: number | null, simdiMs: number): boolean {
  if (sonTazelemeMs === null) return true;
  if (olay === 'ilk_veri') return true;
  return simdiMs - sonTazelemeMs >= TAZELEME_ARALIGI_MS;
}

// ──────────────────────────────────────────────────────────────────────────
// GÖRÜNÜR İLERLEME
// ──────────────────────────────────────────────────────────────────────────

export interface AileSayaci {
  toplam: number | null;
  aktarilan: number;
  bekleyen: number;
  reddedilen: number;
  bitti: boolean;
}

/**
 * Bant için tek sayı çifti: işlenen / toplam.
 *
 * 🔑 Pay İŞLENEN satır (aktarılan + bekleyen + reddedilen) — yalnız
 * `aktarilan` sayılsaydı katalogda bekleyenler yüzünden çubuk %100'e hiç
 * ulaşmazdı (`ilerlemeYuzdesi` ile aynı kural). Toplamı henüz bilinmeyen
 * ailede payda işlenenle sınırlanır; bitmiş aile kendi işlenenini sayar.
 */
export function ilerlemeOzeti(sayaclar: Readonly<Record<string, AileSayaci>>): {
  islenen: number;
  toplam: number;
  bekleyen: number;
  bitenAile: number;
} {
  let islenen = 0;
  let toplam = 0;
  let bekleyen = 0;
  let bitenAile = 0;
  for (const s of Object.values(sayaclar)) {
    const buAile = s.aktarilan + s.bekleyen + s.reddedilen;
    islenen += buAile;
    bekleyen += s.bekleyen;
    toplam += s.bitti ? buAile : Math.max(s.toplam ?? 0, buAile);
    if (s.bitti) bitenAile += 1;
  }
  return { islenen, toplam, bekleyen, bitenAile };
}

/** Özetteki bir aileyi sayaca çevirir (motor açılışta bununla tohumlanır). */
export const ozettenSayac = (a: AileOzeti | undefined): AileSayaci => ({
  toplam: a?.toplam ?? null,
  aktarilan: a?.aktarilan ?? 0,
  bekleyen: a?.bekleyen ?? 0,
  reddedilen: a?.reddedilen ?? 0,
  bitti: a?.durum === 'bitti' || a?.durum === 'kapanis',
});
