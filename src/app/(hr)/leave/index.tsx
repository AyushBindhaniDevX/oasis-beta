import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  useWindowDimensions,
  Platform,
  Alert,
} from 'react-native';
import Svg, { Path, SvgXml } from 'react-native-svg';
import { useTheme } from '@/hooks/use-theme';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { LoadingState } from '@/components/ui/States';
import { InteractiveTile } from '@/components/ui/InteractiveTile';
import { SidebarLayout } from '@/components/layout/Sidebar';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/context/TenantContext';
import { getTenantDefaultUnits, normalizeHospitalUnit } from '@/constants/config';
import { HR_NAV, getNavForRole } from '@/constants/navigation';
import {
  STOCK_12_SVG,
  STOCK_4_SVG,
  STOCK_8_SVG,
} from '@/constants/workManagementSvgs';
import {
  getAllLeaveRequests,
  processLeaveRequest,
  getLeaveTypes,
  createLeaveType,
  updateLeaveType,
  deleteLeaveType,
  applyLeave,
  HOSPITAL_LEAVE_TIERS,
  resolveLeaveApprovalWorkflow,
  type LeaveApprovalTier,
} from '@/lib/services/leave';
import { getEmployees } from '@/lib/services/employee';
import { formatDate } from '@/utils/format';
import type { LeaveRequest, LeaveType, Employee } from '@/types';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  List,
  Calendar,
  Layers,
  Sparkles,
  ArrowRight,
  Building2,
  Plus,
  Trash2,
  Edit2,
  Sliders,
  ShieldCheck,
  Umbrella,
  RefreshCw,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  Lock,
  User,
  FileText,
  Flame,
  CheckSquare,
  Square,
  Plane,
  BriefcaseMedical,
  Coffee,
  MoreHorizontal,
  SlidersHorizontal,
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';

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

const stripEmoji = (s: string) =>
  (s || '').replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{FE00}-\u{FE0F}]/gu, '').trim();

function getRequestSerial(req: LeaveRequest): string {
  const clean = (req.id || '').replace(/^lr-/, '');
  const digits = clean.slice(-4);
  return `LEAV-${digits || '101'}`;
}

function getLeaveCategoryIcon(typeName: string, size = 16, color = '#7C3AED') {
  const n = (typeName || '').toLowerCase();
  if (n.includes('sick') || n.includes('medical')) return <BriefcaseMedical size={size} color={color} />;
  if (n.includes('annual') || n.includes('vacation')) return <Plane size={size} color={color} />;
  if (n.includes('casual') || n.includes('personal') || n.includes('comp')) return <Coffee size={size} color={color} />;
  return <Umbrella size={size} color={color} />;
}

