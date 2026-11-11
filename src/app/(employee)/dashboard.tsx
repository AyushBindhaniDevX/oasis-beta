import { InteractiveTile } from '@/components/ui/InteractiveTile';
import { useRouter } from 'expo-router';
import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  Building2,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Clock,
  CreditCard,
  LogIn,
  LogOut,
  MapPin,
  Shield,
  Laptop,
  GraduationCap,
  Receipt,
} from 'lucide-react-native';
import { useCallback, useEffect, useState, useMemo } from 'react';
import {
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, SvgXml } from 'react-native-svg';

import { FaceVerificationModal } from '@/components/attendance/FaceVerificationModal';
import { ScreenErrorFallback } from '@/components/ui/ScreenErrorBoundary';
import { LoadingState } from '@/components/ui/States';
import { fetchMobileDashboardBundle, invalidateMobileDashboardCache } from '@/lib/api/mobileClient';
import {
  STOCK_10_SVG,
  STOCK_12_SVG,
  STOCK_13_SVG,
  STOCK_1_SVG,
  STOCK_3_SVG,
  STOCK_4_SVG,
  STOCK_5_SVG,
  STOCK_6_SVG,
  STOCK_7_SVG,
  STOCK_8_SVG,
  STOCK_9_SVG,
} from '@/constants/workManagementSvgs';
import { useNotifications } from '@/context/NotificationContext';
import { useTenant } from '@/context/TenantContext';
import { useAuth } from '@/hooks/useAuth';
import { clockIn, clockOut, getTodayAttendance } from '@/lib/services/attendance';
import { getEmployeeByProfileId } from '@/lib/services/employee';
import { getLeaveBalances } from '@/lib/services/leave';
import { getCurrentLocation } from '@/lib/services/location';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import type { Attendance, Employee } from '@/types';
import { formatTime, getGreeting, formatCurrency } from '@/utils/format';

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return <ScreenErrorFallback error={error} retry={retry} />;
}

const FONT = Platform.select({
  ios: 'System',
  android: 'Roboto',
  web: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
}) as string;

