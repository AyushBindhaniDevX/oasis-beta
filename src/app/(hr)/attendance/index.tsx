import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  ScrollView,
  useWindowDimensions,
  RefreshControl,
} from 'react-native';
import Svg, { Path, SvgXml } from 'react-native-svg';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/context/TenantContext';
import { useTheme } from '@/hooks/use-theme';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { DatePicker } from '@/components/ui/DatePicker';
import { LoadingState } from '@/components/ui/States';
import { InteractiveTile } from '@/components/ui/InteractiveTile';
import { SidebarLayout } from '@/components/layout/Sidebar';
import { getNavForRole } from '@/constants/navigation';
import { getTenantDefaultUnits, normalizeHospitalUnit } from '@/constants/config';
import { STOCK_8_SVG, STOCK_4_SVG, STOCK_10_SVG, STOCK_12_SVG } from '@/constants/workManagementSvgs';
import { getOrgAttendance } from '@/lib/services/attendance';
import {
  getOrgRegularizations,
  reviewRegularization,
} from '@/lib/services/regularization';
import { formatTime, formatMinutes, formatDate, getInitials } from '@/utils/format';
import type { Attendance, AttendanceRegularization } from '@/types';
import {
  CalendarClock,
  Clock,
  CheckCircle2,
  XCircle,
  Globe,
  AlertCircle,
  RefreshCw,
  Search,
  MapPin,
  Building2,
  User,
  Plus,
  Check,
  X,
  MoreHorizontal,
  FileText,
  ShieldCheck,
  ShieldAlert,
  Calendar,
  Layers,
  Filter,
} from 'lucide-react-native';
import { LateComersOverviewView } from '@/components/attendance/LateComersOverviewView';

