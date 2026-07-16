import React from 'react';
import { View, StyleSheet, Platform, ViewProps } from 'react-native';

interface ProgressBarProps {
  percentage: number;
  height?: number;
  trackColor?: string;
  fillColor?: string;
  style?: any;
}

export default function ProgressBar({
  percentage,
  height = 4,
  trackColor = 'rgba(255, 255, 255, 0.1)',
  fillColor = '#3b82f6', // App accent color
  style
}: ProgressBarProps) {
  // Clamp percentage between 0 and 100
  const safePercentage = Math.min(100, Math.max(0, percentage));
  const roundedPercentage = Math.round(safePercentage);

  // For web, use the 'title' attribute to show tooltip on hover
  const webProps = Platform.OS === 'web' ? { title: `%${roundedPercentage} İzlendi` } : {};

  return (
    <View 
      style={[
        styles.track, 
        { height, backgroundColor: trackColor }, 
        style
      ]}
      {...(webProps as ViewProps)}
    >
      <View 
        style={[
          styles.fill, 
          { 
            height, 
            backgroundColor: fillColor, 
            width: `${safePercentage}%` 
          }
        ]} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    borderRadius: 99,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: 99,
  }
});
