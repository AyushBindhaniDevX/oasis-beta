import { FaceVerificationModal } from '@/components/attendance/FaceVerificationModal';
import { RegularizationModal } from '@/components/attendance/RegularizationModal';
import {
  CraftButton,
  CraftCard,
  CraftHeader,
  Typography,
  T,
  S,
} from '@/components/ui/CraftKit';
import { MONTHS } from '@/constants/config';
import { useTenant } from '@/context/TenantContext';
import { useAuth } from '@/hooks/useAuth';
import {
  clockIn, clockOut,
  endBreak,
  getAttendanceHistory, getTodayAttendance,
  startBreak,
} from '@/lib/services/attendance';
import { getEmployeeByProfileId } from '@/lib/services/employee';
import { calculateDistance, getCurrentLocation } from '@/lib/services/location';
import type { Attendance, Employee } from '@/types';
import { formatMinutes, formatTime } from '@/utils/format';
import {
  AlertTriangle,
  CalendarClock,
  CalendarX,
  CheckCircle2,
  ChevronDown, ChevronUp,
  Clock,
  Coffee,
  Globe,
  Lock,
  LogOut as LogOutIcon,
  Play, ScanFace,
  Search,
  ShieldCheck,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/* ─── Notion tokens ──────────────────────────────────────────────────── */
const N = {
  primary: '#5645d4',
  onPrimary: '#ffffff',
  ink: '#1a1a1a',
  charcoal: '#37352f',
  steel: '#787671',
  muted: '#bbb8b1',
  canvas: '#ffffff',
  surface: '#f6f5f4',
  surfaceSoft: '#fafaf9',
  hairline: '#e5e3df',
  hairlineSoft: '#ede9e4',
  hairlineStrong: '#c8c4be',
  tintPeach: '#ffe8d4',
  tintRose: '#fde0ec',
  tintMint: '#d9f3e1',
  tintLavender: '#e6e0f5',
  tintSky: '#dcecfa',
  brandOrange: '#dd5b00',
  brandOrangeDeep: '#793400',
  brandPurple800: '#391c57',
  brandGreen: '#1aae39',
  semanticError: '#e03131',
  linkBlue: '#0075de',
} as const;

const FONT = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  web: '"Inter", -apple-system, system-ui, "Segoe UI", Helvetica, sans-serif',
}) as string;

/* ─── Static helpers & isolated components ────────────────────────────── */
const formatShortDate = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    return `${MONTHS[d.getMonth()].substring(0, 3)} ${d.getDate()}, ${d.toLocaleDateString('en-US', { weekday: 'short' })}`;
  } catch {
    return dateStr;
  }
};

const formatTimer = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

export interface MonthGroup {
  key: string;
  label: string;
  monthShort: string;
  year: string;
  items: Attendance[];
  stats: {
    present: number;
    late: number;
    absent: number;
    total: number;
  };
}

const LiveShiftTimer = React.memo(function LiveShiftTimer({ clockIn }: { clockIn?: string | null }) {
  const [elapsed, setElapsed] = useState(() => {
    if (!clockIn) return 0;
    return Math.max(0, Math.floor((Date.now() - new Date(clockIn).getTime()) / 1000));
  });

  useEffect(() => {
    if (!clockIn) {
      setElapsed(0);
      return;
    }
    const start = new Date(clockIn).getTime();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [clockIn]);

  return (
    <View style={sv.timerPill}>
      <Clock size={11} color={N.brandGreen} />
      <Text style={sv.timerText}>{formatTimer(elapsed)}</Text>
    </View>
  );
});

const StatusTag = React.memo(function StatusTag({ item }: { item: Attendance }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    present: { bg: N.tintMint, fg: N.brandGreen, label: 'Present' },
    late: { bg: N.tintPeach, fg: N.brandOrangeDeep, label: 'Late' },
    absent: { bg: N.tintRose, fg: N.semanticError, label: 'Absent' },
  };
  const c = map[item.status] || map.present;
  return (
    <View style={[sv.tag, { backgroundColor: c.bg }]}>
      <Text style={[sv.tagText, { color: c.fg }]}>{c.label}</Text>
    </View>
  );
});

