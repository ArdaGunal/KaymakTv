// ==========================================================================
// TRAKT İÇE AKTARIMI — İSTEMCİNİN SAF KARARLARI (Faz T · T5.4)
// ==========================================================================
// Ağ yok, React yok, `axios`/`SecureStore` yok → `tests/arayuz/traktImport.test.mjs`
// doğrudan içe aktarıp sınıyor. Ağ katmanı: `services/api/traktImport.ts`.
//
// 🔴 NEDEN AYRI DOSYA: test koşucusu düz Node (bkz. tests/bildirimler/). `axios`
// ya da `expo-secure-store` içe aktaran bir dosya orada YÜKLENEMEZ; kararlar o
// dosyada kalsaydı hiç test edilemezdi.

/**
 * Worker'ın desteklediği aileler — `lib/traktAileler.js` → `AILE_KAYDI` ile
 * BİREBİR aynı olmalı. Sunucu tanımadığı aileye `aile_desteklenmiyor` döner,
 * yani uyuşmazlık sessiz kalmaz; yine de listeyi elle eşitlemek gerekiyor.
 *
 * ⛔ `favori_dizi` · `favori_film` BURADA YOK — onlar uygulamanın T1 öncesinden
 * kalan GİZLİ Trakt listesinde ve sabit bir yolları yok (önce `/users/me/lists`
 * çekilip ad ile bulunmalı). Ayrı dilim.
 */
export type ImportAilesi =
  | 'gecmis'
  | 'puan_dizi' | 'puan_sezon' | 'puan_bolum' | 'puan_film'
  | 'liste_dizi' | 'liste_film'
  | 'favori_trakt_dizi' | 'favori_trakt_film'
  | 'gizli_dizi' | 'gizli_film'
  | 'birakilan';

/**
 * Aktarım SIRASI — döngü bunu baştan sona gezer.
 *
 * 🔑 `gecmis` ÖNCE: en büyük ve kullanıcı için en değerli aile (ölçüldü:
 * 7.349 satır; kalan on bir aile toplam ~50 — M355). Kullanıcı ilerlemeyi
 * ilk dakikalarda görsün; küçük aileler saniyeler içinde biter.
 *
 * ⚠️ Zaten biten aile için sunucu ilk adımda `bitti: true` döner (durum satırı
 * `user_import_state`'te) — yani tekrar çalıştırmak veri ÇEKMEZ.
 */
export const AKTARIM_SIRASI: readonly ImportAilesi[] = [
  'gecmis',
  'puan_dizi', 'puan_sezon', 'puan_bolum', 'puan_film',
  'liste_dizi', 'liste_film',
  'favori_trakt_dizi', 'favori_trakt_film',
  'gizli_dizi', 'gizli_film',
  'birakilan',
] as const;

/** `POST /import/trakt` yanıtı (Worker: routes/importTrakt.js). */
export interface ImportAdimSonucu {
  aile: ImportAilesi;
  sayfa: number;
  sayfaSayisi: number | null;
  toplam: number | null;
  aktarilan: number;
  bekleyen: number;
  reddedilen: number;
  bitti: boolean;
  /** Aynı sayfayı başka bir istek işlemiş; veri kaybı yok (Worker'ın notu). */
  yaris?: boolean;
  buAdim?: { aktarilan: number; bekleyen: number; reddedilen: number };
}

/**
 * Hata sınıfları — çağıranın DAVRANIŞI buna bağlı:
 *   `gecici` · `trakt_limit` → bekle, yeniden dene
 *   `yetki` · `trakt_gerekli` · `genel` → DUR, kullanıcıya söyle
 */
export type ImportHataTuru = 'yetki' | 'trakt_limit' | 'gecici' | 'trakt_gerekli' | 'genel';

export interface ImportHataBilgisi {
  tur: ImportHataTuru;
  mesaj: string;
  /** Sunucunun ham kodu — geri çekilme süresi bazı kodlara ÖZEL (bkz. `sonrakiBeklemeMs`). */
  kod?: string;
  /** Yalnızca `trakt_limit`: sunucunun söylediği saniye. */
  retryAfter?: number;
}

/** Yeniden denenebilir mi? Tek karar yeri — UI ve döngü aynı cevabı kullanır. */
export const yenidenDenenebilir = (tur: ImportHataTuru): boolean =>
  tur === 'gecici' || tur === 'trakt_limit';

/**
 * SAF — sunucu yanıtını hata sınıfına çevirir.
 *
 * 🔴 SESSİZ BAŞARISIZLIK YOK (AI_RULES §2): tanınmayan her durum `genel`'e
 * düşer ve sunucunun mesajı KORUNUR; "bir şeyler ters gitti" demiyoruz.
 */
