import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  Alert,
} from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  FadeInUp,
} from 'react-native-reanimated';

// Lucide Icons
import {
  AlertCircle, ArrowRight, Award, Banknote, Bell, Briefcase, CalendarClock,
  CalendarDays, CheckCircle2,
  Clock, LogIn, LogOut as LogOutIcon,
  Mic, Navigation, Receipt,
  Users, Globe, Lock, Building2, Cake, Heart, PartyPopper
} from 'lucide-react-native';

// Components & Context
import { FaceVerificationModal } from '@/components/attendance/FaceVerificationModal';
import { GeofenceMap } from '@/components/Map/GeofenceMap';
import { LoadingState } from '@/components/ui/States';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { useNotifications } from '@/context/NotificationContext';
import { useTenant } from '@/context/TenantContext';
import { useTheme } from '@/hooks/use-theme';
import { MOBILE } from '@/constants/mobile';
import { useAuth } from '@/hooks/useAuth';

// Services
import { clockIn, clockOut, getAttendanceHistory, getTodayAttendance } from '@/lib/services/attendance';
import { getEmployeeByProfileId } from '@/lib/services/employee';
import { getLeaveBalances } from '@/lib/services/leave';
import { calculateDistance, getCurrentLocation } from '@/lib/services/location';
import { cancelClockInNotification, sendClockInNotification } from '@/lib/services/notifications';
import { getPayslips } from '@/lib/services/payroll';
import { getAppraisals } from '@/lib/services/performance';

// Types & Utils
import type { Attendance, Employee, LeaveBalance, Payslip, AppraisalReview } from '@/types';
import { formatCurrency, formatDate, formatMinutes, formatTime, getGreeting } from '@/utils/format';
import { ScreenErrorFallback } from '@/components/ui/ScreenErrorBoundary';

// Expo Router renders this if the dashboard subtree throws, instead of crashing the app.
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return <ScreenErrorFallback error={error} retry={retry} />;
}

// ─── Animated Pulse Clock-In Button ───────────────────────────────────────────
function PulseButton({ onPress, loading, title, color }: { onPress: () => void; loading: boolean; title: string; color: string }) {
  const ring1 = useSharedValue(1);
  const ring1Op = useSharedValue(0.6);
  const scale = useSharedValue(1);

  useEffect(() => {
    ring1.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 1600, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 1600 })
      ),
      -1,
      true
    );
    ring1Op.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 1600 }),
        withTiming(0.5, { duration: 1600 })
      ),
      -1,
      true
    );
  }, []);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ring1.value }],
    opacity: ring1Op.value,
    position: 'absolute',
    top: -10, left: -10, right: -10, bottom: -10,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: color,
  }));

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[{ position: 'relative', width: '100%', marginTop: 6 }, pressStyle]}>
      {!loading && <Animated.View style={ringStyle} />}
      <TouchableOpacity
        onPressIn={() => { scale.value = withSpring(0.97, { damping: 12 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 12 }); }}
        onPress={loading ? undefined : onPress}
        activeOpacity={0.9}
        style={[clockBtnStyle.btn, { backgroundColor: color, shadowColor: color }]}
      >
        <View style={clockBtnStyle.iconCircle}>
          <LogIn size={20} color="#FFF" />
        </View>
        <Text style={clockBtnStyle.label}>{loading ? 'Processing…' : title}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const clockBtnStyle = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 18,
    borderRadius: 18,
    width: '100%',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 6,
  },
  iconCircle: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 8,
    borderRadius: 999,
  },
  label: { color: '#FFF', fontSize: 17, fontWeight: '700', letterSpacing: 0.4 },
});

