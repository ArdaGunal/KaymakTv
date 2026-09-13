import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import { ImportHatasi, traktImportAdimi } from '../services/api/traktImport';
import {
  AKTARIM_SIRASI,
  ARDISIK_HATA_TAVANI,
  FARK_AILELERI,
  KAPANIS_AILELERI,
  supurmeOzeti,
  aileIlerlemesi,
  ImportAdimSonucu,
  ImportAilesi,
  ImportHataBilgisi,
  ilerlemeYuzdesi,
  sonrakiBeklemeMs,
  tumunuDurdurur,
  yenidenDenenebilir,
} from '../services/api/traktImportCekirdek';
import { logError } from '../utils/errorLog';

export type ImportDurumu = 'bos' | 'suruyor' | 'duraklatildi' | 'bitti' | 'hata';

/**
 * TRAKT AKTARIM YÜRÜTÜCÜSÜ (Faz T · T5.4).
 *
 * Worker'ın `/import/trakt` ucunu bitene kadar ADIM ADIM çağırır. Kaldığı yer
 * sunucuda tutulduğu için (`user_import_state`) bu hook durum SAKLAMAZ; her
 * adımın yanıtı güncel gerçeği taşır.
 *
 * 🔑 ON İKİ AİLEYİ SIRAYLA gezer (`AKTARIM_SIRASI`): geçmiş · puanlar · izleme
 * listesi · favoriler · gizlenenler · bırakılanlar. Zaten biten aile için
 * sunucu ilk adımda `bitti` döner, yani veri ÇEKİLMEZ.
 *
 * 🔴 ÜÇ KORUMA:
 * 1. **Ekran kapanınca döngü durur** (`iptalRef`) — arka planda sessizce Trakt
 *    isteği atmaya devam eden bir döngü, kullanıcının haberi olmadan kotasını
 *    yerdi.
 * 2. **Geçici hatada bekleyip devam, kalıcı hatada DUR.** Ardışık üç hatada
 *    (`ARDISIK_HATA_TAVANI`) döngü kendini durdurur — Pi'nin backfill motorunun
 *    aynı deseni (`backfill.js`).
 * 3. **Aynı anda tek döngü** (`calisiyorRef`): kullanıcı düğmeye iki kez
 *    basarsa ikinci döngü açılmaz; sunucu tarafında da sayaçlar koşullu
 *    güncellemeyle korunuyor ama istemci gereksiz istek atmamalı.
 */
