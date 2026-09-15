import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';

import { SettingsSection } from './SettingsSection';
import SettingsRow from './SettingsRow';
import { useTraktImport } from '../../hooks/useTraktImport';
import { Download, RefreshCw } from '../icons';

/**
 * Ayarlar → Hesap Ayarları → "Trakt Verilerim" (Faz T · T5.4).
 *
 * 📍 KONUM (kullanıcı kararı, 2026-09-12): ana Ayarlar'da DEĞİL, Hesap
 * Ayarları'nda — Trakt hesabı bölümünün hemen altında. Düzen bilinçli SADE:
 * ince buton, dar satır aralığı.
 *
 * ==========================================================================
 * 🔕 NEDEN "HEP GÖRÜNEN BİR BUTON" DEĞİL (kullanıcı kararı, 2026-09-12)
 * ==========================================================================
 * *"Veri aktaran kişide o buton kaybolabilir… ilk defa giren kişiye onaylıyor
 * musun sorusu sorulabilir… yüklü olan kişiyi darlamaya gerek yok."*
 *
 *   ilk kurulum → SORU (Evet / Hayır), buton değil
 *   Evet        → hemen başlar, ilerleme görünür
 *   bitti       → bölüm TAMAMEN kaybolur (aktarmış kişiye anlamsız)
 *   Hayır       → panel kapanır, yerinde İNCE bir satır kalır (çıkmaz sokak olmasın)
 *
 * 🔑 Cevap CİHAZDA saklanıyor (`ONAY_ANAHTARI`), sunucuda DEĞİL: kullanıcı
 * *"uygulamayı sildi yükledi tekrar sorulur, yüklü olan kişiye sorulmaz"*
 * dedi — bu tam olarak yerel bir kurulum bayrağının davranışı.
 * ⚠️ Yeniden kurulumda "Evet" denirse veri YENİDEN ÇEKİLMEZ: durum sunucuda
 * (`user_import_state`), ilk adımda `bitti` döner (Worker `durumKarari`) ve
 * bölüm tek istekle kapanır.
 *
 * ⚠️ Aktarım kendiliğinden başlamaz; "Evet" bir ONAYDIR (M348'de cihazda
 * doğrulandı; otomatik başlatma ayrı bir karar).
 */

const ONAY_ANAHTARI = 'kaymak_trakt_import_onay_v1';
type Onay = 'yok' | 'evet' | 'hayir' | 'bitti';

