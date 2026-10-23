import { ADMIN_NAV } from '@/constants/navigation';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/context/TenantContext';
import { useTheme } from '@/hooks/use-theme';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { LoadingState } from '@/components/ui/States';
import { SidebarLayout } from '@/components/layout/Sidebar';
import { getEmployeeCount, getAllEmployees } from '@/lib/services/employee';
import { getAttendanceStats } from '@/lib/services/attendance';
import { getOrgUsers, getOrganization } from '@/lib/services/organization';
import { getAuditLogs } from '@/lib/services/audit';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useBiometrics } from '@/hooks/useBiometrics';
import { OrgSetupWizard } from '@/components/admin/OrgSetupWizard';
import { formatDate, formatDateTime, getGreeting, formatCurrency } from '@/utils/format';
import {
  HOSPITAL_UNITS,
  EMPLOYMENT_TYPES,
  normalizeHospitalUnit,
  normalizeEmploymentType,
} from '@/constants/config';
import type { Organization, AuditLog, Profile, Employee } from '@/types';
import {
  Users,
  Shield,
  ShieldCheck,
  Calendar,
  Settings,
  Key,
  UserPlus,
  ArrowRight,
  Activity,
  MapPin,
  Award,
  Workflow,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Radio,
  Fingerprint,
  Zap,
  Building2,
  BarChart3,
  PieChart,
  TrendingUp,
  Layers,
  Briefcase,
  FileSpreadsheet,
  ArrowUpRight,
  Filter,
  Compass,
  Check,
  ChevronRight,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';


export default function AdminDashboard() {
  const colors = useTheme();
  const { profile } = useAuth();
  const { organization: tenantOrg } = useTenant();
  const { isEnabled: biometricEnabled, biometricType } = useBiometrics();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [empCount, setEmpCount] = useState(0);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [attendanceStats, setAttendanceStats] = useState({ present: 0, late: 0, halfDay: 0, total: 0 });
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([]);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const currentOrgId = organization?.id || tenantOrg?.id || profile?.organization_id;
  const [showWizard, setShowWizard] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const orgId = tenantOrg?.id || profile.organization_id;

      const [count, attStats, orgUsers, orgData, logs, empList] = await Promise.all([
        getEmployeeCount(orgId),
        getAttendanceStats(today, orgId),
        getOrgUsers(orgId),
        orgId ? getOrganization(orgId) : Promise.resolve(null),
        getAuditLogs(5, orgId),
        getAllEmployees(orgId),
      ]);

      setEmpCount(count);
      setAttendanceStats(attStats);
      setUsers(orgUsers);
      setOrganization(orgData || tenantOrg);
      setRecentLogs(logs);
      setEmployees(empList || []);

      if (orgData && (!orgData.name || orgData.name.includes('Default') || orgData.name === 'New Organization')) {
        setShowWizard(true);
      }
    } catch (err) {
      console.error('Admin dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  }, [profile, tenantOrg]);

  useEffect(() => {
    load();
  }, [load]);

  // Real-time Firestore update subscription via onSnapshot
  useEffect(() => {
    if (!profile) return;
    const orgId = tenantOrg?.id || profile.organization_id;

    const qAudit = query(collection(db, 'audit_logs'), where('organization_id', '==', orgId));
    const unsubAudit = onSnapshot(qAudit, () => {
      load();
    }, (err) => console.warn('Realtime audit listener error:', err));

    const qAttendance = query(collection(db, 'attendance'), where('organization_id', '==', orgId));
    const unsubAttendance = onSnapshot(qAttendance, () => {
      load();
    }, (err) => console.warn('Realtime attendance listener error:', err));

    return () => {
      unsubAudit();
      unsubAttendance();
    };
  }, [profile, tenantOrg, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const hrCount = users.filter((u) => u.role === 'hr').length;
  const adminCount = users.filter((u) => u.role === 'admin').length;
  const activeCount = users.filter((u) => u.is_active).length;
  const totalStaffCount = Math.max(empCount, activeCount, users.length, employees.length);

  // ── Compute Visual Analytics Data ──────────────────────────────────────────
  const unitBreakdown = useMemo(() => {
    const counts: Record<string, number> = {
      'Shanti Memorial Hospital': 0,
      'Gopal Trust': 0,
      'Chikitsa': 0,
    };
    employees.forEach((e) => {
      const u = normalizeHospitalUnit(e.hospital_unit);
      counts[u] = (counts[u] || 0) + 1;
    });
    const total = Math.max(1, employees.length);
    return {
      smh: { count: counts['Shanti Memorial Hospital'], pct: Math.round((counts['Shanti Memorial Hospital'] / total) * 100) },
      gt: { count: counts['Gopal Trust'], pct: Math.round((counts['Gopal Trust'] / total) * 100) },
      chikitsa: { count: counts['Chikitsa'], pct: Math.round((counts['Chikitsa'] / total) * 100) },
      total: employees.length,
    };
  }, [employees]);

  const categoryBreakdown = useMemo(() => {
    let regular = 0;
    let contractual = 0;
    employees.forEach((e) => {
      const cat = normalizeEmploymentType(e.employment_type);
      if (cat === 'Contractual') contractual++;
      else regular++;
    });
    const total = Math.max(1, employees.length);
    return {
      regular,
      regularPct: Math.round((regular / total) * 100),
      contractual,
      contractualPct: Math.round((contractual / total) * 100),
    };
  }, [employees]);

  const [selectedUnitFilter, setSelectedUnitFilter] = useState<'all' | 'Shanti Memorial Hospital' | 'Gopal Trust' | 'Chikitsa'>('all');
  const [selectedAttFilter, setSelectedAttFilter] = useState<'all' | 'present' | 'late' | 'halfDay' | 'absent'>('all');
  const [selectedDeptMetric, setSelectedDeptMetric] = useState<'headcount' | 'payroll'>('headcount');
  const [selectedDeptName, setSelectedDeptName] = useState<string | null>(null);

  // ── Filtered workforce based on interactive unit filter ───────────────────
  const filteredEmployees = useMemo(() => {
    if (selectedUnitFilter === 'all') return employees;
    return employees.filter(e => normalizeHospitalUnit(e.hospital_unit) === selectedUnitFilter);
  }, [employees, selectedUnitFilter]);

  const filteredCategoryBreakdown = useMemo(() => {
    let regular = 0;
    let contractual = 0;
    filteredEmployees.forEach((e) => {
      const cat = normalizeEmploymentType(e.employment_type);
      if (cat === 'Contractual') contractual++;
      else regular++;
    });
    const total = Math.max(1, filteredEmployees.length);
    return {
      regular,
      regularPct: Math.round((regular / total) * 100),
      contractual,
      contractualPct: Math.round((contractual / total) * 100),
      total: filteredEmployees.length,
    };
  }, [filteredEmployees]);

  const filteredPayrollEst = useMemo(() => {
    return filteredEmployees.reduce((sum, e) => sum + (e.basic_salary || 0), 0);
  }, [filteredEmployees]);

  const totalMonthlyPayrollEst = useMemo(() => {
    return employees.reduce((sum, e) => sum + (e.basic_salary || 0), 0);
  }, [employees]);

  const deptBreakdownWithPayroll = useMemo(() => {
    const map: Record<string, { count: number; salary: number }> = {};
    employees.forEach((e) => {
      const d = e.department?.name || 'General Operations';
      if (!map[d]) map[d] = { count: 0, salary: 0 };
      map[d].count += 1;
      map[d].salary += (e.basic_salary || 0);
    });
    const totalCount = Math.max(1, employees.length);
    const totalSalary = Math.max(1, totalMonthlyPayrollEst);
    return Object.entries(map)
      .map(([name, data]) => ({
        name,
        count: data.count,
        countPct: Math.round((data.count / totalCount) * 100),
        salary: data.salary,
        salaryPct: Math.round((data.salary / totalSalary) * 100),
      }))
      .sort((a, b) => (selectedDeptMetric === 'headcount' ? b.count - a.count : b.salary - a.salary))
      .slice(0, 5);
  }, [employees, totalMonthlyPayrollEst, selectedDeptMetric]);

  const attendanceRate = Math.min(100, Math.round(((attendanceStats.present + attendanceStats.halfDay * 0.5) / Math.max(1, totalStaffCount)) * 100));

  const kpis = [
    {
      label: 'Total Staff',
      value: totalStaffCount,
      sub: `${activeCount} active accounts`,
      icon: <Users size={20} color={colors.textSecondary} />,
      bg: colors.surface,
      border: '#e2e8f0',
    },
    {
      label: 'Administrators',
      value: adminCount,
      sub: `${hrCount} HR Managers`,
      icon: <ShieldCheck size={20} color={colors.textSecondary} />,
      bg: colors.surface,
      border: '#e2e8f0',
    },
    {
      label: 'Present Today',
      value: attendanceStats.present,
      sub: `${attendanceStats.late} late arrivals`,
      icon: <Calendar size={20} color={colors.textSecondary} />,
      bg: colors.surface,
      border: '#e2e8f0',
    },
    {
      label: 'Hospital Units',
      value: `${HOSPITAL_UNITS.length} Units`,
      sub: HOSPITAL_UNITS.join(', '),
      icon: <Building2 size={20} color={colors.textSecondary} />,
      bg: colors.surface,
      border: '#e2e8f0',
    },
  ];

  const quickActions = [
    { label: 'Add New User', sub: 'Create login with unit & grade', href: '/(admin)/users', icon: UserPlus, color: colors.primary, bg: colors.background },
    { label: 'User Directory', sub: `${users.length} registered accounts`, href: '/(admin)/users', icon: Key, color: colors.primary, bg: colors.background },
    { label: 'Payroll & Salary Sheets', sub: '28-column unit & category registers', href: '/(hr)/payroll', icon: FileSpreadsheet, color: '#059669', bg: colors.background },
    { label: 'Shifts & Rosters', sub: 'Weekly roster matrix & night allowance', href: '/(hr)/shifts', icon: Clock, color: colors.primary, bg: colors.background },
    { label: 'Security Audit Logs', sub: 'Compliance & access history', href: '/(admin)/audit-logs', icon: Shield, color: colors.primary, bg: colors.background },
    { label: 'Workplace Locations', sub: 'Geofences & office radius', href: '/(hr)/locations', icon: MapPin, color: colors.primary, bg: colors.background },
  ];

  const actionColor = (action: string): 'successLight' | 'warningLight' | 'dangerLight' | 'neutral' => {
    if (action.includes('created') || action.includes('approve') || action.includes('activated')) return 'successLight';
    if (action.includes('deactivat') || action.includes('reject') || action.includes('delete')) return 'dangerLight';
    if (action.includes('role') || action.includes('update') || action.includes('change')) return 'warningLight';
    return 'neutral';
  };

  const mobileKpis = [
    { label: 'Total Staff', value: `${totalStaffCount}`, color: '#0D7377', bg: '#E6F4F4', icon: Users },
    { label: 'Present', value: `${attendanceStats.present}`, color: '#059669', bg: '#D1FAE5', icon: Calendar },
    { label: 'Late', value: `${attendanceStats.late}`, color: '#D97706', bg: '#FEF3C7', icon: AlertTriangle },
    { label: 'Admins', value: `${adminCount}`, color: '#7C3AED', bg: '#EDE9FE', icon: ShieldCheck },
    { label: 'Units', value: `${HOSPITAL_UNITS.length}`, color: '#0369A1', bg: '#E0F2FE', icon: Building2 },
  ];

  const mobileAdminActions = [
    { label: 'Staff & Roles', icon: Users, href: '/(admin)/users', color: '#0D7377', bg: '#E6F4F4' },
    { label: 'Payroll Sheets', icon: FileSpreadsheet, href: '/(hr)/payroll', color: '#059669', bg: '#D1FAE5' },
    { label: 'Attendance', icon: Calendar, href: '/(hr)/attendance', color: '#2563EB', bg: '#EFF6FF' },
    { label: 'Shifts', icon: Clock, href: '/(hr)/shifts', color: '#D97706', bg: '#FEF3C7' },
    { label: 'Audit Logs', icon: Shield, href: '/(admin)/audit-logs', color: '#DC2626', bg: '#FEE2E2' },
    { label: 'Locations', icon: MapPin, href: '/(hr)/locations', color: '#7C3AED', bg: '#EDE9FE' },
    { label: 'Performance', icon: Award, href: '/(hr)/performance', color: '#0284C7', bg: '#E0F2FE' },
    { label: 'Settings', icon: Settings, href: '/(admin)/settings', color: '#475569', bg: '#F1F5F9' },
  ];

  if (loading) return <LoadingState />;

  // ─────────────────────────────────────────────────────────────────────────────
  // REUSABLE VISUALIZATION CARDS
  // ─────────────────────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────────
  // REUSABLE VISUALIZATION CARDS (INTERACTIVE)
  // ─────────────────────────────────────────────────────────────────────────────
  const renderWorkforceChart = () => (
    <View style={vStyles.chartCard}>
      <View style={vStyles.chartHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={[vStyles.chartIconWrap, { backgroundColor: '#EFF6FF' }]}>
            <Building2 size={18} color="#2563EB" />
          </View>
          <View>
            <Text style={vStyles.chartTitle}>Unit & Sub-Brand Allocation</Text>
            <Text style={vStyles.chartSub}>Interactive breakdown across hospital operating units</Text>
          </View>
        </View>
        <Badge
          label={selectedUnitFilter === 'all' ? `${unitBreakdown.total} Total Enrolled` : `${filteredEmployees.length} in Unit`}
          variant="neutral"
        />
      </View>

      {/* Interactive Unit Filter Chips */}
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {(['all', 'Shanti Memorial Hospital', 'Gopal Trust', 'Chikitsa'] as const).map((u) => {
          const isSelected = selectedUnitFilter === u;
          return (
            <TouchableOpacity
              key={u}
              onPress={() => setSelectedUnitFilter(u)}
              style={[
                {
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: isSelected ? '#2563EB' : '#E2E8F0',
                  backgroundColor: isSelected ? '#EFF6FF' : '#F8FAFC',
                },
              ]}
              activeOpacity={0.8}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: isSelected ? '700' : '600',
                  color: isSelected ? '#1D4ED8' : '#64748B',
                }}
              >
                {u === 'all' ? 'All Units' : u === 'Shanti Memorial Hospital' ? 'SMH Main' : u}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Stacked Proportional Unit Bar (Interactive) */}
      <View style={vStyles.stackedBarContainer}>
        <TouchableOpacity
          onPress={() => setSelectedUnitFilter(selectedUnitFilter === 'Shanti Memorial Hospital' ? 'all' : 'Shanti Memorial Hospital')}
          style={[
            vStyles.stackedSegment,
            { width: `${Math.max(4, unitBreakdown.smh.pct)}%`, backgroundColor: '#2563EB', opacity: selectedUnitFilter === 'all' || selectedUnitFilter === 'Shanti Memorial Hospital' ? 1 : 0.35 },
          ]}
        />
        <TouchableOpacity
          onPress={() => setSelectedUnitFilter(selectedUnitFilter === 'Gopal Trust' ? 'all' : 'Gopal Trust')}
          style={[
            vStyles.stackedSegment,
            { width: `${Math.max(4, unitBreakdown.gt.pct)}%`, backgroundColor: '#DB2777', opacity: selectedUnitFilter === 'all' || selectedUnitFilter === 'Gopal Trust' ? 1 : 0.35 },
          ]}
        />
        <TouchableOpacity
          onPress={() => setSelectedUnitFilter(selectedUnitFilter === 'Chikitsa' ? 'all' : 'Chikitsa')}
          style={[
            vStyles.stackedSegment,
            { width: `${Math.max(4, unitBreakdown.chikitsa.pct)}%`, backgroundColor: '#16A34A', opacity: selectedUnitFilter === 'all' || selectedUnitFilter === 'Chikitsa' ? 1 : 0.35 },
          ]}
        />
      </View>

      {/* Interactive Unit Legends */}
      <View style={vStyles.unitGrid}>
        <TouchableOpacity
          onPress={() => setSelectedUnitFilter(selectedUnitFilter === 'Shanti Memorial Hospital' ? 'all' : 'Shanti Memorial Hospital')}
          style={[
            vStyles.unitTile,
            {
              borderColor: selectedUnitFilter === 'Shanti Memorial Hospital' ? '#2563EB' : '#BFDBFE',
              backgroundColor: selectedUnitFilter === 'Shanti Memorial Hospital' ? '#EFF6FF' : '#F8FAFC',
              transform: [{ scale: selectedUnitFilter === 'Shanti Memorial Hospital' ? 1.02 : 1 }],
            },
          ]}
          activeOpacity={0.8}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={[vStyles.unitDot, { backgroundColor: '#2563EB' }]} />
            <Text style={vStyles.unitName} numberOfLines={1}>Shanti Memorial</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
            <Text style={vStyles.unitCount}>{unitBreakdown.smh.count}</Text>
            <Text style={vStyles.unitPct}>({unitBreakdown.smh.pct}%)</Text>
          </View>
          <Text style={vStyles.unitLocation}>Main Hospital · Tap to filter</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setSelectedUnitFilter(selectedUnitFilter === 'Gopal Trust' ? 'all' : 'Gopal Trust')}
          style={[
            vStyles.unitTile,
            {
              borderColor: selectedUnitFilter === 'Gopal Trust' ? '#DB2777' : '#FBCFE8',
              backgroundColor: selectedUnitFilter === 'Gopal Trust' ? '#FDF2F8' : '#F8FAFC',
              transform: [{ scale: selectedUnitFilter === 'Gopal Trust' ? 1.02 : 1 }],
            },
          ]}
          activeOpacity={0.8}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={[vStyles.unitDot, { backgroundColor: '#DB2777' }]} />
            <Text style={vStyles.unitName} numberOfLines={1}>Gopal Trust</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
            <Text style={vStyles.unitCount}>{unitBreakdown.gt.count}</Text>
            <Text style={vStyles.unitPct}>({unitBreakdown.gt.pct}%)</Text>
          </View>
          <Text style={vStyles.unitLocation}>Co-located Campus · Tap to filter</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setSelectedUnitFilter(selectedUnitFilter === 'Chikitsa' ? 'all' : 'Chikitsa')}
          style={[
            vStyles.unitTile,
            {
              borderColor: selectedUnitFilter === 'Chikitsa' ? '#16A34A' : '#BBF7D0',
              backgroundColor: selectedUnitFilter === 'Chikitsa' ? '#F0FDF4' : '#F8FAFC',
              transform: [{ scale: selectedUnitFilter === 'Chikitsa' ? 1.02 : 1 }],
            },
          ]}
          activeOpacity={0.8}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={[vStyles.unitDot, { backgroundColor: '#16A34A' }]} />
            <Text style={vStyles.unitName} numberOfLines={1}>Chikitsa</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
            <Text style={vStyles.unitCount}>{unitBreakdown.chikitsa.count}</Text>
            <Text style={vStyles.unitPct}>({unitBreakdown.chikitsa.pct}%)</Text>
          </View>
          <Text style={vStyles.unitLocation}>Satellite Facility · Tap to filter</Text>
        </TouchableOpacity>
      </View>

      {/* Dynamic Employment Category Breakdown (Updates with Unit Filter) */}
      <View style={{ marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <View>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E293B' }}>
              Category Ratio ({selectedUnitFilter === 'all' ? 'All Facilities' : selectedUnitFilter})
            </Text>
            <Text style={{ fontSize: 11, color: '#64748B' }}>
              Estimated Monthly Base: {formatCurrency(filteredPayrollEst)}
            </Text>
          </View>
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#2563EB' }}>
            {filteredCategoryBreakdown.regularPct}% Reg · {filteredCategoryBreakdown.contractualPct}% Cont
          </Text>
        </View>

        <View style={vStyles.dualBar}>
          <View style={[vStyles.dualSegment, { width: `${Math.max(5, filteredCategoryBreakdown.regularPct)}%`, backgroundColor: '#10B981' }]} />
          <View style={[vStyles.dualSegment, { width: `${Math.max(5, filteredCategoryBreakdown.contractualPct)}%`, backgroundColor: '#F59E0B' }]} />
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={[vStyles.miniDot, { backgroundColor: '#10B981' }]} />
            <Text style={{ fontSize: 12, color: '#334155', fontWeight: '600' }}>
              Regular: {filteredCategoryBreakdown.regular} staff
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={[vStyles.miniDot, { backgroundColor: '#F59E0B' }]} />
            <Text style={{ fontSize: 12, color: '#334155', fontWeight: '600' }}>
              Contractual: {filteredCategoryBreakdown.contractual} staff
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderAttendanceAnalytics = () => (
    <View style={vStyles.chartCard}>
      <View style={vStyles.chartHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={[vStyles.chartIconWrap, { backgroundColor: '#DCFCE7' }]}>
            <Calendar size={18} color="#16A34A" />
          </View>
          <View>
            <Text style={vStyles.chartTitle}>Today&apos;s Attendance Real-Time Status</Text>
            <Text style={vStyles.chartSub}>Interactive drilldown by punch category</Text>
          </View>
        </View>
        <View style={[vStyles.rateBadge, { backgroundColor: attendanceRate >= 80 ? '#DCFCE7' : '#FEF3C7' }]}>
          <Text style={[vStyles.rateText, { color: attendanceRate >= 80 ? '#15803D' : '#B45309' }]}>
            {attendanceRate}% Present
          </Text>
        </View>
      </View>

      {/* Progress Bar for Attendance Status */}
      <View style={vStyles.stackedBarContainer}>
        <TouchableOpacity
          onPress={() => setSelectedAttFilter(selectedAttFilter === 'present' ? 'all' : 'present')}
          style={[
            vStyles.stackedSegment,
            { width: `${Math.max(3, Math.round((attendanceStats.present / Math.max(1, totalStaffCount)) * 100))}%`, backgroundColor: '#10B981', opacity: selectedAttFilter === 'all' || selectedAttFilter === 'present' ? 1 : 0.4 },
          ]}
        />
        <TouchableOpacity
          onPress={() => setSelectedAttFilter(selectedAttFilter === 'late' ? 'all' : 'late')}
          style={[
            vStyles.stackedSegment,
            { width: `${Math.max(3, Math.round((attendanceStats.late / Math.max(1, totalStaffCount)) * 100))}%`, backgroundColor: '#F59E0B', opacity: selectedAttFilter === 'all' || selectedAttFilter === 'late' ? 1 : 0.4 },
          ]}
        />
        <TouchableOpacity
          onPress={() => setSelectedAttFilter(selectedAttFilter === 'halfDay' ? 'all' : 'halfDay')}
          style={[
            vStyles.stackedSegment,
            { width: `${Math.max(3, Math.round((attendanceStats.halfDay / Math.max(1, totalStaffCount)) * 100))}%`, backgroundColor: '#3B82F6', opacity: selectedAttFilter === 'all' || selectedAttFilter === 'halfDay' ? 1 : 0.4 },
          ]}
        />
      </View>

      {/* Interactive Attendance Detail Metrics */}
      <View style={vStyles.attGrid}>
        <TouchableOpacity
          onPress={() => setSelectedAttFilter(selectedAttFilter === 'present' ? 'all' : 'present')}
          style={[
            vStyles.attChip,
            { backgroundColor: '#F0FDF4', borderColor: selectedAttFilter === 'present' ? '#16A34A' : '#BBF7D0', borderWidth: selectedAttFilter === 'present' ? 2 : 1 },
          ]}
          activeOpacity={0.8}
        >
          <Text style={[vStyles.attChipVal, { color: '#166534' }]}>{attendanceStats.present}</Text>
          <Text style={[vStyles.attChipLabel, { color: '#15803D' }]}>On Time</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setSelectedAttFilter(selectedAttFilter === 'late' ? 'all' : 'late')}
          style={[
            vStyles.attChip,
            { backgroundColor: '#FEF3C7', borderColor: selectedAttFilter === 'late' ? '#D97706' : '#FDE68A', borderWidth: selectedAttFilter === 'late' ? 2 : 1 },
          ]}
          activeOpacity={0.8}
        >
          <Text style={[vStyles.attChipVal, { color: '#92400E' }]}>{attendanceStats.late}</Text>
          <Text style={[vStyles.attChipLabel, { color: '#B45309' }]}>Late</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setSelectedAttFilter(selectedAttFilter === 'halfDay' ? 'all' : 'halfDay')}
          style={[
            vStyles.attChip,
            { backgroundColor: '#EFF6FF', borderColor: selectedAttFilter === 'halfDay' ? '#2563EB' : '#BFDBFE', borderWidth: selectedAttFilter === 'halfDay' ? 2 : 1 },
          ]}
          activeOpacity={0.8}
        >
          <Text style={[vStyles.attChipVal, { color: '#1E40AF' }]}>{attendanceStats.halfDay}</Text>
          <Text style={[vStyles.attChipLabel, { color: '#1D4ED8' }]}>Half-Day</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setSelectedAttFilter(selectedAttFilter === 'absent' ? 'all' : 'absent')}
          style={[
            vStyles.attChip,
            { backgroundColor: '#F1F5F9', borderColor: selectedAttFilter === 'absent' ? '#475569' : '#E2E8F0', borderWidth: selectedAttFilter === 'absent' ? 2 : 1 },
          ]}
          activeOpacity={0.8}
        >
          <Text style={[vStyles.attChipVal, { color: '#475569' }]}>
            {Math.max(0, totalStaffCount - (attendanceStats.present + attendanceStats.late + attendanceStats.halfDay))}
          </Text>
          <Text style={[vStyles.attChipLabel, { color: '#64748B' }]}>Off / Leave</Text>
        </TouchableOpacity>
      </View>

      {/* Interactive Drilldown Banner */}
      {selectedAttFilter !== 'all' && (
        <View style={{ marginTop: 12, padding: 10, backgroundColor: '#F8FAFC', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 12, color: '#334155', fontWeight: '600' }}>
            Filtered: {selectedAttFilter === 'present' ? 'On Time' : selectedAttFilter === 'late' ? 'Late Arrivals' : selectedAttFilter === 'halfDay' ? 'Half-Day' : 'Absent / On Leave'} ({selectedAttFilter === 'present' ? attendanceStats.present : selectedAttFilter === 'late' ? attendanceStats.late : selectedAttFilter === 'halfDay' ? attendanceStats.halfDay : Math.max(0, totalStaffCount - (attendanceStats.present + attendanceStats.late + attendanceStats.halfDay))} staff)
          </Text>
          <TouchableOpacity onPress={() => router.push('/(hr)/attendance' as never)}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#0D7377' }}>View Staff Details →</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderPayrollWidget = () => (
    <View style={vStyles.chartCard}>
      <View style={vStyles.chartHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={[vStyles.chartIconWrap, { backgroundColor: '#FDF2F8' }]}>
            <FileSpreadsheet size={18} color="#DB2777" />
          </View>
          <View>
            <Text style={vStyles.chartTitle}>Monthly Payroll Commitment</Text>
            <Text style={vStyles.chartSub}>28-column compliant register generation</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/(hr)/payroll' as never)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
        >
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>Open Cycles</Text>
          <ArrowUpRight size={14} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginTop: 8 }}>
        <View>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>
            Base Wage Pool (Est.)
          </Text>
          <Text style={{ fontSize: 22, fontWeight: '800', color: '#0F172A', marginTop: 2 }}>
            {formatCurrency(totalMonthlyPayrollEst)}
          </Text>
          <Text style={{ fontSize: 11, color: '#10B981', fontWeight: '600', marginTop: 2 }}>
            Active across SMH, Gopal Trust & Chikitsa
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/(hr)/payroll' as never)}
          style={{ backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8 }}
        >
          <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>Download Sheet</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderDepartmentDistribution = () => (
    <View style={vStyles.chartCard}>
      <View style={vStyles.chartHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={[vStyles.chartIconWrap, { backgroundColor: '#EDE9FE' }]}>
            <Layers size={18} color="#7C3AED" />
          </View>
          <View>
            <Text style={vStyles.chartTitle}>Department Analytics</Text>
            <Text style={vStyles.chartSub}>Interactive distribution across clinical & support squads</Text>
          </View>
        </View>

        {/* Metric Switcher */}
        <View style={{ flexDirection: 'row', gap: 4, backgroundColor: '#F1F5F9', padding: 3, borderRadius: 8 }}>
          <TouchableOpacity
            onPress={() => setSelectedDeptMetric('headcount')}
            style={[
              { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
              selectedDeptMetric === 'headcount' && { backgroundColor: '#7C3AED' },
            ]}
          >
            <Text style={{ fontSize: 10, fontWeight: '700', color: selectedDeptMetric === 'headcount' ? '#FFF' : '#64748B' }}>
              Headcount
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSelectedDeptMetric('payroll')}
            style={[
              { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
              selectedDeptMetric === 'payroll' && { backgroundColor: '#7C3AED' },
            ]}
          >
            <Text style={{ fontSize: 10, fontWeight: '700', color: selectedDeptMetric === 'payroll' ? '#FFF' : '#64748B' }}>
              Payroll Share
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ gap: 10, marginTop: 12 }}>
        {deptBreakdownWithPayroll.map((dept) => {
          const isSelected = selectedDeptName === dept.name;
          const displayPct = selectedDeptMetric === 'headcount' ? dept.countPct : dept.salaryPct;
          return (
            <TouchableOpacity
              key={dept.name}
              onPress={() => setSelectedDeptName(isSelected ? null : dept.name)}
              style={[
                { padding: 8, borderRadius: 10, borderWidth: 1, borderColor: isSelected ? '#7C3AED' : 'transparent', backgroundColor: isSelected ? '#F5F3FF' : 'transparent' },
              ]}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <Text style={{ fontSize: 12, fontWeight: isSelected ? '700' : '600', color: isSelected ? '#6D28D9' : '#334155' }}>
                  {dept.name}
                </Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: isSelected ? '#6D28D9' : '#0F172A' }}>
                  {selectedDeptMetric === 'headcount' ? `${dept.count} Staff (${dept.countPct}%)` : `${formatCurrency(dept.salary)} (${dept.salaryPct}%)`}
                </Text>
              </View>
              <View style={vStyles.deptBarBg}>
                <View style={[vStyles.deptBarFill, { width: `${Math.max(5, displayPct)}%` }]} />
              </View>
              {isSelected && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingTop: 4, borderTopWidth: 1, borderTopColor: '#DDD6FE' }}>
                  <Text style={{ fontSize: 11, color: '#6D28D9' }}>Avg. Wage: {formatCurrency(Math.round(dept.salary / Math.max(1, dept.count)))}</Text>
                  <Text style={{ fontSize: 11, color: '#6D28D9', fontWeight: '600' }}>Active in {selectedUnitFilter === 'all' ? 'All Units' : selectedUnitFilter}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // MOBILE LAYOUT
  // ─────────────────────────────────────────────────────────────────────────────
  const mobileContent = (
    <ScrollView
      style={mStyles.root}
      contentContainerStyle={mStyles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0D7377" />}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Admin Hero Banner ──────────────────────────────────────────────── */}
      <View style={mStyles.heroBanner}>
        <View style={mStyles.heroBannerRow}>
          <View style={{ flex: 1 }}>
            <Text style={mStyles.heroGreeting}>{getGreeting()}</Text>
            <Text style={mStyles.heroName}>{profile?.full_name?.split(' ')[0] ?? 'Admin'}</Text>
            <Text style={mStyles.heroDate}>Hospital Administration Console</Text>
          </View>
          <View style={mStyles.heroRight}>
            {profile && (
              <View style={mStyles.heroAvatarRing}>
                <Avatar name={profile.full_name} url={profile.avatar_url} size={44} />
              </View>
            )}
            <View style={mStyles.systemOkPill}>
              <CheckCircle2 size={10} color="#FFF" />
              <Text style={mStyles.systemOkText}>LIVE</Text>
            </View>
          </View>
        </View>

        {/* Org info strip */}
        <View style={mStyles.orgStrip}>
          <View style={mStyles.orgChip}>
            <Text style={mStyles.orgChipLabel}>Organization</Text>
            <Text style={mStyles.orgChipValue} numberOfLines={1}>{organization?.name || 'Subedge Technology'}</Text>
          </View>
          <View style={mStyles.orgDivider} />
          <View style={mStyles.orgChip}>
            <Text style={mStyles.orgChipLabel}>Units</Text>
            <Text style={mStyles.orgChipValue}>3 Brands</Text>
          </View>
          <View style={mStyles.orgDivider} />
          <View style={mStyles.orgChip}>
            <Text style={mStyles.orgChipLabel}>Active Staff</Text>
            <Text style={mStyles.orgChipValue}>{totalStaffCount}</Text>
          </View>
        </View>
      </View>

      {/* ── Horizontal KPI Strip ──────────────────────────────────────────── */}
      <Animated.View entering={FadeInDown.delay(60).duration(350).springify()}>
        <Text style={mStyles.sectionTitle}>Today&apos;s Snapshot</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={mStyles.kpiStrip}>
          {mobileKpis.map((k, i) => {
            const Icon = k.icon;
            return (
              <View key={i} style={[mStyles.kpiChip, { backgroundColor: k.bg }]}>
                <View style={[mStyles.kpiChipIcon, { backgroundColor: 'rgba(255,255,255,0.7)' }]}>
                  <Icon size={16} color={k.color} />
                </View>
                <Text style={[mStyles.kpiChipValue, { color: k.color }]} numberOfLines={1}>{k.value}</Text>
                <Text style={mStyles.kpiChipLabel} numberOfLines={1}>{k.label}</Text>
              </View>
            );
          })}
        </ScrollView>
      </Animated.View>

      {/* ── Quick Admin Actions Grid ─────────────────────────────────── */}
      <Animated.View entering={FadeInDown.delay(120).duration(350).springify()}>
        <Text style={mStyles.sectionTitle}>Operations Shortcuts</Text>
        <View style={mStyles.quickGrid}>
          {mobileAdminActions.map((qa) => {
            const Icon = qa.icon;
            return (
              <TouchableOpacity
                key={qa.href + qa.label}
                onPress={() => router.push(qa.href as never)}
                style={mStyles.quickTile}
                activeOpacity={0.75}
              >
                <View style={[mStyles.quickTileIcon, { backgroundColor: qa.bg }]}>
                  <Icon size={24} color={qa.color} />
                </View>
                <Text style={mStyles.quickTileLabel} numberOfLines={1}>{qa.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Animated.View>



      <Animated.View entering={FadeInDown.delay(200).duration(350).springify()} style={{ paddingHorizontal: 16 }}>
        <Text style={[mStyles.sectionTitle, { paddingHorizontal: 0, marginTop: 4 }]}>Workforce & Attendance Analytics</Text>
        {renderWorkforceChart()}
        <View style={{ height: 12 }} />
        {renderAttendanceAnalytics()}
        <View style={{ height: 12 }} />
        {renderDepartmentDistribution()}
        <View style={{ height: 12 }} />
        {renderPayrollWidget()}
      </Animated.View>

      {/* ── Recent Audit Events ────────────────────────────────────────────── */}
      <Animated.View entering={FadeInDown.delay(240).duration(350).springify()}>
        <View style={mStyles.card}>
          <View style={mStyles.cardHead}>
            <View style={[mStyles.cardIconWrap, { backgroundColor: '#FEF3C7' }]}>
              <Activity size={16} color="#D97706" />
            </View>
            <Text style={mStyles.cardTitle}>Recent Security Events</Text>
            <TouchableOpacity onPress={() => router.push('/(admin)/audit-logs' as never)}>
              <Text style={mStyles.cardActionText}>View All</Text>
            </TouchableOpacity>
          </View>

          {recentLogs.length === 0 ? (
            <Text style={mStyles.emptyText}>No audit events recorded yet.</Text>
          ) : (
            <View style={{ paddingBottom: 4 }}>
              {recentLogs.map((log, idx) => (
                <View key={log.id} style={[mStyles.logRow, idx < recentLogs.length - 1 && { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }]}>
                  <View style={[mStyles.logDot, {
                    backgroundColor:
                      actionColor(log.action) === 'successLight' ? '#10B981' :
                      actionColor(log.action) === 'dangerLight' ? '#EF4444' :
                      actionColor(log.action) === 'warningLight' ? '#F59E0B' : '#94A3B8'
                  }]} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Badge label={log.action.replace('_', ' ')} variant={actionColor(log.action)} />
                      <Text style={mStyles.logEntity}>{log.entity_type}</Text>
                    </View>
                    <Text style={mStyles.logTime}>{formatDateTime(log.created_at)}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity style={mStyles.cardFooter} onPress={() => router.push('/(admin)/audit-logs' as never)}>
            <Text style={mStyles.cardFooterText}>Complete Audit Trail</Text>
            <ArrowRight size={14} color="#0D7377" />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <View style={{ height: 24 }} />
    </ScrollView>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // DESKTOP LAYOUT
  // ─────────────────────────────────────────────────────────────────────────────
  const desktopContent = (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentDesktop}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Hero Welcome */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, letterSpacing: 0.3 }}>
            {getGreeting()},
          </Text>
          <Text style={{ fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.5 }}>
            {profile?.full_name || 'Administrator'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>
              {formatDate(new Date().toISOString())} · Multi-Unit Healthcare Management
            </Text>
            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primaryLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: `${colors.primary}25` }}>
              <Building2 size={13} color={colors.primary} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>
                {organization?.name || 'Organization'}
              </Text>
              <Text style={{ fontSize: 11, color: colors.primary, opacity: 0.6 }}>·</Text>
              <View style={{ backgroundColor: colors.primary, paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 4 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#FFF', letterSpacing: 0.4 }}>
                  ORG ID: {currentOrgId || 'N/A'}
                </Text>
              </View>
            </View>
          </View>
        </View>
        <Avatar name={profile?.full_name || 'Admin'} url={profile?.avatar_url} size={48} />
      </View>

      {/* KPI Cards Row */}
      <View style={styles.kpiRowDesktop}>
        {kpis.map((k, idx) => (
          <Animated.View
            key={k.label}
            entering={FadeInDown.delay(idx * 60).duration(300).springify()}
            style={[styles.kpiCard, { borderColor: k.border }]}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={styles.kpiIconWrap}>
                {k.icon}
              </View>
            </View>
            <Text style={styles.kpiLabel}>{k.label}</Text>
            <Text style={styles.kpiValue}>{k.value}</Text>
            <Text style={styles.kpiSub}>{k.sub}</Text>
          </Animated.View>
        ))}
      </View>

      {/* Main 2-Column Grid */}
      <View style={styles.gridDesktop}>
        {/* Left Column: Visual Data Graphs + Shortcuts */}
        <View style={styles.colMain}>


          <Animated.View entering={FadeInDown.delay(180).duration(350).springify()}>
            {renderWorkforceChart()}
          </Animated.View>

          <View style={{ flexDirection: 'row', gap: 20 }}>
            <View style={{ flex: 1 }}>
              <Animated.View entering={FadeInDown.delay(200).duration(350).springify()}>
                {renderAttendanceAnalytics()}
              </Animated.View>
            </View>
            <View style={{ flex: 1 }}>
              <Animated.View entering={FadeInDown.delay(240).duration(350).springify()}>
                {renderPayrollWidget()}
              </Animated.View>
            </View>
          </View>

          <Animated.View entering={FadeInDown.delay(280).duration(350).springify()}>
            {renderDepartmentDistribution()}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(320).duration(350).springify()}>
            <Text style={[styles.sectionHeading, { color: colors.text }]}>Admin Shortcuts</Text>
            <View style={styles.quickGrid}>
              {quickActions.map((qa) => {
                const Icon = qa.icon;
                return (
                  <TouchableOpacity
                    key={qa.href + qa.label}
                    onPress={() => router.push(qa.href as never)}
                    style={[styles.quickCard, { borderColor: '#e2e8f0' }]}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.quickIconWrap, { backgroundColor: 'rgba(255,255,255,0.8)' }]}>
                      <Icon size={22} color={qa.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.quickLabel, { color: colors.text }]}>{qa.label}</Text>
                      <Text style={[styles.quickSub, { color: colors.textSecondary }]}>{qa.sub}</Text>
                    </View>
                    <ArrowRight size={16} color={qa.color} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>
        </View>

        {/* Right Column: Recent Audit Activity */}
        <View style={styles.colSide}>
          <Animated.View entering={FadeInDown.delay(360).duration(350).springify()}>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: '#e2e8f0' }]}>
              <View style={styles.cardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={[styles.cardIconWrap, { backgroundColor: '#fef3c7' }]}>
                    <Activity size={18} color="#b45309" />
                  </View>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Recent Audit Events</Text>
                </View>
                <TouchableOpacity onPress={() => router.push('/(admin)/audit-logs' as never)}>
                  <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>View All</Text>
                </TouchableOpacity>
              </View>

              {recentLogs.length === 0 ? (
                <View style={{ padding: 32, alignItems: 'center' }}>
                  <Shield size={32} color={colors.textSecondary} />
                  <Text style={{ color: colors.textSecondary, marginTop: 8, fontSize: 13 }}>
                    No audit events recorded yet.
                  </Text>
                </View>
              ) : (
                <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
                  {recentLogs.map((log, idx) => (
                    <View
                      key={log.id}
                      style={[
                        styles.logRow,
                        idx !== recentLogs.length - 1 && { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
                      ]}
                    >
                      <View style={{ flex: 1, gap: 2 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Badge label={log.action.replace('_', ' ')} variant={actionColor(log.action)} />
                          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text }}>
                            {log.entity_type}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                          {formatDateTime(log.created_at)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              <TouchableOpacity
                style={[styles.cardFooter, { borderTopColor: '#f1f5f9' }]}
                onPress={() => router.push('/(admin)/audit-logs' as never)}
              >
                <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 13 }}>
                  Complete Audit Trail
                </Text>
                <ArrowRight size={14} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </View>
    </ScrollView>
  );

  return (
    <>
      <SidebarLayout items={ADMIN_NAV}>
        {isDesktop ? desktopContent : mobileContent}
      </SidebarLayout>

      <OrgSetupWizard
        visible={showWizard}
        organization={organization}
        onComplete={() => {
          setShowWizard(false);
          load();
        }}
      />
    </>
  );
}

// ─── VISUAL DATA COMPONENT STYLES ─────────────────────────────────────────────
const vStyles = StyleSheet.create({
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    flexWrap: 'wrap',
    gap: 8,
  },
  chartIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  chartSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  stackedBarContainer: {
    height: 10,
    borderRadius: 6,
    overflow: 'hidden',
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    marginBottom: 14,
  },
  stackedSegment: {
    height: '100%',
  },
  unitGrid: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  unitTile: {
    flex: 1,
    minWidth: 130,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  unitDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  unitName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
  },
  unitCount: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  unitPct: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  unitLocation: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  dualBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
  },
  dualSegment: {
    height: '100%',
  },
  miniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  rateBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  rateText: {
    fontSize: 11,
    fontWeight: '800',
  },
  attGrid: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  attChip: {
    flex: 1,
    minWidth: 70,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  attChipVal: {
    fontSize: 16,
    fontWeight: '800',
  },
  attChipLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  deptBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  deptBarFill: {
    height: '100%',
    backgroundColor: '#7C3AED',
    borderRadius: 3,
  },
});

// ─── MOBILE STYLES ────────────────────────────────────────────────────────────
const mStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { paddingBottom: 40 },
  heroBanner: {
    backgroundColor: '#0D7377',
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 0,
    marginBottom: 16,
  },
  heroBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  heroGreeting: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  heroName: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  heroDate: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  heroRight: { alignItems: 'center', gap: 6 },
  heroAvatarRing: {
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: 24,
    padding: 2,
  },
  systemOkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  systemOkText: { fontSize: 10, color: '#FFF', fontWeight: '800' },

  orgStrip: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginHorizontal: -20,
  },
  orgChip: { flex: 1, alignItems: 'center' },
  orgChipLabel: { fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: '600', textTransform: 'uppercase' },
  orgChipValue: { fontSize: 12, color: '#FFFFFF', fontWeight: '800', marginTop: 2 },
  orgDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 4 },

  sectionTitle: {
    fontSize: 16, fontWeight: '800', color: '#0F172A',
    paddingHorizontal: 16, marginBottom: 10, letterSpacing: -0.2,
  },

  kpiStrip: { paddingHorizontal: 16, gap: 10, paddingBottom: 4, paddingRight: 24 },
  kpiChip: {
    width: 90, paddingVertical: 14, paddingHorizontal: 10,
    borderRadius: 16, alignItems: 'center', gap: 5,
  },
  kpiChipIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  kpiChipValue: { fontSize: 15, fontWeight: '800', textAlign: 'center' },
  kpiChipLabel: { fontSize: 10, color: '#64748B', fontWeight: '600', textTransform: 'uppercase', textAlign: 'center' },

  quickGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 12, gap: 8, marginBottom: 20,
  },
  quickTile: { width: '22%', alignItems: 'center', paddingVertical: 10 },
  quickTileIcon: {
    width: 52, height: 52, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  quickTileLabel: { fontSize: 11, fontWeight: '700', color: '#334155', textAlign: 'center' },

  card: {
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 18, borderWidth: 1, borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  cardHead: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12,
  },
  cardIconWrap: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: '#0F172A' },
  cardActionText: { fontSize: 12, fontWeight: '800', color: '#0D7377' },
  emptyText: { textAlign: 'center', fontSize: 13, color: '#94A3B8', paddingVertical: 20 },

  logRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  logDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  logEntity: { fontSize: 12, fontWeight: '600', color: '#334155' },
  logTime: { fontSize: 11, color: '#94A3B8', marginTop: 3 },

  cardFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: '#F1F5F9', marginTop: 4,
  },
  cardFooterText: { fontSize: 13, fontWeight: '700', color: '#0D7377' },
});

// ─── DESKTOP STYLES ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { gap: 24, paddingBottom: 60, paddingHorizontal: 16, paddingTop: 20 },
  contentDesktop: { maxWidth: 1200, alignSelf: 'center', width: '100%', paddingHorizontal: 36, paddingTop: 28, gap: 28 },

  kpiRowDesktop: { flexDirection: 'row', gap: 16 },
  kpiCard: {
    flex: 1, minWidth: 140, padding: 20,
    borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0',
    backgroundColor: '#fff', gap: 8,
  },
  kpiIconWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  kpiLabel: { fontSize: 13, fontWeight: '500', color: '#64748b' },
  kpiValue: { fontSize: 24, fontWeight: '700', color: '#0b1c30' },
  kpiSub: { fontSize: 12, color: '#94a3b8' },

  gridDesktop: { flexDirection: 'row', gap: 28, alignItems: 'flex-start' },
  colMain: { flex: 3, gap: 24 },
  colSide: { flex: 2, gap: 20 },

  sectionHeading: { fontSize: 16, fontWeight: '700', marginBottom: 12, letterSpacing: -0.2 },

  quickGrid: { gap: 12 },
  quickCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff',
  },
  quickIconWrap: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: 15, fontWeight: '600' },
  quickSub: { fontSize: 13, marginTop: 2, color: '#64748b' },

  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 14 },
  cardIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700' },

  logRow: { paddingVertical: 12 },
  cardFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1,
  },
});