export function hataTuruCoz(status: number | undefined, data: any): ImportHataBilgisi {
  const kod = typeof data?.code === 'string' ? data.code : '';
  const mesaj = typeof data?.message === 'string' && data.message ? data.message : 'Aktarım sırasında bir sorun oldu.';

  if (kod === 'trakt_yetki' || status === 401) return { tur: 'yetki', mesaj };
  if (kod === 'trakt_gerekli') return { tur: 'trakt_gerekli', mesaj };
  if (kod === 'trakt_limit') {
    const s = Number(data?.retryAfter);
    return { tur: 'trakt_limit', mesaj, retryAfter: Number.isFinite(s) && s > 0 ? s : undefined };
  }
  // Worker'ın geçici sınıfları + kendi oran sınırı (429 `cok_istek`).
  if (kod === 'katalog_gecici' || kod === 'trakt_ag' || kod === 'trakt_hata' || kod === 'cok_istek') {
    // 🔑 `kod` KORUNUYOR: `cok_istek` bizim KENDİ dakikalık sayacımız ve
    // geri çekilmesi diğer geçici hatalardan FARKLI olmalı (aşağıya bak).
    return { tur: 'gecici', mesaj, kod };
  }
  // Ağ hiç kurulamadıysa `status` gelmez — bu da geçicidir (uçak modu, tünel).
  if (status === undefined) return { tur: 'gecici', mesaj };
  if (status >= 500) return { tur: 'gecici', mesaj };
  return { tur: 'genel', mesaj };
}

/**
 * SAF — bir sonraki adımdan önce beklenecek süre (ms).
 *
 * 🔴 Trakt'ın `Retry-After`'ı VARSA ona uyulur — sunucunun söylediği süreden
 * erken dönmek 429 döngüsü üretirdi (Trakt: kimlikli GET 1000/5 dk).
 * Geçici hatalarda üstel geri çekilme; normal adımlar arasında küçük bir nefes
 * payı (Worker'ın IP başına dakikada 40 adım sınırının altında kalır).
 */
export function sonrakiBeklemeMs(hata: ImportHataBilgisi | null, ardisikHata: number): number {
  if (!hata) return 250;
  if (hata.tur === 'trakt_limit' && hata.retryAfter) return Math.min(hata.retryAfter, 3600) * 1000;
  if (!yenidenDenenebilir(hata.tur)) return 0;
  // 🔴 `cok_istek` = Worker'ın KENDİ dakikalık IP sayacı. Penceresi bir
  // DAKİKA; 2/4/8 sn'lik üstel geri çekilme onu atlatamaz ve üç ardışık
  // hatada aile ATLANIR. Cihazda tam bu yaşandı (2026-09-13): kapanış turu
  // 41 istek atıyor, sınır 40'tı, `gecmis` atlandı ve kullanıcı *"izleme
  // geçmişi alınamadı"* gördü. Sınır 90'a çıkarıldı; bu bekleme ise İKİNCİ
  // savunma hattı — sayaç bir gün yine dolarsa tur ölmesin, beklesin.
  if (hata.kod === 'cok_istek') return 60_000;
  return Math.min(2000 * 2 ** Math.max(0, ardisikHata - 1), 30000);
}

/**
 * SAF — ilerleme yüzdesi. `toplam` bilinmiyorsa `null` (UI belirsiz çubuk çizer).
 * 🔑 Payda Trakt'ın toplamı, pay İŞLENEN satır: aktarılan + bekleyen + reddedilen
 * (Worker'ın T5.5 denklemi). Yalnızca `aktarilan` sayılsaydı, arşivde olmayan
 * yapımlar yüzünden çubuk asla %100'e ulaşmazdı.
 */
export function ilerlemeYuzdesi(s: Pick<ImportAdimSonucu, 'aktarilan' | 'bekleyen' | 'reddedilen' | 'toplam'> | null): number | null {
  if (!s || !s.toplam || s.toplam <= 0) return null;
  const islenen = (s.aktarilan || 0) + (s.bekleyen || 0) + (s.reddedilen || 0);
  return Math.max(0, Math.min(100, Math.round((islenen / s.toplam) * 100)));
}

/** SAF — ardışık hata tavanı. Üçünde de düşerse döngü durur, kullanıcı görür. */
export const ARDISIK_HATA_TAVANI = 3;

/**
 * SAF — bir ailenin hatası TÜM aktarımı durdurmalı mı?
 *
 * 🔴 AYRIM ÖNEMLİ: `yetki` ve `trakt_gerekli` KULLANICININ TAMAMINI ilgilendirir
 * (token geçersiz → hiçbir aile aktarılamaz) → DUR. Diğer kalıcı hatalar tek
 * aileye özgü olabilir (ör. Trakt bir uçta beklenmedik gövde döndürdü); o
 * aileyi atlayıp devam etmek, veri politikasının (*"hiçbir veri elenmez"*)
 * gereği — bir ucun arızası yüzünden on aileyi feda etmeyiz.
 */
export const tumunuDurdurur = (tur: ImportHataTuru): boolean =>
  tur === 'yetki' || tur === 'trakt_gerekli';

