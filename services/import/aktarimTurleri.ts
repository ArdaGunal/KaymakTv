// ==========================================================================
// OTOMATİK AKTARIM MOTORUNUN TİPLERİ (§C33)
// ==========================================================================
// `aktarimMotoru.ts`'ten ayrıldı (M428): motor 400 satır sınırına dayandı.
// YALNIZCA tip — çalışma zamanı kodu yok, bu yüzden Node testleri etkilenmez.

import type { ImportAdimSonucu, ImportAilesi } from '../api/traktImportCekirdek';
import type { AktarimOzeti } from './aktarimCekirdek';

/**
 * `tamam` = ilk aktarım bu oturumdan ÖNCE bitmişti (bant yok).
 * `bitti` = BU oturumda bitti (bant kısa bir "hazır" gösterir).
 */
export type MotorFazi =
  | 'bos' | 'kontrol' | 'suruyor' | 'ag_bekleniyor' | 'baska_cihaz' | 'bitti' | 'tamam' | 'ertelendi';

export interface MotorDurumu {
  faz: MotorFazi;
  islenen: number;
  toplam: number;
  bekleyen: number;
  bitenAile: number;
  toplamAile: number;
  /** Bantta gösterilen yüzde; `null` = henüz anlamlı değil (bkz. `ilerlemeOzeti`). */
  yuzde: number | null;
}

export type AdimYaniti = ImportAdimSonucu & { guncellendiAt?: string };

export interface MotorBagimliliklari {
  ozetOku(): Promise<AktarimOzeti>;
  adimAt(aile: ImportAilesi): Promise<AdimYaniti>;
  /** Trakt token'ını yeniler; başarısızsa `false` (oturum kapanışı bağlamanın işi). */
  tokenYenile(): Promise<boolean>;
  tazele(): Promise<void>;
  bekle(ms: number): Promise<void>;
  /** Çevrimiçi VE ön planda olunca çözülür. */
  kosulBekle(): Promise<void>;
  cevrimiciMi(): boolean;
  onPlandaMi(): boolean;
  simdi(): number;
  kilitAl(): boolean;
  kilitBirak(): void;
  damgaOku(): Promise<Record<string, string>>;
  damgaYaz(d: Record<string, string>): Promise<void>;
  /** M428 — aile → son isteğin CİHAZ saati (istek ortasında öldürülmeyi tanımak için). */
  ucusOku(): Promise<Record<string, number>>;
  ucusYaz(u: Record<string, number>): Promise<void>;
  takilmaOku(): Promise<Record<string, number>>;
  takilmaYaz(s: Record<string, number>): Promise<void>;
  log(seviye: 'uyari' | 'hata', baglam: string, hata: unknown): void;
  yayinla(d: MotorDurumu): void;
}

export interface AktarimMotoru {
  baslat(): Promise<MotorFazi>;
  durdur(): void;
  durum(): MotorDurumu;
}
