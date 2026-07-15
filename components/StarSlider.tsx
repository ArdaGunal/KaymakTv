import React, { useRef, useState } from 'react';
import { View, PanResponder, StyleSheet, Text, TouchableOpacity, Platform } from 'react-native';
import { Star } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';

interface StarSliderProps {
  initialRating?: number | null; // 1 to 10
  onRate: (rating: number) => void;
  onRemove?: () => void;
}

export default function StarSlider({ initialRating, onRate, onRemove }: StarSliderProps) {
  const [rating, setRating] = useState<number>(initialRating || 5);
  const containerWidthRef = useRef<number>(0);
  const panState = useRef({ isPanning: false, currentX: 0 });
  const { t } = useTranslation(['common']);

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
        panState.current = { isPanning: false, currentX: evt.nativeEvent.locationX };
      },
      onPanResponderMove: (evt, gestureState) => {
        if (Math.abs(gestureState.dx) > 10 || Math.abs(gestureState.dy) > 10) {
          panState.current.isPanning = true;
        }
        panState.current.currentX = evt.nativeEvent.locationX;
        if (panState.current.isPanning) {
          handleTouch(panState.current.currentX, false);
        }
      },
      onPanResponderRelease: () => {
        if (!panState.current.isPanning) {
          handleTouch(panState.current.currentX, true); // Tap -> Full Star
        }
      }
    })
  ).current;

  const handleTouch = (x: number, isTap: boolean) => {
    const width = containerWidthRef.current;
    if (width === 0) return;
    const clampedX = Math.max(0, Math.min(x, width));
    const stepWidth = width / 10;
    let newRating = Math.ceil(clampedX / stepWidth);
    
    if (newRating < 1) newRating = 1;
    if (newRating > 10) newRating = 10;

    if (isTap) {
      newRating = Math.ceil(newRating / 2) * 2; // snap to full star
    }
    
    setRating(prev => {
      if (prev !== newRating) {
        Haptics.selectionAsync();
      }
      return newRating;
    });
  };

  const getSentimentText = (val: number) => {
    if (val <= 2) return t('sentimentWaste', 'Zaman Kaybı');
    if (val <= 4) return t('sentimentBad', 'Pek İyi Değil');
    if (val <= 6) return t('sentimentAverage', 'Ortalama');
    if (val <= 8) return t('sentimentGood', 'Gerçekten İyi');
    return t('sentimentMasterpiece', 'Başyapıt!');
  };

  const renderStars = () => {
    const stars = [];
    const starColor = "#facc15"; // Yellow
    const shadowStyle = {
      textShadowColor: 'rgba(250, 204, 21, 0.5)',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 8,
    };
    const starSize = 36;

    for (let i = 1; i <= 5; i++) {
      const isFull = rating >= i * 2;
      const isHalf = rating === i * 2 - 1;
      
      stars.push(
        <View key={i} style={styles.starWrapper} pointerEvents="none">
          {isFull ? (
             <Star size={starSize} color={starColor} fill={starColor} style={shadowStyle as any} />
          ) : isHalf ? (
             <View style={{position: 'relative'}}>
                <Star size={starSize} color="#404040" fill="transparent" />
                <View style={{position: 'absolute', left: 0, top: 0, width: '50%', overflow: 'hidden'}}>
                  <Star size={starSize} color={starColor} fill={starColor} style={shadowStyle as any} />
                </View>
             </View>
          ) : (
             <Star size={starSize} color="#404040" fill="transparent" />
          )}
        </View>
      );
    }
    return stars;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.ratingText}>{(rating / 2).toFixed(1)} / 5.0</Text>
      <Text style={styles.sentimentText}>{getSentimentText(rating)}</Text>
      
      <View 
        style={[
          styles.starsContainer, 
          Platform.OS === 'web' && { touchAction: 'none', userSelect: 'none' } as any
        ]}
        onLayout={(e) => {
          containerWidthRef.current = e.nativeEvent.layout.width;
        }}
        {...panResponder.panHandlers}
      >
        {renderStars()}
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={() => onRate(rating)}>
        <Text style={styles.saveButtonText}>{t('saveRating', 'Puanı Kaydet')}</Text>
      </TouchableOpacity>
      
      {initialRating && onRemove && (
        <TouchableOpacity style={styles.removeButton} onPress={onRemove}>
          <Text style={styles.removeButtonText}>{t('removeRating', 'Puanı Kaldır')}</Text>
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
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  sentimentText: {
    fontSize: 14,
    color: '#d4d4d4',
    fontWeight: '500',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 20,
    width: '100%',
  },
  starWrapper: {
    paddingHorizontal: 4,
  },
  saveButton: {
    backgroundColor: '#3b82f6',
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  removeButton: {
    paddingVertical: 12,
  },
  removeButtonText: {
    color: '#ef4444',
    fontSize: 14,
  }
});
