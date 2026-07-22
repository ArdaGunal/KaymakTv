import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SectionList,
  RefreshControl,
  StyleSheet,
  Animated,
  Easing,
  Platform,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { EdgeInsets } from 'react-native-safe-area-context';
import { ChevronDown, PlayCircle, Bookmark, Clock, PauseCircle } from 'lucide-react-native';
import EpisodeCard from '../EpisodeCard';
import type { ShowCategories, TrackingCard } from '../../store/tracking/trackingLogic';
import type { TrackingCategoryKey, CollapsedMap } from '../../store/tracking/useTrackingStore';

// ============================================================================
// NEDEN `stickySectionHeadersEnabled` KULLANMIYORUZ (Madde 61)
// ----------------------------------------------------------------------------
// React Native'in yapışkan başlığı NATIF bir özellik DEĞİL: `ScrollView`, ilgili
// çocukları `ScrollViewStickyHeader` ile sarmalayıp translateY'yi bir `Animated`
// interpolasyonuyla sürüyor. Bu interpolasyonun aralığı iki ÖLÇÜME bağlı:
// başlığın kendi `layoutY`si ve BİR SONRAKİ başlığın `nextHeaderLayoutY`si
// (node_modules/react-native/Libraries/Components/ScrollView/ScrollViewStickyHeader.js).
// `SectionList`te başlıklar da sanallaştırılmış listenin normal item'larıdır
// (VirtualizedSectionList her bölüm için 1 header + 1 footer item ekler), yani
// kaydırdıkça pencereden çıkıp girerler; çıkıp girdikçe bu iki ölçüm eskir ve
// interpolasyon aralığı yanlış hesaplanır. Gözlenen semptom tam olarak buydu:
// ilk bölüm (index 0, `initialNumToRender` bölgesi sayesinde HER ZAMAN render
// edilir) düzgün yapışıyor; 50 elemanlı ikinci bölümün başlığı ise birkaç
// karttan sonra kayboluyor, listenin sonunda (yeniden ölçülünce) geri geliyor,
// yukarı-aşağı-yukarı yapınca büsbütün bozuluyordu.
//
// ÇÖZÜM: yapışkan başlığı listenin İÇİNDEN tamamen çıkardık. Artık liste normal
// (yapışkansız) akıyor, üstünde ise `position: 'absolute'` bir OVERLAY başlık
// duruyor. Hangi bölümün gösterileceğini `onViewableItemsChanged` söylüyor:
// ekranda görünen EN ÜSTTEKİ satırın ait olduğu bölüm. Bu, yapışkanlığın tam
// tanımıdır ve sanallaştırmayla hiçbir alışverişi yoktur — hücreler geri
// dönüştürülse de overlay ayrı bir kardeş görünümdür, asla unmount olmaz.
// Yan fayda: overlay listenin KARDEŞİ olduğu için dokunuşları doğal olarak
// yakalar; "hayalet başlık" (görünen ama tıklanmayan buton) sorunu da kökten
// ortadan kalkar.
// ============================================================================

// ESKİ DAVRANIŞ: bölüm aç/kapa'da `LayoutAnimation.configureNext()` çağrılıyordu.
// `LayoutAnimation` NATIF görünüm ağacının TAMAMI üzerinde çalışır; bu, alttaki
// `SectionList`'in kendi cell recycling/windowing mekanizmasıyla ÇAKIŞIYORDU.
// Bu yüzden veri değişimini (kart listesinin açılıp kapanmasını) artık HİÇ
// animasyonlamıyoruz. Şevron ikonunun dönüşü (aşağıdaki `rotateAnim`) ayrı,
// izole bir `Animated.Value`dır — tek bir küçük view'i etkilediği için bu
// çakışmadan muaftır, korunuyor.

const SECTION_META: Record<TrackingCategoryKey, { Icon: React.ComponentType<any>; tint: string; bg: string }> = {
  upNext: { Icon: PlayCircle, tint: '#60a5fa', bg: 'rgba(59, 130, 246, 0.12)' },
  paused: { Icon: PauseCircle, tint: '#fb923c', bg: 'rgba(251, 146, 60, 0.12)' },
  notStarted: { Icon: Bookmark, tint: '#c084fc', bg: 'rgba(168, 85, 247, 0.12)' },
  dropped: { Icon: Clock, tint: '#fbbf24', bg: 'rgba(245, 158, 11, 0.12)' },
};

