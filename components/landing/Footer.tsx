import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function Footer() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>© 2026 KaymakTV. Tüm hakları saklıdır.</Text>
      <Text style={styles.subText}>Film ve diziler Trakt.tv ve TMDB aracılığıyla sağlanmaktadır.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 32,
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    width: '100%',
  },
  text: {
    color: '#64748b',
    fontSize: 14,
    marginBottom: 8,
  },
  subText: {
    color: '#475569',
    fontSize: 12,
  },
});