function MetricWave({ color, width = 85, height = 28 }: { color: string; width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 90 30" fill="none">
      <Path
        d="M 2 18 C 16 26, 26 8, 42 16 C 56 24, 66 6, 88 12"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function HRAttendanceScreen() {
  const colors = useTheme();
  const { profile } = useAuth();
  const { organization: tenantOrg, units: tenantUnits } = useTenant();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const [activeTab, setActiveTab] = useState<'logs' | 'regularizations' | 'late_overview'>('logs');

  // Daily Logs state
  const [date, setDate] = useState<Date>(new Date());
  const [records, setRecords] = useState<Attendance[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter & Search state
  const [search, setSearch] = useState('');
  const [unitFilter, setUnitFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'late' | 'absent'>('all');

  // Regularization state
  const [regularizations, setRegularizations] = useState<AttendanceRegularization[]>([]);
  const [loadingRegs, setLoadingRegs] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  // Modals state
  const [selectedRecord, setSelectedRecord] = useState<Attendance | null>(null);
  const [reviewModalReg, setReviewModalReg] = useState<AttendanceRegularization | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const orgId = tenantOrg?.id || profile?.organization_id;

  const availableUnits = useMemo(() => {
    if (tenantUnits && tenantUnits.length > 0) return tenantUnits;
    return getTenantDefaultUnits(tenantOrg?.name, tenantOrg?.id);
  }, [tenantUnits, tenantOrg]);

  const loadLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const dateStr = date.toISOString().split('T')[0];
      const data = await getOrgAttendance(dateStr, orgId);
      setRecords(data);
    } catch (e) {
      console.error('HR logs error:', e);
    } finally {
      setLoadingLogs(false);
      setRefreshing(false);
    }
  }, [date, orgId]);

  const loadRegularizations = useCallback(async () => {
    setLoadingRegs(true);
    setActionError('');
    try {
      const data = await getOrgRegularizations(orgId);
      setRegularizations(data);
    } catch (e) {
      console.error('HR regularizations load error:', e);
    } finally {
      setLoadingRegs(false);
      setRefreshing(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (activeTab === 'logs') {
      loadLogs();
    } else if (activeTab === 'regularizations') {
      loadRegularizations();
    }
  }, [activeTab, loadLogs, loadRegularizations]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (activeTab === 'logs') await loadLogs();
    else if (activeTab === 'regularizations') await loadRegularizations();
  };

  const handleReview = async (id: string, action: 'approved' | 'rejected', note?: string) => {
    setActionLoadingId(id);
    setActionError('');
    setSubmittingReview(true);
    try {
      await reviewRegularization(
        id,
        action === 'approved' ? 'approve' : 'reject',
        profile?.full_name || profile?.email || 'HR Administrator',
        note || (action === 'approved' ? 'Approved by HR Operations' : 'Rejected by HR Operations')
      );
      setReviewModalReg(null);
      setReviewNote('');
      await loadRegularizations();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Review action failed.';
      setActionError(msg);
      if (Platform.OS !== 'web') {
        Alert.alert('Error', msg);
      }
    } finally {
      setActionLoadingId(null);
      setSubmittingReview(false);
    }
  };

  const statusVariant = (s: string) => {
    const map: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
      present: 'success',
      late: 'warning',
      half_day: 'warning',
      absent: 'danger',
    };
    return map[s] || 'neutral';
  };

  const regStatusVariant = (s: string) => {
    if (s === 'approved') return 'success';
    if (s === 'pending') return 'warning';
    if (s === 'rejected' || s === 'cancelled') return 'danger';
    return 'neutral';
  };

  const pendingCount = regularizations.filter((r) => r.status === 'pending').length;

  // Compute Metrics
  const metrics = useMemo(() => {
    let present = 0;
    let late = 0;
    let onTime = 0;
    let absent = 0;

    for (const r of records) {
      const s = (r.status || '').toLowerCase();
      if (s === 'present') {
        present++;
        onTime++;
      } else if (s === 'late') {
        present++;
        late++;
      } else if (s === 'absent') {
        absent++;
      }
    }
    return { present, late, onTime, absent, pendingCount };
  }, [records, pendingCount]);

  // Filtered Daily Records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const emp = r.employee as any;
      const empName = (emp?.profile?.full_name || emp?.full_name || '').toLowerCase();
      const empCode = (emp?.employee_code || '').toLowerCase();
      const unit = (emp?.hospital_unit || '').toLowerCase();

      const matchesSearch = !search || empName.includes(search.toLowerCase()) || empCode.includes(search.toLowerCase());
      const matchesUnit = unitFilter === 'all' || unit === unitFilter.toLowerCase();
      const matchesStatus = statusFilter === 'all' || r.status === statusFilter;

      return matchesSearch && matchesUnit && matchesStatus;
    });
  }, [records, search, unitFilter, statusFilter]);

  const kpiCardWidth = isDesktop
    ? undefined
    : Platform.OS === 'web'
    ? 'calc(50% - 6px)'
    : Math.floor((width - 40 - 18) / 2);

  return (
    <SidebarLayout items={getNavForRole(profile?.role || 'hr', profile?.email)}>
      <ScrollView
        style={[styles.container, { backgroundColor: '#FAF9FD' }]}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Top Header Row with STOCK 8 SVG */}
        <Animated.View entering={FadeInDown.duration(280)} style={styles.headerRow}>
          <View style={{ flex: 1, minWidth: 260 }}>
            {/* Breadcrumb */}
            <View style={styles.breadcrumbRow}>
              <Text style={styles.breadcrumbMuted}>Dashboard</Text>
              <Text style={styles.breadcrumbMuted}>/</Text>
              <Text style={styles.breadcrumbActive}>Team Attendance</Text>
            </View>

            <Text style={[styles.pageTitle, { color: '#0F172A' }]}>Team Attendance & Logs</Text>
            <Text style={[styles.pageSubtitle, { color: '#64748B' }]}>
              Monitor real-time biometric campus punches, GPS geofencing radius, and regularize missed punches across{' '}
              <Text style={{ fontWeight: '700', color: '#0F172A' }}>{tenantOrg?.name || 'Workspace'}</Text>.
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={onRefresh}
              disabled={refreshing}
              activeOpacity={0.8}
            >
              <RefreshCw size={15} color="#64748B" />
              <Text style={styles.refreshBtnText}>Refresh</Text>
            </TouchableOpacity>

            <View style={{ opacity: 0.95 }}>
              <SvgXml xml={STOCK_8_SVG} width={isDesktop ? 120 : 85} height={isDesktop ? 85 : 60} />
            </View>
          </View>
        </Animated.View>

        {/* 4 Pastel KPI Metric Cards with InteractiveTile */}
        <Animated.View entering={FadeInDown.delay(50).duration(280)} style={styles.kpiRow}>
          {/* Tile 1: Present Today */}
          <InteractiveTile
            style={[
              styles.pastelMetricCard,
              {
                backgroundColor: '#F3EEFE',
                borderColor: '#E4DCFD',
                flex: isDesktop ? 1 : undefined,
                minWidth: isDesktop ? 160 : undefined,
                width: kpiCardWidth,
              },
            ]}
          >
            <View style={styles.cardTopRow}>
              <View style={[styles.iconBox, { backgroundColor: '#DDD6FE' }]}>
                <Clock size={18} color="#7C3AED" />
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.metricValueText, { color: '#1E1B4B' }]}>{metrics.present}</Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#10B981', marginTop: 1 }}>Present</Text>
              </View>
            </View>
            <Text style={styles.metricLabelText}>Present Today</Text>
            <View style={styles.waveContainer}>
              <MetricWave color="#8B5CF6" width={isDesktop ? 150 : 80} height={24} />
            </View>
          </InteractiveTile>

          {/* Tile 2: On Time */}
          <InteractiveTile
            style={[
              styles.pastelMetricCard,
              {
                backgroundColor: '#EDFAF2',
                borderColor: '#CEF2DE',
                flex: isDesktop ? 1 : undefined,
                minWidth: isDesktop ? 160 : undefined,
                width: kpiCardWidth,
              },
            ]}
          >
            <View style={styles.cardTopRow}>
              <View style={[styles.iconBox, { backgroundColor: '#D1FAE5' }]}>
                <CheckCircle2 size={18} color="#10B981" />
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.metricValueText, { color: '#064E3B' }]}>{metrics.onTime}</Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#10B981', marginTop: 1 }}>Punctual</Text>
              </View>
            </View>
            <Text style={styles.metricLabelText}>On-Time Punches</Text>
            <View style={styles.waveContainer}>
              <MetricWave color="#10B981" width={isDesktop ? 150 : 80} height={24} />
            </View>
          </InteractiveTile>

          {/* Tile 3: Late Arrivals */}
          <InteractiveTile
            style={[
              styles.pastelMetricCard,
              {
                backgroundColor: '#FFF4EB',
                borderColor: '#FFE2CD',
                flex: isDesktop ? 1 : undefined,
                minWidth: isDesktop ? 160 : undefined,
                width: kpiCardWidth,
              },
            ]}
          >
            <View style={styles.cardTopRow}>
              <View style={[styles.iconBox, { backgroundColor: '#FFEDD5' }]}>
                <AlertCircle size={18} color="#EA580C" />
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.metricValueText, { color: '#7C2D12' }]}>{metrics.late}</Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#EA580C', marginTop: 1 }}>Late Comers</Text>
              </View>
            </View>
            <Text style={styles.metricLabelText}>Late Arrivals</Text>
            <View style={styles.waveContainer}>
              <MetricWave color="#F97316" width={isDesktop ? 150 : 80} height={24} />
            </View>
          </InteractiveTile>

          {/* Tile 4: Pending Regularizations */}
          <InteractiveTile
            style={[
              styles.pastelMetricCard,
              {
                backgroundColor: '#EFF6FF',
                borderColor: '#DBEAFE',
                flex: isDesktop ? 1 : undefined,
                minWidth: isDesktop ? 160 : undefined,
                width: kpiCardWidth,
              },
            ]}
          >
            <View style={styles.cardTopRow}>
              <View style={[styles.iconBox, { backgroundColor: '#DBEAFE' }]}>
                <CalendarClock size={18} color="#2563EB" />
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.metricValueText, { color: '#1E3A8A' }]}>{pendingCount}</Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#2563EB', marginTop: 1 }}>Pending</Text>
              </View>
            </View>
            <Text style={styles.metricLabelText}>Regularization Requests</Text>
            <View style={styles.waveContainer}>
              <MetricWave color="#3B82F6" width={isDesktop ? 150 : 80} height={24} />
            </View>
          </InteractiveTile>
        </Animated.View>

        {/* View Mode Tabs (Daily Logs, Regularizations, Late Overview) */}
        <View style={styles.tabSelectorBar}>
          <TouchableOpacity
            style={[styles.tabSelectorBtn, activeTab === 'logs' && styles.tabSelectorBtnActive]}
            onPress={() => setActiveTab('logs')}
            activeOpacity={0.8}
          >
            <Clock size={15} color={activeTab === 'logs' ? '#7C3AED' : '#64748B'} />
            <Text style={[styles.tabSelectorBtnText, activeTab === 'logs' && styles.tabSelectorBtnTextActive]}>
              Daily Attendance Logs ({records.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabSelectorBtn, activeTab === 'regularizations' && styles.tabSelectorBtnActive]}
            onPress={() => setActiveTab('regularizations')}
            activeOpacity={0.8}
          >
            <CalendarClock size={15} color={activeTab === 'regularizations' ? '#7C3AED' : '#64748B'} />
            <Text style={[styles.tabSelectorBtnText, activeTab === 'regularizations' && styles.tabSelectorBtnTextActive]}>
              Regularization Requests
            </Text>
            {pendingCount > 0 && (
              <View style={styles.tabCountPill}>
                <Text style={styles.tabCountPillText}>{pendingCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabSelectorBtn, activeTab === 'late_overview' && styles.tabSelectorBtnActive]}
            onPress={() => setActiveTab('late_overview')}
            activeOpacity={0.8}
          >
            <AlertCircle size={15} color={activeTab === 'late_overview' ? '#7C3AED' : '#64748B'} />
            <Text style={[styles.tabSelectorBtnText, activeTab === 'late_overview' && styles.tabSelectorBtnTextActive]}>
              Late & Absent Overview
            </Text>
          </TouchableOpacity>
        </View>

        {/* Error Notification */}
        {actionError ? (
          <View style={styles.errorBox}>
            <AlertCircle size={16} color="#DC2626" />
            <Text style={{ color: '#DC2626', fontSize: 13, flex: 1 }}>{actionError}</Text>
          </View>
        ) : null}

        {/* Main Content Area */}
        {activeTab === 'late_overview' ? (
          <LateComersOverviewView organizationId={orgId} />
        ) : activeTab === 'logs' ? (
          <>
            {/* Filter & Search Bar with Date Selector and Workplace Units */}
            <View style={styles.filterSection}>
              {/* Row 1: Search and Date Picker */}
              <View style={styles.searchAndDateRow}>
                <View style={styles.searchBox}>
                  <Search size={16} color="#94A3B8" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search staff by name or employee code..."
                    placeholderTextColor="#94A3B8"
                    value={search}
                    onChangeText={setSearch}
                  />
                  {search ? (
                    <TouchableOpacity onPress={() => setSearch('')}>
                      <X size={15} color="#94A3B8" />
                    </TouchableOpacity>
                  ) : null}
                </View>

                <View style={styles.datePickerWrap}>
                  <DatePicker
                    label="Date"
                    value={date}
                    onChange={(d) => setDate(d || new Date())}
                  />
                </View>
              </View>

              {/* Row 2: Workplace Unit Filter Pills */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.unitPillsRow}
              >
                <TouchableOpacity
                  style={[styles.unitFilterPill, unitFilter === 'all' && styles.unitFilterPillActive]}
                  onPress={() => setUnitFilter('all')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.unitFilterPillText, unitFilter === 'all' && styles.unitFilterPillTextActive]}>
                    All Units ({records.length})
                  </Text>
                </TouchableOpacity>

                {availableUnits.map((u) => {
                  const normalized = normalizeHospitalUnit(u);
                  const active = unitFilter.toLowerCase() === u.toLowerCase();
                  return (
                    <TouchableOpacity
                      key={u}
                      style={[styles.unitFilterPill, active && styles.unitFilterPillActive]}
                      onPress={() => setUnitFilter(active ? 'all' : u)}
                      activeOpacity={0.8}
                    >
                      <Building2 size={12} color={active ? '#7C3AED' : '#64748B'} />
                      <Text style={[styles.unitFilterPillText, active && styles.unitFilterPillTextActive]}>
                        {normalized}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Attendance List */}
            {loadingLogs ? (
              <LoadingState />
            ) : filteredRecords.length === 0 ? (
              <View style={styles.emptyCard}>
                <Clock size={36} color="#94A3B8" />
                <Text style={styles.emptyTitle}>No Attendance Records Found</Text>
                <Text style={styles.emptySub}>
                  {search ? `No staff punches match "${search}"` : 'No punch events logged for this date and unit.'}
                </Text>
              </View>
            ) : (
              <View style={styles.recordsList}>
                {filteredRecords.map((item, idx) => {
                  const emp = item.employee as any;
                  const empName = emp?.profile?.full_name || emp?.full_name || 'Staff Member';
                  const empCode = emp?.employee_code || `EMP-${item.id?.slice(0, 4)}`;
                  const initials = getInitials(empName);
                  const isPresent = item.status === 'present' || item.status === 'late';
                  const unitLabel = emp?.hospital_unit ? normalizeHospitalUnit(emp.hospital_unit) : (tenantOrg?.name || 'Headquarters');
                  const statusColor = item.status === 'present' ? '#22C55E' : item.status === 'late' ? '#F59E0B' : '#EF4444';

                  if (!isDesktop) {
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.mobileCard}
                        onPress={() => setSelectedRecord(item)}
                        activeOpacity={0.85}
                      >
                        <View style={styles.mobileCardHeader}>
                          <View style={{ position: 'relative' }}>
                            <View style={styles.avatarCircle}>
                              <Text style={styles.avatarText}>{initials}</Text>
                            </View>
                            <View style={[styles.avatarDot, { backgroundColor: statusColor }]} />
                          </View>

                          <View style={{ flex: 1, minWidth: 0, paddingHorizontal: 6 }}>
                            <Text style={styles.cardEmpName} numberOfLines={1}>{empName}</Text>
                            <Text style={styles.cardEmpCode}>{empCode} • {unitLabel}</Text>
                          </View>

                          <Badge label={item.status} variant={statusVariant(item.status)} />
                        </View>

                        <View style={styles.mobileTimingsRow}>
                          <View style={styles.timingItem}>
                            <Text style={styles.timingLabel}>Clock In</Text>
                            <Text style={styles.timingVal}>{item.clock_in ? formatTime(item.clock_in) : '--'}</Text>
                          </View>
                          <View style={styles.timingItem}>
                            <Text style={styles.timingLabel}>Clock Out</Text>
                            <Text style={styles.timingVal}>{item.clock_out ? formatTime(item.clock_out) : '--'}</Text>
                          </View>
                          <View style={styles.timingItem}>
                            <Text style={styles.timingLabel}>Working Hours</Text>
                            <Text style={styles.timingVal}>{formatMinutes(item.working_minutes)}</Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  }

                  // Desktop Modern Card (Matching Image 1 Design System)
                  return (
                    <View key={item.id} style={styles.desktopCard}>
                      {/* Avatar with Status Dot */}
                      <View style={{ position: 'relative', marginRight: 8 }}>
                        <View style={styles.avatarCircle}>
                          <Text style={styles.avatarText}>{initials}</Text>
                        </View>
                        <View style={[styles.avatarDot, { backgroundColor: statusColor }]} />
                      </View>

                      {/* Name & Identity */}
                      <View style={styles.empCol}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.desktopNameText} numberOfLines={1}>{empName}</Text>
                          <View style={styles.roleBadgeLavender}>
                            <Text style={styles.roleBadgeLavenderText}>{emp?.designation || 'Staff'}</Text>
                          </View>
                        </View>
                        <Text style={styles.desktopContactText}>{empCode}</Text>
                      </View>

                      {/* Unit Column */}
                      <View style={styles.unitCol}>
                        <Text style={styles.colHeaderLabel}>Unit</Text>
                        <View style={styles.unitPill}>
                          <Text style={styles.unitPillText} numberOfLines={1}>{unitLabel}</Text>
                        </View>
                      </View>

                      {/* Punches & Duration Column */}
                      <View style={styles.punchesCol}>
                        <Text style={styles.colHeaderLabel}>Timings & Duration</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={styles.punchTimePill}>
                            <Text style={styles.punchTimeText}>
                              In: {item.clock_in ? formatTime(item.clock_in) : '--'}
                            </Text>
                          </View>
                          <View style={styles.punchTimePill}>
                            <Text style={styles.punchTimeText}>
                              Out: {item.clock_out ? formatTime(item.clock_out) : '--'}
                            </Text>
                          </View>
                          <View style={[styles.punchTimePill, { backgroundColor: '#F3EEFE' }]}>
                            <Text style={[styles.punchTimeText, { color: '#7C3AED', fontWeight: '700' }]}>
                              {formatMinutes(item.working_minutes)}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Verification / Compliance Column */}
                      <View style={styles.verifiedCol}>
                        <Text style={styles.colHeaderLabel}>Compliance</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Badge label={item.status} variant={statusVariant(item.status)} />
                          {item.clock_in_verified ? (
                            <View style={styles.verifiedBadge}>
                              <ShieldCheck size={12} color="#10B981" />
                              <Text style={styles.verifiedBadgeText}>Verified</Text>
                            </View>
                          ) : (
                            <View style={[styles.verifiedBadge, { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}>
                              <ShieldAlert size={12} color="#DC2626" />
                              <Text style={[styles.verifiedBadgeText, { color: '#DC2626' }]}>Unverified</Text>
                            </View>
                          )}
                          {item.is_remote && (
                            <View style={styles.remotePill}>
                              <Globe size={11} color="#0284C7" />
                              <Text style={styles.remotePillText}>Remote</Text>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Action Column */}
                      <View style={styles.actionsCol}>
                        <TouchableOpacity
                          style={styles.viewProfileBtn}
                          onPress={() => setSelectedRecord(item)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.viewProfileBtnText}>View Details</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.moreOptionsBtn}
                          onPress={() => setSelectedRecord(item)}
                          activeOpacity={0.8}
                        >
                          <MoreHorizontal size={17} color="#0F172A" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        ) : (
          /* Regularization Requests Tab */
          <View style={styles.regSection}>
            <View style={styles.regHeaderBar}>
              <View>
                <Text style={styles.regSectionTitle}>Attendance Regularization Queue</Text>
                <Text style={styles.regSectionSub}>
                  Review missed punch explanations, supervisor notes, and adjust shift records.
                </Text>
              </View>

              <TouchableOpacity
                onPress={loadRegularizations}
                style={styles.refreshBtn}
                activeOpacity={0.8}
              >
                <RefreshCw size={14} color="#64748B" />
                <Text style={styles.refreshBtnText}>Reload Queue</Text>
              </TouchableOpacity>
            </View>

            {loadingRegs ? (
              <LoadingState />
            ) : regularizations.length === 0 ? (
              <View style={styles.emptyCard}>
                <CheckCircle2 size={36} color="#10B981" />
                <Text style={styles.emptyTitle}>All Caught Up!</Text>
                <Text style={styles.emptySub}>No pending attendance regularizations awaiting HR approval.</Text>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {regularizations.map((item) => {
                  const emp = item.employee as any;
                  const isPending = item.status === 'pending';
                  const isBusy = actionLoadingId === item.id;
                  const empName = emp?.profile?.full_name || 'Staff Member';
                  const initials = getInitials(empName);

                  return (
                    <View key={item.id} style={styles.regCardModern}>
                      <View style={styles.regCardTop}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <View style={styles.avatarCircleSmall}>
                            <Text style={styles.avatarTextSmall}>{initials}</Text>
                          </View>
                          <View>
                            <Text style={styles.regEmpName}>{empName}</Text>
                            <Text style={styles.regDateText}>
                              Requested for Date: <Text style={{ fontWeight: '700', color: '#0F172A' }}>{item.date}</Text>
                            </Text>
                          </View>
                        </View>

                        <Badge label={String(item.status || 'pending').toUpperCase()} variant={regStatusVariant(item.status)} />
                      </View>

                      {/* Reason & Times */}
                      <View style={styles.regBodyBox}>
                        <Text style={styles.regReasonText}>
                          Reason: <Text style={{ fontStyle: 'italic', fontWeight: '400', color: '#475569' }}>"{item.reason}"</Text>
                        </Text>

                        <View style={styles.regTimesPills}>
                          {item.requested_clock_in && (
                            <View style={styles.timeTag}>
                              <Clock size={11} color="#475569" />
                              <Text style={styles.timeTagText}>In: {formatTime(item.requested_clock_in)}</Text>
                            </View>
                          )}
                          {item.requested_clock_out && (
                            <View style={styles.timeTag}>
                              <Clock size={11} color="#475569" />
                              <Text style={styles.timeTagText}>Out: {formatTime(item.requested_clock_out)}</Text>
                            </View>
                          )}
                          {item.requested_status && (
                            <View style={styles.timeTag}>
                              <Text style={styles.timeTagText}>Target Status: {item.requested_status}</Text>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Footer Actions */}
                      <View style={styles.regCardFooter}>
                        {!isPending && item.reviewed_by ? (
                          <Text style={styles.reviewedText}>
                            Reviewed by {item.reviewed_by} on {item.reviewed_at ? formatDate(item.reviewed_at) : ''}
                          </Text>
                        ) : (
                          <View style={{ flex: 1 }} />
                        )}

                        {isPending && (
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity
                              style={[styles.regApproveBtn, isBusy && { opacity: 0.6 }]}
                              onPress={() => setReviewModalReg(item)}
                              disabled={isBusy}
                              activeOpacity={0.8}
                            >
                              <CheckCircle2 size={14} color="#FFFFFF" strokeWidth={2.5} />
                              <Text style={styles.regApproveBtnText}>Review & Decide</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Regularization Review Modal */}
        <Modal
          visible={!!reviewModalReg}
          onClose={() => {
            setReviewModalReg(null);
            setReviewNote('');
          }}
          title="Review Regularization Request"
          subtitle={`Decision for ${(reviewModalReg?.employee as any)?.profile?.full_name || 'Staff Member'} on date ${reviewModalReg?.date}.`}
          icon={<CalendarClock size={20} color="#7C3AED" />}
          badge={{ text: 'WORKFLOW DECISION', variant: 'primary' }}
          size="md"
        >
          {reviewModalReg && (
            <View style={{ gap: 14 }}>
              <View style={styles.modalMetaBox}>
                <Text style={styles.modalMetaLabel}>Employee Explanation:</Text>
                <Text style={styles.modalMetaVal}>"{reviewModalReg.reason}"</Text>

                <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                  {reviewModalReg.requested_clock_in && (
                    <Text style={styles.modalSubMeta}>
                      Requested In: <Text style={{ fontWeight: '700', color: '#0F172A' }}>{formatTime(reviewModalReg.requested_clock_in)}</Text>
                    </Text>
                  )}
                  {reviewModalReg.requested_clock_out && (
                    <Text style={styles.modalSubMeta}>
                      Requested Out: <Text style={{ fontWeight: '700', color: '#0F172A' }}>{formatTime(reviewModalReg.requested_clock_out)}</Text>
                    </Text>
                  )}
                </View>
              </View>

              <View>
                <Text style={styles.fieldLabel}>HR Remarks / Note (Optional)</Text>
                <TextInput
                  style={styles.modalTextInput}
                  placeholder="e.g. Verified with biometric terminal log / approved"
                  placeholderTextColor="#94A3B8"
                  value={reviewNote}
                  onChangeText={setReviewNote}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  style={[styles.modalRejectBtn, submittingReview && { opacity: 0.6 }]}
                  onPress={() => handleReview(reviewModalReg.id, 'rejected', reviewNote)}
                  disabled={submittingReview}
                  activeOpacity={0.8}
                >
                  <XCircle size={15} color="#DC2626" />
                  <Text style={styles.modalRejectBtnText}>Reject Request</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalApproveBtn, submittingReview && { opacity: 0.6 }]}
                  onPress={() => handleReview(reviewModalReg.id, 'approved', reviewNote)}
                  disabled={submittingReview}
                  activeOpacity={0.8}
                >
                  <CheckCircle2 size={15} color="#FFFFFF" strokeWidth={2.5} />
                  <Text style={styles.modalApproveBtnText}>
                    {submittingReview ? 'Approving...' : 'Approve & Adjust Punch'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Modal>

        {/* Record Detail Modal */}
        <Modal
          visible={!!selectedRecord}
          onClose={() => setSelectedRecord(null)}
          title="Attendance Punch Details"
          subtitle={`Live terminal log for ${(selectedRecord?.employee as any)?.profile?.full_name || 'Staff'}`}
          icon={<Clock size={20} color="#7C3AED" />}
          badge={{ text: 'PUNCH AUDIT', variant: 'neutral' }}
          size="md"
        >
          {selectedRecord && (
            <View style={{ gap: 14 }}>
              <View style={styles.modalDetailRow}>
                <Text style={styles.detailTitle}>Staff Member</Text>
                <Text style={styles.detailValue}>
                  {(selectedRecord.employee as any)?.profile?.full_name || 'Staff Member'}
                </Text>
              </View>

              <View style={styles.modalDetailRow}>
                <Text style={styles.detailTitle}>Attendance Date</Text>
                <Text style={styles.detailValue}>{selectedRecord.date}</Text>
              </View>

              <View style={styles.modalDetailRow}>
                <Text style={styles.detailTitle}>Status</Text>
                <Badge label={selectedRecord.status} variant={statusVariant(selectedRecord.status)} />
              </View>

              <View style={styles.modalDetailRow}>
                <Text style={styles.detailTitle}>Clock In Timestamp</Text>
                <Text style={styles.detailValue}>
                  {selectedRecord.clock_in ? `${formatDate(selectedRecord.clock_in)} ${formatTime(selectedRecord.clock_in)}` : 'Not punched in'}
                </Text>
              </View>

              <View style={styles.modalDetailRow}>
                <Text style={styles.detailTitle}>Clock Out Timestamp</Text>
                <Text style={styles.detailValue}>
                  {selectedRecord.clock_out ? `${formatDate(selectedRecord.clock_out)} ${formatTime(selectedRecord.clock_out)}` : 'Not punched out'}
                </Text>
              </View>

              <View style={styles.modalDetailRow}>
                <Text style={styles.detailTitle}>Total Working Duration</Text>
                <Text style={[styles.detailValue, { fontWeight: '700', color: '#7C3AED' }]}>
                  {formatMinutes(selectedRecord.working_minutes)}
                </Text>
              </View>

              <View style={styles.modalDetailRow}>
                <Text style={styles.detailTitle}>Geofencing Verification</Text>
                <Text style={styles.detailValue}>
                  {selectedRecord.clock_in_verified ? 'Verified inside campus boundaries' : 'Outside boundary or unverified'}
                </Text>
              </View>
            </View>
          )}
        </Modal>
      </ScrollView>
    </SidebarLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { padding: 24, paddingBottom: 64 },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 20,
  },
  breadcrumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  breadcrumbMuted: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  breadcrumbActive: {
    fontSize: 12,
    color: '#7C3AED',
    fontWeight: '700',
  },
  eyebrowChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#F3EEFE',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 6,
  },
  eyebrowText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#7C3AED',
    letterSpacing: 0.5,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  pageSubtitle: {
    fontSize: 13,
    marginTop: 4,
    maxWidth: 620,
    lineHeight: 19,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  refreshBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#475569',
  },

  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  pastelMetricCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValueText: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  metricLabelText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#475569',
  },
  waveContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    opacity: 0.8,
  },

  tabSelectorBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    gap: 4,
  },
  tabSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9,
  },
  tabSelectorBtnActive: {
    backgroundColor: '#F3EEFE',
  },
  tabSelectorBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748B',
  },
  tabSelectorBtnTextActive: {
    color: '#7C3AED',
    fontWeight: '700',
  },
  tabCountPill: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  tabCountPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  errorBox: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },

  filterSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  searchAndDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  searchBox: {
    flex: 1,
    minWidth: 240,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
  },
  datePickerWrap: {
    minWidth: 180,
  },
  unitPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
  },
  unitFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  unitFilterPillActive: {
    backgroundColor: '#FAF5FF',
    borderColor: '#C084FC',
  },
  unitFilterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  unitFilterPillTextActive: {
    color: '#7C3AED',
    fontWeight: '700',
  },

  recordsList: {
    gap: 10,
  },
  desktopCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#7C3AED',
    fontSize: 15,
    fontWeight: '700',
  },
  avatarDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  empCol: {
    width: 220,
    paddingRight: 12,
  },
  desktopNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  desktopContactText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  roleBadgeLavender: {
    backgroundColor: '#F3EEFE',
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  roleBadgeLavenderText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#7C3AED',
  },
  colHeaderLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  unitCol: {
    width: 180,
    paddingRight: 12,
  },
  unitPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  unitPillText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#334155',
  },
  punchesCol: {
    flex: 1,
    paddingRight: 12,
  },
  punchTimePill: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  punchTimeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  verifiedCol: {
    width: 200,
    paddingRight: 12,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  verifiedBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#059669',
  },
  remotePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  remotePillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#0284C7',
  },
  actionsCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewProfileBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  viewProfileBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
  moreOptionsBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },

  // Mobile Card styles
  mobileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 8,
  },
  mobileCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  cardEmpName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  cardEmpCode: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  mobileTimingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
  },
  timingItem: {
    alignItems: 'center',
  },
  timingLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
  },
  timingVal: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },

  // Regularization section
  regSection: {
    gap: 12,
  },
  regHeaderBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  regSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  regSectionSub: {
    fontSize: 12.5,
    color: '#64748B',
    marginTop: 2,
  },
  regCardModern: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 12,
  },
  regCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  avatarCircleSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTextSmall: {
    color: '#7C3AED',
    fontSize: 13,
    fontWeight: '700',
  },
  regEmpName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  regDateText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  regBodyBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    gap: 6,
  },
  regReasonText: {
    fontSize: 12.5,
    color: '#0F172A',
    fontWeight: '600',
  },
  regTimesPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  timeTagText: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '600',
  },
  regCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewedText: {
    fontSize: 11.5,
    color: '#64748B',
    fontStyle: 'italic',
  },
  regApproveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  regApproveBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Modal helpers
  modalMetaBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalMetaLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  modalMetaVal: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
    marginTop: 4,
  },
  modalSubMeta: {
    fontSize: 12,
    color: '#64748B',
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  modalTextInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    fontSize: 13,
    color: '#0F172A',
    minHeight: 70,
    textAlignVertical: 'top',
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
  },
  modalRejectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  modalRejectBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#DC2626',
  },
  modalApproveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
  },
  modalApproveBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  modalDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  detailTitle: {
    fontSize: 12.5,
    color: '#64748B',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 12.5,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },
});