/**
 * SAF — genel ilerleme: kaçıncı aile / kaç aile.
 * Aile içi yüzde `ilerlemeYuzdesi` ile ayrı hesaplanıyor; ikisini tek sayıya
 * karıştırmak yanıltıcı olurdu (aileler çok farklı boyutta).
 */
export function aileIlerlemesi(bitenAileSayisi: number): { biten: number; toplam: number } {
  const toplam = AKTARIM_SIRASI.length;
  return { biten: Math.max(0, Math.min(bitenAileSayisi, toplam)), toplam };
}

// ==========================================================================
// 🔄 FARK TURU (§D15) — Trakt'ta SONRADAN yapılan ekleme
// ==========================================================================
// Sorun: aktarım tek seferlikti. Uygulamada yapılan işaretleme iki yere
// birden yazılıyor (bize + Trakt'a); ama kullanıcı **Trakt'ın sitesinden**
// dizi/film/liste/favori/puan eklerse bu bize hiç ulaşmıyordu.
//
// 🔑 Aşağıdaki uçlar TAM LİSTE döndürüyor ve yazmalarımız idempotent →
// *"yeniden koş"* zaten fark senkronudur. Ölçülen hacim ~50 satır = 11 istek.
//
// ⛔ `gecmis` YOK: 7.349 satır, yeniden koşmak 30 sayfa eder — geçmişin farkı
// ve Trakt'tan SİLİNENLER birlikte **K3 kapanış turunda** ele alınacak
// (kullanıcı kararı, 2026-09-12: *"T6 geçişinin hemen öncesine Final
// Kapanış/Fark Turu olarak bırakalım"*). Bu tur hiçbir satır SİLMEZ.
export const FARK_AILELERI: readonly ImportAilesi[] = AKTARIM_SIRASI.filter(
  (a) => a !== 'gecmis',
);

/** Sessiz fark turu en fazla bu sıklıkta koşar. */
export const FARK_ARALIGI_MS = 6 * 60 * 60 * 1000;

/**
 * SAF — sessiz fark turu şimdi koşmalı mı?
 *
 * 🔴 KISITLAMA ŞART: kullanıcı uygulamayı günde on kez açabilir; her açılışta
 * 11 istek atmak Trakt kotasını (kimlikli GET 1000/5 dk) ve kullanıcının
 * mobil verisini gereksiz yere yer. Altı saat, "aynı gün içinde yapılan bir
 * değişiklik akşama kadar gelir" dengesi.
 *
 * @param sonKosuMs `null` = hiç koşmadı → KOŞSUN (ilk fırsat)
 */
export function farkTuruZamani(sonKosuMs: number | null, simdi = Date.now()): boolean {
  if (sonKosuMs === null) return true;
  if (!Number.isFinite(sonKosuMs)) return true;
  // Cihaz saati geriye alınmışsa (gelecek damga) bekletmeyip koş — aksi hâlde
  // kullanıcı saatini ileri alıp geri aldığında fark turu AYLARCA kilitlenirdi.
  if (sonKosuMs > simdi) return true;
  return simdi - sonKosuMs >= FARK_ARALIGI_MS;
}

// ==========================================================================
// 🧹 K3 KAPANIŞ TURU — fark + Trakt'tan SİLİNENLERİN temizliği
// ==========================================================================
// K3 (kullanıcı, 2026-09-11): *"Tam aktarım + T6 geçişinde kapanış (fark)
// turu."* K4: *"Trakt'tan silinen bizden de silinir — yalnızca
// `source='trakt'`; kullanıcının kendi satırlarına dokunulmaz."*
//
// §D15'in fark turundan FARKI: o yalnızca EKLER, bu ayrıca SİLER.
// 🔑 `gecmis` de dahil — fark turunda dışarıdaydı çünkü 30 sayfa yeniden
// çekmek fark senkronu değildi; kapanış turunda `start_at` ile DAR pencere
// çekiliyor ve her sayfanın kendi zaman dilimi süpürülüyor.
export const KAPANIS_AILELERI: readonly ImportAilesi[] = AKTARIM_SIRASI;

/**
 * SAF — sunucunun `supurulen` alanını okunur bir sayıya/sebebe çevirir.
 *
 * 🔴 SESSİZ SİLME YOK: kaç satır silindiği kullanıcıya söylenebilmeli.
 * Atlanan süpürme de gizlenmez — "0 silindi" ile "süpürülemedi" AYRI şeyler.
 */
export function supurmeOzeti(supurulen: unknown): { silinen: number; atlandi: string | null } {
  if (typeof supurulen === 'number' && Number.isFinite(supurulen)) {
    return { silinen: Math.max(0, supurulen), atlandi: null };
  }
  if (supurulen && typeof supurulen === 'object') {
    const o = supurulen as Record<string, unknown>;
    if (typeof o.atlandi === 'string') return { silinen: 0, atlandi: o.atlandi };
    if (typeof o.hata === 'string') return { silinen: 0, atlandi: `hata:${o.hata}` };
  }
  return { silinen: 0, atlandi: null };
}