export default function EmployeeDashboard() {
  const colors = useTheme();
  const { profile } = useAuth();
  const { officeName, isFeatureEnabled, organization, employee: tenantEmp, workplace: tenantWp } = useTenant();
  const activeOrgId = organization?.id || tenantEmp?.organization_id || profile?.organization_id;
  const isWfhEnabled = isFeatureEnabled('wfh');
  const { unreadCount } = useNotifications();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const primaryColor = colors.primary;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null);
  const [recentAttendance, setRecentAttendance] = useState<Attendance[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [latestPayslip, setLatestPayslip] = useState<Payslip | null>(null);
  const [pendingAppraisal, setPendingAppraisal] = useState<AppraisalReview | null>(null);
  const [clockLoading, setClockLoading] = useState(false);
  const [clockError, setClockError] = useState('');
  const [distance, setDistance] = useState<number | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  // Face Verification Modal state
  const [showFaceModal, setShowFaceModal] = useState(false);
  const [faceModalType, setFaceModalType] = useState<'in' | 'out'>('in');
  const [pendingLoc, setPendingLoc] = useState<{ latitude: number; longitude: number }>({ latitude: 0, longitude: 0 });

  const loadData = useCallback(async () => {
    if (!profile) return;
    try {
      const emp = tenantEmp || (await getEmployeeByProfileId(profile.id, activeOrgId));
      if (emp && !emp.workplace && tenantWp) {
        emp.workplace = tenantWp;
      }
      setEmployee(emp);
      if (emp) {
        const [today, history, balances, payslips, appraisals] = await Promise.all([
          getTodayAttendance(emp.id),
          getAttendanceHistory(emp.id, 5),
          getLeaveBalances(emp.id, undefined, activeOrgId),
          getPayslips(emp.id),
          getAppraisals({ employeeId: emp.id, status: 'self_review', organizationId: activeOrgId })
        ]);
        setTodayAttendance(today);
        setRecentAttendance(history);
        setLeaveBalances(balances);
        setLatestPayslip(payslips.length > 0 ? payslips[0] : null);
        setPendingAppraisal(appraisals.length > 0 ? appraisals[0] : null);
      }
    } catch (err) { console.error('Dashboard load error:', err); }
    finally { setLoading(false); }
  }, [profile, activeOrgId, tenantEmp, tenantWp]);

  useEffect(() => { loadData(); }, [loadData]);

  // Location tracking and distance computation
  useEffect(() => {
    if (employee?.workplace?.latitude && employee?.workplace?.longitude) {
      getCurrentLocation()
        .then((loc) => {
          setUserLocation(loc);
          const dist = calculateDistance(
            loc.latitude, loc.longitude,
            employee.workplace!.latitude, employee.workplace!.longitude
          );
          setDistance(Math.round(dist));
        })
        .catch(() => { });
    }
  }, [employee]);

  // Periodic distance refresh
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (employee?.workplace?.latitude && employee?.workplace?.longitude) {
      interval = setInterval(() => {
        getCurrentLocation()
          .then((loc) => {
            setUserLocation(loc);
            const dist = calculateDistance(
              loc.latitude, loc.longitude,
              employee.workplace!.latitude, employee.workplace!.longitude
            );
            setDistance(Math.round(dist));
          })
          .catch(() => { });
      }, 60000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [employee]);

  // Remote Clock In state
  const [isRemoteClock, setIsRemoteClock] = useState(false);
  const [remoteReason, setRemoteReason] = useState('Work From Home');

  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  const handleClock = async (type: 'in' | 'out', remote: boolean = false) => {
    setClockError('');
    if (remote && !isWfhEnabled) {
      setClockError('Work From Home (WFH) remote clock-in is locked for your organization. Please clock in on-site.');
      return;
    }
    setClockLoading(true);
    setIsRemoteClock(remote);
    try {
      let loc = userLocation;
      try {
        loc = await getCurrentLocation();
        setUserLocation(loc);
      } catch (locErr) {
        if (!remote && type === 'in') {
          throw new Error('GPS location required. Please enable location permissions or use Remote Clock-In.');
        }
      }

      const activeLoc = loc || { latitude: 0, longitude: 0 };
      setPendingLoc(activeLoc);

      if (employee?.workplace?.latitude && employee?.workplace?.longitude && activeLoc.latitude && activeLoc.longitude) {
        const dist = Math.round(
          calculateDistance(
            activeLoc.latitude, activeLoc.longitude,
            employee.workplace.latitude, employee.workplace.longitude
          )
        );
        setDistance(dist);

        // Block office clock-in if outside geofence!
        if (type === 'in' && !remote && dist > geofenceRadius) {
          setClockError(
            `You are outside the office geofence (${dist}m away from ${employee.workplace.name || officeName}). Office clock-in requires being within ${geofenceRadius}m. Please move within range or tap "Clock In Remotely (WFH)".`
          );
          setClockLoading(false);
          return;
        }
      } else if (type === 'in' && !remote && employee?.workplace?.latitude) {
        setClockError('Unable to obtain your GPS location to verify office proximity. Please turn on location services or use Remote Clock-In.');
        setClockLoading(false);
        return;
      }

      setFaceModalType(type);
      setShowFaceModal(true);
    } catch (err: unknown) {
      setClockError(err instanceof Error ? err.message : 'Failed to prepare clocking. Please try again.');
    } finally {
      setClockLoading(false);
    }
  };

  const handleFaceVerified = async (faceSnapshot?: string) => {
    setClockLoading(true);
    setClockError('');
    try {
      const loc = pendingLoc || userLocation || { latitude: 0, longitude: 0 };
      const result = faceModalType === 'in'
        ? await clockIn(loc.latitude, loc.longitude, faceSnapshot, profile?.id, {
            isRemote: isRemoteClock,
            remoteReason: isRemoteClock ? remoteReason : undefined,
          })
        : await clockOut(loc.latitude, loc.longitude, faceSnapshot, profile?.id);

      if (!result.success) {
        setClockError(result.message || 'Operation failed');
      } else {
        try {
          if (faceModalType === 'in') {
            const startTime = formatTime(new Date().toISOString());
            await sendClockInNotification(startTime);
          } else {
            await cancelClockInNotification();
          }
        } catch (notifErr) { }

        setShowFaceModal(false);
        await loadData();
      }
    } catch (err: unknown) {
      setClockError(err instanceof Error ? err.message : 'Biometric clocking failed. Please try again.');
    } finally {
      setClockLoading(false);
    }
  };

  const isClockedIn = todayAttendance && !todayAttendance.clock_out;
  const isClockedOut = todayAttendance && todayAttendance.clock_out;

  const statusBadgeVariant = (s: string): 'successLight' | 'warningLight' | 'dangerLight' | 'infoLight' => {
    switch (s) {
      case 'present': return 'successLight';
      case 'late': case 'half_day': return 'warningLight';
      case 'absent': return 'dangerLight';
      default: return 'infoLight';
    }
  };

  const stripEmoji = (s: string) => s.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/gu, '').trim();

  const isBirthday = React.useMemo(() => {
    if (!employee?.date_of_birth) return false;
    const today = new Date();
    const dob = new Date(employee.date_of_birth);
    return today.getDate() === dob.getDate() && today.getMonth() === dob.getMonth();
  }, [employee]);

  if (loading) return <LoadingState />;

  const netPay = latestPayslip?.payroll?.net_salary ?? 0;
  const annualLeave = leaveBalances.find(b => (b.leave_type?.name || '').toLowerCase().includes('annual'));
  const annualLeft = annualLeave?.remaining_days ?? 0;

  const geofenceRadius = employee?.workplace?.radius_meters ?? 200;
  const isOutsideGeofence = distance !== null && employee?.workplace?.latitude && distance > geofenceRadius;

  const ACCENT = {
    teal: { color: primaryColor, bg: colors.primaryLight },
    indigo: { color: '#6366F1', bg: '#EEF2FF' },
    sky: { color: colors.info, bg: colors.infoLight },
    amber: { color: colors.warning, bg: colors.warningLight },
    emerald: { color: colors.success, bg: colors.successLight },
    red: { color: colors.danger, bg: colors.dangerLight },
  };

  const kpis = [
    { label: "Today's Hours", value: todayAttendance?.working_minutes != null ? formatMinutes(todayAttendance.working_minutes) : '—', accent: ACCENT.teal, icon: Clock, sub: todayAttendance?.clock_in ? `In: ${formatTime(todayAttendance.clock_in)}` : 'Not clocked in' },
    { label: 'Leave Left', value: `${annualLeft}d`, accent: ACCENT.indigo, icon: CalendarDays, sub: annualLeave ? `of ${annualLeave.allocated_days} days` : 'No quota' },
    { label: 'Net Pay', value: formatCurrency(netPay ?? 0), accent: ACCENT.sky, icon: Banknote, sub: latestPayslip?.period_month ? `Month ${latestPayslip.period_month}` : 'No payslip' },
    { label: 'Dept', value: employee?.department?.name || '—', accent: ACCENT.amber, icon: Briefcase, sub: employee?.designation || 'Employee' },
  ];

  const quickActions = [
    { label: 'Attendance', icon: CalendarClock, href: '/(employee)/attendance', accent: ACCENT.teal },
    { label: 'Leave', icon: CalendarDays, href: '/(employee)/leave', accent: ACCENT.indigo },
    { label: 'Payslips', icon: Banknote, href: '/(employee)/payslips', accent: ACCENT.sky },
    { label: 'Expenses', icon: Receipt, href: '/(employee)/expenses', accent: ACCENT.red },
    { label: 'Performance', icon: Award, href: '/(employee)/performance', accent: ACCENT.emerald },
    { label: 'Directory', icon: Users, href: '/(employee)/directory', accent: ACCENT.amber },
  ];

  const statusLabel = isClockedIn ? 'Currently Working' : isClockedOut ? 'Shift Completed' : 'Ready to Start';
  const statusDot = isClockedIn ? colors.success : isClockedOut ? colors.primary : colors.warning;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" colors={[colors.primary]} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Gradient hero header */}
        <ScreenHeader
          eyebrow={getGreeting()}
          title={profile?.full_name?.split(' ')[0] || 'Team Member'}
          subtitle={organization?.name ? `${organization.name} · Org ID: ${activeOrgId || 'N/A'}` : `Org ID: ${activeOrgId || 'N/A'}`}
          paddingBottom={26}
          right={
            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={() => router.push('/(employee)/notifications' as never)}
                style={styles.bellBtn}
                activeOpacity={0.8}
              >
                <Bell size={20} color="#FFF" />
                {unreadCount > 0 && <View style={[styles.bellDot, { borderColor: colors.primaryDark }]} />}
              </TouchableOpacity>
              {profile && (
                <TouchableOpacity onPress={() => router.push('/(employee)/profile' as never)} activeOpacity={0.8}>
                  <View style={styles.avatarRing}>
                    <Avatar name={profile.full_name} url={profile.avatar_url} size={40} />
                  </View>
                </TouchableOpacity>
              )}
            </View>
          }
          stats={[
            { label: 'Clock In', value: todayAttendance?.clock_in ? formatTime(todayAttendance.clock_in) : '--:--' },
            { label: 'Clock Out', value: todayAttendance?.clock_out ? formatTime(todayAttendance.clock_out) : '--:--' },
            { label: 'Hours', value: todayAttendance?.working_minutes ? formatMinutes(todayAttendance.working_minutes) : '0h 0m', valueColor: '#6EE7B7' },
          ]}
        >
          {/* Organization & Org ID badge */}
          <View style={styles.orgBadgeWrap}>
            <Building2 size={13} color="rgba(255,255,255,0.9)" />
            <Text style={styles.orgBadgeName} numberOfLines={1}>
              {organization?.name || 'Organization'}
            </Text>
            <View style={styles.orgBadgePill}>
              <Text style={styles.orgBadgePillLabel}>ORG ID</Text>
              <Text style={styles.orgBadgePillVal}>{activeOrgId || 'N/A'}</Text>
            </View>
          </View>
        </ScreenHeader>

        {/* Responsive content */}
        <View style={[styles.body, isDesktop && styles.bodyDesktop]}>
          {/* Main column */}
          <View style={[styles.col, isDesktop && { flex: 3 }]}>
            
            {/* Pending Appraisal Alert Card */}
            {pendingAppraisal && (
              <Animated.View entering={FadeInDown.springify()}>
                <Card style={[styles.card, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', marginBottom: 20 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                    <View style={{ backgroundColor: '#dcfce7', padding: 12, borderRadius: 999 }}>
                      <Award size={26} color="#16a34a" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: '#166534' }}>Appraisal Cycle Open!</Text>
                      <Text style={{ fontSize: 13, color: '#166534', marginTop: 3 }}>
                        Your self-review for <Text style={{ fontWeight: '700' }}>{pendingAppraisal.cycle_name}</Text> is now due.
                      </Text>
                    </View>
                    <TouchableOpacity 
                      onPress={() => router.push('/(employee)/performance' as never)}
                      style={{ backgroundColor: '#16a34a', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 }}
                    >
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Fill Review</Text>
                    </TouchableOpacity>
                  </View>
                </Card>
              </Animated.View>
            )}

            {/* Birthday Alert Card */}
            {isBirthday && (
              <Animated.View entering={FadeInDown.springify()}>
                <Card variant="default" padding={20} radius={22} style={{ backgroundColor: '#FEF08A', borderColor: '#FDE047', marginBottom: 20 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                    <View style={{ backgroundColor: '#FDF08A', padding: 12, borderRadius: 16 }}>
                      <PartyPopper size={32} color="#A16207" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 20, fontWeight: '800', color: '#854D0E', marginBottom: 4 }}>Happy Birthday, {profile?.full_name?.split(' ')[0]}! 🎉</Text>
                      <Text style={{ fontSize: 14, color: '#A16207', fontWeight: '500' }}>
                        Wishing you a fantastic day from all of us at {organization?.name || 'the team'}!
                      </Text>
                    </View>
                  </View>
                </Card>
              </Animated.View>
            )}

            {/* Clock Action Card */}
            <Animated.View entering={FadeInDown.delay(100).springify()}>
              <Card variant="default" padding={18} radius={22}>
                <View style={styles.clockHeader}>
                  <View style={styles.rowCenter}>
                    <View style={[styles.dot, { backgroundColor: statusDot }]} />
                    <Text style={[styles.clockStatus, { color: colors.text }]}>{statusLabel}</Text>
                  </View>
                  <Text style={[styles.clockDate, { color: colors.textSecondary }]}>{formatDate(new Date().toISOString())}</Text>
                </View>

                {/* Outside Geofence Alert (Prior to Clock-In) */}
                {!todayAttendance && isOutsideGeofence && (
                  <View style={[styles.banner, { backgroundColor: colors.warningLight, borderColor: `${colors.warning}33`, alignItems: 'flex-start' }]}>
                    <AlertCircle color={colors.warning} size={18} style={{ marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.bannerTitle, { color: colors.warning }]}>Outside Assigned Workplace</Text>
                      <Text style={[styles.bannerBody, { color: colors.warning }]}>
                        You are {Math.round(distance ?? 0)}m from {employee?.workplace?.name || officeName || 'the office'} (geofence radius: {geofenceRadius}m). Normal clock-in requires being on-site. Use Remote Clock-In if working from home.
                      </Text>
                    </View>
                  </View>
                )}

                {!todayAttendance && (
                  <View style={{ gap: 10 }}>
                    <PulseButton
                      title={isOutsideGeofence ? 'Clock In for Office (Out of Bounds)' : 'Clock In for Shift'}
                      onPress={() => handleClock('in', false)}
                      loading={clockLoading}
                      color={isOutsideGeofence ? '#64748B' : primaryColor}
                    />
                    {isWfhEnabled ? (
                      <Button
                        title="Clock In Remotely (WFH)"
                        onPress={() => handleClock('in', true)}
                        loading={clockLoading}
                        variant="outline"
                        size="lg"
                        fullWidth
                        icon={<Globe size={18} color={primaryColor} />}
                        style={{ borderColor: primaryColor }}
                        textStyle={{ color: primaryColor, fontWeight: '700' }}
                      />
                    ) : (
                      <TouchableOpacity
                        onPress={() =>
                          Alert.alert(
                            'WFH Feature Locked',
                            'Work From Home (WFH) remote clock-in is locked for your organization. Please clock in on-site within your campus geofence.'
                          )
                        }
                        style={styles.lockedWfhBtn}
                        activeOpacity={0.75}
                      >
                        <Lock size={16} color="#94A3B8" />
                        <Text style={styles.lockedWfhBtnText}>Clock In Remotely (WFH Locked)</Text>
                        <View style={styles.lockedWfhTag}>
                          <Text style={styles.lockedWfhTagText}>LOCKED</Text>
                        </View>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                {isClockedIn && (
                  <View style={{ marginTop: 6 }}>
                    <Button
                      title={clockLoading ? 'Processing…' : 'Clock Out'}
                      onPress={() => handleClock('out')}
                      loading={clockLoading}
                      variant="secondary"
                      size="lg"
                      fullWidth
                      icon={<LogOutIcon size={20} color="#FFF" />}
                      style={{ backgroundColor: colors.text }}
                      textStyle={{ color: '#FFF' }}
                    />
                  </View>
                )}
                {isClockedIn && todayAttendance?.is_remote && (
                  <View style={[styles.banner, { backgroundColor: '#E0F2FE', borderColor: '#BAE6FD', alignItems: 'center' }]}>
                    <Globe size={18} color="#0284C7" />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.bannerTitle, { color: '#0284C7' }]}>Remote Shift Active</Text>
                      <Text style={[styles.bannerBody, { color: '#0369A1' }]}>
                        Working remotely today ({todayAttendance?.remote_reason || 'WFH'})
                      </Text>
                    </View>
                  </View>
                )}
                {isClockedOut && (
                  <View style={[styles.banner, { backgroundColor: colors.primaryLight, borderColor: colors.accentLight }]}>
                    <CheckCircle2 size={24} color={primaryColor} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.bannerTitle, { color: colors.primary }]}>Shift Complete</Text>
                      <Text style={[styles.bannerBody, { color: colors.primary }]}>Logged {formatMinutes(todayAttendance?.working_minutes ?? 0)} today</Text>
                    </View>
                  </View>
                )}
                {clockError ? (
                  <View style={[styles.banner, { backgroundColor: colors.dangerLight, borderColor: `${colors.danger}33` }]}>
                    <AlertCircle size={16} color={colors.danger} />
                    <Text style={[styles.bannerBody, { color: colors.danger, flex: 1 }]}>{clockError}</Text>
                  </View>
                ) : null}

                {/* Geofence Alert when clocked in on-site but wandering away */}
                {isOutsideGeofence && isClockedIn && !todayAttendance?.is_remote && (
                  <View style={[styles.banner, { backgroundColor: colors.warningLight, borderColor: `${colors.warning}33`, alignItems: 'flex-start' }]}>
                    <AlertCircle color={colors.warning} size={20} style={{ marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.bannerTitle, { color: colors.warning }]}>Outside Office Zone</Text>
                      <Text style={[styles.bannerBody, { color: colors.warning }]}>You are {Math.round(distance ?? 0)}m from {employee?.workplace?.name || 'workplace'}.</Text>
                    </View>
                  </View>
                )}
              </Card>
            </Animated.View>

            {/* KPI Stats Grid */}
            <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.grid}>
              {kpis.map((kpi, idx) => {
                const IconComp = kpi.icon;
                return (
                  <View key={idx} style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border, width: isDesktop ? '23%' : '48%' }]}>
                    <View style={[styles.kpiIcon, { backgroundColor: kpi.accent.bg }]}>
                      <IconComp size={20} color={kpi.accent.color} />
                    </View>
                    <Text style={[styles.kpiValue, { color: colors.text }]} numberOfLines={1}>{kpi.value}</Text>
                    <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>{kpi.label.toUpperCase()}</Text>
                    <Text style={[styles.kpiSub, { color: colors.textTertiary }]} numberOfLines={1}>{kpi.sub}</Text>
                  </View>
                );
              })}
            </Animated.View>

            {/* Quick Actions */}
            <Animated.View entering={FadeInDown.delay(300).springify()}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
              <View style={styles.grid}>
                {quickActions.map((qa, idx) => {
                  const IconComp = qa.icon;
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.qaCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                      onPress={() => router.push(qa.href as never)}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.qaIcon, { backgroundColor: qa.accent.bg }]}>
                        <IconComp size={24} color={qa.accent.color} />
                      </View>
                      <Text style={[styles.qaLabel, { color: colors.text }]}>{qa.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Animated.View>

            {/* Workplace Map */}
            {employee?.workplace?.latitude && employee?.workplace?.longitude && (
              <Animated.View entering={FadeInDown.delay(400).springify()}>
                <Card variant="default" padding={0} radius={22} style={{ overflow: 'hidden' }}>
                  <View style={styles.mapHeader}>
                    <View style={[styles.mapIcon, { backgroundColor: colors.primaryLight }]}>
                      <Navigation size={18} color={primaryColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cardHeading, { color: colors.text }]}>Workplace Geofence</Text>
                      <Text style={[styles.cardSub, { color: colors.textSecondary }]}>{employee.workplace.name || 'Office'} ({geofenceRadius}m radius)</Text>
                    </View>
                  </View>
                  <View style={[styles.mapBox, { borderColor: colors.border }]}>
                    <GeofenceMap
                      latitude={employee.workplace.latitude}
                      longitude={employee.workplace.longitude}
                      radius={employee.workplace.radius_meters}
                      name={employee.workplace.name}
                      outOfBounds={!!isOutsideGeofence}
                    />
                  </View>
                </Card>
              </Animated.View>
            )}
          </View>

          {/* Side column */}
          <View style={[styles.col, isDesktop && { flex: 2 }]}>
            {/* Leave Balances */}
            <Animated.View entering={FadeInDown.delay(150).springify()}>
              <Card variant="default" padding={0} radius={22} style={{ overflow: 'hidden' }}>
                <View style={styles.listHeader}>
                  <View style={styles.rowCenter}>
                    <View style={[styles.mapIcon, { backgroundColor: '#EEF2FF' }]}>
                      <CalendarDays size={18} color="#6366F1" />
                    </View>
                    <Text style={[styles.cardHeading, { color: colors.text }]}>Leave Balances</Text>
                  </View>
                  <TouchableOpacity onPress={() => router.push('/(employee)/leave/apply' as never)} hitSlop={8}>
                    <Text style={[styles.linkStrong, { color: '#6366F1' }]}>Apply Leave</Text>
                  </TouchableOpacity>
                </View>

                {leaveBalances.length === 0 ? (
                  <Text style={[styles.emptyLine, { color: colors.textSecondary }]}>No leave quotas assigned</Text>
                ) : (
                  <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 12 }}>
                    {leaveBalances.slice(0, 4).map((lb) => {
                      const pct = lb.allocated_days > 0 ? lb.remaining_days / lb.allocated_days : 0;
                      const barColor = pct > 0.5 ? primaryColor : pct > 0.2 ? colors.warning : colors.danger;
                      return (
                        <View key={lb.id} style={[styles.leaveRow, { backgroundColor: colors.surfaceMuted }]}>
                          <View style={styles.rowBetween}>
                            <Text style={[styles.leaveName, { color: colors.text }]}>{stripEmoji(lb.leave_type?.name || 'Leave')}</Text>
                            <Text style={[styles.leaveCount, { color: colors.textSecondary }]}>{lb.remaining_days} / {lb.allocated_days} days left</Text>
                          </View>
                          <View style={[styles.progressTrack, { backgroundColor: colors.backgroundElement }]}>
                            <View style={{ height: '100%', width: `${Math.round(pct * 100)}%`, backgroundColor: barColor, borderRadius: 999 }} />
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
                <TouchableOpacity onPress={() => router.push('/(employee)/leave' as never)} activeOpacity={0.7}>
                  <View style={[styles.cardFooter, { borderTopColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
                    <Text style={[styles.linkStrong, { color: primaryColor }]}>View All Quotas & History</Text>
                    <ArrowRight size={16} color={primaryColor} />
                  </View>
                </TouchableOpacity>
              </Card>
            </Animated.View>

            {/* Recent Attendance */}
            <Animated.View entering={FadeInDown.delay(250).springify()}>
              <Card variant="default" padding={0} radius={22} style={{ overflow: 'hidden' }}>
                <View style={styles.listHeader}>
                  <Text style={[styles.cardHeading, { color: colors.text }]}>Recent Activity</Text>
                  <TouchableOpacity onPress={() => router.push('/(employee)/attendance' as never)} hitSlop={8}>
                    <Text style={[styles.linkStrong, { color: primaryColor }]}>View All</Text>
                  </TouchableOpacity>
                </View>

                {recentAttendance.length === 0 ? (
                  <Text style={[styles.emptyLine, { color: colors.textSecondary }]}>No recent attendance records</Text>
                ) : (
                  <View>
                    {recentAttendance.slice(0, 5).map((a, idx) => (
                      <TouchableOpacity key={a.id} onPress={() => router.push('/(employee)/attendance' as never)} activeOpacity={0.7}>
                        <View style={[styles.activityRow, idx > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                          <View style={[styles.dot, { backgroundColor: a.status === 'present' ? primaryColor : a.status === 'late' ? colors.warning : a.status === 'absent' ? colors.danger : colors.textTertiary }]} />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.activityDate, { color: colors.text }]}>{formatDate(a.date)}</Text>
                            <Text style={[styles.activityTime, { color: colors.textSecondary }]}>
                              {a.clock_in ? formatTime(a.clock_in) : '—'} → {a.clock_out ? formatTime(a.clock_out) : '—'}
                            </Text>
                          </View>
                          <Badge label={a.status.replace('_', ' ')} variant={statusBadgeVariant(a.status)} uppercase={false} />
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </Card>
            </Animated.View>
          </View>
        </View>
      </ScrollView>


      {/* Face Verification Modal */}
      <FaceVerificationModal
        visible={showFaceModal}
        onClose={() => setShowFaceModal(false)}
        onVerified={handleFaceVerified}
        employeeName={profile?.full_name || 'Team Member'}
        officeName={officeName || employee?.workplace?.name || 'Office Workplace'}
        isClockingIn={faceModalType === 'in'}
        isRemote={isRemoteClock}
        remoteReason={remoteReason}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bellBtn: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#EF4444',
    borderWidth: 2,
  },
  avatarRing: {
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  orgBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  orgBadgeName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    maxWidth: 200,
  },
  orgBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 10,
  },
  orgBadgePillLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.75)',
    letterSpacing: 0.5,
  },
  orgBadgePillVal: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6EE7B7',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },

  body: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 20,
  },
  bodyDesktop: {
    flexDirection: 'row',
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  col: { gap: 20 },

  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  clockHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  dot: { width: 9, height: 9, borderRadius: 999 },
  clockStatus: { fontSize: 14, fontWeight: '700' },
  clockDate: { fontSize: 12, fontWeight: '500' },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 12,
  },
  bannerTitle: { fontSize: 14, fontWeight: '700' },
  bannerBody: { fontSize: 13, fontWeight: '500', marginTop: 1 },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  kpiCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    ...Platform.select({
      web: { boxShadow: '0 1px 2px rgba(15,23,42,0.05)' },
      default: { elevation: 1, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
    }),
  },
  kpiIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  kpiValue: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  kpiLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginTop: 4 },
  kpiSub: { fontSize: 11, fontWeight: '500', marginTop: 2 },

  sectionTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, marginBottom: 12 },

  qaCard: {
    width: '31%',
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
    ...Platform.select({
      web: { boxShadow: '0 1px 2px rgba(15,23,42,0.05)' },
      default: { elevation: 1, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
    }),
  },
  qaIcon: { width: 50, height: 50, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  qaLabel: { fontSize: 12, fontWeight: '700', textAlign: 'center' },

  mapHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  mapIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  mapBox: { marginHorizontal: 16, marginBottom: 16, borderRadius: 16, overflow: 'hidden', borderWidth: 1, height: 180 },
  cardHeading: { fontSize: 15, fontWeight: '700' },
  cardSub: { fontSize: 12, fontWeight: '500', marginTop: 1 },

  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  linkStrong: { fontSize: 13, fontWeight: '700' },
  emptyLine: { padding: 24, textAlign: 'center', fontSize: 14, fontWeight: '500' },

  leaveRow: { gap: 8, padding: 12, borderRadius: 14 },
  leaveName: { fontSize: 14, fontWeight: '700' },
  leaveCount: { fontSize: 12, fontWeight: '700' },
  progressTrack: { height: 7, borderRadius: 999, overflow: 'hidden', marginTop: 4 },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderTopWidth: 1 },

  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  activityDate: { fontSize: 14, fontWeight: '700' },
  activityTime: { fontSize: 12, fontWeight: '500', marginTop: 1 },

  fab: {
    position: 'absolute',
    bottom: 28,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  lockedWfhBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F1F5F9',
  },
  lockedWfhBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94A3B8',
  },
  lockedWfhTag: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
  },
  lockedWfhTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#DC2626',
    letterSpacing: 0.5,
  },
});
