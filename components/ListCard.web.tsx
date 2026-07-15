import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { List as ListIcon } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export default function ListCard({ data }: { data: any }) {
  const router = useRouter();

  return (
    <TouchableOpacity 
      style={styles.container}
      activeOpacity={0.8}
      // @ts-ignore
      onPress={() => router.push(`/list/${data.id}?name=${encodeURIComponent(data.title)}`)}
    >
      <View style={styles.listCard}>
        <View style={styles.listImageContainer}>
          <View style={styles.listPlaceholder}>
            <ListIcon color="#4b5563" size={32} />
          </View>
          <View style={styles.listHoverOverlay} {...{ className: 'hover-overlay' }} />
        </View>
        <Text style={styles.listTitle} numberOfLines={2}>{data.title}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginRight: 16,
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  listCard: {
    width: 180,
    ...( { cursor: 'pointer', transition: 'transform 0.3s ease' } as any)
  },
  listImageContainer: {
    width: 180,
    height: 180,
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
    textAlign: 'center',
    marginTop: 8
  }
});
