import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  FlatList,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { X } from '../../../components/icons';
import SearchBar from '../../../components/SearchBar';
import SearchTabs, { SearchTabType } from '../../../components/SearchTabs';
import { searchTrakt } from '../../../services/api/search';
import MediaPickerRow, { PickedMedia } from './MediaPickerRow';

interface MediaPickerModalProps {
  visible: boolean;
  onSelect: (media: PickedMedia) => void;
  onClose: () => void;
}

/**
 * Gönderi compose ekranındaki opsiyonel yapım seçici — var olan arama
 * altyapısını (searchTrakt, SearchBar, SearchTabs — Keşfet sekmesinde zaten
 * kanıtlı) REUSE eder, yalnızca sonuç satırını (MediaPickerRow) SEÇMEK için
 * amaca özel olarak yeniden yazar (bkz. o dosyadaki not: `ShowCard` detay
 * sayfasına yönlendirdiği için buraya uymuyordu).
 */
export default function MediaPickerModal({ visible, onSelect, onClose }: MediaPickerModalProps) {
  const { t } = useTranslation('feed');
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SearchTabType>('show');
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const searchSeq = useRef(0);

  // Modal her kapanışta arama durumunu sıfırla — tekrar açılınca eski
  // sorgu/sonuçlarla karşılaşılmasın.
  useEffect(() => {
    if (!visible) {
      setQuery('');
      setResults([]);
    }
  }, [visible]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setIsLoading(false);
      return;
    }
    const seq = ++searchSeq.current;
    setIsLoading(true);
    searchTrakt(trimmed, activeTab)
      .then((data) => {
        if (searchSeq.current !== seq) return; // eskimiş sonuç, yarış koruması
        setResults(Array.isArray(data) ? data : []);
      })
      .catch((error) => {
        if (searchSeq.current !== seq) return;
        console.warn('[Feed] Yapım araması başarısız:', error);
        setResults([]);
      })
      .finally(() => {
        if (searchSeq.current === seq) setIsLoading(false);
      });
  }, [query, activeTab]);

  const handleSelect = (media: PickedMedia) => {
    onSelect(media);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent={Platform.OS === 'android'}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.sheet}>
              <View style={styles.header}>
                <Text style={styles.title}>{t('mediaPickerTitle', 'Bir Yapım Seç')}</Text>
                <TouchableOpacity onPress={onClose} hitSlop={8}>
                  <X size={20} color="#64748b" />
                </TouchableOpacity>
              </View>

              <View style={styles.searchArea}>
                <SearchBar
                  value={query}
                  onChangeText={setQuery}
                  placeholder={t('mediaPickerSearchPlaceholder', 'Dizi veya film ara...')}
                  style={styles.searchBar}
                />
                <SearchTabs activeTab={activeTab} onTabChange={setActiveTab} />
              </View>

              {isLoading ? (
                <ActivityIndicator style={styles.loading} color="#3b82f6" />
              ) : query.trim().length < 2 ? (
                <Text style={styles.hint}>{t('mediaPickerHint', 'Aramak için en az 2 karakter yaz.')}</Text>
              ) : results.length === 0 ? (
                <Text style={styles.hint}>{t('mediaPickerEmpty', 'Sonuç bulunamadı.')}</Text>
              ) : (
                <FlatList
                  data={results}
                  keyExtractor={(item, index) => {
                    const media = item.show || item.movie;
                    return media?.ids?.trakt ? `${media.ids.trakt}` : `${index}`;
                  }}
                  renderItem={({ item }) => <MediaPickerRow data={item} onPress={handleSelect} />}
                  style={styles.list}
                  keyboardShouldPersistTaps="handled"
                />
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: '#22304A',
    maxHeight: '85%',
    minHeight: 380,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 4,
  },
  title: {
    color: '#f1f5f9',
    fontSize: 16,
    fontWeight: '700',
  },
  searchArea: {
    paddingHorizontal: 16,
  },
  searchBar: {
    marginBottom: 4,
  },
  loading: {
    marginTop: 24,
  },
  hint: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 24,
    paddingHorizontal: 24,
  },
  list: {
    paddingHorizontal: 16,
  },
});
