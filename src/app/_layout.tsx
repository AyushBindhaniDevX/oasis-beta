import 'react-native-url-polyfill/auto';
import '@/utils/mediaDevicesPolyfill';
import { Redirect, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { TenantProvider } from '@/context/TenantContext';
import { SessionManager } from '@/components/auth/SessionManager';
import { NotificationProvider } from '@/context/NotificationContext';
import { ForcePasswordChangeModal } from '@/components/auth/ForcePasswordChangeModal';
import { GluestackUIProvider } from '@gluestack-ui/themed';
import { config } from '@gluestack-ui/config';

import { View, Text, TouchableOpacity, Platform } from 'react-native';

// Immediately hide splash screen to avoid black splash / logo delay
SplashScreen.hideAsync().catch(() => {});

const queryClient = new QueryClient();

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#FFFFFF' }}>
      <Text style={{ fontSize: 20, fontWeight: '700', color: '#1E293B', marginBottom: 8 }}>
        Something went wrong
      </Text>
      <Text style={{ fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 24 }}>
        {error?.message || 'An unexpected error occurred. Please try again.'}
      </Text>
      <TouchableOpacity
        onPress={retry}
        style={{ backgroundColor: '#0D7377', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
      >
        <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}

function AuthLayoutWrapper({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Ensure native splash is hidden immediately
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <>
      {children}
      <ForcePasswordChangeModal />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <BottomSheetModalProvider>
            <GluestackUIProvider config={config}>
              <AuthProvider>
                <TenantProvider>
                  <NotificationProvider>
                    <AuthLayoutWrapper>
                      <SessionManager>
                        <Stack
                          screenOptions={{
                            headerShown: false,
                            gestureEnabled: false,
                            fullScreenGestureEnabled: false,
                            animation: Platform.OS === 'web' ? 'none' : 'fade',
                          }}
                        >
                          <Stack.Screen name="index" />
                          <Stack.Screen name="careers" />
                          <Stack.Screen name="(auth)" />
                          <Stack.Screen name="(employee)" />
                          <Stack.Screen name="(hr)" />
                          <Stack.Screen name="(admin)" />
                        </Stack>
                      </SessionManager>
                    </AuthLayoutWrapper>
                  </NotificationProvider>
                </TenantProvider>
              </AuthProvider>
            </GluestackUIProvider>
          </BottomSheetModalProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

