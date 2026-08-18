import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CloudOff, RotateCw, ChevronLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

/**
 * "İçerik yüklenemedi" ekranı — dizi/film/bölüm detay sayfalarının ORTAK
 * hata durumu.
 *
 * 🔴 NEDEN VAR (Y17, sistem denetimi 2026-08-18): üç detay ekranı da hata
 * durumunda YANLIŞ ŞEY gösteriyordu.
 *
 *  • `episode/[id].tsx` HİÇ hata dalı taşımıyordu: Trakt düştüğünde sayfa
 *    `episodeData?.title || t('episodeNum')` gibi fallback'lerle BAŞARIYLA
 *    AÇILMIŞ gibi çiziliyordu — "Bölüm 5 · Henüz özet yok · Tarih yok".
 *    Dahası `first_aired` boş kaldığı için "TBA" rozeti çıkıyor ve "İzledim"
 *    butonu tamamen kayboluyordu. Yani kullanıcıya *"bu bölüm henüz
 *    yayınlanmadı"* deniyordu. Boş ekrandan kötü: uygulama YALAN söylüyordu.
 *
 *  • `show`/`movie` ekranları "Dizi bulunamadı" diyordu — YANLIŞ TEŞHİS.
 *    Dizi duruyor; yalnızca yüklenemedi. Üstelik "Tekrar Dene" sunmuyorlardı,
 *    sadece "Geri Dön" — yani geçici bir ağ hatası kullanıcıyı sayfadan
 *    tamamen kovuyordu.
 *
 * `onRetry` verilmezse buton çizilmez (çağıran `refreshData`'ya sahip
 * değilse). Üç hook da `refreshData` döndürüyordu ve ÜÇÜNDE DE
 * kullanılmıyordu — bu bileşen onu nihayet bağlıyor (Y5 ile aynı kök).
 */
interface LoadFailedStateProps {
  title?: string;
  text?: string;
  onRetry?: () => void;
  onBack?: () => void;
}

export default function LoadFailedState({ title, text, onRetry, onBack }: LoadFailedStateProps) {
  const { t } = useTranslation(['media', 'common']);

  return (
    <View style={styles.container}>
      <View style={styles.iconBadge}>
        <CloudOff size={26} color="#f59e0b" />
      </View>

      <Text style={styles.title}>{title ?? t('media:loadFailedTitle', 'İçerik yüklenemedi')}</Text>
      <Text style={styles.text}>
        {text ?? t('media:loadFailedText', 'Bağlantını kontrol edip tekrar dene. İçerik silinmedi — yalnızca şu an ulaşılamıyor.')}
      </Text>

      <View style={styles.actions}>
        {onRetry && (
          <TouchableOpacity style={styles.retryBtn} onPress={onRetry} activeOpacity={0.8}>
            <RotateCw size={15} color="#0B1120" />
            <Text style={styles.retryText}>{t('common:retry', 'Tekrar Dene')}</Text>
          </TouchableOpacity>
        )}
        {onBack && (
          <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.8}>
            <ChevronLeft size={15} color="#94a3b8" />
            <Text style={styles.backText}>{t('media:goBack', 'Geri Dön')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1120',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    color: '#f1f5f9',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  text: {
    color: '#64748b',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#38bdf8',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: {
    color: '#0B1120',
    fontSize: 13,
    fontWeight: '700',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  backText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
});
