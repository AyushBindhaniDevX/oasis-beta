import { Stack, Redirect, useSegments } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { LoadingState } from '@/components/ui/States';
import { View } from 'react-native';

export default function AdminLayout() {
  const { isAuthenticated, isLoading, role, profile } = useAuth();
  const segments = useSegments();

  if (isLoading) return <View style={{ flex: 1 }}><LoadingState /></View>;
  if (!isAuthenticated || !profile || profile.is_active === false) return <Redirect href="/(auth)/login" />;
  
  // Allow both Admin and HR roles into AdminLayout
  if (role !== 'admin' && role !== 'hr') return <Redirect href="/(employee)/dashboard" />;

  // Restrict HR users strictly to user/employee management routes
  if (role === 'hr') {
    const isUsersRoute = (segments as string[]).includes('users');
    if (!isUsersRoute) {
      return <Redirect href="/(hr)/dashboard" />;
    }
  }

  return <Stack screenOptions={{ headerShown: false, gestureEnabled: false, animation: 'fade' }} />;
}

