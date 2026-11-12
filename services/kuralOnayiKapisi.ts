import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from '../utils/secureStorage';
import i18n from '../locales/index';
import { logWarning } from '../utils/errorLog';
import { useKuralOnayiStore } from '../store/kuralOnayiStore';
import { notify } from '../utils/confirmDialog';
import { ILETISIM_EPOSTA } from '../utils/constants';
import { ASKI_KUTUSU_ARALIGI_MS, askiMetinAnahtari, askiTarihiYaz, askiYanitiCoz, type AskiBilgisi } from '../utils/hesapAskisi';
import {
  KURALLAR_SURUMU,
  KURAL_ONAYI_ANAHTARI,
  KURAL_ONAYI_BEKLEYEN_ANAHTARI,
  onayGecerliMi,
  onaySurumuCoz,
  onayYazimKarari,
  type OnayYazimSonucu,
} from '../utils/kuralOnayi';

/**
 * TOPLULUK KURALLARI ONAYI — içerik yazma kapısı (YAYIN_ONCESI_PLAN Adım 4b, M609).
 *
 * İçerik yazan servisler (gönderi, not, inceleme, yorum, profil metni) ağa çıkmadan
 * ÖNCE `kuralOnayiSagla()` çağırır:
 *   1. Bu oturumda / bu cihazda onay biliniyorsa → hemen `true` (ağ yok).
 *   2. Giriş ekranındaki kutu bu sürüm için işaretlendiyse → sunucuya sessizce yazılır.
 *   3. Sunucuda onay kayıtlıysa (başka cihazda verilmiş) → cihaza yazılır, `true`.
 *   4. Hiçbiri değilse pencere açılır; kullanıcı kabul ederse sunucuya yazılır.
 *
 * 🔴 ZORLAMA BURADA: Worker'ın `KURAL_ONAYI_ZORUNLU` bayrağı eski APK'lar emekli olana
 * kadar kapalı (plan K8). O güne kadar «onaysız içerik yok» kuralını bu kapı uygular.
 * Kapı okuma ve gezinmeyi ENGELLEMEZ; yalnız içerik oluşturmayı.
 *
 * Cihaz kaydı çıkışta silinir (AsyncStorage izin listesinde değil); başka hesapla
 * girildiğinde onay o hesabın sunucu kaydından yeniden okunur.
 */

const WORKER = process.env.EXPO_PUBLIC_KAYMAK_WORKER_URL || '';
const SINIR_MS = 10_000;

/** Oturum içi: sunucu kaydı ya da «uç yok» (eski Worker) sonucu. Çıkışta `kuralOnayiniUnut`. */
let oturumdaOnayli = false;

export class KuralOnayiReddi extends Error {
  code = 'kural_onayi_reddedildi';
  constructor() {
    super(i18n.t('legal:rulesAcceptRequired', 'Paylaşmak için Topluluk Kuralları\'nı kabul etmen gerekiyor.'));
  }
}

async function token(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync('traktAccessToken');
  } catch {
    return null;
  }
}

async function istek(govde: object): Promise<{ durum?: number; veri?: any }> {
  const t = await token();
  if (!WORKER || !t) return {};
  try {
    const res = await axios.post(
      `${WORKER}/account/kurallar-onay`,
      { ...govde, traktAccessToken: t },
      { headers: { 'Content-Type': 'application/json' }, timeout: SINIR_MS },
    );
    return { durum: res.status, veri: res.data };
  } catch (error: any) {
    if (error?.response) return { durum: error.response.status, veri: error.response.data };
    return {};
  }
}

async function cihazaYaz(surum: number): Promise<void> {
  oturumdaOnayli = true;
  try {
    await AsyncStorage.multiSet([[KURAL_ONAYI_ANAHTARI, String(surum)]]);
    await AsyncStorage.removeItem(KURAL_ONAYI_BEKLEYEN_ANAHTARI);
  } catch {
    // Disk dolu vb.: oturum bayrağı yeter; sonraki açılışta sunucudan okunur.
  }
}

/** Onayı sunucuya yazar. Pencere ve giriş kutusu yolu ortak kullanır. */
export async function kuralOnayiniKaydet(): Promise<OnayYazimSonucu> {
  const { durum, veri } = await istek({ onayla: true, surum: KURALLAR_SURUMU });
  const sonuc = onayYazimKarari(durum, veri);
  if (sonuc === 'kaydedildi') await cihazaYaz(KURALLAR_SURUMU);
  else if (sonuc === 'uc_yok') {
    // Eski Worker: kullanıcı kabul etti ama kaydedilecek yer yok. Bu oturum için geçerli say.
    oturumdaOnayli = true;
    logWarning('kuralOnayi.ucYok', new Error('Worker /account/kurallar-onay ucunu tanımıyor'));
  } else if (sonuc === 'hata') {
    logWarning('kuralOnayi.kaydet', new Error(`durum=${durum ?? 'ağ'}`));
  }
  return sonuc;
}

