import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AlertTriangle } from './icons';
import { logError } from '../utils/errorLog';

/**
 * BLOK BAZLI hata sınırı — bir bölümün render hatası TÜM EKRANI düşürmesin.
 *
 * ⚠️ `components/ErrorFallback.tsx` ile FARKI: o, expo-router'ın **kök**
 * `ErrorBoundary`'sinin (bkz. app/_layout.tsx) çizdiği TAM EKRAN kurtarma
 * ekranıdır — bir render istisnası olduğunda kullanıcı sayfanın tamamını
 * kaybeder. Bu bileşen ise yalnızca sardığı alt ağacı yakalar; sayfanın geri
 * kalanı çalışmaya devam eder.
 *
 * NEDEN GEREKLİ (S13, bkz. docs/REVIEWS_PLAN.md §4.2): "Trakt API kesilirse
 * alt blok kaybolur, sayfa bozulmaz" güvencesi bugün yalnızca VERİ hataları
 * için geçerliydi (`Promise.allSettled` + per-call `.catch`). Bir RENDER
 * istisnası (ör. Trakt'ın beklenmedik biçimde döndürdüğü bir alan) hâlâ tüm
 * ekranı fallback'e düşürürdü. Bu sınıf o boşluğu kapatıyor.
 *
 * Sınıf bileşeni olmak ZORUNDA: React'te hata yakalama yalnızca
 * `getDerivedStateFromError` / `componentDidCatch` ile mümkün, hook karşılığı
 * yok.
 */

interface Props {
  children: React.ReactNode;
  /** Hata kaydında görünecek etiket — hangi bölümün çöktüğü anlaşılsın diye. */
  label: string;
  /**
   * `true` ise hata durumunda HİÇBİR ŞEY çizilmez (bölüm sessizce kaybolur).
   * Zorunlu olmayan, tamamlayıcı bölümler için — ör. Trakt yorumları:
   * kullanıcı kararı "Trakt bloğu yoksa sessizce gizlensin, hata gösterme"
   * (docs/REVIEWS_PLAN.md §1, Karar 10).
   */
  silent?: boolean;
}

interface State {
  hasError: boolean;
}

export default class SectionErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    // Sessizce gizlense bile KAYIT TUTULUR — aksi halde bir bölümün sürekli
    // çöktüğünü kimse fark etmezdi (docs/AI_RULES.md §2: console.error tek
    // başına yeterli değil, kalıcı tanılama için logError).
    logError(`SectionErrorBoundary:${this.props.label}`, error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.silent) return null;

    return (
      <View style={styles.box}>
        <AlertTriangle size={14} color="#f87171" />
        <Text style={styles.text}>Bu bölüm yüklenemedi.</Text>
        <TouchableOpacity
          onPress={() => this.setState({ hasError: false })}
          activeOpacity={0.8}
          style={styles.retryBtn}
        >
          <Text style={styles.retryText}>Tekrar Dene</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239,68,68,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  text: {
    color: '#94a3b8',
    fontSize: 12,
    flex: 1,
  },
  retryBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#172033',
    borderRadius: 8,
  },
  retryText: {
    color: '#e5e5e5',
    fontSize: 11,
    fontWeight: '700',
  },
});
