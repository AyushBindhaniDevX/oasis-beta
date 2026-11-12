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
  ActivityIndicator,
} from 'react-native';
import Svg, { Path, SvgXml } from 'react-native-svg';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import {
  Building2,
  Network,
  Users,
  MapPin,
  ShieldCheck,
  Plus,
  Edit2,
  Trash2,
  Search,
  ChevronRight,
  ChevronDown,
  GitFork,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Layers,
  Sparkles,
  MoveRight,
  Lock,
  X,
  Award,
  SlidersHorizontal,
  FolderTree,
  UserCheck,
  UserX,
  ArrowRight,
  MoreHorizontal,
} from 'lucide-react-native';

import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/context/TenantContext';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LoadingState } from '@/components/ui/States';
import { InteractiveTile } from '@/components/ui/InteractiveTile';
import { SidebarLayout } from '@/components/layout/Sidebar';
import { getNavForRole } from '@/constants/navigation';
import {
  HOSPITAL_UNITS,
  normalizeHospitalUnit,
  getTenantDefaultUnits,
  isShantiHospitalOrg,
} from '@/constants/config';
import {
  STOCK_1_SVG,
  STOCK_4_SVG,
  STOCK_8_SVG,
  STOCK_12_SVG,
} from '@/constants/workManagementSvgs';
import {
  getDepartmentsWithStats,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getOrgHierarchy,
  getWorkplaces,
  updateEmployee,
  updateReportingManager,
} from '@/lib/services/employee';
import { updateUserRole, getOrgUsers } from '@/lib/services/organization';
import { createAuditLog } from '@/lib/services/audit';
import type { Department, Employee, Workplace, Profile } from '@/types';
import { getInitials } from '@/utils/format';

type StudioMode = 'directory' | 'departments' | 'workplaces' | 'roles' | 'org-chart';

const DEPT_COLOR_PALETTES = [
  { color: '#7C3AED', bg: '#EDE9FE', border: '#DDD6FE' },
  { color: '#0284C7', bg: '#E0F2FE', border: '#BAE6FD' },
  { color: '#0D9488', bg: '#CCFBF1', border: '#99F6E4' },
  { color: '#D97706', bg: '#FEF3C7', border: '#FDE68A' },
  { color: '#EC4899', bg: '#FCE7F3', border: '#FBCFE8' },
  { color: '#4F46E5', bg: '#EEF2FF', border: '#C7D2FE' },
  { color: '#16A34A', bg: '#DCFCE7', border: '#BBF7D0' },
  { color: '#9333EA', bg: '#F3E8FF', border: '#E9D5FF' },
];

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

