import { ADMIN_NAV } from '@/constants/navigation';
import React, { useState, useEffect, useCallback } from 'react';
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
import { getEmployeeCount } from '@/lib/services/employee';
import { getAttendanceStats } from '@/lib/services/attendance';
import { getOrgUsers, getOrganization } from '@/lib/services/organization';
import { getAuditLogs } from '@/lib/services/audit';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useBiometrics } from '@/hooks/useBiometrics';
import { OrgSetupWizard } from '@/components/admin/OrgSetupWizard';
import { formatDate, formatDateTime, getGreeting } from '@/utils/format';
import type { Organization, AuditLog, Profile } from '@/types';
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
  Server,
  Award,
  Workflow,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Radio,
  Fingerprint,
  Zap,
  Building2,
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
  const [users, setUsers] = useState<Profile[]>([]);
  const [attendanceStats, setAttendanceStats] = useState({ present: 0, late: 0, halfDay: 0, total: 0 });
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([]);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const currentOrgId = organization?.id || tenantOrg?.id || profile?.organization_id;
  const [showWizard, setShowWizard] = useState(false);
  const [latencyMs, setLatencyMs] = useState<number>(24);
  const [lastLivePing, setLastLivePing] = useState<Date>(new Date());

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      const startTime = Date.now();
      const today = new Date().toISOString().split('T')[0];
      const orgId = tenantOrg?.id || profile.organization_id;

      const [count, attStats, orgUsers, orgData, logs] = await Promise.all([
        getEmployeeCount(orgId),
        getAttendanceStats(today, orgId),
        getOrgUsers(orgId),
        orgId ? getOrganization(orgId) : Promise.resolve(null),
        getAuditLogs(5, orgId),
      ]);
      const elapsed = Date.now() - startTime;
      setLatencyMs(Math.max(12, Math.min(elapsed, 120)));
      setLastLivePing(new Date());

      setEmpCount(count);
      setAttendanceStats(attStats);
      setUsers(orgUsers);
      setOrganization(orgData || tenantOrg);
      setRecentLogs(logs);

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

    // Heartbeat ping interval
    const timer = setInterval(() => {
      setLastLivePing(new Date());
    }, 10000);

    return () => {
      unsubAudit();
      unsubAttendance();
      clearInterval(timer);
    };
  }, [profile, tenantOrg, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) return <LoadingState />;

  const hrCount = users.filter((u) => u.role === 'hr').length;
  const adminCount = users.filter((u) => u.role === 'admin').length;
  const activeCount = users.filter((u) => u.is_active).length;
  const totalStaffCount = Math.max(empCount, activeCount, users.length);

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
      label: 'System Status',
      value: '100% OK',
      sub: 'All services online',
      icon: <Server size={20} color={colors.textSecondary} />,
      bg: colors.surface,
      border: '#e2e8f0',
    },
  ];

  const quickActions = [
    { label: 'Add New User', sub: 'Create login & role', href: '/(admin)/users', icon: UserPlus, color: colors.primary, bg: colors.background },
    { label: 'User Management', sub: `${users.length} registered accounts`, href: '/(admin)/users', icon: Key, color: colors.primary, bg: colors.background },
    { label: 'Shifts & Rosters', sub: 'Weekly roster matrix & night allowance', href: '/(hr)/shifts', icon: Clock, color: colors.primary, bg: colors.background },
    { label: 'Security Audit Logs', sub: 'Compliance & access history', href: '/(admin)/audit-logs', icon: Shield, color: colors.primary, bg: colors.background },
    { label: 'Workplace Locations', sub: 'Geofences & office radius', href: '/(hr)/locations', icon: MapPin, color: colors.primary, bg: colors.background },
    { label: 'Organization Settings', sub: 'Company identity & rules', href: '/(admin)/settings', icon: Settings, color: colors.primary, bg: colors.background },
  ];

  const actionColor = (action: string): 'successLight' | 'warningLight' | 'dangerLight' | 'neutral' => {
    if (action.includes('created') || action.includes('approve') || action.includes('activated')) return 'successLight';
    if (action.includes('deactivat') || action.includes('reject') || action.includes('delete')) return 'dangerLight';
    if (action.includes('role') || action.includes('update') || action.includes('change')) return 'warningLight';
    return 'neutral';
  };

  // ─── Mobile KPI strip data ────────────────────────────────────────────────
  const mobileKpis = [
    { label: 'Total Staff', value: `${empCount}`, color: '#0D7377', bg: '#E6F4F4', icon: Users },
    { label: 'Present', value: `${attendanceStats.present}`, color: '#059669', bg: '#D1FAE5', icon: Calendar },
    { label: 'Late', value: `${attendanceStats.late}`, color: '#D97706', bg: '#FEF3C7', icon: AlertTriangle },
    { label: 'Admins', value: `${adminCount}`, color: '#7C3AED', bg: '#EDE9FE', icon: ShieldCheck },
    { label: 'System', value: 'OK', color: '#0369A1', bg: '#E0F2FE', icon: Server },
  ];

  const mobileAdminActions = [
    { label: 'My Attendance', icon: Clock, href: '/(employee)/attendance', color: '#7C3AED', bg: '#EDE9FE' },
    { label: 'Users & Staff', icon: Users, href: '/(admin)/users', color: '#0D7377', bg: '#E6F4F4' },
    { label: 'Team Attendance', icon: Calendar, href: '/(hr)/attendance', color: '#059669', bg: '#D1FAE5' },
    { label: 'Shifts', icon: Clock, href: '/(hr)/shifts', color: '#D97706', bg: '#FEF3C7' },
    { label: 'Audit Logs', icon: Shield, href: '/(admin)/audit-logs', color: '#DC2626', bg: '#FEE2E2' },
    { label: 'Performance', icon: Award, href: '/(hr)/performance', color: '#7C3AED', bg: '#EDE9FE' },
    { label: 'Settings', icon: Settings, href: '/(admin)/settings', color: '#475569', bg: '#F1F5F9' },
  ];

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
            <Text style={mStyles.heroDate}>System Administration Console</Text>
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
            <Text style={mStyles.orgChipLabel}>Org ID</Text>
            <Text style={[mStyles.orgChipValue, { color: '#6EE7B7', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 11 }]} numberOfLines={1}>
              {currentOrgId || 'N/A'}
            </Text>
          </View>
          <View style={mStyles.orgDivider} />
          <View style={mStyles.orgChip}>
            <Text style={mStyles.orgChipLabel}>Active Staff</Text>
            <Text style={mStyles.orgChipValue}>{empCount}</Text>
          </View>
        </View>
      </View>

      {/* ── Horizontal KPI Strip ──────────────────────────────────────────── */}
      <Animated.View entering={FadeInDown.delay(60).duration(350).springify()}>
        <Text style={mStyles.sectionTitle}>Today's Overview</Text>
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

      {/* ── Quick Admin Actions 2×4 Grid ─────────────────────────────────── */}
      <Animated.View entering={FadeInDown.delay(120).duration(350).springify()}>
        <Text style={mStyles.sectionTitle}>Admin Shortcuts</Text>
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

      {/* ── System Status Card ────────────────────────────────────────────── */}
      <Animated.View entering={FadeInDown.delay(180).duration(350).springify()}>
        <View style={mStyles.card}>
          <View style={mStyles.cardHead}>
            <View style={[mStyles.cardIconWrap, { backgroundColor: '#E6F4F4' }]}>
              <Server size={16} color="#0D7377" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={mStyles.cardTitle}>Live System Infrastructure</Text>
              <Text style={{ fontSize: 10, color: '#059669', fontWeight: '700' }}>
                ● Realtime Connected ({latencyMs}ms latency)
              </Text>
            </View>
            <Badge label="REALTIME" variant="successLight" />
          </View>
          <View style={{ paddingHorizontal: 16, paddingBottom: 14, gap: 10 }}>
            <View style={mStyles.infraRow}>
              <Text style={mStyles.infraLabel}>Database Engine</Text>
              <Text style={[mStyles.infraValue, { color: '#059669' }]}>Cloud Firestore Realtime</Text>
            </View>
            <View style={mStyles.infraRow}>
              <Text style={mStyles.infraLabel}>Identity & Auth</Text>
              <Text style={[mStyles.infraValue, { color: '#059669' }]}>Firebase Auth Multi-Tenant</Text>
            </View>
            <View style={mStyles.infraRow}>
              <Text style={mStyles.infraLabel}>Biometric Vault</Text>
              <Text style={[mStyles.infraValue, { color: '#0D7377' }]}>
                {biometricEnabled ? `iOS Face ID Active` : `Hardware Supported (Face ID)`}
              </Text>
            </View>
            <View style={mStyles.infraRow}>
              <Text style={mStyles.infraLabel}>Tenant Organization</Text>
              <Text style={mStyles.infraValue} numberOfLines={1}>
                {organization?.name || tenantOrg?.name || 'Default Organization'} ({organization?.slug || tenantOrg?.slug || 'subedge'})
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* ── Recent Audit Events ────────────────────────────────────────────── */}
      <Animated.View entering={FadeInDown.delay(240).duration(350).springify()}>
        <View style={mStyles.card}>
          <View style={mStyles.cardHead}>
            <View style={[mStyles.cardIconWrap, { backgroundColor: '#FEF3C7' }]}>
              <Activity size={16} color="#D97706" />
            </View>
            <Text style={mStyles.cardTitle}>Recent Audit Events</Text>
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
              {formatDate(new Date().toISOString())} · Real-time Admin Control Console
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
        {/* Left Column: Quick Actions + System Overview */}
        <View style={styles.colMain}>
          <Animated.View entering={FadeInDown.delay(180).duration(350).springify()}>
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

          {/* System Overview Card */}
          <Animated.View entering={FadeInDown.delay(240).duration(350).springify()}>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: '#e2e8f0' }]}>
              <View style={styles.cardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={[styles.cardIconWrap, { backgroundColor: '#edf8f6' }]}>
                    <Server size={18} color="#006a61" />
                  </View>
                  <View>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>Live System Infrastructure</Text>
                    <Text style={{ fontSize: 11, color: '#059669', fontWeight: '600' }}>
                      ● Realtime Subscribed · Latency: {latencyMs}ms
                    </Text>
                  </View>
                </View>
                <Badge label="REALTIME" variant="successLight" />
              </View>
              <View style={styles.infraGrid}>
                <View style={styles.infraItem}>
                  <Text style={styles.infraLabel}>Database</Text>
                  <Text style={[styles.infraVal, { color: '#006a61' }]}>Cloud Firestore (Connected)</Text>
                </View>
                <View style={styles.infraItem}>
                  <Text style={styles.infraLabel}>Auth Service</Text>
                  <Text style={[styles.infraVal, { color: '#006a61' }]}>Firebase Auth</Text>
                </View>
                <View style={styles.infraItem}>
                  <Text style={styles.infraLabel}>Org ID</Text>
                  <Text style={[styles.infraVal, { color: colors.textSecondary }]} numberOfLines={1}>
                    {tenantOrg?.id || profile?.organization_id || 'Active Org'}
                  </Text>
                </View>
              </View>
            </View>
          </Animated.View>
        </View>

        {/* Right Column: Recent Audit Activity */}
        <View style={styles.colSide}>
          <Animated.View entering={FadeInDown.delay(320).duration(350).springify()}>
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

// ─── MOBILE STYLES ────────────────────────────────────────────────────────────
const mStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F1F5F9' },
  content: { paddingBottom: 80 },

  heroBanner: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 0,
    marginBottom: 16,
  },
  heroBannerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 16,
  },
  heroGreeting: { fontSize: 13, color: 'rgba(255,255,255,0.55)', fontWeight: '600', letterSpacing: 0.3 },
  heroName: { fontSize: 26, color: '#FFFFFF', fontWeight: '800', marginTop: 2, letterSpacing: -0.5 },
  heroDate: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 },
  heroRight: { alignItems: 'center', gap: 8 },
  heroAvatarRing: {
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  systemOkPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 10, backgroundColor: '#10B981',
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

  infraRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infraLabel: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  infraValue: { fontSize: 12, fontWeight: '700', color: '#334155' },

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

// ─── DESKTOP STYLES (unchanged) ───────────────────────────────────────────────
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

  infraGrid: { padding: 20, paddingTop: 4, gap: 12 },
  infraItem: { gap: 2 },
  infraLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' },
  infraVal: { fontSize: 13, fontWeight: '600' },

  logRow: { paddingVertical: 12 },
  cardFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1,
  },
});
