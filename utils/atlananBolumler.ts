// ==========================================================================
// ATLANAN BÖLÜMLER — "öncekileri de işaretleyeyim mi?"  (M418)
// ==========================================================================
// 🔴 CANLI HATA (kullanıcı, 2026-09-20, Discord'a düştü): dizi 21020'nin
// 5. sezonunda Trakt'ta YALNIZCA 19, 20, 21 numaralı bölümler var. Kullanıcı
// S5E19'a bastı; istemci "demek ki 1–18 atlanmış" diyerek OLMAYAN 18 bölümü
// işaretlemeye çalıştı. Worker'ın yanıtı: `kismi` + `episode|21020|5|1..18`
// (arşivde de yok, §C30 çekmesi de bulamadı: `cekildi_eksik`).
//
// KÖK: iki çağrı yerinde de `for (let i = 1; i < bolumNo; i++)` döngüsü vardı
// — yani bölüm numaralarının 1'den N'e KESİNTİSİZ gittiği varsayımı. Sezon
// listesi elde olduğu hâlde ona bakılmıyordu; numarası listede olmayan bir
// bölüm "izlenmemiş" sayılıyordu, oysa OLMAYAN bölümdü.
//
// ⚠️ İLERLEME YOKSA BOŞ DÖNER: "hangi bölümler var" bilgisi olmadan
// üretilecek her liste uydurmadır (aynı gerekçe: `optimistikIlerleme.ts`'in
// `null` dönüşü). O durumda kullanıcıya soru sorulmaz, yalnızca bastığı
// bölüm işaretlenir — sunucuya var olmayan bölüm GÖNDERİLMEZ.

type BolumBenzeri = { number?: number; completed?: boolean };
type SezonBenzeri = { number?: number; episodes?: BolumBenzeri[] | null };
type IlerlemeBenzeri = { seasons?: SezonBenzeri[] | null } | null | undefined;

/**
 * SAF — bu bölümden ÖNCE gelen, GERÇEKTEN VAR OLAN ve izlenmemiş bölümler.
 *
 * @param sezonBolumleri 🆕 M420 — sezonda VAR OLAN bölüm numaraları (ekranın
 *   elindeki katalog verisi). Verilirse "hangi bölümler var" sorusu buradan
 *   cevaplanır; ilerleme kaydı yalnızca "hangileri izlendi" için kullanılır.
 *
 *   🔴 NEDEN GEREKLİ: ilerleme kaydı dizinin İLK işaretlemesinden SONRA
 *   sunucudan geliyor (2-3 sn). O pencerede yalnız ilerlemeye bakınca sezon
 *   "bölümsüz" görünüyor ve "öncekileri de işaretleyeyim mi?" sorusu HİÇ
 *   sorulmuyordu (kullanıcı bildirdi: arka arkaya hızlı işaretlemede soru yok,
 *   birkaç saniye beklenince var). Ekran bölüm listesini zaten biliyor.
 *
 * @returns artan sırada numara listesi; bilinmiyorsa boş liste
 */
export function atlananBolumler(
  ilerleme: IlerlemeBenzeri,
  sezonNo: number,
  bolumNo: number,
  sezonBolumleri?: number[] | null,
): number[] {
  const sezon = ilerleme?.seasons?.find((s) => s?.number === sezonNo);
  const ilerlemeBolumleri = Array.isArray(sezon?.episodes) ? sezon!.episodes! : [];

  // İzlenmiş numaralar — yalnızca ilerlemeden bilinir.
  const izlenen = new Set(
    ilerlemeBolumleri.filter((b) => b?.completed && typeof b.number === 'number').map((b) => b.number as number),
  );

  // Var olan bölümler: önce ekranın listesi, yoksa ilerlemedeki liste.
  const evren = Array.isArray(sezonBolumleri) && sezonBolumleri.length > 0
    ? sezonBolumleri.filter((n) => typeof n === 'number')
    : ilerlemeBolumleri.filter((b) => typeof b?.number === 'number').map((b) => b.number as number);

  return evren
    .filter((n) => n < bolumNo && !izlenen.has(n))
    .sort((a, b) => a - b);
}

