import React, { useState, useEffect } from 'react';
import { Stack, Redirect } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { LoadingState } from '@/components/ui/States';
import { View, Platform, useWindowDimensions } from 'react-native';
import { SidebarLayout } from '@/components/layout/Sidebar';
import { BottomTabBar } from '@/components/layout/BottomTabBar';
import { LayoutDashboard, CalendarClock, CalendarDays, Banknote, Users } from 'lucide-react-native';
import { getEmployeeByProfileId } from '@/lib/services/employee';
import type { Employee } from '@/types';
import { OnboardingWizard } from '@/components/employee/OnboardingWizard';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/(employee)/dashboard', icon: LayoutDashboard },
  { label: 'Attendance', href: '/(employee)/attendance', icon: CalendarClock },
  { label: 'Leave', href: '/(employee)/leave', icon: CalendarDays },
  { label: 'Salary', href: '/(employee)/payslips', icon: Banknote },
  { label: 'Directory', href: '/(employee)/directory', icon: Users },
];

export default function EmployeeLayout() {
  const { isAuthenticated, isLoading, profile } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loadingEmp, setLoadingEmp] = useState(true);

  useEffect(() => {
    if (isAuthenticated && profile) {
      getEmployeeByProfileId(profile.id).then(emp => {
        setEmployee(emp);
        setLoadingEmp(false);
      });
    } else if (!isLoading) {
      setLoadingEmp(false);
    }
  }, [isAuthenticated, profile, isLoading]);

  if (isLoading || loadingEmp) {
    return <View style={{ flex: 1 }}><LoadingState /></View>;
  }

  if (!isAuthenticated || !profile || profile.is_active === false || !profile.organization_id || !['employee', 'hr', 'admin'].includes(profile.role)) {
    return <Redirect href="/(auth)/login" />;
  }

  const needsOnboarding = employee && !employee.onboarding_completed;

  if (needsOnboarding) {
    return (
      <View style={{ flex: 1 }}>
        <OnboardingWizard 
          employeeId={employee.id} 
          profileId={profile?.id || ''}
          onComplete={() => setEmployee({ ...employee, onboarding_completed: true })} 
        />
      </View>
    );
  }

  const stackContent = (
    <Stack screenOptions={{ 
      headerShown: false,
      gestureEnabled: false,
      animation: Platform.OS === 'web' ? 'none' : 'fade',
      contentStyle: { backgroundColor: '#F8FAFC' }
    }}>
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="attendance/index" />
      <Stack.Screen name="attendance/[id]" />
      <Stack.Screen name="leave/index" />
      <Stack.Screen name="leave/apply" />
      <Stack.Screen name="leave/[id]" />
      <Stack.Screen name="holidays/index" />
      <Stack.Screen name="performance/index" />
      <Stack.Screen name="payslips/index" />
      <Stack.Screen name="payslips/[id]" />
      <Stack.Screen name="expenses/index" />
      <Stack.Screen name="helpdesk/index" />
      <Stack.Screen name="directory/index" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="notifications/index" />
    </Stack>
  );

  if (isDesktop) {
    return <SidebarLayout>{stackContent}</SidebarLayout>;
  }

  return <BottomTabBar>{stackContent}</BottomTabBar>;
}
