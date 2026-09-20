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
