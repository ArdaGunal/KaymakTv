import React, { useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Search, X, UserSearch } from '../../../components/icons';
import UserSearchResults from './UserSearchResults';
import { useUserSearch, EN_AZ_KARAKTER } from '../hooks/useUserSearch';

const GENIS_EKRAN = 768;

interface Props {
  visible: boolean;
  onClose: () => void;
}

/**
 * Kişi arama paneli (2026-09-17).
 *
 * ==========================================================================
 * 🧭 NEDEN AYRI BİR PANEL
 * ==========================================================================
 * Eskiden akışın en üstünde sabit bir arama çubuğu duruyordu. Kullanıcı:
 * *"bu butonun böyle olması anlamsız… kişi arama kısmını sembol haline
 * getirelim, ona basınca kişi aranabilen bir menü çıksın."* Çubuk kalkınca
 * akışta yer açılıyor ve "Ne düşünüyorsun?" kutusu sayfanın en üstüne çıkıyor.
 * Aynı panel Profil → Ağım ekranından da açılıyor (`UserSearchButton`).
 *
 * ==========================================================================
 * 📐 İKİ YERLEŞİM
 * ==========================================================================
 *   dar (mobil + dar web)  → TAM EKRAN. Arama alanı EN ÜSTTE, sonuçlar altında.
 *                            Panel alt sekme çubuğunun da ÜSTÜNE açıldığı için
 *                            alt navigasyonla çakışma yok; üstte durum çubuğu,
 *                            altta hareket çubuğu payı (`insets`) bırakılıyor.
 *   geniş (≥768, masaüstü) → ortada 520 px kutu, karartılmış arka plan.
 *                            Arka plana tıklamak ya da Esc kapatır.
 *
 * ==========================================================================
 * ⌨️ KLAVYE — yeni bir desen İCAT EDİLMEDİ
 * ==========================================================================
 * `FeedCommentSheet`'in cihazda sınanmış deseni birebir: Android'de
 * `statusBarTranslucent` + pencere yeniden boyutlanması, iOS'ta
 * `KeyboardAvoidingView` `padding`. O sayfada giriş alanı EN ALTTA duruyor
 * (en zor durum) ve çalışıyor; burada en üstte, sonuçlar kaydırılabilir.
 *
 * 🔑 `keyboardShouldPersistTaps="handled"`: klavye açıkken bir kişiye İLK
 * dokunuşta gidilir. Olmasaydı ilk dokunuş yalnızca klavyeyi kapatır, kullanıcı
 * aynı satıra iki kez basmak zorunda kalırdı. `keyboardDismissMode="on-drag"`:
 * listeyi kaydırmak klavyeyi indirir, alttaki sonuçlar görünür.
 */
export default function UserSearchSheet({ visible, onClose }: Props) {
  const { t } = useTranslation('feed');
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const genis = width >= GENIS_EKRAN;
  const search = useUserSearch();
  const inputRef = useRef<TextInput>(null);

  // Kapanınca her şey sıfırlanır: bir sonraki açılışta eski arama durmasın.
  const kapat = useCallback(() => {
    Keyboard.dismiss();
    search.clear();
    onClose();
    // `search` her render yeni bir nesne; `clear` ise kararlı — ona bağlanıyoruz.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.clear, onClose]);

  // Android'de Modal içinde `autoFocus` klavyeyi her zaman açmıyor; panel
  // görününce odağı açıkça veriyoruz.
  const odakla = useCallback(() => {
    setTimeout(() => inputRef.current?.focus(), 60);
  }, []);

  const kisa = search.query.trim().length < EN_AZ_KARAKTER;
  const sonucVar = search.results !== null || !!search.error;

  const icerik = (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.panel, genis ? styles.panelGenis : [styles.panelTam, { paddingTop: insets.top + 8 }]]}
    >
      <View style={styles.ust}>
        <TouchableOpacity
          onPress={kapat}
          style={styles.kapatDugme}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t('searchClose', 'Kapat')}
        >
          {genis ? <X size={20} color="#94a3b8" /> : <ChevronLeft size={24} color="#f1f5f9" />}
        </TouchableOpacity>

        <View style={styles.kutu}>
          <Search size={17} color="#64748b" />
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={search.query}
            onChangeText={search.setQuery}
            onSubmitEditing={search.search}
            placeholder={t('searchPlaceholder', 'Kullanıcı adı ara')}
            placeholderTextColor="#64748b"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus={Platform.OS === 'web'}
            returnKeyType="search"
            accessibilityLabel={t('searchPlaceholder', 'Kullanıcı adı ara')}
          />
          {search.isSearching ? (
            <ActivityIndicator size="small" color="#38bdf8" />
          ) : search.query.length > 0 ? (
            <TouchableOpacity
              onPress={() => { search.clear(); inputRef.current?.focus(); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={t('searchClear', 'Temizle')}
            >
              <X size={17} color="#64748b" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView
        style={genis ? styles.listeGenis : styles.listeTam}
        contentContainerStyle={[styles.listeIcerik, { paddingBottom: (genis ? 0 : insets.bottom) + 24 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {sonucVar ? (
          <UserSearchResults results={search.results} error={search.error} onSelect={kapat} />
        ) : kisa && !search.isSearching ? (
          <View style={styles.ipucu}>
            <UserSearch size={34} color="#334155" />
            <Text style={styles.ipucuMetni}>
              {t('searchHint', 'Takip etmek istediğin kişinin KaymakTV kullanıcı adını yaz.')}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType={genis ? 'fade' : 'slide'}
      onRequestClose={kapat}
      onShow={odakla}
      statusBarTranslucent={Platform.OS === 'android'}
    >
      {genis ? (
        <View style={styles.perde}>
          {/* Arka plana tıklamak kapatır — kutunun kendisi tıklamayı yutmaz,
              çünkü perde kutunun ARKASINDA ayrı bir katman. */}
          <Pressable style={StyleSheet.absoluteFill} onPress={kapat} accessibilityLabel={t('searchClose', 'Kapat')} />
          {icerik}
        </View>
      ) : (
        <View style={styles.tamZemin}>{icerik}</View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  tamZemin: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  perde: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.72)',
    alignItems: 'center',
    paddingTop: 88,
    paddingHorizontal: 16,
  },
  panel: {
    backgroundColor: '#0B1120',
  },
  panelTam: {
    flex: 1,
    paddingHorizontal: 16,
  },
  panelGenis: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '72%',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#22304A',
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 28,
    elevation: 12,
  },
  ust: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  kapatDugme: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kutu: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 46,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: '#22304A',
  },
  input: {
    flex: 1,
    color: '#f1f5f9',
    fontSize: 15,
    // Web'de odak halkası kutunun kendi kenarlığıyla çakışmasın.
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null),
  },
  listeTam: {
    flex: 1,
  },
  listeGenis: {
    flexGrow: 0,
  },
  listeIcerik: {
    flexGrow: 1,
  },
  ipucu: {
    alignItems: 'center',
    gap: 12,
    paddingTop: 48,
    paddingHorizontal: 32,
    paddingBottom: 24,
  },
  ipucuMetni: {
    color: '#64748b',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});
