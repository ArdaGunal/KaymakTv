import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { cihazKoduBaslat, cihazKodunuYokla, CihazHatasi } from '../services/api/traktCihaz';
import type { TraktGirisi } from '../services/api/traktKasa';
import {
  cihazOturumunuKaydet, cihazOturumunuOku, cihazOturumunuSil, oturumOlustur, sonrakiYoklamaGecikmesi,
  geriCekilmeMs, hataSinifi, YAVASLA_EK_MS, type BekleyenCihazOturumu, type CihazModu,
} from '../services/auth/traktCihazOturumu';
import { traktBaglamaNiyetiTuket } from '../services/auth/baglamaNiyeti';

/**
 * Trakt cihaz kodu girişi — durum makinesi + yoklama motoru (`docs/design/TRAKT_CIHAZ_KODU_PLANI.md` §3.3).
 *
 *   bos → kod_aliniyor → bekliyor ⇄ (cevrimdisi) → tamamlaniyor → (ekran gider)
 *                                  ↘ suresi_doldu | reddedildi | yeni_kod | kod_alinamadi
 *
 * Kurallar:
 *  - Tek seferde TEK istek; vazgeç / yeni kod / ekran kapanışından sonra gelen yanıt yok sayılır (nesil).
 *  - İki yoklama arası ≥ Trakt aralığı (ölçüldü: 1–2 sn arayla ikinci istek 429). 429 → aralık +5 sn.
 *  - Yalnız uygulama öndeyken yoklar; öne gelince aralık dolduysa HEMEN yoklar (kişi Trakt'tan döndü).
 *  - Geçici hata (ağ, 5xx) durumu silmez; artan bekleme, «bağlantı bekleniyor».
 *  - Bekleyen oturum diskte: ekran yeniden açılınca (süreç ölümü dahil) kaldığı yerden sürer.
 */
export type CihazDurumu =
  | { tur: 'bos' }
  | { tur: 'kod_aliniyor' }
  | { tur: 'bekliyor'; oturum: BekleyenCihazOturumu; cevrimdisi: boolean }
  | { tur: 'tamamlaniyor' }
  | { tur: 'suresi_doldu' | 'reddedildi' | 'yeni_kod' | 'kod_alinamadi'; mod: CihazModu };

/** `onGiris` fırlatırsa (oturum açılamadı) ekran `kod_alinamadi`na düşer, kişi yeni kod alır. */
type Secenekler = { onGiris: (giris: TraktGirisi, mod: CihazModu) => Promise<void>; onHata?: (kod: string) => void };