// ==========================================================================
// ÇOK SEZONLU PLAN (M421)
// ==========================================================================
// 🔴 ÜRÜN KARARI (kullanıcı, 2026-09-20): *"2. sezona geçen bir kullanıcı
// mantıken 1. sezonu da bitirmiştir."* Eski davranış YALNIZCA aktif sezonu
// tarıyordu; S2E2'ye basıp "evet" diyen kullanıcıda S1 olduğu gibi kalıyordu.
//
// ⚠️ ÖZEL SEZON (0) PLANA GİRMEZ: kamera arkası/yorum bölümleri "önceki
// bölüm" sayılmaz; Trakt da ilerleme hesabına katmıyor (`optimistikIlerleme`
// ve Worker `ilerleme.js` aynı kuralı uyguluyor).
//
// ⚠️ YAYINLANMAMIŞ BÖLÜM PLANA GİRMEZ: çağıran YALNIZCA yayınlanmış
// numaraları vermeli (`isEpisodeAired`), yoksa sunucu "gelecek damga" diye
// reddeder ve iki taraf ıraksar.

/** Bir sezonun ekranda bilinen (yayınlanmış) bölüm numaraları. */
export type SezonListesi = { sezon: number; bolumler: number[] };

/** İşaretlenecek iş: sezon → bölüm numaraları (artan). */
export type IsaretlemePlani = { sezon: number; bolumler: number[] };

/**
 * SAF — seçilen bölüm DAHİL, ondan önce gelen TÜM izlenmemiş bölümler
 * (önceki sezonlar dahil).
 *
 * @param sezonListeleri ekranın bildiği sezon/bölüm evreni. Boşsa ilerleme
 *   kaydındaki sezonlar kullanılır (ikisi de yoksa plan yalnız seçilen bölüm).
 * @returns sezon numarasına göre artan plan; her sezonun bölümleri artan
 */
export function atlananPlan(
  ilerleme: IlerlemeBenzeri,
  sezonNo: number,
  bolumNo: number,
  sezonListeleri?: SezonListesi[] | null,
): IsaretlemePlani[] {
  const ilerlemeSezonlari = ilerleme?.seasons || [];
  const evren: SezonListesi[] = Array.isArray(sezonListeleri) && sezonListeleri.length > 0
    ? sezonListeleri
    : ilerlemeSezonlari.map((s) => ({
      sezon: s?.number as number,
      bolumler: (s?.episodes || []).map((b) => b?.number as number).filter((n) => typeof n === 'number'),
    }));

  const plan: IsaretlemePlani[] = [];
  for (const s of evren) {
    if (typeof s?.sezon !== 'number' || s.sezon <= 0 || s.sezon > sezonNo) continue;
    const izlenen = new Set(
      (ilerlemeSezonlari.find((x) => x?.number === s.sezon)?.episodes || [])
        .filter((b) => b?.completed && typeof b.number === 'number')
        .map((b) => b!.number as number),
    );
    const bolumler = (s.bolumler || [])
      .filter((n) => typeof n === 'number')
      // Seçilen sezonda YALNIZCA seçilen bölüme kadar; öncekilerde hepsi.
      .filter((n) => (s.sezon === sezonNo ? n <= bolumNo : true))
      .filter((n) => !izlenen.has(n) || (s.sezon === sezonNo && n === bolumNo))
      .sort((a, b) => a - b);
    if (bolumler.length) plan.push({ sezon: s.sezon, bolumler });
  }

  // Evren bilinmiyorsa (yeni dizi, ekran listesi yok) en azından seçilen bölüm.
  if (plan.length === 0) return [{ sezon: sezonNo, bolumler: [bolumNo] }];
  return plan.sort((a, b) => a.sezon - b.sezon);
}

/** Plandaki toplam bölüm sayısı — onay metni sayıyı GÖSTERMEK ZORUNDA. */
export const planToplami = (plan: IsaretlemePlani[]): number =>
  plan.reduce((t, p) => t + p.bolumler.length, 0);

/** Plan yalnızca seçilen bölümden mi ibaret? (soru sormaya gerek yok) */
export const planTekBolumMu = (plan: IsaretlemePlani[], sezonNo: number, bolumNo: number): boolean =>
  plan.length === 1 && plan[0].sezon === sezonNo
  && plan[0].bolumler.length === 1 && plan[0].bolumler[0] === bolumNo;
