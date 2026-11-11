import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Calendar, List, Search } from '../icons';
import { MOBILE_PALETTE as p } from '../../constants/mobilePalette';

const features = [
  { title: 'viewingDiary', description: 'viewingDiaryDesc', Icon: Calendar },
  { title: 'personalLists', description: 'personalListsDesc', Icon: List },
  { title: 'fastSearchTitle', description: 'fastSearchDesc', Icon: Search },
];

export default function BentoGrid() {
  const { t } = useTranslation('common');
  const { width } = useWindowDimensions();
  const wide = width >= 768;
  return (
    <View style={styles.section}>
      <Text style={styles.title}>{t('oneApp')}</Text>
      <Text style={styles.subtitle}>{t('featuresSectionSub')}</Text>
      <View style={[styles.grid, wide && styles.wide]}>
        {features.map(({ title, description, Icon }) => (
          <View key={title} style={[styles.card, wide && styles.wideCard]}>
            <View style={styles.icon}><Icon size={22} color={p.steel} /></View>
            <View style={styles.copy}>
              <Text style={styles.cardTitle}>{t(title)}</Text>
              <Text style={styles.description}>{t(description)}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal:20, paddingVertical:24, alignItems:'center' },
  title: { color:p.text, fontSize:25, fontWeight:'700', textAlign:'center', marginBottom:8 },
  subtitle: { color:p.muted, fontSize:15, textAlign:'center', marginBottom:24 },
  grid: { width:'100%', maxWidth:1040, gap:12 },
  wide: { flexDirection:'row' },
  card: { backgroundColor:p.surface, borderColor:p.border, borderWidth:1, borderRadius:18, padding:20, flexDirection:'row', gap:16 },
  wideCard: { flex:1, flexDirection:'column' },
  icon: { width:44, height:44, borderRadius:12, backgroundColor:p.steelTint, alignItems:'center', justifyContent:'center' },
  copy: { flex:1 },
  cardTitle: { color:p.text, fontSize:18, fontWeight:'700', marginBottom:7 },
  description: { color:p.muted, fontSize:14, lineHeight:22 },
});