const SECTION_ORDER: TrackingCategoryKey[] = ['upNext', 'paused', 'notStarted', 'dropped'];

// Listenin içerik üst boşluğu (`styles.content.paddingTop`). Overlay başlık
// YALNIZCA kaydırma bu değeri geçtiğinde gösterilir: tam bu eşikte overlay'in
// üst kenarı (top: 0) ile listedeki gerçek başlığın üst kenarı BİREBİR çakışır,
// böylece geçiş sırasında çift başlık/kayma görünmez. Eşiğin altındayken
// (liste tepedeyken) zaten gerçek başlık görünüyordur.
const CONTENT_TOP_PADDING = 12;

// Görünürlük eşiği: %1. KASITLI OLARAK 0 DEĞİL — `ViewabilityHelper` yüzde
// hesabını `percent >= threshold` ile yapar; 0 verilirse ekranın DIŞINDA kalan
// (ama hâlâ render penceresinde olan) satırlar da "görünür" sayılır ve "en
// üstteki görünür satır" mantığı bozulur.
const VIEWABILITY_CONFIG = {
  itemVisiblePercentThreshold: 1,
  minimumViewTime: 0,
  waitForInteraction: false,
} as const;

interface Section {
  key: TrackingCategoryKey;
  title: string;
  count: number;
  collapsed: boolean;
  data: TrackingCard[];
}

interface TrackingAccordionListProps {
  categories: ShowCategories;
  collapsed: CollapsedMap;
  onToggle: (key: TrackingCategoryKey) => void;
  labels: Record<TrackingCategoryKey, string>;
  onShowFinished: (showName: string, showId: number) => void;
  onToggleDropped: (id: number) => void;
  refreshing: boolean;
  onRefresh: () => void;
  insets: EdgeInsets;
  emptyLabel: string;
}

