import React, { useState } from 'react';
import { Text, TouchableOpacity, StyleSheet, View, StyleProp, TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

interface ExpandableTextProps {
  text: string;
  style?: StyleProp<TextStyle>;
  limit?: number; // character limit
}

export default function ExpandableText({ text, style, limit = 160 }: ExpandableTextProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { t } = useTranslation('common');

  if (!text) return null;

  if (text.length <= limit) {
    return <Text style={style}>{text}</Text>;
  }

  return (
    <View>
      <Text style={style}>
        {isExpanded ? text : `${text.substring(0, limit)}...`}
      </Text>
      <TouchableOpacity 
        onPress={() => setIsExpanded(!isExpanded)} 
        activeOpacity={0.7} 
        style={styles.toggleBtn}
      >
        <Text style={[styles.toggleText, { color: (StyleSheet.flatten(style)?.color as string) || '#cbd5e1' }]}>
          {isExpanded ? t('showLess', 'Daha az göster') : t('readMore', 'Devamını göster')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  toggleBtn: {
    marginTop: 4,
    alignSelf: 'flex-start',
    paddingVertical: 2,
    paddingRight: 8,
  },
  toggleText: {
    fontWeight: 'bold',
    opacity: 0.9,
  },
});
