import { Stack, Redirect } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';

export default function AuthLayout() {
  const { isAuthenticated, role } = useAuth();

  if (isAuthenticated) {
    if (role === 'admin') return <Redirect href="/(admin)/dashboard" />;
    if (role === 'hr') return <Redirect href="/(hr)/dashboard" />;
    return <Redirect href="/(employee)/dashboard" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
        fullScreenGestureEnabled: false,
        animation: 'fade',
      }}
    />
  );
}
