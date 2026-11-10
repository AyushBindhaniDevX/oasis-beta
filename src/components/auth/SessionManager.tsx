import React, { useEffect, useRef, useState } from 'react';
import { View, PanResponder, Platform } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { usePathname } from 'expo-router';

const IDLE_TIMEOUT_MS = __DEV__ ? 120 * 60 * 1000 : 30 * 60 * 1000; // 2 hours in development, 30 min in production

export function SessionManager({ children }: { children: React.ReactNode }) {
  const { signOut, user } = useAuth();
  let pathname = '';
  try {
    pathname = usePathname();
  } catch {
    pathname = '';
  }
  const timerRef = useRef<any>(null);

  const resetTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (user && pathname !== '/login') {
      timerRef.current = setTimeout(() => {
        console.log('User idle for too long, logging out...');
        signOut();
      }, IDLE_TIMEOUT_MS);
    }
  };

  useEffect(() => {
    resetTimer();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [user, pathname]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => {
        resetTimer();
        return false;
      },
      onMoveShouldSetPanResponderCapture: () => {
        resetTimer();
        return false;
      }
    })
  ).current;

  // Web fallback for mouse movements/keys
  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleActivity = () => resetTimer();
      window.addEventListener('mousemove', handleActivity);
      window.addEventListener('keydown', handleActivity);
      window.addEventListener('scroll', handleActivity);
      window.addEventListener('click', handleActivity);
      return () => {
        window.removeEventListener('mousemove', handleActivity);
        window.removeEventListener('keydown', handleActivity);
        window.removeEventListener('scroll', handleActivity);
        window.removeEventListener('click', handleActivity);
      };
    }
  }, [user, pathname]);

  return (
    <View style={{ flex: 1 }} {...panResponder.panHandlers}>
      {children}
    </View>
  );
}
