import React from 'react';
import { View, Text } from 'react-native';
import { Redirect } from 'expo-router';

export default function ViewAllMobileScreen() {
  // Mobile users should never reach this route, but we need this file
  // to satisfy Expo Router's multi-platform file requirements.
  return <Redirect href="/" />;
}
