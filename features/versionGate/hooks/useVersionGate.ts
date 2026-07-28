import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Application from 'expo-application';
import { getAppSettings } from '../services/appSettingsApi';
import { isVersionBelow } from '../../../utils/semver';

export type VersionGateStatus = 'checking' | 'ok' | 'blocked';

export interface VersionGateResult {
  status: VersionGateStatus;
  /** Yalnızca `status === 'blocked'` iken dolu. */
  updateUrl: string | null;
}

const FALLBACK_UPDATE_URL = 'https://kaymaktv.com';

/**
 * "Zorunlu Güncelleme" kontrolü — uygulama açılışında, Trakt/Auth
 * işlemlerinden TAMAMEN BAĞIMSIZ ve onlardan ÖNCE çalışması için
 * `app/_layout.tsx`'te `AuthProvider`'ın DIŞINDA (üstünde) çağrılır.
 *
 * Yalnızca NATİF (Android/iOS) tarafında çalışır — web derlemesi her zaman
 * ardından yayınlanan en güncel sürümü sunduğundan bu kontrolden bilinçli
 * olarak muaftır ve `status` anında `'ok'` olarak sabitlenir (hiçbir ağ
 * isteği atılmaz).
 *
 * FAIL-OPEN prensibi: Supabase'e erişilemiyorsa (ağ hatası, satır eksik, RLS
 * yanlış yapılandırılmış vb.) kullanıcı ASLA kilitlenmez — bu kontrol
 * "varsa ekstra güvenlik"tir, uygulamanın çekirdek işlevi değil. Bir Supabase
 * kesintisi yüzünden TÜM kullanıcı tabanını uygulama dışında bırakmak,
 * önlemeye çalıştığı sorundan kat kat daha büyük bir sorun yaratırdı.
 */
export function useVersionGate(): VersionGateResult {
  const [status, setStatus] = useState<VersionGateStatus>(Platform.OS === 'web' ? 'ok' : 'checking');
  const [updateUrl, setUpdateUrl] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    let cancelled = false;

    (async () => {
      try {
        // Cihazda GERÇEKTEN kurulu olan native sürüm — `Constants.expoConfig`
        // derleme zamanındaki config'i yansıtır, kurulu APK'nın kendisini değil.
        const currentVersion = Application.nativeApplicationVersion;
        if (!currentVersion) {
          if (!cancelled) setStatus('ok');
          return;
        }

        const settings = await getAppSettings();
        if (cancelled) return;

        if (!settings) {
          setStatus('ok');
          return;
        }

        if (isVersionBelow(currentVersion, settings.minRequiredVersion)) {
          setUpdateUrl(settings.updateUrl || FALLBACK_UPDATE_URL);
          setStatus('blocked');
        } else {
          setStatus('ok');
        }
      } catch (error) {
        console.error('Sürüm kontrolü hatası (fail-open, uygulama engellenmiyor):', error);
        if (!cancelled) setStatus('ok');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { status, updateUrl };
}
