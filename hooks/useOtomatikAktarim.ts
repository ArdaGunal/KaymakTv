import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '../context/AuthContext';
import { farkTuruZamani } from '../services/api/traktImportCekirdek';
import { aktarimMotoru, aktarimYereliniTemizle } from '../services/import/aktarimBaglanti';
import { useAktarimStore } from '../store/aktarimStore';
import { logError } from '../utils/errorLog';
import { useTraktImport } from './useTraktImport';

/**
 * 🔄 OTOMATİK TRAKT AKTARIMI (§C33) — `useOtomatikFarkTuru`'nun yerini aldı.
 *
 * ==========================================================================
 * NEDEN (27 Eylül, DalekCan)
 * ==========================================================================
 * T6.3'ten beri kütüphane YALNIZCA bizden okunuyor. Aktarım Ayarlar'daki bir
 * "Evet"e bağlıydı; o soruyu görmemiş bir Trakt kullanıcısı İKİ HAFTA boyunca
 * her açılışta "kütüphanen boş" gördü. Ürün kararı (kullanıcı, 2026-09-28):
 * *"Kullanıcı uygulamaya girdiğinde her şey tamamen otomatik ve arka planda
 * gerçekleşmeli."* Daha önce "Hayır" demiş olanlar DAHİL.
 *
 * ==========================================================================
 * AKIŞ
 * ==========================================================================
 * 1. Trakt oturumu hazır → motor `/import/durum`'a sorar (tamamlanmışta TEK istek).
 * 2. Eksik varsa motor sürer (bant + canlı tazeleme `aktarimMotoru.ts`'te).
 * 3. İlk aktarım tamamsa: eski 6 saatlik SESSİZ fark turu (§D15) — Trakt'ın
 *    sitesinden sonradan eklenenleri getirir. Aktarım bu oturumda YENİ
 *    bittiyse fark turu koşmaz (az önce tam liste çekildi), damgası atılır.
 * 4. `ertelendi` (kalıcı hata / oturumda 6 geçici düşüş): uygulama ön plana
 *    her döndüğünde yeniden denenir — kullanıcı hiçbir şeye basmaz.
 */
const SON_FARK_ANAHTARI = 'kaymak_trakt_fark_son_v1';

export function useOtomatikAktarim() {
  const { authProvider, isGuest, accessToken, isLoading } = useAuth();
  const uygun = authProvider === 'trakt' && !isGuest && !!accessToken && !isLoading;

  const { farkTuru } = useTraktImport();
  // Ref: `farkTuru`nun kimliği değiştikçe efekt yeniden koşup motoru bir kez
  // daha sorgulamasın.
  const farkRef = useRef(farkTuru);
  farkRef.current = farkTuru;

  const oncekiUygunRef = useRef(false);

  useEffect(() => {
    const m = aktarimMotoru();

    if (!uygun) {
      // 🔴 YALNIZCA GERÇEK ÇIKIŞTA (true → false). Soğuk açılışta oturum
      // yüklenirken de `uygun` false; orada temizleseydik takılma sayacı her
      // açılışta sıfırlanır ve "3 oturum üst üste" sinyali HİÇ ateşlenmezdi.
      if (oncekiUygunRef.current) {
        m.durdur();
        void aktarimYereliniTemizle();
      }
      oncekiUygunRef.current = false;
      return;
    }
    oncekiUygunRef.current = true;

    let iptal = false;
    (async () => {
      const faz = await m.baslat();
      if (iptal) return;
      if (faz === 'bitti') {
        await AsyncStorage.setItem(SON_FARK_ANAHTARI, String(Date.now()));
        return;
      }
      if (faz !== 'tamam') return;

      const ham = await AsyncStorage.getItem(SON_FARK_ANAHTARI);
      const son = ham === null ? null : Number(ham);
      if (!farkTuruZamani(son) || iptal) return;
      await farkRef.current();
      // Damga tur BİTİNCE: yarıda kalan tur "koştu" sayılsaydı eksik veri
      // altı saat daha beklerdi.
      await AsyncStorage.setItem(SON_FARK_ANAHTARI, String(Date.now()));
    })().catch((e) => logError('useOtomatikAktarim', e));

    return () => {
      iptal = true;
    };
  }, [uygun]);

  // Ertelenmiş aktarım: kullanıcı uygulamaya her döndüğünde sessizce yeniden dene.
  useEffect(() => {
    if (!uygun) return;
    const abonelik = AppState.addEventListener('change', (s) => {
      if (s === 'active' && useAktarimStore.getState().faz === 'ertelendi') {
        void aktarimMotoru().baslat();
      }
    });
    return () => abonelik.remove();
  }, [uygun]);
}
