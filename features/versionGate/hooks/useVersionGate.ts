import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Application from 'expo-application';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppSettingsStore } from '../../../store/appSettingsStore';
import { STORE_URL } from '../../../utils/constants';
import { recordPerfMark } from '../../../utils/perfLog';
import { logWarning } from '../../../utils/errorLog';
import { SURUM_ONBELLEK_ANAHTARI, onbellegiCoz, oturumIciKarar, surumKarari, type SurumKarari } from '../services/surumKarari';

export type VersionGateStatus = 'checking' | 'ok' | 'blocked';

export interface VersionGateResult {
  status: VersionGateStatus;
  /** Yalnızca `status === 'blocked'` iken dolu. */
  updateUrl: string | null;
}

/**
 * "Zorunlu Güncelleme" kontrolü — `app/_layout.tsx`'te `AuthProvider`'ın
 * DIŞINDA (üstünde) çağrılır. Web her zaman `'ok'` (en güncel sürüm sunulur).
 *
 * M458 · AĞI BEKLEMEZ. Eskiden `app_settings` gelene kadar (1–5 sn, Singapur
 * bölgesi) boş ekran gösteriliyordu. Şimdi:
 *  1. Cihazdaki son sonuç okunur (ms'ler). Bu sürüm orada ENGELLİ ise anında
 *     `blocked` — eski sürüm tek bir Trakt/Auth isteği bile atmaz.
 *  2. Değilse anında `ok`; sunucu kontrolü ARKA PLANDA sürer, sonucu saklanır.
 *     Sunucu asgari sürümü yükselttiyse kapı OTURUM İÇİNDE KAPANMAZ (2.6.5
 *     madde 8: kullanan kişide ağaç engel ekranına dönüp kasıyordu) — üstte
 *     güncelleme bandı çıkar (`useSoftUpdate`), engel bir sonraki soğuk
 *     açılışta 1. adımla gelir (`oturumIciKarar`).
 *  3. Sunucu sınırı düşürdüyse saklanan engel de kalkar.
 *
 * FAIL-OPEN: ağ/RLS/satır hatası kullanıcıyı ASLA kilitlemez; bu kontrol
 * "varsa ekstra güvenlik"tir. Bir Supabase kesintisi tüm kullanıcıları dışarıda
 * bırakmamalı.
 */
export function useVersionGate(): VersionGateResult {
  const [status, setStatus] = useState<VersionGateStatus>(Platform.OS === 'web' ? 'ok' : 'checking');
  const [updateUrl, setUpdateUrl] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let cancelled = false;
    // Cihazda GERÇEKTEN kurulu native sürüm (Constants.expoConfig değil).
    const kurulu = Application.nativeApplicationVersion;
    let mevcut: SurumKarari = { durum: 'ok' };
    const uygula = (karar: SurumKarari) => {
      if (cancelled) return;
      mevcut = karar;
      setUpdateUrl(karar.durum === 'blocked' ? karar.updateUrl || STORE_URL : null);
      setStatus(karar.durum);
    };

    (async () => {
      let kayit = null;
      try {
        kayit = onbellegiCoz(await AsyncStorage.getItem(SURUM_ONBELLEK_ANAHTARI));
      } catch {
        // Okunamayan önbellek = önbellek yok (fail-open).
      }
      uygula(surumKarari(kurulu, kayit));

      const startedAt = Date.now();
      try {
        const settings = await useAppSettingsStore.getState().fetchSettings();
        if (!settings) return; // erişilemedi → mevcut karar kalır
        const yeni = { minRequiredVersion: settings.minRequiredVersion, updateUrl: settings.updateUrl };
        AsyncStorage.setItem(SURUM_ONBELLEK_ANAHTARI, JSON.stringify(yeni)).catch(() => {});
        uygula(oturumIciKarar(mevcut, surumKarari(kurulu, yeni)));
      } catch (error) {
        console.error('Sürüm kontrolü hatası (fail-open, uygulama engellenmiyor):', error);
        logWarning('versionGate.check', error);
      } finally {
        // Artık açılışı bloklamıyor; panelde yalnız arka plan süresi olarak görünür.
        recordPerfMark('Sürüm Kontrolü (arka plan)', 'startup', Date.now() - startedAt);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { status, updateUrl };
}