export function useTraktCihazGirisi({ onGiris, onHata }: Secenekler) {
  const [durum, setDurum] = useState<CihazDurumu>({ tur: 'bos' });
  const oturumRef = useRef<BekleyenCihazOturumu | null>(null);
  const nesilRef = useRef(0);
  const zamanlayiciRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Uçuştaki isteğin nesli (yoksa null). Eski nesilden kalan istek yeni oturumun yoklamasını ENGELLEMEZ.
  const yoklaniyorRef = useRef<number | null>(null);
  const sonYoklamaRef = useRef<number | null>(null);
  const ardisikHataRef = useRef(0);
  const onGirisRef = useRef(onGiris);
  const onHataRef = useRef(onHata);
  onGirisRef.current = onGiris;
  onHataRef.current = onHata;

  const zamanlayiciyiDurdur = () => {
    if (zamanlayiciRef.current) clearTimeout(zamanlayiciRef.current);
    zamanlayiciRef.current = null;
  };

  const bitir = useCallback(async (sonraki: CihazDurumu) => {
    nesilRef.current += 1;
    zamanlayiciyiDurdur();
    oturumRef.current = null;
    await cihazOturumunuSil();
    setDurum(sonraki);
  }, []);

  const planla = useCallback((ms: number) => {
    zamanlayiciyiDurdur();
    const nesil = nesilRef.current;
    zamanlayiciRef.current = setTimeout(() => {
      if (nesil === nesilRef.current) void yoklaRef.current();
    }, ms);
  }, []);

  const yokla = useCallback(async () => {
    const oturum = oturumRef.current;
    if (!oturum || yoklaniyorRef.current === nesilRef.current) return;
    if (AppState.currentState !== 'active') return; // öne gelince `change` dinleyicisi yoklar
    if (Date.now() >= oturum.bitisMs) {
      await bitir({ tur: 'suresi_doldu', mod: oturum.mod });
      return;
    }
    const nesil = nesilRef.current;
    yoklaniyorRef.current = nesil;
    sonYoklamaRef.current = Date.now();
    try {
      const sonuc = await cihazKodunuYokla(oturum.deviceCode);
      if (nesil !== nesilRef.current) return;
      ardisikHataRef.current = 0;
      if (sonuc.durum === 'tamam') {
        nesilRef.current += 1;
        zamanlayiciyiDurdur();
        oturumRef.current = null;
        await cihazOturumunuSil();
        setDurum({ tur: 'tamamlaniyor' });
        try {
          await onGirisRef.current(sonuc.giris, oturum.mod);
          // Oturum açıldıysa ekran zaten gitti; uyuşmazlık / bağlama sonrası ekran kalıyorsa kod görünümü kapanır.
          setDurum({ tur: 'bos' });
        } catch (e: any) {
          onHataRef.current?.(e?.kod || 'sunucu');
          setDurum({ tur: 'kod_alinamadi', mod: oturum.mod });
        }
        return;
      }
      if (sonuc.durum === 'yavasla') {
        const yeni = { ...oturum, aralikMs: oturum.aralikMs + YAVASLA_EK_MS };
        oturumRef.current = yeni;
        void cihazOturumunuKaydet(yeni);
      }
      setDurum({ tur: 'bekliyor', oturum: oturumRef.current!, cevrimdisi: false });
      planla(oturumRef.current!.aralikMs);
    } catch (e) {
      if (nesil !== nesilRef.current) return;
      const kod = e instanceof CihazHatasi ? e.kod : 'ag';
      const sinif = hataSinifi(kod);
      if (sinif === 'gecici') {
        ardisikHataRef.current += 1;
        setDurum({ tur: 'bekliyor', oturum, cevrimdisi: kod === 'ag' });
        planla(geriCekilmeMs(ardisikHataRef.current, oturum.aralikMs));
      } else {
        await bitir({ tur: sinif, mod: oturum.mod });
      }
    } finally {
      if (yoklaniyorRef.current === nesil) yoklaniyorRef.current = null;
    }
  }, [bitir, planla]);
  const yoklaRef = useRef(yokla);
  yoklaRef.current = yokla;

  const surdur = useCallback((o: BekleyenCihazOturumu) => {
    oturumRef.current = o;
    ardisikHataRef.current = 0;
    setDurum({ tur: 'bekliyor', oturum: o, cevrimdisi: false });
    planla(sonrakiYoklamaGecikmesi(sonYoklamaRef.current, o.aralikMs, Date.now()));
  }, [planla]);

  /** Kod alır. «Trakt'ı bağla» niyeti varsa ŞİMDİ tüketilir ve moda yazılır. */
  const baslat = useCallback(async (istenen: CihazModu) => {
    if (durum.tur === 'kod_aliniyor' || durum.tur === 'tamamlaniyor') return; // çift dokunuş
    nesilRef.current += 1;
    zamanlayiciyiDurdur();
    const nesil = nesilRef.current;
    setDurum({ tur: 'kod_aliniyor' });
    // Yeni kodda bağlama modu korunur (niyet ilk kodda tüketildi); değilse niyet şimdi okunur.
    const mod: CihazModu = istenen === 'baglama' || (await traktBaglamaNiyetiTuket()) ? 'baglama' : istenen;
    try {
      const kod = await cihazKoduBaslat();
      if (nesil !== nesilRef.current) return;
      const o = oturumOlustur(kod, mod, Date.now());
      await cihazOturumunuKaydet(o);
      sonYoklamaRef.current = Date.now(); // ilk yoklama bir aralık sonra (kişi henüz onaylamadı)
      surdur(o);
    } catch (e) {
      if (nesil !== nesilRef.current) return;
      onHataRef.current?.(e instanceof CihazHatasi ? e.kod : 'ag');
      setDurum({ tur: 'kod_alinamadi', mod });
    }
  }, [durum.tur, surdur]);

  /** Bitmiş / düşmüş bir oturumdan sonra aynı modla yeni kod. */
  const yeniKod = useCallback(() => baslat('mod' in durum ? durum.mod : 'giris'), [durum, baslat]);

  const vazgec = useCallback(() => bitir({ tur: 'bos' }), [bitir]);

  /** Kodu panoya kopyalar ve Trakt onay sayfasını sıradan tarayıcıda açar (auth oturumu DEĞİL). */
  const trakttaOnayla = useCallback(async (): Promise<boolean> => {
    const o = oturumRef.current;
    if (!o) return false;
    let kopyalandi = false;
    try {
      await Clipboard.setStringAsync(o.userCode);
      kopyalandi = true;
    } catch {
      // pano yoksa adres zaten kodu taşıyor
    }
    try {
      await Linking.openURL(o.dogrulamaAdresi);
    } catch {
      onHataRef.current?.('tarayici');
    }
    return kopyalandi;
  }, []);

  // Açılış: bekleyen oturum varsa kaldığı yerden.
  useEffect(() => {
    let iptal = false;
    cihazOturumunuOku().then((o) => {
      if (!iptal && o && !oturumRef.current) surdur(o);
    });
    return () => {
      iptal = true;
      nesilRef.current += 1;
      zamanlayiciyiDurdur();
    };
  }, [surdur]);

  // Öne gelince hemen (aralık dolduysa) yokla; arka planda bekleyen zamanlayıcıyı durdur.
  useEffect(() => {
    const abone = AppState.addEventListener('change', (s) => {
      if (!oturumRef.current) return;
      if (s === 'active') planla(sonrakiYoklamaGecikmesi(sonYoklamaRef.current, oturumRef.current.aralikMs, Date.now()));
      else zamanlayiciyiDurdur();
    });
    return () => abone.remove();
  }, [planla]);

  return { durum, baslat, yeniKod, vazgec, trakttaOnayla };
}