// Başlık, hem liste İÇİNDE hem de yapışkan OVERLAY olarak aynı bileşenle
// render edilir — ikisinin birebir aynı görünmesi bu tekilliğin garantisi.
// Tek fark dış sarmalayıcının stili (`wrapperStyle`): listede negatif margin
// ile `styles.list`in yatay padding'ini iptal eder, overlay'de ise mutlak
// konumlanır. İçerideki "hap" (pill) tasarımı iki durumda da aynıdır.
const SectionHeader = memo(function SectionHeader({
  sectionKey,
  title,
  count,
  collapsed,
  onToggle,
  wrapperStyle,
}: {
  sectionKey: TrackingCategoryKey;
  title: string;
  count: number;
  collapsed: boolean;
  onToggle: (key: TrackingCategoryKey) => void;
  wrapperStyle: StyleProp<ViewStyle>;
}) {
  const rotateAnim = useRef(new Animated.Value(collapsed ? 0 : 1)).current;

  React.useEffect(() => {
    Animated.timing(rotateAnim, {
      toValue: collapsed ? 0 : 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [collapsed, rotateAnim]);

  const rotate = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const meta = SECTION_META[sectionKey];
  const Icon = meta.Icon;

  return (
    // Sarmalayıcının KATI (opak) arka planı zorunlu: overlay başlık listenin
    // üstünde asılı dururken altından kayan afişler yarı saydam bir zeminden
    // sızıp içerikle çakışırdı. BlurView (glassmorphism) yerine bilinçli olarak
    // katı renk seçildi — her kare yeniden çizilen bir GPU efekti Android'de
    // ekstra render riski katardı.
    <View style={wrapperStyle}>
      <TouchableOpacity style={styles.categoryHeader} activeOpacity={0.7} onPress={() => onToggle(sectionKey)}>
        <View style={styles.categoryHeaderLeft}>
          <View style={[styles.categoryIconBox, { backgroundColor: meta.bg }]}>
            <Icon size={16} color={meta.tint} />
          </View>
          <Text style={styles.categoryTitle}>{title}</Text>
          <View style={styles.badgeContainer}>
            <Text style={styles.badgeText}>{count}</Text>
          </View>
        </View>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <ChevronDown size={20} color="#64748b" />
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
});

function TrackingAccordionList({
  categories,
  collapsed,
  onToggle,
  labels,
  onShowFinished,
  onToggleDropped,
  refreshing,
  onRefresh,
  insets,
  emptyLabel,
}: TrackingAccordionListProps) {
  // Yapışkan overlay'de o an gösterilecek bölüm ve overlay'in görünür olup
  // olmadığı. İkisi de sadece DEĞİŞTİĞİNDE state'e yazılır (aşağıdaki
  // "aynıysa öncekini döndür" kalıbı React'in re-render'ı atlamasını sağlar) —
  // her scroll frame'inde render tetiklenmez.
  const [activeKey, setActiveKey] = useState<TrackingCategoryKey | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);

  const handleToggle = useCallback((key: TrackingCategoryKey) => onToggle(key), [onToggle]);

  // SectionList'in beklediği format: her kategori kendi section'ı. Kapalı
  // (collapsed) bölümlere boş `data` verilir. Başlık, kategori boş olmadığı
  // sürece HER ZAMAN gösterilir — collapsed olması başlığı gizlemez.
  // `useMemo` şart: referansı stabil kalmayan bir `sections` dizisi
  // VirtualizedList'i her render'da baştan ölçmeye zorlar.
  const sections = useMemo<Section[]>(() => {
    const out: Section[] = [];
    for (const key of SECTION_ORDER) {
      const items = categories[key];
      if (items.length === 0) continue;
      out.push({
        key,
        title: labels[key],
        count: items.length,
        collapsed: collapsed[key],
        data: collapsed[key] ? [] : items,
      });
    }
    return out;
  }, [categories, collapsed, labels]);

  const renderItem = useCallback(
    ({ item }: { item: TrackingCard }) => (
      <EpisodeCard data={item} onShowFinished={onShowFinished} onToggleDropped={onToggleDropped} />
    ),
    [onShowFinished, onToggleDropped]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: Section }) => (
      <SectionHeader
        sectionKey={section.key}
        title={section.title}
        count={section.count}
        collapsed={section.collapsed}
        onToggle={handleToggle}
        wrapperStyle={styles.categoryHeaderWrapper}
      />
    ),
    [handleToggle]
  );

  // Her dizi tam olarak BİR kategoriye düşer (trackingLogic.ts'in garantisi),
  // bu yüzden `item.id` tüm section'lar arasında zaten benzersizdir.
  // DEFANSİF `id` KONTROLÜ ŞART: `onViewableItemsChanged` açıkken
  // VirtualizedSectionList, görünürlük token'ını dönüştürürken bu fonksiyonu
  // BÖLÜM BAŞLIĞI/ALTLIĞI satırları için de çağırır — o satırlarda `item`, bir
  // `TrackingCard` değil `Section` objesidir ve `id` alanı yoktur. Kontrolsüz
  // `item.id.toString()` orada anında çökerdi.
  const keyExtractor = useCallback((item: TrackingCard) => {
    const row = item as unknown as { id?: number; key?: string };
    if (row?.id != null) return String(row.id);
    return row?.key ?? '';
  }, []);

  // Ekranda görünen EN ÜSTTEKİ satırın bölümü = yapışkan başlıkta gösterilecek
  // bölüm. `viewableItems` daima index sırasına göre (yukarıdan aşağıya) gelir.
  // Ref içinde tutuluyor çünkü VirtualizedList bu callback'i yalnızca ilk
  // kurulumda okur; sonradan değişen bir referans etkisiz kalır.
  const onViewableItemsChangedRef = useRef(
    ({ viewableItems }: { viewableItems: Array<{ section?: { key?: TrackingCategoryKey } }> }) => {
      const topKey = viewableItems[0]?.section?.key;
      if (!topKey) return;
      setActiveKey(prev => (prev === topKey ? prev : topKey));
    }
  );
  const viewabilityConfigRef = useRef(VIEWABILITY_CONFIG);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const next = y >= CONTENT_TOP_PADDING;
    setShowOverlay(prev => (prev === next ? prev : next));
  }, []);

  const activeSection = useMemo(
    () => (activeKey == null ? null : sections.find(s => s.key === activeKey) ?? null),
    [sections, activeKey]
  );

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={keyExtractor}
        // RN'in kendi yapışkan başlığı KAPALI — yerine yukarıdaki overlay
        // kullanılıyor (dosyanın başındaki uzun nota bakınız).
        stickySectionHeadersEnabled={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onViewableItemsChanged={onViewableItemsChangedRef.current}
        viewabilityConfig={viewabilityConfigRef.current}
        style={styles.list}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        // getItemLayout BİLİNÇLİ OLARAK eklenmedi: EpisodeCard'ın yüksekliği
        // sabit değil (başlık `numberOfLines={2}`e göre 1-2 satır). Sahte bir
        // sabit yükseklik varsayımı yanlış scroll konumu tahminine yol açardı.
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        windowSize={5}
        updateCellsBatchingPeriod={50}
        // Android'de hücrelerin native ağaçtan tamamen sökülmesi, ölçüme dayalı
        // her mekanizmayı (görünürlük hesabı dahil) kırılganlaştırır. Uzun
        // listelerdeki marjinal bellek kazancından bilinçli olarak feragat
        // edildi.
        removeClippedSubviews={false}
        // Kaydırılmış haldeyken bir bölümü kapatınca (ör. 100 dizilik listenin
        // 20.sinde iken) ekranın en üste sıçramaması için: içerik boyutu
        // değiştiğinde RN kullanıcının o an gördüğü konumu sabit tutar.
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#ffffff"
            colors={['#ffffff']}
            progressBackgroundColor="#262626"
          />
        }
        ListEmptyComponent={<Text style={styles.emptyText}>{emptyLabel}</Text>}
      />

      {showOverlay && activeSection != null && (
        <SectionHeader
          // `key`: bölüm değiştiğinde bileşen sıfırdan kurulur, böylece şevron
          // yeni bölümün açık/kapalı durumunda DOĞRU açıyla başlar (aksi halde
          // bölüm değişiminde gereksiz bir dönme animasyonu oynardı).
          key={activeSection.key}
          sectionKey={activeSection.key}
          title={activeSection.title}
          count={activeSection.count}
          collapsed={activeSection.collapsed}
          onToggle={handleToggle}
          wrapperStyle={styles.stickyOverlay}
        />
      )}
    </View>
  );
}

