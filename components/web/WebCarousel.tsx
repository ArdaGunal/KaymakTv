import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Animated } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

interface WebCarouselProps {
  title: string;
  data: any[];
  renderItem: (info: {item: any, index: number}) => React.ReactElement;
  viewAllText?: string;
  onViewAll?: () => void;
}

export default function WebCarousel({ title, data, renderItem, viewAllText = "Tümünü Gör", onViewAll }: WebCarouselProps) {
  const flatListRef = useRef<FlatList>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(data.length > 5); // Rough estimate, updated on content size change
  const [isHovered, setIsHovered] = useState(false);
  
  const offsetRef = useRef(0);
  const layoutWidthRef = useRef(0);
  const contentWidthRef = useRef(0);

  const handleScroll = (event: any) => {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
    offsetRef.current = contentOffset.x;
    layoutWidthRef.current = layoutMeasurement.width;
    contentWidthRef.current = contentSize.width;
    
    setShowLeftArrow(contentOffset.x > 20);
    setShowRightArrow(contentOffset.x + layoutMeasurement.width < contentSize.width - 20);
  };

  const handleContentSizeChange = (w: number) => {
    contentWidthRef.current = w;
    if (layoutWidthRef.current > 0) {
      setShowRightArrow(offsetRef.current + layoutWidthRef.current < w - 20);
    }
  };

  const handleLayout = (event: any) => {
    layoutWidthRef.current = event.nativeEvent.layout.width;
    if (contentWidthRef.current > 0) {
      setShowRightArrow(offsetRef.current + layoutWidthRef.current < contentWidthRef.current - 20);
    }
  };

  const scrollLeft = () => {
    const scrollAmount = layoutWidthRef.current * 0.8; // Scroll 80% of visible width
    flatListRef.current?.scrollToOffset({
      offset: Math.max(0, offsetRef.current - scrollAmount),
      animated: true,
    });
  };

  const scrollRight = () => {
    const scrollAmount = layoutWidthRef.current * 0.8;
    flatListRef.current?.scrollToOffset({
      offset: Math.min(contentWidthRef.current - layoutWidthRef.current, offsetRef.current + scrollAmount),
      animated: true,
    });
  };

  if (!data || data.length === 0) return null;

  return (
    <View 
      style={styles.carouselSection}
      // @ts-ignore - Web specific
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <View style={styles.headerRow}>
        <Text style={styles.categoryTitle}>{title}</Text>
        
        {onViewAll && (
          <Pressable 
            onPress={onViewAll} 
            // @ts-ignore
            style={({hovered}) => [styles.viewAllButton, hovered && styles.viewAllHovered]}
          >
            <ChevronRight color="#a3a3a3" size={24} />
          </Pressable>
        )}
      </View>

      <View style={styles.listContainer}>
        <FlatList
          ref={flatListRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          data={data}
          keyExtractor={(item, index) => (item.id ? item.id.toString() : index.toString())}
          renderItem={renderItem}
          contentContainerStyle={{ paddingRight: 32 }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onContentSizeChange={handleContentSizeChange}
          onLayout={handleLayout}
        />

        {/* Left Arrow */}
        {showLeftArrow && (
          <Pressable 
            style={[styles.arrowButton, styles.leftArrow, { opacity: isHovered ? 1 : 0 }]} 
            onPress={scrollLeft}
          >
            <ChevronLeft color="#fff" size={32} />
          </Pressable>
        )}

        {/* Right Arrow */}
        {showRightArrow && (
          <Pressable 
            style={[styles.arrowButton, styles.rightArrow, { opacity: isHovered ? 1 : 0 }]} 
            onPress={scrollRight}
          >
            <ChevronRight color="#fff" size={32} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  carouselSection: {
    marginBottom: 40,
    position: 'relative',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 16,
    paddingRight: 16, // to align view all nicely if there's an arrow
  },
  categoryTitle: { 
    color: '#f8fafc', 
    fontSize: 24, 
    fontWeight: 'bold', 
    letterSpacing: 0.5,
  },
  viewAllButton: {
    padding: 4,
    borderRadius: 20,
    ...( { cursor: 'pointer', transition: 'all 0.2s ease' } as any)
  },
  viewAllHovered: {
    backgroundColor: '#1f2937',
  },
  listContainer: {
    position: 'relative',
  },
  arrowButton: {
    position: 'absolute',
    top: '40%', // Roughly vertically centered on the poster
    transform: [{ translateY: -24 }], // half of its height
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
    transition: 'opacity 0.3s ease, background-color 0.2s ease',
    // @ts-ignore
    cursor: 'pointer',
  } as any,
  leftArrow: {
    left: -20, // Pull out slightly
  },
  rightArrow: {
    right: 12, // Pull out slightly
  }
});
