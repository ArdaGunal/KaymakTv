// ==========================================================================
// AKTARIM MOTORUNUN GERÇEK DÜNYAYA BAĞLANMASI (§C33)
// ==========================================================================
// Motor (`aktarimMotoru.ts`) hiçbir şey import etmiyor; burada takılıyor:
// Worker uçları · token yenileme · kütüphane tazelemesi · NetInfo · AppState ·
// AsyncStorage · log · store. Uygulama ömrü boyunca TEK örnek (tembel kurulum:
// ilk çağrıda — modül yükleme sırası döngüsel importa takılmasın).
//
// ⛔ `fetchers.ts` DONDURULMUŞ: burada yalnızca ÇAĞRILIYOR, değiştirilmiyor.

import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

import * as SecureStore from '../../utils/secureStorage';
import { logError, logWarning } from '../../utils/errorLog';
import { aktarimDurumunuYaz } from '../../store/aktarimStore';
import { traktImportAdimi, traktImportOzeti } from '../api/traktImport';
import { refreshAccessToken } from '../api/traktClient';
import { fetchFreshData } from '../library/fetchers';
import * as cekirdek from './aktarimCekirdek';
import { kilitAl, kilitBirak } from './aktarimKilidi';
import { aktarimMotoruKur, type AktarimMotoru, type AdimYaniti } from './aktarimMotoru';

/** Bu cihazın son ürettiği sunucu damgaları (gözlemci modu kendini tanısın). */
const DAMGA_ANAHTARI = 'kaymak_aktarim_damga_v1';
/** M428 — aile → son isteğin cihaz saati (istek ortasında öldürülmeyi tanımak için). */
const UCUS_ANAHTARI = 'kaymak_aktarim_ucus_v1';
/** Oturumlar arası takılma sayacı (Discord yalnız 3. oturumda). */
const TAKILMA_ANAHTARI = 'kaymak_aktarim_takilma_v1';

// ── Çevrimiçi / ön plan ──────────────────────────────────────────────────
// `useNetworkStatus` ile AYNI kural: `isInternetReachable` henüz ölçülmediyse
// (`null`) bağlı varsayılır — açılışta yanlış bir "bağlantı bekleniyor" olmasın.
let cevrimici = true;
let onPlanda = AppState.currentState === 'active' || AppState.currentState == null;
let bekleyenler: Array<() => void> = [];
let dinleniyor = false;

const kosullariKontrolEt = () => {
  if (!cevrimici || !onPlanda) return;
  const b = bekleyenler;
  bekleyenler = [];
  b.forEach((r) => r());
};

function dinle(): void {
  if (dinleniyor) return;
  dinleniyor = true;
  NetInfo.addEventListener((s) => {
    const ulasilabilir = s.isInternetReachable;
    cevrimici = ulasilabilir === null ? (s.isConnected ?? true) : ulasilabilir;
    kosullariKontrolEt();
  });
  AppState.addEventListener('change', (s) => {
    onPlanda = s === 'active';
    kosullariKontrolEt();
  });
}

async function jsonOku<T>(anahtar: string, bos: T): Promise<T> {
  try {
    const ham = await AsyncStorage.getItem(anahtar);
    if (!ham) return bos;
    const v = JSON.parse(ham);
    return v && typeof v === 'object' ? (v as T) : bos;
  } catch {
    return bos;
  }
}

async function jsonYaz(anahtar: string, deger: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(anahtar, JSON.stringify(deger));
  } catch {
    // Yazılamazsa en kötü ihtimalle bir sonraki açılışta ≤15 sn gözlemci
    // kalınır ya da takılma sayacı bir tur geç artar — veri kaybı değil.
  }
}

/**
 * Kütüphaneyi ZORLA tazeler (TTL'i atlar). Aktarım yazdığı satırları ekrana
 * ancak bununla getirir — 27 Eylül'de eksik olan halka buydu: aktarım 18:35'te
 * bitmişti, veri ekrana 10 dakikalık TTL dolunca geldi.
 */
export async function kutuphaneyiTazele(): Promise<void> {
  let token: string | null = null;
  try {
    token = await SecureStore.getItemAsync('traktAccessToken');
  } catch {
    token = null;
  }
  if (token) await fetchFreshData(token, true);
}

let motor: AktarimMotoru | null = null;

/** Uygulamanın TEK aktarım motoru. */
export function aktarimMotoru(): AktarimMotoru {
  if (motor) return motor;
  dinle();
  motor = aktarimMotoruKur(
    {
      ozetOku: () => traktImportOzeti(),
      adimAt: (aile) => traktImportAdimi(aile) as Promise<AdimYaniti>,
      tokenYenile: async () => {
        try {
          await refreshAccessToken();
          return true;
        } catch {
          // `refreshAccessToken` başarısızlığı KENDİSİ logluyor ve oturum
          // kapanışını tetikliyor — burada ikinci bir kayıt gürültü olurdu.
          return false;
        }
      },
      tazele: kutuphaneyiTazele,
      bekle: (ms) => new Promise((r) => setTimeout(r, ms)),
      kosulBekle: () =>
        new Promise<void>((r) => {
          if (cevrimici && onPlanda) r();
          else bekleyenler.push(r);
        }),
      cevrimiciMi: () => cevrimici,
      onPlandaMi: () => onPlanda,
      simdi: () => Date.now(),
      kilitAl: () => kilitAl('motor'),
      kilitBirak: () => kilitBirak('motor'),
      damgaOku: () => jsonOku<Record<string, string>>(DAMGA_ANAHTARI, {}),
      damgaYaz: (d) => jsonYaz(DAMGA_ANAHTARI, d),
      ucusOku: () => jsonOku<Record<string, number>>(UCUS_ANAHTARI, {}),
      ucusYaz: (u) => jsonYaz(UCUS_ANAHTARI, u),
      takilmaOku: () => jsonOku<Record<string, number>>(TAKILMA_ANAHTARI, {}),
      takilmaYaz: (s) => jsonYaz(TAKILMA_ANAHTARI, s),
      log: (seviye, baglam, hata) => (seviye === 'hata' ? logError(baglam, hata) : logWarning(baglam, hata)),
      yayinla: aktarimDurumunuYaz,
    },
    cekirdek,
  );
  return motor;
}

/**
 * Çıkışta: takılma sayacı bir SONRAKİ hesaba taşınmasın. Damgalar kalıyor —
 * sunucu damgaları başka bir kullanıcının satırlarıyla asla eşleşmez, aynı
 * kullanıcı geri dönerse de kendini tanımaya yarar.
 */
export async function aktarimYereliniTemizle(): Promise<void> {
  try {
    await AsyncStorage.removeItem(TAKILMA_ANAHTARI);
  } catch {
    // yoksay
  }
}
