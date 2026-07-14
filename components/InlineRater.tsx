import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Star } from 'lucide-react-native';

interface InlineRaterProps {
  onRate: (rating: number) => Promise<void>;
  initialRating?: number;
}

export default function InlineRater({ onRate, initialRating = 0 }: InlineRaterProps) {
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(initialRating);

  const handleRate = async (rating: number) => {
    setSelected(rating);
    setLoading(true);
    try {
      await onRate(rating);
    } catch (e) {
      console.error(e);
      setSelected(initialRating);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Puanla:</Text>
      {loading ? (
        <ActivityIndicator size="small" color="#3b82f6" style={{ marginLeft: 8 }} />
      ) : (
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((star) => {
            const ratingVal = star * 2;
            const isFilled = selected >= ratingVal;
            return (
              <TouchableOpacity key={star} onPress={() => handleRate(ratingVal)} style={styles.starBtn}>
                <Star 
                  size={18} 
                  color={isFilled ? "#fbbf24" : "#525252"} 
                  fill={isFilled ? "#fbbf24" : "transparent"} 
                />
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#172033',
  },
  label: {
    color: '#a3a3a3',
    fontSize: 12,
    marginRight: 8,
  },
  stars: {
    flexDirection: 'row',
    gap: 6,
  },
  starBtn: {
    padding: 2,
  }
});
