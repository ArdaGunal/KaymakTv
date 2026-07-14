import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet, ViewStyle, Platform } from 'react-native';

interface LoadingIndicatorProps {
  size?: number | 'small' | 'large';
  color?: string; // Kept for API compatibility with ActivityIndicator
  style?: ViewStyle | ViewStyle[];
}

export default function LoadingIndicator({ size = 'small', style }: LoadingIndicatorProps) {
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== 'web',
        isInteraction: false,
      })
    ).start();
  }, [spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Calculate equivalent pixel size based on ActivityIndicator standard sizes
  const imageSize = size === 'large' ? 48 : (typeof size === 'number' ? size : 24);

  return (
    <View style={[styles.container, style]}>
      <Animated.Image
        source={require('../assets/images/Thekaymak.png')}
        style={{
          width: imageSize,
          height: imageSize,
          transform: [{ rotate: spin }],
          resizeMode: 'contain',
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