export default function DepartmentsAndHierarchyScreen() {
  const router = useRouter();
  const colors = useTheme();
  const { profile, role } = useAuth();
  const { organization: tenantOrg } = useTenant();
  const { width } = useWindowDimensions();

  const isDesktop = width >= 1024;
  const isTablet = width >= 640 && width < 1024;

  const navItems = getNavForRole(role, profile?.email);

  // Active Studio Mode: 'directory' | 'departments' | 'workplaces' | 'roles' | 'org-chart'
  const [activeMode, setActiveMode] = useState<StudioMode>('directory');

  const [departments, setDepartments] = useState<Department[]>([]);
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [unitFilter, setUnitFilter] = useState<string>('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Available Tenant Hospital Units from constants
  const availableUnits = useMemo(() => {
    return getTenantDefaultUnits(tenantOrg?.name, tenantOrg?.id);
  }, [tenantOrg]);

  // Drag and drop state
  const [draggedEmpId, setDraggedEmpId] = useState<string | null>(null);
  const [dropTargetColId, setDropTargetColId] = useState<string | null>(null);

  // Modals state
  const [createDeptModalOpen, setCreateDeptModalOpen] = useState(false);
  const [savingDept, setSavingDept] = useState(false);
  const [editDept, setEditDept] = useState<Department | null>(null);
  const [deleteDept, setDeleteDept] = useState<Department | null>(null);

  const [assignManagerModalOpen, setAssignManagerModalOpen] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);
  const [selectedMgrId, setSelectedMgrId] = useState<string | null>(null);
  const [savingReporting, setSavingReporting] = useState(false);
  const [reportingError, setReportingError] = useState('');

  const [quickMoveModalEmp, setQuickMoveModalEmp] = useState<Employee | null>(null);
  const [formError, setFormError] = useState('');
  const [deptName, setDeptName] = useState('');
  const [deptDesc, setDeptDesc] = useState('');
  const [deptManagerId, setDeptManagerId] = useState<string | null>(null);

  // Collapsed branches in Org Chart
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    try {
      const orgId = tenantOrg?.id || profile?.organization_id || '00000000-0000-0000-0000-000000000001';
      const [deptData, wpData, empData, profData] = await Promise.all([
        getDepartmentsWithStats(orgId),
        getWorkplaces(orgId),
        getOrgHierarchy(orgId),
        getOrgUsers(orgId),
      ]);
      setDepartments(deptData);
      setWorkplaces(wpData);
      setEmployees(empData);
      setProfiles(profData);
    } catch (err) {
      console.error('Error loading organization studio:', err);
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

  // ── Drag & Drop Handlers ──────────────────────────────────────────────────
  const handleDragStart = (e: any, empId: string) => {
    if (e && e.dataTransfer) {
      e.dataTransfer.setData('text/plain', empId);
      e.dataTransfer.effectAllowed = 'move';
    }
    setDraggedEmpId(empId);
  };

  const handleDragOver = (e: any, columnId: string) => {
    if (Platform.OS === 'web' && e) {
      if (e.preventDefault) e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      if (dropTargetColId !== columnId) {
        setDropTargetColId(columnId);
      }
    }
  };

  const handleDragLeave = (e: any) => {
    if (Platform.OS === 'web' && e && e.preventDefault) e.preventDefault();
    setDropTargetColId(null);
  };

  const handleDrop = async (e: any, targetColId: string) => {
    if (Platform.OS === 'web' && e) {
      if (e.preventDefault) e.preventDefault();
      if (e.stopPropagation) e.stopPropagation();
    }
    const empId = (e?.dataTransfer ? e.dataTransfer.getData('text/plain') : null) || draggedEmpId;
    if (!empId) return;

    const emp = employees.find((x) => x.id === empId);
    if (!emp) return;

    setActionLoadingId(empId);
    try {
      if (activeMode === 'departments' || activeMode === 'directory') {
        const targetDeptId = targetColId === 'unassigned' ? null : targetColId;
        if (emp.department_id !== targetDeptId) {
          await updateEmployee(emp.id, { department_id: targetDeptId });
          await createAuditLog('employee_department_reassigned', 'employee', emp.id, {
            department_id: targetDeptId,
            reassigned_by: profile?.id,
          });
        }
      } else if (activeMode === 'workplaces') {
        const targetWpId = targetColId === 'unassigned' ? null : targetColId;
        if (emp.workplace_id !== targetWpId) {
          await updateEmployee(emp.id, { workplace_id: targetWpId });
          await createAuditLog('employee_workplace_reassigned', 'employee', emp.id, {
            workplace_id: targetWpId,
            reassigned_by: profile?.id,
          });
        }
      } else if (activeMode === 'roles') {
        const targetRole = targetColId as 'admin' | 'hr' | 'employee';
        if (emp.profile?.id && emp.profile.role !== targetRole) {
          await updateUserRole(emp.profile.id, targetRole);
          await createAuditLog('user_role_drag_reassigned', 'profile', emp.profile.id, {
            new_role: targetRole,
            reassigned_by: profile?.id,
          });
        }
      }
      await load();
    } catch (err) {
      console.error('Drag and drop error:', err);
    } finally {
      setDraggedEmpId(null);
      setDropTargetColId(null);
      setActionLoadingId(null);
    }
  };

  // ── Quick Move (Mobile fallback) ──────────────────────────────────────────
  const handleQuickMove = async (targetId: string) => {
    if (!quickMoveModalEmp) return;
    setActionLoadingId(quickMoveModalEmp.id);
    try {
      if (activeMode === 'departments' || activeMode === 'directory') {
        const deptId = targetId === 'unassigned' ? null : targetId;
        await updateEmployee(quickMoveModalEmp.id, { department_id: deptId });
      } else if (activeMode === 'workplaces') {
        const wpId = targetId === 'unassigned' ? null : targetId;
        await updateEmployee(quickMoveModalEmp.id, { workplace_id: wpId });
      } else if (activeMode === 'roles') {
        if (quickMoveModalEmp.profile?.id) {
          await updateUserRole(quickMoveModalEmp.profile.id, targetId);
        }
      }
      setQuickMoveModalEmp(null);
      await load();
    } catch (err) {
      console.error('Quick move error:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // ── Dept CRUD Handlers ────────────────────────────────────────────────────
  const openCreateModal = () => {
    setDeptName('');
    setDeptDesc('');
    setDeptManagerId(null);
    setFormError('');
    setCreateDeptModalOpen(true);
  };

  const handleCreateDept = async () => {
    if (!deptName.trim()) {
      setFormError('Department name is required');
      return;
    }
    setSavingDept(true);
    setFormError('');
    try {
      const orgId = tenantOrg?.id || profile?.organization_id || '';
      const newDept = await createDepartment({
        organization_id: orgId,
        name: deptName.trim(),
        description: deptDesc.trim() || undefined,
        manager_id: deptManagerId,
      });

      await createAuditLog('department_created', 'department', newDept.id, {
        name: deptName.trim(),
        created_by: profile?.id,
      });

      setCreateDeptModalOpen(false);
      await load();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create department');
    } finally {
      setSavingDept(false);
    }
  };

  const openEditModal = (d: Department) => {
    setEditDept(d);
    setDeptName(d.name);
    setDeptDesc(d.description || '');
    setDeptManagerId(d.manager_id || null);
    setFormError('');
  };

  const handleSaveEditDept = async () => {
    if (!editDept) return;
    if (!deptName.trim()) {
      setFormError('Department name is required');
      return;
    }
    setSavingDept(true);
    setFormError('');
    try {
      await updateDepartment(editDept.id, {
        name: deptName.trim(),
        description: deptDesc.trim() || null,
        manager_id: deptManagerId,
      });

      await createAuditLog('department_updated', 'department', editDept.id, {
        name: deptName.trim(),
        updated_by: profile?.id,
      });

      setEditDept(null);
      await load();
    } catch (err: any) {
      setFormError(err.message || 'Failed to update department');
    } finally {
      setSavingDept(false);
    }
  };

  const handleDeleteDept = async () => {
    if (!deleteDept) return;
    setSavingDept(true);
    try {
      await deleteDepartment(deleteDept.id);
      await createAuditLog('department_deleted', 'department', deleteDept.id, {
        name: deleteDept.name,
        deleted_by: profile?.id,
      });
      setDeleteDept(null);
      await load();
    } catch (err) {
      console.error('Delete department error:', err);
    } finally {
      setSavingDept(false);
    }
  };

  // Helper to find all descendant IDs of an employee (to prevent cycles)
  const getDescendantIds = useCallback((empId: string): Set<string> => {
    const descendants = new Set<string>();
    const queue = [empId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const emp = employees.find((x) => x.id === currentId || x.profile_id === currentId);
      if (emp && emp.direct_reports) {
        for (const child of emp.direct_reports) {
          descendants.add(child.id);
          if (child.profile_id) descendants.add(child.profile_id);
          queue.push(child.id);
        }
      }
    }
    return descendants;
  }, [employees]);

  const handleSaveReportingManager = async () => {
    if (!selectedEmpId) {
      setReportingError('Please select an employee');
      return;
    }
    if (selectedEmpId === selectedMgrId) {
      setReportingError('An employee cannot report to themselves');
      return;
    }
    if (selectedMgrId && getDescendantIds(selectedEmpId).has(selectedMgrId)) {
      setReportingError('Circular hierarchy not allowed: The selected supervisor already reports to this employee');
      return;
    }

    setSavingReporting(true);
    setReportingError('');
    try {
      const resolvedMgrId = selectedMgrId && selectedMgrId.trim() !== '' && selectedMgrId !== 'none' ? selectedMgrId : null;
      await updateReportingManager(selectedEmpId, resolvedMgrId);
      await createAuditLog('reporting_manager_updated', 'employee', selectedEmpId, {
        manager_id: resolvedMgrId,
        updated_by: profile?.id,
      });

      if (resolvedMgrId) {
        setCollapsedNodes((prev) => ({ ...prev, [resolvedMgrId]: false }));
      }

      setAssignManagerModalOpen(false);
      await load();
    } catch (err: any) {
      setReportingError(err.message || 'Failed to update reporting manager');
    } finally {
      setSavingReporting(false);
    }
  };

  const toggleNode = (nodeId: string) => {
    setCollapsedNodes((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const expandAllNodes = () => {
    const newCollapsed: Record<string, boolean> = {};
    for (const emp of employees) {
      newCollapsed[emp.id] = false;
    }
    setCollapsedNodes(newCollapsed);
  };

  const collapseAllNodes = () => {
    const newCollapsed: Record<string, boolean> = {};
    for (const emp of employees) {
      newCollapsed[emp.id] = true;
    }
    setCollapsedNodes(newCollapsed);
  };

  // Filtered employees for search and unit
  const filteredEmployees = useMemo(() => {
    let list = employees;

    if (unitFilter !== 'all') {
      list = list.filter((e) => {
        const empUnit = normalizeHospitalUnit(e.hospital_unit || e.workplace?.name);
        return empUnit.toLowerCase() === unitFilter.toLowerCase();
      });
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.profile?.full_name?.toLowerCase().includes(q) ||
          e.designation?.toLowerCase().includes(q) ||
          e.employee_code?.toLowerCase().includes(q) ||
          e.department?.name?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [employees, search, unitFilter]);

  // Filtered departments for directory and kanban
  const filteredDepartments = useMemo(() => {
    let list = departments;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          (d.description && d.description.toLowerCase().includes(q)) ||
          (d.manager?.profile?.full_name && d.manager.profile.full_name.toLowerCase().includes(q))
      );
    }

    return list;
  }, [departments, search]);

  // Root employees and unassigned employees for Org Chart
  const { rootEmployees, unassignedEmployees } = useMemo(() => {
    const validEmpIds = new Set(employees.map((e) => e.id));
    const roots: Employee[] = [];
    const unassigned: Employee[] = [];

    for (const emp of employees) {
      const hasValidManager =
        emp.manager_id &&
        emp.manager_id.trim() !== '' &&
        emp.manager_id !== 'none' &&
        emp.manager_id !== 'null' &&
        validEmpIds.has(emp.manager_id) &&
        emp.manager_id !== emp.id;

      if (!hasValidManager) {
        if (emp.direct_reports && emp.direct_reports.length > 0) {
          roots.push(emp);
        } else {
          unassigned.push(emp);
        }
      }
    }

    if (roots.length === 0 && employees.length > 0) {
      const sorted = [...employees].sort(
        (a, b) => (b.direct_reports?.length || 0) - (a.direct_reports?.length || 0)
      );
      roots.push(...sorted.slice(0, Math.min(3, sorted.length)));
    }

    return { rootEmployees: roots, unassignedEmployees: unassigned };
  }, [employees]);

  const searchedRoots = useMemo(() => {
    if (!search.trim()) return rootEmployees;
    const q = search.toLowerCase();
    const hasMatch = (emp: Employee): boolean => {
      if (
        emp.profile?.full_name?.toLowerCase().includes(q) ||
        emp.designation?.toLowerCase().includes(q) ||
        emp.employee_code?.toLowerCase().includes(q) ||
        emp.department?.name?.toLowerCase().includes(q)
      ) {
        return true;
      }
      return !!emp.direct_reports?.some(hasMatch);
    };
    return rootEmployees.filter(hasMatch);
  }, [rootEmployees, search]);

  const searchedUnassigned = useMemo(() => {
    if (!search.trim()) return unassignedEmployees;
    const q = search.toLowerCase();
    return unassignedEmployees.filter(
      (e) =>
        e.profile?.full_name?.toLowerCase().includes(q) ||
        e.designation?.toLowerCase().includes(q) ||
        e.employee_code?.toLowerCase().includes(q) ||
        e.department?.name?.toLowerCase().includes(q)
    );
  }, [unassignedEmployees, search]);

  const employeeOptions = useMemo(() => {
    return employees.map((e) => ({
      label: `${e.profile?.full_name || 'Staff'} (${e.designation || 'Employee'} · ${e.department?.name || 'General'})`,
      value: e.id,
    }));
  }, [employees]);

  const managerOptions = useMemo(() => {
    const forbiddenIds = selectedEmpId ? getDescendantIds(selectedEmpId) : new Set<string>();
    if (selectedEmpId) {
      forbiddenIds.add(selectedEmpId);
    }

    return [
      { label: 'None (Top Level / Direct to Exec)', value: '' },
      ...employees
        .filter((e) => !forbiddenIds.has(e.id))
        .map((e) => ({
          label: `${e.profile?.full_name || 'Staff'} (${e.designation || 'Manager'} · ${e.department?.name || 'General'})`,
          value: e.id,
        })),
    ];
  }, [employees, selectedEmpId, getDescendantIds]);

  // Metric stats
  const assignedStaffCount = useMemo(() => employees.filter((e) => !!e.department_id).length, [employees]);
  const unassignedStaffCount = useMemo(() => employees.filter((e) => !e.department_id).length, [employees]);
  const hodCount = useMemo(() => departments.filter((d) => !!d.manager_id).length, [departments]);

  if (loading) return <LoadingState />;

  return (
    <SidebarLayout items={navItems}>
      <ScrollView
        style={[styles.container, { backgroundColor: '#FAF9FD' }]}
        contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Breadcrumbs & Header ─────────────────────────────────────────── */}
        <View style={styles.breadcrumbRow}>
          <TouchableOpacity
            onPress={() => router.push(role === 'admin' ? '/(admin)/dashboard' : '/(hr)/dashboard' as never)}
            style={styles.breadcrumbLink}
          >
            <Text style={styles.breadcrumbText}>Dashboard</Text>
          </TouchableOpacity>
          <ChevronRight size={13} color="#94A3B8" />
          <Text style={[styles.breadcrumbText, { color: '#7C3AED', fontWeight: '700' }]}>
            Departments & Hierarchy
          </Text>
        </View>

        {/* ─── Modern SaaS Header Row with Illustration ────────────────────── */}
        <Animated.View entering={FadeInDown.duration(320)} style={styles.headerRow}>
          <View style={{ flex: 1, minWidth: 280 }}>
            <View style={styles.headerBadge}>
              <Sparkles size={12} color="#7C3AED" />
              <Text style={styles.headerBadgeText}>Organizational Architecture</Text>
            </View>
            <Text style={styles.headerTitle}>Departments & Hierarchy Studio</Text>
            <Text style={styles.headerSubtitle}>
              Configure departmental headcount, appointed HOD leads, and reporting chains for{' '}
              <Text style={{ fontWeight: '700', color: '#1E293B' }}>{tenantOrg?.name || 'Organization Workspace'}</Text>.
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            {isDesktop && (
              <View style={{ opacity: 0.95 }}>
                <SvgXml xml={STOCK_4_SVG} width={130} height={92} />
              </View>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <TouchableOpacity
                style={styles.headerPrimaryBtn}
                onPress={openCreateModal}
                activeOpacity={0.85}
              >
                <Plus size={16} color="#FFF" />
                <Text style={styles.headerPrimaryBtnText}>New Department</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.headerSecondaryBtn}
                onPress={() => {
                  setReportingError('');
                  setSelectedEmpId(null);
                  setSelectedMgrId(null);
                  setAssignManagerModalOpen(true);
                }}
                activeOpacity={0.85}
              >
                <GitFork size={15} color="#7C3AED" />
                <Text style={styles.headerSecondaryBtnText}>Reporting Line</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>

        {/* ─── Metric Stat Cards Row with Wave Lines ────────────────────────── */}
        {/* Pastel KPI Metric Cards */}
        <Animated.View entering={FadeInDown.delay(70).duration(280)} style={{ marginBottom: 16 }}>
          {isDesktop ? (
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {/* Card 1: Total Departments */}
              <InteractiveTile
                style={[
                  styles.metricCard,
                  {
                    backgroundColor: '#F3EEFE',
                    borderColor: '#E4DCFD',
                    flex: 1,
                  },
                ]}
                onPress={() => setActiveMode('directory')}
              >
                <View style={styles.metricCardHeader}>
                  <Text style={styles.metricValueText}>{departments.length}</Text>
                  <View style={[styles.metricIconBox, { backgroundColor: '#EDE9FE' }]}>
                    <Building2 size={16} color="#7C3AED" />
                  </View>
                </View>
                <Text style={styles.metricLabelText}>Total Departments</Text>
                <View style={styles.waveContainer}>
                  <MetricWave color="#8B5CF6" width={150} height={24} />
                </View>
              </InteractiveTile>

              {/* Card 2: Assigned Staff */}
              <InteractiveTile
                style={[
                  styles.metricCard,
                  {
                    backgroundColor: '#EDFAF2',
                    borderColor: '#CEF2DE',
                    flex: 1,
                  },
                ]}
                onPress={() => setActiveMode('departments')}
              >
                <View style={styles.metricCardHeader}>
                  <Text style={styles.metricValueText}>{assignedStaffCount}</Text>
                  <View style={[styles.metricIconBox, { backgroundColor: '#DCFCE7' }]}>
                    <Users size={16} color="#10B981" />
                  </View>
                </View>
                <Text style={styles.metricLabelText}>Assigned Staff</Text>
                <View style={styles.waveContainer}>
                  <MetricWave color="#10B981" width={150} height={24} />
                </View>
              </InteractiveTile>

              {/* Card 3: Appointed HODs */}
              <InteractiveTile
                style={[
                  styles.metricCard,
                  {
                    backgroundColor: '#FFF4EB',
                    borderColor: '#FFE2CD',
                    flex: 1,
                  },
                ]}
                onPress={() => setActiveMode('org-chart')}
              >
                <View style={styles.metricCardHeader}>
                  <Text style={styles.metricValueText}>{hodCount}</Text>
                  <View style={[styles.metricIconBox, { backgroundColor: '#FFEDD5' }]}>
                    <Award size={16} color="#F97316" />
                  </View>
                </View>
                <Text style={styles.metricLabelText}>Appointed HODs</Text>
                <View style={styles.waveContainer}>
                  <MetricWave color="#F97316" width={150} height={24} />
                </View>
              </InteractiveTile>

              {/* Card 4: Unassigned Staff */}
              <InteractiveTile
                style={[
                  styles.metricCard,
                  {
                    backgroundColor: '#EFF6FF',
                    borderColor: '#DBEAFE',
                    flex: 1,
                  },
                ]}
                onPress={() => setActiveMode('departments')}
              >
                <View style={styles.metricCardHeader}>
                  <Text style={styles.metricValueText}>{unassignedStaffCount}</Text>
                  <View style={[styles.metricIconBox, { backgroundColor: '#DBEAFE' }]}>
                    <AlertCircle size={16} color="#3B82F6" />
                  </View>
                </View>
                <Text style={styles.metricLabelText}>Unassigned Staff</Text>
                <View style={styles.waveContainer}>
                  <MetricWave color="#3B82F6" width={150} height={24} />
                </View>
              </InteractiveTile>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {/* Card 1: Total Departments */}
                <InteractiveTile
                  style={[
                    styles.metricCard,
                    {
                      backgroundColor: '#F3EEFE',
                      borderColor: '#E4DCFD',
                      flex: 1,
                    },
                  ]}
                  onPress={() => setActiveMode('directory')}
                >
                  <View style={styles.metricCardHeader}>
                    <Text style={styles.metricValueText}>{departments.length}</Text>
                    <View style={[styles.metricIconBox, { backgroundColor: '#EDE9FE' }]}>
                      <Building2 size={16} color="#7C3AED" />
                    </View>
                  </View>
                  <Text style={styles.metricLabelText}>Departments</Text>
                  <View style={styles.waveContainer}>
                    <MetricWave color="#8B5CF6" width={80} height={24} />
                  </View>
                </InteractiveTile>

                {/* Card 2: Assigned Staff */}
                <InteractiveTile
                  style={[
                    styles.metricCard,
                    {
                      backgroundColor: '#EDFAF2',
                      borderColor: '#CEF2DE',
                      flex: 1,
                    },
                  ]}
                  onPress={() => setActiveMode('departments')}
                >
                  <View style={styles.metricCardHeader}>
                    <Text style={styles.metricValueText}>{assignedStaffCount}</Text>
                    <View style={[styles.metricIconBox, { backgroundColor: '#DCFCE7' }]}>
                      <Users size={16} color="#10B981" />
                    </View>
                  </View>
                  <Text style={styles.metricLabelText}>Assigned</Text>
                  <View style={styles.waveContainer}>
                    <MetricWave color="#10B981" width={80} height={24} />
                  </View>
                </InteractiveTile>
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                {/* Card 3: Appointed HODs */}
                <InteractiveTile
                  style={[
                    styles.metricCard,
                    {
                      backgroundColor: '#FFF4EB',
                      borderColor: '#FFE2CD',
                      flex: 1,
                    },
                  ]}
                  onPress={() => setActiveMode('org-chart')}
                >
                  <View style={styles.metricCardHeader}>
                    <Text style={styles.metricValueText}>{hodCount}</Text>
                    <View style={[styles.metricIconBox, { backgroundColor: '#FFEDD5' }]}>
                      <Award size={16} color="#F97316" />
                    </View>
                  </View>
                  <Text style={styles.metricLabelText}>HODs</Text>
                  <View style={styles.waveContainer}>
                    <MetricWave color="#F97316" width={80} height={24} />
                  </View>
                </InteractiveTile>

                {/* Card 4: Unassigned Staff */}
                <InteractiveTile
                  style={[
                    styles.metricCard,
                    {
                      backgroundColor: '#EFF6FF',
                      borderColor: '#DBEAFE',
                      flex: 1,
                    },
                  ]}
                  onPress={() => setActiveMode('departments')}
                >
                  <View style={styles.metricCardHeader}>
                    <Text style={styles.metricValueText}>{unassignedStaffCount}</Text>
                    <View style={[styles.metricIconBox, { backgroundColor: '#DBEAFE' }]}>
                      <AlertCircle size={16} color="#3B82F6" />
                    </View>
                  </View>
                  <Text style={styles.metricLabelText}>Unassigned</Text>
                  <View style={styles.waveContainer}>
                    <MetricWave color="#3B82F6" width={80} height={24} />
                  </View>
                </InteractiveTile>
              </View>
            </View>
          )}
        </Animated.View>

        {/* ─── Search & Studio Mode Filters Bar ─────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(120).duration(280)} style={styles.filtersContainer}>
          {/* Top Search & Unit Filters Row */}
          <View style={styles.searchAndUnitRow}>
            {/* Search Input */}
            <View style={styles.searchBox}>
              <Search size={17} color="#64748B" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search departments, specialities, leads, or staff..."
                placeholderTextColor="#94A3B8"
                value={search}
                onChangeText={setSearch}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')} style={{ padding: 4 }}>
                  <X size={15} color="#64748B" />
                </TouchableOpacity>
              )}
            </View>

            {/* Hospital Unit Selector Pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.unitScroll}
            >
              <TouchableOpacity
                style={[styles.unitPill, unitFilter === 'all' && styles.unitPillActive]}
                onPress={() => setUnitFilter('all')}
                activeOpacity={0.7}
              >
                <Text style={[styles.unitPillText, unitFilter === 'all' && styles.unitPillTextActive]}>
                  All Workplaces
                </Text>
              </TouchableOpacity>
              {availableUnits.map((u) => {
                const isSelected = unitFilter.toLowerCase() === u.toLowerCase();
                return (
                  <TouchableOpacity
                    key={u}
                    style={[styles.unitPill, isSelected && styles.unitPillActive]}
                    onPress={() => setUnitFilter(isSelected ? 'all' : u)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.unitPillText, isSelected && styles.unitPillTextActive]}>
                      {u}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Mode Selector Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.modeTabsScroll}
          >
            <TouchableOpacity
              onPress={() => setActiveMode('directory')}
              style={[styles.modeTab, activeMode === 'directory' && styles.modeTabActive]}
              activeOpacity={0.7}
            >
              <Building2 size={15} color={activeMode === 'directory' ? '#FFFFFF' : '#64748B'} />
              <Text style={[styles.modeTabText, activeMode === 'directory' && styles.modeTabTextActive]}>
                Department Directory ({departments.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveMode('departments')}
              style={[styles.modeTab, activeMode === 'departments' && styles.modeTabActive]}
              activeOpacity={0.7}
            >
              <Layers size={15} color={activeMode === 'departments' ? '#FFFFFF' : '#64748B'} />
              <Text style={[styles.modeTabText, activeMode === 'departments' && styles.modeTabTextActive]}>
                Visual Kanban
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveMode('org-chart')}
              style={[styles.modeTab, activeMode === 'org-chart' && styles.modeTabActive]}
              activeOpacity={0.7}
            >
              <Network size={15} color={activeMode === 'org-chart' ? '#FFFFFF' : '#64748B'} />
              <Text style={[styles.modeTabText, activeMode === 'org-chart' && styles.modeTabTextActive]}>
                Hierarchy Org Tree
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveMode('workplaces')}
              style={[styles.modeTab, activeMode === 'workplaces' && styles.modeTabActive]}
              activeOpacity={0.7}
            >
              <MapPin size={15} color={activeMode === 'workplaces' ? '#FFFFFF' : '#64748B'} />
              <Text style={[styles.modeTabText, activeMode === 'workplaces' && styles.modeTabTextActive]}>
                Office Locations & Geofence
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveMode('roles')}
              style={[styles.modeTab, activeMode === 'roles' && styles.modeTabActive]}
              activeOpacity={0.7}
            >
              <ShieldCheck size={15} color={activeMode === 'roles' ? '#FFFFFF' : '#64748B'} />
              <Text style={[styles.modeTabText, activeMode === 'roles' && styles.modeTabTextActive]}>
                Role Groups
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>

        {/* ─── MODE 1: MODERN DEPARTMENT CARDS DIRECTORY ────────────────────── */}
        {activeMode === 'directory' && (
          <Animated.View entering={FadeInDown.delay(160).duration(300)}>
            {filteredDepartments.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Building2 size={26} color="#94A3B8" />
                </View>
                <Text style={styles.emptyTitle}>No matching departments found</Text>
                <Text style={styles.emptySubtitle}>
                  {search ? 'Try clearing your search query' : 'Create your first department or business division to get started.'}
                </Text>
                <TouchableOpacity style={styles.emptyAddBtn} onPress={openCreateModal}>
                  <Text style={styles.emptyAddBtnText}>+ Create New Department</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[styles.deptGrid, isDesktop && styles.deptGridDesktop]}>
                {filteredDepartments.map((dept, idx) => {
                  const palette = DEPT_COLOR_PALETTES[idx % DEPT_COLOR_PALETTES.length];
                  const deptEmps = employees.filter((e) => e.department_id === dept.id);
                  const previewEmps = deptEmps.slice(0, 4);
                  const moreCount = Math.max(0, deptEmps.length - 4);
                  const managerEmp = dept.manager || employees.find((e) => e.id === dept.manager_id);
                  const managerName = managerEmp?.profile?.full_name;

                  return (
                    <InteractiveTile
                      key={dept.id}
                      style={[
                        styles.deptCard,
                        isDesktop && styles.deptCardDesktop,
                        isTablet && styles.deptCardTablet,
                      ]}
                      onPress={() => openEditModal(dept)}
                    >
                      {/* Card Top Row */}
                      <View style={styles.deptCardTopRow}>
                        <View style={[styles.deptIconBox, { backgroundColor: palette.bg }]}>
                          <Building2 size={22} color={palette.color} />
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={[styles.deptCountPill, { backgroundColor: palette.bg }]}>
                            <Users size={11} color={palette.color} />
                            <Text style={[styles.deptCountPillText, { color: palette.color }]}>
                              {deptEmps.length} Staff
                            </Text>
                          </View>

                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation?.();
                              openEditModal(dept);
                            }}
                            style={styles.cardActionIconBtn}
                            activeOpacity={0.7}
                          >
                            <Edit2 size={14} color="#64748B" />
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation?.();
                              setDeleteDept(dept);
                            }}
                            style={styles.cardActionIconBtn}
                            activeOpacity={0.7}
                          >
                            <Trash2 size={14} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Department Title & Description */}
                      <View style={{ marginTop: 12, flex: 1 }}>
                        <Text style={styles.deptCardTitle} numberOfLines={1}>
                          {dept.name}
                        </Text>
                        <Text style={styles.deptCardDesc} numberOfLines={2}>
                          {dept.description || 'Operational department and business division.'}
                        </Text>
                      </View>

                      {/* HOD / Leadership Mini Box */}
                      <View style={styles.hodMiniCard}>
                        {managerName ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                            <Avatar
                              name={managerName}
                              url={managerEmp?.profile?.avatar_url}
                              size={32}
                            />
                            <View style={{ flex: 1 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                <Text style={styles.hodNameText} numberOfLines={1}>{managerName}</Text>
                                <View style={styles.hodBadgeDot} />
                              </View>
                              <Text style={styles.hodSubText} numberOfLines={1}>
                                {managerEmp?.designation || 'Head of Department (HOD)'}
                              </Text>
                            </View>
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={styles.unassignedHodRow}
                            onPress={(e) => {
                              e.stopPropagation?.();
                              openEditModal(dept);
                            }}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <AlertCircle size={14} color="#D97706" />
                              <Text style={styles.unassignedHodText}>No HOD Appointed</Text>
                            </View>
                            <Text style={styles.unassignedHodAction}>+ Assign</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Staff Avatars Stack & Action Bar */}
                      <View style={styles.deptCardFooter}>
                        <View style={styles.avatarStack}>
                          {previewEmps.map((emp, i) => (
                            <View
                              key={emp.id}
                              style={[
                                styles.avatarStackItem,
                                { marginLeft: i > 0 ? -8 : 0, zIndex: 10 - i },
                              ]}
                            >
                              <Avatar
                                name={emp.profile?.full_name || 'Staff'}
                                url={emp.profile?.avatar_url}
                                size={26}
                              />
                            </View>
                          ))}
                          {moreCount > 0 && (
                            <View style={[styles.avatarStackMore, { marginLeft: -8, zIndex: 5 }]}>
                              <Text style={styles.avatarStackMoreText}>+{moreCount}</Text>
                            </View>
                          )}
                          {deptEmps.length === 0 && (
                            <Text style={{ fontSize: 11, color: '#94A3B8' }}>No members yet</Text>
                          )}
                        </View>

                        <TouchableOpacity
                          style={styles.manageStaffBtn}
                          onPress={(e) => {
                            e.stopPropagation?.();
                            setActiveMode('departments');
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.manageStaffBtnText}>Reassign</Text>
                          <ArrowRight size={12} color="#7C3AED" />
                        </TouchableOpacity>
                      </View>
                    </InteractiveTile>
                  );
                })}
              </View>
            )}
          </Animated.View>
        )}

        {/* ─── MODE 2: VISUAL KANBAN DRAG & DROP ────────────────────────────── */}
        {activeMode === 'departments' && (
          <View style={styles.kanbanBoardWrap}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.boardColumns}>
              {/* Unassigned Department Column */}
              <KanbanColumn
                id="unassigned"
                title="Unassigned Department"
                count={filteredEmployees.filter((e) => !e.department_id).length}
                color="#64748B"
                bg="#F8FAFC"
                employees={filteredEmployees.filter((e) => !e.department_id)}
                isDropTarget={dropTargetColId === 'unassigned'}
                onDragStart={handleDragStart}
                onDragOver={(e) => handleDragOver(e, 'unassigned')}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, 'unassigned')}
                onQuickMove={setQuickMoveModalEmp}
                actionLoadingId={actionLoadingId}
                colors={colors}
              />

              {/* Each Department Column */}
              {departments.map((dept, idx) => {
                const palette = DEPT_COLOR_PALETTES[idx % DEPT_COLOR_PALETTES.length];
                const colEmps = filteredEmployees.filter((e) => e.department_id === dept.id);
                const managerEmp = dept.manager || employees.find((e) => e.id === dept.manager_id);
                return (
                  <KanbanColumn
                    key={dept.id}
                    id={dept.id}
                    title={dept.name}
                    sub={managerEmp?.profile?.full_name ? `Lead: ${managerEmp.profile.full_name}` : undefined}
                    count={colEmps.length}
                    color={palette.color}
                    bg={palette.bg}
                    employees={colEmps}
                    isDropTarget={dropTargetColId === dept.id}
                    onDragStart={handleDragStart}
                    onDragOver={(e) => handleDragOver(e, dept.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, dept.id)}
                    onQuickMove={setQuickMoveModalEmp}
                    onEditDept={() => openEditModal(dept)}
                    actionLoadingId={actionLoadingId}
                    colors={colors}
                  />
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ─── MODE 3: WORKPLACE / OFFICE GROUPING KANBAN ───────────────────── */}
        {activeMode === 'workplaces' && (
          <View style={styles.kanbanBoardWrap}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.boardColumns}>
              {/* Remote / Unassigned Column */}
              <KanbanColumn
                id="unassigned"
                title="Remote / Unassigned"
                sub="No geofenced office"
                count={filteredEmployees.filter((e) => !e.workplace_id).length}
                color="#64748B"
                bg="#F8FAFC"
                employees={filteredEmployees.filter((e) => !e.workplace_id)}
                isDropTarget={dropTargetColId === 'unassigned'}
                onDragStart={handleDragStart}
                onDragOver={(e) => handleDragOver(e, 'unassigned')}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, 'unassigned')}
                onQuickMove={setQuickMoveModalEmp}
                actionLoadingId={actionLoadingId}
                colors={colors}
              />

              {/* Office Location Columns */}
              {workplaces.map((wp) => {
                const colEmps = filteredEmployees.filter((e) => e.workplace_id === wp.id);
                return (
                  <KanbanColumn
                    key={wp.id}
                    id={wp.id}
                    title={wp.name}
                    sub={`${wp.radius_meters}m geofence radius`}
                    count={colEmps.length}
                    color="#0369A1"
                    bg="#E0F2FE"
                    employees={colEmps}
                    isDropTarget={dropTargetColId === wp.id}
                    onDragStart={handleDragStart}
                    onDragOver={(e) => handleDragOver(e, wp.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, wp.id)}
                    onQuickMove={setQuickMoveModalEmp}
                    actionLoadingId={actionLoadingId}
                    colors={colors}
                  />
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ─── MODE 4: ROLE & PERMISSION GROUPING KANBAN ────────────────────── */}
        {activeMode === 'roles' && (
          <View style={styles.kanbanBoardWrap}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.boardColumns}>
              {/* Administrators */}
              <KanbanColumn
                id="admin"
                title="Administrators"
                sub="Full org & settings access"
                count={filteredEmployees.filter((e) => e.profile?.role === 'admin').length}
                color="#7C3AED"
                bg="#EDE9FE"
                employees={filteredEmployees.filter((e) => e.profile?.role === 'admin')}
                isDropTarget={dropTargetColId === 'admin'}
                onDragStart={handleDragStart}
                onDragOver={(e) => handleDragOver(e, 'admin')}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, 'admin')}
                onQuickMove={setQuickMoveModalEmp}
                actionLoadingId={actionLoadingId}
                colors={colors}
              />

              {/* HR Managers */}
              <KanbanColumn
                id="hr"
                title="HR Managers"
                sub="Attendance, leave & payroll"
                count={filteredEmployees.filter((e) => e.profile?.role === 'hr').length}
                color="#D97706"
                bg="#FEF3C7"
                employees={filteredEmployees.filter((e) => e.profile?.role === 'hr')}
                isDropTarget={dropTargetColId === 'hr'}
                onDragStart={handleDragStart}
                onDragOver={(e) => handleDragOver(e, 'hr')}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, 'hr')}
                onQuickMove={setQuickMoveModalEmp}
                actionLoadingId={actionLoadingId}
                colors={colors}
              />

              {/* Standard Employees */}
              <KanbanColumn
                id="employee"
                title="Standard Staff & Team Members"
                sub="Self-service portal"
                count={filteredEmployees.filter((e) => e.profile?.role === 'employee').length}
                color="#0D9488"
                bg="#CCFBF1"
                employees={filteredEmployees.filter((e) => e.profile?.role === 'employee')}
                isDropTarget={dropTargetColId === 'employee'}
                onDragStart={handleDragStart}
                onDragOver={(e) => handleDragOver(e, 'employee')}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, 'employee')}
                onQuickMove={setQuickMoveModalEmp}
                actionLoadingId={actionLoadingId}
                colors={colors}
              />
            </ScrollView>
          </View>
        )}

        {/* ─── MODE 5: HIERARCHY ORG TREE ──────────────────────────────────── */}
        {activeMode === 'org-chart' && (
          <View style={styles.treeContainer}>
            <View style={styles.treeHead}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 260 }}>
                <View style={[styles.treeIconWrap, { backgroundColor: '#EDE9FE' }]}>
                  <Network size={20} color="#7C3AED" />
                </View>
                <View>
                  <Text style={styles.treeTitle}>Executive Chains of Command & Reporting Lines</Text>
                  <Text style={{ fontSize: 12, color: '#64748B' }}>
                    {searchedRoots.length} Leadership Root{searchedRoots.length !== 1 ? 's' : ''} · {employees.length} Total Staff · {unassignedEmployees.length} Standalone
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity
                  onPress={expandAllNodes}
                  style={styles.treeActionBtn}
                  activeOpacity={0.7}
                >
                  <Text style={styles.treeActionBtnText}>Expand All</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={collapseAllNodes}
                  style={styles.treeActionBtn}
                  activeOpacity={0.7}
                >
                  <Text style={styles.treeActionBtnText}>Collapse All</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedEmpId(null);
                    setSelectedMgrId(null);
                    setReportingError('');
                    setAssignManagerModalOpen(true);
                  }}
                  style={styles.treeActionPrimaryBtn}
                  activeOpacity={0.8}
                >
                  <GitFork size={13} color="#FFF" />
                  <Text style={styles.treeActionPrimaryBtnText}>Set Reporting Line</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.treeContent}>
              {searchedRoots.length > 0 ? (
                searchedRoots.map((rootEmp) => (
                  <TreeNode
                    key={rootEmp.id}
                    employee={rootEmp}
                    collapsedNodes={collapsedNodes}
                    onToggle={toggleNode}
                    onReassignManager={(emp) => {
                      setSelectedEmpId(emp.id);
                      setSelectedMgrId(emp.manager_id || null);
                      setReportingError('');
                      setAssignManagerModalOpen(true);
                    }}
                    colors={colors}
                    depth={0}
                  />
                ))
              ) : (
                <View style={{ padding: 24, alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A' }}>
                    {search ? 'No matching hierarchy nodes found' : 'No leadership hierarchy established yet'}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#64748B' }}>
                    {search ? 'Try clearing your search query' : 'Assign supervisors to staff members below to start structuring your organization chart.'}
                  </Text>
                </View>
              )}

              {/* Standalone / Unassigned Employees Section */}
              {searchedUnassigned.length > 0 && (
                <View style={{ marginTop: 24, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#E2E8F0' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <View>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Unassigned Staff Without Supervisor ({searchedUnassigned.length})
                      </Text>
                      <Text style={{ fontSize: 12, color: '#64748B' }}>
                        Staff currently without a direct reporting supervisor
                      </Text>
                    </View>
                  </View>

                  <View style={{ gap: 8 }}>
                    {searchedUnassigned.map((emp) => (
                      <View key={emp.id} style={styles.unassignedTreeCard}>
                        <Avatar name={emp.profile?.full_name || 'Staff Member'} url={emp.profile?.avatar_url} size={36} />
                        <View style={{ flex: 1, gap: 2 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <Text style={styles.unassignedEmpName}>
                              {emp.profile?.full_name || 'Staff Member'}
                            </Text>
                            <View style={styles.unassignedWarningBadge}>
                              <Text style={styles.unassignedWarningBadgeText}>NO SUPERVISOR</Text>
                            </View>
                            {emp.department?.name && (
                              <View style={styles.deptNeutralBadge}>
                                <Text style={styles.deptNeutralBadgeText}>{emp.department.name}</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.unassignedEmpSub}>
                            {emp.designation || 'Staff'} · {emp.employee_code || 'EMP'}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.assignSupervisorBtn}
                          onPress={() => {
                            setSelectedEmpId(emp.id);
                            setSelectedMgrId(emp.manager_id || null);
                            setReportingError('');
                            setAssignManagerModalOpen(true);
                          }}
                        >
                          <GitFork size={13} color="#7C3AED" />
                          <Text style={styles.assignSupervisorBtnText}>Assign Supervisor</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* ─── MODAL: Create Department ─────────────────────────────────────── */}
      <Modal
        visible={createDeptModalOpen}
        onClose={() => setCreateDeptModalOpen(false)}
        title="Create Department"
        subtitle="Register a new department or operational division"
        size="md"
        icon={<Building2 size={20} color="#7C3AED" />}
        iconBgColor="#EDE9FE"
        iconBorderColor="#DDD6FE"
        badge={{ text: 'Structure', variant: 'primary' }}
        primaryAction={{
          label: 'Create Department',
          onPress: handleCreateDept,
          loading: savingDept,
          variant: 'primary',
        }}
        secondaryAction={{
          label: 'Cancel',
          onPress: () => setCreateDeptModalOpen(false),
        }}
      >
        <View style={{ gap: 14 }}>
          {formError ? (
            <View style={styles.modalAlertBox}>
              <AlertCircle size={16} color="#DC2626" />
              <Text style={{ color: "#DC2626", fontSize: 13, flex: 1 }}>{formError}</Text>
            </View>
          ) : null}

          <Input
            label="Department Name *"
            placeholder="e.g. Engineering, Operations, Human Resources, Finance"
            value={deptName}
            onChangeText={setDeptName}
          />

          <Input
            label="Description & Scope"
            placeholder="Key operational responsibilities, deliverables, or mission..."
            value={deptDesc}
            onChangeText={setDeptDesc}
            multiline
          />

          <Select
            label="Head of Department (HOD) / Lead"
            placeholder="Select appointed supervisor or director..."
            options={[{ label: 'Unassigned (No HOD)', value: '' }, ...employeeOptions]}
            value={deptManagerId || ''}
            onValueChange={(v) => setDeptManagerId(v || null)}
          />
        </View>
      </Modal>

      {/* ─── MODAL: Edit Department ───────────────────────────────────────── */}
      <Modal
        visible={!!editDept}
        onClose={() => setEditDept(null)}
        title="Edit Department"
        subtitle={`Updating configuration for ${editDept?.name || 'Department'}`}
        size="md"
        icon={<Edit2 size={20} color="#7C3AED" />}
        iconBgColor="#EDE9FE"
        iconBorderColor="#DDD6FE"
        primaryAction={{
          label: 'Save Changes',
          onPress: handleSaveEditDept,
          loading: savingDept,
          variant: 'primary',
        }}
        secondaryAction={{
          label: 'Cancel',
          onPress: () => setEditDept(null),
        }}
      >
        <View style={{ gap: 14 }}>
          {formError ? (
            <View style={styles.modalAlertBox}>
              <AlertCircle size={16} color="#DC2626" />
              <Text style={{ color: "#DC2626", fontSize: 13, flex: 1 }}>{formError}</Text>
            </View>
          ) : null}

          <Input
            label="Department Name *"
            value={deptName}
            onChangeText={setDeptName}
            placeholder="Department Name"
          />

          <Input
            label="Description & Scope"
            value={deptDesc}
            onChangeText={setDeptDesc}
            placeholder="Key responsibilities & mission..."
            multiline
          />

          <Select
            label="Head of Department (HOD) / Lead"
            placeholder="Select department manager..."
            options={[{ label: 'Unassigned (No HOD)', value: '' }, ...employeeOptions]}
            value={deptManagerId || ''}
            onValueChange={(v) => setDeptManagerId(v || null)}
          />
        </View>
      </Modal>

      {/* ─── MODAL: Set Reporting Hierarchy ───────────────────────────────── */}
      <Modal
        visible={assignManagerModalOpen}
        onClose={() => setAssignManagerModalOpen(false)}
        title="Set Reporting Hierarchy"
        subtitle="Establish executive command and operational reporting lines"
        size="md"
        icon={<GitFork size={20} color="#7C3AED" />}
        iconBgColor="#EDE9FE"
        iconBorderColor="#DDD6FE"
        badge={{ text: 'Chain of Command', variant: 'primary' }}
        primaryAction={{
          label: 'Update Hierarchy',
          onPress: handleSaveReportingManager,
          loading: savingReporting,
          variant: 'primary',
        }}
        secondaryAction={{
          label: 'Cancel',
          onPress: () => setAssignManagerModalOpen(false),
        }}
      >
        <View style={{ gap: 14 }}>
          {reportingError ? (
            <View style={styles.modalAlertBox}>
              <AlertCircle size={16} color="#DC2626" />
              <Text style={{ color: "#DC2626", fontSize: 13, flex: 1 }}>{reportingError}</Text>
            </View>
          ) : null}

          {/* Selected Employee Summary Card */}
          {selectedEmpId && (() => {
            const currentEditingEmp = employees.find((e) => e.id === selectedEmpId);
            const currentSupervisor = employees.find((e) => e.id === currentEditingEmp?.manager_id);
            if (!currentEditingEmp) return null;
            return (
              <View style={styles.reportingSummaryBox}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Avatar name={currentEditingEmp.profile?.full_name || 'Staff'} url={currentEditingEmp.profile?.avatar_url} size={34} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', fontSize: 13, color: '#0F172A' }}>
                      {currentEditingEmp.profile?.full_name || 'Staff Member'}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#64748B' }}>
                      {currentEditingEmp.designation || 'Staff'} · {currentEditingEmp.department?.name || 'Department'}
                    </Text>
                  </View>
                </View>
                <View style={styles.reportingSummaryDivider}>
                  <Text style={{ fontSize: 11, color: '#64748B' }}>Current Direct Supervisor:</Text>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: currentSupervisor ? '#7C3AED' : '#D97706' }}>
                    {currentSupervisor?.profile?.full_name ? `${currentSupervisor.profile.full_name} (${currentSupervisor.designation || 'Lead'})` : 'None (Top Level Executive)'}
                  </Text>
                </View>
              </View>
            );
          })()}

          <Select
            label="Staff Member / Employee *"
            placeholder="Select staff member..."
            options={employeeOptions}
            value={selectedEmpId}
            onValueChange={(v) => {
              setSelectedEmpId(v);
              const currentEmp = employees.find((e) => e.id === v);
              setSelectedMgrId(currentEmp?.manager_id || '');
            }}
          />

          <Select
            label="Direct Reporting Supervisor / Manager *"
            placeholder="Select supervisor or department lead..."
            options={managerOptions}
            value={selectedMgrId || ''}
            onValueChange={(v) => setSelectedMgrId(v || null)}
          />
        </View>
      </Modal>

      {/* ─── MODAL: Quick Move Mobile Fallback ─────────────────────────────── */}
      <Modal
        visible={!!quickMoveModalEmp}
        onClose={() => setQuickMoveModalEmp(null)}
        title={`Reassign ${quickMoveModalEmp?.profile?.full_name || 'Employee'}`}
        subtitle={`Select target ${activeMode === 'departments' ? 'department' : activeMode === 'workplaces' ? 'office workplace' : 'role'}`}
        size="sm"
        icon={<MoveRight size={20} color="#7C3AED" />}
        iconBgColor="#EDE9FE"
        iconBorderColor="#DDD6FE"
        primaryAction={{
          label: 'Close',
          onPress: () => setQuickMoveModalEmp(null),
        }}
      >
        <View style={{ gap: 8 }}>
          {(activeMode === 'departments' || activeMode === 'directory') && (
            <>
              <TouchableOpacity
                onPress={() => handleQuickMove('unassigned')}
                style={styles.quickMoveRow}
              >
                <Text style={styles.quickMoveRowText}>Unassigned Department</Text>
              </TouchableOpacity>
              {departments.map((d) => (
                <TouchableOpacity
                  key={d.id}
                  onPress={() => handleQuickMove(d.id)}
                  style={styles.quickMoveRow}
                >
                  <Text style={styles.quickMoveRowText}>{d.name}</Text>
                </TouchableOpacity>
              ))}
            </>
          )}

          {activeMode === 'workplaces' && (
            <>
              <TouchableOpacity
                onPress={() => handleQuickMove('unassigned')}
                style={styles.quickMoveRow}
              >
                <Text style={styles.quickMoveRowText}>Remote / Unassigned</Text>
              </TouchableOpacity>
              {workplaces.map((w) => (
                <TouchableOpacity
                  key={w.id}
                  onPress={() => handleQuickMove(w.id)}
                  style={styles.quickMoveRow}
                >
                  <Text style={styles.quickMoveRowText}>{w.name}</Text>
                </TouchableOpacity>
              ))}
            </>
          )}

          {activeMode === 'roles' && (
            <>
              {(['employee', 'hr', 'admin'] as const).map((r) => (
                <TouchableOpacity
                  key={r}
                  onPress={() => handleQuickMove(r)}
                  style={styles.quickMoveRow}
                >
                  <Text style={styles.quickMoveRowText}>
                    {r === 'employee' ? 'Standard Staff' : r === 'hr' ? 'HR Manager' : 'Administrator'}
                  </Text>
                </TouchableOpacity>
              ))}
            </>
          )}
        </View>
      </Modal>

      {/* ─── DIALOG: Delete Department Confirm ────────────────────────────── */}
      <ConfirmDialog
        visible={!!deleteDept}
        title="Delete Department?"
        message={`Are you sure you want to delete ${deleteDept?.name}? All employees in this department will be moved to Unassigned.`}
        confirmLabel="Yes, Delete"
        onConfirm={handleDeleteDept}
        onCancel={() => setDeleteDept(null)}
        loading={savingDept}
        variant="danger"
      />
    </SidebarLayout>
  );
}

// ── Kanban Column Component ──────────────────────────────────────────────────
function KanbanColumn({
  id,
  title,
  sub,
  count,
  color,
  bg,
  employees,
  isDropTarget,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onQuickMove,
  onEditDept,
  actionLoadingId,
  colors,
}: {
  id: string;
  title: string;
  sub?: string;
  count: number;
  color: string;
  bg: string;
  employees: Employee[];
  isDropTarget: boolean;
  onDragStart: (e: any, id: string) => void;
  onDragOver: (e: any) => void;
  onDragLeave: (e: any) => void;
  onDrop: (e: any) => void;
  onQuickMove: (emp: Employee) => void;
  onEditDept?: () => void;
  actionLoadingId: string | null;
  colors: any;
}) {
  return (
    <View
      style={[
        styles.kanbanCol,
        isDropTarget && {
          borderColor: color,
          borderWidth: 2,
          backgroundColor: bg,
        },
      ]}
      {...(Platform.OS === 'web'
        ? ({
          onDragOver,
          onDragLeave,
          onDrop,
        } as any)
        : {})}
    >
      {/* Column Head */}
      <View style={styles.colHead}>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[styles.colDot, { backgroundColor: color }]} />
            <Text style={styles.colTitle} numberOfLines={1}>
              {title}
            </Text>
          </View>
          {sub && <Text style={{ fontSize: 11, color: '#64748B' }} numberOfLines={1}>{sub}</Text>}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={[styles.colPill, { backgroundColor: bg }]}>
            <Text style={{ fontSize: 12, fontWeight: '800', color }}>{count}</Text>
          </View>
          {onEditDept && (
            <TouchableOpacity onPress={onEditDept} style={styles.colEditBtn}>
              <Edit2 size={13} color="#64748B" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Employees Card Stream */}
      <ScrollView style={styles.colScroll} showsVerticalScrollIndicator={false}>
        {employees.length === 0 ? (
          <View style={styles.emptyColBox}>
            <Text style={{ fontSize: 12, color: '#94A3B8' }}>Drop staff here to reassign</Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {employees.map((emp) => {
              const name = emp.profile?.full_name || 'Staff';
              const isWorking = actionLoadingId === emp.id;
              return (
                <View
                  key={emp.id}
                  {...(Platform.OS === 'web'
                    ? ({
                      draggable: true,
                      onDragStart: (e: any) => onDragStart(e, emp.id),
                      style: [
                        styles.empKanbanCard,
                        isWorking && { opacity: 0.4 },
                      ],
                    } as any)
                    : {
                      style: styles.empKanbanCard,
                    })}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Avatar name={name} url={emp.profile?.avatar_url} size={34} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.cardEmpName} numberOfLines={1}>
                        {name}
                      </Text>
                      <Text style={styles.cardEmpSub} numberOfLines={1}>
                        {emp.designation || 'Staff'} · {emp.employee_code || 'EMP'}
                      </Text>
                    </View>

                    {isWorking ? (
                      <ActivityIndicator size="small" color="#7C3AED" />
                    ) : (
                      <TouchableOpacity
                        style={styles.movePill}
                        onPress={() => onQuickMove(emp)}
                      >
                        <MoveRight size={12} color="#7C3AED" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ── Tree Node Component ──────────────────────────────────────────────────────
function TreeNode({
  employee,
  collapsedNodes,
  onToggle,
  onReassignManager,
  colors,
  depth,
  visitedIds,
}: {
  employee: Employee;
  collapsedNodes: Record<string, boolean>;
  onToggle: (id: string) => void;
  onReassignManager: (emp: Employee) => void;
  colors: any;
  depth: number;
  visitedIds?: Set<string>;
}) {
  if (visitedIds && visitedIds.has(employee.id)) {
    return null;
  }

  const nextVisited = new Set(visitedIds || []);
  nextVisited.add(employee.id);

  const isCollapsed = collapsedNodes[employee.id];
  const directReports = (employee.direct_reports || []).filter((child) => !nextVisited.has(child.id));
  const hasReports = directReports.length > 0;
  const name = employee.profile?.full_name || 'Staff Member';
  const managerName = employee.manager?.profile?.full_name;

  return (
    <View style={[treeStyles.nodeWrap, { marginLeft: depth > 0 ? 24 : 0 }]}>
      <View
        style={[
          treeStyles.nodeCard,
          {
            borderLeftWidth: depth === 0 ? 3 : 1,
            borderLeftColor: depth === 0 ? '#7C3AED' : '#E2E8F0',
          },
        ]}
      >
        {hasReports && (
          <TouchableOpacity onPress={() => onToggle(employee.id)} style={treeStyles.collapseBtn}>
            {isCollapsed ? (
              <ChevronRight size={16} color="#7C3AED" />
            ) : (
              <ChevronDown size={16} color="#7C3AED" />
            )}
          </TouchableOpacity>
        )}

        <Avatar name={name} url={employee.profile?.avatar_url} size={36} />

        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text style={treeStyles.empName}>{name}</Text>
            {depth === 0 ? (
              <View style={treeStyles.leadershipBadge}>
                <Text style={treeStyles.leadershipBadgeText}>EXECUTIVE LEAD</Text>
              </View>
            ) : managerName ? (
              <View style={treeStyles.reportsToBadge}>
                <Text style={treeStyles.reportsToBadgeText}>Reports to: {managerName}</Text>
              </View>
            ) : null}
            {employee.department?.name && (
              <View style={treeStyles.deptBadge}>
                <Text style={treeStyles.deptBadgeText}>{employee.department.name}</Text>
              </View>
            )}
          </View>
          <Text style={treeStyles.designation}>
            {employee.designation || 'Staff'} · {employee.employee_code || 'EMP'}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {hasReports && (
            <View style={treeStyles.reportsBadge}>
              <Users size={12} color="#0D9488" />
              <Text style={treeStyles.reportsBadgeText}>
                {directReports.length} Direct Report{directReports.length !== 1 ? 's' : ''}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={treeStyles.editLineBtn}
            onPress={() => onReassignManager(employee)}
          >
            <GitFork size={13} color="#7C3AED" />
            <Text style={treeStyles.editLineBtnText}>Manage</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Children Direct Reports */}
      {hasReports && !isCollapsed && (
        <View style={treeStyles.childrenContainer}>
          {directReports.map((child) => (
            <TreeNode
              key={child.id}
              employee={child}
              collapsedNodes={collapsedNodes}
              onToggle={onToggle}
              onReassignManager={onReassignManager}
              colors={colors}
              depth={depth + 1}
              visitedIds={nextVisited}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 64 },
  contentDesktop: { maxWidth: 1440, alignSelf: 'center', width: '100%', padding: 28, paddingBottom: 72 },

  /* Breadcrumbs */
  breadcrumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  breadcrumbLink: { paddingVertical: 2 },
  breadcrumbText: { fontSize: 13, color: '#64748B', fontWeight: '500' },

  /* Header Row */
  headerRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8E5F3',
    padding: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 14,
    elevation: 2,
    flexWrap: 'wrap',
    gap: 16,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3EEFE',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E4DCFD',
  },
  headerBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C3AED',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 13.5,
    color: '#64748B',
    lineHeight: 20,
    maxWidth: 640,
  },
  headerPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  headerPrimaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  headerSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3EEFE',
    borderWidth: 1,
    borderColor: '#E4DCFD',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  headerSecondaryBtnText: {
    color: '#7C3AED',
    fontWeight: '700',
    fontSize: 13,
  },

  /* Metrics Cards Row */
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  metricCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    minHeight: 110,
    justifyContent: 'space-between',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  metricCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricValueText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  metricIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 4,
  },
  waveContainer: {
    marginTop: 4,
    alignSelf: 'flex-start',
  },

  /* Filters & Tabs */
  filtersContainer: {
    gap: 12,
    marginBottom: 20,
  },
  searchAndUnitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  searchBox: {
    flex: 1,
    minWidth: 260,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#0F172A',
    paddingVertical: 0,
  },
  unitScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  unitPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  unitPillActive: {
    backgroundColor: '#F3EEFE',
    borderColor: '#C4B5FD',
  },
  unitPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  unitPillTextActive: {
    color: '#7C3AED',
    fontWeight: '700',
  },

  modeTabsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  modeTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modeTabActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  modeTabText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748B',
  },
  modeTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  /* Directory Grid */
  deptGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  deptGridDesktop: {
    gap: 16,
  },
  deptCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ECECF2',
    padding: 18,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
    justifyContent: 'space-between',
  },
  deptCardTablet: {
    width: '48.5%',
  },
  deptCardDesktop: {
    width: '32%',
    minWidth: 310,
  },

  deptCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deptIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deptCountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  deptCountPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardActionIconBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },

  deptCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  deptCardDesc: {
    fontSize: 12.5,
    color: '#64748B',
    lineHeight: 18,
    minHeight: 36,
  },

  hodMiniCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    marginTop: 12,
  },
  hodNameText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  hodBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  hodSubText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  unassignedHodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  unassignedHodText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D97706',
  },
  unassignedHodAction: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#7C3AED',
  },

  deptCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarStackItem: {
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    borderRadius: 999,
  },
  avatarStackMore: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#EDE9FE',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarStackMoreText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7C3AED',
  },
  manageStaffBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3EEFE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  manageStaffBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#7C3AED',
  },

  /* Empty State */
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15.5,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 380,
    marginBottom: 16,
  },
  emptyAddBtn: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  emptyAddBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* Kanban Board */
  kanbanBoardWrap: { minHeight: 540 },
  boardColumns: { flexDirection: 'row', gap: 16, alignItems: 'flex-start', paddingBottom: 16 },
  kanbanCol: {
    width: 310,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    minHeight: 520,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  colHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FAF9FD',
  },
  colDot: { width: 8, height: 8, borderRadius: 4 },
  colTitle: { fontSize: 13.5, fontWeight: '800', color: '#0F172A', flex: 1 },
  colPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  colEditBtn: { padding: 4 },

  colScroll: { padding: 12, maxHeight: 650 },
  emptyColBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },

  empKanbanCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    shadowColor: '#0B1C30',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
    cursor: 'grab' as any,
  },
  cardEmpName: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  cardEmpSub: { fontSize: 11, color: '#64748B' },
  movePill: { padding: 6, borderRadius: 6, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },

  /* Tree View */
  treeContainer: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  treeHead: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  treeIconWrap: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  treeTitle: { fontSize: 15.5, fontWeight: '700', color: '#0F172A' },
  treeContent: { padding: 20, gap: 12 },
  treeActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  treeActionBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
  },
  treeActionPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#7C3AED',
  },
  treeActionPrimaryBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  unassignedTreeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderLeftWidth: 3,
    borderLeftColor: '#D97706',
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  unassignedEmpName: { fontSize: 13.5, fontWeight: '700', color: '#0F172A' },
  unassignedWarningBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  unassignedWarningBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
  },
  deptNeutralBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  deptNeutralBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
  unassignedEmpSub: { fontSize: 11.5, color: '#64748B' },
  assignSupervisorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#F3EEFE',
    borderWidth: 1,
    borderColor: '#E4DCFD',
  },
  assignSupervisorBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#7C3AED',
  },

  /* Modals Helpers */
  modalAlertBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  reportingSummaryBox: {
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  reportingSummaryDivider: {
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quickMoveRow: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  quickMoveRowText: {
    fontWeight: '600',
    color: '#0F172A',
    fontSize: 13,
  },
});

const treeStyles = StyleSheet.create({
  nodeWrap: { position: 'relative', marginTop: 8 },
  nodeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },
  collapseBtn: { padding: 4 },
  empName: { fontSize: 13.5, fontWeight: '700', color: '#0F172A' },
  designation: { fontSize: 11.5, color: '#64748B' },
  leadershipBadge: {
    backgroundColor: '#F3EEFE',
    borderWidth: 1,
    borderColor: '#E4DCFD',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  leadershipBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#7C3AED',
  },
  reportsToBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
  },
  reportsToBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
  deptBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#EFF6FF',
  },
  deptBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#2563EB',
  },
  reportsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#CCFBF1',
  },
  reportsBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0D9488',
  },
  editLineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  editLineBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7C3AED',
  },
  childrenContainer: {
    borderLeftWidth: 2,
    borderLeftColor: '#E2E8F0',
    marginLeft: 20,
    paddingLeft: 12,
    marginTop: 4,
  },
});
