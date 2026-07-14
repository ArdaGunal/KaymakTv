import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle, Platform } from 'react-native';

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: ViewStyle | ViewStyle[];
}

export default function SkeletonLoader({ 
  width = '100%', 
  height = 20, 
  borderRadius = 4, 
  style 
}: SkeletonLoaderProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: Platform.OS !== 'web',
          isInteraction: false,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: Platform.OS !== 'web',
          isInteraction: false,
        })
      ])
    ).start();
  }, [opacity]);

  return (
    <Animated.View 
      style={[
        styles.skeleton, 
        { width: width as any, height: height as any, borderRadius }, 
        style
      ]} 
    />
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#3f3f46', // Zinc 700
  }
});