/** Pencere açmadan: onay biliniyor mu (cihaz → giriş kutusu → sunucu). */
async function onayBiliniyorMu(): Promise<boolean> {
  if (oturumdaOnayli) return true;
  let cihaz: string | null = null;
  let bekleyen: string | null = null;
  try {
    [[, cihaz], [, bekleyen]] = await AsyncStorage.multiGet([KURAL_ONAYI_ANAHTARI, KURAL_ONAYI_BEKLEYEN_ANAHTARI]);
  } catch {
    // Okunamadı: sunucuya sor.
  }
  if (onayGecerliMi(onaySurumuCoz(cihaz))) {
    oturumdaOnayli = true;
    return true;
  }
  if (onayGecerliMi(onaySurumuCoz(bekleyen))) {
    const sonuc = await kuralOnayiniKaydet();
    if (sonuc === 'kaydedildi' || sonuc === 'uc_yok') return true;
  }
  const { durum, veri } = await istek({});
  if (durum === 200 && veri?.success === true && veri?.onayli === true) {
    await cihazaYaz(Number(veri.onaySurumu) || KURALLAR_SURUMU);
    return true;
  }
  return false;
}

/**
 * İçerik yazmadan önce çağrılır. `true` = devam et, `false` = kullanıcı kabul etmedi.
 * Oturum yoksa `true` döner: misafir zaten içerik yazamaz, asıl hatayı çağıranın kendi
 * oturum kontrolü üretir.
 */
export async function kuralOnayiSagla(): Promise<boolean> {
  if (!(await token())) return true;
  if (await onayBiliniyorMu()) return true;
  return useKuralOnayiStore.getState().iste();
}

/** Servisler için: kabul edilmezse `KuralOnayiReddi` fırlatır (mesajı kullanıcıya gösterilebilir). */
export async function kuralOnayiZorunlu(): Promise<void> {
  if (!(await kuralOnayiSagla())) throw new KuralOnayiReddi();
}

/**
 * Giriş ekranındaki «…Topluluk Kuralları… okudum, onaylıyorum» kutusu.
 * İşaretlenince bu sürüm cihaza not edilir; girişten sonraki ilk içerik yazımında sunucuya
 * yazılır ve pencere ayrıca çıkmaz. Kutu kaldırılırsa not silinir.
 */
export async function girisOnayiniIsaretle(isaretli: boolean): Promise<void> {
  try {
    if (isaretli) await AsyncStorage.setItem(KURAL_ONAYI_BEKLEYEN_ANAHTARI, String(KURALLAR_SURUMU));
    else await AsyncStorage.removeItem(KURAL_ONAYI_BEKLEYEN_ANAHTARI);
  } catch {
    // Not düşülemedi: pencere ilk içerik yazımında sorar.
  }
}

/** Çıkış / hesap değişimi: oturum bayrağı sıfırlanır (disk kaydını `cihazAnahtarlariniSil` siler). */
export function kuralOnayiniUnut(): void {
  oturumdaOnayli = false;
}

/**
 * Sunucu «onay yok» dedi (`403 kural_onayi_gerekli`): cihazdaki kayıt bayat. Yalnız Worker
 * bayrağı açıkken ve kurallar sunucuda yenilenmiş ya da kayıt silinmişken olur. Kayıt
 * silinmezse kapı «onaylı» sanmaya devam eder, pencere hiç açılmaz ve kullanıcı içerik
 * yazamadan takılır. Silinince bir sonraki denemede pencere çıkar.
 */
export async function sunucuOnayiReddetti(): Promise<void> {
  oturumdaOnayli = false;
  try {
    await AsyncStorage.multiRemove([KURAL_ONAYI_ANAHTARI, KURAL_ONAYI_BEKLEYEN_ANAHTARI]);
  } catch {
    // Silinemedi: oturum bayrağı düştü; disk kaydı bir sonraki açılışta yine reddedilir.
  }
}

// ── Hesap askısı (Adım 4e, M610) ──────────────────────────────────────────
// Kararı Worker verir (`403 hesap_askida`); burası yalnız kullanıcının dilinde açıklar.
// Servislerin kendi hata mesajı Worker'ın Türkçe `message` alanıdır; bu kutu tarihi yerel
// biçimde, metni seçili dilde gösterir. Art arda gelen kopyalar tek kutu açar.
let sonAskiKutusu = 0;

export function askiKutusunuGoster(bilgi: AskiBilgisi): void {
  const simdi = Date.now();
  if (simdi - sonAskiKutusu < ASKI_KUTUSU_ARALIGI_MS) return;
  sonAskiKutusu = simdi;
  const adres = bilgi.itiraz || ILETISIM_EPOSTA;
  const tarih = bilgi.bitis ? askiTarihiYaz(bilgi.bitis, i18n.language || 'tr') : '';
  void notify(i18n.t('legal:suspendedTitle'), i18n.t(askiMetinAnahtari(bilgi), { tarih, adres }));
}

// İçerik yazan beş servis de varsayılan axios örneğini kullanıyor; kodları tek yerde yakalamak,
// her servise ayrı dal eklemekten güvenli (yeni bir içerik ucu eklenince unutulamaz).
// Hata aynen yeniden fırlatılır: servislerin kendi hata yolları değişmez.
(axios as any)?.interceptors?.response?.use?.(undefined, (hata: any) => {
  const durum = hata?.response?.status;
  const govde = hata?.response?.data;
  if (durum === 403 && govde?.code === 'kural_onayi_gerekli') {
    void sunucuOnayiReddetti();
  }
  const aski = askiYanitiCoz(durum, govde);
  if (aski) askiKutusunuGoster(aski);
  return Promise.reject(hata);
});