export function useTraktImport() {
  const { authProvider, isGuest } = useAuth();
  const uygun = authProvider === 'trakt' && !isGuest;

  const [durum, setDurum] = useState<ImportDurumu>('bos');
  const [son, setSon] = useState<ImportAdimSonucu | null>(null);
  const [hata, setHata] = useState<ImportHataBilgisi | null>(null);
  /** Hangi ailedeyiz (UI "3/12" gösterebilsin). */
  const [aile, setAile] = useState<ImportAilesi | null>(null);
  const [bitenAile, setBitenAile] = useState(0);
  /** Atlanan aileler — sonunda kullanıcıya İSİMLE söylenir, sessizce yutulmaz. */
  const [atlanan, setAtlanan] = useState<ImportAilesi[]>([]);
  /** 🧹 K3 kapanış turunda Trakt'tan silindiği için bizden de silinen satır sayısı. */
  const [silinen, setSilinen] = useState<number | null>(null);
  /**
   * 🔴 SÜPÜRME SORUNU — "0 silindi" ile "süpürülemedi" AYRI ŞEYLER.
   *
   * Bu alan olmadan başarısız bir süpürme (`{hata:'http_404'}`) `silinen = 0`
   * görünüyordu ve arayüz *"silinmiş kayıt bulunamadı"* diyordu: BAŞARISIZLIK
   * BAŞARI GİBİ okunuyordu. Canlıda yakalandı (PostgREST şema önbelleği
   * `048`'in RPC'lerini görmüyordu) — kullanıcı "sorunsuz" sandı.
   */
  const [supurmeSorunu, setSupurmeSorunu] = useState<string | null>(null);

  const iptalRef = useRef(false);
  const calisiyorRef = useRef(false);

  useEffect(() => {
    return () => {
      iptalRef.current = true;
    };
  }, []);

  const durdur = useCallback(() => {
    iptalRef.current = true;
    setDurum((d) => (d === 'suruyor' ? 'duraklatildi' : d));
  }, []);

  /**
   * @param aileler gezilecek aileler (varsayılan: hepsi)
   * @param yenile  🔄 fark turu — bitmiş aileyi sunucuda sıfırlayıp yeniden işler
   * @param sessiz  arka plan turu: `durum`/`hata` state'ini OYNATMAZ, arayüzde
   *                "senkronize ediliyor" çubuğu belirip kaybolmasın
   */
  const kosu = useCallback(async ({
    aileler = AKTARIM_SIRASI,
    yenile = false,
    sessiz = false,
    kapanis = false,
  }: {
    aileler?: readonly ImportAilesi[];
    yenile?: boolean;
    sessiz?: boolean;
    /** 🧹 K3: fark + Trakt'tan SİLİNENLERİN süpürülmesi. */
    kapanis?: boolean;
  } = {}) => {
    if (!uygun || calisiyorRef.current) return;
    calisiyorRef.current = true;
    iptalRef.current = false;
    if (!sessiz) {
      setHata(null);
      setAtlanan([]);
      setBitenAile(0);
      setDurum('suruyor');
    }

    const atlananlar: ImportAilesi[] = [];
    // 🧹 K3: kaç satır SİLİNDİ. Sessiz silme YOK — tur bitince kullanıcıya
    // söyleniyor; "0 silindi" ile "süpürülemedi" ayrı şeyler.
    let silinenToplam = 0;
    let ilkSupurmeSorunu: string | null = null;
    try {
      for (let i = 0; i < aileler.length; i += 1) {
        const buAile = aileler[i];
        if (!sessiz) setAile(buAile);
        // 🔑 Hata bütçesi AİLE BAŞINA sıfırlanır: on ikinci ailenin tek bir
        // geçici hatası, önceki ailelerde yenmiş hatalar yüzünden döngüyü
        // anında durdurmasın.
        let ardisikHata = 0;

        // eslint-disable-next-line no-constant-condition
        while (true) {
          if (iptalRef.current) {
            setDurum('duraklatildi');
            return;
          }

          let sonuc: ImportAdimSonucu | null = null;
          let adimHatasi: ImportHataBilgisi | null = null;
          try {
            sonuc = await traktImportAdimi(buAile, yenile, kapanis);
            ardisikHata = 0;
          } catch (e) {
            adimHatasi = e instanceof ImportHatasi ? e.bilgi : { tur: 'genel', mesaj: (e as Error)?.message || 'Bilinmeyen hata.' };
            ardisikHata += 1;
            logError('useTraktImport.adim', e);
          }

          if (sonuc) {
            if (kapanis) {
              const o = supurmeOzeti((sonuc as any).supurulen);
              silinenToplam += o.silinen;
              // İLK sorun saklanır: on iki aile boyunca mesajı değiştirip
              // durmak yerine tek ve kararlı bir uyarı gösteriyoruz.
              if (o.atlandi && !ilkSupurmeSorunu) ilkSupurmeSorunu = o.atlandi;
            }
            if (!sessiz) setSon(sonuc);
            if (sonuc.bitti) break;          // bu aile bitti → sıradakine
          } else if (adimHatasi) {
            // 🔴 Hata KULLANICIYA GÖRÜNÜR (AI_RULES §2) — geçicide bile, çünkü
            // "duruyor gibi ama neden?" sorusunu doğurur.
            if (!sessiz) setHata(adimHatasi);

            // Token sorunu TÜM aileleri ilgilendirir → hemen dur.
            if (tumunuDurdurur(adimHatasi.tur)) {
              if (!sessiz) setDurum('hata');
              return;
            }
            // Tek aileye özgü kalıcı sorun: o aileyi ATLA, diğerlerini feda etme
            // (veri politikası). Atlanan sonunda isimle raporlanır.
            if (!yenidenDenenebilir(adimHatasi.tur) || ardisikHata >= ARDISIK_HATA_TAVANI) {
              atlananlar.push(buAile);
              if (!sessiz) setAtlanan([...atlananlar]);
              break;
            }
          }

          const bekle = sonrakiBeklemeMs(adimHatasi, ardisikHata);
          if (bekle > 0) await new Promise((r) => setTimeout(r, bekle));
        }

        if (!sessiz) setBitenAile(i + 1);
      }

      // Hepsi gezildi. Atlanan varsa bu bir BAŞARI DEĞİL — kullanıcı bilmeli.
      if (!sessiz) {
        if (kapanis) {
          setSilinen(silinenToplam);
          setSupurmeSorunu(ilkSupurmeSorunu);
        }
        setDurum(atlananlar.length ? 'hata' : 'bitti');
      }
    } finally {
      calisiyorRef.current = false;
    }
  }, [uygun]);

  /** Kullanıcının başlattığı tam aktarım. */
  const baslat = useCallback(() => kosu(), [kosu]);

  /**
   * 🧹 K3 KAPANIŞ TURU — fark + Trakt'tan silinenlerin temizliği.
   *
   * ⚠️ `farkTuru`'ndan FARKI: o yalnızca EKLER, bu ayrıca SİLER. Bu yüzden
   * sessiz DEĞİL: kullanıcı ne olduğunu görmeli.
   */
  const kapanisTuru = useCallback(() => {
    setSilinen(null);
    setSupurmeSorunu(null);
    return kosu({ aileler: KAPANIS_AILELERI, kapanis: true });
  }, [kosu]);

  /**
   * 🔄 FARK TURU — Trakt'ta sonradan yapılan eklemeleri getirir (§D15).
   * `sessiz` varsayılan TRUE: açılışta kendiliğinden koşuyor, kullanıcının
   * ekranında sebepsiz bir ilerleme çubuğu belirmemeli.
   */
  const farkTuru = useCallback((sessiz = true) => kosu({ aileler: FARK_AILELERI, yenile: true, sessiz }), [kosu]);

  return {
    /** Yalnızca gerçek Trakt hesabında anlamlı; UI bölümü buna göre gizlenir. */
    uygun,
    durum,
    son,
    hata,
    /** Şu an işlenen aile (UI "geçmiş aktarılıyor…" diyebilsin). */
    aile,
    /** `{ biten, toplam }` — aile içi yüzdeyle KARIŞTIRILMAZ, aileler farklı boyutta. */
    aileler: aileIlerlemesi(bitenAile),
    /** Kalıcı hata yüzünden atlanan aileler; boş değilse aktarım EKSİK. */
    atlanan,
    yuzde: ilerlemeYuzdesi(son),
    baslat,
    farkTuru,
    kapanisTuru,
    silinen,
    /** Süpürme atlandıysa/başarısızsa sebebi; `null` = süpürme gerçekten koştu. */
    supurmeSorunu,
    durdur,
  };
}
