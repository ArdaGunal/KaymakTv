import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { farkTuruZamani } from '../services/api/traktImportCekirdek';
import { logError } from '../utils/errorLog';
import { useTraktImport } from './useTraktImport';

/**
 * 🔄 SESSİZ FARK TURU (Faz T · §D15)
 *
 * SORUN (kullanıcı, 2026-09-12): aktarım TEK SEFERLİKTİ. Uygulamada yapılan
 * işaretleme iki yere birden yazılıyor (bize + Trakt'a), ama kullanıcı
 * **Trakt'ın kendi sitesinden** bir dizi/film/liste/favori/puan eklerse bu
 * bize bir daha HİÇ ulaşmıyordu — aktarım bölümü bitince kayboluyor ve döngü
 * bir daha çalışmıyordu.
 *
 * 🔑 ÇÖZÜM NEDEN UCUZ: on bir ailenin ucu TAM LİSTE döndürüyor ve
 * yazmalarımız idempotent → *"yeniden koş"* zaten fark senkronudur. Ölçülen
 * hacim ~50 satır = 11 istek (M355).
 *
 * ⛔ `gecmis` KAPSAM DIŞI (7.349 satır) ve bu tur hiçbir satır SİLMEZ.
 * Geçmişin farkı + Trakt'tan silinenler **K3 kapanış turunda**, T6 geçişinin
 * hemen öncesinde (kullanıcı kararı 2026-09-12: *"Final Kapanış/Fark Turu"*).
 *
 * ──────────────────────────────────────────────────────────────────────────
 * ÜÇ KORUMA
 * ──────────────────────────────────────────────────────────────────────────
 * 1. **Yalnızca ONAY VERMİŞ kullanıcı.** Onay cihazda (`ONAY_ANAHTARI`);
 *    "hayır" diyen ya da hiç sorulmamış kullanıcıya arka planda istek atmak
 *    M349'un onay akışını arkadan dolanmak olurdu.
 * 2. **Altı saatte bir** (`farkTuruZamani`). Kullanıcı uygulamayı günde on kez
 *    açabilir; her açılışta 11 istek Trakt kotasını ve mobil veriyi yerdi.
 * 3. **Oturumda bir kez** (`kosuldiRef`). `_layout` yeniden render olursa
 *    ikinci tur açılmasın; `useTraktImport` zaten `calisiyorRef` ile korunuyor
 *    ama buraya kadar gelip AsyncStorage okumak da gereksiz.
 *
 * 🔴 SESSİZ: `durum`/`hata` state'ini oynatmıyor. Kullanıcı bir şey
 * istemediği hâlde ekranında ilerleme çubuğu belirip kaybolmamalı. Hata olursa
 * `logError`'a düşer; bir sonraki açılışta yeniden denenir.
 */
const ONAY_ANAHTARI = 'kaymak_trakt_import_onay_v1';
const SON_FARK_ANAHTARI = 'kaymak_trakt_fark_son_v1';

export function useOtomatikFarkTuru() {
  const { uygun, farkTuru } = useTraktImport();
  const kosulduRef = useRef(false);

  useEffect(() => {
    if (!uygun || kosulduRef.current) return;
    kosulduRef.current = true;

    let iptal = false;

    (async () => {
      try {
        const onay = await AsyncStorage.getItem(ONAY_ANAHTARI);
        // 'evet' = aktarım sürüyor · 'bitti' = tamamlandı. İkisi de ONAYDIR.
        if (onay !== 'evet' && onay !== 'bitti') return;

        const ham = await AsyncStorage.getItem(SON_FARK_ANAHTARI);
        const son = ham === null ? null : Number(ham);
        if (!farkTuruZamani(son)) return;

        if (iptal) return;
        await farkTuru();
        // 🔑 Damga tur BİTİNCE yazılıyor: yarıda kalan bir tur (uygulama
        // kapandı) "koştu" sayılsaydı eksik veri altı saat daha beklerdi.
        await AsyncStorage.setItem(SON_FARK_ANAHTARI, String(Date.now()));
      } catch (e) {
        logError('useOtomatikFarkTuru', e);
      }
    })();

    return () => {
      iptal = true;
    };
  }, [uygun, farkTuru]);
}
