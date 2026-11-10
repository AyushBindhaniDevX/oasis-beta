import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  useWindowDimensions, RefreshControl, Platform,
} from 'react-native';
import { useRouter, Redirect } from 'expo-router';
import { HR_NAV } from '@/constants/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/context/TenantContext';
import { useTheme } from '@/hooks/use-theme';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { SidebarLayout } from '@/components/layout/Sidebar';
import { LoadingState } from '@/components/ui/States';
import { getEmployeeCount } from '@/lib/services/employee';
import { getAttendanceStats } from '@/lib/services/attendance';
import { getPendingLeaveRequests, processLeaveRequest } from '@/lib/services/leave';
import { formatDate, getGreeting } from '@/utils/format';
import type { LeaveRequest } from '@/types';
import {
  Users, Calendar, Umbrella, CreditCard, Network, Briefcase,
  ArrowRight, CheckCircle2, XCircle, Clock, Award, BarChart3,
  Receipt, Laptop, GraduationCap, FileText, MapPin, LifeBuoy,
  Building2,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function HRDashboard() {
  const colors = useTheme();
  const { profile, role } = useAuth();
  const { organization: tenantOrg } = useTenant();
  const activeOrgId = tenantOrg?.id || profile?.organization_id;
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  // If Admin is logged in, redirect to Admin Dashboard
  if (role === 'admin' || profile?.role === 'admin') {
    return <Redirect href="/(admin)/dashboard" />;
  }

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [empCount, setEmpCount] = useState(0);
  const [attendanceStats, setAttendanceStats] = useState({ present: 0, late: 0, halfDay: 0, total: 0 });
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRequest[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const orgId = tenantOrg?.id || profile?.organization_id;

      const [count, stats, leaves] = await Promise.all([
        getEmployeeCount(orgId),
        getAttendanceStats(today, orgId),
        getPendingLeaveRequests(orgId),
      ]);
      setEmpCount(count);
      setAttendanceStats(stats);
      setPendingLeaves(leaves);
    } catch (err) {
      console.error('HR dashboard error:', err);
    } finally {
      setLoading(false);
    }
  }, [profile, tenantOrg]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  const handleLeaveAction = async (id: string, action: 'approve' | 'reject') => {
    setProcessing(id);
    try {
      await processLeaveRequest(id, action);
      await loadData();
    } catch (err) {
      console.error(err);
    }
    setProcessing(null);
  };

  if (loading) return <LoadingState />;

  const mobileKpis = [
    { label: 'Employees', value: `${empCount}`, color: '#0D7377', bg: '#E6F4F4', icon: Users },
    { label: 'Present', value: `${attendanceStats.present}`, color: '#059669', bg: '#D1FAE5', icon: Calendar },
    { label: 'Late', value: `${attendanceStats.late}`, color: '#D97706', bg: '#FEF3C7', icon: Clock },
    { label: 'Pending', value: `${pendingLeaves.length}`, color: '#7C3AED', bg: '#EDE9FE', icon: Umbrella },
  ];

  const hrQuickActions = [
    { label: 'My Attendance', icon: Clock, href: '/(employee)/attendance', color: '#7C3AED', bg: '#EDE9FE' },
    { label: 'Users & Staff', icon: Users, href: '/(admin)/users', color: '#0D7377', bg: '#E6F4F4' },
    { label: 'Team Attendance', icon: Calendar, href: '/(hr)/attendance', color: '#059669', bg: '#D1FAE5' },
    { label: 'Leave', icon: Umbrella, href: '/(hr)/leave', color: '#7C3AED', bg: '#EDE9FE' },
    { label: 'Payroll', icon: CreditCard, href: '/(hr)/payroll', color: '#0369A1', bg: '#E0F2FE' },
    { label: 'Performance', icon: Award, href: '/(hr)/performance', color: '#DC2626', bg: '#FEE2E2' },
    { label: 'Expenses', icon: Receipt, href: '/(hr)/expenses', color: '#059669', bg: '#D1FAE5' },
    { label: 'Assets', icon: Laptop, href: '/(hr)/assets', color: '#2563EB', bg: '#EFF6FF' },
    { label: 'Learning', icon: GraduationCap, href: '/(hr)/learning', color: '#7C3AED', bg: '#EDE9FE' },
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
      {/* ── HR Hero Banner ────────────────────────────────────────────────── */}
      <View style={mStyles.heroBanner}>
        <View style={mStyles.heroBannerRow}>
          <View style={{ flex: 1 }}>
            <Text style={mStyles.heroGreeting}>{getGreeting()}</Text>
            <Text style={mStyles.heroName}>{profile?.full_name?.split(' ')[0] ?? 'HR'}</Text>
            <Text style={mStyles.heroDate}>HR Management Console</Text>
            <View style={mStyles.orgBadge}>
              <Building2 size={11} color="rgba(255,255,255,0.85)" />
              <Text style={mStyles.orgBadgeName} numberOfLines={1}>
                {tenantOrg?.name || 'Organization'}
              </Text>
              <View style={mStyles.orgBadgePill}>
                <Text style={mStyles.orgBadgePillLabel}>ORG ID</Text>
                <Text style={mStyles.orgBadgePillVal}>{activeOrgId || 'N/A'}</Text>
              </View>
            </View>
          </View>
          {profile && (
            <View style={mStyles.heroAvatarRing}>
              <Avatar name={profile.full_name} url={profile.avatar_url} size={46} />
            </View>
          )}
        </View>

        {/* Stats in banner */}
        <View style={mStyles.heroChips}>
          <View style={mStyles.heroChip}>
            <Text style={mStyles.heroChipLabel}>Staff</Text>
            <Text style={mStyles.heroChipValue}>{empCount}</Text>
          </View>
          <View style={mStyles.heroChipDivider} />
          <View style={mStyles.heroChip}>
            <Text style={mStyles.heroChipLabel}>Present</Text>
            <Text style={mStyles.heroChipValue}>{attendanceStats.present}</Text>
          </View>
          <View style={mStyles.heroChipDivider} />
          <View style={mStyles.heroChip}>
            <Text style={mStyles.heroChipLabel}>Late</Text>
            <Text style={mStyles.heroChipValue}>{attendanceStats.late}</Text>
          </View>
          <View style={mStyles.heroChipDivider} />
          <View style={mStyles.heroChip}>
            <Text style={mStyles.heroChipLabel}>Pending Leave</Text>
            <Text style={mStyles.heroChipValue}>{pendingLeaves.length}</Text>
          </View>
        </View>
      </View>

      {/* ── Quick Actions Grid ────────────────────────────────────────────── */}
      <Animated.View entering={FadeInDown.delay(60).duration(350).springify()}>
        <Text style={mStyles.sectionTitle}>HR Modules</Text>
        <View style={mStyles.quickGrid}>
          {hrQuickActions.map((qa) => {
            const Icon = qa.icon;
            return (
              <TouchableOpacity
                key={qa.href}
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

      {/* ── Pending Leave Approvals ───────────────────────────────────────── */}
      <Animated.View entering={FadeInDown.delay(120).duration(350).springify()}>
        <View style={mStyles.card}>
          <View style={mStyles.cardHead}>
            <View style={[mStyles.cardIconWrap, { backgroundColor: '#EDE9FE' }]}>
              <Umbrella size={16} color="#7C3AED" />
            </View>
            <Text style={mStyles.cardTitle}>Pending Approvals</Text>
            {pendingLeaves.length > 0 && (
              <View style={mStyles.pendingBadge}>
                <Text style={mStyles.pendingBadgeText}>{pendingLeaves.length}</Text>
              </View>
            )}
          </View>

          {pendingLeaves.length === 0 ? (
            <View style={mStyles.emptyState}>
              <CheckCircle2 size={28} color="#10B981" />
              <Text style={mStyles.emptyText}>All caught up! No pending requests.</Text>
            </View>
          ) : (
            <View style={{ paddingBottom: 4 }}>
              {pendingLeaves.slice(0, 4).map((req, idx) => (
                <View key={req.id} style={[mStyles.leaveRow, idx < Math.min(pendingLeaves.length, 4) - 1 && { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={mStyles.leaveEmployee} numberOfLines={1}>
                      {(req.employee as any)?.profile?.full_name || 'Employee'}
                    </Text>
                    <Text style={mStyles.leaveDetail}>
                      {req.leave_type?.name} · {formatDate(req.start_date)} — {formatDate(req.end_date)}
                    </Text>
                    <Text style={mStyles.leaveDays}>{req.days} Day{req.days > 1 ? 's' : ''}</Text>
                  </View>
                  <View style={mStyles.leaveActions}>
                    <TouchableOpacity
                      onPress={() => handleLeaveAction(req.id, 'approve')}
                      style={mStyles.approveBtn}
                      activeOpacity={0.8}
                    >
                      <CheckCircle2 size={16} color="#10B981" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleLeaveAction(req.id, 'reject')}
                      style={mStyles.rejectBtn}
                      activeOpacity={0.8}
                    >
                      <XCircle size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {pendingLeaves.length > 0 && (
            <TouchableOpacity style={mStyles.cardFooter} onPress={() => router.push('/(hr)/leave' as never)}>
              <Text style={mStyles.cardFooterText}>View All Leave Requests</Text>
              <ArrowRight size={14} color="#0D7377" />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      <View style={{ height: 24 }} />
    </ScrollView>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // DESKTOP LAYOUT (unchanged)
  // ─────────────────────────────────────────────────────────────────────────────
  const desktopContent = (
    <ScrollView
      contentContainerStyle={[styles.content, styles.contentDesktop]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={[styles.pageTitle, { color: colors.text }]}>HR Dashboard</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <Text style={{ color: colors.textSecondary, fontSize: 15 }}>
          Welcome back, {profile?.full_name}
        </Text>
        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primaryLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: `${colors.primary}25` }}>
          <Building2 size={13} color={colors.primary} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>
            {tenantOrg?.name || 'Organization'}
          </Text>
          <Text style={{ fontSize: 11, color: colors.primary, opacity: 0.6 }}>·</Text>
          <View style={{ backgroundColor: colors.primary, paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 4 }}>
            <Text style={{ fontSize: 10, fontWeight: '800', color: '#FFF', letterSpacing: 0.4 }}>
              ORG ID: {activeOrgId || 'N/A'}
            </Text>
          </View>
        </View>
      </View>

      {/* Stats */}
      <View style={[styles.statsGrid, styles.statsGridDesktop]}>
        <StatCard label="Total Employees" value={empCount} />
        <StatCard label="Present Today" value={attendanceStats.present} color="#16A34A" />
        <StatCard label="Late Today" value={attendanceStats.late} color="#D97706" />
        <StatCard label="On Leave" value={pendingLeaves.length} color="#3B82F6" />
      </View>

      <View style={styles.dashboardGrid}>
        {/* Main Column */}
        <View style={styles.mainCol}>
          <Card style={{ flex: 1 }}>
            <View style={styles.cardHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Pending Leave Requests</Text>
              <Badge label={pendingLeaves.length.toString()} variant={pendingLeaves.length > 0 ? 'warning' : 'neutral'} />
            </View>
            
            {pendingLeaves.length === 0 ? (
              <Text style={{ color: colors.textSecondary, paddingVertical: 12 }}>No pending requests to review.</Text>
            ) : (
              pendingLeaves.slice(0, 5).map(req => (
                <View key={req.id} style={[styles.leaveRow, { borderBottomColor: colors.border }]}>
                  <View style={{ flex: 1, paddingRight: 16 }}>
                    <Text style={[{ color: colors.text, fontWeight: '600', fontSize: 15 }]}>
                      {(req.employee as any)?.profile?.full_name || 'Employee'}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>
                      {req.leave_type?.name} · {formatDate(req.start_date)} — {formatDate(req.end_date)}
                    </Text>
                    <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '500', marginTop: 4 }}>
                      {req.days} Day{req.days > 1 ? 's' : ''}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Button
                      title="Approve"
                      onPress={() => handleLeaveAction(req.id, 'approve')}
                      size="sm"
                      loading={processing === req.id}
                      style={{ paddingHorizontal: 16 }}
                    />
                    <Button
                      title="Reject"
                      onPress={() => handleLeaveAction(req.id, 'reject')}
                      variant="danger"
                      size="sm"
                      loading={processing === req.id}
                    />
                  </View>
                </View>
              ))
            )}
            {pendingLeaves.length > 0 && (
              <Button
                title="View All Requests"
                onPress={() => router.push('/(hr)/leave' as never)}
                variant="ghost"
                size="sm"
                style={{ marginTop: 16 }}
              />
            )}
          </Card>
        </View>

        {/* Side Column */}
        <View style={styles.sideCol}>
          <Card>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
            <View style={styles.appGrid}>
              {HR_NAV.slice(1).map(item => {
                const Icon = item.icon;
                return (
                  <TouchableOpacity
                    key={item.href}
                    onPress={() => router.push(item.href as never)}
                    style={[styles.appBtn, { backgroundColor: colors.backgroundElement }]}
                  >
                    {Icon && <Icon size={24} color={colors.primary} />}
                    <Text style={[styles.appBtnText, { color: colors.text }]}>{item.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>
        </View>
      </View>
    </ScrollView>
  );

  return (
    <SidebarLayout items={HR_NAV}>
      {isDesktop ? desktopContent : mobileContent}
    </SidebarLayout>
  );
}

// ─── MOBILE STYLES ────────────────────────────────────────────────────────────
const mStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F1F5F9' },
  content: { paddingBottom: 80 },

  heroBanner: {
    backgroundColor: '#1E3A5F',
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
  heroGreeting: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600', letterSpacing: 0.3 },
  heroName: { fontSize: 26, color: '#FFFFFF', fontWeight: '800', marginTop: 2, letterSpacing: -0.5 },
  heroDate: { fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 4 },
  orgBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  orgBadgeName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    maxWidth: 130,
  },
  orgBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  orgBadgePillLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.75)',
    letterSpacing: 0.4,
  },
  orgBadgePillVal: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6EE7B7',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  heroAvatarRing: {
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  heroChips: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderTopLeftRadius: 14, borderTopRightRadius: 14,
    paddingVertical: 12, paddingHorizontal: 4,
    marginHorizontal: -20,
  },
  heroChip: { flex: 1, alignItems: 'center' },
  heroChipLabel: { fontSize: 10, color: 'rgba(255,255,255,0.55)', fontWeight: '600', textTransform: 'uppercase' },
  heroChipValue: { fontSize: 14, color: '#FFFFFF', fontWeight: '800', marginTop: 2 },
  heroChipDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 4 },

  sectionTitle: {
    fontSize: 16, fontWeight: '800', color: '#0F172A',
    paddingHorizontal: 16, marginBottom: 10, letterSpacing: -0.2,
  },

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
  pendingBadge: {
    backgroundColor: '#7C3AED', borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  pendingBadgeText: { fontSize: 11, color: '#FFF', fontWeight: '800' },
  emptyState: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyText: { fontSize: 13, color: '#64748B', fontWeight: '600' },

  leaveRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, gap: 10,
  },
  leaveEmployee: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  leaveDetail: { fontSize: 12, color: '#64748B', marginTop: 2 },
  leaveDays: { fontSize: 12, fontWeight: '700', color: '#0D7377', marginTop: 2 },
  leaveActions: { flexDirection: 'row', gap: 8 },
  approveBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center',
  },
  rejectBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center',
  },

  cardFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: '#F1F5F9', marginTop: 4,
  },
  cardFooterText: { fontSize: 13, fontWeight: '700', color: '#0D7377' },
});

// ─── DESKTOP STYLES (unchanged) ───────────────────────────────────────────────
const styles = StyleSheet.create({
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  contentDesktop: { maxWidth: 1100, alignSelf: 'center', width: '100%', padding: 32 },
  pageTitle: { fontSize: 28, fontWeight: '700' },
  
  statsGrid: { gap: 16, marginBottom: 8 },
  statsGridDesktop: { flexDirection: 'row' },
  
  dashboardGrid: { flexDirection: 'row', gap: 24, alignItems: 'flex-start' },
  mainCol: { flex: 2 },
  sideCol: { flex: 1 },
  
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  
  leaveRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  
  appGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  appBtn: { 
    width: '46%', 
    aspectRatio: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderRadius: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: 'transparent'
  },
  appBtnText: { fontSize: 13, fontWeight: '500', textAlign: 'center' },
});
