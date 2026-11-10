import { Stack, Redirect } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { LoadingState } from '@/components/ui/States';
import { View } from 'react-native';

export default function HRLayout() {
  const { isAuthenticated, isLoading, role, profile } = useAuth();

  if (isLoading) return <View style={{ flex: 1 }}><LoadingState /></View>;
  if (!isAuthenticated || !profile || profile.is_active === false || !profile.organization_id) {
    return <Redirect href="/(auth)/login" />;
  }
  if (role !== 'hr' && role !== 'admin') return <Redirect href="/(employee)/dashboard" />;

  return <Stack screenOptions={{ headerShown: false, gestureEnabled: false, fullScreenGestureEnabled: false, animation: 'fade' }} />;
}
