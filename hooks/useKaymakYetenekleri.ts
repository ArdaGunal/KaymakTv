import { useMemo } from 'react';

import { useAuth } from '../context/AuthContext';

/**
 * ==========================================================================
 * KAYMAK HESABININ NELERİ YAPABİLDİĞİ — TEK KARAR YERİ  (Faz T)
 * ==========================================================================
 * Faz T, Trakt'tan bağımsızlığı DİLİM DİLİM getiriyor: T1 izleme çekirdeği,
 * T2 ilerleme, T5 içe aktarım… Her dilimde Google-only (Kaymak) hesabın
 * yapabildikleri artıyor. O ara dönemde "bu kullanıcı bunu yapabilir mi?"
 * sorusu ONLARCA bileşene dağılırsa, bir dilim bittiğinde açılması gereken
 * kapılardan biri mutlaka unutulur — ve unutulduğu ANLAŞILMAZ, çünkü
 * eksik kapı sessizce "özellik yok" gibi görünür.
 *
 * 🔴 O YÜZDEN BURASI TEK KARAR YERİ. Bir dilim bittiğinde tek bir bayrağı
 * `true` yapmak yeter; bileşenler değişmez.
 *
 * ==========================================================================
 * ⚠️ NEDEN `authProvider`, NEDEN `kaymakKullanicisiMi()` DEĞİL
 * ==========================================================================
 * `services/api/library.ts`'teki `kaymakKullanicisiMi()` token ÖNEKİNE bakar
 * ve **async**'tir (SecureStore okur). Render sırasında kullanılamaz: ilk
 * karede cevap gelmemiş olur, buton bir an görünüp KAYBOLURDU.
 *
 * `authProvider` aynı gerçeği senkron taşır — Google girişi `AuthContext`'te
 * `'google'` yazarken aynı anda Kaymak oturum token'ını da saklıyor
 * (`context/AuthContext.tsx`, `signInWithGoogle`). İkisi TASARIM GEREĞİ
 * birlikte set edilir.
 *
 * 🔴 Bu ikisi bir gün ayrışırsa hangisinin kazanacağı önemlidir: SERVİS
 * katmanı (yazma) `kaymakKullanicisiMi()`'yi, UI (görünürlük) burayı
 * kullanır. Yani en kötü durumda kullanıcı görünen ama çalışmayan bir buton
 * görür — `collections.ts`'teki `listeKapisi` savunma hattı tam bunun için
 * var ve ham 401 yerine anlaşılır bir hata fırlatır.
 */
export type KaymakYetenekleri = {
  /** Faz T yolundaki (Google-only) bir hesap mı? */
  kaymakHesabi: boolean;
  /**
   * Özel listeler (oluştur / listeye ekle / listeyi sil).
   *
   * ❌ KAPALI — Worker'da liste ailesi, veritabanında `user_lists` tablosu
   * YOK. T1'in kapsamına sıkıştırmamak için bilinçli ertelendi (kullanıcı
   * kararı, 2026-09-07); iş `docs/BACKLOG.md` §T2'de.
   *
   * ⚠️ FAVORİLER BUNA DAHİL DEĞİL. Trakt'ta favori gizli bir özel listedir,
   * bizde ayrı bir tablo (`user_favorites`) — o ÇALIŞIYOR. İkisini
   * karıştırmak, çalışan bir özelliği yanlışlıkla gizlemek olurdu.
   */
  ozelListeler: boolean;
  /**
   * Kütüphane ekranları (Diziler / Filmler sekmeleri).
   *
   * ✅ AÇIK (2026-09-07, Madde 318). Kapalıydı çünkü o ekranlar kişisel
   * senkron verisi istiyor ve Kaymak hesabında OKUMA YOLU YOKTU — açmak
   * boş bir ekran göstermek olurdu (Madde 221'in gerekçesi).
   *
   * Artık var: `POST /library/sync` izleme satırlarını döndürüyor ve
   * ilerlemeyi katalogdan hesaplıyor (`kaymakSync.ts`).
   *
   * 🔴 KAPIYI GERİ KAPATMAK İSTERSEN buradan kapat, ekranlara `authProvider`
   * kontrolü GERİ KOYMA — dağıtılmış kapı tam olarak bu turda düzeltilen
   * sorundu (dört ekranda dört kopya, biri güncellenirse diğerleri bayat).
   */
  kutuphane: boolean;
};

export const useKaymakYetenekleri = (): KaymakYetenekleri => {
  const { authProvider } = useAuth();

  return useMemo(() => {
    const kaymakHesabi = authProvider === 'google';
    return {
      kaymakHesabi,
      ozelListeler: !kaymakHesabi,
      kutuphane: true,
    };
  }, [authProvider]);
};