export default memo(TrackingAccordionList);

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { flex: 1, paddingHorizontal: 12 },
  content: { paddingTop: CONTENT_TOP_PADDING },
  // `list`teki `paddingHorizontal: 12`, başlık zemininin sol/sağ kenarlara
  // kadar UZANMASINI engeller (dar bir şerit boşluk kalır, altındaki kart
  // oradan sızabilir). `marginHorizontal: -12` ile üst kapsayıcının padding'i
  // iptal edilip zemin tam genişliğe yayılır, ardından `paddingHorizontal: 12`
  // ile başlığın iç hizası BİREBİR eskisiyle aynı kalacak şekilde geri eklenir.
  categoryHeaderWrapper: {
    backgroundColor: '#0B1120',
    marginHorizontal: -12,
    paddingHorizontal: 12,
  },
  // Yapışkan overlay: listenin KARDEŞİ, `container`a göre mutlak konumlu.
  // Kapsayıcısının yatay padding'i olmadığı için burada negatif margin'e gerek
  // yok — doğrudan `paddingHorizontal: 12` ile listedeki başlıkla birebir aynı
  // yatay hizaya oturur. `zIndex` (iOS/web) + `elevation` (Android) dokunuşun
  // alttaki karta değil başlığa gitmesini garanti eder; `shadowColor:
  // 'transparent'` ise `elevation`ın Android'de çizeceği gölgeyi bastırarak
  // mevcut tasarımın görünümünü birebir korur.
  stickyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0B1120',
    paddingHorizontal: 12,
    zIndex: 999,
    elevation: 10,
    shadowColor: 'transparent',
    shadowOpacity: 0,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  categoryHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  categoryIconBox: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  categoryTitle: { color: '#f8fafc', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
  badgeContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 10,
    minWidth: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#cbd5e1', fontSize: 12, fontWeight: '700' },
  emptyText: { color: '#64748b', textAlign: 'center', paddingVertical: 20, fontStyle: 'italic' },
});