export default function TraktImportSection() {
  const { t } = useTranslation(['settings', 'common']);
  const { uygun, durum, son, hata, yuzde, aile, aileler, atlanan, silinen, supurmeSorunu, zararsizAtlamalar, baslat, kapanisTuru, durdur } = useTraktImport();

  /** `null` = henüz diskten okunmadı (bu sırada HİÇBİR ŞEY çizilmez). */
  const [onay, setOnay] = useState<Onay | null>(null);

  useEffect(() => {
    let iptal = false;
    (async () => {
      try {
        const deger = (await AsyncStorage.getItem(ONAY_ANAHTARI)) as Onay | null;
        if (!iptal) setOnay(deger ?? 'yok');
      } catch {
        // Depolama okunamazsa soruyu göstermek en güvenli varsayılan.
        if (!iptal) setOnay('yok');
      }
    })();
    return () => {
      iptal = true;
    };
  }, []);

  const onayYaz = useCallback(async (deger: Onay) => {
    setOnay(deger);
    try {
      await AsyncStorage.setItem(ONAY_ANAHTARI, deger);
    } catch {
      // Yazılamazsa sonraki açılışta yeniden sorulur — veri kaybı değil.
    }
  }, []);

  // Aktarım bitince bölüm bir daha görünmesin.
  useEffect(() => {
    if (durum === 'bitti' && onay && onay !== 'bitti') void onayYaz('bitti');
  }, [durum, onay, onayYaz]);

  // 🔄 §D15: aktarım bitince bölüm ARTIK KAYBOLMUYOR. Eskiden `onay === 'bitti'`
  // burada `null` döndürüyordu ve kullanıcı bir daha asla senkronize
  // edemiyordu — Trakt'ın sitesinden eklediği hiçbir şey bize ulaşmıyordu.
  // Arka planda altı saatte bir sessiz fark turu koşuyor
  // (`useOtomatikFarkTuru`); buradaki buton onu ELLE tetiklemek için.
  if (!uygun || onay === null) return null;

  const baslatVeOnayla = () => {
    void onayYaz('evet');
    void baslat();
  };

  // "Hayır" dendi ve henüz başlamadı: yalnızca ince bir satır.
  if (onay === 'hayir' && durum === 'bos') {
    return (
      <SettingsSection title={t('settings:importSection', 'Trakt Verilerim')}>
        <SettingsRow
          icon={<RefreshCw size={20} color="#60a5fa" />}
          label={t('settings:importRowLabel', 'Trakt verilerini senkronize et')}
          tintColor="#60a5fa"
          showChevron
          onPress={baslatVeOnayla}
        />
      </SettingsSection>
    );
  }

  // Hiç sorulmadı: buton değil, SORU.
  if (onay === 'yok' && durum === 'bos') {
    return (
      <SettingsSection title={t('settings:importSection', 'Trakt Verilerim')}>
        <View style={styles.govde}>
          <Text style={styles.soru}>
            {t('settings:importAskTitle', 'Trakt verilerin KaymakTV ile senkronize edilsin mi?')}
          </Text>
          <Text style={styles.aciklama}>
            {t('settings:importIdle', 'Trakt geçmişin KaymakTV ile senkronize edilir. Trakt hesabına dokunulmaz.')}
          </Text>
          <View style={styles.dugmeSatiri}>
            <TouchableOpacity style={styles.dugme} activeOpacity={0.85} accessibilityRole="button" onPress={baslatVeOnayla}>
              <Download size={15} color="#fff" strokeWidth={2.2} />
              <Text style={styles.dugmeMetin}>{t('common:yes', 'Evet')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dugme, styles.dugmeIkincil]}
              activeOpacity={0.85}
              accessibilityRole="button"
              onPress={() => void onayYaz('hayir')}
            >
              <Text style={[styles.dugmeMetin, styles.dugmeMetinPasif]}>{t('common:no', 'Hayır')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SettingsSection>
    );
  }

  const suruyor = durum === 'suruyor';
  const bitti = durum === 'bitti';
  // 🔄 §D15: daha önce tamamlamış kullanıcı. Bölüm artık kaybolmuyor ama
  // %100'lük bir çubuk ve "0/0 kayıt" göstermek yanıltıcı olurdu — tek satır
  // + "yeniden senkronize et" yeter.
  const tamamlanmis = onay === 'bitti' && durum === 'bos';

  // Aile adları kullanıcıya GÖRÜNÜR: "Senkronize ediliyor…" 12 aile boyunca
  // donmuş bir metin olurdu ve kullanıcı takıldığını sanardı.
  const aileEtiketi = (a: typeof aile) => {
    switch (a) {
      case 'gecmis': return t('settings:importFamHistory', 'izleme geçmişi');
      case 'puan_dizi': case 'puan_sezon': case 'puan_bolum': case 'puan_film':
        return t('settings:importFamRatings', 'puanlar');
      case 'liste_dizi': case 'liste_film':
        return t('settings:importFamWatchlist', 'izleme listesi');
      case 'favori_trakt_dizi': case 'favori_trakt_film':
        return t('settings:importFamFavorites', 'favoriler');
      case 'gizli_dizi': case 'gizli_film':
        return t('settings:importFamHidden', 'gizlenenler');
      case 'birakilan': return t('settings:importFamDropped', 'bırakılanlar');
      default: return '';
    }
  };

  const durumMetni = () => {
    // 🧹 K3: silme YAPILDIYSA sayıyı söyle — sessiz silme yok.
    if (bitti && silinen !== null) {
      // 🔴 SESSİZ BAŞARISIZLIK YOK: süpürme koşamadıysa bunu "silinecek bir
      // şey yoktu" diye göstermek YALAN olur. Canlıda tam bu yaşandı.
      if (supurmeSorunu) {
        return t('settings:importSweepFailed',
          "Yeni kayıtlar eşitlendi, ama Trakt'ta silinenler kontrol edilemedi. Tekrar deneyebilirsin.");
      }
      // 🟢 TASARIM GEREĞİ atlanan liste sayısı (§D15). Arıza değil, ama
      // söylenmezse "silinmiş kayıt bulunamadı" eksik bir cevap olur:
      // kullanıcı listelerinin KONTROL EDİLDİĞİNİ mi yoksa BOŞ olduğunu mu
      // gördüğümüzü bilemez. Bilgi Worker'ın yanıtında M370'ten beri vardı.
      const bosSayisi = zararsizAtlamalar.bos_liste ?? 0;
      const ek = bosSayisi > 0
        ? ' ' + t('settings:importSweptEmptyLists', {
            sayi: bosSayisi,
            defaultValue: "({{sayi}} listen Trakt'ta zaten boştu.)",
          })
        : '';
      return (silinen > 0
        ? t('settings:importSwept', {
            sayi: silinen,
            defaultValue: "Eşitlendi. Trakt'ta silinmiş {{sayi}} kayıt buradan da kaldırıldı.",
          })
        : t('settings:importSweptNone', "Eşitlendi. Trakt'ta silinmiş kayıt bulunamadı.")) + ek;
    }
    if (bitti) return t('settings:importDone', 'Senkronizasyon tamamlandı.');
    if (durum === 'hata') {
      // 🔴 Atlanan aile varsa aktarım EKSİKTİR — "tamamlandı" demek yalan olurdu.
      if (atlanan.length) {
        return t('settings:importPartial', {
          bolumler: [...new Set(atlanan.map(aileEtiketi))].join(', '),
          defaultValue: 'Senkronizasyon bitti ama şunlar alınamadı: {{bolumler}}. Tekrar deneyebilirsin.',
        });
      }
      return hata?.mesaj || t('settings:importError', 'Senkronizasyon durdu.');
    }
    if (durum === 'duraklatildi') return t('settings:importPaused', 'Duraklatıldı — kaldığı yerden devam eder.');
    if (tamamlanmis) {
      return t('settings:importSynced',
        "Trakt verilerin senkronize. Trakt'ta yaptığın yeni eklemeler arka planda otomatik gelir.");
    }
    if (suruyor) {
      return t('settings:importRunningFamily', {
        bolum: aileEtiketi(aile),
        sira: aileler.biten + 1,
        toplam: aileler.toplam,
        defaultValue: '{{bolum}} senkronize ediliyor… ({{sira}}/{{toplam}})',
      });
    }
    return t('settings:importIdle', 'Trakt geçmişin KaymakTV ile senkronize edilir. Trakt hesabına dokunulmaz.');
  };

  return (
    <SettingsSection title={t('settings:importSection', 'Trakt Verilerim')}>
      <View style={styles.govde}>
        <View style={styles.baslikSatiri}>
          <Text style={styles.baslik}>{t('settings:importTitle', 'Geçmişi Senkronize Et')}</Text>
          {suruyor && <ActivityIndicator size="small" color="#60a5fa" />}
        </View>

        <Text style={[styles.aciklama, (durum === 'hata' || !!supurmeSorunu) && styles.durumHata, bitti && !supurmeSorunu && styles.durumBitti]}>
          {durumMetni()}
        </Text>

        {!tamamlanmis && (
          <View style={styles.cubukArka}>
            <View style={[styles.cubukDolu, { width: `${yuzde ?? (bitti ? 100 : 3)}%` }]} />
          </View>
        )}

        {!!son && !tamamlanmis && (
          <Text style={styles.sayac}>
            {t('settings:importCounters', {
              aktarilan: son.aktarilan,
              toplam: son.toplam ?? '?',
              defaultValue: '{{aktarilan}} / {{toplam}} kayıt',
            })}
            {son.bekleyen > 0
              ? ` · ${t('settings:importPending', {
                  sayi: son.bekleyen,
                  defaultValue: '{{sayi}} kayıt arşive eklenmeyi bekliyor',
                })}`
              : ''}
          </Text>
        )}

        {(!bitti || tamamlanmis) && (
          <TouchableOpacity
            style={[styles.dugme, suruyor && styles.dugmeIkincil]}
            activeOpacity={0.85}
            onPress={suruyor ? durdur : baslat}
            accessibilityRole="button"
          >
            {!suruyor && <Download size={15} color="#fff" strokeWidth={2.2} />}
            <Text style={[styles.dugmeMetin, suruyor && styles.dugmeMetinPasif]}>
              {suruyor
                ? t('settings:importStop', 'Duraklat')
                : tamamlanmis
                  ? t('settings:importResync', 'Yeniden Senkronize Et')
                  : t('settings:importResume', 'Devam Et')}
            </Text>
          </TouchableOpacity>
        )}
        {/* 🧹 K3 KAPANIŞ TURU — ikincil, metin bağlantısı.
            Kullanıcının gerçek sorusu: *"Trakt'tan sildiğim şey neden hâlâ
            burada?"* Normal senkronizasyon yalnızca EKLER (§D15); silmeyi
            yapan tur budur ve `'kaymak'` satırlara DOKUNMAZ (K4). */}
        {/* 🔴 `bitti` DE DAHİL (kullanıcı raporu, 2026-09-15). Eskiden koşul
            yalnızca `tamamlanmis` (= `onay==='bitti' && durum==='bos'`) idi;
            normal senkron biter bitmez `durum` `'bitti'` olduğu için bu
            bağlantı da üstündeki düğme de EKRANDAN KAYBOLUYORDU. Süpürmeye
            basabilmek için Ayarlar'dan çıkıp yeniden girmek gerekiyordu —
            kullanıcı bunu fark edemeyip "Yeniden Senkronize Et"e bastı ve
            süpürme mesajı yerine *"Senkronizasyon tamamlandı"* gördü. */}
        {(tamamlanmis || bitti) && (
          <TouchableOpacity
            style={styles.ikincil}
            activeOpacity={0.7}
            onPress={kapanisTuru}
            accessibilityRole="button"
          >
            <Text style={styles.ikincilMetin}>
              {t('settings:importSweep', "Trakt'tan silinenleri de eşitle")}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </SettingsSection>
  );
}

const styles = StyleSheet.create({
  ikincil: {
    marginTop: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  ikincilMetin: {
    color: '#94a3b8',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  govde: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 8,
  },
  baslikSatiri: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  baslik: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
  },
  soru: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
  aciklama: {
    color: '#94a3b8',
    fontSize: 12.5,
    lineHeight: 17,
  },
  durumHata: {
    color: '#fca5a5',
  },
  durumBitti: {
    color: '#4ade80',
  },
  cubukArka: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  cubukDolu: {
    height: 5,
    borderRadius: 3,
    backgroundColor: '#3b82f6',
  },
  sayac: {
    color: '#64748b',
    fontSize: 12,
  },
  dugmeSatiri: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  dugme: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#2563eb',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 9,
    marginTop: 2,
  },
  dugmeIkincil: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  dugmeMetin: {
    color: '#fff',
    fontSize: 13.5,
    fontWeight: '700',
  },
  dugmeMetinPasif: {
    color: '#94a3b8',
  },
});
