import { Stack, Redirect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';

export default function ProtectedLayout() {
  const { accessToken, isGuest } = useAuth();

  if (!accessToken && !isGuest) {
    return <Redirect href="/" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#171717' } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="account" />
      <Stack.Screen name="error-log" />
    </Stack>
  );
}
