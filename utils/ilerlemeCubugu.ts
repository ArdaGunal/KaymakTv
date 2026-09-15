import { getProgressBarColor } from './progressBarColor';

/**
 * İLERLEME ÇUBUĞUNUN TEK HESAP YERİ.
 *
 * ==========================================================================
 * 🔴 NEDEN AYRI BİR DOSYA — §C17.1 DÖRT TURDUR KAPANMIYOR
 * ==========================================================================
 * Çubuk ilk kez profilde yazıldı, sonra sırayla şuralarda "eksik" bulundu:
 * `HorizontalShowList` (M358) → kütüphane ızgarası (`LibraryGridItem`, M362)
 * → ve 2026-09-15'te kullanıcı dördüncüsünü bildirdi: *"sadece koleksiyonum
 * kısmında yok."*
 *
 * Her turda EKSİK OLAN ŞEY bileşen değil, HESAPTI: yüzde/bitti/bırakıldı
 * mantığı her çağıranın içine elle kopyalanıyordu. Renk `progressBarColor.ts`
 * ile zaten tek kaynağa çekilmişti (*"aynı dizi profilde ve burada FARKLI
 * renkte görünmesin"*) — bu dosya aynı işi YÜZDE için yapıyor.
 *
 * 🔑 Yeni bir yüzeye çubuk eklemek artık iki satır: bu fonksiyonu çağır,
 * `<ProgressBar>`a ver. Kopyalanacak mantık kalmadı.
 */

/** `showProgressMap` girdisinin çubuk için gereken kısmı. */
export interface IlerlemeGirdisi {
  aired?: number | null;
  completed?: number | null;
}

export interface CubukVerisi {
  /** 0–100. **0 ise çubuk ÇİZİLMEZ** — çağıran taraf `yuzde > 0` kontrol eder. */
  yuzde: number;
  renk: string;
}

/**
 * SAF — ilerleme kaydından çubuğun yüzdesini ve rengini türetir.
 *
 * ⚠️ `completed > 0` ŞARTI BİLİNÇLİ (kopyalandığı yerlerin hepsinde vardı):
 * hiç bölüm izlenmemiş dizide sıfır uzunlukta bir çubuk çizmek, "ilerleme
 * verisi yok" ile "hiç izlenmemiş"i aynı gösterirdi.
 *
 * @param ilerleme  `showProgressMap[traktId]` — yoksa `null`/`undefined`
 * @param birakildi Dizi gizlenmiş/bırakılmış mı (rengi değiştirir)
 */
export function cubukVerisi(
  ilerleme: IlerlemeGirdisi | null | undefined,
  birakildi: boolean,
): CubukVerisi {
  const aired = ilerleme?.aired ?? 0;
  const completed = ilerleme?.completed ?? 0;
  const varMi = aired > 0 && completed > 0;
  const bitti = varMi && completed >= aired;
  return {
    yuzde: varMi ? (completed / aired) * 100 : 0,
    renk: getProgressBarColor(birakildi, bitti),
  };
}
