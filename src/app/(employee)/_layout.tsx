import { OnboardingWizard } from '@/components/employee/OnboardingWizard';
import { BottomTabBar } from '@/components/layout/BottomTabBar';
import { SidebarLayout } from '@/components/layout/Sidebar';
import { LoadingState } from '@/components/ui/States';
import { T } from '@/constants/ui';
import { useAuth } from '@/hooks/useAuth';
import { getEmployeeByProfileId } from '@/lib/services/employee';
import type { Employee } from '@/types';
import { Redirect, Stack } from 'expo-router';
import { Banknote, CalendarClock, CalendarDays, LayoutDashboard, Users } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Platform, useWindowDimensions, View } from 'react-native';

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
      getEmployeeByProfileId(profile.id).then((emp) => {
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

  if (
    !isAuthenticated || !profile || profile.is_active === false ||
    !profile.organization_id || !['employee', 'hr', 'admin'].includes(profile.role)
  ) {
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
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
        fullScreenGestureEnabled: false,
        animation: Platform.OS === 'web' ? 'none' : 'fade',
        contentStyle: { backgroundColor: T.surfaceSoft },
      }}
    >
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
      <Stack.Screen name="learning/index" />
      <Stack.Screen name="assets/index" />
      <Stack.Screen name="helpdesk/index" />
      <Stack.Screen name="directory/index" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="notifications/index" />
    </Stack>
  );

  return <SidebarLayout>{stackContent}</SidebarLayout>;
}