import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Inbox } from '../icons';

interface EmptyStateProps {
  title: string;
  text: string;
}

// Performans ve Hata Günlüğü sekmelerinin İKİSİNDE de kullanılan ortak boş
// durum kartı — eskiden error-log.tsx'te tek kullanımlıktı, artık iki sekme
// arasında paylaşılıyor.
const EmptyState = memo(({ title, text }: EmptyStateProps) => (
  <View style={styles.centered}>
    <View style={styles.emptyIconWrap}>
      <Inbox size={36} color="#334155" />
    </View>
    <Text style={styles.emptyTitle}>{title}</Text>
    <Text style={styles.emptyText}>{text}</Text>
  </View>
));

export default EmptyState;

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  emptyTitle: {
    color: '#f1f5f9',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