export default function HRLeaveWorkflowScreen() {
  const colors = useTheme();
  const { profile } = useAuth();
  const { organization: tenantOrg, units: tenantUnits, employee: tenantEmployee } = useTenant();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const workflowSetting = (tenantOrg?.settings as any)?.approval_workflows?.Leave;
  const { totalLevels, title: approvalWorkflowTitle, subtitle: approvalWorkflowSubtitle, tiers: activeTiers } = useMemo(() => {
    return resolveLeaveApprovalWorkflow(workflowSetting);
  }, [workflowSetting]);

  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [employeesList, setEmployeesList] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // View Modes: 'approvals' (Approvals & Requests Suite) | 'grouped' (Taskly Grouped Timeline) | 'policies' (Policies & Quotas)
  const [viewMode, setViewMode] = useState<'approvals' | 'grouped' | 'policies'>('approvals');

  // Filters
  const [scopeFilter, setScopeFilter] = useState<'team' | 'my'>('team');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'timeoff' | 'medical' | 'casual' | 'duty'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [search, setSearch] = useState('');
  const [unitFilter, setUnitFilter] = useState('all');

  // Selection state for batch operations
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Taskly Grouped Collapsibles state
  const [collapsedSections, setCollapsedSections] = useState({
    pending: false,
    upcoming: false,
    completed: false,
  });

  // Approval Chain & Audit Trail Modal state
  const [selectedRequestForChain, setSelectedRequestForChain] = useState<LeaveRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [showReviewInput, setShowReviewInput] = useState(false);

  // Leave Policy Modal State
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [editingType, setEditingType] = useState<LeaveType | null>(null);
  const [typeName, setTypeName] = useState('');
  const [typeDays, setTypeDays] = useState('12');
  const [typeIsPaid, setTypeIsPaid] = useState('yes');
  const [typeDesc, setTypeDesc] = useState('');
  const [typeSaving, setTypeSaving] = useState(false);
  const [typeError, setTypeError] = useState('');

  // Quick Apply Modal State
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyEmpId, setApplyEmpId] = useState('');
  const [applyTypeId, setApplyTypeId] = useState('');
  const [applyStartDate, setApplyStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [applyEndDate, setApplyEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [applyDays, setApplyDays] = useState('1');
  const [applyReason, setApplyReason] = useState('');
  const [applySaving, setApplySaving] = useState(false);
  const [applyError, setApplyError] = useState('');

  const availableUnits = useMemo(() => {
    if (tenantUnits && tenantUnits.length > 0) return tenantUnits;
    return getTenantDefaultUnits(tenantOrg?.name, tenantOrg?.id);
  }, [tenantUnits, tenantOrg]);

  const load = useCallback(async () => {
    try {
      const orgId = tenantOrg?.id || profile?.organization_id;
      const [reqData, typesData, empData] = await Promise.all([
        getAllLeaveRequests(orgId),
        getLeaveTypes(orgId),
        getEmployees({ organization_id: orgId }),
      ]);
      setRequests(reqData);
      setLeaveTypes(typesData);
      setEmployeesList(empData);

      // Default apply type
      if (typesData.length > 0 && !applyTypeId) {
        setApplyTypeId(typesData[0].id);
      }
      if (empData.length > 0 && !applyEmpId) {
        setApplyEmpId(empData[0].id);
      }
    } catch (err) {
      console.error('Error loading HR leave requests and types:', err);
    } finally {
      setLoading(false);
    }
  }, [profile, tenantOrg, applyTypeId, applyEmpId]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Action handlers
  const handleAction = async (id: string, action: 'approve' | 'reject', notes?: string) => {
    setProcessingId(id);
    try {
      await processLeaveRequest(id, action, profile?.full_name || 'HR Management', {
        approverId: profile?.id,
        approverRole: profile?.role === 'admin' ? 'Administration' : 'HR Operations',
        notes: notes || undefined,
        totalLevels,
        workflowSetting,
      });
      await load();

      // If the modal was viewing this request, refresh its object
      if (selectedRequestForChain && selectedRequestForChain.id === id) {
        const updatedReqs = await getAllLeaveRequests(tenantOrg?.id || profile?.organization_id);
        const refreshed = updatedReqs.find((r) => r.id === id);
        setSelectedRequestForChain(refreshed || null);
        setReviewNotes('');
        setShowReviewInput(false);
      }
    } catch (err: any) {
      console.error('Action error:', err);
      Alert.alert('Approval Error', err?.message || 'Could not process leave request.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleOpenChainModal = (req: LeaveRequest) => {
    setSelectedRequestForChain(req);
    setReviewNotes('');
    setShowReviewInput(req.status === 'pending');
  };

  // Checkbox batch selection
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (list: LeaveRequest[]) => {
    if (selectedIds.size === list.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(list.map((r) => r.id)));
    }
  };

  // Policy Modal Handlers
  const handleOpenAddType = () => {
    setEditingType(null);
    setTypeName('');
    setTypeDays('12');
    setTypeIsPaid('yes');
    setTypeDesc('');
    setTypeError('');
    setShowTypeModal(true);
  };

  const handleOpenEditType = (lt: LeaveType) => {
    setEditingType(lt);
    setTypeName(lt.name);
    setTypeDays(String(lt.annual_days || 12));
    setTypeIsPaid(lt.is_paid ? 'yes' : 'no');
    setTypeDesc(lt.description || '');
    setTypeError('');
    setShowTypeModal(true);
  };

  const handleSaveType = async () => {
    if (!typeName.trim()) {
      setTypeError('Leave type name is required.');
      return;
    }
    const days = parseInt(typeDays, 10);
    if (isNaN(days) || days <= 0) {
      setTypeError('Annual allowance must be at least 1 day.');
      return;
    }
    setTypeSaving(true);
    setTypeError('');
    try {
      const orgId = tenantOrg?.id || profile?.organization_id || '';
      if (editingType) {
        await updateLeaveType(editingType.id, {
          name: typeName.trim(),
          annual_days: days,
          is_paid: typeIsPaid === 'yes',
          description: typeDesc.trim() || null,
        });
      } else {
        await createLeaveType({
          name: typeName.trim(),
          annual_days: days,
          is_paid: typeIsPaid === 'yes',
          description: typeDesc.trim() || undefined,
          organization_id: orgId,
        });
      }
      setShowTypeModal(false);
      await load();
    } catch (err: unknown) {
      setTypeError(err instanceof Error ? err.message : 'Failed to save leave policy');
    } finally {
      setTypeSaving(false);
    }
  };

  const handleDeleteType = async (id: string, name: string) => {
    const proceed = async () => {
      try {
        await deleteLeaveType(id);
        await load();
      } catch (err) {
        console.error('Delete leave type error:', err);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Are you sure you want to delete policy "${name}"?`)) {
        await proceed();
      }
    } else {
      Alert.alert('Delete Policy', `Are you sure you want to delete policy "${name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: proceed },
      ]);
    }
  };

  // Quick Apply Leave Handler
  const handleOpenApplyModal = () => {
    setApplyEmpId(tenantEmployee?.id || (employeesList[0]?.id || ''));
    setApplyStartDate(new Date().toISOString().slice(0, 10));
    setApplyEndDate(new Date().toISOString().slice(0, 10));
    setApplyDays('1');
    setApplyReason('');
    setApplyError('');
    setShowApplyModal(true);
  };

  const handleSaveApply = async () => {
    if (!applyEmpId) {
      setApplyError('Please select a staff member.');
      return;
    }
    if (!applyTypeId) {
      setApplyError('Please select a leave category.');
      return;
    }
    if (!applyStartDate || !applyEndDate) {
      setApplyError('Start and end dates are required.');
      return;
    }
    const days = parseFloat(applyDays);
    if (isNaN(days) || days <= 0) {
      setApplyError('Valid duration is required.');
      return;
    }

    setApplySaving(true);
    setApplyError('');
    try {
      const orgId = tenantOrg?.id || profile?.organization_id || '';
      await applyLeave({
        employee_id: applyEmpId,
        leave_type_id: applyTypeId,
        start_date: applyStartDate,
        end_date: applyEndDate,
        days: days,
        is_half_day: days === 0.5,
        reason: applyReason.trim() || 'Filed by Administrator',
        organization_id: orgId,
      });
      setShowApplyModal(false);
      await load();
    } catch (err: any) {
      setApplyError(err?.message || 'Failed to submit leave request');
    } finally {
      setApplySaving(false);
    }
  };

  // Filtered requests computation
  const filtered = useMemo(() => {
    return requests.filter((r) => {
      const emp = r.employee as any;
      const empName = (emp?.profile?.full_name || '').toLowerCase();
      const empCode = (emp?.employee_code || emp?.id || '').toLowerCase();
      const deptName = (emp?.department?.name || '').toLowerCase();
      const desig = (emp?.designation || '').toLowerCase();
      const typeName = (r.leave_type?.name || '').toLowerCase();
      const reason = (r.reason || '').toLowerCase();
      const unit = (emp?.hospital_unit || '').toLowerCase();
      const serial = getRequestSerial(r).toLowerCase();

      // Scope filter: Team vs My
      if (scopeFilter === 'my') {
        const isMy =
          r.employee_id === tenantEmployee?.id ||
          emp?.profile_id === profile?.id ||
          emp?.id === profile?.id;
        if (!isMy) return false;
      }

      // Status Type category filter
      if (categoryFilter === 'medical' && !typeName.includes('sick') && !typeName.includes('medical')) {
        return false;
      }
      if (categoryFilter === 'casual' && !typeName.includes('casual') && !typeName.includes('personal')) {
        return false;
      }
      if (categoryFilter === 'duty' && !typeName.includes('comp') && !typeName.includes('duty') && !typeName.includes('unpaid')) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'all' && r.status !== statusFilter) {
        return false;
      }

      // Search query
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        empName.includes(q) ||
        empCode.includes(q) ||
        deptName.includes(q) ||
        desig.includes(q) ||
        typeName.includes(q) ||
        reason.includes(q) ||
        serial.includes(q);

      // Workplace unit filter
      const matchesUnit = unitFilter === 'all' || unit === unitFilter.toLowerCase();

      return matchesSearch && matchesUnit;
    });
  }, [requests, scopeFilter, categoryFilter, statusFilter, search, unitFilter, tenantEmployee, profile]);

  const pendingList = useMemo(() => filtered.filter((r) => r.status === 'pending'), [filtered]);
  const approvedList = useMemo(() => filtered.filter((r) => r.status === 'approved'), [filtered]);
  const rejectedList = useMemo(() => filtered.filter((r) => r.status === 'rejected'), [filtered]);

  // Upcoming approved leaves for Taskly Grouped view
  const upcomingApprovedList = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return approvedList.filter((r) => (r.start_date || '') >= today);
  }, [approvedList]);

  // Completed/past decisions for Taskly Grouped view
  const completedList = useMemo(() => {
    return filtered.filter((r) => r.status === 'approved' || r.status === 'rejected');
  }, [filtered]);

  if (loading) return <LoadingState />;

  const kpiCardWidth = isDesktop ? undefined : (width - 40 - 12) / 2;

  return (
    <SidebarLayout items={getNavForRole(profile?.role || 'hr', profile?.email)}>
      <ScrollView
        style={[styles.container, { backgroundColor: '#F8F9FC' }]}
        contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Modern Header Row */}
        <Animated.View entering={FadeInDown.duration(280)} style={styles.modernHeaderRow}>
          <View style={{ flex: 1, minWidth: 260 }}>
            <View style={styles.breadcrumbRow}>
              <Text style={styles.breadcrumbMuted}>Dashboard</Text>
              <Text style={styles.breadcrumbMuted}>/</Text>
              <Text style={styles.breadcrumbActive}>Approvals & Requests</Text>
            </View>

            <Text style={[styles.pageTitle, { color: '#0F172A' }]}>Approvals & Requests</Text>
            <Text style={[styles.pageSubtitle, { color: '#64748B' }]}>
              Multi-stage approval pipeline, request tracking, and policy governance for{' '}
              <Text style={{ fontWeight: '700', color: '#0F172A' }}>{tenantOrg?.name || 'Workspace'}</Text>.
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={onRefresh}
              disabled={refreshing}
              activeOpacity={0.8}
            >
              <RefreshCw size={14} color="#64748B" />
              <Text style={styles.refreshBtnText}>Refresh</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.headerSecondaryBtn, { borderColor: '#7C3AED' }]}
              onPress={handleOpenApplyModal}
              activeOpacity={0.85}
            >
              <Plus size={15} color="#7C3AED" strokeWidth={2.5} />
              <Text style={[styles.headerSecondaryBtnText, { color: '#7C3AED' }]}>Log Request</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.headerPrimaryBtn, { backgroundColor: '#7C3AED' }]}
              onPress={handleOpenAddType}
              activeOpacity={0.88}
            >
              <Sliders size={15} color="#FFFFFF" strokeWidth={2.2} />
              <Text style={styles.headerPrimaryBtnText}>New Policy</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* 4 Pastel Metric KPI Cards */}
        <Animated.View entering={FadeInDown.delay(40).duration(280)} style={styles.kpiRow}>
          {/* Tile 1: Pending Requests */}
          <InteractiveTile
            style={[
              styles.pastelMetricCard,
              {
                backgroundColor: '#FFF7ED',
                borderColor: '#FFEDD5',
                flex: isDesktop ? 1 : undefined,
                minWidth: isDesktop ? 160 : undefined,
                width: kpiCardWidth,
              },
            ]}
          >
            <View style={styles.cardTopRow}>
              <View style={[styles.iconBox, { backgroundColor: '#FFEDD5' }]}>
                <Flame size={18} color="#EA580C" />
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.metricValueText, { color: '#9A3412' }]}>{pendingList.length}</Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#EA580C', marginTop: 1 }}>Pending</Text>
              </View>
            </View>
            <Text style={styles.metricLabelText}>Pending Approvals</Text>
            <View style={styles.waveContainer}>
              <MetricWave color="#EA580C" width={isDesktop ? 140 : 80} height={24} />
            </View>
          </InteractiveTile>

          {/* Tile 2: Approved Requests */}
          <InteractiveTile
            style={[
              styles.pastelMetricCard,
              {
                backgroundColor: '#ECFDF5',
                borderColor: '#D1FAE5',
                flex: isDesktop ? 1 : undefined,
                minWidth: isDesktop ? 160 : undefined,
                width: kpiCardWidth,
              },
            ]}
          >
            <View style={styles.cardTopRow}>
              <View style={[styles.iconBox, { backgroundColor: '#D1FAE5' }]}>
                <CheckCircle2 size={18} color="#059669" />
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.metricValueText, { color: '#065F46' }]}>{approvedList.length}</Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#059669', marginTop: 1 }}>Approved</Text>
              </View>
            </View>
            <Text style={styles.metricLabelText}>Completed & Granted</Text>
            <View style={styles.waveContainer}>
              <MetricWave color="#10B981" width={isDesktop ? 140 : 80} height={24} />
            </View>
          </InteractiveTile>

          {/* Tile 3: Rejected / Closed */}
          <InteractiveTile
            style={[
              styles.pastelMetricCard,
              {
                backgroundColor: '#FEF2F2',
                borderColor: '#FEE2E2',
                flex: isDesktop ? 1 : undefined,
                minWidth: isDesktop ? 160 : undefined,
                width: kpiCardWidth,
              },
            ]}
          >
            <View style={styles.cardTopRow}>
              <View style={[styles.iconBox, { backgroundColor: '#FEE2E2' }]}>
                <XCircle size={18} color="#DC2626" />
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.metricValueText, { color: '#991B1B' }]}>{rejectedList.length}</Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#DC2626', marginTop: 1 }}>Declined</Text>
              </View>
            </View>
            <Text style={styles.metricLabelText}>Rejected Applications</Text>
            <View style={styles.waveContainer}>
              <MetricWave color="#EF4444" width={isDesktop ? 140 : 80} height={24} />
            </View>
          </InteractiveTile>

          {/* Tile 4: Active Policies */}
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
                <Sliders size={18} color="#7C3AED" />
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.metricValueText, { color: '#5B21B6' }]}>{leaveTypes.length}</Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#7C3AED', marginTop: 1 }}>Policies</Text>
              </View>
            </View>
            <Text style={styles.metricLabelText}>Configured Leave Policies</Text>
            <View style={styles.waveContainer}>
              <MetricWave color="#8B5CF6" width={isDesktop ? 140 : 80} height={24} />
            </View>
          </InteractiveTile>
        </Animated.View>

        {/* Dual Scope Pill Toggle & Main View Switcher (Image 2 + 1) */}
        <View style={styles.controlsBarRow}>
          {/* Dual Scope Toggle: [ My Requests ] vs [ Team Requests ] */}
          <View style={styles.scopeToggleWrap}>
            <TouchableOpacity
              style={[styles.scopeToggleBtn, scopeFilter === 'my' && styles.scopeToggleBtnActive]}
              onPress={() => setScopeFilter('my')}
              activeOpacity={0.8}
            >
              <User size={14} color={scopeFilter === 'my' ? '#FFFFFF' : '#475569'} />
              <Text style={[styles.scopeToggleBtnText, scopeFilter === 'my' && styles.scopeToggleBtnTextActive]}>
                My Requests
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.scopeToggleBtn, scopeFilter === 'team' && styles.scopeToggleBtnActive]}
              onPress={() => setScopeFilter('team')}
              activeOpacity={0.8}
            >
              <Building2 size={14} color={scopeFilter === 'team' ? '#FFFFFF' : '#475569'} />
              <Text style={[styles.scopeToggleBtnText, scopeFilter === 'team' && styles.scopeToggleBtnTextActive]}>
                Team Requests
              </Text>
            </TouchableOpacity>
          </View>

          {/* View Mode Tabs: Approvals Table (Img 2&3) | Taskly Grouped (Img 1) | Policies */}
          <View style={styles.viewModeTabs}>
            <TouchableOpacity
              onPress={() => setViewMode('approvals')}
              style={[styles.viewTabBtn, viewMode === 'approvals' && styles.viewTabBtnActive]}
            >
              <List size={14} color={viewMode === 'approvals' ? '#7C3AED' : '#64748B'} />
              <Text style={[styles.viewTabBtnText, viewMode === 'approvals' && styles.viewTabBtnTextActive]}>
                Queue Table
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setViewMode('grouped')}
              style={[styles.viewTabBtn, viewMode === 'grouped' && styles.viewTabBtnActive]}
            >
              <Layers size={14} color={viewMode === 'grouped' ? '#7C3AED' : '#64748B'} />
              <Text style={[styles.viewTabBtnText, viewMode === 'grouped' && styles.viewTabBtnTextActive]}>
                Grouped View
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setViewMode('policies')}
              style={[styles.viewTabBtn, viewMode === 'policies' && styles.viewTabBtnActive]}
            >
              <Sliders size={14} color={viewMode === 'policies' ? '#7C3AED' : '#64748B'} />
              <Text style={[styles.viewTabBtnText, viewMode === 'policies' && styles.viewTabBtnTextActive]}>
                Policies ({leaveTypes.length})
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Visual Approval Path Stepper Banner */}
        {viewMode !== 'policies' && (
          <View style={styles.approvalPathBanner}>
            <View style={styles.pathHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <ShieldCheck size={16} color="#7C3AED" />
                <Text style={styles.pathTitle}>{approvalWorkflowTitle}</Text>
              </View>
              <Text style={styles.pathSubtitle}>
                {approvalWorkflowSubtitle}
              </Text>
            </View>

            <View style={styles.stepperContainer}>
              {activeTiers.map((tier, idx) => {
                return (
                  <React.Fragment key={tier.tier}>
                    <View style={styles.stepperItem}>
                      <View style={[styles.stepperCircle, { backgroundColor: idx === 0 ? '#7C3AED' : idx === 1 ? '#3B82F6' : idx === 2 ? '#059669' : '#0F172A' }]}>
                        <Text style={styles.stepperCircleText}>{tier.code}</Text>
                      </View>
                      <View style={{ gap: 2, flex: 1 }}>
                        <Text style={styles.stepperStepName}>Stage {tier.tier}</Text>
                        <Text style={styles.stepperStepRole} numberOfLines={1}>
                          {tier.name}
                        </Text>
                      </View>
                    </View>
                    {idx < activeTiers.length - 1 && (
                      <View style={styles.stepperConnector} />
                    )}
                  </React.Fragment>
                );
              })}
            </View>
          </View>
        )}

        {/* Search, Status Tabs & Workplace Unit Filters */}
        {viewMode !== 'policies' && (
          <View style={styles.filterSection}>
            {/* Row 1: Search & Status Tabs */}
            <View style={styles.filterTopRow}>
              <View style={styles.searchBoxModern}>
                <Search size={15} color="#94A3B8" />
                <TextInput
                  placeholder="Search by serial (LEAV-717), staff name, department, leave type..."
                  placeholderTextColor="#94A3B8"
                  value={search}
                  onChangeText={setSearch}
                  style={styles.searchInputModern}
                />
                {search ? (
                  <TouchableOpacity onPress={() => setSearch('')}>
                    <X size={15} color="#94A3B8" />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Status Queue Tabs (Image 3) */}
              <View style={styles.statusQueueTabs}>
                {(['all', 'pending', 'approved', 'rejected'] as const).map((st) => {
                  const count =
                    st === 'all'
                      ? filtered.length
                      : st === 'pending'
                      ? pendingList.length
                      : st === 'approved'
                      ? approvedList.length
                      : rejectedList.length;
                  const active = statusFilter === st;

                  return (
                    <TouchableOpacity
                      key={st}
                      style={[styles.statusQueueTab, active && styles.statusQueueTabActive]}
                      onPress={() => setStatusFilter(st)}
                    >
                      <Text style={[styles.statusQueueTabText, active && styles.statusQueueTabTextActive]}>
                        {st.charAt(0).toUpperCase() + st.slice(1)} ({count})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Row 2: Status Type Category Selector (Image 2) & Unit Pills */}
            <View style={styles.filterBottomRow}>
              {/* Category selector pills */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryPillsRow}
              >
                <TouchableOpacity
                  style={[styles.categoryPill, categoryFilter === 'all' && styles.categoryPillActive]}
                  onPress={() => setCategoryFilter('all')}
                >
                  <Text style={[styles.categoryPillText, categoryFilter === 'all' && styles.categoryPillTextActive]}>
                    All Time Off
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.categoryPill, categoryFilter === 'medical' && styles.categoryPillActive]}
                  onPress={() => setCategoryFilter(categoryFilter === 'medical' ? 'all' : 'medical')}
                >
                  <BriefcaseMedical size={12} color={categoryFilter === 'medical' ? '#7C3AED' : '#64748B'} />
                  <Text style={[styles.categoryPillText, categoryFilter === 'medical' && styles.categoryPillTextActive]}>
                    Medical & Sick
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.categoryPill, categoryFilter === 'casual' && styles.categoryPillActive]}
                  onPress={() => setCategoryFilter(categoryFilter === 'casual' ? 'all' : 'casual')}
                >
                  <Coffee size={12} color={categoryFilter === 'casual' ? '#7C3AED' : '#64748B'} />
                  <Text style={[styles.categoryPillText, categoryFilter === 'casual' && styles.categoryPillTextActive]}>
                    Casual / Personal
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.categoryPill, categoryFilter === 'duty' && styles.categoryPillActive]}
                  onPress={() => setCategoryFilter(categoryFilter === 'duty' ? 'all' : 'duty')}
                >
                  <Plane size={12} color={categoryFilter === 'duty' ? '#7C3AED' : '#64748B'} />
                  <Text style={[styles.categoryPillText, categoryFilter === 'duty' && styles.categoryPillTextActive]}>
                    Comp-Off & Duty
                  </Text>
                </TouchableOpacity>
              </ScrollView>

              {/* Workplace Unit Pills strictly scoped to active tenant */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.unitPillsRow}
              >
                <TouchableOpacity
                  style={[styles.unitFilterPill, unitFilter === 'all' && styles.unitFilterPillActive]}
                  onPress={() => setUnitFilter('all')}
                >
                  <Text style={[styles.unitFilterPillText, unitFilter === 'all' && styles.unitFilterPillTextActive]}>
                    All Units ({requests.length})
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
                    >
                      <Building2 size={11} color={active ? '#7C3AED' : '#64748B'} />
                      <Text style={[styles.unitFilterPillText, active && styles.unitFilterPillTextActive]}>
                        {normalized}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        )}

        {/* ═════════════════════════════════════════════════════════════════════════ */}
        {/* VIEW 1: APPROVALS & REQUESTS QUEUE TABLE (IMAGES 2 & 3)                  */}
        {/* ═════════════════════════════════════════════════════════════════════════ */}
        {viewMode === 'approvals' && (
          <View style={styles.tableCard}>
            {/* Table Header Bar */}
            <View style={styles.tableHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <TouchableOpacity onPress={() => toggleSelectAll(filtered)}>
                  {selectedIds.size === filtered.length && filtered.length > 0 ? (
                    <CheckSquare size={17} color="#7C3AED" />
                  ) : (
                    <Square size={17} color="#94A3B8" />
                  )}
                </TouchableOpacity>
                <Text style={styles.tableHeaderTitle}>
                  Requests Queue ({filtered.length})
                </Text>
              </View>

              {selectedIds.size > 0 && (
                <View style={styles.selectionPill}>
                  <Text style={styles.selectionPillText}>{selectedIds.size} selected</Text>
                </View>
              )}
            </View>

            {filtered.length === 0 ? (
              <View style={styles.emptyTable}>
                <CheckCircle2 size={36} color="#059669" />
                <Text style={styles.emptyTableTitle}>All Caught Up!</Text>
                <Text style={styles.emptyTableSub}>
                  No leave requests match the current filters or pending queue.
                </Text>
              </View>
            ) : isDesktop ? (
              /* Desktop Clean Modern Table (Image 2 style) */
              <View>
                {/* Column Headers */}
                <View style={styles.desktopTableHeader}>
                  <View style={{ width: 34 }} />
                  <Text style={[styles.thCell, { width: 105 }]}>SERIAL ID</Text>
                  <Text style={[styles.thCell, { flex: 1.5 }]}>STAFF MEMBER</Text>
                  <Text style={[styles.thCell, { flex: 1.2 }]}>REQUEST TYPE</Text>
                  <Text style={[styles.thCell, { width: 110 }]}>DURATION</Text>
                  <Text style={[styles.thCell, { flex: 1.2 }]}>APPROVAL PATH</Text>
                  <Text style={[styles.thCell, { width: 100 }]}>STATUS</Text>
                  <Text style={[styles.thCell, { width: 130, textAlign: 'right' }]}>ACTIONS</Text>
                </View>

                {/* Table Rows */}
                {filtered.map((req, idx) => {
                  const emp = req.employee as any;
                  const empName = emp?.profile?.full_name || 'Staff Member';
                  const empCode = emp?.employee_code || emp?.id || 'EMP';
                  const deptName = emp?.department?.name;
                  const serial = getRequestSerial(req);
                  const isSelected = selectedIds.has(req.id);
                  const tierNum = req.current_tier || 1;
                  const tierInfo =
                    activeTiers.find((t) => t.tier === tierNum) || activeTiers[0];

                  return (
                    <TouchableOpacity
                      key={req.id}
                      style={[
                        styles.desktopRow,
                        isSelected && { backgroundColor: '#F5F3FF' },
                        idx !== filtered.length - 1 && styles.rowBorderBottom,
                      ]}
                      onPress={() => handleOpenChainModal(req)}
                      activeOpacity={0.7}
                    >
                      {/* Checkbox */}
                      <TouchableOpacity
                        style={{ width: 34 }}
                        onPress={(e) => {
                          e.stopPropagation();
                          toggleSelect(req.id);
                        }}
                      >
                        {isSelected ? (
                          <CheckSquare size={16} color="#7C3AED" />
                        ) : (
                          <Square size={16} color="#CBD5E1" />
                        )}
                      </TouchableOpacity>

                      {/* Serial Number */}
                      <View style={{ width: 105 }}>
                        <View style={styles.serialChip}>
                          <Text style={styles.serialText}>{serial}</Text>
                        </View>
                      </View>

                      {/* Staff Member */}
                      <View style={{ flex: 1.5, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Avatar name={empName} url={emp?.profile?.avatar_url} size={34} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.empRowName} numberOfLines={1}>
                            {empName}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.empRowCode}>{empCode}</Text>
                            {deptName && (
                              <Text style={styles.empRowDept} numberOfLines={1}>
                                • {deptName}
                              </Text>
                            )}
                          </View>
                        </View>
                      </View>

                      {/* Request Type */}
                      <View style={{ flex: 1.2, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={styles.categoryIconCircle}>
                          {getLeaveCategoryIcon(req.leave_type?.name || 'Leave', 14, '#7C3AED')}
                        </View>
                        <Text style={styles.typeText} numberOfLines={1}>
                          {stripEmoji(req.leave_type?.name || 'General Leave')}
                        </Text>
                      </View>

                      {/* Duration */}
                      <View style={{ width: 110 }}>
                        <Text style={styles.durationDaysText}>
                          {req.days} Day{req.days !== 1 ? 's' : ''}
                        </Text>
                        <Text style={styles.durationDatesText}>
                          {formatDate(req.start_date)}
                        </Text>
                      </View>

                      {/* Approval Path Stage */}
                      <View style={{ flex: 1.2 }}>
                        {req.status === 'approved' ? (
                          <View style={styles.stageChipApproved}>
                            <ShieldCheck size={11} color="#059669" />
                            <Text style={styles.stageChipApprovedText}>All {totalLevels} Tiers Approved</Text>
                          </View>
                        ) : req.status === 'rejected' ? (
                          <View style={styles.stageChipRejected}>
                            <XCircle size={11} color="#DC2626" />
                            <Text style={styles.stageChipRejectedText}>Declined at Tier {tierNum}</Text>
                          </View>
                        ) : (
                          <View style={styles.stageChipPending}>
                            <Clock size={11} color="#D97706" />
                            <Text style={styles.stageChipPendingText}>
                              Stage {tierNum}/{totalLevels}: {tierInfo.code}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Status */}
                      <View style={{ width: 100 }}>
                        <View
                          style={[
                            styles.statusBadgePill,
                            req.status === 'approved'
                              ? styles.badgeApproved
                              : req.status === 'rejected'
                              ? styles.badgeRejected
                              : styles.badgePending,
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusBadgeText,
                              req.status === 'approved'
                                ? { color: '#047857' }
                                : req.status === 'rejected'
                                ? { color: '#B91C1C' }
                                : { color: '#B45309' },
                            ]}
                          >
                            {req.status === 'approved'
                              ? 'Approved'
                              : req.status === 'rejected'
                              ? 'Rejected'
                              : 'Pending'}
                          </Text>
                        </View>
                      </View>

                      {/* Inline Actions (✓ Approve, ✕ Reject, ✎ Review Chain) */}
                      <View style={{ width: 130, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                        {req.status === 'pending' ? (
                          <>
                            <TouchableOpacity
                              style={styles.actionIconBtnApprove}
                              onPress={(e) => {
                                e.stopPropagation();
                                handleAction(req.id, 'approve');
                              }}
                              disabled={processingId === req.id}
                              accessibilityLabel="Quick Approve"
                            >
                              <Check size={13} color="#FFFFFF" strokeWidth={3} />
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.actionIconBtnReject}
                              onPress={(e) => {
                                e.stopPropagation();
                                handleAction(req.id, 'reject');
                              }}
                              disabled={processingId === req.id}
                              accessibilityLabel="Quick Reject"
                            >
                              <X size={13} color="#FFFFFF" strokeWidth={3} />
                            </TouchableOpacity>
                          </>
                        ) : null}

                        <TouchableOpacity
                          style={styles.actionIconBtnReview}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleOpenChainModal(req);
                          }}
                          accessibilityLabel="Inspect Approval Chain & Audit Trail"
                        >
                          <Eye size={13} color="#475569" />
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              /* Mobile Clean List Cards */
              <View style={{ padding: 12, gap: 10 }}>
                {filtered.map((req) => {
                  const emp = req.employee as any;
                  const empName = emp?.profile?.full_name || 'Staff Member';
                  const empCode = emp?.employee_code || emp?.id || 'EMP';
                  const serial = getRequestSerial(req);
                  const tierNum = req.current_tier || 1;
                  const tierInfo =
                    activeTiers.find((t) => t.tier === tierNum) || activeTiers[0];

                  return (
                    <TouchableOpacity
                      key={req.id}
                      style={styles.mobileRowCard}
                      onPress={() => handleOpenChainModal(req)}
                      activeOpacity={0.8}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={styles.serialChip}>
                          <Text style={styles.serialText}>{serial}</Text>
                        </View>

                        <View
                          style={[
                            styles.statusBadgePill,
                            req.status === 'approved'
                              ? styles.badgeApproved
                              : req.status === 'rejected'
                              ? styles.badgeRejected
                              : styles.badgePending,
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusBadgeText,
                              req.status === 'approved'
                                ? { color: '#047857' }
                                : req.status === 'rejected'
                                ? { color: '#B91C1C' }
                                : { color: '#B45309' },
                            ]}
                          >
                            {req.status === 'approved'
                              ? 'Approved'
                              : req.status === 'rejected'
                              ? 'Rejected'
                              : 'Pending'}
                          </Text>
                        </View>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
                        <Avatar name={empName} url={emp?.profile?.avatar_url} size={36} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.empRowName}>{empName}</Text>
                          <Text style={styles.empRowCode}>{empCode} • {req.days} Days</Text>
                        </View>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                        <Text style={{ fontSize: 12, color: '#7C3AED', fontWeight: '700' }}>
                          {stripEmoji(req.leave_type?.name || 'Leave')}
                        </Text>
                        <Text style={{ fontSize: 11, color: '#64748B' }}>
                          {formatDate(req.start_date)} → {formatDate(req.end_date)}
                        </Text>
                      </View>

                      {req.status === 'pending' && (
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                          <TouchableOpacity
                            style={[styles.mobileInlineBtn, { backgroundColor: '#059669' }]}
                            onPress={() => handleAction(req.id, 'approve')}
                            disabled={processingId === req.id}
                          >
                            <Check size={14} color="#FFF" />
                            <Text style={styles.mobileInlineBtnText}>Approve Tier {tierNum}</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.mobileInlineBtn, { backgroundColor: '#DC2626' }]}
                            onPress={() => handleAction(req.id, 'reject')}
                            disabled={processingId === req.id}
                          >
                            <X size={14} color="#FFF" />
                            <Text style={styles.mobileInlineBtnText}>Reject</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* ═════════════════════════════════════════════════════════════════════════ */}
        {/* VIEW 2: GROUPED TASKLY-STYLE TIMELINE VIEW (IMAGE 1)                      */}
        {/* ═════════════════════════════════════════════════════════════════════════ */}
        {viewMode === 'grouped' && (
          <View style={{ gap: 16 }}>
            {/* Section 1: Today's / Immediate Actions Pending (N) */}
            <View style={styles.tasklySectionCard}>
              <TouchableOpacity
                style={styles.tasklySectionHeader}
                onPress={() =>
                  setCollapsedSections((prev) => ({ ...prev, pending: !prev.pending }))
                }
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.tasklySectionTitle}>Action Required (Pending)</Text>
                  <View style={[styles.tasklyCountPill, { backgroundColor: '#FEF3C7' }]}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#B45309' }}>
                      {pendingList.length}
                    </Text>
                  </View>
                </View>
                {collapsedSections.pending ? (
                  <ChevronDown size={18} color="#64748B" />
                ) : (
                  <ChevronUp size={18} color="#64748B" />
                )}
              </TouchableOpacity>
              <Text style={styles.tasklySectionSub}>
                Applications awaiting manager or departmental sign-off
              </Text>

              {!collapsedSections.pending && (
                <View style={styles.tasklyListWrap}>
                  {pendingList.length === 0 ? (
                    <View style={styles.tasklyEmpty}>
                      <CheckCircle2 size={24} color="#059669" />
                      <Text style={styles.tasklyEmptyText}>
                        No pending reviews. All requests have been processed.
                      </Text>
                    </View>
                  ) : (
                    pendingList.map((req) => {
                      const emp = req.employee as any;
                      const empName = emp?.profile?.full_name || 'Staff Member';
                      const empCode = emp?.employee_code || emp?.id || 'EMP';
                      const tierNum = req.current_tier || 1;
                      const tierInfo =
                        activeTiers.find((t) => t.tier === tierNum) || activeTiers[0];
                      const serial = getRequestSerial(req);

                      return (
                        <View key={req.id} style={styles.tasklyItemRow}>
                          <TouchableOpacity onPress={() => toggleSelect(req.id)}>
                            {selectedIds.has(req.id) ? (
                              <CheckSquare size={17} color="#7C3AED" />
                            ) : (
                              <Square size={17} color="#CBD5E1" />
                            )}
                          </TouchableOpacity>

                          {/* Circular pastel icon badge */}
                          <View style={[styles.tasklyIconCircle, { backgroundColor: '#F3EEFE' }]}>
                            {getLeaveCategoryIcon(req.leave_type?.name || 'Leave', 17, '#7C3AED')}
                          </View>

                          {/* Content */}
                          <View style={{ flex: 1, gap: 2 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <Text style={styles.tasklyItemTitle} numberOfLines={1}>
                                {empName} — {stripEmoji(req.leave_type?.name || 'Leave')}
                              </Text>
                              <View style={styles.serialChipSm}>
                                <Text style={styles.serialTextSm}>{serial}</Text>
                              </View>
                            </View>

                            <Text style={styles.tasklyItemSub} numberOfLines={1}>
                              {empCode} • {req.days} days • Current Stage: {tierInfo.name} ({tierInfo.code})
                            </Text>
                          </View>

                          {/* Due / Date Badge */}
                          <View style={styles.tasklyDueBadge}>
                            <Calendar size={11} color="#EA580C" />
                            <Text style={styles.tasklyDueText}>
                              {formatDate(req.start_date)}
                            </Text>
                          </View>

                          {/* Avatar stack */}
                          <Avatar name={empName} url={emp?.profile?.avatar_url} size={28} />

                          {/* Quick Actions */}
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <TouchableOpacity
                              style={styles.tasklyQuickBtnApprove}
                              onPress={() => handleAction(req.id, 'approve')}
                              disabled={processingId === req.id}
                            >
                              <Check size={12} color="#FFF" strokeWidth={3} />
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.tasklyQuickBtnReview}
                              onPress={() => handleOpenChainModal(req)}
                            >
                              <Eye size={12} color="#475569" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              )}
            </View>

            {/* Section 2: Upcoming Scheduled Leaves (N) */}
            <View style={styles.tasklySectionCard}>
              <TouchableOpacity
                style={styles.tasklySectionHeader}
                onPress={() =>
                  setCollapsedSections((prev) => ({ ...prev, upcoming: !prev.upcoming }))
                }
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.tasklySectionTitle}>Upcoming Scheduled Leaves</Text>
                  <View style={[styles.tasklyCountPill, { backgroundColor: '#ECFDF5' }]}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#059669' }}>
                      {upcomingApprovedList.length}
                    </Text>
                  </View>
                </View>
                {collapsedSections.upcoming ? (
                  <ChevronDown size={18} color="#64748B" />
                ) : (
                  <ChevronUp size={18} color="#64748B" />
                )}
              </TouchableOpacity>
              <Text style={styles.tasklySectionSub}>
                Approved leaves starting in the coming days and weeks
              </Text>

              {!collapsedSections.upcoming && (
                <View style={styles.tasklyListWrap}>
                  {upcomingApprovedList.length === 0 ? (
                    <View style={styles.tasklyEmpty}>
                      <Text style={styles.tasklyEmptyText}>
                        No upcoming scheduled leaves recorded.
                      </Text>
                    </View>
                  ) : (
                    upcomingApprovedList.map((req) => {
                      const emp = req.employee as any;
                      const empName = emp?.profile?.full_name || 'Staff Member';
                      const serial = getRequestSerial(req);

                      return (
                        <TouchableOpacity
                          key={req.id}
                          style={styles.tasklyItemRow}
                          onPress={() => handleOpenChainModal(req)}
                          activeOpacity={0.7}
                        >
                          <View style={[styles.tasklyIconCircle, { backgroundColor: '#ECFDF5' }]}>
                            <CheckCircle2 size={16} color="#059669" />
                          </View>

                          <View style={{ flex: 1, gap: 2 }}>
                            <Text style={styles.tasklyItemTitle} numberOfLines={1}>
                              {empName} — {stripEmoji(req.leave_type?.name || 'Leave')}
                            </Text>
                            <Text style={styles.tasklyItemSub}>
                              {serial} • {req.days} days approved • Starts {formatDate(req.start_date)}
                            </Text>
                          </View>

                          <View style={[styles.tasklyDueBadge, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                            <Calendar size={11} color="#059669" />
                            <Text style={[styles.tasklyDueText, { color: '#065F46' }]}>
                              {formatDate(req.start_date)} – {formatDate(req.end_date)}
                            </Text>
                          </View>

                          <Avatar name={empName} url={emp?.profile?.avatar_url} size={28} />
                          <ChevronDown size={14} color="#94A3B8" style={{ transform: [{ rotate: '-90deg' }] }} />
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              )}
            </View>

            {/* Section 3: Completed Decisions (N) */}
            <View style={styles.tasklySectionCard}>
              <TouchableOpacity
                style={styles.tasklySectionHeader}
                onPress={() =>
                  setCollapsedSections((prev) => ({ ...prev, completed: !prev.completed }))
                }
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.tasklySectionTitle}>Completed Decisions</Text>
                  <View style={[styles.tasklyCountPill, { backgroundColor: '#F1F5F9' }]}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#475569' }}>
                      {completedList.length}
                    </Text>
                  </View>
                </View>
                {collapsedSections.completed ? (
                  <ChevronDown size={18} color="#64748B" />
                ) : (
                  <ChevronUp size={18} color="#64748B" />
                )}
              </TouchableOpacity>
              <Text style={styles.tasklySectionSub}>
                Archived sign-offs, finalized approvals, and closed requests
              </Text>

              {!collapsedSections.completed && (
                <View style={styles.tasklyListWrap}>
                  {completedList.slice(0, 15).map((req) => {
                    const emp = req.employee as any;
                    const empName = emp?.profile?.full_name || 'Staff Member';
                    const serial = getRequestSerial(req);

                    return (
                      <TouchableOpacity
                        key={req.id}
                        style={styles.tasklyItemRow}
                        onPress={() => handleOpenChainModal(req)}
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.tasklyIconCircle,
                            {
                              backgroundColor: req.status === 'approved' ? '#ECFDF5' : '#FEF2F2',
                            },
                          ]}
                        >
                          {req.status === 'approved' ? (
                            <CheckCircle2 size={16} color="#059669" />
                          ) : (
                            <XCircle size={16} color="#DC2626" />
                          )}
                        </View>

                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={styles.tasklyItemTitle} numberOfLines={1}>
                            {empName} — {stripEmoji(req.leave_type?.name || 'Leave')}
                          </Text>
                          <Text style={styles.tasklyItemSub}>
                            {serial} • Decision resolved {formatDate(req.updated_at || req.created_at)}
                          </Text>
                        </View>

                        <View
                          style={[
                            styles.statusBadgePill,
                            req.status === 'approved' ? styles.badgeApproved : styles.badgeRejected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusBadgeText,
                              req.status === 'approved' ? { color: '#047857' } : { color: '#B91C1C' },
                            ]}
                          >
                            {req.status === 'approved' ? 'Approved' : 'Rejected'}
                          </Text>
                        </View>

                        <Avatar name={empName} url={emp?.profile?.avatar_url} size={28} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
        )}

        {/* ═════════════════════════════════════════════════════════════════════════ */}
        {/* VIEW 3: POLICIES & ANNUAL QUOTAS CONFIGURATION                           */}
        {/* ═════════════════════════════════════════════════════════════════════════ */}
        {viewMode === 'policies' && (
          <Animated.View entering={FadeIn.duration(280)}>
            <View style={styles.typesHeaderRow}>
              <View style={{ flex: isDesktop ? 1 : undefined }}>
                <Text style={styles.typesSectionTitle}>Configured Leave Policies & Quotas</Text>
                <Text style={styles.typesSectionSub}>
                  Configure annual day allowances, paid/unpaid statuses, and entitlement rules for{' '}
                  <Text style={{ fontWeight: '700', color: '#0F172A' }}>{tenantOrg?.name}</Text>.
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.addPolicyBtn, { backgroundColor: '#7C3AED' }]}
                onPress={handleOpenAddType}
                activeOpacity={0.85}
              >
                <Plus size={15} color="#FFF" strokeWidth={2.5} />
                <Text style={styles.addPolicyBtnText}>Add Leave Policy</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.typesGrid}>
              {leaveTypes.map((lt, idx) => (
                <Animated.View
                  key={lt.id}
                  entering={FadeInDown.delay(idx * 25).duration(240)}
                  style={styles.typeCard}
                >
                  <View style={styles.typeCardTop}>
                    <View style={styles.typeCardIconBox}>
                      {getLeaveCategoryIcon(lt.name, 20, '#7C3AED')}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.typeCardTitle}>{lt.name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <Badge
                          label={lt.is_paid ? 'PAID LEAVE' : 'UNPAID (LOP)'}
                          variant={lt.is_paid ? 'success' : 'dangerLight'}
                        />
                        <View style={styles.annualQuotaPill}>
                          <Text style={styles.annualQuotaPillText}>
                            {lt.annual_days} days / yr
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  <Text style={styles.typeCardDesc} numberOfLines={3}>
                    {lt.description ||
                      'Standard corporate leave policy quota allocated yearly per employee.'}
                  </Text>

                  <View style={styles.typeCardActions}>
                    <TouchableOpacity
                      style={styles.typeActionBtn}
                      onPress={() => handleOpenEditType(lt)}
                    >
                      <Edit2 size={13} color="#7C3AED" />
                      <Text style={styles.typeActionBtnText}>Edit Policy</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.typeActionBtn, { backgroundColor: '#FEE2E2' }]}
                      onPress={() => handleDeleteType(lt.id, lt.name)}
                    >
                      <Trash2 size={13} color="#DC2626" />
                      <Text style={[styles.typeActionBtnText, { color: '#DC2626' }]}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* ═════════════════════════════════════════════════════════════════════════ */}
        {/* MODAL 1: INTERACTIVE APPROVAL CHAIN & AUDIT TRAIL (IMAGES 3 & 4)         */}
        {/* ═════════════════════════════════════════════════════════════════════════ */}
        <Modal
          visible={!!selectedRequestForChain}
          onClose={() => setSelectedRequestForChain(null)}
          title={`Approval Chain — ${getRequestSerial(selectedRequestForChain || ({} as any))}`}
        >
          {selectedRequestForChain && (
            <ScrollView style={{ maxHeight: 600 }} showsVerticalScrollIndicator={false}>
              <View style={{ gap: 16 }}>
                {/* Employee & Leave Application Meta Card */}
                {(() => {
                  const emp = selectedRequestForChain.employee as any;
                  const empName = emp?.profile?.full_name || 'Staff Member';
                  const empCode = emp?.employee_code || emp?.id || 'EMP';
                  const deptName = emp?.department?.name;
                  const tierNum = selectedRequestForChain.current_tier || 1;

                  return (
                    <View style={styles.chainMetaBox}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <Avatar name={empName} url={emp?.profile?.avatar_url} size={46} />
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={styles.chainMetaName}>{empName}</Text>
                          <Text style={styles.chainMetaSub}>
                            {empCode} {deptName ? `• ${deptName}` : ''} {emp?.designation ? `• ${emp.designation}` : ''}
                          </Text>
                        </View>
                        <Badge
                          label={selectedRequestForChain.status.toUpperCase()}
                          variant={
                            selectedRequestForChain.status === 'approved'
                              ? 'success'
                              : selectedRequestForChain.status === 'rejected'
                              ? 'danger'
                              : 'warningLight'
                          }
                        />
                      </View>

                      <View style={styles.chainMetaRow}>
                        <View style={styles.chainMetaItem}>
                          <Text style={styles.chainMetaItemLabel}>LEAVE TYPE</Text>
                          <Text style={styles.chainMetaItemVal}>
                            {stripEmoji(selectedRequestForChain.leave_type?.name || 'General')}
                          </Text>
                        </View>

                        <View style={styles.chainMetaItem}>
                          <Text style={styles.chainMetaItemLabel}>DURATION</Text>
                          <Text style={styles.chainMetaItemVal}>
                            {selectedRequestForChain.days} Day{selectedRequestForChain.days !== 1 ? 's' : ''}
                          </Text>
                        </View>

                        <View style={styles.chainMetaItem}>
                          <Text style={styles.chainMetaItemLabel}>DATES</Text>
                          <Text style={styles.chainMetaItemVal}>
                            {formatDate(selectedRequestForChain.start_date)} → {formatDate(selectedRequestForChain.end_date)}
                          </Text>
                        </View>
                      </View>

                      {selectedRequestForChain.reason ? (
                        <View style={styles.chainReasonBox}>
                          <Text style={styles.chainReasonLabel}>REASON / JUSTIFICATION</Text>
                          <Text style={styles.chainReasonText}>
                            "{selectedRequestForChain.reason}"
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  );
                })()}

                {/* APPROVAL CHAIN Header & Progress Indicator (Image 4) */}
                {(() => {
                  const currentTier = selectedRequestForChain.current_tier || 1;
                  const isApproved = selectedRequestForChain.status === 'approved';
                  const isRejected = selectedRequestForChain.status === 'rejected';
                  const completedStages = isApproved ? totalLevels : isRejected ? Math.max(0, currentTier - 1) : Math.max(0, currentTier - 1);

                  return (
                    <View style={styles.chainSectionHeader}>
                      <Text style={styles.chainSectionTitle}>APPROVAL CHAIN</Text>
                      <Text style={styles.chainProgressText}>
                        {completedStages} of {totalLevels} stages complete
                      </Text>
                    </View>
                  );
                })()}

                {/* Linked Stage Cards (Matching Image 4) */}
                <View style={{ gap: 0 }}>
                  {activeTiers.map((tier, idx) => {
                    const currentTier = selectedRequestForChain.current_tier || 1;
                    const isApproved = selectedRequestForChain.status === 'approved';
                    const isRejected = selectedRequestForChain.status === 'rejected';

                    // Stage status computation
                    let stageState: 'completed' | 'active' | 'pending' | 'rejected' = 'pending';
                    if (isApproved) {
                      stageState = 'completed';
                    } else if (isRejected) {
                      if (tier.tier < currentTier) stageState = 'completed';
                      else if (tier.tier === currentTier) stageState = 'rejected';
                      else stageState = 'pending';
                    } else {
                      if (tier.tier < currentTier) stageState = 'completed';
                      else if (tier.tier === currentTier) stageState = 'active';
                      else stageState = 'pending';
                    }

                    // Find if history exists for this tier
                    const historyItem = selectedRequestForChain.approval_history?.find(
                      (h) => h.tier === tier.tier
                    );

                    return (
                      <React.Fragment key={tier.tier}>
                        <View
                          style={[
                            styles.chainStageCard,
                            stageState === 'completed'
                              ? styles.chainStageCompleted
                              : stageState === 'active'
                              ? styles.chainStageActive
                              : stageState === 'rejected'
                              ? styles.chainStageRejected
                              : styles.chainStagePending,
                          ]}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                            {/* Circle Indicator */}
                            <View
                              style={[
                                styles.stageCircle,
                                stageState === 'completed'
                                  ? styles.stageCircleCompleted
                                  : stageState === 'active'
                                  ? styles.stageCircleActive
                                  : stageState === 'rejected'
                                  ? styles.stageCircleRejected
                                  : styles.stageCirclePending,
                              ]}
                            >
                              {stageState === 'completed' ? (
                                <Check size={14} color="#FFF" strokeWidth={3} />
                              ) : stageState === 'rejected' ? (
                                <X size={14} color="#FFF" strokeWidth={3} />
                              ) : stageState === 'active' ? (
                                <View style={styles.stageDotActive} />
                              ) : (
                                <Text style={styles.stageCircleNum}>{tier.tier}</Text>
                              )}
                            </View>

                            <View style={{ flex: 1, gap: 2 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Text
                                  style={[
                                    styles.stageTitle,
                                    stageState === 'pending' && { color: '#64748B' },
                                  ]}
                                >
                                  Stage {tier.tier}: {tier.name}
                                </Text>
                                <View
                                  style={[
                                    styles.stageBadge,
                                    stageState === 'completed'
                                      ? styles.stageBadgeApproved
                                      : stageState === 'active'
                                      ? styles.stageBadgeReview
                                      : stageState === 'rejected'
                                      ? styles.stageBadgeDeclined
                                      : styles.stageBadgeWaiting,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.stageBadgeText,
                                      stageState === 'completed'
                                        ? { color: '#047857' }
                                        : stageState === 'active'
                                        ? { color: '#1D4ED8' }
                                        : stageState === 'rejected'
                                        ? { color: '#B91C1C' }
                                        : { color: '#64748B' },
                                    ]}
                                  >
                                    {stageState === 'completed'
                                      ? 'APPROVED'
                                      : stageState === 'active'
                                      ? 'AWAITING REVIEW'
                                      : stageState === 'rejected'
                                      ? 'REJECTED'
                                      : 'PENDING'}
                                  </Text>
                                </View>
                              </View>

                              <Text style={styles.stageSub}>
                                {historyItem
                                  ? `Signed by ${historyItem.approver_name} (${historyItem.role_title}) • ${formatDate(historyItem.timestamp)}`
                                  : stageState === 'active'
                                  ? `Assigned • Pending review and sign-off`
                                  : `Waiting for Stage ${tier.tier - 1} sign-off`}
                              </Text>

                              {historyItem?.notes ? (
                                <Text style={styles.stageNotes}>
                                  "{historyItem.notes}"
                                </Text>
                              ) : null}
                            </View>
                          </View>

                          {/* Right Side Status / Action Button */}
                          <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                            {stageState === 'completed' ? (
                              <Text style={styles.signedOffText}>Signed off</Text>
                            ) : stageState === 'rejected' ? (
                              <Text style={styles.declinedText}>Declined</Text>
                            ) : stageState === 'active' ? (
                              <TouchableOpacity
                                style={styles.reviewNowBtn}
                                onPress={() => setShowReviewInput(true)}
                              >
                                <Text style={styles.reviewNowBtnText}>Review Now</Text>
                              </TouchableOpacity>
                            ) : (
                              <Lock size={16} color="#94A3B8" />
                            )}
                          </View>
                        </View>

                        {/* Connecting Vertical Line */}
                        {idx < activeTiers.length - 1 && (
                          <View style={styles.chainConnectorWrap}>
                            <View
                              style={[
                                styles.chainLine,
                                stageState === 'completed'
                                  ? styles.chainLineCompleted
                                  : styles.chainLinePending,
                              ]}
                            />
                          </View>
                        )}
                      </React.Fragment>
                    );
                  })}
                </View>

                {/* Review Action Input Panel (When Awaiting Review) */}
                {selectedRequestForChain.status === 'pending' && (
                  <View style={styles.decisionPanel}>
                    <Text style={styles.decisionPanelTitle}>Decision & Review Notes</Text>
                    <TextInput
                      style={styles.decisionInput}
                      placeholder="Enter sign-off comments, conditions, or rejection notes (optional)..."
                      placeholderTextColor="#94A3B8"
                      value={reviewNotes}
                      onChangeText={setReviewNotes}
                      multiline
                      numberOfLines={3}
                    />

                    <View style={styles.decisionActionsRow}>
                      <TouchableOpacity
                        style={[styles.decisionBtnApprove, { backgroundColor: '#059669' }]}
                        onPress={() =>
                          handleAction(selectedRequestForChain.id, 'approve', reviewNotes)
                        }
                        disabled={processingId === selectedRequestForChain.id}
                      >
                        <Check size={16} color="#FFF" strokeWidth={2.5} />
                        <Text style={styles.decisionBtnText}>
                          {(selectedRequestForChain.current_tier || 1) >= totalLevels
                            ? 'Finalize & Lock Application'
                            : `Approve Stage ${selectedRequestForChain.current_tier || 1}`}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.decisionBtnReject, { backgroundColor: '#DC2626' }]}
                        onPress={() =>
                          handleAction(selectedRequestForChain.id, 'reject', reviewNotes)
                        }
                        disabled={processingId === selectedRequestForChain.id}
                      >
                        <X size={16} color="#FFF" strokeWidth={2.5} />
                        <Text style={styles.decisionBtnText}>Reject Request</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* AUDIT TRAIL Section (Image 4 bottom) */}
                <View style={styles.auditSection}>
                  <Text style={styles.auditSectionTitle}>AUDIT TRAIL</Text>
                  <View style={styles.auditTimeline}>
                    {/* Event 1: Request Submission */}
                    <View style={styles.auditItem}>
                      <View style={[styles.auditDot, { backgroundColor: '#059669' }]} />
                      <View style={{ flex: 1, paddingBottom: 16 }}>
                        <Text style={styles.auditEventTitle}>
                          Application submitted by staff member
                        </Text>
                        <Text style={styles.auditEventMeta}>
                          {selectedRequestForChain.employee?.profile?.full_name || 'Staff Member'} •{' '}
                          {formatDate(selectedRequestForChain.created_at)}
                        </Text>
                        {selectedRequestForChain.reason && (
                          <Text style={styles.auditEventNotes}>
                            "{selectedRequestForChain.reason}"
                          </Text>
                        )}
                      </View>
                    </View>

                    {/* Subsequent History Items */}
                    {selectedRequestForChain.approval_history?.map((hist, hIdx) => (
                      <View key={hIdx} style={styles.auditItem}>
                        <View
                          style={[
                            styles.auditDot,
                            {
                              backgroundColor: hist.action === 'approved' ? '#059669' : '#DC2626',
                            },
                          ]}
                        />
                        <View style={{ flex: 1, paddingBottom: 16 }}>
                          <Text style={styles.auditEventTitle}>
                            {hist.approver_name} ({hist.role_title}) {hist.action}
                          </Text>
                          <Text style={styles.auditEventMeta}>
                            Stage {hist.tier} • {formatDate(hist.timestamp)}
                          </Text>
                          {hist.notes && (
                            <Text style={styles.auditEventNotes}>"{hist.notes}"</Text>
                          )}
                        </View>
                      </View>
                    ))}

                    {/* If still pending, show current routing */}
                    {selectedRequestForChain.status === 'pending' && (
                      <View style={styles.auditItem}>
                        <View style={[styles.auditDot, { backgroundColor: '#3B82F6' }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.auditEventTitle}>
                            Routed to{' '}
                            {
                              activeTiers.find(
                                (t) => t.tier === (selectedRequestForChain.current_tier || 1)
                              )?.name || 'Next Approver'
                            }{' '}
                            for review
                          </Text>
                          <Text style={styles.auditEventMeta}>
                            In progress • Waiting for administrative sign-off
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                </View>

                <View style={{ marginTop: 8 }}>
                  <Button
                    title="Close Inspector"
                    variant="ghost"
                    onPress={() => setSelectedRequestForChain(null)}
                  />
                </View>
              </View>
            </ScrollView>
          )}
        </Modal>

        {/* ── MODAL 2: Quick Apply Leave Modal ──────────────────────────────── */}
        <Modal
          visible={showApplyModal}
          onClose={() => setShowApplyModal(false)}
          title="Submit Leave Request"
        >
          <View style={{ gap: 12 }}>
            {applyError ? (
              <View style={{ padding: 10, borderRadius: 8, backgroundColor: '#FEE2E2' }}>
                <Text style={{ color: '#DC2626', fontSize: 13 }}>{applyError}</Text>
              </View>
            ) : null}

            <Select
              label="Staff Member *"
              options={employeesList.map((e) => ({
                label: `${e.profile?.full_name || 'Staff'} (${e.employee_code || e.id})`,
                value: e.id,
              }))}
              value={applyEmpId}
              onValueChange={setApplyEmpId}
            />

            <Select
              label="Leave Policy / Category *"
              options={leaveTypes.map((lt) => ({
                label: `${lt.name} (${lt.annual_days} days/yr)`,
                value: lt.id,
              }))}
              value={applyTypeId}
              onValueChange={setApplyTypeId}
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Start Date (YYYY-MM-DD) *"
                  placeholder="2026-11-10"
                  value={applyStartDate}
                  onChangeText={setApplyStartDate}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="End Date (YYYY-MM-DD) *"
                  placeholder="2026-11-12"
                  value={applyEndDate}
                  onChangeText={setApplyEndDate}
                />
              </View>
            </View>

            <Input
              label="Duration in Days *"
              placeholder="1"
              value={applyDays}
              onChangeText={setApplyDays}
              keyboardType="numeric"
            />

            <Input
              label="Reason / Notes"
              placeholder="e.g. Medical viral checkup, personal obligation, etc."
              value={applyReason}
              onChangeText={setApplyReason}
              multiline
              numberOfLines={3}
            />

            <View style={{ gap: 8, marginTop: 10 }}>
              <Button
                title="Submit for Approval"
                onPress={handleSaveApply}
                loading={applySaving}
              />
              <Button
                title="Cancel"
                variant="ghost"
                onPress={() => setShowApplyModal(false)}
                disabled={applySaving}
              />
            </View>
          </View>
        </Modal>

        {/* ── MODAL 3: Add / Edit Leave Type Modal ──────────────────────────── */}
        <Modal
          visible={showTypeModal}
          onClose={() => setShowTypeModal(false)}
          title={editingType ? 'Edit Leave Policy' : 'Create Leave Policy'}
        >
          <View style={{ gap: 14 }}>
            {typeError ? (
              <View style={{ padding: 10, borderRadius: 8, backgroundColor: '#FEE2E2' }}>
                <Text style={{ color: '#DC2626', fontSize: 13 }}>{typeError}</Text>
              </View>
            ) : null}

            <Input
              label="Policy Name *"
              placeholder="e.g. Wellness Leave / Sabbatical / Bereavement Leave"
              value={typeName}
              onChangeText={setTypeName}
            />

            <Input
              label="Annual Quota (Days) *"
              placeholder="12"
              value={typeDays}
              onChangeText={setTypeDays}
              keyboardType="numeric"
            />

            <Select
              label="Paid or Unpaid"
              options={[
                { label: 'Paid Leave (Regular full pay)', value: 'yes' },
                { label: 'Unpaid Leave (Loss of Pay - LOP)', value: 'no' },
              ]}
              value={typeIsPaid}
              onValueChange={setTypeIsPaid}
            />

            <Input
              label="Description (Optional)"
              placeholder="Guidance or rules for when employees can use this leave."
              value={typeDesc}
              onChangeText={setTypeDesc}
              multiline
              numberOfLines={3}
            />

            <View style={{ gap: 8, marginTop: 10 }}>
              <Button
                title={editingType ? 'Save Policy Changes' : 'Create Policy'}
                onPress={handleSaveType}
                loading={typeSaving}
              />
              <Button
                title="Cancel"
                variant="ghost"
                onPress={() => setShowTypeModal(false)}
                disabled={typeSaving}
              />
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SidebarLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { gap: 18, paddingBottom: 64 },
  contentDesktop: {
    maxWidth: 1360,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 36,
    paddingTop: 24,
    gap: 18,
  },

  modernHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 14,
  },
  breadcrumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
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
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 4,
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
    marginTop: 2,
    maxWidth: 680,
    lineHeight: 18,
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
  headerSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
  },
  headerSecondaryBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  headerPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 9,
  },
  headerPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // KPI Metric Cards
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
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
    marginBottom: 8,
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

  // Dual Scope & Controls Bar
  controlsBarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  scopeToggleWrap: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  scopeToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 9,
  },
  scopeToggleBtnActive: {
    backgroundColor: '#0F172A',
  },
  scopeToggleBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  scopeToggleBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  viewModeTabs: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  viewTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  viewTabBtnActive: {
    backgroundColor: '#F3EEFE',
  },
  viewTabBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748B',
  },
  viewTabBtnTextActive: {
    color: '#7C3AED',
    fontWeight: '700',
  },

  // Four-Tier Stepper Banner (Image 3)
  approvalPathBanner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 12,
  },
  pathHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  pathTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  pathSubtitle: {
    fontSize: 12,
    color: '#64748B',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  stepperItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 180,
  },
  stepperCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperCircleText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  stepperStepName: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  stepperStepRole: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1E293B',
  },
  stepperConnector: {
    height: 2,
    width: 24,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
  },

  // Filters Section
  filterSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 12,
  },
  filterTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  searchBoxModern: {
    flex: 1,
    minWidth: 260,
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
  searchInputModern: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
  },
  statusQueueTabs: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    padding: 3,
    borderRadius: 10,
    gap: 3,
  },
  statusQueueTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 7,
  },
  statusQueueTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statusQueueTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  statusQueueTabTextActive: {
    color: '#0F172A',
    fontWeight: '700',
  },
  filterBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  categoryPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  categoryPillActive: {
    backgroundColor: '#F3EEFE',
    borderColor: '#DDD6FE',
  },
  categoryPillText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
  },
  categoryPillTextActive: {
    color: '#7C3AED',
    fontWeight: '700',
  },
  unitPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  unitFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
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
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
  },
  unitFilterPillTextActive: {
    color: '#7C3AED',
    fontWeight: '700',
  },

  // Table (Queue View)
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tableHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  selectionPill: {
    backgroundColor: '#F3EEFE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  selectionPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C3AED',
  },
  desktopTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  thCell: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  desktopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  rowBorderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  serialChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  serialText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334155',
  },
  empRowName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  empRowCode: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  empRowDept: {
    fontSize: 11,
    color: '#94A3B8',
  },
  categoryIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F3EEFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#1E293B',
  },
  durationDaysText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  durationDatesText: {
    fontSize: 11,
    color: '#64748B',
  },
  stageChipApproved: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  stageChipApprovedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  stageChipRejected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  stageChipRejectedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  stageChipPending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  stageChipPendingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  statusBadgePill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  badgePending: {
    backgroundColor: '#FEF3C7',
  },
  badgeApproved: {
    backgroundColor: '#D1FAE5',
  },
  badgeRejected: {
    backgroundColor: '#FEE2E2',
  },
  statusBadgeText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  actionIconBtnApprove: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconBtnReject: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconBtnReview: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTable: {
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyTableTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
  },
  emptyTableSub: {
    fontSize: 13,
    color: '#64748B',
  },
  mobileRowCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    gap: 6,
  },
  mobileInlineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 8,
  },
  mobileInlineBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  // Taskly Grouped Layout (Image 1)
  tasklySectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 4,
  },
  tasklySectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tasklySectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  tasklyCountPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  tasklySectionSub: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 8,
  },
  tasklyListWrap: {
    gap: 8,
    marginTop: 4,
  },
  tasklyItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tasklyIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tasklyItemTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  tasklyItemSub: {
    fontSize: 11.5,
    color: '#64748B',
  },
  serialChipSm: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  serialTextSm: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#475569',
  },
  tasklyDueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tasklyDueText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#C2410C',
  },
  tasklyQuickBtnApprove: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tasklyQuickBtnReview: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tasklyEmpty: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  tasklyEmptyText: {
    fontSize: 12.5,
    color: '#64748B',
  },

  // Policies View
  typesHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  typesSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  typesSectionSub: {
    fontSize: 12.5,
    color: '#64748B',
    marginTop: 2,
  },
  addPolicyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addPolicyBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  typesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  typeCard: {
    flex: 1,
    minWidth: 300,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 10,
  },
  typeCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  typeCardIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F3EEFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  annualQuotaPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  annualQuotaPillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#334155',
  },
  typeCardDesc: {
    fontSize: 12.5,
    color: '#64748B',
    lineHeight: 18,
  },
  typeCardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  typeActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
  },
  typeActionBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#7C3AED',
  },

  // Modal: Approval Chain & Audit Trail (Images 3 & 4)
  chainMetaBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 10,
  },
  chainMetaName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  chainMetaSub: {
    fontSize: 12,
    color: '#64748B',
  },
  chainMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  chainMetaItem: {
    gap: 2,
  },
  chainMetaItemLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  chainMetaItemVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  chainReasonBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    gap: 2,
  },
  chainReasonLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#94A3B8',
  },
  chainReasonText: {
    fontSize: 12,
    color: '#334155',
    fontStyle: 'italic',
  },

  chainSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  chainSectionTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
  },
  chainProgressText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
  },

  chainStageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 12,
  },
  chainStageCompleted: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  chainStageActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
  },
  chainStageRejected: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  chainStagePending: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  stageCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageCircleCompleted: {
    backgroundColor: '#059669',
  },
  stageCircleActive: {
    backgroundColor: '#2563EB',
  },
  stageCircleRejected: {
    backgroundColor: '#DC2626',
  },
  stageCirclePending: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
  },
  stageDotActive: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
  stageCircleNum: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94A3B8',
  },
  stageTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  stageBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  stageBadgeApproved: {
    backgroundColor: '#DCFCE7',
  },
  stageBadgeReview: {
    backgroundColor: '#DBEAFE',
  },
  stageBadgeDeclined: {
    backgroundColor: '#FEE2E2',
  },
  stageBadgeWaiting: {
    backgroundColor: '#E2E8F0',
  },
  stageBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  stageSub: {
    fontSize: 11.5,
    color: '#64748B',
  },
  stageNotes: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#334155',
    marginTop: 2,
  },
  signedOffText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  declinedText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  reviewNowBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  reviewNowBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  chainConnectorWrap: {
    height: 16,
    marginLeft: 29,
  },
  chainLine: {
    width: 2,
    height: '100%',
  },
  chainLineCompleted: {
    backgroundColor: '#059669',
  },
  chainLinePending: {
    backgroundColor: '#CBD5E1',
  },

  // Decision Panel
  decisionPanel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 10,
    marginTop: 4,
  },
  decisionPanelTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  decisionInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 10,
    fontSize: 12.5,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
    textAlignVertical: 'top',
  },
  decisionActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  decisionBtnApprove: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  decisionBtnReject: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  decisionBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },

  // Audit Section
  auditSection: {
    gap: 10,
    marginTop: 4,
  },
  auditSectionTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
  },
  auditTimeline: {
    paddingLeft: 6,
  },
  auditItem: {
    flexDirection: 'row',
    gap: 12,
  },
  auditDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
  },
  auditEventTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#1E293B',
  },
  auditEventMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  auditEventNotes: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#475569',
    marginTop: 2,
  },
});