/* ─── Metric Wave Graphic Primitive ──────────────────────────────────── */
function MetricWave({
  color = '#8B5CF6',
  width = 140,
  height = 28,
}: {
  color?: string;
  width?: number;
  height?: number;
}) {
  const d = `M 0 16 C 25 8, 45 24, 70 14 C 95 4, 115 22, ${width} 10`;
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none">
      <Path d={d} stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

export default function EmployeeDashboard() {
  const { profile } = useAuth();
  const { organization, employee: tenantEmp, workplace: tenantWp, companyLogoUrl } = useTenant();
  const activeOrgId = organization?.id || tenantEmp?.organization_id || profile?.organization_id;
  const { unreadCount } = useNotifications();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const isTablet = width >= 768 && width < 1024;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null);
  const [monthAttendanceRecords, setMonthAttendanceRecords] = useState<Attendance[]>([]);
  const [leaveBalanceTotal, setLeaveBalanceTotal] = useState<number>(14);
  const [assignedShift, setAssignedShift] = useState<{ name: string; start_time: string; end_time: string } | null>(null);
  const [clockLoading, setClockLoading] = useState(false);
  const [clockError, setClockError] = useState('');
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  const [showFaceModal, setShowFaceModal] = useState(false);
  const [faceModalType, setFaceModalType] = useState<'in' | 'out'>('in');
  const [pendingLoc, setPendingLoc] = useState<{ latitude: number; longitude: number }>({ latitude: 0, longitude: 0 });
  const [isRemoteClock, setIsRemoteClock] = useState(false);

  // Real-Time Firestore Synchronization
  useEffect(() => {
    if (!profile) return;
    let unsubEmployee: (() => void) | undefined;
    let unsubAttendance: (() => void) | undefined;
    let unsubTodayAttendance: (() => void) | undefined;

    async function initLiveDashboard() {
      try {
        // Fast Cached Bundle API: Instant render on mobile & web
        if (profile?.id) {
          try {
            const { bundle } = await fetchMobileDashboardBundle(profile.id, activeOrgId);
            if (bundle.employee) {
              setEmployee(bundle.employee);
              if (bundle.todayAttendance) setTodayAttendance(bundle.todayAttendance);
              if (bundle.monthRecords.length > 0) setMonthAttendanceRecords(bundle.monthRecords);
              if (bundle.leaveBalanceTotal) setLeaveBalanceTotal(bundle.leaveBalanceTotal);
              if (bundle.defaultShift) {
                setAssignedShift({
                  name: bundle.defaultShift.name,
                  start_time: bundle.defaultShift.start_time,
                  end_time: bundle.defaultShift.end_time,
                });
              }
              setLoading(false);
            }
          } catch (cacheErr) {
            console.warn('Mobile API cache bundle bypass:', cacheErr);
          }
        }

        const emp = tenantEmp || (profile?.id ? await getEmployeeByProfileId(profile.id, activeOrgId) : null);
        if (emp && !emp.workplace && tenantWp) emp.workplace = tenantWp;
        setEmployee(emp);

        if (emp) {
          // 1. Real-time Employee Document Listener
          unsubEmployee = onSnapshot(doc(db, 'employees', emp.id), (snap) => {
            if (snap.exists()) {
              const liveData = { id: snap.id, ...snap.data() } as Employee;
              setEmployee((prev) => {
                if (!prev) return liveData;
                return {
                  ...prev,
                  ...liveData,
                  workplace: (liveData.workplace || prev.workplace || tenantWp) || undefined,
                };
              });
            }
          });

          // 2. Real-time Today's Attendance Listener
          const todayStr = new Date().toISOString().split('T')[0];
          unsubTodayAttendance = onSnapshot(doc(db, 'attendance', `${emp.id}_${todayStr}`), (snap) => {
            if (snap.exists()) {
              setTodayAttendance({ id: snap.id, ...snap.data() } as Attendance);
            } else {
              setTodayAttendance(null);
            }
          });

          // 3. Real-time Month's Attendance Records Listener
          const qAttendance = query(
            collection(db, 'attendance'),
            where('employee_id', '==', emp.id)
          );
          unsubAttendance = onSnapshot(qAttendance, (snapshot) => {
            const records: Attendance[] = [];
            snapshot.forEach((d) => records.push({ id: d.id, ...d.data() } as Attendance));
            setMonthAttendanceRecords(records);
          });

          // 4. Real-time Leave Balance Query
          try {
            const year = new Date().getFullYear();
            const balances = await getLeaveBalances(emp.id, year, activeOrgId);
            const totalRemaining = balances.reduce((sum, b) => sum + (b.remaining_days || 0), 0);
            setLeaveBalanceTotal(totalRemaining);
          } catch (e) {
            console.warn('Error fetching leave balances:', e);
          }

          // 5. Shift Schedule Lookup
          if (emp.default_shift_id) {
            try {
              const shiftSnap = await getDoc(doc(db, 'shifts', emp.default_shift_id));
              if (shiftSnap.exists()) {
                const sData = shiftSnap.data() as any;
                setAssignedShift({
                  name: sData.name || 'Regular Shift',
                  start_time: sData.start_time || '09:00 AM',
                  end_time: sData.end_time || '06:00 PM',
                });
              }
            } catch {}
          }
        }
      } catch (err) {
        console.error('Live dashboard init error:', err);
      } finally {
        setLoading(false);
      }
    }

    initLiveDashboard();

    return () => {
      if (unsubEmployee) unsubEmployee();
      if (unsubAttendance) unsubAttendance();
      if (unsubTodayAttendance) unsubTodayAttendance();
    };
  }, [profile, activeOrgId, tenantEmp, tenantWp]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (employee) {
      try {
        const year = new Date().getFullYear();
        const balances = await getLeaveBalances(employee.id, year, activeOrgId);
        const totalRemaining = balances.reduce((sum, b) => sum + (b.remaining_days || 0), 0);
        setLeaveBalanceTotal(totalRemaining);
        const today = await getTodayAttendance(employee.id);
        setTodayAttendance(today);
      } catch {}
    }
    setRefreshing(false);
  };

  const handleClock = async (type: 'in' | 'out') => {
    setClockError('');
    setClockLoading(true);
    try {
      let loc = userLocation;
      try {
        loc = await getCurrentLocation();
        setUserLocation(loc);
      } catch {
        loc = { latitude: 0, longitude: 0 };
      }
      const activeLoc = loc || { latitude: 0, longitude: 0 };
      setPendingLoc(activeLoc);
      setIsRemoteClock(false);

      // On Web: Execute punch directly with instantaneous feedback (no modal barrier)
      if (Platform.OS === 'web') {
        const result =
          type === 'in'
            ? await clockIn(activeLoc.latitude, activeLoc.longitude, 'web_verified', profile?.id, { isRemote: false })
            : await clockOut(activeLoc.latitude, activeLoc.longitude, 'web_verified', profile?.id);

        if (!result.success) {
          setClockError(result.message || 'Operation failed');
        } else if (profile?.id) {
          invalidateMobileDashboardCache(profile.id, activeOrgId);
        }
        return;
      }

      // On Native Mobile: Check for enrolled biometrics (Face ID / Fingerprint)
      try {
        const LocalAuthentication = await import('expo-local-authentication');
        const hasHw = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();

        if (hasHw && isEnrolled) {
          const bioResult = await LocalAuthentication.authenticateAsync({
            promptMessage: `Verify identity to Clock ${type === 'in' ? 'In' : 'Out'}`,
            cancelLabel: 'Cancel',
            disableDeviceFallback: false,
          });

          if (!bioResult.success) {
            if (bioResult.error !== 'user_cancel' && bioResult.error !== 'app_cancel') {
              setClockError('Biometric verification failed.');
            }
            return;
          }
        }
      } catch (bioErr) {
        console.warn('Native biometric check skipped:', bioErr);
      }

      // Record punch directly
      const result =
        type === 'in'
          ? await clockIn(activeLoc.latitude, activeLoc.longitude, 'device_biometric_verified', profile?.id, { isRemote: false })
          : await clockOut(activeLoc.latitude, activeLoc.longitude, 'device_biometric_verified', profile?.id);

      if (!result.success) {
        setClockError(result.message || 'Operation failed');
      } else if (profile?.id) {
        invalidateMobileDashboardCache(profile.id, activeOrgId);
      }
    } catch (err) {
      setClockError(err instanceof Error ? err.message : 'Failed to prepare clocking.');
    } finally {
      setClockLoading(false);
    }
  };

  const handleFaceVerified = async (faceSnapshot?: string) => {
    setClockLoading(true);
    try {
      const loc = pendingLoc || { latitude: 0, longitude: 0 };
      const result =
        faceModalType === 'in'
          ? await clockIn(loc.latitude, loc.longitude, faceSnapshot, profile?.id, { isRemote: isRemoteClock })
          : await clockOut(loc.latitude, loc.longitude, faceSnapshot, profile?.id);

      if (!result.success) {
        setClockError(result.message || 'Operation failed');
      } else {
        setShowFaceModal(false);
      }
    } catch (err) {
      setClockError(err instanceof Error ? err.message : 'Clocking failed.');
    } finally {
      setClockLoading(false);
    }
  };

  // Real-time Live Computed Metrics
  const monthlyStats = useMemo(() => {
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const thisMonthRecords = monthAttendanceRecords.filter((r) => (r.date || '').startsWith(currentYearMonth));

    const presentOrLate = thisMonthRecords.filter((r) => r.status === 'present' || r.status === 'late').length;
    const totalWorkingMins = thisMonthRecords.reduce((acc, r) => acc + (r.working_minutes || 0), 0);
    const totalWorkingHours = Math.round(totalWorkingMins / 60);

    // Business days in month passed so far
    const dayOfMonth = now.getDate();
    let weekdaysSoFar = 0;
    for (let d = 1; d <= dayOfMonth; d++) {
      const day = new Date(now.getFullYear(), now.getMonth(), d).getDay();
      if (day !== 0 && day !== 6) weekdaysSoFar++;
    }

    const baselineDays = Math.max(1, Math.max(weekdaysSoFar, thisMonthRecords.length));
    const attendancePercent = thisMonthRecords.length > 0
      ? Math.min(100, Math.round((presentOrLate / baselineDays) * 100))
      : 100;

    return {
      percent: attendancePercent,
      hours: totalWorkingHours,
      presentDays: presentOrLate,
      isOnTrack: attendancePercent >= 85,
    };
  }, [monthAttendanceRecords]);

  const salaryDisplay = useMemo(() => {
    const sal = (employee as any)?.salary;
    const amount = sal?.gross_salary || sal?.base_salary || employee?.basic_salary || (employee as any)?.base_salary;
    if (amount) {
      return formatCurrency(amount);
    }
    return 'Active';
  }, [employee]);

  const nextPayrollDateStr = useMemo(() => {
    const now = new Date();
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return lastDayOfMonth.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }, []);

  if (loading) return <LoadingState />;

  const isClockedIn = Boolean(todayAttendance && !todayAttendance.clock_out);
  const isClockedOut = Boolean(todayAttendance && todayAttendance.clock_out);

  const userName = profile?.full_name?.split(' ')[0] || 'Team Member';
  const orgName = organization?.name || 'WorkGrid Workspace';
  const designation = employee?.designation || 'Staff';
  const workplaceName = employee?.hospital_unit || employee?.workplace?.name || tenantWp?.name || 'Shanti Memorial Hospital - Cuttack';
  const kpiCardWidth = isDesktop
    ? undefined
    : Platform.OS === 'web'
    ? 'calc(50% - 6px)'
    : Math.floor((width - 40 - 18) / 2);

  return (
    <ScrollView
      style={s.canvas}
      contentContainerStyle={[s.contentContainer, isDesktop && s.desktopContainer]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7C3AED" />}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Hero Greeting Banner with STOCK 6 SVG ──────────────────────── */}
      <Animated.View entering={FadeInDown.duration(280)} style={s.heroRow}>
        <View style={s.heroTextCol}>
          <Text style={s.greetingSmall}>{getGreeting()},</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 }}>
            <Text style={s.greetingLarge}>{userName}</Text>
            <Text style={{ fontSize: 26 }}>👋</Text>
          </View>
          <Text style={s.greetingSub}>
            {designation} · {workplaceName}
          </Text>
        </View>

        {/* Work management visual illustration */}
        <View style={s.heroGraphicCol}>
          <SvgXml
            xml={STOCK_6_SVG}
            width={isDesktop ? 175 : 130}
            height={isDesktop ? 125 : 94}
          />
        </View>
      </Animated.View>

      {/* ── 4 Metric KPI Cards (Desktop: 1 Row x 4; Mobile: 2 Rows x 2) ── */}
      <Animated.View entering={FadeInDown.delay(60).duration(280)} style={s.metricsContainer}>
        {isDesktop ? (
          <View style={s.metricsDesktopRow}>
            {/* Card 1: Attendance Rate */}
            <InteractiveTile
              style={[
                s.metricCard,
                {
                  backgroundColor: '#EDFAF2',
                  borderColor: '#CEF2DE',
                  flex: 1,
                  minWidth: 0,
                },
              ]}
              onPress={() => router.push('/(employee)/attendance' as never)}
            >
              <View style={s.cardTopRow}>
                <View style={[s.iconBox, { backgroundColor: '#D1FAE5' }]}>
                  <SvgXml xml={STOCK_10_SVG} width={32} height={24} />
                </View>
                <View style={s.valueRow}>
                  <Text style={[s.metricValueText, { color: '#064E3B' }]}>{monthlyStats.percent}%</Text>
                  <Text style={s.trendGreen}>{monthlyStats.isOnTrack ? '↑ On Track' : 'Needs Review'}</Text>
                </View>
              </View>
              <View style={s.cardBottomRow}>
                <Text style={s.metricLabelText} numberOfLines={1}>Monthly Attendance</Text>
                <View style={s.waveContainer}>
                  <MetricWave color="#10B981" width={isDesktop ? 120 : 64} height={20} />
                </View>
              </View>
            </InteractiveTile>

            {/* Card 2: Leave Balance */}
            <InteractiveTile
              style={[
                s.metricCard,
                {
                  backgroundColor: '#FFF4EB',
                  borderColor: '#FFE2CD',
                  flex: 1,
                  minWidth: 0,
                },
              ]}
              onPress={() => router.push('/(employee)/leave' as never)}
            >
              <View style={s.cardTopRow}>
                <View style={[s.iconBox, { backgroundColor: '#FFEDD5' }]}>
                  <SvgXml xml={STOCK_7_SVG} width={32} height={24} />
                </View>
                <View style={s.valueRow}>
                  <Text style={[s.metricValueText, { color: '#7C2D12' }]}>{leaveBalanceTotal}</Text>
                  <Text style={[s.trendGreen, { color: '#EA580C' }]}>Days Left</Text>
                </View>
              </View>
              <View style={s.cardBottomRow}>
                <Text style={s.metricLabelText} numberOfLines={1}>Paid Leave Balance</Text>
                <View style={s.waveContainer}>
                  <MetricWave color="#F97316" width={isDesktop ? 120 : 64} height={20} />
                </View>
              </View>
            </InteractiveTile>

            {/* Card 3: Shift Hours */}
            <InteractiveTile
              style={[
                s.metricCard,
                {
                  backgroundColor: '#F3EEFE',
                  borderColor: '#E4DCFD',
                  flex: 1,
                  minWidth: 0,
                },
              ]}
              onPress={() => router.push('/(employee)/attendance' as never)}
            >
              <View style={s.cardTopRow}>
                <View style={[s.iconBox, { backgroundColor: '#DDD6FE' }]}>
                  <SvgXml xml={STOCK_4_SVG} width={32} height={24} />
                </View>
                <View style={s.valueRow}>
                  <Text style={[s.metricValueText, { color: '#1E1B4B' }]}>{monthlyStats.hours}h</Text>
                  <Text style={s.trendGreen}>{monthlyStats.hours > 0 ? `${monthlyStats.hours}h Logged` : 'Active Shift'}</Text>
                </View>
              </View>
              <View style={s.cardBottomRow}>
                <Text style={s.metricLabelText} numberOfLines={1}>Monthly Shift Hours</Text>
                <View style={s.waveContainer}>
                  <MetricWave color="#8B5CF6" width={isDesktop ? 120 : 64} height={20} />
                </View>
              </View>
            </InteractiveTile>

            {/* Card 4: Salary & Payslips */}
            <InteractiveTile
              style={[
                s.metricCard,
                {
                  backgroundColor: '#EFF6FF',
                  borderColor: '#DBEAFE',
                  flex: 1,
                  minWidth: 0,
                },
              ]}
              onPress={() => router.push('/(employee)/payslips' as never)}
            >
              <View style={s.cardTopRow}>
                <View style={[s.iconBox, { backgroundColor: '#DBEAFE' }]}>
                  <SvgXml xml={STOCK_9_SVG} width={32} height={24} />
                </View>
                <View style={s.valueRow}>
                  <Text style={[s.metricValueText, { color: '#1E3A8A' }]} numberOfLines={1}>{salaryDisplay}</Text>
                  <Text style={[s.trendGreen, { color: '#2563EB' }]}>Payslip Ready</Text>
                </View>
              </View>
              <View style={s.cardBottomRow}>
                <Text style={s.metricLabelText} numberOfLines={1}>Payroll & Payslips</Text>
                <View style={s.waveContainer}>
                  <MetricWave color="#3B82F6" width={isDesktop ? 120 : 64} height={20} />
                </View>
              </View>
            </InteractiveTile>
          </View>
        ) : (
          <View style={s.metricsMobileCol}>
            {/* Mobile Pair Row 1 */}
            <View style={s.metricPairRow}>
              {/* Card 1: Attendance Rate */}
              <InteractiveTile
                style={[
                  s.metricCard,
                  {
                    backgroundColor: '#EDFAF2',
                    borderColor: '#CEF2DE',
                    flex: 1,
                    minWidth: 0,
                  },
                ]}
                onPress={() => router.push('/(employee)/attendance' as never)}
              >
                <View style={s.cardTopRow}>
                  <View style={[s.iconBox, { backgroundColor: '#D1FAE5' }]}>
                    <SvgXml xml={STOCK_10_SVG} width={32} height={24} />
                  </View>
                  <View style={s.valueRow}>
                    <Text style={[s.metricValueText, { color: '#064E3B' }]}>{monthlyStats.percent}%</Text>
                    <Text style={s.trendGreen}>{monthlyStats.isOnTrack ? '↑ On Track' : 'Review'}</Text>
                  </View>
                </View>
                <View style={s.cardBottomRow}>
                  <Text style={s.metricLabelText} numberOfLines={1}>Monthly Attendance</Text>
                  <View style={s.waveContainer}>
                    <MetricWave color="#10B981" width={64} height={20} />
                  </View>
                </View>
              </InteractiveTile>

              {/* Card 2: Leave Balance */}
              <InteractiveTile
                style={[
                  s.metricCard,
                  {
                    backgroundColor: '#FFF4EB',
                    borderColor: '#FFE2CD',
                    flex: 1,
                    minWidth: 0,
                  },
                ]}
                onPress={() => router.push('/(employee)/leave' as never)}
              >
                <View style={s.cardTopRow}>
                  <View style={[s.iconBox, { backgroundColor: '#FFEDD5' }]}>
                    <SvgXml xml={STOCK_7_SVG} width={32} height={24} />
                  </View>
                  <View style={s.valueRow}>
                    <Text style={[s.metricValueText, { color: '#7C2D12' }]}>{leaveBalanceTotal}</Text>
                    <Text style={[s.trendGreen, { color: '#EA580C' }]}>Days Left</Text>
                  </View>
                </View>
                <View style={s.cardBottomRow}>
                  <Text style={s.metricLabelText} numberOfLines={1}>Paid Leave Balance</Text>
                  <View style={s.waveContainer}>
                    <MetricWave color="#F97316" width={64} height={20} />
                  </View>
                </View>
              </InteractiveTile>
            </View>

            {/* Mobile Pair Row 2 */}
            <View style={s.metricPairRow}>
              {/* Card 3: Shift Hours */}
              <InteractiveTile
                style={[
                  s.metricCard,
                  {
                    backgroundColor: '#F3EEFE',
                    borderColor: '#E4DCFD',
                    flex: 1,
                    minWidth: 0,
                  },
                ]}
                onPress={() => router.push('/(employee)/attendance' as never)}
              >
                <View style={s.cardTopRow}>
                  <View style={[s.iconBox, { backgroundColor: '#DDD6FE' }]}>
                    <SvgXml xml={STOCK_4_SVG} width={32} height={24} />
                  </View>
                  <View style={s.valueRow}>
                    <Text style={[s.metricValueText, { color: '#1E1B4B' }]}>{monthlyStats.hours}h</Text>
                    <Text style={s.trendGreen}>{monthlyStats.hours > 0 ? `${monthlyStats.hours}h Logged` : 'Active Shift'}</Text>
                  </View>
                </View>
                <View style={s.cardBottomRow}>
                  <Text style={s.metricLabelText} numberOfLines={1}>Monthly Shift Hours</Text>
                  <View style={s.waveContainer}>
                    <MetricWave color="#8B5CF6" width={64} height={20} />
                  </View>
                </View>
              </InteractiveTile>

              {/* Card 4: Salary & Payslips */}
              <InteractiveTile
                style={[
                  s.metricCard,
                  {
                    backgroundColor: '#EFF6FF',
                    borderColor: '#DBEAFE',
                    flex: 1,
                    minWidth: 0,
                  },
                ]}
                onPress={() => router.push('/(employee)/payslips' as never)}
              >
                <View style={s.cardTopRow}>
                  <View style={[s.iconBox, { backgroundColor: '#DBEAFE' }]}>
                    <SvgXml xml={STOCK_9_SVG} width={32} height={24} />
                  </View>
                  <View style={s.valueRow}>
                    <Text style={[s.metricValueText, { color: '#1E3A8A' }]} numberOfLines={1}>{salaryDisplay}</Text>
                    <Text style={[s.trendGreen, { color: '#2563EB' }]}>Payslip Ready</Text>
                  </View>
                </View>
                <View style={s.cardBottomRow}>
                  <Text style={s.metricLabelText} numberOfLines={1}>Payroll & Payslips</Text>
                  <View style={s.waveContainer}>
                    <MetricWave color="#3B82F6" width={64} height={20} />
                  </View>
                </View>
              </InteractiveTile>
            </View>
          </View>
        )}
      </Animated.View>

      {/* ── Today's Shift Punch Card ───────────────────────────────────── */}
      <Animated.View entering={FadeInDown.delay(100).duration(280)} style={s.shiftCard}>
        {/* Card Header */}
        <View style={s.cardHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={[s.iconBox, { backgroundColor: '#EDE9FE', width: 32, height: 32, borderRadius: 10 }]}>
              <Clock size={16} color="#7C3AED" />
            </View>
            <Text style={s.sectionTitle}>Today's Shift Punch</Text>
          </View>

          {/* Shift Status Pill */}
          <View
            style={[
              s.shiftStatusPill,
              isClockedIn
                ? { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }
                : isClockedOut
                  ? { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' }
                  : { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
            ]}
          >
            <View
              style={[
                s.shiftStatusDot,
                {
                  backgroundColor: isClockedIn
                    ? '#10B981'
                    : isClockedOut
                      ? '#64748B'
                      : '#F59E0B',
                },
              ]}
            />
            <Text
              style={[
                s.shiftStatusText,
                {
                  color: isClockedIn
                    ? '#059669'
                    : isClockedOut
                      ? '#475569'
                      : '#D97706',
                },
              ]}
            >
              {isClockedIn ? 'SHIFT ACTIVE' : isClockedOut ? 'COMPLETED' : 'AWAITING PUNCH'}
            </Text>
          </View>
        </View>

        {clockError ? (
          <View style={s.errorBanner}>
            <AlertCircle size={15} color="#DC2626" strokeWidth={1.8} />
            <Text style={s.errorText}>{clockError}</Text>
          </View>
        ) : null}

        {/* Timestamps Row */}
        <View style={s.punchMetricsGrid}>
          <View style={s.punchMetricItem}>
            <Text style={s.punchMetricLabel}>CLOCK IN</Text>
            <Text style={s.punchMetricValue}>
              {todayAttendance?.clock_in ? formatTime(todayAttendance.clock_in) : '— : —'}
            </Text>
          </View>

          <View style={s.punchDivider} />

          <View style={s.punchMetricItem}>
            <Text style={s.punchMetricLabel}>CLOCK OUT</Text>
            <Text style={s.punchMetricValue}>
              {todayAttendance?.clock_out ? formatTime(todayAttendance.clock_out) : '— : —'}
            </Text>
          </View>

          <View style={s.punchDivider} />

          <View style={s.punchMetricItem}>
            <Text style={s.punchMetricLabel}>DUTY LOCATION</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <MapPin size={12} color="#7C3AED" />
              <Text style={s.punchLocationText} numberOfLines={1}>
                {workplaceName}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Button / Shift Concluded Banner */}
        {isClockedOut ? (
          <View style={s.punchCompletedBox}>
            <View style={s.punchCompletedIconCircle}>
              <CheckCircle2 size={18} color="#059669" strokeWidth={2.5} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.punchCompletedTitle}>Shift Concluded for Today</Text>
              <Text style={s.punchCompletedSub}>
                Attendance recorded successfully · {todayAttendance?.working_minutes ? `${Math.floor(todayAttendance.working_minutes / 60)}h ${todayAttendance.working_minutes % 60}m logged` : 'Have a great evening!'}
              </Text>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={[
              s.punchActionButton,
              isClockedIn ? { backgroundColor: '#DC2626' } : { backgroundColor: '#7C3AED' },
            ]}
            activeOpacity={0.85}
            onPress={() => handleClock(isClockedIn ? 'out' : 'in')}
            disabled={clockLoading}
          >
            {isClockedIn ? (
              <LogOut size={17} color="#FFFFFF" strokeWidth={2.2} style={{ marginRight: 8 }} />
            ) : (
              <LogIn size={17} color="#FFFFFF" strokeWidth={2.2} style={{ marginRight: 8 }} />
            )}
            <Text style={s.punchActionText}>
              {clockLoading
                ? 'Verifying Location...'
                : isClockedIn
                  ? 'Clock Out of Shift'
                  : 'Clock In to Shift'}
            </Text>
          </TouchableOpacity>
        )}
      </Animated.View>

      {/* ── Quick Actions ──────────────────────────────────────────────── */}
      <Animated.View entering={FadeInDown.delay(140).duration(280)} style={{ marginTop: 20 }}>
        <View style={s.sectionHeaderRow}>
          <Text style={s.sectionTitleLarge}>Quick Actions</Text>
          <TouchableOpacity
            onPress={() => router.push('/(employee)/attendance' as never)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            activeOpacity={0.8}
          >
            <Text style={s.seeAllLink}>See All</Text>
            <ArrowRight size={13} color="#7C3AED" />
          </TouchableOpacity>
        </View>

        <View style={s.quickActionsRow}>
          {/* 1: Apply Leave with STOCK 8 SVG */}
          <InteractiveTile
            style={s.quickActionBtn}
            onPress={() => router.push('/(employee)/leave/apply' as never)}
          >
            <View style={[s.quickActionIconCircle, { backgroundColor: '#FFF1F2' }]}>
              <SvgXml xml={STOCK_8_SVG} width={42} height={30} />
            </View>
            <Text style={s.quickActionLabel}>Apply{'\n'}Leave</Text>
          </InteractiveTile>

          {/* 2: Clock In / Attendance with STOCK 1 SVG */}
          <InteractiveTile
            style={s.quickActionBtn}
            onPress={() => router.push('/(employee)/attendance' as never)}
          >
            <View style={[s.quickActionIconCircle, { backgroundColor: '#EEF2FF' }]}>
              <SvgXml xml={STOCK_1_SVG} width={42} height={30} />
            </View>
            <Text style={s.quickActionLabel}>My{'\n'}Attendance</Text>
          </InteractiveTile>

          {/* 3: My Payslips with STOCK 3 SVG */}
          <InteractiveTile
            style={s.quickActionBtn}
            onPress={() => router.push('/(employee)/payslips' as never)}
          >
            <View style={[s.quickActionIconCircle, { backgroundColor: '#EFF6FF' }]}>
              <SvgXml xml={STOCK_3_SVG} width={42} height={30} />
            </View>
            <Text style={s.quickActionLabel}>My{'\n'}Payslips</Text>
          </InteractiveTile>

          {/* 4: Learning & LMS with STOCK 10 SVG */}
          <InteractiveTile
            style={s.quickActionBtn}
            onPress={() => router.push('/(employee)/learning' as never)}
          >
            <View style={[s.quickActionIconCircle, { backgroundColor: '#F3EEFE' }]}>
              <SvgXml xml={STOCK_10_SVG} width={42} height={30} />
            </View>
            <Text style={s.quickActionLabel}>Learning{'\n'}& LMS</Text>
          </InteractiveTile>

          {/* 5: Helpdesk with STOCK 12 SVG */}
          <InteractiveTile
            style={s.quickActionBtn}
            onPress={() => router.push('/(employee)/helpdesk' as never)}
          >
            <View style={[s.quickActionIconCircle, { backgroundColor: '#F5F3FF' }]}>
              <SvgXml xml={STOCK_12_SVG} width={42} height={30} />
            </View>
            <Text style={s.quickActionLabel}>Helpdesk{'\n'}Support</Text>
          </InteractiveTile>
        </View>
      </Animated.View>

      {/* ── Bottom Split Cards (Duty Station & Schedule) ───────────────── */}
      <Animated.View
        entering={FadeInDown.delay(180).duration(280)}
        style={isDesktop ? s.desktopSideBySide : s.mobileStackedCards}
      >
        {/* Card A: Duty Station & Work Assignment */}
        <View style={s.bottomHalfCard}>
          <View style={s.cardHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[s.iconBox, { backgroundColor: '#EDE9FE', width: 26, height: 26 }]}>
                <Building2 size={14} color="#7C3AED" />
              </View>
              <Text style={s.cardTitleMedium}>Duty Station</Text>
            </View>
          </View>

          <TouchableOpacity
            style={s.orgSubCard}
            activeOpacity={0.85}
            onPress={() => router.push('/(employee)/profile' as never)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={s.orgSvgContainer}>
                <SvgXml xml={STOCK_5_SVG} width={42} height={30} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.orgSubName} numberOfLines={1}>{orgName}</Text>
                <View style={s.rolePill}>
                  <Shield size={9} color="#7C3AED" />
                  <Text style={s.rolePillText}>{designation}</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>

          <View style={s.metaStatsList}>
            <View style={s.metaStatRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MapPin size={13} color="#6B7280" />
                <Text style={s.metaStatLabel}>Workplace</Text>
              </View>
              <Text style={s.metaStatValue}>{workplaceName}</Text>
            </View>

            <View style={s.metaStatRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Briefcase size={13} color="#6B7280" />
                <Text style={s.metaStatLabel}>Department</Text>
              </View>
              <Text style={s.metaStatValue}>{employee?.department?.name || 'General Operations'}</Text>
            </View>

            <View style={s.metaStatRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <CalendarDays size={13} color="#6B7280" />
                <Text style={s.metaStatLabel}>Employee Code</Text>
              </View>
              <Text style={s.metaStatValue}>{employee?.employee_code || 'EMP-2026'}</Text>
            </View>
          </View>
        </View>

        {/* Card B: Upcoming Schedule & Milestones */}
        <View style={s.bottomHalfCard}>
          <View style={s.cardHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[s.iconBox, { backgroundColor: '#EFF6FF', width: 26, height: 26 }]}>
                <Calendar size={14} color="#2563EB" />
              </View>
              <Text style={s.cardTitleMedium}>Upcoming Schedule</Text>
            </View>

            <View style={s.svgPreviewBadge} pointerEvents="none">
              <SvgXml xml={STOCK_13_SVG} width={34} height={24} />
            </View>
          </View>

          <View style={s.activityTimeline}>
            {/* Item 1 */}
            <View style={s.timelineItem}>
              <View style={s.timelineIconCol}>
                <View style={[s.timelineCircle, { backgroundColor: '#D1FAE5' }]}>
                  <Clock size={11} color="#059669" strokeWidth={2.5} />
                </View>
                <View style={s.timelineLine} />
              </View>
              <View style={s.timelineContentCol}>
                <Text style={s.timelineTitle}>{assignedShift?.name || 'Assigned Shift'}</Text>
                <Text style={s.timelineSub}>
                  {assignedShift
                    ? `${assignedShift.start_time} – ${assignedShift.end_time} · Scheduled`
                    : '09:00 AM – 06:00 PM · Scheduled'}
                </Text>
              </View>
            </View>

            {/* Item 2 */}
            <View style={s.timelineItem}>
              <View style={s.timelineIconCol}>
                <View style={[s.timelineCircle, { backgroundColor: '#EDE9FE' }]}>
                  <CalendarDays size={11} color="#7C3AED" strokeWidth={2.2} />
                </View>
                <View style={s.timelineLine} />
              </View>
              <View style={s.timelineContentCol}>
                <Text style={s.timelineTitle}>Available Leave</Text>
                <Text style={s.timelineSub}>{leaveBalanceTotal} Days Available · Annual Balance</Text>
              </View>
            </View>

            {/* Item 3 */}
            <View style={[s.timelineItem, { marginBottom: 0 }]}>
              <View style={s.timelineIconCol}>
                <View style={[s.timelineCircle, { backgroundColor: '#FFEDD5' }]}>
                  <CreditCard size={11} color="#EA580C" strokeWidth={2.2} />
                </View>
              </View>
              <View style={s.timelineContentCol}>
                <Text style={s.timelineTitle}>Next Payroll Run</Text>
                <Text style={s.timelineSub}>{nextPayrollDateStr} · Direct Bank Transfer</Text>
              </View>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* Face Verification Modal */}
      <FaceVerificationModal
        visible={showFaceModal}
        type={faceModalType}
        isClockingIn={faceModalType === 'in'}
        employeeName={profile?.full_name || userName}
        officeName={workplaceName}
        isRemote={isRemoteClock}
        onClose={() => setShowFaceModal(false)}
        onVerified={handleFaceVerified}
      />
    </ScrollView>
  );
}

/* ─── Stylesheet ─────────────────────────────────────────────────────── */
const s = StyleSheet.create({
  canvas: {
    flex: 1,
    backgroundColor: '#F6F5FC',
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 110,
  },
  desktopContainer: {
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 28,
  },

  /* Hero Greeting */
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginBottom: 4,
  },
  heroTextCol: {
    flex: 1,
    paddingRight: 8,
  },
  greetingSmall: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: '600',
    color: '#4B5563',
  },
  greetingLarge: {
    fontFamily: FONT,
    fontSize: 27,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.6,
  },
  greetingSub: {
    fontFamily: FONT,
    fontSize: 12.5,
    color: '#6B7280',
    marginTop: 4,
    lineHeight: 17,
  },
  heroGraphicCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },

  /* 4 Metric Cards */
  metricsContainer: {
    width: '100%',
    marginTop: 14,
  },
  metricsDesktopRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  metricsMobileCol: {
    width: '100%',
  },
  metricPairRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginBottom: 12,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 14,
    width: '100%',
  },
  metricCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    paddingBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
    overflow: 'hidden',
    justifyContent: 'space-between',
    minHeight: 96,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBox: {
    width: 36,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  metricValueText: {
    fontFamily: FONT,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  trendGreen: {
    fontFamily: FONT,
    fontSize: 10.5,
    fontWeight: '700',
    color: '#10B981',
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 4,
  },
  metricLabelText: {
    fontFamily: FONT,
    fontSize: 11.5,
    fontWeight: '600',
    color: '#6B7280',
    flexShrink: 1,
  },
  waveContainer: {
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },

  /* Shift Punch Card */
  shiftCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    marginTop: 18,
    borderWidth: 1,
    borderColor: '#ECEEF5',
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: {
    fontFamily: FONT,
    fontSize: 15.5,
    fontWeight: '700',
    color: '#111827',
  },
  shiftStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  shiftStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  shiftStatusText: {
    fontFamily: FONT,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  punchMetricsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  punchMetricItem: {
    flex: 1,
    alignItems: 'center',
  },
  punchMetricLabel: {
    fontFamily: FONT,
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  punchMetricValue: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  punchLocationText: {
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: '600',
    color: '#7C3AED',
  },
  punchDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E2E8F0',
  },
  punchActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 14,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 3,
  },
  punchActionText: {
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  punchCompletedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 14,
  },
  punchCompletedIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  punchCompletedTitle: {
    fontFamily: FONT,
    fontSize: 13.5,
    fontWeight: '700',
    color: '#065F46',
  },
  punchCompletedSub: {
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: '500',
    color: '#047857',
    marginTop: 2,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    fontFamily: FONT,
    fontSize: 12,
    color: '#DC2626',
    flex: 1,
  },

  /* Quick Actions */
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitleLarge: {
    fontFamily: FONT,
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
  },
  seeAllLink: {
    fontFamily: FONT,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#7C3AED',
  },
  quickActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickActionBtn: {
    flex: 1,
    minWidth: 100,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ECEEF5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1,
  },
  quickActionIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickActionLabel: {
    fontFamily: FONT,
    fontSize: 11.5,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
    lineHeight: 15,
  },

  /* Bottom Split Cards */
  desktopSideBySide: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 20,
  },
  mobileStackedCards: {
    marginTop: 20,
    gap: 14,
  },
  bottomHalfCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#ECEEF5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  cardTitleMedium: {
    fontFamily: FONT,
    fontSize: 13.5,
    fontWeight: '700',
    color: '#111827',
  },
  svgPreviewBadge: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orgSubCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 10,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  orgSvgContainer: {
    width: 48,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orgSubName: {
    fontFamily: FONT,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#111827',
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  rolePillText: {
    fontFamily: FONT,
    fontSize: 10,
    fontWeight: '700',
    color: '#7C3AED',
  },
  metaStatsList: {
    marginTop: 10,
    gap: 8,
  },
  metaStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  metaStatLabel: {
    fontFamily: FONT,
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  metaStatValue: {
    fontFamily: FONT,
    fontSize: 11.5,
    fontWeight: '700',
    color: '#111827',
  },

  /* Activity Timeline */
  activityTimeline: {
    marginTop: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  timelineIconCol: {
    alignItems: 'center',
    marginRight: 10,
    width: 24,
  },
  timelineCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineLine: {
    width: 1.5,
    flex: 1,
    backgroundColor: '#E5E7EB',
    marginTop: 3,
    marginBottom: -6,
  },
  timelineContentCol: {
    flex: 1,
    justifyContent: 'center',
  },
  timelineTitle: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '700',
    color: '#1F2937',
  },
  timelineSub: {
    fontFamily: FONT,
    fontSize: 10.5,
    color: '#6B7280',
    marginTop: 1,
  },
});
