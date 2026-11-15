import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMyProfile } from './useMyProfile';
import { useUpdateProfile } from './useUpdateProfile';
import { useKullaniciAdiOnerisi } from './useKullaniciAdiOnerisi';
import { gorunenAdDenetle, gorunenAdGirdisi } from '../utils/gorunenAd';
import { kullaniciAdiSorunu } from '../features/feed/services/profile';

/**
 * İSİM EKRANI mantığı (`app/(public)/profil-olustur.tsx`) — 1.0.1 Dal 1, karar K4 (2026-11-15).
 *
 * - Ana alan GÖRÜNEN AD ve ZORUNLU: boş / kurala aykırıyken «Devam» kapalı. Sunucuda
 *   görünen ad varsa (Trakt'tan bir kez kopyalanan ya da Google hesabı açılışında yazılan)
 *   önceden dolu gelir; kişi yalnız «Devam» der.
 * - Altta `@kullanıcı_adı` önizlenir: görünen addan sunucunun önerdiği BOŞTAKİ ad
 *   (300 ms bekleyerek; `useKullaniciAdiOnerisi`). Kişi «Değiştir» der ve elle yazarsa öneri
 *   artık ÜZERİNE YAZMAZ. Öneri yalnız GÜNCEL girdi + oturuma aitse kullanılır; alınamazsa
 *   hesabın bugünkü adı gösterilir (bayat öneri asla — denetim bulgusu 4).
 * - Kayıt TEK istek: görünen ad + (değiştiyse) kullanıcı adı + fotoğraf kaldırma + onay.
 *   Worker bunları tek PATCH'te yazar; `taken` dönerse hiçbir alan yazılmamıştır ve
 *   elle düzenlenmemişse yeni öneri istenir.
 * - Kural dışı eski kullanıcı adı (`Test Kullanıcısı`) öneriyle ya da elle düzeltilmeden geçilemez.
 */
export function useIsimEkrani() {
  const { myUsername, myAvatarUrl } = useAuth();
  const { profile } = useMyProfile();
  const { save, isSaving, error, clearError } = useUpdateProfile();

  // Sunucudaki değerler esas (Trakt hesabında yerel kopya yok); gelene kadar yerel kopya.
  const sunucuAdi = (profile?.username ?? myUsername ?? '').trim();
  const sunucuGorunenAd = profile?.displayName ?? '';

  const [gorunenAd, setGorunenAd] = useState(sunucuGorunenAd);
  const [adaDokunuldu, setAdaDokunuldu] = useState(false);
  useEffect(() => {
    if (!adaDokunuldu && sunucuGorunenAd) setGorunenAd(sunucuGorunenAd);
  }, [sunucuGorunenAd, adaDokunuldu]);

  const [gorunmezAyiklandi, setGorunmezAyiklandi] = useState(false);
  const [elleKullaniciAdi, setElleKullaniciAdi] = useState<string | null>(null);
  const [avatarKaldirildi, setAvatarKaldirildi] = useState(false);

  const adKarari = gorunenAdDenetle(gorunenAd);
  const oneri = useKullaniciAdiOnerisi(adKarari.tur === 'yaz' && elleKullaniciAdi === null ? adKarari.deger : null);
  const kullaniciAdi = elleKullaniciAdi !== null ? elleKullaniciAdi.trim() : (oneri.ad ?? sunucuAdi);

  const adSorunu = adKarari.tur === 'yaz' || adKarari.tur === 'temizle' ? null : adKarari.tur;
  const kullaniciAdiKuralSorunu = kullaniciAdi.length > 0 ? kullaniciAdiSorunu(kullaniciAdi) : 'kisa';
  const oneriBekleniyor = elleKullaniciAdi === null && oneri.yukleniyor;
  const devamKapali = adKarari.tur !== 'yaz' || kullaniciAdiKuralSorunu !== null || oneriBekleniyor || isSaving;

  const gorunenAdDegisti = (v: string) => {
    const girdi = gorunenAdGirdisi(v);
    setAdaDokunuldu(true);
    setGorunenAd(girdi.deger);
    setGorunmezAyiklandi(girdi.ayiklandi);
    clearError();
  };
  const kullaniciAdiDuzenle = () => setElleKullaniciAdi(kullaniciAdi);
  const kullaniciAdiDegisti = (v: string) => {
    setElleKullaniciAdi(v);
    // Önceki denemenin uyarısı («alınmış») yeni adda kalmasın (cihazda görüldü, M492).
    clearError();
  };

  /** `true` = kaydedildi; ekran uygulamaya geçer. */
  const devam = async (): Promise<boolean> => {
    if (devamKapali || adKarari.tur !== 'yaz') return false;
    const ok = await save({
      displayName: adKarari.deger,
      username: kullaniciAdi !== sunucuAdi ? kullaniciAdi : undefined,
      avatarUrl: avatarKaldirildi ? null : undefined,
      adOnayla: true,
    });
    // Kayıt düştüyse (çoğunlukla `taken`: öneriyle kayıt arasında başkası aldı) ve ad
    // elle yazılmadıysa yeni öneri iste — kişi yeniden «Devam» demekle kalsın.
    if (!ok && elleKullaniciAdi === null) oneri.yenile();
    return ok;
  };

  return {
    gorunenAd, adKarari, adSorunu, gorunenAdDegisti, gorunmezAyiklandi,
    kullaniciAdi, kullaniciAdiGirdisi: elleKullaniciAdi ?? '', kullaniciAdiKuralSorunu,
    elleDuzenleniyor: elleKullaniciAdi !== null,
    oneriBekleniyor, kullaniciAdiDuzenle, kullaniciAdiDegisti,
    avatarUrl: myAvatarUrl && !avatarKaldirildi ? myAvatarUrl : null,
    avatariKaldir: () => setAvatarKaldirildi(true),
    devam, devamKapali, isSaving, error,
  };
}
