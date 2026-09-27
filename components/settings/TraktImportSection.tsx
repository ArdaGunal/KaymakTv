import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';

import { SettingsSection } from './SettingsSection';
import { useTraktImport } from '../../hooks/useTraktImport';
import { aktarimMotoru } from '../../services/import/aktarimBaglanti';
import { useAktarimStore } from '../../store/aktarimStore';
import { Download } from '../icons';

/**
 * Ayarlar → Hesap Ayarları → "Trakt Verilerim" (Faz T · T5.4).
 *
 * 📍 KONUM (kullanıcı kararı, 2026-09-12): ana Ayarlar'da DEĞİL, Hesap
 * Ayarları'nda — Trakt hesabı bölümünün hemen altında. Düzen bilinçli SADE:
 * ince buton, dar satır aralığı.
 *
 * ==========================================================================
 * 🤖 SORU KALKTI — AKTARIM OTOMATİK (§C33, kullanıcı kararı 2026-09-28)
 * ==========================================================================
 * Eskiden ilk girişte *"senkronize edilsin mi?"* sorusu vardı ve aktarım
 * yalnızca "Evet"le başlıyordu. T6.3'ten beri kütüphane YALNIZCA bizden
 * okunduğu için o soruyu görmeyen kullanıcı (27 Eylül, DalekCan) iki hafta
 * boyunca boş kütüphane gördü. Artık `useOtomatikAktarim` her Trakt oturumunda
 * eksik aileleri kendisi tamamlıyor — daha önce "Hayır" diyenler DAHİL.
 *
 * Bu bölüm artık yalnızca:
 *   • motor sürerken DURUMU gösterir (düğme yok — ikinci döngü açılmasın)
 *   • ertelenmiş aktarımı ELLE yeniden denetir
 *   • tamamlanmış kullanıcıya GERÇEK bir fark turu + K3 süpürmesi sunar
 */

/** Motorun "şu an aktarıyor" fazları — bu sırada elle düğme GÖSTERİLMEZ. */
const MOTOR_SURUYOR = new Set(['kontrol', 'suruyor', 'ag_bekleniyor', 'baska_cihaz']);

export default function TraktImportSection() {
  const { t } = useTranslation(['settings', 'common']);
  const { uygun, durum, son, hata, yuzde, aile, aileler, atlanan, silinen, supurmeSorunu, zararsizAtlamalar, baslat, farkTuru, kapanisTuru, durdur } = useTraktImport();
  const motor = useAktarimStore();

  if (!uygun) return null;

  const suruyor = durum === 'suruyor';
  const bitti = durum === 'bitti';
  // 🔄 §D15: daha önce tamamlamış kullanıcı. Bölüm artık kaybolmuyor ama
  // %100'lük bir çubuk ve "0/0 kayıt" göstermek yanıltıcı olurdu — tek satır
  // + "yeniden senkronize et" yeter.
  const tamamlanmis = durum === 'bos' && (motor.faz === 'tamam' || motor.faz === 'bitti');
  // 🤖 Otomatik motor sürüyor: elle tur AÇILMAZ (kilit zaten reddederdi —
  // düğmeyi göstermek "bastım, bir şey olmadı" yalanı olurdu).
  const motorSuruyor = durum === 'bos' && MOTOR_SURUYOR.has(motor.faz);
  const motorErtelendi = durum === 'bos' && motor.faz === 'ertelendi';
  const motorYuzde = motor.toplam > 0 ? Math.min(100, Math.round((motor.islenen / motor.toplam) * 100)) : null;

  // 🔴 "YENİDEN SENKRONİZE ET" ARTIK GERÇEKTEN ÇEKİYOR (§C33). Eskiden tam
  // turu `yenile` OLMADAN çağırıyordu: tamamlanmış her aile sunucuda anında
  // `bitti` dönüyor, ekran "tamamlandı" diyor ama HİÇBİR ŞEY çekilmiyordu.
  // Doğrusu fark turu (§D15) — görünür modda.
  const dugmeEylemi = () => {
    if (suruyor) return durdur();
    if (motorErtelendi) return void aktarimMotoru().baslat();
    if (tamamlanmis) return void farkTuru(false);
    return void baslat();
  };

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
    if (motorSuruyor) {
      if (motor.faz === 'ag_bekleniyor') {
        return t('settings:importAutoWaitingNet', 'İnternet bağlantısı bekleniyor — kaldığı yerden devam edecek.');
      }
      if (motor.faz === 'baska_cihaz') {
        return t('settings:importAutoOtherDevice', 'Aktarım başka bir cihazında sürüyor.');
      }
      return t('settings:importAuto', 'Senkronize ediliyor — lütfen uygulamayı kapatmayın.');
    }
    if (motorErtelendi) {
      return t('settings:importAutoDeferred',
        'Trakt verilerinin bir kısmı henüz aktarılamadı. Uygulamaya her döndüğünde otomatik yeniden denenir.');
    }
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
          {(suruyor || motorSuruyor) && <ActivityIndicator size="small" color="#60a5fa" />}
        </View>

        <Text style={[styles.aciklama, (durum === 'hata' || !!supurmeSorunu) && styles.durumHata, bitti && !supurmeSorunu && styles.durumBitti]}>
          {durumMetni()}
        </Text>

        {!tamamlanmis && !motorErtelendi && (
          <View style={styles.cubukArka}>
            <View style={[styles.cubukDolu, { width: `${(motorSuruyor ? motorYuzde : yuzde) ?? (bitti ? 100 : 3)}%` }]} />
          </View>
        )}

        {motorSuruyor && motor.toplam > 0 && (
          <Text style={styles.sayac}>
            {t('settings:importCounters', {
              aktarilan: motor.islenen,
              toplam: motor.toplam,
              defaultValue: '{{aktarilan}} / {{toplam}} kayıt',
            })}
          </Text>
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

        {(!bitti || tamamlanmis) && !motorSuruyor && (
          <TouchableOpacity
            style={[styles.dugme, suruyor && styles.dugmeIkincil]}
            activeOpacity={0.85}
            onPress={dugmeEylemi}
            accessibilityRole="button"
          >
            {!suruyor && <Download size={15} color="#fff" strokeWidth={2.2} />}
            <Text style={[styles.dugmeMetin, suruyor && styles.dugmeMetinPasif]}>
              {suruyor
                ? t('settings:importStop', 'Duraklat')
                : motorErtelendi
                  ? t('settings:importRetryNow', 'Şimdi tekrar dene')
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