const MonthSectionItem = React.memo(function MonthSectionItem({
  group,
  expanded,
  onToggle,
  onRegularize,
}: {
  group: MonthGroup;
  expanded: boolean;
  onToggle: (key: string) => void;
  onRegularize: (date: string) => void;
}) {
  return (
    <Animated.View
      entering={FadeInDown.duration(250)}
      layout={Layout.springify().damping(18)}
    >
      <CraftCard variant="base" style={sv.monthCard} padding={0}>
        <TouchableOpacity
          onPress={() => onToggle(group.key)}
          style={sv.monthHeader}
          activeOpacity={0.75}
        >
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <Text style={sv.monthTitle}>{group.label}</Text>
              <Text style={sv.monthCount}>{group.items.length} entries</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              <View style={[sv.miniChip, { backgroundColor: N.tintMint }]}>
                <View style={[sv.miniDot, { backgroundColor: N.brandGreen }]} />
                <Text style={[sv.miniChipText, { color: N.brandGreen }]}>
                  {group.stats.present} present
                </Text>
              </View>
              {group.stats.late > 0 && (
                <View style={[sv.miniChip, { backgroundColor: N.tintPeach }]}>
                  <View style={[sv.miniDot, { backgroundColor: N.brandOrangeDeep }]} />
                  <Text style={[sv.miniChipText, { color: N.brandOrangeDeep }]}>
                    {group.stats.late} late
                  </Text>
                </View>
              )}
              {group.stats.absent > 0 && (
                <View style={[sv.miniChip, { backgroundColor: N.tintRose }]}>
                  <View style={[sv.miniDot, { backgroundColor: N.semanticError }]} />
                  <Text style={[sv.miniChipText, { color: N.semanticError }]}>
                    {group.stats.absent} absent
                  </Text>
                </View>
              )}
            </View>
          </View>
          <View style={sv.chevronWrap}>
            {expanded ? (
              <ChevronUp size={16} color={N.steel} />
            ) : (
              <ChevronDown size={16} color={N.steel} />
            )}
          </View>
        </TouchableOpacity>

        {expanded && (
          <Animated.View entering={FadeInDown.duration(180)} style={sv.monthBody}>
            {group.items.map((item, idx) => (
              <View
                key={item.id || `${item.date}-${idx}`}
                style={[
                  sv.row,
                  idx < group.items.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: N.hairlineSoft,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={sv.rowDate}>{formatShortDate(item.date)}</Text>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      marginTop: 2,
                      flexWrap: 'wrap',
                    }}
                  >
                    <Clock size={11} color={N.steel} />
                    <Text style={sv.rowTime}>
                      {item.clock_in ? formatTime(item.clock_in) : '--:--'} →{' '}
                      {item.clock_out ? formatTime(item.clock_out) : '--:--'}
                    </Text>
                    {item.working_minutes > 0 && (
                      <Text style={sv.rowDuration}>
                        ({formatMinutes(item.working_minutes)})
                      </Text>
                    )}
                    {item.is_remote && (
                      <View style={[sv.tag, { backgroundColor: N.tintSky }]}>
                        <Globe size={9} color={N.linkBlue} />
                        <Text style={[sv.tagText, { color: N.linkBlue, fontSize: 9 }]}>
                          Remote
                        </Text>
                      </View>
                    )}
                    {item.face_verified && (
                      <View style={[sv.tag, { backgroundColor: N.tintLavender }]}>
                        <ShieldCheck size={9} color={N.brandPurple800} />
                        <Text
                          style={[
                            sv.tagText,
                            { color: N.brandPurple800, fontSize: 9 },
                          ]}
                        >
                          Face
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <StatusTag item={item} />
                  <TouchableOpacity
                    onPress={() => onRegularize(item.date)}
                    style={sv.rowAction}
                    activeOpacity={0.7}
                  >
                    <CalendarClock size={10} color={N.brandPurple800} />
                    <Text style={sv.rowActionText}>Fix</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </Animated.View>
        )}
      </CraftCard>
    </Animated.View>
  );
});

export default function AttendanceScreen() {
  const { profile } = useAuth();
  const { isFeatureEnabled, organization, employee: tenantEmp, workplace: tenantWp } = useTenant();
  const activeOrgId = organization?.id || tenantEmp?.organization_id || profile?.organization_id;
  const isWfhEnabled = isFeatureEnabled('wfh');
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null);
  const [records, setRecords] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [clockLoading, setClockLoading] = useState(false);
  const [clockError, setClockError] = useState('');

  const [currentLoc, setCurrentLoc] = useState<{ latitude: number; longitude: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [isRemoteMode, setIsRemoteMode] = useState(false);
  const [remoteReason] = useState('Work From Home');

  const [showFaceModal, setShowFaceModal] = useState(false);
  const [faceModalType, setFaceModalType] = useState<'in' | 'out'>('in');
  const [pendingLoc, setPendingLoc] = useState({ latitude: 0, longitude: 0 });
  const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'late' | 'absent'>('all');

  const [showRegularize, setShowRegularize] = useState(false);
  const [regularizeDate, setRegularizeDate] = useState<string | null>(null);

  /* ── Month collapsible state ─────────────────────────────── */
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});

  const loadData = useCallback(async () => {
    if (!profile) return;
    try {
      const emp = tenantEmp || (await getEmployeeByProfileId(profile.id, activeOrgId));
      if (emp && !emp.workplace && tenantWp) emp.workplace = tenantWp;
      setEmployee(emp);
      if (emp) {
        const [history, today] = await Promise.all([
          getAttendanceHistory(emp.id, 90),
          getTodayAttendance(emp.id),
        ]);
        setRecords(history);
        setTodayAttendance(today);
      }
    } catch (e) {
      console.error('Attendance load error:', e);
    } finally {
      setLoading(false);
    }
  }, [profile, activeOrgId, tenantEmp, tenantWp]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const fetchLoc = () => {
      getCurrentLocation()
        .then((loc) => {
          setCurrentLoc(loc);
          if (employee?.workplace?.latitude && employee?.workplace?.longitude) {
            setDistance(Math.round(calculateDistance(
              loc.latitude, loc.longitude,
              employee.workplace.latitude, employee.workplace.longitude,
            )));
          }
        })
        .catch(() => { });
    };
    fetchLoc();
    const interval = setInterval(fetchLoc, 45000);
    return () => clearInterval(interval);
  }, [employee]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const geofenceRadius = employee?.workplace?.radius_meters || 200;
  const isOutsideGeofence = Boolean(
    distance !== null &&
    employee?.workplace?.latitude &&
    employee?.workplace?.longitude &&
    distance > geofenceRadius,
  );

  const handleInitiateClock = async (type: 'in' | 'out', remote = false) => {
    setClockError('');
    const profileId = profile?.id;
    if (!profileId) {
      setClockError('Authentication required to record shift.');
      return;
    }
    if (remote && !isWfhEnabled) {
      setClockError('Remote clock-in is locked for your organization.');
      return;
    }
    setClockLoading(true);
    setIsRemoteMode(remote);
    try {
      let loc = currentLoc;
      try {
        loc = await getCurrentLocation();
        setCurrentLoc(loc);
      } catch {
        if (!remote && type === 'in') {
          throw new Error('GPS location required. Enable location or use Remote Clock-In.');
        }
      }
      const activeLoc = loc || { latitude: 0, longitude: 0 };
      setPendingLoc(activeLoc);
      if (employee?.workplace?.latitude && activeLoc.latitude) {
        const dist = Math.round(calculateDistance(
          activeLoc.latitude, activeLoc.longitude,
          employee.workplace.latitude, employee.workplace.longitude,
        ));
        setDistance(dist);
        if (type === 'in' && !remote && dist > geofenceRadius) {
          setClockError(`Outside workplace (${dist}m). Move closer or use Remote Clock-In.`);
          setClockLoading(false);
          return;
        }
      }
      // On Web: Execute punch directly with instantaneous feedback (no modal barrier)
      if (Platform.OS === 'web') {
        if (type === 'in') {
          await clockIn(activeLoc.latitude, activeLoc.longitude, 'web_verified', profileId, {
            isRemote: remote,
            remoteReason: remote ? remoteReason : undefined,
          });
        } else {
          await clockOut(activeLoc.latitude, activeLoc.longitude, 'web_verified', profileId);
        }
        await loadData();
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

      // Record punch directly on mobile
      if (type === 'in') {
        await clockIn(activeLoc.latitude, activeLoc.longitude, 'device_biometric_verified', profileId, {
          isRemote: remote,
          remoteReason: remote ? remoteReason : undefined,
        });
      } else {
        await clockOut(activeLoc.latitude, activeLoc.longitude, 'device_biometric_verified', profileId);
      }
      await loadData();
    } catch (err: unknown) {
      setClockError(err instanceof Error ? err.message : 'Could not prepare attendance.');
    } finally {
      setClockLoading(false);
    }
  };

  const handleVerifiedFace = async (faceSnapshot?: string) => {
    if (!profile) return;
    setClockLoading(true);
    try {
      if (faceModalType === 'in') {
        await clockIn(pendingLoc.latitude, pendingLoc.longitude, faceSnapshot, profile.id, {
          isRemote: isRemoteMode,
          remoteReason: isRemoteMode ? remoteReason : undefined,
        });
      } else {
        await clockOut(pendingLoc.latitude, pendingLoc.longitude, faceSnapshot, profile.id);
      }
      setShowFaceModal(false);
      await loadData();
    } catch (err: unknown) {
      setClockError(err instanceof Error ? err.message : 'Clocking request failed.');
    } finally {
      setClockLoading(false);
    }
  };

  const handleBreak = async (action: 'start' | 'end') => {
    if (!employee) return;
    setClockLoading(true);
    try {
      if (action === 'start') await startBreak(employee.id, 'Tea / Rest Break');
      else await endBreak(employee.id);
      await loadData();
    } catch (err: unknown) {
      setClockError(err instanceof Error ? err.message : 'Break action failed.');
    } finally {
      setClockLoading(false);
    }
  };

  /* ── Group records by month ───────────────────────────────── */
  const groupedByMonth = useMemo(() => {
    const filteredRecords = records.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const t = search.toLowerCase();
      return (
        r.date.includes(t) ||
        r.status.includes(t) ||
        formatShortDate(r.date).toLowerCase().includes(t)
      );
    });

    const groups: Record<string, Attendance[]> = {};
    filteredRecords.forEach((r) => {
      const d = new Date(r.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });

    return Object.entries(groups)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, items]) => {
        const [y, m] = key.split('-');
        const monthDate = new Date(Number(y), Number(m) - 1, 1);
        const label = `${MONTHS[monthDate.getMonth()]} ${y}`;
        return {
          key,
          label,
          monthShort: MONTHS[monthDate.getMonth()].substring(0, 3),
          year: y,
          items: items.sort((a, b) => b.date.localeCompare(a.date)),
          stats: {
            present: items.filter((i) => i.status === 'present').length,
            late: items.filter((i) => i.status === 'late').length,
            absent: items.filter((i) => i.status === 'absent').length,
            total: items.length,
          },
        };
      });
  }, [records, statusFilter, search]);

  const toggleMonth = useCallback((key: string, isDefaultFirst: boolean) => {
    setExpandedMonths((prev) => {
      const current = prev[key] ?? isDefaultFirst;
      return { ...prev, [key]: !current };
    });
  }, []);

  const handleOpenRegularize = useCallback((date?: string | null) => {
    setRegularizeDate(date || null);
    setShowRegularize(true);
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: N.canvas, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: N.steel, fontFamily: FONT }}>Loading attendance…</Text>
      </View>
    );
  }

  const isClockedIn = Boolean(todayAttendance?.clock_in && !todayAttendance?.clock_out);
  const isClockedOut = Boolean(todayAttendance?.clock_in && todayAttendance?.clock_out);
  const activeBreak = todayAttendance?.breaks?.find((b: any) => !b.end);

  const currentMonthRecords = records.filter((r) => {
    const d = new Date(r.date);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const presentDays = currentMonthRecords.filter((r) => r.status === 'present').length;
  const lateDays = currentMonthRecords.filter((r) => r.status === 'late').length;
  const absentDays = currentMonthRecords.filter((r) => r.status === 'absent').length;
  const attendanceRate = currentMonthRecords.length > 0
    ? Math.round((presentDays / currentMonthRecords.length) * 100)
    : 0;

  /* ─── HERO CARD ───────────────────────────────────────────── */
  const HeroCard = () => (
    <CraftCard variant="base" style={sv.hero}>
      <View style={sv.heroTopRow}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View
            style={[
              sv.statusDot,
              {
                backgroundColor: isClockedIn
                  ? N.brandGreen
                  : isClockedOut
                    ? N.steel
                    : N.brandOrange,
              },
            ]}
          />
          <Text style={sv.heroStatus}>
            {isClockedIn
              ? activeBreak
                ? 'On Break'
                : 'Shift Active'
              : isClockedOut
                ? 'Shift Complete'
                : 'Not Clocked In'}
          </Text>
        </View>
        {isClockedIn && <LiveShiftTimer clockIn={todayAttendance?.clock_in} />}
      </View>

      <View style={sv.heroGrid}>
        {[
          {
            label: 'Clock In',
            value: todayAttendance?.clock_in ? formatTime(todayAttendance.clock_in) : '--:--',
          },
          {
            label: 'Clock Out',
            value: todayAttendance?.clock_out ? formatTime(todayAttendance.clock_out) : '--:--',
          },
          {
            label: 'Duration',
            value: todayAttendance?.working_minutes
              ? formatMinutes(todayAttendance.working_minutes)
              : '0h 0m',
            accent: true,
          },
        ].map((s) => (
          <View key={s.label} style={sv.heroCell}>
            <Text style={sv.heroCellLabel}>{s.label}</Text>
            <Text style={[sv.heroCellValue, s.accent && { color: N.brandGreen }]}>
              {s.value}
            </Text>
          </View>
        ))}
      </View>

      {distance !== null && employee?.workplace?.latitude && (
        <View
          style={[
            sv.geofenceBadge,
            { backgroundColor: isOutsideGeofence ? N.tintPeach : N.tintMint },
          ]}
        >
          {isOutsideGeofence ? (
            <AlertTriangle size={11} color={N.brandOrangeDeep} />
          ) : (
            <CheckCircle2 size={11} color={N.brandGreen} />
          )}
          <Text
            style={[
              sv.geofenceText,
              { color: isOutsideGeofence ? N.brandOrangeDeep : N.brandGreen },
            ]}
          >
            {isOutsideGeofence
              ? `${distance}m away · Remote only`
              : `Inside ${employee.workplace.name || 'office'} · ${distance}m`}
          </Text>
        </View>
      )}

      <View style={{ marginTop: 12, gap: 8 }}>
        {!isClockedIn && !isClockedOut && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <CraftButton
              title="Office Clock In"
              variant="primary"
              size="md"
              icon={<ScanFace size={15} color={N.onPrimary} />}
              onPress={() => handleInitiateClock('in', false)}
              disabled={clockLoading}
              style={{ flex: 1 }}
            />
            {isWfhEnabled ? (
              <CraftButton
                title="Remote"
                variant="secondary"
                size="md"
                icon={<Globe size={15} color={N.ink} />}
                onPress={() => handleInitiateClock('in', true)}
                disabled={clockLoading}
                style={{ flex: 1 }}
              />
            ) : (
              <View style={[sv.btnSecondary, { flex: 1, opacity: 0.55 }]}>
                <Lock size={13} color={N.steel} />
                <Text style={[sv.btnSecondaryText, { color: N.steel }]}>WFH Locked</Text>
              </View>
            )}
          </View>
        )}

        {isClockedIn && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <CraftButton
              title={activeBreak ? 'Resume' : 'Break'}
              variant="secondary"
              size="md"
              icon={
                activeBreak ? (
                  <Play size={15} color={N.ink} />
                ) : (
                  <Coffee size={15} color={N.ink} />
                )
              }
              onPress={() => handleBreak(activeBreak ? 'end' : 'start')}
              disabled={clockLoading}
              style={{ flex: 1 }}
            />
            <CraftButton
              title={clockLoading ? 'Processing…' : 'Clock Out'}
              variant="danger"
              size="md"
              icon={<LogOutIcon size={15} color={N.onPrimary} />}
              onPress={() => handleInitiateClock('out')}
              disabled={clockLoading}
              style={{ flex: 1.4 }}
            />
          </View>
        )}

        {isClockedOut && (
          <View
            style={[
              sv.tag,
              {
                backgroundColor: N.tintMint,
                paddingVertical: 10,
                justifyContent: 'center',
              },
            ]}
          >
            <CheckCircle2 size={13} color={N.brandGreen} />
            <Text style={[sv.tagText, { color: N.brandGreen, fontSize: 12 }]}>
              Today's attendance recorded
            </Text>
          </View>
        )}

        {clockError ? (
          <View
            style={[
              sv.tag,
              {
                backgroundColor: N.tintRose,
                paddingVertical: 8,
                justifyContent: 'center',
              },
            ]}
          >
            <AlertTriangle size={11} color={N.semanticError} />
            <Text
              style={[sv.tagText, { color: N.semanticError, flex: 1 }]}
              numberOfLines={2}
            >
              {clockError}
            </Text>
          </View>
        ) : null}
      </View>
    </CraftCard>
  );

  /* ─── STAT STRIP ──────────────────────────────────────────── */
  const StatStrip = () => (
    <View style={sv.statStrip}>
      {[
        { label: 'Rate', value: `${attendanceRate}%`, fg: N.brandGreen },
        { label: 'Present', value: `${presentDays}`, fg: N.linkBlue },
        { label: 'Late', value: `${lateDays}`, fg: N.brandOrangeDeep },
        { label: 'Absent', value: `${absentDays}`, fg: N.semanticError },
      ].map((s) => (
        <View key={s.label} style={sv.statCell}>
          <Text style={[sv.statValue, { color: s.fg }]}>{s.value}</Text>
          <Text style={sv.statLabel}>{s.label}</Text>
        </View>
      ))}
    </View>
  );

  /* ─── FILTER BAR ──────────────────────────────────────────── */
  const FilterBar = () => (
    <View style={sv.filterBar}>
      <View style={sv.searchBox}>
        <Search size={13} color={N.steel} />
        <TextInput
          placeholder="Search date, month, status…"
          placeholderTextColor={N.muted}
          value={search}
          onChangeText={setSearch}
          style={sv.searchInput}
        />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6 }}
      >
        {(['all', 'present', 'late', 'absent'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setStatusFilter(tab)}
            style={[sv.filterChip, statusFilter === tab && sv.filterChipActive]}
            activeOpacity={0.8}
          >
            <Text
              style={[
                sv.filterChipText,
                statusFilter === tab && sv.filterChipTextActive,
              ]}
            >
              {tab === 'all' ? 'All' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  /* ══════════════════════════════════════════════════════════
     MOBILE
  ══════════════════════════════════════════════════════════ */
  if (!isDesktop) {
    return (
      <View style={{ flex: 1, backgroundColor: T.canvas }}>
        <CraftHeader
          title="Attendance & Logs"
          subtitle="Biometric punch logs, workplace shifts & regularizations"
          right={
            <CraftButton
              title="Fix attendance"
              variant="secondary"
              size="sm"
              icon={<CalendarClock size={12} color={T.ink} />}
              onPress={() => {
                setRegularizeDate(null);
                setShowRegularize(true);
              }}
            />
          }
        />
        <ScrollView
          contentContainerStyle={{
            paddingTop: 16,
            paddingBottom: 40,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={T.ink}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={{ paddingHorizontal: 16 }}>
            <HeroCard />
            <StatStrip />
          </View>

          <View style={{ marginTop: 20 }}>
            <FilterBar />
          </View>

          <View style={{ paddingHorizontal: 16, marginTop: 16, gap: 10 }}>
            {groupedByMonth.length === 0 ? (
              <View style={sv.emptyBox}>
                <CalendarX size={28} color={N.steel} strokeWidth={1.5} />
                <Text style={sv.emptyText}>No attendance records</Text>
              </View>
            ) : (
              groupedByMonth.map((g, idx) => {
                const isDefaultFirst = idx === 0;
                const isExpanded = expandedMonths[g.key] ?? isDefaultFirst;
                return (
                  <MonthSectionItem
                    key={g.key}
                    group={g}
                    expanded={isExpanded}
                    onToggle={(k) => toggleMonth(k, isDefaultFirst)}
                    onRegularize={handleOpenRegularize}
                  />
                );
              })
            )}
          </View>
        </ScrollView>

        <FaceVerificationModal
          visible={showFaceModal}
          onClose={() => setShowFaceModal(false)}
          onVerified={handleVerifiedFace}
          employeeName={profile?.full_name || 'Staff'}
          officeName={employee?.workplace?.name || 'Office'}
          isClockingIn={faceModalType === 'in'}
          isRemote={isRemoteMode}
          remoteReason={remoteReason}
          enrolledFaceUrl={employee?.profile?.avatar_url || null}
          profileId={profile?.id}
        />
        <RegularizationModal
          visible={showRegularize}
          onClose={() => {
            setShowRegularize(false);
            setRegularizeDate(null);
          }}
          employeeId={employee?.id || ''}
          defaultDate={regularizeDate}
          onSubmitted={loadData}
        />
      </View>
    );
  }

  /* ══════════════════════════════════════════════════════════
     DESKTOP
  ══════════════════════════════════════════════════════════ */
  return (
    <View style={{ flex: 1, backgroundColor: T.canvas }}>
      <CraftHeader
        title="Attendance & Shifts"
        subtitle={`${profile?.full_name || 'Staff'} · ${employee?.designation || employee?.department?.name || 'Team member'}`}
        right={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <CraftButton
              title="Fix attendance"
              variant="secondary"
              size="sm"
              icon={<CalendarClock size={14} color={T.ink} />}
              onPress={() => {
                setRegularizeDate(null);
                setShowRegularize(true);
              }}
            />
            {!isClockedIn && !isClockedOut && (
              <CraftButton
                title="Clock In"
                variant="primary"
                size="sm"
                icon={<ScanFace size={14} color={T.card} />}
                onPress={() => handleInitiateClock('in', false)}
              />
            )}
            {isClockedIn && (
              <CraftButton
                title="Clock Out"
                variant="danger"
                size="sm"
                icon={<LogOutIcon size={14} color={T.card} />}
                onPress={() => handleInitiateClock('out')}
              />
            )}
          </View>
        }
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={ds.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={T.ink}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <HeroCard />
        <StatStrip />

        <FilterBar />

      <View style={{ gap: 12 }}>
        {groupedByMonth.length === 0 ? (
          <View style={sv.emptyBox}>
            <CalendarX size={28} color={N.steel} strokeWidth={1.5} />
            <Text style={sv.emptyText}>No attendance records</Text>
          </View>
        ) : (
          groupedByMonth.map((g, idx) => {
            const isDefaultFirst = idx === 0;
            const isExpanded = expandedMonths[g.key] ?? isDefaultFirst;
            return (
              <MonthSectionItem
                key={g.key}
                group={g}
                expanded={isExpanded}
                onToggle={(k) => toggleMonth(k, isDefaultFirst)}
                onRegularize={handleOpenRegularize}
              />
            );
          })
        )}
      </View>

      <FaceVerificationModal
        visible={showFaceModal}
        onClose={() => setShowFaceModal(false)}
        onVerified={handleVerifiedFace}
        employeeName={profile?.full_name || 'Staff'}
        officeName={employee?.workplace?.name || 'Office'}
        isClockingIn={faceModalType === 'in'}
        isRemote={isRemoteMode}
        remoteReason={remoteReason}
        enrolledFaceUrl={employee?.profile?.avatar_url || null}
        profileId={profile?.id}
      />
      <RegularizationModal
        visible={showRegularize}
        onClose={() => {
          setShowRegularize(false);
          setRegularizeDate(null);
        }}
        employeeId={employee?.id || ''}
        defaultDate={regularizeDate}
        onSubmitted={loadData}
      />
      </ScrollView>
    </View>
  );
}

/* ─── STYLES ───────────────────────────────────────────────────────── */
const sv = StyleSheet.create({
  pageEyebrow: {
    fontFamily: FONT,
    fontSize: 10,
    fontWeight: '600',
    color: N.steel,
    letterSpacing: 1.2,
  },
  pageTitle: {
    fontFamily: FONT,
    fontSize: 24,
    fontWeight: '600',
    color: N.ink,
    letterSpacing: -0.8,
    marginTop: 3,
  },

  /* Hero */
  hero: {
    backgroundColor: N.canvas,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: N.hairline,
    padding: 16,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  heroStatus: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: '600',
    color: N.ink,
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: N.tintMint,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9999,
  },
  timerText: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '700',
    color: N.brandGreen,
    fontVariant: ['tabular-nums'],
  },
  heroGrid: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: N.hairlineSoft,
  },
  heroCell: { flex: 1, alignItems: 'center' },
  heroCellLabel: {
    fontFamily: FONT,
    fontSize: 9,
    fontWeight: '600',
    color: N.steel,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  heroCellValue: {
    fontFamily: FONT,
    fontSize: 18,
    fontWeight: '600',
    color: N.ink,
    letterSpacing: -0.4,
    marginTop: 2,
  },
  geofenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  geofenceText: { fontFamily: FONT, fontSize: 10, fontWeight: '600' },

  /* Stat strip */
  statStrip: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  statCell: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: N.canvas,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: N.hairline,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: FONT,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  statLabel: {
    fontFamily: FONT,
    fontSize: 9,
    fontWeight: '500',
    color: N.steel,
    marginTop: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  /* Filter bar */
  filterBar: {
    paddingHorizontal: 16,
    gap: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: N.canvas,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: N.hairline,
  },
  searchInput: {
    flex: 1,
    fontFamily: FONT,
    fontSize: 13,
    color: N.ink,
    padding: 0,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: N.hairline,
    backgroundColor: N.canvas,
  },
  filterChipActive: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  filterChipText: {
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: '500',
    color: N.steel,
  },
  filterChipTextActive: { color: N.onPrimary, fontWeight: '600' },

  /* Month card */
  monthCard: {
    backgroundColor: N.canvas,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: N.hairline,
    overflow: 'hidden',
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  monthTitle: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: '600',
    color: N.ink,
    letterSpacing: -0.2,
  },
  monthCount: {
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: '500',
    color: N.steel,
  },
  chevronWrap: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: N.surface,
  },
  miniChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  miniDot: { width: 5, height: 5, borderRadius: 3 },
  miniChipText: { fontFamily: FONT, fontSize: 10, fontWeight: '600' },
  monthBody: {
    borderTopWidth: 1,
    borderTopColor: N.hairlineSoft,
    paddingHorizontal: 14,
  },

  /* Row */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 8,
  },
  rowDate: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: '600',
    color: N.ink,
  },
  rowTime: { fontFamily: FONT, fontSize: 11, color: N.steel },
  rowDuration: {
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: '600',
    color: N.brandGreen,
  },
  rowAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: N.tintLavender,
  },
  rowActionText: {
    fontFamily: FONT,
    fontSize: 9,
    fontWeight: '600',
    color: N.brandPurple800,
    letterSpacing: 0.2,
  },

  /* Tag */
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  tagText: { fontFamily: FONT, fontSize: 10, fontWeight: '600' },

  /* Buttons */
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: N.primary,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  btnPrimaryText: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: '500',
    color: N.onPrimary,
  },
  btnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: N.canvas,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: N.hairlineStrong,
  },
  btnSecondaryText: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: '500',
    color: N.ink,
  },

  compactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: N.tintLavender,
  },
  compactBtnText: {
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: '600',
    color: N.brandPurple800,
  },

  /* Empty */
  emptyBox: {
    padding: 32,
    alignItems: 'center',
    backgroundColor: N.canvas,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: N.hairline,
    borderStyle: 'dashed',
  },
  emptyText: {
    fontFamily: FONT,
    fontSize: 13,
    color: N.steel,
    marginTop: 8,
  },
});

const ds = StyleSheet.create({
  content: {
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 32,
    paddingTop: 28,
    paddingBottom: 60,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  pageTitle: {
    fontFamily: FONT,
    fontSize: 32,
    fontWeight: '600',
    color: N.ink,
    letterSpacing: -1.2,
    marginTop: 4,
  },
  pageSub: {
    fontFamily: FONT,
    fontSize: 13,
    color: N.steel,
    marginTop: 4,
  },
});