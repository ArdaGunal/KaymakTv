import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import { Star } from 'lucide-react-native';
import StarSlider from './StarSlider';
import { useTranslation } from 'react-i18next';

interface InlineRaterProps {
  onRate: (rating: number) => Promise<void>;
  initialRating?: number;
  onRemove?: () => Promise<void>;
}

export default function InlineRater({ onRate, initialRating = 0, onRemove }: InlineRaterProps) {
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(initialRating);
  const [modalVisible, setModalVisible] = useState(false);
  const { t } = useTranslation(['common']);

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleRate = async (rating: number) => {
    setSelected(rating);
    setLoading(true);
    setModalVisible(false);
    try {
      await onRate(rating);
    } catch (e) {
      console.error(e);
      if (isMounted.current) setSelected(initialRating);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };
  
  const handleRemove = async () => {
    if (!onRemove) return;
    setSelected(0);
    setLoading(true);
    setModalVisible(false);
    try {
      await onRemove();
    } catch (e) {
      console.error(e);
      if (isMounted.current) setSelected(initialRating);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  return (
    <>
      <View style={styles.container}>
        <Text style={styles.label}>{t('rate', 'Puanla')}:</Text>
        {loading ? (
          <ActivityIndicator size="small" color="#3b82f6" style={{ marginLeft: 8 }} />
        ) : (
          <TouchableOpacity 
            style={[styles.userRatingBadge, selected > 0 ? styles.userRatingActive : null]} 
            activeOpacity={0.7}
            onPress={() => setModalVisible(true)}
          >
            <Star size={14} color={selected > 0 ? "#3b82f6" : "#a3a3a3"} fill={selected > 0 ? "#3b82f6" : "transparent"} />
            <Text style={[styles.userRatingText, selected > 0 ? styles.userRatingTextActive : null]}>
              {selected > 0 ? `${(selected / 2).toFixed(1)}/5` : t('rate', 'Puanla')}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <Modal visible={modalVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <Pressable style={styles.modalContentWrapper} onPress={(e) => e.stopPropagation()}>
            <BlurView intensity={90} tint="dark" style={styles.modalContent}>
              <Text style={styles.modalTitle}>{t('giveRating', 'Puan Ver')}</Text>
              <StarSlider 
                initialRating={selected} 
                onRate={handleRate} 
                onRemove={selected > 0 && onRemove ? handleRemove : undefined}
              />
            </BlurView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
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
  userRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(163, 163, 163, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(163, 163, 163, 0.2)',
  },
  userRatingActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  userRatingText: {
    color: '#a3a3a3',
    fontWeight: '500',
    fontSize: 13,
    marginLeft: 6,
  },
  userRatingTextActive: {
    color: '#3b82f6',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContentWrapper: {
    borderRadius: 24,
    overflow: 'hidden',
    width: '100%',
    maxWidth: 360,
  },
  modalContent: {
    backgroundColor: 'rgba(23, 32, 51, 0.7)',
    padding: 24,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
});
