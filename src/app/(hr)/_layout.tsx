import { Stack, Redirect, usePathname } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { LoadingState } from '@/components/ui/States';
import { View } from 'react-native';

export default function HRLayout() {
  const { isAuthenticated, isLoading, role, profile } = useAuth();
  const pathname = usePathname();
  const isTemplates = pathname ? pathname.includes('templates') : false;

  if (isLoading) return <View style={{ flex: 1 }}><LoadingState /></View>;
  if (!isAuthenticated || !profile || profile.is_active === false) return <Redirect href="/(auth)/login" />;
  if (role !== 'hr' && role !== 'admin' && !isTemplates) return <Redirect href="/(employee)/dashboard" />;

  return <Stack screenOptions={{ headerShown: false, gestureEnabled: false, animation: 'fade' }} />;
}
