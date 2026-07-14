import React, { useRef, useState } from 'react';
import { View, PanResponder, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Star } from 'lucide-react-native';

interface StarSliderProps {
  initialRating?: number | null; // 1 to 10
  onRate: (rating: number) => void;
  onRemove?: () => void;
}

export default function StarSlider({ initialRating, onRate, onRemove }: StarSliderProps) {
  const [rating, setRating] = useState<number>(initialRating || 5);
  const containerWidthRef = useRef<number>(0);

  React.useEffect(() => {
    if (initialRating) {
      setRating(initialRating);
    }
  }, [initialRating]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        handleTouch(evt.nativeEvent.locationX);
      },
      onPanResponderMove: (evt) => {
        handleTouch(evt.nativeEvent.locationX);
      },
      onPanResponderRelease: () => {
        // Could auto-save here, but explicit button is safer for UX
      }
    })
  ).current;

  const handleTouch = (x: number) => {
    const width = containerWidthRef.current;
    if (width === 0) return;
    const clampedX = Math.max(0, Math.min(x, width));
    
    // 5 stars total. So we map width to 10 steps.
    const stepWidth = width / 10;
    let newRating = Math.ceil(clampedX / stepWidth);
    
    if (newRating < 1) newRating = 1;
    if (newRating > 10) newRating = 10;
    
    setRating(newRating);
  };

  const renderStars = () => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      const isFull = rating >= i * 2;
      const isHalf = rating === i * 2 - 1;
      
      stars.push(
        <View key={i} style={styles.starWrapper} pointerEvents="none">
          {isFull ? (
             <Star size={44} color="#f59e0b" fill="#f59e0b" />
          ) : isHalf ? (
             <View style={{position: 'relative'}}>
                <Star size={44} color="#404040" fill="transparent" />
                <View style={{position: 'absolute', left: 0, top: 0, width: '50%', overflow: 'hidden'}}>
                  <Star size={44} color="#f59e0b" fill="#f59e0b" />
                </View>
             </View>
          ) : (
             <Star size={44} color="#404040" fill="transparent" />
          )}
        </View>
      );
    }
    return stars;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.ratingText}>{(rating / 2).toFixed(1)} / 5.0</Text>
      
      <View 
        style={styles.starsContainer}
        onLayout={(e) => {
          containerWidthRef.current = e.nativeEvent.layout.width;
        }}
        {...panResponder.panHandlers}
      >
        {renderStars()}
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={() => onRate(rating)}>
        <Text style={styles.saveButtonText}>Puanı Kaydet</Text>
      </TouchableOpacity>
      
      {initialRating && onRemove && (
        <TouchableOpacity style={styles.removeButton} onPress={onRemove}>
          <Text style={styles.removeButtonText}>Puanı Kaldır</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
  },
  ratingText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 20,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 30,
    width: '100%',
  },
  starWrapper: {
    paddingHorizontal: 4,
  },
  saveButton: {
    backgroundColor: '#3b82f6',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  removeButton: {
    paddingVertical: 12,
  },
  removeButtonText: {
    color: '#ef4444',
    fontSize: 15,
  }
});
