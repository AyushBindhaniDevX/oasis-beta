import { HR_NAV } from '@/constants/navigation';
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
import { useTheme } from '@/hooks/use-theme';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { LoadingState } from '@/components/ui/States';
import { SidebarLayout } from '@/components/layout/Sidebar';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/context/TenantContext';
import {
  getAllLeaveRequests,
  processLeaveRequest,
  getLeaveTypes,
  createLeaveType,
  updateLeaveType,
  deleteLeaveType,
  HOSPITAL_LEAVE_TIERS,
} from '@/lib/services/leave';
import { formatDate } from '@/utils/format';
import type { LeaveRequest, LeaveType } from '@/types';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Kanban,
  List,
  Calendar,
  Layers,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Building2,
  IdCard,
  Plus,
  Trash2,
  Edit2,
  Sliders,
  ShieldCheck,
  Umbrella,
  FileCheck,
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';

export default function HRLeaveWorkflowScreen() {
  const colors = useTheme();
  const { profile } = useAuth();
  const { organization: tenantOrg } = useTenant();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // View Mode: 'board' (Kanban / Workflow) | 'list' | 'types' (Leave Policies)
  const [viewMode, setViewMode] = useState<'board' | 'list' | 'types'>('board');
  const [mobileStatusTab, setMobileStatusTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [search, setSearch] = useState('');

  // Drag and Drop state (Web)
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetColumn, setDropTargetColumn] = useState<string | null>(null);

  // Leave Type Modal State
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [editingType, setEditingType] = useState<LeaveType | null>(null);
  const [typeName, setTypeName] = useState('');
  const [typeDays, setTypeDays] = useState('12');
  const [typeIsPaid, setTypeIsPaid] = useState('yes');
  const [typeDesc, setTypeDesc] = useState('');
  const [typeSaving, setTypeSaving] = useState(false);
  const [typeError, setTypeError] = useState('');

  const load = useCallback(async () => {
    try {
      const orgId = tenantOrg?.id || profile?.organization_id;
      const [reqData, typesData] = await Promise.all([
        getAllLeaveRequests(orgId),
        getLeaveTypes(orgId),
      ]);
      setRequests(reqData);
      setLeaveTypes(typesData);
    } catch (err) {
      console.error('Error loading HR leave requests and types:', err);
    } finally {
      setLoading(false);
    }
  }, [profile, tenantOrg]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

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
      setTypeError(err instanceof Error ? err.message : 'Failed to save leave type');
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
      if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
        await proceed();
      }
    } else {
      Alert.alert('Delete Leave Policy', `Are you sure you want to delete "${name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: proceed },
      ]);
    }
  };

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    setProcessingId(id);
    try {
      await processLeaveRequest(id, action, profile?.full_name || 'HR Operations');
      await load();
    } catch (err) {
      console.error('Action error:', err);
    } finally {
      setProcessingId(null);
    }
  };

  // Drag and Drop handlers for Web
  const handleDragStart = (e: any, id: string) => {
    if (e && e.dataTransfer) {
      e.dataTransfer.setData('text/plain', id);
      e.dataTransfer.effectAllowed = 'move';
    }
    setDraggedId(id);
  };

  const handleDragOver = (e: any, columnStatus: string) => {
    if (Platform.OS === 'web' && e) {
      if (e.preventDefault) e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      if (dropTargetColumn !== columnStatus) {
        setDropTargetColumn(columnStatus);
      }
    }
  };

  const handleDragLeave = (e: any) => {
    if (Platform.OS === 'web' && e && e.preventDefault) e.preventDefault();
    setDropTargetColumn(null);
  };

  const handleDrop = async (e: any, targetStatus: 'approved' | 'rejected') => {
    if (Platform.OS === 'web' && e) {
      if (e.preventDefault) e.preventDefault();
      if (e.stopPropagation) e.stopPropagation();
    }
    const id = (e?.dataTransfer ? e.dataTransfer.getData('text/plain') : null) || draggedId;
    if (id) {
      const req = requests.find((r) => r.id === id);
      if (req && req.status === 'pending') {
        const action = targetStatus === 'approved' ? 'approve' : 'reject';
        await handleAction(id, action);
      }
    }
    setDraggedId(null);
    setDropTargetColumn(null);
  };

  const stripEmoji = (s: string) =>
    (s || '').replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/gu, '').trim();

  // Filter requests by name, code, id, department, designation, leave type, reason
  const filtered = useMemo(() => {
    if (!search.trim()) return requests;
    const q = search.toLowerCase();
    return requests.filter((r) => {
      const emp = r.employee as any;
      const empName = (emp?.profile?.full_name || '').toLowerCase();
      const empCode = (emp?.employee_code || emp?.id || '').toLowerCase();
      const deptName = (emp?.department?.name || '').toLowerCase();
      const desig = (emp?.designation || '').toLowerCase();
      const typeName = (r.leave_type?.name || '').toLowerCase();
      const reason = (r.reason || '').toLowerCase();

      return (
        empName.includes(q) ||
        empCode.includes(q) ||
        deptName.includes(q) ||
        desig.includes(q) ||
        typeName.includes(q) ||
        reason.includes(q)
      );
    });
  }, [requests, search]);

  const pendingList = filtered.filter((r) => r.status === 'pending');
  const approvedList = filtered.filter((r) => r.status === 'approved');
  const rejectedList = filtered.filter((r) => r.status === 'rejected');

  const statusVariant = (s: string): 'warningLight' | 'successLight' | 'dangerLight' | 'neutral' => {
    const map: Record<string, 'warningLight' | 'successLight' | 'dangerLight' | 'neutral'> = {
      pending: 'warningLight',
      approved: 'successLight',
      rejected: 'dangerLight',
      cancelled: 'neutral',
    };
    return map[s] || 'neutral';
  };

  if (loading) return <LoadingState />;

  return (
    <SidebarLayout>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Bar */}
        <Animated.View entering={FadeInDown.duration(350).springify()}>
          <View
            style={[
              styles.heroBar,
              { backgroundColor: '#0b1c30' },
              !isDesktop && styles.heroBarMobile,
            ]}
          >
            <View style={{ flex: isDesktop ? 1 : undefined, width: isDesktop ? undefined : '100%' }}>
              <Text style={styles.heroSubHeader}>DECISION PIPELINE & APPROVALS</Text>
              <Text style={[styles.heroTitle, !isDesktop && { fontSize: 20 }]}>Leave Request Workflow</Text>
              <Text style={styles.heroSub}>
                {pendingList.length} application{pendingList.length !== 1 ? 's' : ''} awaiting review
              </Text>
            </View>

            {/* View Mode Toggle */}
            <View style={[styles.viewToggleWrap, !isDesktop && styles.viewToggleWrapMobile]}>
              <TouchableOpacity
                onPress={() => setViewMode('board')}
                style={[
                  styles.toggleBtn,
                  !isDesktop && styles.toggleBtnMobile,
                  viewMode === 'board' && { backgroundColor: '#006a61' },
                ]}
              >
                <Kanban size={15} color="#FFF" />
                <Text style={styles.toggleText}>Pipeline</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setViewMode('list')}
                style={[
                  styles.toggleBtn,
                  !isDesktop && styles.toggleBtnMobile,
                  viewMode === 'list' && { backgroundColor: '#006a61' },
                ]}
              >
                <List size={15} color="#FFF" />
                <Text style={styles.toggleText}>List</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setViewMode('types')}
                style={[
                  styles.toggleBtn,
                  !isDesktop && styles.toggleBtnMobile,
                  viewMode === 'types' && { backgroundColor: '#006a61' },
                ]}
              >
                <Sliders size={15} color="#FFF" />
                <Text style={styles.toggleText}>Policies ({leaveTypes.length})</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>

        {/* Search & Statistics Bar */}
        <View
          style={[
            styles.controlsBar,
            { backgroundColor: colors.surface, borderColor: '#e2e8f0' },
            !isDesktop && styles.controlsBarMobile,
          ]}
        >
          <View style={[styles.searchBox, { borderColor: '#e2e8f0' }]}>
            <Search size={16} color={colors.textSecondary} />
            <TextInput
              placeholder="Search by employee name, ID, department, leave type..."
              placeholderTextColor={colors.textSecondary}
              value={search}
              onChangeText={setSearch}
              style={[styles.searchInput, { color: colors.text }]}
            />
          </View>

          {isDesktop && (
            <View style={styles.countsRow}>
              <View style={[styles.countBadge, { backgroundColor: '#fef3c7', borderColor: '#fde68a' }]}>
                <Text style={[styles.countVal, { color: '#b45309' }]}>{pendingList.length}</Text>
                <Text style={[styles.countLabel, { color: '#b45309' }]}>Pending</Text>
              </View>
              <View style={[styles.countBadge, { backgroundColor: '#edf8f6', borderColor: '#c4ece7' }]}>
                <Text style={[styles.countVal, { color: '#006a61' }]}>{approvedList.length}</Text>
                <Text style={[styles.countLabel, { color: '#006a61' }]}>Approved</Text>
              </View>
              <View style={[styles.countBadge, { backgroundColor: '#fff5f5', borderColor: '#ffdad6' }]}>
                <Text style={[styles.countVal, { color: '#ba1a1a' }]}>{rejectedList.length}</Text>
                <Text style={[styles.countLabel, { color: '#ba1a1a' }]}>Rejected</Text>
              </View>
            </View>
          )}
        </View>

        {/* ── KANBAN PIPELINE BOARD VIEW ────────────────────────────────────── */}
        {viewMode === 'board' ? (
          isDesktop ? (
            <View style={styles.boardGridDesktop}>
              {/* Column 1: Pending Review */}
              <View style={[styles.kanbanCol, { backgroundColor: colors.surface, borderColor: '#e2e8f0' }]}>
                <View style={[styles.colHead, { borderBottomColor: '#f1f5f9' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={[styles.statusDot, { backgroundColor: '#d97706' }]} />
                    <Text style={[styles.colTitle, { color: colors.text }]}>Pending Review</Text>
                  </View>
                  <View style={[styles.colPill, { backgroundColor: '#fef3c7' }]}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#b45309' }}>
                      {pendingList.length}
                    </Text>
                  </View>
                </View>

                <ScrollView style={styles.colScroll} showsVerticalScrollIndicator={false}>
                  {pendingList.length === 0 ? (
                    <View style={styles.colEmpty}>
                      <CheckCircle2 size={24} color="#006a61" />
                      <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 6 }}>
                        All caught up! No pending requests.
                      </Text>
                    </View>
                  ) : (
                    <View style={{ gap: 12 }}>
                      {pendingList.map((req) => {
                        const emp = req.employee as any;
                        const empName = emp?.profile?.full_name || 'Staff Member';
                        const empCode = emp?.employee_code || emp?.id || 'EMP';
                        const deptName = emp?.department?.name;

                        return (
                          <View
                            key={req.id}
                            // HTML5 Drag Support on Web
                            {...(Platform.OS === 'web'
                              ? ({
                                  draggable: true,
                                  onDragStart: (e: any) => handleDragStart(e, req.id),
                                  style: [
                                    styles.cardItem,
                                    { backgroundColor: colors.surface, borderColor: '#e2e8f0' },
                                    draggedId === req.id && { opacity: 0.4 },
                                  ],
                                } as any)
                              : {
                                  style: [
                                    styles.cardItem,
                                    { backgroundColor: colors.surface, borderColor: '#e2e8f0' },
                                  ],
                                })}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                              <Avatar name={empName} url={emp?.profile?.avatar_url} size={40} />
                              <View style={{ flex: 1, gap: 2 }}>
                                <Text style={[styles.cardEmpName, { color: colors.text }]} numberOfLines={1}>
                                  {empName}
                                </Text>

                                {/* Employee ID & Department Meta Badges */}
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                  <View style={[styles.idChip, { backgroundColor: '#f1f5f9' }]}>
                                    <Text style={styles.idChipText}>{empCode}</Text>
                                  </View>
                                  {deptName && (
                                    <View style={[styles.deptChip, { backgroundColor: '#edf8f6' }]}>
                                      <Building2 size={10} color="#006a61" />
                                      <Text style={styles.deptChipText} numberOfLines={1}>
                                        {deptName}
                                      </Text>
                                    </View>
                                  )}
                                </View>
                              </View>
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                              <Text style={[styles.cardType, { color: colors.primary }]}>
                                {stripEmoji(req.leave_type?.name || 'Leave')} · {req.days}d
                              </Text>
                              {emp?.designation && (
                                <Text style={{ fontSize: 11, color: colors.textSecondary }} numberOfLines={1}>
                                  {emp.designation}
                                </Text>
                              )}
                            </View>

                            <View style={[styles.dateChip, { backgroundColor: '#f8faff' }]}>
                              <Calendar size={12} color={colors.textSecondary} />
                              <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                                {formatDate(req.start_date)} → {formatDate(req.end_date)}
                              </Text>
                            </View>

                            {req.reason && (
                              <Text style={[styles.cardReason, { color: colors.textSecondary }]} numberOfLines={2}>
                                "{req.reason}"
                              </Text>
                            )}

                            {/* 4-Tier Workflow Stage */}
                            {(() => {
                              const tierNum = req.current_tier || 1;
                              const tierInfo = HOSPITAL_LEAVE_TIERS.find((t) => t.tier === tierNum) || HOSPITAL_LEAVE_TIERS[0];
                              return (
                                <View style={{ marginVertical: 6, padding: 6, backgroundColor: '#f0f9ff', borderRadius: 8, borderWidth: 1, borderColor: '#bae6fd', gap: 2 }}>
                                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#0369a1' }}>
                                      Tier {tierNum} of 4: {tierInfo.code}
                                    </Text>
                                    <Text style={{ fontSize: 10, color: '#0284c7', fontWeight: '600' }}>
                                      Pending Approval
                                    </Text>
                                  </View>
                                  <Text style={{ fontSize: 10, color: '#075985' }}>
                                    Current Approver: {tierInfo.name}
                                  </Text>
                                </View>
                              );
                            })()}

                            {/* Quick Action Buttons */}
                            <View style={styles.cardActions}>
                              <TouchableOpacity
                                style={[styles.btnApprove, { backgroundColor: '#006a61' }]}
                                onPress={() => handleAction(req.id, 'approve')}
                                disabled={processingId === req.id}
                              >
                                <CheckCircle2 size={13} color="#FFF" />
                                <Text style={styles.btnActionText}>
                                  {(req.current_tier || 1) >= 4 ? 'Finalize & Lock' : `Approve Tier ${req.current_tier || 1}`}
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.btnReject, { backgroundColor: '#ba1a1a' }]}
                                onPress={() => handleAction(req.id, 'reject')}
                                disabled={processingId === req.id}
                              >
                                <XCircle size={13} color="#FFF" />
                                <Text style={styles.btnActionText}>Reject</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </ScrollView>
              </View>

              {/* Column 2: Approved */}
              <View
                style={[
                  styles.kanbanCol,
                  { backgroundColor: colors.surface, borderColor: '#e2e8f0' },
                  dropTargetColumn === 'approved' && {
                    borderColor: '#006a61',
                    borderWidth: 2,
                    backgroundColor: '#f0fdf9',
                  },
                ]}
                {...(Platform.OS === 'web'
                  ? ({
                      onDragOver: (e: any) => handleDragOver(e, 'approved'),
                      onDragLeave: handleDragLeave,
                      onDrop: (e: any) => handleDrop(e, 'approved'),
                    } as any)
                  : {})}
              >
                <View style={[styles.colHead, { borderBottomColor: '#f1f5f9' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={[styles.statusDot, { backgroundColor: '#006a61' }]} />
                    <Text style={[styles.colTitle, { color: colors.text }]}>Approved</Text>
                  </View>
                  <View style={[styles.colPill, { backgroundColor: '#edf8f6' }]}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#006a61' }}>
                      {approvedList.length}
                    </Text>
                  </View>
                </View>

                <ScrollView style={styles.colScroll} showsVerticalScrollIndicator={false}>
                  {approvedList.length === 0 ? (
                    <View style={styles.colEmpty}>
                      <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                        No approved requests
                      </Text>
                    </View>
                  ) : (
                    <View style={{ gap: 12 }}>
                      {approvedList.map((req) => {
                        const emp = req.employee as any;
                        const empName = emp?.profile?.full_name || 'Staff Member';
                        const empCode = emp?.employee_code || emp?.id || 'EMP';
                        const deptName = emp?.department?.name;

                        return (
                          <View key={req.id} style={[styles.cardItem, { backgroundColor: colors.surface, borderColor: '#e2e8f0' }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                              <Avatar name={empName} url={emp?.profile?.avatar_url} size={36} />
                              <View style={{ flex: 1, gap: 2 }}>
                                <Text style={[styles.cardEmpName, { color: colors.text }]} numberOfLines={1}>
                                  {empName}
                                </Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                  <View style={[styles.idChip, { backgroundColor: '#f1f5f9' }]}>
                                    <Text style={styles.idChipText}>{empCode}</Text>
                                  </View>
                                  {deptName && (
                                    <View style={[styles.deptChip, { backgroundColor: '#edf8f6' }]}>
                                      <Building2 size={10} color="#006a61" />
                                      <Text style={styles.deptChipText} numberOfLines={1}>
                                        {deptName}
                                      </Text>
                                    </View>
                                  )}
                                </View>
                              </View>
                              <Badge label="APPROVED" variant="successLight" />
                            </View>
                            <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '700', marginTop: 4 }}>
                              {stripEmoji(req.leave_type?.name || 'Leave')} · {req.days}d
                            </Text>
                            <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                              {formatDate(req.start_date)} – {formatDate(req.end_date)}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, backgroundColor: '#ecfdf5', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' }}>
                              <ShieldCheck size={12} color="#059669" />
                              <Text style={{ fontSize: 10, fontWeight: '700', color: '#047857' }}>
                                Fully Approved · Locked (All 4 Tiers)
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </ScrollView>
              </View>

              {/* Column 3: Rejected */}
              <View
                style={[
                  styles.kanbanCol,
                  { backgroundColor: colors.surface, borderColor: '#e2e8f0' },
                  dropTargetColumn === 'rejected' && {
                    borderColor: '#ba1a1a',
                    borderWidth: 2,
                    backgroundColor: '#fff5f5',
                  },
                ]}
                {...(Platform.OS === 'web'
                  ? ({
                      onDragOver: (e: any) => handleDragOver(e, 'rejected'),
                      onDragLeave: handleDragLeave,
                      onDrop: (e: any) => handleDrop(e, 'rejected'),
                    } as any)
                  : {})}
              >
                <View style={[styles.colHead, { borderBottomColor: '#f1f5f9' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={[styles.statusDot, { backgroundColor: '#ba1a1a' }]} />
                    <Text style={[styles.colTitle, { color: colors.text }]}>Rejected</Text>
                  </View>
                  <View style={[styles.colPill, { backgroundColor: '#fff5f5' }]}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#ba1a1a' }}>
                      {rejectedList.length}
                    </Text>
                  </View>
                </View>

                <ScrollView style={styles.colScroll} showsVerticalScrollIndicator={false}>
                  {rejectedList.length === 0 ? (
                    <View style={styles.colEmpty}>
                      <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                        No rejected requests
                      </Text>
                    </View>
                  ) : (
                    <View style={{ gap: 12 }}>
                      {rejectedList.map((req) => {
                        const emp = req.employee as any;
                        const empName = emp?.profile?.full_name || 'Staff Member';
                        const empCode = emp?.employee_code || emp?.id || 'EMP';
                        const deptName = emp?.department?.name;

                        return (
                          <View key={req.id} style={[styles.cardItem, { backgroundColor: colors.surface, borderColor: '#e2e8f0' }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                              <Avatar name={empName} url={emp?.profile?.avatar_url} size={36} />
                              <View style={{ flex: 1, gap: 2 }}>
                                <Text style={[styles.cardEmpName, { color: colors.text }]} numberOfLines={1}>
                                  {empName}
                                </Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                  <View style={[styles.idChip, { backgroundColor: '#f1f5f9' }]}>
                                    <Text style={styles.idChipText}>{empCode}</Text>
                                  </View>
                                  {deptName && (
                                    <View style={[styles.deptChip, { backgroundColor: '#edf8f6' }]}>
                                      <Building2 size={10} color="#006a61" />
                                      <Text style={styles.deptChipText} numberOfLines={1}>
                                        {deptName}
                                      </Text>
                                    </View>
                                  )}
                                </View>
                              </View>
                              <Badge label="REJECTED" variant="dangerLight" />
                            </View>
                            <Text style={{ fontSize: 12, color: colors.danger, fontWeight: '700', marginTop: 4 }}>
                              {stripEmoji(req.leave_type?.name || 'Leave')} · {req.days}d
                            </Text>
                            <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                              {formatDate(req.start_date)} – {formatDate(req.end_date)}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </ScrollView>
              </View>
            </View>
          ) : (
            <View style={styles.mobilePipelineContainer}>
              {/* Mobile Segmented Tab Bar */}
              <View style={[styles.mobileTabBar, { backgroundColor: colors.surface, borderColor: '#e2e8f0' }]}>
                <TouchableOpacity
                  style={[
                    styles.mobileTabBtn,
                    mobileStatusTab === 'pending' && styles.mobileTabBtnActivePending,
                  ]}
                  onPress={() => setMobileStatusTab('pending')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.mobileTabDot, { backgroundColor: '#d97706' }]} />
                  <Text
                    style={[
                      styles.mobileTabText,
                      mobileStatusTab === 'pending' ? styles.mobileTabTextActive : { color: colors.textSecondary },
                    ]}
                  >
                    Pending
                  </Text>
                  <View
                    style={[
                      styles.mobileTabBadge,
                      { backgroundColor: mobileStatusTab === 'pending' ? '#d97706' : '#fef3c7' },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '800',
                        color: mobileStatusTab === 'pending' ? '#FFF' : '#b45309',
                      }}
                    >
                      {pendingList.length}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.mobileTabBtn,
                    mobileStatusTab === 'approved' && styles.mobileTabBtnActiveApproved,
                  ]}
                  onPress={() => setMobileStatusTab('approved')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.mobileTabDot, { backgroundColor: '#006a61' }]} />
                  <Text
                    style={[
                      styles.mobileTabText,
                      mobileStatusTab === 'approved' ? styles.mobileTabTextActive : { color: colors.textSecondary },
                    ]}
                  >
                    Approved
                  </Text>
                  <View
                    style={[
                      styles.mobileTabBadge,
                      { backgroundColor: mobileStatusTab === 'approved' ? '#006a61' : '#edf8f6' },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '800',
                        color: mobileStatusTab === 'approved' ? '#FFF' : '#006a61',
                      }}
                    >
                      {approvedList.length}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.mobileTabBtn,
                    mobileStatusTab === 'rejected' && styles.mobileTabBtnActiveRejected,
                  ]}
                  onPress={() => setMobileStatusTab('rejected')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.mobileTabDot, { backgroundColor: '#ba1a1a' }]} />
                  <Text
                    style={[
                      styles.mobileTabText,
                      mobileStatusTab === 'rejected' ? styles.mobileTabTextActive : { color: colors.textSecondary },
                    ]}
                  >
                    Rejected
                  </Text>
                  <View
                    style={[
                      styles.mobileTabBadge,
                      { backgroundColor: mobileStatusTab === 'rejected' ? '#ba1a1a' : '#fff5f5' },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '800',
                        color: mobileStatusTab === 'rejected' ? '#FFF' : '#ba1a1a',
                      }}
                    >
                      {rejectedList.length}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Mobile Active Tab Cards */}
              {mobileStatusTab === 'pending' && (
                <View style={{ gap: 14 }}>
                  {pendingList.length === 0 ? (
                    <View style={[styles.mobileEmptyCard, { backgroundColor: colors.surface, borderColor: '#e2e8f0' }]}>
                      <CheckCircle2 size={36} color="#006a61" />
                      <Text style={[styles.mobileEmptyTitle, { color: colors.text }]}>All Caught Up!</Text>
                      <Text style={[styles.mobileEmptySub, { color: colors.textSecondary }]}>
                        There are no pending leave requests awaiting approval.
                      </Text>
                    </View>
                  ) : (
                    pendingList.map((req) => {
                      const emp = req.employee as any;
                      const empName = emp?.profile?.full_name || 'Staff Member';
                      const empCode = emp?.employee_code || emp?.id || 'EMP';
                      const deptName = emp?.department?.name;

                      return (
                        <View
                          key={req.id}
                          style={[styles.mobileCard, { backgroundColor: colors.surface, borderColor: '#e2e8f0' }]}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <Avatar name={empName} url={emp?.profile?.avatar_url} size={46} />
                            <View style={{ flex: 1, gap: 3 }}>
                              <Text style={[styles.mobileCardEmpName, { color: colors.text }]}>
                                {empName}
                              </Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <View style={[styles.idChip, { backgroundColor: '#f1f5f9' }]}>
                                  <Text style={styles.idChipText}>{empCode}</Text>
                                </View>
                                {deptName && (
                                  <View style={[styles.deptChip, { backgroundColor: '#edf8f6' }]}>
                                    <Building2 size={11} color="#006a61" />
                                    <Text style={styles.deptChipText} numberOfLines={1}>{deptName}</Text>
                                  </View>
                                )}
                              </View>
                            </View>
                            <Badge label="PENDING" variant="warningLight" />
                          </View>

                          <View style={styles.mobileCardMetaRow}>
                            <View style={[styles.mobileQuotaPill, { backgroundColor: '#edf8f6' }]}>
                              <Umbrella size={13} color="#006a61" />
                              <Text style={{ fontSize: 12, fontWeight: '700', color: '#006a61' }}>
                                {stripEmoji(req.leave_type?.name || 'Leave')}
                              </Text>
                            </View>
                            <Text style={[styles.mobileDaysCount, { color: colors.text }]}>
                              {req.days} Day{req.days !== 1 ? 's' : ''} Total
                            </Text>
                          </View>

                          <View style={[styles.dateChip, { backgroundColor: '#f8faff' }]}>
                            <Calendar size={13} color="#006a61" />
                            <Text style={{ fontSize: 12, fontWeight: '600', color: '#334155' }}>
                              {formatDate(req.start_date)} → {formatDate(req.end_date)}
                            </Text>
                          </View>

                          {req.reason ? (
                            <View style={[styles.reasonBox, { backgroundColor: '#f8fafc', borderColor: '#f1f5f9' }]}>
                              <Text style={[styles.cardReason, { color: colors.textSecondary }]}>
                                "{req.reason}"
                              </Text>
                            </View>
                          ) : null}

                          <View style={styles.mobileCardActions}>
                            <TouchableOpacity
                              style={[styles.btnMobileApprove, { backgroundColor: '#006a61' }]}
                              onPress={() => handleAction(req.id, 'approve')}
                              disabled={processingId === req.id}
                              activeOpacity={0.8}
                            >
                              <CheckCircle2 size={16} color="#FFF" />
                              <Text style={styles.btnMobileActionText}>Approve Request</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.btnMobileReject, { backgroundColor: '#ba1a1a' }]}
                              onPress={() => handleAction(req.id, 'reject')}
                              disabled={processingId === req.id}
                              activeOpacity={0.8}
                            >
                              <XCircle size={16} color="#FFF" />
                              <Text style={styles.btnMobileActionText}>Reject</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              )}

              {/* Approved Tab */}
              {mobileStatusTab === 'approved' && (
                <View style={{ gap: 14 }}>
                  {approvedList.length === 0 ? (
                    <View style={[styles.mobileEmptyCard, { backgroundColor: colors.surface, borderColor: '#e2e8f0' }]}>
                      <Text style={[styles.mobileEmptySub, { color: colors.textSecondary }]}>
                        No approved leave requests.
                      </Text>
                    </View>
                  ) : (
                    approvedList.map((req) => {
                      const emp = req.employee as any;
                      const empName = emp?.profile?.full_name || 'Staff Member';
                      const empCode = emp?.employee_code || emp?.id || 'EMP';
                      const deptName = emp?.department?.name;

                      return (
                        <View
                          key={req.id}
                          style={[styles.mobileCard, { backgroundColor: colors.surface, borderColor: '#e2e8f0' }]}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <Avatar name={empName} url={emp?.profile?.avatar_url} size={42} />
                            <View style={{ flex: 1, gap: 3 }}>
                              <Text style={[styles.mobileCardEmpName, { color: colors.text }]}>
                                {empName}
                              </Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <View style={[styles.idChip, { backgroundColor: '#f1f5f9' }]}>
                                  <Text style={styles.idChipText}>{empCode}</Text>
                                </View>
                                {deptName && (
                                  <View style={[styles.deptChip, { backgroundColor: '#edf8f6' }]}>
                                    <Building2 size={11} color="#006a61" />
                                    <Text style={styles.deptChipText} numberOfLines={1}>{deptName}</Text>
                                  </View>
                                )}
                              </View>
                            </View>
                            <Badge label="APPROVED" variant="successLight" />
                          </View>

                          <View style={styles.mobileCardMetaRow}>
                            <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '700' }}>
                              {stripEmoji(req.leave_type?.name || 'Leave')} · {req.days}d
                            </Text>
                            <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                              {formatDate(req.start_date)} → {formatDate(req.end_date)}
                            </Text>
                          </View>

                          {req.reason ? (
                            <Text style={[styles.cardReason, { color: colors.textSecondary }]}>
                              "{req.reason}"
                            </Text>
                          ) : null}
                        </View>
                      );
                    })
                  )}
                </View>
              )}

              {/* Rejected Tab */}
              {mobileStatusTab === 'rejected' && (
                <View style={{ gap: 14 }}>
                  {rejectedList.length === 0 ? (
                    <View style={[styles.mobileEmptyCard, { backgroundColor: colors.surface, borderColor: '#e2e8f0' }]}>
                      <Text style={[styles.mobileEmptySub, { color: colors.textSecondary }]}>
                        No rejected leave requests.
                      </Text>
                    </View>
                  ) : (
                    rejectedList.map((req) => {
                      const emp = req.employee as any;
                      const empName = emp?.profile?.full_name || 'Staff Member';
                      const empCode = emp?.employee_code || emp?.id || 'EMP';
                      const deptName = emp?.department?.name;

                      return (
                        <View
                          key={req.id}
                          style={[styles.mobileCard, { backgroundColor: colors.surface, borderColor: '#e2e8f0' }]}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <Avatar name={empName} url={emp?.profile?.avatar_url} size={42} />
                            <View style={{ flex: 1, gap: 3 }}>
                              <Text style={[styles.mobileCardEmpName, { color: colors.text }]}>
                                {empName}
                              </Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <View style={[styles.idChip, { backgroundColor: '#f1f5f9' }]}>
                                  <Text style={styles.idChipText}>{empCode}</Text>
                                </View>
                                {deptName && (
                                  <View style={[styles.deptChip, { backgroundColor: '#edf8f6' }]}>
                                    <Building2 size={11} color="#006a61" />
                                    <Text style={styles.deptChipText} numberOfLines={1}>{deptName}</Text>
                                  </View>
                                )}
                              </View>
                            </View>
                            <Badge label="REJECTED" variant="dangerLight" />
                          </View>

                          <View style={styles.mobileCardMetaRow}>
                            <Text style={{ fontSize: 13, color: '#ba1a1a', fontWeight: '700' }}>
                              {stripEmoji(req.leave_type?.name || 'Leave')} · {req.days}d
                            </Text>
                            <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                              {formatDate(req.start_date)} → {formatDate(req.end_date)}
                            </Text>
                          </View>

                          {req.reason ? (
                            <Text style={[styles.cardReason, { color: colors.textSecondary }]}>
                              "{req.reason}"
                            </Text>
                          ) : null}
                        </View>
                      );
                    })
                  )}
                </View>
              )}
            </View>
          )
        ) : viewMode === 'list' ? (
          /* ── TABLE / LIST VIEW ────────────────────────────────────────────── */
          <View style={[styles.tableCard, { backgroundColor: colors.surface, borderColor: '#e2e8f0' }]}>
            <View style={[styles.tableHeader, { borderBottomColor: '#f1f5f9' }]}>
              <Text style={[styles.tableTitle, { color: colors.text }]}>
                All Leave Requests ({filtered.length})
              </Text>
            </View>

            {filtered.length === 0 ? (
              <View style={styles.emptyTable}>
                <Calendar size={32} color={colors.textSecondary} />
                <Text style={{ color: colors.textSecondary, marginTop: 8 }}>No leave requests found</Text>
              </View>
            ) : (
              <View style={{ padding: 8 }}>
                {filtered.map((item, idx) => {
                  const emp = item.employee as any;
                  const empName = emp?.profile?.full_name || 'Staff';
                  const empCode = emp?.employee_code || emp?.id || 'EMP';
                  const deptName = emp?.department?.name;

                  return (
                    <View
                      key={item.id}
                      style={[
                        styles.tableRow,
                        !isDesktop && styles.tableRowMobile,
                        idx !== filtered.length - 1 && {
                          borderBottomWidth: 1,
                          borderBottomColor: '#f1f5f9',
                        },
                      ]}
                    >
                      {isDesktop ? (
                        <>
                          <Avatar name={empName} url={emp?.profile?.avatar_url} size={42} />
                          <View style={{ flex: 1, gap: 4, paddingHorizontal: 12 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
                                {empName}
                              </Text>
                              <View style={[styles.idChip, { backgroundColor: '#f1f5f9' }]}>
                                <Text style={styles.idChipText}>{empCode}</Text>
                              </View>
                              {deptName && (
                                <View style={[styles.deptChip, { backgroundColor: '#edf8f6' }]}>
                                  <Building2 size={11} color="#006a61" />
                                  <Text style={styles.deptChipText}>{deptName}</Text>
                                </View>
                              )}
                            </View>

                            <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '600' }}>
                              {stripEmoji(item.leave_type?.name || 'Leave')} · {formatDate(item.start_date)} — {formatDate(item.end_date)} ({item.days}d)
                            </Text>
                            {item.reason && (
                              <Text style={{ fontSize: 12, color: colors.textSecondary, fontStyle: 'italic' }}>
                                "{item.reason}"
                              </Text>
                            )}
                          </View>

                          <View style={{ alignItems: 'flex-end', gap: 8 }}>
                            <Badge label={item.status} variant={statusVariant(item.status)} />
                            {item.status === 'pending' && (
                              <View style={{ flexDirection: 'row', gap: 6 }}>
                                <TouchableOpacity
                                  style={[styles.btnApprove, { backgroundColor: '#006a61' }]}
                                  onPress={() => handleAction(item.id, 'approve')}
                                  disabled={processingId === item.id}
                                >
                                  <Text style={styles.btnActionText}>Approve</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[styles.btnReject, { backgroundColor: '#ba1a1a' }]}
                                  onPress={() => handleAction(item.id, 'reject')}
                                  disabled={processingId === item.id}
                                >
                                  <Text style={styles.btnActionText}>Reject</Text>
                                </TouchableOpacity>
                              </View>
                            )}
                          </View>
                        </>
                      ) : (
                        <View style={{ gap: 10, width: '100%' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <Avatar name={empName} url={emp?.profile?.avatar_url} size={42} />
                            <View style={{ flex: 1, gap: 2 }}>
                              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
                                {empName}
                              </Text>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <View style={[styles.idChip, { backgroundColor: '#f1f5f9' }]}>
                                  <Text style={styles.idChipText}>{empCode}</Text>
                                </View>
                                {deptName && (
                                  <View style={[styles.deptChip, { backgroundColor: '#edf8f6' }]}>
                                    <Building2 size={11} color="#006a61" />
                                    <Text style={styles.deptChipText} numberOfLines={1}>{deptName}</Text>
                                  </View>
                                )}
                              </View>
                            </View>
                            <Badge label={item.status} variant={statusVariant(item.status)} />
                          </View>

                          <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '600' }}>
                            {stripEmoji(item.leave_type?.name || 'Leave')} · {formatDate(item.start_date)} → {formatDate(item.end_date)} ({item.days}d)
                          </Text>

                          {item.reason && (
                            <View style={[styles.reasonBox, { backgroundColor: '#f8fafc', borderColor: '#f1f5f9' }]}>
                              <Text style={[styles.cardReason, { color: colors.textSecondary }]}>
                                "{item.reason}"
                              </Text>
                            </View>
                          )}

                          {item.status === 'pending' && (
                            <View style={[styles.mobileCardActions, { marginTop: 4 }]}>
                              <TouchableOpacity
                                style={[styles.btnMobileApprove, { backgroundColor: '#006a61' }]}
                                onPress={() => handleAction(item.id, 'approve')}
                                disabled={processingId === item.id}
                              >
                                <CheckCircle2 size={15} color="#FFF" />
                                <Text style={styles.btnMobileActionText}>Approve</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.btnMobileReject, { backgroundColor: '#ba1a1a' }]}
                                onPress={() => handleAction(item.id, 'reject')}
                                disabled={processingId === item.id}
                              >
                                <XCircle size={15} color="#FFF" />
                                <Text style={styles.btnMobileActionText}>Reject</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        ) : (
          /* ── LEAVE POLICIES / TYPES CONFIGURATION VIEW ────────────────── */
          <Animated.View entering={FadeIn.duration(300)}>
            <View
              style={[
                styles.typesHeaderRow,
                { backgroundColor: colors.surface, borderColor: '#e2e8f0' },
                !isDesktop && styles.typesHeaderRowMobile,
              ]}
            >
              <View style={{ flex: isDesktop ? 1 : undefined }}>
                <Text style={[styles.typesSectionTitle, { color: colors.text }]}>
                  Configured Leave Policies & Quotas
                </Text>
                <Text style={[styles.typesSectionSub, { color: colors.textSecondary }]}>
                  Admins and HR can set annual day quotas, paid/unpaid statuses, and policy rules for the organization.
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.addPolicyBtn,
                  { backgroundColor: colors.primary },
                  !isDesktop && styles.addPolicyBtnMobile,
                ]}
                onPress={handleOpenAddType}
              >
                <Plus size={16} color="#FFF" />
                <Text style={styles.addPolicyBtnText}>Add Leave Policy</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.typesGrid}>
              {leaveTypes.map((lt, idx) => (
                <Animated.View
                  key={lt.id}
                  entering={FadeInDown.delay(idx * 30).duration(250).springify()}
                  style={[
                    styles.typeCard,
                    { backgroundColor: colors.surface, borderColor: '#e2e8f0' },
                    !isDesktop && styles.typeCardMobile,
                  ]}
                >
                  <View style={styles.typeCardTop}>
                    <View style={styles.typeCardIconBox}>
                      <Umbrella size={22} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.typeCardTitle, { color: colors.text }]}>{lt.name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                        <Badge
                          label={lt.is_paid ? 'PAID LEAVE' : 'UNPAID (LOP)'}
                          variant={lt.is_paid ? 'success' : 'dangerLight'}
                        />
                        <View style={[styles.annualQuotaPill, { backgroundColor: '#edf8f6' }]}>
                          <Text style={{ fontSize: 11, fontWeight: '800', color: '#006a61' }}>
                            {lt.annual_days} days / yr
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  <Text style={[styles.typeCardDesc, { color: colors.textSecondary }]}>
                    {lt.description || 'Standard corporate leave policy quota allocated yearly per employee.'}
                  </Text>

                  <View style={[styles.typeCardActions, { borderTopColor: '#f1f5f9' }]}>
                    <TouchableOpacity
                      style={[styles.typeActionBtn, { backgroundColor: colors.background }]}
                      onPress={() => handleOpenEditType(lt)}
                    >
                      <Edit2 size={15} color={colors.primary} />
                      <Text style={[styles.typeActionBtnText, { color: colors.primary }]}>Edit Policy</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.typeActionBtn, { backgroundColor: '#FEE2E2' }]}
                      onPress={() => handleDeleteType(lt.id, lt.name)}
                    >
                      <Trash2 size={15} color="#DC2626" />
                      <Text style={[styles.typeActionBtnText, { color: '#DC2626' }]}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* ── Add / Edit Leave Type Modal ──────────────────────────────────── */}
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
  content: { gap: 24, paddingBottom: 64 },
  contentDesktop: { maxWidth: 1300, alignSelf: 'center', width: '100%', paddingHorizontal: 36, paddingTop: 36, gap: 28 },

  heroBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 28,
    paddingTop: 36,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  heroSubHeader: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  heroTitle: { color: '#FFF', fontSize: 24, fontWeight: '800', marginTop: 4, letterSpacing: -0.4 },
  heroSub: { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 4 },

  viewToggleWrap: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  toggleText: { color: '#FFF', fontSize: 12, fontWeight: '700' },

  controlsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 16,
    flexWrap: 'wrap',
  },
  searchBox: {
    flex: 1,
    minWidth: 240,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14 },
  countsRow: { flexDirection: 'row', gap: 8 },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  countVal: { fontSize: 14, fontWeight: '800' },
  countLabel: { fontSize: 12, fontWeight: '600' },

  // Board
  boardGridDesktop: { flexDirection: 'row', gap: 20, alignItems: 'flex-start' },
  boardGridMobile: { gap: 20 },
  kanbanCol: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    minHeight: 480,
  },
  colHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  colTitle: { fontSize: 14, fontWeight: '800' },
  colPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  colScroll: { padding: 12, maxHeight: 600 },
  colEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 4,
  },

  cardItem: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    shadowColor: '#0b1c30',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
    cursor: 'grab' as any,
  },
  cardEmpName: { fontSize: 14, fontWeight: '800' },
  cardType: { fontSize: 12, fontWeight: '700' },
  idChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  idChipText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
  },
  deptChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  deptChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#006a61',
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  cardReason: { fontSize: 12, fontStyle: 'italic', lineHeight: 16 },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  btnApprove: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    borderRadius: 6,
  },
  btnReject: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    borderRadius: 6,
  },
  btnActionText: { color: '#FFF', fontSize: 12, fontWeight: '700' },

  // Responsive Mobile Styles
  heroBarMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 20,
    paddingTop: 28,
  },
  viewToggleWrapMobile: {
    width: '100%',
    justifyContent: 'space-between',
  },
  toggleBtnMobile: {
    flex: 1,
    justifyContent: 'center',
  },
  controlsBarMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 12,
    padding: 12,
  },
  mobilePipelineContainer: {
    gap: 16,
  },
  mobileTabBar: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
    gap: 6,
  },
  mobileTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  mobileTabBtnActivePending: {
    backgroundColor: '#fef3c7',
  },
  mobileTabBtnActiveApproved: {
    backgroundColor: '#edf8f6',
  },
  mobileTabBtnActiveRejected: {
    backgroundColor: '#fff5f5',
  },
  mobileTabDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  mobileTabText: {
    fontSize: 13,
    fontWeight: '700',
  },
  mobileTabTextActive: {
    color: '#0b1c30',
  },
  mobileTabBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  mobileEmptyCard: {
    padding: 36,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mobileEmptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  mobileEmptySub: {
    fontSize: 13,
    textAlign: 'center',
  },
  mobileCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    shadowColor: '#0b1c30',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  mobileCardEmpName: {
    fontSize: 15,
    fontWeight: '800',
  },
  mobileCardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mobileQuotaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  mobileDaysCount: {
    fontSize: 13,
    fontWeight: '700',
  },
  reasonBox: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  mobileCardActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  btnMobileApprove: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
  },
  btnMobileReject: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
  },
  btnMobileActionText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  tableRowMobile: {
    paddingVertical: 16,
    paddingHorizontal: 14,
  },
  typesHeaderRowMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 14,
    padding: 16,
  },
  addPolicyBtnMobile: {
    width: '100%',
    justifyContent: 'center',
  },
  typeCardMobile: {
    minWidth: '100%',
    padding: 16,
  },

  // Table
  tableCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  tableHeader: { padding: 18, borderBottomWidth: 1 },
  tableTitle: { fontSize: 16, fontWeight: '700' },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  emptyTable: {
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Leave Policies Section
  typesHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    gap: 16,
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  typesSectionTitle: { fontSize: 18, fontWeight: '800' },
  typesSectionSub: { fontSize: 13, marginTop: 4, maxWidth: 700 },
  addPolicyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  addPolicyBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  typesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  typeCard: {
    flex: 1,
    minWidth: 320,
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  typeCardTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  typeCardIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#edf8f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeCardTitle: { fontSize: 16, fontWeight: '800' },
  annualQuotaPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeCardDesc: { fontSize: 13, lineHeight: 18 },
  typeCardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  typeActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  typeActionBtnText: { fontSize: 12, fontWeight: '700' },
});
