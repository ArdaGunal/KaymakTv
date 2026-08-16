import { Stack } from 'expo-router';

export default function PublicLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#171717' } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="gizlilik" />
      <Stack.Screen name="kullanim-kosullari" />
      <Stack.Screen name="hesap-sil" />
    </Stack>
  );
}
