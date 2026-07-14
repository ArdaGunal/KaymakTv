import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { List as ListIcon } from 'lucide-react-native';

export default function ListCard({ data }: { data: any }) {
  return (
    <TouchableOpacity 
      style={styles.listCard}
      activeOpacity={0.8}
      // @ts-ignore
      onPress={() => console.log('List clicked:', data.id)}
    >
      <View style={styles.listImageContainer}>
        <View style={styles.listPlaceholder}>
          <ListIcon color="#4b5563" size={32} />
        </View>
        <View style={styles.listHoverOverlay} {...{ className: 'hover-overlay' }} />
      </View>
      <Text style={styles.listTitle} numberOfLines={2}>{data.title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  listCard: {
    width: '100%',
    ...( { cursor: 'pointer', transition: 'transform 0.3s ease' } as any)
  },
  listImageContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1f2937',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  listHoverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0)',
    ...( { transition: 'background-color 0.3s ease' } as any)
  },
  listTitle: {
    color: '#e5e7eb', 
    fontSize: 14, 
    fontWeight: '500',
    textAlign: 'center'
  }
});
