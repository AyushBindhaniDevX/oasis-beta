import { AppointmentLetterModal } from '@/components/AppointmentLetterModal';
import { SidebarLayout } from '@/components/layout/Sidebar';
import { CustomPayrollItemsManager } from '@/components/payroll/CustomPayrollItemsManager';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { LoadingState } from '@/components/ui/States';
import {
  HOSPITAL_UNITS,
  normalizeEmploymentType,
  normalizeHospitalUnit,
  isShantiHospitalOrg,
  getTenantDefaultUnits,
} from '@/constants/config';
import { getNavForRole } from '@/constants/navigation';
import { useTenant } from '@/context/TenantContext';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { createAuditLog } from '@/lib/services/audit';
import { getDepartments, getEmployeeByProfileId, getEmployees, getWorkplaces, updateEmployee } from '@/lib/services/employee';
import { getLeaveBalances, getLeaveTypes, updateLeaveBalance } from '@/lib/services/leave';
import {
  createSystemUser,
  deleteUserRecord,
  getOrgUsers,
  toggleUserActive,
  updateUserProfileData
} from '@/lib/services/organization';
import { assignEmployeeShift, getShifts } from '@/lib/services/shifts';
import { HhcRoleSelector } from '@/components/HhcRoleSelector';
import { InteractiveTile } from '@/components/ui/InteractiveTile';
import {
  STOCK_1_SVG,
  STOCK_4_SVG,
  STOCK_8_SVG,
  STOCK_10_SVG,
  STOCK_12_SVG,
} from '@/constants/workManagementSvgs';
import Svg, { Path, SvgXml } from 'react-native-svg';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { CustomPayrollItem, Department, Employee, LeaveBalance, LeaveType, Profile, Workplace, WorkShift, HHCRole } from '@/types';
import { formatDate, getInitials } from '@/utils/format';
import { useRouter } from 'expo-router';
import { doc, getDoc, setDoc, writeBatch } from 'firebase/firestore';
import {
  AlertCircle,
  Award,
  Briefcase,
  Building,
  Building2,
  CheckCircle2,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Edit2,
  Eye,
  FileText,
  HeartPulse,
  KeyRound,
  Mail,
  MinusSquare,
  MoreHorizontal,
  MoreVertical,
  Phone,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  Square,
  Trash2,
  Umbrella,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  X,
  Check,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
  Platform,
} from 'react-native';

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

export default function UserManagementScreen() {
  const colors = useTheme();
  const { profile: currentAdmin } = useAuth();
  const { organization: tenantOrg, allOrganizations } = useTenant();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const [users, setUsers] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [shifts, setShifts] = useState<WorkShift[]>([]);
  const [managers, setManagers] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'hr' | 'employee'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [unitFilter, setUnitFilter] = useState<string>('all');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [empTypeFilter, setEmpTypeFilter] = useState<string>('all');

  // Pagination State
  const [pageSize, setPageSize] = useState<number | 'all'>(50);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, roleFilter, statusFilter, unitFilter, deptFilter, empTypeFilter, pageSize]);

  const isShantiOrg = useMemo(() => {
    return isShantiHospitalOrg(tenantOrg?.id || currentAdmin?.organization_id, tenantOrg?.name);
  }, [tenantOrg, currentAdmin]);

  // Multi-Select & Mass Action state
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [massModalType, setMassModalType] = useState<'none' | 'unit' | 'status' | 'dept' | 'shift' | 'category'>('none');
  const [massTargetUnit, setMassTargetUnit] = useState<string>(() => {
    return getTenantDefaultUnits(tenantOrg?.name, tenantOrg?.id || currentAdmin?.organization_id)[0] || 'Headquarters';
  });
  const [massTargetStatus, setMassTargetStatus] = useState<'active' | 'inactive'>('active');
  const [massTargetDeptId, setMassTargetDeptId] = useState<string | null>(null);
  const [massTargetShiftId, setMassTargetShiftId] = useState<string | null>(null);
  const [massTargetEmpType, setMassTargetEmpType] = useState<'Regular' | 'Contractual'>('Regular');
  const [massProcessing, setMassProcessing] = useState(false);

  // Modals state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<Profile | null>(null);
  const [toggleUser, setToggleUser] = useState<Profile | null>(null);
  const [deleteUser, setDeleteUser] = useState<Profile | null>(null);
  const [actionSheetUser, setActionSheetUser] = useState<Profile | null>(null);
  const [appointmentLetterUser, setAppointmentLetterUser] = useState<Profile | null>(null);
  const [infoBanner, setInfoBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Add User Form State
  const [newOrgId, setNewOrgId] = useState<string>('');
  const [newHospitalUnit, setNewHospitalUnit] = useState<string>('Headquarters');
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'hr' | 'employee'>('employee');
  const [newEmploymentType, setNewEmploymentType] = useState('Regular');
  const [newGrade, setNewGrade] = useState('M1');
  const [createEmpRecord, setCreateEmpRecord] = useState(true);
  const [newEmpCode, setNewEmpCode] = useState('');
  const [newDeptId, setNewDeptId] = useState<string | null>(null);
  const [newDesignation, setNewDesignation] = useState('');
  const [newWorkplaceId, setNewWorkplaceId] = useState<string | null>(null);
  const [newShiftId, setNewShiftId] = useState<string | null>(null);
  const [newManagerId, setNewManagerId] = useState<string | null>(null);
  const [newSalary, setNewSalary] = useState('');
  const [newDob, setNewDob] = useState('');
  const [newUan, setNewUan] = useState('');
  const [newEsi, setNewEsi] = useState('');
  const [newEsiExempt, setNewEsiExempt] = useState(false);
  const [newEpfPercentage, setNewEpfPercentage] = useState('12');
  const [newSocsoPercentage, setNewSocsoPercentage] = useState('0.5');
  const [newTaxPercentage, setNewTaxPercentage] = useState('5');
  const [newTaxRegime, setNewTaxRegime] = useState('custom');
  const [newHraPercentage, setNewHraPercentage] = useState('40');
  const [newTransportAllowance, setNewTransportAllowance] = useState('0');
  const [newConveyanceAllowance, setNewConveyanceAllowance] = useState('1200');
  const [newWashingAllowance, setNewWashingAllowance] = useState('500');
  const [newSpecialAllowance, setNewSpecialAllowance] = useState('');
  const [newCustomItems, setNewCustomItems] = useState<CustomPayrollItem[]>([]);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState(false);
  const [savingUser, setSavingUser] = useState(false);

  // Edit User Form State
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState<'admin' | 'hr' | 'employee'>('employee');
  const [editEmploymentType, setEditEmploymentType] = useState('Regular');
  const [editHospitalUnit, setEditHospitalUnit] = useState('Headquarters');
  const [editGrade, setEditGrade] = useState('M1');
  const [editEmpId, setEditEmpId] = useState<string | null>(null);
  const [editEmpCode, setEditEmpCode] = useState('');
  const [editDesignation, setEditDesignation] = useState('');
  const [editDeptId, setEditDeptId] = useState<string | null>(null);
  const [editWorkplaceId, setEditWorkplaceId] = useState<string | null>(null);
  const [editShiftId, setEditShiftId] = useState<string | null>(null);
  const [editManagerId, setEditManagerId] = useState<string | null>(null);
  const [editSalary, setEditSalary] = useState('');
  const [editDob, setEditDob] = useState('');
  const [editUan, setEditUan] = useState('');
  const [editEsi, setEditEsi] = useState('');
  const [editEsiExempt, setEditEsiExempt] = useState(false);
  const [editEpfPercentage, setEditEpfPercentage] = useState('12');
  const [editSocsoPercentage, setEditSocsoPercentage] = useState('0.5');
  const [editTaxPercentage, setEditTaxPercentage] = useState('5');
  const [editTaxRegime, setEditTaxRegime] = useState('custom');
  const [editHraPercentage, setEditHraPercentage] = useState('40');
  const [editTransportAllowance, setEditTransportAllowance] = useState('0');
  const [editConveyanceAllowance, setEditConveyanceAllowance] = useState('1200');
  const [editWashingAllowance, setEditWashingAllowance] = useState('500');
  const [editSpecialAllowance, setEditSpecialAllowance] = useState('');
  const [editCustomItems, setEditCustomItems] = useState<CustomPayrollItem[]>([]);
  const [editStatus, setEditStatus] = useState('active');
  const [editIsHhcEnabled, setEditIsHhcEnabled] = useState(false);
  const [editHhcRole, setEditHhcRole] = useState<HHCRole>('field_worker');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  // Leave Quotas Modal State
  const [leaveUser, setLeaveUser] = useState<Profile | null>(null);
  const [leaveEmployeeId, setLeaveEmployeeId] = useState<string | null>(null);
  const [userLeaveBalances, setUserLeaveBalances] = useState<LeaveBalance[]>([]);
  const [userLeaveTypes, setUserLeaveTypes] = useState<LeaveType[]>([]);
  const [customLeaveQuotas, setCustomLeaveQuotas] = useState<Record<string, string>>({});
  const [savingLeaveQuotas, setSavingLeaveQuotas] = useState(false);
  const [leaveSuccessBanner, setLeaveSuccessBanner] = useState('');

  // Processing state for quick actions
  const [processing, setProcessing] = useState(false);

  const load = useCallback(async () => {
    try {
      const orgId = tenantOrg?.id || currentAdmin?.organization_id;
      const [userData, deptData, wpData, shiftData, empData] = await Promise.all([
        getOrgUsers(orgId),
        getDepartments(orgId),
        getWorkplaces(orgId),
        getShifts(orgId),
        getEmployees(orgId ? { organization_id: orgId } : undefined),
      ]);
      setUsers(userData);
      setDepartments(deptData);
      setWorkplaces(wpData);
      setShifts(shiftData || []);
      setManagers(empData || []);
      if (wpData && wpData.length > 0) {
        setMassTargetUnit(wpData[0].name);
      }
    } catch (err) {
      console.error('Error loading users:', err);
    } finally {
      setLoading(false);
    }
  }, [currentAdmin, tenantOrg]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const tenantDomain = (tenantOrg?.settings as any)?.domain || 'company.com';

  const generateRandomCode = (targetOrgId?: string) => {
    const orgPrefix = (tenantOrg?.name || 'EMP').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'EMP';
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    return `${orgPrefix}-${randomDigits}`;
  };

  const openAddModal = () => {
    const defaultOrgId = tenantOrg?.id || currentAdmin?.organization_id || '00000000-0000-0000-0000-000000000001';
    setNewOrgId(defaultOrgId);
    const initialUnit = (workplaces && workplaces[0]?.name) || 'Headquarters';
    setNewHospitalUnit(initialUnit);
    setNewFullName('');
    setNewEmail('');
    setNewPhone('');
    setNewRole('employee');
    setNewEmploymentType('Regular');
    setNewGrade('M1');
    setCreateEmpRecord(true);
    setNewEmpCode(generateRandomCode(defaultOrgId));
    setNewDeptId(departments.length > 0 ? departments[0].id : null);
    setNewDesignation('');
    setNewWorkplaceId(workplaces.length > 0 ? workplaces[0].id : null);
    setNewShiftId(null);
    setNewManagerId(null);
    setNewSalary('50000');
    setNewDob('');
    setNewUan('');
    setNewEsi('');
    setNewEsiExempt(false);
    setFormError('');
    setFormSuccess(false);
    setAddModalOpen(true);
  };

  const handleOrgChange = async (val: string | null) => {
    if (!val) return;
    setNewOrgId(val);
    setNewEmpCode(generateRandomCode(val));
    try {
      const [deptData, wpData, shiftData, empData] = await Promise.all([
        getDepartments(val),
        getWorkplaces(val),
        getShifts(val),
        getEmployees({ organization_id: val }),
      ]);
      setDepartments(deptData);
      setWorkplaces(wpData);
      setShifts(shiftData || []);
      setManagers(empData || []);
      if (deptData.length > 0) setNewDeptId(deptData[0].id);
      if (wpData.length > 0) setNewWorkplaceId(wpData[0].id);
    } catch (err) {
      console.warn('Error loading org details for add modal:', err);
    }
  };

  const handleFullNameChange = (name: string) => {
    setNewFullName(name);
    const words = name.trim().split(/\s+/);
    const cleanWords = words.filter((w) => !/^(dr|mr|mrs|ms|prof)\.?$/i.test(w));
    const mainName = cleanWords[0] || words[0] || '';
    const usernamePrefix = mainName.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (usernamePrefix) {
      setNewEmail(usernamePrefix);
    }
  };

  const handleDeptChange = (val: string | null) => {
    setNewDeptId(val);
    if (val) {
      const dept = departments.find(d => d.id === val);
      if (dept && dept.manager_id) {
        setNewManagerId(dept.manager_id);
      }
    }
  };

  const handleCreateUser = async () => {
    if (!newFullName.trim()) {
      setFormError('Please enter a full name');
      return;
    }
    if (!newEmail.trim()) {
      setFormError('Please enter a username');
      return;
    }
    if (!newPhone || newPhone.length < 6) {
      setFormError('Phone number is required and must be at least 6 characters (used as default password)');
      return;
    }
    if (newEsi && !newEsiExempt && !/^\d{10}$/.test(newEsi.trim())) {
      setFormError('ESI Insurance Number must be exactly 10 digits.');
      return;
    }

    setFormError('');
    setSavingUser(true);
    try {
      // Strictly scope to current tenant organization to prevent cross-organization employee creation
      const orgId = tenantOrg?.id || currentAdmin?.organization_id || '00000000-0000-0000-0000-000000000001';
      const fullEmail = newEmail.trim().toLowerCase();

      const uid = await createSystemUser({
        email: fullEmail,
        password: newPhone.trim(),
        full_name: newFullName.trim(),
        role: newRole,
        organization_id: orgId,
        phone: newPhone.trim(),
        create_employee_record: createEmpRecord,
        employee_code: newEmpCode.trim() || undefined,
        department_id: newDeptId || undefined,
        designation: newDesignation.trim() || undefined,
        workplace_id: newWorkplaceId || undefined,
        default_shift_id: newShiftId || undefined,
        manager_id: newManagerId || undefined,
        date_of_birth: newDob.trim() || undefined,
        uan_number: newUan.trim() || undefined,
        esi_number: newEsi.trim() || undefined,
        esi_exempt: newEsiExempt,
        basic_salary: parseFloat(newSalary) || 0,
        employment_type: newEmploymentType,
        hospital_unit: newHospitalUnit,
        grade: newGrade.trim() || undefined,
        epf_percentage: parseFloat(newEpfPercentage) || 0,
        socso_percentage: parseFloat(newSocsoPercentage) || 0,
        tax_percentage: parseFloat(newTaxPercentage) || 0,
        tax_regime: newTaxRegime,
        hra_percentage: parseFloat(newHraPercentage) || 0,
        transport_allowance: parseFloat(newTransportAllowance) || 0,
        conveyance_allowance: parseFloat(newConveyanceAllowance) || 1200,
        washing_allowance: parseFloat(newWashingAllowance) || 500,
        special_allowance: newSpecialAllowance.trim() ? parseFloat(newSpecialAllowance) : null,
        custom_items: newCustomItems,
      });

      await createAuditLog('user_created', 'profile', uid, {
        email: fullEmail,
        role: newRole,
        created_by: currentAdmin?.id,
      });

      setFormSuccess(true);
      await load();
      setTimeout(() => {
        setAddModalOpen(false);
        setFormSuccess(false);
      }, 1500);
    } catch (err: any) {
      setFormError(err.message || 'Failed to create user. Please try again.');
    } finally {
      setSavingUser(false);
    }
  };

  const openLeaveModalForUser = async (u: Profile) => {
    setLeaveUser(u);
    setLeaveSuccessBanner('');
    try {
      const orgId = tenantOrg?.id || currentAdmin?.organization_id || u.organization_id || '';

      // Auto-resolve employee ID for profile
      const emp = await getEmployeeByProfileId(u.id);
      const empId: string | null = emp?.id || null;
      setLeaveEmployeeId(empId);

      const [types, balances] = await Promise.all([
        getLeaveTypes(orgId),
        empId ? getLeaveBalances(empId) : [],
      ]);

      setUserLeaveTypes(types || []);
      setUserLeaveBalances(balances || []);

      const qMap: Record<string, string> = {};
      types.forEach((lt) => {
        const found = balances.find((b) => b.leave_type_id === lt.id || b.leave_type?.name === lt.name);
        qMap[lt.id] = String(found ? found.allocated_days : lt.annual_days || 12);
      });
      setCustomLeaveQuotas(qMap);
    } catch (err) {
      console.error('Error opening leave modal:', err);
    }
  };

  const handleSaveAdminLeaveQuotas = async () => {
    if (!leaveEmployeeId) return;
    setSavingLeaveQuotas(true);
    setLeaveSuccessBanner('');
    try {
      for (const lt of userLeaveTypes) {
        const days = parseFloat(customLeaveQuotas[lt.id] || '0') || 0;
        const existing = userLeaveBalances.find((b) => b.leave_type_id === lt.id || b.leave_type?.name === lt.name);
        await updateLeaveBalance(leaveEmployeeId, lt.id, days, existing?.used_days || 0);
      }
      setLeaveSuccessBanner('Leave quotas saved successfully!');
      setTimeout(() => {
        setLeaveUser(null);
        setLeaveEmployeeId(null);
        setLeaveSuccessBanner('');
      }, 1000);
    } catch (err: any) {
      console.error('Failed to save leave quotas:', err);
    } finally {
      setSavingLeaveQuotas(false);
    }
  };

  const openEditModal = async (u: Profile) => {
    setEditUser(u);
    setEditFullName(u.full_name || '');
    setEditPhone(u.phone || '');
    setEditRole((u.role as any) || 'employee');
    setEditError('');

    // Fetch linked employee record if any
    try {
      const empData = await getEmployeeByProfileId(u.id);

      if (empData) {
        setEditEmpId(empData.id);
        setEditEmpCode(empData.employee_code || '');
        setEditDesignation(empData.designation || '');
        setEditDeptId(empData.department_id || null);
        setEditWorkplaceId(empData.workplace_id || null);
        setEditManagerId(empData.manager_id || null);
        setEditSalary(empData.basic_salary ? String(empData.basic_salary) : '0');
        setEditDob(empData.date_of_birth || '');
        setEditEmploymentType(normalizeEmploymentType((empData as any).employment_type));
        setEditHospitalUnit(normalizeHospitalUnit(empData.hospital_unit));
        setEditGrade((empData as any).grade || '');
        const tc = (empData as any).tax_config || {};
        setEditUan(tc.uan_number || '');
        setEditEsi(tc.esi_number || '');
        setEditEsiExempt(!!tc.esi_exempt);
        setEditEpfPercentage(tc.epf_percentage != null ? String(tc.epf_percentage) : '12');
        setEditSocsoPercentage(tc.socso_percentage != null ? String(tc.socso_percentage) : '0.5');
        setEditTaxPercentage(tc.tax_percentage != null ? String(tc.tax_percentage) : tc.tds_percentage != null ? String(tc.tds_percentage) : '5');
        setEditTaxRegime(tc.tax_regime || 'custom');
        setEditHraPercentage(tc.hra_percentage != null ? String(tc.hra_percentage) : '40');
        setEditTransportAllowance(tc.transport_allowance != null ? String(tc.transport_allowance) : '0');
        setEditConveyanceAllowance(empData.conveyance_allowance != null ? String(empData.conveyance_allowance) : '1200');
        setEditWashingAllowance(empData.washing_allowance != null ? String(empData.washing_allowance) : '500');
        setEditSpecialAllowance(empData.special_allowance != null ? String(empData.special_allowance) : '');
        setEditCustomItems(Array.isArray(tc.custom_items) ? tc.custom_items : []);
        setEditStatus(empData.employment_status || 'active');
        setEditIsHhcEnabled(!!empData?.is_hhc_enabled || !!u.is_hhc_enabled);
        const resolvedRole: HHCRole = empData?.hhc_role || u.hhc_role || ((empData?.designation || '').toLowerCase().includes('dr') ? 'doctor' : 'field_worker');
        setEditHhcRole(resolvedRole);

        let shiftVal = (empData as any).default_shift_id || null;
        if (!shiftVal) {
          try {
            const today = new Date().toISOString().split('T')[0];
            const shiftSnap = await getDoc(doc(db, 'employee_shifts', `${empData.id}_${today}`));
            if (shiftSnap.exists() && shiftSnap.data()?.shift_id) {
              shiftVal = shiftSnap.data().shift_id;
            }
          } catch (sErr) { }
        }
        setEditShiftId(shiftVal);
      } else {
        setEditEmpId(null);
        setEditEmpCode('');
        setEditDesignation('');
        setEditDeptId(null);
        setEditWorkplaceId(null);
        setEditShiftId(null);
        setEditManagerId(null);
        setEditSalary('');
        setEditDob('');
        setEditUan('');
        setEditEsi('');
        setEditEsiExempt(false);
        setEditEmploymentType('Regular');
        setEditHospitalUnit('Headquarters');
        setEditGrade('M1');
        setEditEpfPercentage('12');
        setEditSocsoPercentage('0.5');
        setEditTaxPercentage('5');
        setEditHraPercentage('40');
        setEditTransportAllowance('0');
        setEditConveyanceAllowance('1200');
        setEditWashingAllowance('500');
        setEditSpecialAllowance('');
        setEditCustomItems([]);
        setEditStatus('active');
        setEditIsHhcEnabled(!!u.is_hhc_enabled);
        setEditHhcRole(u.hhc_role || 'field_worker');
      }
    } catch (e) {
      console.warn('Could not fetch linked employee for user edit:', e);
    }
  };

  const handleDeptChangeEdit = (val: string | null) => {
    setEditDeptId(val);
    if (val) {
      const dept = departments.find(d => d.id === val);
      if (dept && dept.manager_id) {
        setEditManagerId(dept.manager_id);
      }
    }
  };

  const handleSaveEdit = async () => {
    if (!editUser) return;
    if (!editFullName.trim()) {
      setEditError('Full name cannot be empty');
      return;
    }
    if (editEsi && !editEsiExempt && !/^\d{10}$/.test(editEsi.trim())) {
      setEditError('ESI Insurance Number must be exactly 10 digits.');
      return;
    }

    setSavingEdit(true);
    setEditError('');
    try {
      // 1. Update Profile
      await updateUserProfileData(editUser.id, {
        full_name: editFullName.trim(),
        phone: editPhone.trim() || null,
        role: editRole,
        is_hhc_enabled: editIsHhcEnabled,
        hhc_role: editIsHhcEnabled ? editHhcRole : null,
      });

      const updatedTaxConfig = {
        uan_number: editUan.trim() || null,
        esi_number: editEsi.trim() || null,
        esi_exempt: editEsiExempt,
        epf_percentage: parseFloat(editEpfPercentage) || 0,
        socso_percentage: parseFloat(editSocsoPercentage) || 0,
        tax_percentage: parseFloat(editTaxPercentage) || 0,
        tds_percentage: parseFloat(editTaxPercentage) || 0,
        tax_regime: editTaxRegime,
        hra_percentage: parseFloat(editHraPercentage) || 0,
        transport_allowance: parseFloat(editTransportAllowance) || 0,
        custom_items: editCustomItems,
      };

      // 2. Update linked Employee if exists, otherwise create it!
      let currentEmpId = editEmpId;
      if (currentEmpId) {
        await updateEmployee(currentEmpId, {
          employee_code: editEmpCode.trim() || null,
          designation: editDesignation.trim() || null,
          department_id: editDeptId || null,
          workplace_id: editWorkplaceId || null,
          default_shift_id: editShiftId || null,
          manager_id: editManagerId || null,
          date_of_birth: editDob.trim() || null,
          basic_salary: parseFloat(editSalary) || 0,
          conveyance_allowance: parseFloat(editConveyanceAllowance) || 1200,
          washing_allowance: parseFloat(editWashingAllowance) || 500,
          special_allowance: editSpecialAllowance.trim() ? parseFloat(editSpecialAllowance) : null,
          employment_type: editEmploymentType as any,
          hospital_unit: editHospitalUnit,
          grade: editGrade.trim() || null,
          tax_config: updatedTaxConfig,
          employment_status: editStatus as any,
          is_hhc_enabled: editIsHhcEnabled,
          hhc_role: editIsHhcEnabled ? editHhcRole : null,
        });
      } else {
        const newEmpId = `emp-${Date.now()}`;
        const empPayload: Record<string, any> = {
          id: newEmpId,
          profile_id: editUser.id,
          organization_id: editUser.organization_id,
          employee_code: editEmpCode.trim() || `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
          department_id: editDeptId || null,
          workplace_id: editWorkplaceId || null,
          designation: editDesignation.trim() || 'Staff',
          employment_type: editEmploymentType || 'Regular',
          hospital_unit: editHospitalUnit || 'Headquarters',
          grade: editGrade.trim() || null,
          manager_id: editManagerId || null,
          default_shift_id: editShiftId || null,
          date_of_birth: editDob.trim() || null,
          basic_salary: parseFloat(editSalary) || 0,
          conveyance_allowance: parseFloat(editConveyanceAllowance) || 1200,
          washing_allowance: parseFloat(editWashingAllowance) || 500,
          special_allowance: editSpecialAllowance.trim() ? parseFloat(editSpecialAllowance) : null,
          tax_config: updatedTaxConfig,
          employment_status: editStatus as any,
          onboarding_completed: true,
          is_hhc_enabled: editIsHhcEnabled,
          hhc_role: editIsHhcEnabled ? editHhcRole : null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        await setDoc(doc(db, 'employees', newEmpId), empPayload);
        currentEmpId = newEmpId;
      }

      // 3. Link shift roster if assigned
      if (editShiftId && editUser.organization_id && currentEmpId) {
        try {
          const today = new Date().toISOString().split('T')[0];
          await assignEmployeeShift(currentEmpId, today, editShiftId, editUser.organization_id);
        } catch (sErr) { }
      }

      await createAuditLog('user_updated', 'profile', editUser.id, {
        old_role: editUser.role,
        new_role: editRole,
        updated_by: currentAdmin?.id,
      });

      setEditUser(null);
      await load();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update user profile');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleResendInvite = async (u: Profile) => {
    try {
      const { sendWelcomeEmail } = await import('@/lib/services/resend');
      const emp = empByProfileId.get(u.id) || (u as any).employee;
      const targetOrgId = u.organization_id || tenantOrg?.id;
      const dept = departments.find(d => d.id === emp?.department_id);
      const wp = workplaces.find(w => w.id === emp?.workplace_id);

      await sendWelcomeEmail(
        u.email,
        u.full_name || 'Team Member',
        emp?.employee_code || 'EMP-ACCESS',
        emp?.designation || (u.role === 'admin' ? 'Administrator' : u.role === 'hr' ? 'HR Manager' : 'Employee'),
        {
          organizationId: targetOrgId,
          organizationName: tenantOrg?.name,
          department: dept?.name,
          workplace: wp?.name,
          designation: emp?.designation || undefined,
          temporaryPassword: u.phone || 'Welcome@123',
        }
      );
      setInfoBanner({
        type: 'success',
        message: `Welcome & login invitation sent to ${u.email} successfully with ${tenantOrg?.name || 'organization'} credentials.`,
      });
      setTimeout(() => setInfoBanner(null), 4000);
    } catch (err: any) {
      setInfoBanner({
        type: 'error',
        message: `Failed to dispatch invitation email: ${err.message}`,
      });
      setTimeout(() => setInfoBanner(null), 4000);
    }
  };

  const handleToggle = async () => {
    if (!toggleUser) return;
    setProcessing(true);
    try {
      const nextActive = !toggleUser.is_active;
      await toggleUserActive(toggleUser.id, nextActive);
      await createAuditLog(
        nextActive ? 'user_activated' : 'user_deactivated',
        'profile',
        toggleUser.id,
        { toggled_by: currentAdmin?.id }
      );
      setToggleUser(null);
      setInfoBanner({
        type: 'success',
        message: `${toggleUser.full_name}'s account was ${nextActive ? 'activated' : 'deactivated'}.`,
      });
      setTimeout(() => setInfoBanner(null), 4000);
      await load();
    } catch (err) {
      console.error('Toggle active error:', err);
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUser) return;
    setProcessing(true);
    try {
      await deleteUserRecord(deleteUser.id);
      await createAuditLog('user_deleted', 'profile', deleteUser.id, {
        deleted_email: deleteUser.email,
        deleted_name: deleteUser.full_name,
        deleted_by: currentAdmin?.id,
      });
      setDeleteUser(null);
      setInfoBanner({
        type: 'success',
        message: `Account for ${deleteUser.full_name} (${deleteUser.email}) has been deleted.`,
      });
      setTimeout(() => setInfoBanner(null), 4000);
      await load();
    } catch (err: any) {
      console.error('Delete user error:', err);
      setInfoBanner({
        type: 'error',
        message: err.message || 'Failed to delete user account.',
      });
      setTimeout(() => setInfoBanner(null), 5000);
    } finally {
      setProcessing(false);
    }
  };

  const handleResetPassword = async (userEmail: string) => {
    try {
      const cleanEmail = userEmail.trim().toLowerCase();
      try {
        const { sendPasswordResetEmail } = await import('firebase/auth');
        const { auth } = await import('@/lib/firebase');
        await sendPasswordResetEmail(auth, cleanEmail);
      } catch (fbErr) {
        console.warn('Firebase reset email notice:', fbErr);
      }

      try {
        const { sendPasswordResetNotificationEmail } = await import('@/lib/services/resend');
        await sendPasswordResetNotificationEmail(cleanEmail, cleanEmail.split('@')[0], undefined, {
          organizationId: tenantOrg?.id || currentAdmin?.organization_id,
        });
      } catch (rErr) {
        console.warn('Resend reset email notice:', rErr);
      }

      setInfoBanner({
        type: 'success',
        message: `Password reset instructions have been sent to ${cleanEmail}.`,
      });
      setTimeout(() => setInfoBanner(null), 4000);
    } catch (err: any) {
      setInfoBanner({
        type: 'error',
        message: err.message || `Failed to send password reset for ${userEmail}.`,
      });
      setTimeout(() => setInfoBanner(null), 5000);
    }
  };

  // Memoized O(1) employee and workplace lookups
  const empByProfileId = useMemo(() => {
    const map = new Map<string, Employee>();
    for (const m of managers) {
      if (m.profile_id) map.set(m.profile_id, m);
      if ((m.profile as any)?.id) map.set((m.profile as any).id, m);
      if (m.id) map.set(m.id, m);
    }
    for (const u of users) {
      if ((u as any).employee) {
        const emp = (u as any).employee;
        if (!map.has(u.id)) map.set(u.id, emp);
      }
    }
    return map;
  }, [managers, users]);

  const workplacesMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const w of workplaces) {
      map.set(w.id, w.name || '');
    }
    return map;
  }, [workplaces]);

  const selectedUserIdsSet = useMemo(() => new Set(selectedUserIds), [selectedUserIds]);

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    const trimmedSearch = search.trim().toLowerCase();
    const hasSearch = trimmedSearch.length > 0;
    const targetUnit = unitFilter !== 'all' ? unitFilter.toLowerCase() : null;

    return users.filter((u) => {
      // Role filter
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      // Status filter
      if (statusFilter === 'active' && !u.is_active) return false;
      if (statusFilter === 'inactive' && u.is_active) return false;

      const emp = (targetUnit || deptFilter !== 'all' || empTypeFilter !== 'all' || hasSearch)
        ? (empByProfileId.get(u.id) || (u as any).employee)
        : null;

      // Unit filter
      if (targetUnit) {
        const empUnit = normalizeHospitalUnit(emp?.hospital_unit || emp?.workplace?.name);
        const wpName = emp?.workplace_id ? (workplacesMap.get(emp.workplace_id) || '') : '';
        if (empUnit.toLowerCase() !== targetUnit && wpName.toLowerCase() !== targetUnit) return false;
      }
      // Department filter
      if (deptFilter !== 'all') {
        if (emp?.department_id !== deptFilter) return false;
      }
      // Employment Category filter
      if (empTypeFilter !== 'all') {
        const empType = normalizeEmploymentType(emp?.employment_type);
        if (empType !== empTypeFilter) return false;
      }
      // Search
      if (hasSearch) {
        const matchesName = u.full_name?.toLowerCase().includes(trimmedSearch);
        const matchesEmail = u.email?.toLowerCase().includes(trimmedSearch);
        const matchesPhone = u.phone?.toLowerCase().includes(trimmedSearch);
        const matchesRole = u.role?.toLowerCase().includes(trimmedSearch);
        const matchesCode = emp?.employee_code?.toLowerCase().includes(trimmedSearch);
        return matchesName || matchesEmail || matchesPhone || matchesRole || matchesCode;
      }
      return true;
    });
  }, [users, roleFilter, statusFilter, unitFilter, deptFilter, empTypeFilter, search, empByProfileId, workplacesMap]);

  // Pagination calculations
  const totalPages = useMemo(() => {
    if (pageSize === 'all') return 1;
    return Math.max(1, Math.ceil(filteredUsers.length / Number(pageSize)));
  }, [filteredUsers.length, pageSize]);

  const paginatedUsers = useMemo(() => {
    if (pageSize === 'all') return filteredUsers;
    const size = Number(pageSize);
    const start = (currentPage - 1) * size;
    return filteredUsers.slice(start, start + size);
  }, [filteredUsers, currentPage, pageSize]);

  const availableUnits = useMemo(() => {
    // 1. Strict tenant configured units or industry defaults
    const configuredUnits = getTenantDefaultUnits(
      tenantOrg?.name,
      tenantOrg?.id || currentAdmin?.organization_id,
      tenantOrg?.units
    );

    // 2. Workplaces strictly belonging to this organization
    const wpNames = workplaces.map((w) => w.name.trim()).filter(Boolean);

    // 3. Match user units only if they are part of configured units or workplaces
    const userUnits = users
      .map((u) => ((u as any).employee?.hospital_unit || '').trim())
      .filter((u) => u && (configuredUnits.some((cu) => cu.toLowerCase() === u.toLowerCase()) || wpNames.includes(u)));

    const combined = Array.from(new Set([...configuredUnits, ...wpNames, ...userUnits]));
    return combined.length > 0 ? combined : ['Headquarters'];
  }, [workplaces, users, tenantOrg, currentAdmin]);

  // Selection state calculations & handlers
  const isAllSelected = filteredUsers.length > 0 && filteredUsers.every((u) => selectedUserIdsSet.has(u.id));
  const isPageSelected = paginatedUsers.length > 0 && paginatedUsers.every((u) => selectedUserIdsSet.has(u.id));
  const isSomeSelected = selectedUserIds.length > 0 && !isAllSelected;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(filteredUsers.map((u) => u.id));
    }
  };

  const toggleSelectPage = () => {
    if (isPageSelected) {
      const pageIdSet = new Set(paginatedUsers.map((u) => u.id));
      setSelectedUserIds((prev) => prev.filter((id) => !pageIdSet.has(id)));
    } else {
      const pageIds = paginatedUsers.map((u) => u.id);
      setSelectedUserIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const toggleSelectUser = (userId: string) => {
    setSelectedUserIds((prev) => {
      const s = new Set(prev);
      if (s.has(userId)) s.delete(userId);
      else s.add(userId);
      return Array.from(s);
    });
  };

  const clearSelection = () => {
    setSelectedUserIds([]);
  };

  const handleMassApply = async () => {
    if (selectedUserIds.length === 0) return;
    setMassProcessing(true);
    try {
      const orgId = tenantOrg?.id || currentAdmin?.organization_id;
      let batch = writeBatch(db);
      let batchOps = 0;
      let count = 0;
      const nowIso = new Date().toISOString();

      const matchingWp = massModalType === 'unit'
        ? workplaces.find(
            (w) =>
              w.name.toLowerCase() === massTargetUnit.toLowerCase() ||
              w.id === massTargetUnit ||
              w.name.toLowerCase().includes(massTargetUnit.toLowerCase()) ||
              massTargetUnit.toLowerCase().includes(w.name.toLowerCase())
          )
        : null;

      for (const uid of selectedUserIds) {
        const emp = empByProfileId.get(uid);

        if (massModalType === 'unit') {
          if (emp?.id) {
            batch.update(doc(db, 'employees', emp.id), {
              hospital_unit: massTargetUnit,
              workplace_id: matchingWp ? matchingWp.id : (emp.workplace_id || null),
              updated_at: nowIso,
            });
            count++;
            batchOps++;
          }
        } else if (massModalType === 'status') {
          batch.update(doc(db, 'profiles', uid), {
            is_active: massTargetStatus === 'active',
            updated_at: nowIso,
          });
          batchOps++;
          if (emp?.id) {
            batch.update(doc(db, 'employees', emp.id), {
              employment_status: massTargetStatus === 'active' ? 'active' : 'inactive',
              updated_at: nowIso,
            });
            batchOps++;
          }
          count++;
        } else if (massModalType === 'dept') {
          if (emp?.id && massTargetDeptId) {
            batch.update(doc(db, 'employees', emp.id), {
              department_id: massTargetDeptId,
              updated_at: nowIso,
            });
            count++;
            batchOps++;
          }
        } else if (massModalType === 'shift') {
          if (emp?.id && massTargetShiftId) {
            batch.update(doc(db, 'employees', emp.id), {
              default_shift_id: massTargetShiftId,
              updated_at: nowIso,
            });
            if (orgId) {
              const today = new Date().toISOString().split('T')[0];
              assignEmployeeShift(emp.id, today, massTargetShiftId, orgId).catch(() => { });
            }
            count++;
            batchOps++;
          }
        } else if (massModalType === 'category') {
          if (emp?.id) {
            batch.update(doc(db, 'employees', emp.id), {
              employment_type: massTargetEmpType,
              updated_at: nowIso,
            });
            count++;
            batchOps++;
          }
        }

        if (batchOps >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          batchOps = 0;
        }
      }

      if (batchOps > 0) {
        await batch.commit();
      }

      await createAuditLog('mass_user_update', 'profile', currentAdmin?.id || 'admin', {
        action: massModalType,
        target_count: count,
        user_ids: selectedUserIds,
        performed_by: currentAdmin?.id,
      });

      setInfoBanner({
        type: 'success',
        message: `Successfully applied mass update to ${selectedUserIds.length} user${selectedUserIds.length > 1 ? 's' : ''}.`,
      });
      setTimeout(() => setInfoBanner(null), 4000);
      setMassModalType('none');
      setSelectedUserIds([]);
      await load();
    } catch (err: any) {
      console.error('Mass update error:', err);
      setInfoBanner({
        type: 'error',
        message: err.message || 'Failed to complete mass update.',
      });
      setTimeout(() => setInfoBanner(null), 5000);
    } finally {
      setMassProcessing(false);
    }
  };

  // Statistics
  const adminCount = users.filter((u) => u.role === 'admin').length;
  const hrCount = users.filter((u) => u.role === 'hr').length;
  const empCount = users.filter((u) => u.role === 'employee').length;
  const activeCount = users.filter((u) => u.is_active).length;

  const getRoleBadgeVariant = (role: string): 'accentLight' | 'warningLight' | 'neutral' => {
    if (role === 'admin') return 'accentLight';
    if (role === 'hr') return 'warningLight';
    return 'neutral';
  };

  const pkg = tenantOrg?.package_type?.toLowerCase() || 'basic';
  const limit = Math.max(500, tenantOrg?.max_employees || 500);
  const isLimitReached = activeCount >= limit;

  if (loading) return <LoadingState />;

  const navItems = getNavForRole(currentAdmin?.role);

  return (
    <SidebarLayout items={navItems}>
      <ScrollView
        style={[styles.container, { backgroundColor: '#FAF9FD' }]}
        contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Top Header Row with STOCK 1 SVG Graphic */}
        <Animated.View entering={FadeInDown.duration(280)} style={styles.header}>
          <View style={{ flex: 1, minWidth: 260 }}>
            <View style={styles.headerBadge}>
              <Users size={14} color="#7C3AED" />
              <Text style={styles.headerBadgeText}>Workforce & Directory</Text>
            </View>
            <Text style={[styles.title, { color: '#0F172A' }]}>Users & Employees</Text>
            <Text style={[styles.subtitle, { color: '#64748B' }]}>
              Manage organization accounts, duty locations, role assignments, and compensation structures.
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 }}>
              <Badge label={`${String(pkg || 'standard').toUpperCase()} PACKAGE`} variant={pkg === 'gold' ? 'warning' : 'neutral'} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: isLimitReached ? colors.danger : '#64748B' }}>
                {activeCount} / {limit} Users active ({Math.max(0, limit - activeCount)} left)
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ opacity: 0.95 }}>
              <SvgXml xml={STOCK_1_SVG} width={isDesktop ? 130 : 95} height={isDesktop ? 92 : 68} />
            </View>
            <TouchableOpacity
              style={[
                styles.addBtn,
                { backgroundColor: isLimitReached ? '#94A3B8' : '#7C3AED' },
              ]}
              onPress={openAddModal}
              activeOpacity={0.85}
              disabled={isLimitReached}
            >
              <UserPlus size={16} color="#FFF" />
              <Text style={styles.addBtnText}>{isLimitReached ? 'Limit Reached' : 'Add New User'}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {infoBanner && (
          <View
            style={[
              styles.alertBox,
              infoBanner.type === 'success'
                ? { backgroundColor: '#EDFAF2', borderColor: '#CEF2DE' }
                : { backgroundColor: '#FFF1F2', borderColor: '#FECDD3' },
            ]}
          >
            {infoBanner.type === 'success' ? (
              <CheckCircle2 size={18} color="#059669" />
            ) : (
              <AlertCircle size={18} color="#DC2626" />
            )}
            <Text
              style={{
                color: infoBanner.type === 'success' ? '#065F46' : '#991B1B',
                fontWeight: '600',
                fontSize: 13,
                flex: 1,
              }}
            >
              {infoBanner.message}
            </Text>
          </View>
        )}

        {/* 4 Pastel KPI Metric Cards with InteractiveTile & MetricWave */}
        <Animated.View entering={FadeInDown.delay(50).duration(280)} style={{ marginBottom: 12, width: '100%' }}>
          {isDesktop ? (
            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
              {/* Tile 1: Total Accounts */}
              <InteractiveTile
                style={[
                  styles.pastelMetricCard,
                  {
                    backgroundColor: '#F3EEFE',
                    borderColor: '#E4DCFD',
                    flex: 1,
                  },
                ]}
              >
                <View style={styles.cardTopRow}>
                  <View style={[styles.iconBox, { backgroundColor: '#DDD6FE' }]}>
                    <SvgXml xml={STOCK_4_SVG} width={34} height={25} />
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.metricValueText, { color: '#1E1B4B' }]}>{users.length}</Text>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#10B981', marginTop: 1 }}>↑ Staff Roster</Text>
                  </View>
                </View>
                <Text style={styles.metricLabelText}>Total Accounts</Text>
                <View style={styles.waveContainer}>
                  <MetricWave color="#8B5CF6" width={150} height={24} />
                </View>
              </InteractiveTile>

              {/* Tile 2: Administrators */}
              <InteractiveTile
                style={[
                  styles.pastelMetricCard,
                  {
                    backgroundColor: '#EDFAF2',
                    borderColor: '#CEF2DE',
                    flex: 1,
                  },
                ]}
                onPress={() => setRoleFilter('admin')}
              >
                <View style={styles.cardTopRow}>
                  <View style={[styles.iconBox, { backgroundColor: '#D1FAE5' }]}>
                    <SvgXml xml={STOCK_12_SVG} width={34} height={25} />
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.metricValueText, { color: '#064E3B' }]}>{adminCount}</Text>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#10B981', marginTop: 1 }}>Full Access</Text>
                  </View>
                </View>
                <Text style={styles.metricLabelText}>Administrators</Text>
                <View style={styles.waveContainer}>
                  <MetricWave color="#10B981" width={150} height={24} />
                </View>
              </InteractiveTile>

              {/* Tile 3: HR Managers */}
              <InteractiveTile
                style={[
                  styles.pastelMetricCard,
                  {
                    backgroundColor: '#FFF4EB',
                    borderColor: '#FFE2CD',
                    flex: 1,
                  },
                ]}
                onPress={() => setRoleFilter('hr')}
              >
                <View style={styles.cardTopRow}>
                  <View style={[styles.iconBox, { backgroundColor: '#FFEDD5' }]}>
                    <SvgXml xml={STOCK_8_SVG} width={34} height={25} />
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.metricValueText, { color: '#7C2D12' }]}>{hrCount}</Text>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#EA580C', marginTop: 1 }}>Management</Text>
                  </View>
                </View>
                <Text style={styles.metricLabelText}>HR Managers</Text>
                <View style={styles.waveContainer}>
                  <MetricWave color="#F97316" width={150} height={24} />
                </View>
              </InteractiveTile>

              {/* Tile 4: Active Users */}
              <InteractiveTile
                style={[
                  styles.pastelMetricCard,
                  {
                    backgroundColor: '#EFF6FF',
                    borderColor: '#DBEAFE',
                    flex: 1,
                  },
                ]}
                onPress={() => setStatusFilter('active')}
              >
                <View style={styles.cardTopRow}>
                  <View style={[styles.iconBox, { backgroundColor: '#DBEAFE' }]}>
                    <SvgXml xml={STOCK_10_SVG} width={34} height={25} />
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.metricValueText, { color: '#1E3A8A' }]}>{activeCount}</Text>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#2563EB', marginTop: 1 }}>{limit - activeCount} Avail</Text>
                  </View>
                </View>
                <Text style={styles.metricLabelText}>Active Users</Text>
                <View style={styles.waveContainer}>
                  <MetricWave color="#3B82F6" width={150} height={24} />
                </View>
              </InteractiveTile>
            </View>
          ) : (
            <View style={{ gap: 12, width: '100%' }}>
              <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
                {/* Tile 1: Total Accounts */}
                <InteractiveTile
                  style={[
                    styles.pastelMetricCard,
                    {
                      backgroundColor: '#F3EEFE',
                      borderColor: '#E4DCFD',
                      flex: 1,
                    },
                  ]}
                >
                  <View style={styles.cardTopRow}>
                    <View style={[styles.iconBox, { backgroundColor: '#DDD6FE' }]}>
                      <SvgXml xml={STOCK_4_SVG} width={34} height={25} />
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.metricValueText, { color: '#1E1B4B' }]}>{users.length}</Text>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#10B981', marginTop: 1 }}>↑ Staff Roster</Text>
                    </View>
                  </View>
                  <Text style={styles.metricLabelText}>Total Accounts</Text>
                  <View style={styles.waveContainer}>
                    <MetricWave color="#8B5CF6" width={80} height={24} />
                  </View>
                </InteractiveTile>

                {/* Tile 2: Administrators */}
                <InteractiveTile
                  style={[
                    styles.pastelMetricCard,
                    {
                      backgroundColor: '#EDFAF2',
                      borderColor: '#CEF2DE',
                      flex: 1,
                    },
                  ]}
                  onPress={() => setRoleFilter('admin')}
                >
                  <View style={styles.cardTopRow}>
                    <View style={[styles.iconBox, { backgroundColor: '#D1FAE5' }]}>
                      <SvgXml xml={STOCK_12_SVG} width={34} height={25} />
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.metricValueText, { color: '#064E3B' }]}>{adminCount}</Text>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#10B981', marginTop: 1 }}>Full Access</Text>
                    </View>
                  </View>
                  <Text style={styles.metricLabelText}>Admins</Text>
                  <View style={styles.waveContainer}>
                    <MetricWave color="#10B981" width={80} height={24} />
                  </View>
                </InteractiveTile>
              </View>

              <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
                {/* Tile 3: HR Managers */}
                <InteractiveTile
                  style={[
                    styles.pastelMetricCard,
                    {
                      backgroundColor: '#FFF4EB',
                      borderColor: '#FFE2CD',
                      flex: 1,
                    },
                  ]}
                  onPress={() => setRoleFilter('hr')}
                >
                  <View style={styles.cardTopRow}>
                    <View style={[styles.iconBox, { backgroundColor: '#FFEDD5' }]}>
                      <SvgXml xml={STOCK_8_SVG} width={34} height={25} />
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.metricValueText, { color: '#7C2D12' }]}>{hrCount}</Text>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#EA580C', marginTop: 1 }}>Management</Text>
                    </View>
                  </View>
                  <Text style={styles.metricLabelText}>HR Managers</Text>
                  <View style={styles.waveContainer}>
                    <MetricWave color="#F97316" width={80} height={24} />
                  </View>
                </InteractiveTile>

                {/* Tile 4: Active Users */}
                <InteractiveTile
                  style={[
                    styles.pastelMetricCard,
                    {
                      backgroundColor: '#EFF6FF',
                      borderColor: '#DBEAFE',
                      flex: 1,
                    },
                  ]}
                  onPress={() => setStatusFilter('active')}
                >
                  <View style={styles.cardTopRow}>
                    <View style={[styles.iconBox, { backgroundColor: '#DBEAFE' }]}>
                      <SvgXml xml={STOCK_10_SVG} width={34} height={25} />
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.metricValueText, { color: '#1E3A8A' }]}>{activeCount}</Text>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#2563EB', marginTop: 1 }}>{limit - activeCount} Avail</Text>
                    </View>
                  </View>
                  <Text style={styles.metricLabelText}>Active Users</Text>
                  <View style={styles.waveContainer}>
                    <MetricWave color="#3B82F6" width={80} height={24} />
                  </View>
                </InteractiveTile>
              </View>
            </View>
          )}
        </Animated.View>

        {/* Controls: Search & Filter Tabs */}
        <View style={[styles.filterBar, { backgroundColor: colors.surface, borderColor: '#e2e8f0' }]}>
          <View style={[styles.searchBox, { borderColor: '#e2e8f0' }]}>
            <Search size={16} color={colors.textSecondary} />
            <TextInput
              placeholder="Search by name, email, or role..."
              placeholderTextColor={colors.textSecondary}
              value={search}
              onChangeText={setSearch}
              style={[styles.searchInput, { color: colors.text }]}
            />
          </View>

          {/* Role Filter Chips */}
          <View style={styles.chipRow}>
            {(['all', 'admin', 'hr', 'employee'] as const).map((r) => (
              <TouchableOpacity
                key={r}
                onPress={() => setRoleFilter(r)}
                style={[
                  styles.filterChip,
                  roleFilter === r
                    ? { backgroundColor: colors.primary }
                    : { backgroundColor: '#f1f5f9' },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: roleFilter === r ? '#FFF' : colors.text },
                  ]}
                >
                  {r === 'all' ? 'All Roles' : r === 'hr' ? 'HR' : String(r || '').charAt(0).toUpperCase() + String(r || '').slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Status Filter Chips */}
          <View style={styles.chipRow}>
            {(['all', 'active', 'inactive'] as const).map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => setStatusFilter(s)}
                style={[
                  styles.filterChip,
                  statusFilter === s
                    ? { backgroundColor: '#0b1c30' }
                    : { backgroundColor: '#f1f5f9' },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: statusFilter === s ? '#FFF' : colors.text },
                  ]}
                >
                  {String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Unit Filter Chips */}
          <View style={{ marginTop: 2 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
              {['all', ...availableUnits].map((u) => (
                <TouchableOpacity
                  key={u}
                  onPress={() => setUnitFilter(u)}
                  style={[
                    styles.filterChip,
                    { flexDirection: 'row', alignItems: 'center', gap: 6 },
                    unitFilter === u
                      ? { backgroundColor: '#0D7377' }
                      : { backgroundColor: '#f1f5f9' },
                  ]}
                >
                  <Building size={14} color={unitFilter === u ? '#FFF' : colors.textSecondary} />
                  <Text
                    style={[
                      styles.chipText,
                      { color: unitFilter === u ? '#FFF' : colors.text, fontWeight: '700' },
                    ]}
                  >
                    {u === 'all' ? 'All Units' : u}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Department Filter Chips */}
          {departments.length > 0 && (
            <View style={{ marginTop: 2 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
                {[{ id: 'all', name: 'All Departments' }, ...departments].map((dept) => (
                  <TouchableOpacity
                    key={dept.id}
                    onPress={() => setDeptFilter(dept.id)}
                    style={[
                      styles.filterChip,
                      { flexDirection: 'row', alignItems: 'center', gap: 6 },
                      deptFilter === dept.id
                        ? { backgroundColor: '#7C3AED' }
                        : { backgroundColor: '#f1f5f9' },
                    ]}
                  >
                    <Briefcase size={13} color={deptFilter === dept.id ? '#FFF' : colors.textSecondary} />
                    <Text
                      style={[
                        styles.chipText,
                        { color: deptFilter === dept.id ? '#FFF' : colors.text, fontWeight: '700' },
                      ]}
                    >
                      {dept.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Employment Category Filter Chips */}
          <View style={styles.chipRow}>
            {(['all', 'Regular', 'Contractual'] as const).map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => setEmpTypeFilter(c)}
                style={[
                  styles.filterChip,
                  empTypeFilter === c
                    ? { backgroundColor: '#4F46E5' }
                    : { backgroundColor: '#f1f5f9' },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: empTypeFilter === c ? '#FFF' : colors.text },
                  ]}
                >
                  {c === 'all' ? 'All Types' : c}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Floating Mass Action Bar */}
        {selectedUserIds.length > 0 && (
          <View style={[styles.floatingMassBar, { backgroundColor: '#0f172a', borderColor: '#334155' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ backgroundColor: '#0284c7', width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 13 }}>{selectedUserIds.length}</Text>
                </View>
                <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 14 }}>
                  {selectedUserIds.length} User{selectedUserIds.length > 1 ? 's' : ''} Selected for Mass Action
                </Text>
              </View>
              <TouchableOpacity
                onPress={clearSelection}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: '#1e293b' }}
              >
                <X size={14} color="#94a3b8" />
                <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <TouchableOpacity
                onPress={() => setMassModalType('unit')}
                style={[styles.massBtn, { backgroundColor: '#0D7377' }]}
                activeOpacity={0.85}
              >
                <Building size={14} color="#FFF" />
                <Text style={styles.massBtnText}>Change Unit / Location</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setMassTargetStatus('active');
                  setMassModalType('status');
                }}
                style={[styles.massBtn, { backgroundColor: '#059669' }]}
                activeOpacity={0.85}
              >
                <UserCheck size={14} color="#FFF" />
                <Text style={styles.massBtnText}>Activate / Deactivate</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setMassTargetDeptId(departments[0]?.id || null);
                  setMassModalType('dept');
                }}
                style={[styles.massBtn, { backgroundColor: '#7C3AED' }]}
                activeOpacity={0.85}
              >
                <Briefcase size={14} color="#FFF" />
                <Text style={styles.massBtnText}>Change Department</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setMassTargetShiftId(shifts[0]?.id || null);
                  setMassModalType('shift');
                }}
                style={[styles.massBtn, { backgroundColor: '#D97706' }]}
                activeOpacity={0.85}
              >
                <Clock size={14} color="#FFF" />
                <Text style={styles.massBtnText}>Assign Shift</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setMassTargetEmpType('Regular');
                  setMassModalType('category');
                }}
                style={[styles.massBtn, { backgroundColor: '#4F46E5' }]}
                activeOpacity={0.85}
              >
                <Award size={14} color="#FFF" />
                <Text style={styles.massBtnText}>Change Category</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

        {/* Users Table / Grid */}
        <View style={[styles.tableCard, { backgroundColor: 'transparent', borderColor: 'transparent', borderWidth: 0 }]}>
          <View style={[
            styles.tableHeader,
            {
              backgroundColor: '#FFFFFF',
              borderRadius: 14,
              borderWidth: 1,
              borderColor: '#E2E8F0',
              paddingHorizontal: 18,
              paddingVertical: 14,
              marginBottom: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            },
          ]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <TouchableOpacity
                onPress={toggleSelectAll}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}
                activeOpacity={0.7}
              >
                {isAllSelected ? (
                  <CheckSquare size={20} color="#7C3AED" />
                ) : isSomeSelected ? (
                  <MinusSquare size={20} color="#7C3AED" />
                ) : (
                  <Square size={20} color="#CBD5E1" />
                )}
                <Text style={[styles.tableTitle, { color: '#0F172A', fontSize: 16, fontWeight: '700' }]}>
                  {isAllSelected
                    ? `All ${filteredUsers.length} Selected`
                    : isSomeSelected
                      ? `${selectedUserIds.length} of ${filteredUsers.length} Selected`
                      : `User Accounts`}
                </Text>
                <View style={{ backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#64748B' }}>{filteredUsers.length}</Text>
                </View>
              </TouchableOpacity>

              {filteredUsers.length > (typeof pageSize === 'number' ? pageSize : 0) && (
                <TouchableOpacity
                  onPress={toggleSelectPage}
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 6,
                    backgroundColor: isPageSelected ? '#e0f2fe' : '#f1f5f9',
                    borderWidth: 1,
                    borderColor: isPageSelected ? '#38bdf8' : '#e2e8f0',
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 11, fontWeight: '600', color: isPageSelected ? '#0369a1' : colors.textSecondary }}>
                    {isPageSelected ? `Unselect Page (${paginatedUsers.length})` : `Select Page (${paginatedUsers.length})`}
                  </Text>
                </TouchableOpacity>
              )}

              {selectedUserIds.length > 0 && (
                <TouchableOpacity
                  onPress={clearSelection}
                  style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: '#f1f5f9' }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary }}>Clear Selection</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Rows Per Page Selector */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 12, color: colors.textSecondary, fontWeight: '500' }}>Per page:</Text>
              {[25, 50, 100, 'all' as const].map((size) => (
                <TouchableOpacity
                  key={String(size)}
                  onPress={() => setPageSize(size)}
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 6,
                    backgroundColor: pageSize === size ? colors.primary : '#f1f5f9',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '700',
                      color: pageSize === size ? '#ffffff' : colors.textSecondary,
                    }}
                  >
                    {size === 'all' ? 'All' : size}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {filteredUsers.length === 0 ? (
            <View style={styles.emptyState}>
              <Users size={36} color={colors.textSecondary} />
              <Text style={{ color: colors.textSecondary, fontWeight: '600', marginTop: 12 }}>
                No users found
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>
                {search ? `No accounts match "${search}"` : 'Try changing your role or status filters.'}
              </Text>
            </View>
          ) : (
            <View style={styles.userList}>
              {paginatedUsers.map((u, idx) => {
                const linkedEmp = empByProfileId.get(u.id) || (u as any).employee;
                const isSelected = selectedUserIdsSet.has(u.id);
                const isHhc = isShantiOrg && (!!u.is_hhc_enabled || !!linkedEmp?.is_hhc_enabled);
                const hhcRole = linkedEmp?.hhc_role || u.hhc_role || ((linkedEmp?.designation || '').toLowerCase().includes('dr') ? 'doctor' : 'field_worker');
                const hhcLabel = hhcRole === 'supervisor' ? 'HHC Supervisor' : hhcRole === 'doctor' ? 'HHC Doctor' : 'HHC Field';
                const roleCapitalized = u.role === 'admin' ? 'Admin' : u.role === 'hr' ? 'HR Manager' : (u.role as string) === 'supervisor' ? 'Supervisor' : 'Staff';
                const unitLabel = linkedEmp?.hospital_unit ? normalizeHospitalUnit(linkedEmp.hospital_unit) : (tenantOrg?.name || 'Headquarters');
                const empTypeLabel = linkedEmp?.employment_type ? normalizeEmploymentType(linkedEmp.employment_type) : 'Regular';
                const initials = getInitials(u.full_name || 'User');

                if (!isDesktop) {
                  return (
                    <TouchableOpacity
                      key={u.id}
                      activeOpacity={0.85}
                      onPress={() => setActionSheetUser(u)}
                      style={[
                        styles.modernMobileUserCard,
                        isSelected && styles.modernMobileUserCardSelected,
                        idx !== paginatedUsers.length - 1 && { marginBottom: 12 },
                      ]}
                    >
                      {/* Top Header Row: Checkbox, Avatar, Name & Role, Kebab */}
                      <View style={styles.mobileCardHeaderRow}>
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation?.();
                            toggleSelectUser(u.id);
                          }}
                          style={{ padding: 4 }}
                          activeOpacity={0.7}
                        >
                          {isSelected ? (
                            <CheckSquare size={19} color="#7C3AED" />
                          ) : (
                            <Square size={19} color="#94a3b8" />
                          )}
                        </TouchableOpacity>

                        {/* Avatar with Status Dot */}
                        <View style={{ position: 'relative' }}>
                          <View style={styles.mobileAvatarCircle}>
                            <Text style={styles.mobileAvatarText}>{initials}</Text>
                          </View>
                          <View
                            style={[
                              styles.avatarStatusBadge,
                              { backgroundColor: u.is_active ? '#10B981' : '#94A3B8' },
                            ]}
                          />
                        </View>

                        {/* Name and Contacts */}
                        <View style={{ flex: 1, minWidth: 0, paddingHorizontal: 6 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <Text style={[styles.cardNameText, { color: colors.text }]} numberOfLines={1}>
                              {u.full_name}
                            </Text>
                            <View style={styles.roleBadgeLavender}>
                              <Text style={styles.roleBadgeLavenderText}>{roleCapitalized}</Text>
                            </View>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
                            <Mail size={12} color="#64748B" />
                            <Text style={{ fontSize: 12, color: '#64748B' }} numberOfLines={1}>{u.email}</Text>
                          </View>
                          {u.phone && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
                              <Phone size={12} color="#64748B" />
                              <Text style={{ fontSize: 12, color: '#64748B' }} numberOfLines={1}>{u.phone}</Text>
                            </View>
                          )}
                        </View>

                        {/* Kebab Action Button */}
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation?.();
                            setActionSheetUser(u);
                          }}
                          style={styles.desktopMoreBtn}
                          activeOpacity={0.7}
                        >
                          <MoreHorizontal size={17} color="#0F172A" />
                        </TouchableOpacity>
                      </View>

                      {/* Middle Pills Row: Unit & Employment */}
                      <View style={styles.mobilePillsRow}>
                        <View style={styles.desktopUnitPill}>
                          <Text style={styles.desktopUnitPillText} numberOfLines={1}>{unitLabel}</Text>
                        </View>
                        <View style={styles.desktopEmpPill}>
                          <Text style={styles.desktopEmpPillText}>Full-Time</Text>
                        </View>
                        <View style={styles.desktopEmpPill}>
                          <Text style={styles.desktopEmpPillText}>{empTypeLabel}</Text>
                        </View>
                        {isHhc && (
                          <View style={[styles.desktopEmpPill, { backgroundColor: '#FAF5FF' }]}>
                            <Text style={[styles.desktopEmpPillText, { color: '#7C3AED', fontWeight: '700' }]}>{hhcLabel}</Text>
                          </View>
                        )}
                      </View>

                      {/* Footer Row: Code/Date and View Profile Button */}
                      <View style={styles.mobileCardFooterRow}>
                        <Text style={{ fontSize: 11.5, color: '#94A3B8', fontWeight: '500' }}>
                          {linkedEmp?.employee_code || `EMP-${u.id?.slice(0, 4)}`}
                          {u.created_at ? ` • Added ${formatDate(u.created_at)}` : ''}
                        </Text>
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation?.();
                            if (linkedEmp?.id) router.push(`/(hr)/employees/${linkedEmp.id}`);
                            else setActionSheetUser(u);
                          }}
                          style={styles.mobileViewProfileBtn}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.mobileViewProfileText}>View Profile</Text>
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  );
                }

                // Desktop Card (Matching Image 3 Exactly)
                return (
                  <View
                    key={u.id}
                    style={[
                      styles.modernDesktopUserCard,
                      isSelected && styles.modernDesktopUserCardSelected,
                      idx !== paginatedUsers.length - 1 && { marginBottom: 12 },
                    ]}
                  >
                    {/* 1. Checkbox */}
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation?.();
                        toggleSelectUser(u.id);
                      }}
                      style={{ padding: 4, marginRight: 6 }}
                      activeOpacity={0.7}
                    >
                      {isSelected ? (
                        <CheckSquare size={20} color="#7C3AED" />
                      ) : (
                        <Square size={20} color="#CBD5E1" />
                      )}
                    </TouchableOpacity>

                    {/* 2. Avatar with Status Dot */}
                    <View style={{ position: 'relative', marginRight: 4 }}>
                      <View style={styles.desktopAvatarCircle}>
                        <Text style={styles.desktopAvatarText}>{initials}</Text>
                      </View>
                      <View
                        style={[
                          styles.desktopStatusDot,
                          { backgroundColor: u.is_active ? '#22C55E' : '#94A3B8' },
                        ]}
                      />
                    </View>

                    {/* 3. Name & Contacts Column */}
                    <View style={styles.desktopUserCol}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={styles.desktopNameText} numberOfLines={1}>{u.full_name}</Text>
                        <View style={styles.roleBadgeLavender}>
                          <Text style={styles.roleBadgeLavenderText}>{roleCapitalized}</Text>
                        </View>
                        {isHhc && (
                          <View style={[styles.roleBadgeLavender, { backgroundColor: '#F5F3FF' }]}>
                            <Text style={[styles.roleBadgeLavenderText, { fontSize: 11 }]}>{hhcLabel}</Text>
                          </View>
                        )}
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <Mail size={13} color="#64748B" />
                        <Text style={styles.desktopContactText} numberOfLines={1}>{u.email}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <Phone size={13} color="#64748B" />
                        <Text style={styles.desktopContactText} numberOfLines={1}>{u.phone || '+91 98610 12345'}</Text>
                      </View>
                    </View>

                    {/* 4. Unit Column */}
                    <View style={styles.desktopUnitCol}>
                      <Text style={styles.desktopColHeader}>Unit</Text>
                      <View style={styles.desktopUnitPill}>
                        <Text style={styles.desktopUnitPillText} numberOfLines={1}>{unitLabel}</Text>
                      </View>
                    </View>

                    {/* 5. Employment Type Column */}
                    <View style={styles.desktopEmpCol}>
                      <Text style={styles.desktopColHeader}>Employment Type</Text>
                      <View style={{ gap: 4 }}>
                        <View style={styles.desktopEmpPill}>
                          <Text style={styles.desktopEmpPillText}>Full-Time</Text>
                        </View>
                        <View style={styles.desktopEmpPill}>
                          <Text style={styles.desktopEmpPillText}>{empTypeLabel}</Text>
                        </View>
                      </View>
                    </View>

                    {/* 6. Action Buttons Column */}
                    <View style={styles.desktopActionsCol}>
                      <TouchableOpacity
                        onPress={() => {
                          if (linkedEmp?.id) {
                            router.push(`/(hr)/employees/${linkedEmp.id}`);
                          } else {
                            setActionSheetUser(u);
                          }
                        }}
                        style={styles.desktopViewProfileBtn}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.desktopViewProfileText}>View Profile</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => setActionSheetUser(u)}
                        style={styles.desktopMoreBtn}
                        activeOpacity={0.8}
                      >
                        <MoreHorizontal size={18} color="#0F172A" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Pagination Navigation Bar */}
          {filteredUsers.length > 0 && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 14,
                paddingHorizontal: 16,
                backgroundColor: colors.surface,
                borderRadius: 12,
                marginTop: 12,
                borderWidth: 1,
                borderColor: '#e2e8f0',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: '500' }}>
                  Showing{' '}
                  <Text style={{ fontWeight: '700', color: colors.text }}>
                    {filteredUsers.length === 0 ? 0 : (currentPage - 1) * (pageSize === 'all' ? filteredUsers.length : Number(pageSize)) + 1}
                  </Text>
                  –
                  <Text style={{ fontWeight: '700', color: colors.text }}>
                    {pageSize === 'all'
                      ? filteredUsers.length
                      : Math.min(currentPage * Number(pageSize), filteredUsers.length)}
                  </Text>{' '}
                  of <Text style={{ fontWeight: '700', color: colors.text }}>{filteredUsers.length}</Text> employees
                </Text>
                {selectedUserIds.length > 0 && (
                  <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, backgroundColor: '#eff6ff' }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#2563eb' }}>
                      {selectedUserIds.length} selected
                    </Text>
                  </View>
                )}
              </View>

              {pageSize !== 'all' && totalPages > 1 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <TouchableOpacity
                    onPress={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    style={{
                      padding: 6,
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: '#e2e8f0',
                      opacity: currentPage === 1 ? 0.4 : 1,
                      backgroundColor: '#ffffff',
                    }}
                    accessibilityLabel="First page"
                  >
                    <ChevronsLeft size={16} color={colors.text} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    style={{
                      padding: 6,
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: '#e2e8f0',
                      opacity: currentPage === 1 ? 0.4 : 1,
                      backgroundColor: '#ffffff',
                    }}
                    accessibilityLabel="Previous page"
                  >
                    <ChevronLeft size={16} color={colors.text} />
                  </TouchableOpacity>

                  <View style={{ paddingHorizontal: 12, paddingVertical: 4 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>
                      Page {currentPage} of {totalPages}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    style={{
                      padding: 6,
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: '#e2e8f0',
                      opacity: currentPage === totalPages ? 0.4 : 1,
                      backgroundColor: '#ffffff',
                    }}
                    accessibilityLabel="Next page"
                  >
                    <ChevronRight size={16} color={colors.text} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    style={{
                      padding: 6,
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: '#e2e8f0',
                      opacity: currentPage === totalPages ? 0.4 : 1,
                      backgroundColor: '#ffffff',
                    }}
                    accessibilityLabel="Last page"
                  >
                    <ChevronsRight size={16} color={colors.text} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>

        {/* ── Modal: Add New User ─────────────────────────────────────────── */}
        <Modal visible={addModalOpen} onClose={() => setAddModalOpen(false)} title="Create New Account">
          {formSuccess ? (
            <View style={{ padding: 24, alignItems: 'center', gap: 12 }}>
              <CheckCircle2 size={48} color="#006a61" />
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>User Created Successfully!</Text>
              <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center' }}>
                {newFullName} can now sign in using {newEmail}.
              </Text>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 520 }} showsVerticalScrollIndicator={false}>
              <View style={{ gap: 14, paddingBottom: 16 }}>
                {formError ? (
                  <View style={[styles.alertBox, { backgroundColor: colors.dangerLight, borderColor: colors.danger + '40' }]}>
                    <AlertCircle size={16} color={colors.danger} />
                    <Text style={{ color: colors.danger, fontSize: 13, flex: 1 }}>{formError}</Text>
                  </View>
                ) : null}

                {/* Organization Info Banner (Fixed to Active Org to prevent cross-org employee creation) */}
                <View style={{ backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textSecondary, letterSpacing: 0.5 }}>ACTIVE ORGANIZATION</Text>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 2 }}>
                      {tenantOrg?.name || 'Company Workspace'}
                    </Text>
                  </View>
                  <View style={{ backgroundColor: '#E2E8F0', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#475569' }}>LOCKED</Text>
                  </View>
                </View>

                {/* Unified Unit / Sub-Brand (Geofenced Workplace) Selector */}
                <Select
                  label="Unit / Sub-Brand (Geofenced Workplace) *"
                  options={(() => {
                    if (workplaces.length > 0) {
                      return workplaces.map((w) => ({
                        label: `${w.name}${w.radius_meters ? ` (${w.radius_meters}m geofence)` : ''}${w.address ? ` — ${w.address}` : ''}`,
                        value: w.name,
                      }));
                    }
                    return getTenantDefaultUnits(tenantOrg?.name, tenantOrg?.id || currentAdmin?.organization_id).map((u) => ({ label: u, value: u }));
                  })()}
                  value={newHospitalUnit}
                  onValueChange={(val) => {
                    const chosen = val || (workplaces[0]?.name || 'Main Unit');
                    setNewHospitalUnit(chosen);
                    const matchedWp = workplaces.find((w) => w.name.toLowerCase() === chosen.toLowerCase());
                    if (matchedWp) {
                      setNewWorkplaceId(matchedWp.id);
                    }
                  }}
                />

                {/* Employment Category */}
                <Select
                  label="Employment Category *"
                  options={[
                    { label: 'Regular (Direct Payroll)', value: 'Regular' },
                    { label: 'Contractual (Contract / Outsource)', value: 'Contractual' },
                  ]}
                  value={newEmploymentType}
                  onValueChange={(val) => setNewEmploymentType(val || 'Regular')}
                />

                <Input
                  label="Grade / Band (e.g. M1, M2, N2, N4, Housekeeping)"
                  placeholder="e.g. M1"
                  value={newGrade}
                  onChangeText={setNewGrade}
                />

                <Input
                  label="Full Name *"
                  placeholder="e.g. Sarah Jenkins"
                  value={newFullName}
                  onChangeText={handleFullNameChange}
                />

                <Input
                  label="Work Email Address *"
                  placeholder="e.g. sarah.jenkins@company.com"
                  value={newEmail}
                  onChangeText={setNewEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <Input
                  label="Phone Number (used as default password) *"
                  placeholder="+91 98765 43210"
                  value={newPhone}
                  onChangeText={setNewPhone}
                  keyboardType="phone-pad"
                />

                {/* Role Selector */}
                <Select
                  label="Assign Role *"
                  options={
                    currentAdmin?.role === 'hr'
                      ? [
                        { label: 'Employee (Standard Access)', value: 'employee' },
                        { label: 'HR Manager (Full HR & Payroll Access)', value: 'hr' },
                      ]
                      : [
                        { label: 'Employee (Standard Access)', value: 'employee' },
                        { label: 'HR Manager (Full HR & Payroll Access)', value: 'hr' },
                        { label: 'Administrator (System & Org Settings)', value: 'admin' },
                      ]
                  }
                  value={newRole}
                  onValueChange={(val) => setNewRole(val as any)}
                />

                {/* Toggle: Also Create Employee Record */}
                <View style={[styles.switchCard, { backgroundColor: '#f8faff', borderColor: '#e2e8f0' }]}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                      Create Employee Profile
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                      Enables attendance clock-in, leave quotas, and salary payslips.
                    </Text>
                  </View>
                  <Switch
                    value={createEmpRecord}
                    onValueChange={setCreateEmpRecord}
                    trackColor={{ true: colors.primary }}
                  />
                </View>

                {createEmpRecord && (
                  <View style={[styles.empFieldsBox, { borderColor: '#e2e8f0' }]}>
                    <Input
                      label="Employee Code *"
                      value={newEmpCode}
                      onChangeText={setNewEmpCode}
                      rightElement={
                        <TouchableOpacity
                          onPress={() => setNewEmpCode(generateRandomCode())}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                            paddingHorizontal: 10,
                            backgroundColor: '#E6F4F4',
                            borderLeftWidth: 1,
                            borderLeftColor: '#CBD5E1',
                            alignSelf: 'stretch',
                            justifyContent: 'center',
                          }}
                          activeOpacity={0.7}
                        >
                          <RefreshCw size={13} color="#0D7377" />
                          <Text style={{ fontSize: 12, fontWeight: '700', color: '#0D7377' }}>Random</Text>
                        </TouchableOpacity>
                      }
                    />

                    <Input
                      label="Designation / Job Title"
                      placeholder="e.g. Senior Software Engineer"
                      value={newDesignation}
                      onChangeText={setNewDesignation}
                    />

                    <Input
                      label="Date of Birth (YYYY-MM-DD)"
                      placeholder="e.g. 1990-01-01"
                      value={newDob}
                      onChangeText={setNewDob}
                    />

                    <Select
                      label="Department"
                      options={departments.map((d) => ({ label: d.name, value: d.id }))}
                      value={newDeptId}
                      onValueChange={handleDeptChange}
                    />

                    <Select
                      label="Reporting Manager"
                      options={managers.map((m) => ({ label: m.profile?.full_name || m.employee_code || 'Unknown', value: m.id }))}
                      value={newManagerId}
                      onValueChange={setNewManagerId}
                    />

                    <Select
                      label="Default Shift (For Attendance)"
                      placeholder="Select a shift..."
                      options={shifts.map((s) => ({ label: `${s.name} (${s.start_time} - ${s.end_time})`, value: s.id }))}
                      value={newShiftId || ''}
                      onValueChange={(val) => setNewShiftId(val || null)}
                    />

                    <Select
                      label="Employment Type"
                      options={[
                        { label: 'Full Time (Permanent)', value: 'full_time' },
                        { label: 'Part Time', value: 'part_time' },
                        { label: 'Contract / Consultant', value: 'contract' },
                        { label: 'Intern / Trainee', value: 'intern' },
                      ]}
                      value={newEmploymentType}
                      onValueChange={(val) => setNewEmploymentType(val || 'full_time')}
                    />

                    <Input
                      label="Basic Monthly Salary (₹/$)"
                      placeholder="50000"
                      value={newSalary}
                      onChangeText={setNewSalary}
                      keyboardType="numeric"
                    />

                    {/* Statutory & Tax Deduction Configuration */}
                    <View style={{ marginTop: 8, padding: 12, backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', gap: 12 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>
                        Custom Statutory & Tax Deductions
                      </Text>

                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <View style={{ flex: 1 }}>
                          <Input
                            label="EPF / PF Rate (%)"
                            placeholder="12"
                            value={newEpfPercentage}
                            onChangeText={setNewEpfPercentage}
                            keyboardType="numeric"
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Input
                            label="SOCSO / Ins. (%)"
                            placeholder="0.5"
                            value={newSocsoPercentage}
                            onChangeText={setNewSocsoPercentage}
                            keyboardType="numeric"
                          />
                        </View>
                      </View>

                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                        <View style={{ flex: 1 }}>
                          <Input
                            label="ESI Number (10 digits)"
                            placeholder="e.g. 1234567890"
                            value={newEsi}
                            onChangeText={setNewEsi}
                            keyboardType="numeric"
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Input
                            label="UAN Number (12 digits)"
                            placeholder="e.g. 100000000000"
                            value={newUan}
                            onChangeText={setNewUan}
                            keyboardType="numeric"
                          />
                        </View>
                      </View>

                      <View style={[styles.switchCard, { backgroundColor: '#fff', borderColor: '#e2e8f0', marginTop: 5 }]}>
                        <View style={{ flex: 1, paddingRight: 10 }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
                            ESI Exempt
                          </Text>
                          <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                            Toggle if this employee is exempt from ESI
                          </Text>
                        </View>
                        <Switch
                          value={newEsiExempt}
                          onValueChange={setNewEsiExempt}
                          trackColor={{ true: colors.primary }}
                        />
                      </View>

                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <View style={{ flex: 1 }}>
                          <Input
                            label="Tax / TDS Deduction (%)"
                            placeholder="5"
                            value={newTaxPercentage}
                            onChangeText={setNewTaxPercentage}
                            keyboardType="numeric"
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Input
                            label="Housing (HRA) (%)"
                            placeholder="40"
                            value={newHraPercentage}
                            onChangeText={setNewHraPercentage}
                            keyboardType="numeric"
                          />
                        </View>
                      </View>

                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <View style={{ flex: 1 }}>
                          <Input
                            label="Conveyance Allowance (₹)"
                            placeholder="1200"
                            value={newConveyanceAllowance}
                            onChangeText={setNewConveyanceAllowance}
                            keyboardType="numeric"
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Input
                            label="Washing Allowance (₹)"
                            placeholder="500"
                            value={newWashingAllowance}
                            onChangeText={setNewWashingAllowance}
                            keyboardType="numeric"
                          />
                        </View>
                      </View>

                      <Input
                        label="Special Allowance (₹) (Optional - auto balances if left blank)"
                        placeholder="e.g. 13300"
                        value={newSpecialAllowance}
                        onChangeText={setNewSpecialAllowance}
                        keyboardType="numeric"
                      />

                      {/* Custom Bonuses, Deductions & Allowances with Icon Selector */}
                      <CustomPayrollItemsManager
                        items={newCustomItems}
                        onChange={setNewCustomItems}
                        basicSalary={parseFloat(newSalary) || 0}
                      />
                    </View>
                  </View>
                )}

                <View style={styles.modalActions}>
                  <Button
                    title="Cancel"
                    onPress={() => setAddModalOpen(false)}
                    variant="outline"
                    style={{ flex: 1, borderRadius: 8 }}
                  />
                  <Button
                    title="Create Account"
                    onPress={handleCreateUser}
                    loading={savingUser}
                    style={{ flex: 2, backgroundColor: colors.primary, borderRadius: 8 }}
                  />
                </View>
              </View>
            </ScrollView>
          )}
        </Modal>

        {/* ── Modal: Edit User & Employee ─────────────────────────────────── */}
        <Modal visible={!!editUser} onClose={() => setEditUser(null)} title="Edit User & Employee Profile">
          <ScrollView style={{ maxHeight: 520, paddingRight: 4 }}>
            <View style={{ gap: 14 }}>
              {editError ? (
                <View style={[styles.alertBox, { backgroundColor: colors.dangerLight, borderColor: colors.danger + '40' }]}>
                  <AlertCircle size={16} color={colors.danger} />
                  <Text style={{ color: colors.danger, fontSize: 13, flex: 1 }}>{editError}</Text>
                </View>
              ) : null}

              <Text style={[styles.formSubHeader, { color: colors.textSecondary }]}>Account & Profile</Text>

              <Input
                label="Full Name *"
                value={editFullName}
                onChangeText={setEditFullName}
                placeholder="Full name"
              />

              <Input
                label="Phone Number"
                value={editPhone}
                onChangeText={setEditPhone}
                placeholder="+91 98765 43210"
                keyboardType="phone-pad"
              />

              <Select
                label="System Role"
                options={
                  currentAdmin?.role === 'hr'
                    ? [
                      { label: 'Employee (Standard Access)', value: 'employee' },
                      { label: 'HR Manager (Full HR & Payroll Access)', value: 'hr' },
                    ]
                    : [
                      { label: 'Employee (Standard Access)', value: 'employee' },
                      { label: 'HR Manager (Full HR & Payroll Access)', value: 'hr' },
                      { label: 'Administrator (System & Org Settings)', value: 'admin' },
                    ]
                }
                value={editRole}
                onValueChange={(val) => setEditRole(val as any)}
              />

              <View style={{ gap: 14, marginTop: 6 }}>
                <Text style={[styles.formSubHeader, { color: colors.textSecondary }]}>Employee & Job Assignment</Text>

                <Input
                  label="Employee Code"
                  value={editEmpCode}
                  onChangeText={setEditEmpCode}
                  placeholder="e.g. EMP-1001"
                />

                <Input
                  label="Designation / Job Title"
                  value={editDesignation}
                  onChangeText={setEditDesignation}
                  placeholder="e.g. Senior Software Engineer"
                />

                <Select
                  label="Department"
                  options={[
                    { label: 'None / Unassigned', value: '' },
                    ...departments.map((d) => ({ label: d.name, value: d.id })),
                  ]}
                  value={editDeptId}
                  onValueChange={handleDeptChangeEdit}
                />

                <Select
                  label="Reporting Manager"
                  options={[
                    { label: 'None / Top Level', value: '' },
                    ...managers
                      .filter(m => m.profile_id !== editUser?.id)
                      .map((m) => ({
                        label: m.profile?.full_name || m.employee_code || 'Unknown',
                        value: m.id,
                      })),
                  ]}
                  value={editManagerId}
                  onValueChange={setEditManagerId}
                />

                <Select
                  label="Default Shift (For Attendance)"
                  options={[
                    { label: 'Standard / Unset', value: '' },
                    ...shifts.map((s) => ({
                      label: `${s.name} (${s.start_time} - ${s.end_time})`,
                      value: s.id,
                    })),
                  ]}
                  value={editShiftId || ''}
                  onValueChange={(val) => setEditShiftId(val || null)}
                />

                <Input
                  label="Date of Birth (YYYY-MM-DD)"
                  placeholder="e.g. 1990-01-01"
                  value={editDob}
                  onChangeText={setEditDob}
                />

                {/* Unified Unit / Sub-Brand (Geofenced Workplace) Selector */}
                <Select
                  label="Unit / Sub-Brand (Geofenced Workplace) *"
                  options={(() => {
                    if (workplaces.length > 0) {
                      return workplaces.map((w) => ({
                        label: `${w.name}${w.radius_meters ? ` (${w.radius_meters}m geofence)` : ''}${w.address ? ` — ${w.address}` : ''}`,
                        value: w.name,
                      }));
                    }
                    return getTenantDefaultUnits(tenantOrg?.name, tenantOrg?.id || currentAdmin?.organization_id).map((u) => ({ label: u, value: u }));
                  })()}
                  value={editHospitalUnit}
                  onValueChange={(val) => {
                    const chosen = val || (workplaces[0]?.name || 'Main Unit');
                    setEditHospitalUnit(chosen);
                    const matchedWp = workplaces.find((w) => w.name.toLowerCase() === chosen.toLowerCase());
                    if (matchedWp) {
                      setEditWorkplaceId(matchedWp.id);
                    }
                  }}
                />

                <Select
                  label="Employment Category *"
                  options={[
                    { label: 'Regular (Direct Payroll)', value: 'Regular' },
                    { label: 'Contractual (Contract / Outsource)', value: 'Contractual' },
                  ]}
                  value={normalizeEmploymentType(editEmploymentType)}
                  onValueChange={(val) => setEditEmploymentType(val || 'Regular')}
                />

                <Input
                  label="Grade / Band (e.g. M1, M2, N2, N4, Housekeeping)"
                  placeholder="e.g. M1"
                  value={editGrade}
                  onChangeText={setEditGrade}
                />

                <Input
                  label="Basic Monthly Salary (₹/$)"
                  value={editSalary}
                  onChangeText={setEditSalary}
                  placeholder="50000"
                  keyboardType="numeric"
                />

                {/* Custom Statutory & Tax Deductions */}
                <View style={{ marginTop: 6, padding: 12, backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', gap: 12 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>
                    Custom Statutory & Tax Deductions
                  </Text>

                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Input
                        label="EPF / PF Rate (%)"
                        placeholder="12"
                        value={editEpfPercentage}
                        onChangeText={setEditEpfPercentage}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Input
                        label="SOCSO / Ins. (%)"
                        placeholder="0.5"
                        value={editSocsoPercentage}
                        onChangeText={setEditSocsoPercentage}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Input
                        label="ESI Number (10 digits)"
                        placeholder="e.g. 1234567890"
                        value={editEsi}
                        onChangeText={setEditEsi}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Input
                        label="UAN Number (12 digits)"
                        placeholder="e.g. 100000000000"
                        value={editUan}
                        onChangeText={setEditUan}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>

                  <View style={[styles.switchCard, { backgroundColor: '#fff', borderColor: '#e2e8f0', marginTop: 5, padding: 10 }]}>
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
                        ESI Exempt
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                        Toggle if this employee is exempt from ESI
                      </Text>
                    </View>
                    <Switch
                      value={editEsiExempt}
                      onValueChange={setEditEsiExempt}
                      trackColor={{ true: colors.primary }}
                    />
                  </View>

                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Input
                        label="Tax / TDS Rate (%)"
                        placeholder="5"
                        value={editTaxPercentage}
                        onChangeText={setEditTaxPercentage}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Input
                        label="Housing (HRA) (%)"
                        placeholder="40"
                        value={editHraPercentage}
                        onChangeText={setEditHraPercentage}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Input
                        label="Conveyance Allowance (₹)"
                        placeholder="1200"
                        value={editConveyanceAllowance}
                        onChangeText={setEditConveyanceAllowance}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Input
                        label="Washing Allowance (₹)"
                        placeholder="500"
                        value={editWashingAllowance}
                        onChangeText={setEditWashingAllowance}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>

                  <Input
                    label="Special Allowance (₹) (Optional - auto balances if left blank)"
                    placeholder="e.g. 13300"
                    value={editSpecialAllowance}
                    onChangeText={setEditSpecialAllowance}
                    keyboardType="numeric"
                  />

                  {/* Custom Bonuses, Deductions & Allowances with Icon Selector */}
                  <CustomPayrollItemsManager
                    items={editCustomItems}
                    onChange={setEditCustomItems}
                    basicSalary={parseFloat(editSalary) || 0}
                  />
                </View>

                <Select
                  label="Employment Status"
                  options={[
                    { label: 'Active', value: 'active' },
                    { label: 'On Leave', value: 'on_leave' },
                    { label: 'Suspended', value: 'suspended' },
                    { label: 'Terminated', value: 'terminated' },
                  ]}
                  value={editStatus}
                  onValueChange={(val) => setEditStatus(val || 'active')}
                />

                {/* Healthcare & HHC Role Configuration (Shanti Hospital Only) */}
                {isShantiOrg && (
                  <HhcRoleSelector
                    enabled={editIsHhcEnabled}
                    onEnabledChange={setEditIsHhcEnabled}
                    role={editHhcRole}
                    onRoleChange={setEditHhcRole}
                    colors={colors}
                  />
                )}
              </View>

              <View style={[styles.modalActions, { marginTop: 16, marginBottom: 12 }]}>
                <Button
                  title="Cancel"
                  onPress={() => setEditUser(null)}
                  variant="outline"
                  style={{ flex: 1, borderRadius: 8 }}
                />
                <Button
                  title={savingEdit ? 'Saving...' : 'Save Changes'}
                  onPress={handleSaveEdit}
                  loading={savingEdit}
                  style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 8 }}
                />
              </View>
            </View>
          </ScrollView>
        </Modal>

        {/* ── Modal: Set Leave Quotas ────────────────────────────────────────── */}
        <Modal
          visible={!!leaveUser}
          onClose={() => setLeaveUser(null)}
          title={`Set Leave Quotas for ${leaveUser?.full_name || 'Staff'}`}
        >
          <ScrollView style={{ maxHeight: 480 }}>
            <View style={{ gap: 14 }}>
              {leaveSuccessBanner ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#D1FAE5', padding: 10, borderRadius: 8, gap: 6 }}>
                  <CheckCircle2 size={16} color="#059669" />
                  <Text style={{ color: '#065F46', fontSize: 13, fontWeight: '600' }}>{leaveSuccessBanner}</Text>
                </View>
              ) : null}

              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                Configure the annual allocated days for each leave category for {leaveUser?.full_name}.
              </Text>

              {userLeaveTypes.map((lt) => (
                <Input
                  key={lt.id}
                  label={`${lt.name} (Days per Year)`}
                  value={customLeaveQuotas[lt.id] || ''}
                  onChangeText={(val) => setCustomLeaveQuotas((prev) => ({ ...prev, [lt.id]: val }))}
                  placeholder={String(lt.annual_days || 12)}
                  keyboardType="numeric"
                />
              ))}

              <View style={styles.modalActions}>
                <Button
                  title="Cancel"
                  onPress={() => setLeaveUser(null)}
                  variant="outline"
                  style={{ flex: 1, borderRadius: 8 }}
                />
                <Button
                  title={savingLeaveQuotas ? 'Saving...' : 'Save Leave Quotas'}
                  onPress={handleSaveAdminLeaveQuotas}
                  loading={savingLeaveQuotas}
                  style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 8 }}
                />
              </View>
            </View>
          </ScrollView>
        </Modal>

        {/* ── Dialog: Confirm Deactivation / Activation ────────────────────── */}
        <ConfirmDialog
          visible={!!toggleUser}
          title={toggleUser?.is_active ? 'Deactivate User Account?' : 'Activate User Account?'}
          message={
            toggleUser?.is_active
              ? `Are you sure you want to deactivate ${toggleUser?.full_name}? They will not be able to log in until reactivated.`
              : `Activate ${toggleUser?.full_name}'s account and restore login access?`
          }
          confirmLabel={toggleUser?.is_active ? 'Yes, Deactivate' : 'Yes, Activate'}
          onConfirm={handleToggle}
          onCancel={() => setToggleUser(null)}
          loading={processing}
          variant={toggleUser?.is_active ? 'danger' : 'primary'}
        />

        {/* ── Dialog: Confirm Permanent Account Deletion ──────────────────── */}
        <ConfirmDialog
          visible={!!deleteUser}
          title="Permanently Delete User Account?"
          message={`Are you sure you want to permanently delete ${deleteUser?.full_name} (${deleteUser?.email})? This action removes their access and linked employee profile records permanently.`}
          confirmLabel="Yes, Delete Account"
          onConfirm={handleDeleteUser}
          onCancel={() => setDeleteUser(null)}
          loading={processing}
          variant="danger"
        />

        {/* ── Modal: Tap-to-Select Operation Action Sheet (Mobile) ────────── */}
        <Modal
          visible={!!actionSheetUser}
          onClose={() => setActionSheetUser(null)}
          title="Select Operation"
        >
          {actionSheetUser && (
            <View style={{ gap: 14 }}>
              {/* Target User Summary Card */}
              <View style={[styles.actionSheetHeaderCard, { backgroundColor: '#F8FAFC', borderColor: colors.border }]}>
                <Avatar
                  name={actionSheetUser.full_name || 'U'}
                  url={actionSheetUser.avatar_url}
                  size={42}
                />
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
                      {actionSheetUser.full_name}
                    </Text>
                    <Badge
                      label={String(actionSheetUser.role || 'employee').toUpperCase()}
                      variant={getRoleBadgeVariant(actionSheetUser.role)}
                    />
                    <Badge
                      label={actionSheetUser.is_active ? 'ACTIVE' : 'INACTIVE'}
                      variant={actionSheetUser.is_active ? 'successLight' : 'dangerLight'}
                    />
                  </View>
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                    {actionSheetUser.email}
                  </Text>
                  {actionSheetUser.phone && (
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                      {actionSheetUser.phone}
                    </Text>
                  )}
                </View>
              </View>

              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>
                Select Operation
              </Text>

              {/* Operations List */}
              <View style={{ gap: 8 }}>
                {/* 1. View Employee Profile (if linked employee exists) */}
                {(() => {
                  const emp = empByProfileId.get(actionSheetUser.id) || (actionSheetUser as any).employee;
                  if (!emp?.id) return null;
                  return (
                    <TouchableOpacity
                      style={styles.operationRow}
                      onPress={() => {
                        const targetId = emp.id;
                        setActionSheetUser(null);
                        router.push(`/(hr)/employees/${targetId}`);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.opIconWrap, { backgroundColor: '#EEF2FF' }]}>
                        <Eye size={18} color="#4F46E5" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.opTitle, { color: colors.text }]}>View Full Profile</Text>
                        <Text style={[styles.opSubtitle, { color: colors.textSecondary }]}>
                          Review employee record, documents & details
                        </Text>
                      </View>
                      <ChevronRight size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                  );
                })()}

                {/* 2. Resend Welcome Invitation */}
                <TouchableOpacity
                  style={styles.operationRow}
                  onPress={() => {
                    const u = actionSheetUser;
                    setActionSheetUser(null);
                    handleResendInvite(u);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.opIconWrap, { backgroundColor: '#EEF2FF' }]}>
                    <Mail size={18} color="#4F46E5" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.opTitle, { color: colors.text }]}>Send Welcome Invitation</Text>
                    <Text style={[styles.opSubtitle, { color: colors.textSecondary }]}>
                      Email login credentials and access instructions
                    </Text>
                  </View>
                  <ChevronRight size={18} color={colors.textSecondary} />
                </TouchableOpacity>

                {/* 2b. Letter of Appointment (PDF & Email) */}
                <TouchableOpacity
                  style={styles.operationRow}
                  onPress={() => {
                    const u = actionSheetUser;
                    setActionSheetUser(null);
                    setAppointmentLetterUser(u);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.opIconWrap, { backgroundColor: '#F0F9FF' }]}>
                    <FileText size={18} color="#0284C7" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.opTitle, { color: colors.text }]}>Letter of Appointment</Text>
                    <Text style={[styles.opSubtitle, { color: colors.textSecondary }]}>
                      Resend appointment letter in email or download PDF
                    </Text>
                  </View>
                  <ChevronRight size={18} color={colors.textSecondary} />
                </TouchableOpacity>

                {/* 3. Edit User Details & Role */}
                <TouchableOpacity
                  style={styles.operationRow}
                  onPress={() => {
                    const u = actionSheetUser;
                    setActionSheetUser(null);
                    openEditModal(u);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.opIconWrap, { backgroundColor: '#F0F9FF' }]}>
                    <Edit2 size={18} color="#0284C7" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.opTitle, { color: colors.text }]}>Edit Account & Role</Text>
                    <Text style={[styles.opSubtitle, { color: colors.textSecondary }]}>
                      Update designation, department, compensation & role
                    </Text>
                  </View>
                  <ChevronRight size={18} color={colors.textSecondary} />
                </TouchableOpacity>

                {/* 4. Manage Leave Quotas */}
                <TouchableOpacity
                  style={styles.operationRow}
                  onPress={() => {
                    const u = actionSheetUser;
                    setActionSheetUser(null);
                    openLeaveModalForUser(u);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.opIconWrap, { backgroundColor: '#F0F9F8' }]}>
                    <Umbrella size={18} color="#0D7377" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.opTitle, { color: colors.text }]}>Manage Leave Balances</Text>
                    <Text style={[styles.opSubtitle, { color: colors.textSecondary }]}>
                      Adjust annual leaves, quotas & policy balances
                    </Text>
                  </View>
                  <ChevronRight size={18} color={colors.textSecondary} />
                </TouchableOpacity>

                {/* 5. Reset Password */}
                <TouchableOpacity
                  style={styles.operationRow}
                  onPress={() => {
                    const email = actionSheetUser.email;
                    setActionSheetUser(null);
                    handleResetPassword(email);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.opIconWrap, { backgroundColor: '#F8FAFC' }]}>
                    <KeyRound size={18} color="#64748B" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.opTitle, { color: colors.text }]}>Reset Password</Text>
                    <Text style={[styles.opSubtitle, { color: colors.textSecondary }]}>
                      Issue temporary credentials or reset access
                    </Text>
                  </View>
                  <ChevronRight size={18} color={colors.textSecondary} />
                </TouchableOpacity>

                {/* 6. Toggle Active Status */}
                <TouchableOpacity
                  style={styles.operationRow}
                  onPress={() => {
                    const u = actionSheetUser;
                    setActionSheetUser(null);
                    setToggleUser(u);
                  }}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.opIconWrap,
                      { backgroundColor: actionSheetUser.is_active ? '#FFF1F2' : '#F0FDF4' },
                    ]}
                  >
                    {actionSheetUser.is_active ? (
                      <UserX size={18} color="#E11D48" />
                    ) : (
                      <UserCheck size={18} color="#16A34A" />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.opTitle,
                        { color: actionSheetUser.is_active ? '#E11D48' : '#16A34A' },
                      ]}
                    >
                      {actionSheetUser.is_active ? 'Deactivate User Account' : 'Reactivate User Account'}
                    </Text>
                    <Text style={[styles.opSubtitle, { color: colors.textSecondary }]}>
                      {actionSheetUser.is_active
                        ? 'Temporarily disable portal login access'
                        : 'Restore user login access to Oasis'}
                    </Text>
                  </View>
                  <ChevronRight size={18} color={colors.textSecondary} />
                </TouchableOpacity>

                {/* 7. Delete User Record */}
                <TouchableOpacity
                  style={[styles.operationRow, { borderColor: '#FEE2E2', backgroundColor: '#FFF5F5' }]}
                  onPress={() => {
                    const u = actionSheetUser;
                    setActionSheetUser(null);
                    setDeleteUser(u);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.opIconWrap, { backgroundColor: '#FEE2E2' }]}>
                    <Trash2 size={18} color="#DC2626" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.opTitle, { color: '#DC2626' }]}>Permanently Delete Account</Text>
                    <Text style={[styles.opSubtitle, { color: '#991B1B' }]}>
                      Remove user profile and linked records permanently
                    </Text>
                  </View>
                  <ChevronRight size={18} color="#DC2626" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.opCancelBtn, { borderColor: colors.border }]}
                onPress={() => setActionSheetUser(null)}
              >
                <Text style={[styles.opCancelBtnText, { color: colors.textSecondary }]}>Close</Text>
              </TouchableOpacity>
            </View>
          )}
        </Modal>

        {/* Letter of Appointment Modal (PDF & Email Format) */}
        <AppointmentLetterModal
          visible={!!appointmentLetterUser}
          onClose={() => setAppointmentLetterUser(null)}
          profile={appointmentLetterUser}
          employee={
            appointmentLetterUser
              ? (empByProfileId.get(appointmentLetterUser.id) || (appointmentLetterUser as any).employee || null)
              : null
          }
          organization={tenantOrg}
          onSuccess={(msg) => {
            setInfoBanner({ type: 'success', message: msg });
            setTimeout(() => setInfoBanner(null), 5000);
          }}
        />

        {/* ---------------------------------------------------- */}
        {/* MASS ACTION MODALS */}
        {/* ---------------------------------------------------- */}

        {/* Mass Change Unit Modal */}
        <Modal
          visible={massModalType === 'unit'}
          onClose={() => setMassModalType('none')}
          title="Mass Change Unit / Location"
        >
          <View style={{ gap: 16 }}>
            <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 20 }}>
              Reassign <Text style={{ fontWeight: '700', color: colors.text }}>{selectedUserIds.length} selected users</Text> to a new unit or sub-brand location. This will update their primary employee record and linked workplace.
            </Text>

            <Select
              label="Target Unit / Sub-Brand"
              value={massTargetUnit}
              options={
                workplaces.length > 0
                  ? workplaces.map((w) => ({
                      label: w.address ? `${w.name} (${w.address})` : w.name,
                      value: w.name,
                    }))
                  : availableUnits.map((u) => ({ label: u, value: u }))
              }
              onValueChange={(val: string) => val && setMassTargetUnit(val)}
            />

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setMassModalType('none')}
                style={{ flex: 1 }}
                disabled={massProcessing}
              />
              <Button
                title={massProcessing ? 'Applying...' : `Apply to ${selectedUserIds.length} Users`}
                onPress={handleMassApply}
                loading={massProcessing}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </Modal>

        {/* Mass Activate / Deactivate Modal */}
        <Modal
          visible={massModalType === 'status'}
          onClose={() => setMassModalType('none')}
          title="Mass Change User Status"
        >
          <View style={{ gap: 16 }}>
            <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 20 }}>
              Update access status for <Text style={{ fontWeight: '700', color: colors.text }}>{selectedUserIds.length} selected users</Text>.
            </Text>

            <View style={{ gap: 10 }}>
              <TouchableOpacity
                onPress={() => setMassTargetStatus('active')}
                style={[
                  styles.operationRow,
                  massTargetStatus === 'active' && { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
                ]}
              >
                <View style={[styles.opIconWrap, { backgroundColor: '#dcfce7' }]}>
                  <UserCheck size={18} color="#16a34a" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.opTitle, { color: '#16a34a' }]}>Activate Accounts</Text>
                  <Text style={[styles.opSubtitle, { color: colors.textSecondary }]}>
                    Restore login access and set employment status to Active
                  </Text>
                </View>
                {massTargetStatus === 'active' && <Check size={18} color="#16a34a" />}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setMassTargetStatus('inactive')}
                style={[
                  styles.operationRow,
                  massTargetStatus === 'inactive' && { borderColor: '#e11d48', backgroundColor: '#fff1f2' },
                ]}
              >
                <View style={[styles.opIconWrap, { backgroundColor: '#ffe4e6' }]}>
                  <UserX size={18} color="#e11d48" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.opTitle, { color: '#e11d48' }]}>Deactivate / Suspend Accounts</Text>
                  <Text style={[styles.opSubtitle, { color: colors.textSecondary }]}>
                    Disable portal login access and mark account inactive
                  </Text>
                </View>
                {massTargetStatus === 'inactive' && <Check size={18} color="#e11d48" />}
              </TouchableOpacity>
            </View>

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setMassModalType('none')}
                style={{ flex: 1 }}
                disabled={massProcessing}
              />
              <Button
                title={massProcessing ? 'Applying...' : `Confirm for ${selectedUserIds.length} Users`}
                onPress={handleMassApply}
                loading={massProcessing}
                variant={massTargetStatus === 'active' ? 'primary' : 'danger'}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </Modal>

        {/* Mass Change Department Modal */}
        <Modal
          visible={massModalType === 'dept'}
          onClose={() => setMassModalType('none')}
          title="Mass Transfer Department"
        >
          <View style={{ gap: 16 }}>
            <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 20 }}>
              Transfer <Text style={{ fontWeight: '700', color: colors.text }}>{selectedUserIds.length} selected users</Text> to a new departmental division.
            </Text>

            <Select
              label="Target Department"
              value={massTargetDeptId}
              options={departments.map((d) => ({ label: d.name, value: d.id }))}
              onValueChange={(val: string) => setMassTargetDeptId(val)}
            />

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setMassModalType('none')}
                style={{ flex: 1 }}
                disabled={massProcessing}
              />
              <Button
                title={massProcessing ? 'Transferring...' : `Transfer ${selectedUserIds.length} Users`}
                onPress={handleMassApply}
                loading={massProcessing}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </Modal>

        {/* Mass Assign Shift Modal */}
        <Modal
          visible={massModalType === 'shift'}
          onClose={() => setMassModalType('none')}
          title="Mass Assign Shift"
        >
          <View style={{ gap: 16 }}>
            <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 20 }}>
              Assign work shift timing and roster schedule to <Text style={{ fontWeight: '700', color: colors.text }}>{selectedUserIds.length} selected users</Text>.
            </Text>

            <Select
              label="Select Work Shift"
              value={massTargetShiftId}
              options={shifts.map((s) => ({ label: `${s.name} (${s.start_time} - ${s.end_time})`, value: s.id }))}
              onValueChange={(val: string) => setMassTargetShiftId(val)}
            />

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setMassModalType('none')}
                style={{ flex: 1 }}
                disabled={massProcessing}
              />
              <Button
                title={massProcessing ? 'Assigning...' : `Assign to ${selectedUserIds.length} Users`}
                onPress={handleMassApply}
                loading={massProcessing}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </Modal>

        {/* Mass Change Category Modal */}
        <Modal
          visible={massModalType === 'category'}
          onClose={() => setMassModalType('none')}
          title="Mass Change Employment Category"
        >
          <View style={{ gap: 16 }}>
            <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 20 }}>
              Switch employment classification for <Text style={{ fontWeight: '700', color: colors.text }}>{selectedUserIds.length} selected users</Text>.
            </Text>

            <View style={{ gap: 10 }}>
              <TouchableOpacity
                onPress={() => setMassTargetEmpType('Regular')}
                style={[
                  styles.operationRow,
                  massTargetEmpType === 'Regular' && { borderColor: '#4F46E5', backgroundColor: '#EEF2FF' },
                ]}
              >
                <View style={[styles.opIconWrap, { backgroundColor: '#EEF2FF' }]}>
                  <Award size={18} color="#4F46E5" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.opTitle, { color: '#4F46E5' }]}>Regular (Full-time / Statutory PF & ESI)</Text>
                  <Text style={[styles.opSubtitle, { color: colors.textSecondary }]}>
                    Full employment rights, statutory benefits & regular roster
                  </Text>
                </View>
                {massTargetEmpType === 'Regular' && <Check size={18} color="#4F46E5" />}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setMassTargetEmpType('Contractual')}
                style={[
                  styles.operationRow,
                  massTargetEmpType === 'Contractual' && { borderColor: '#D97706', backgroundColor: '#FEF3C7' },
                ]}
              >
                <View style={[styles.opIconWrap, { backgroundColor: '#FEF3C7' }]}>
                  <Briefcase size={18} color="#D97706" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.opTitle, { color: '#D97706' }]}>Contractual (Consultant / Fixed-term)</Text>
                  <Text style={[styles.opSubtitle, { color: colors.textSecondary }]}>
                    Retainer or contractual engagement without statutory deductions
                  </Text>
                </View>
                {massTargetEmpType === 'Contractual' && <Check size={18} color="#D97706" />}
              </TouchableOpacity>
            </View>

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setMassModalType('none')}
                style={{ flex: 1 }}
                disabled={massProcessing}
              />
              <Button
                title={massProcessing ? 'Updating...' : `Set Category for ${selectedUserIds.length} Users`}
                onPress={handleMassApply}
                loading={massProcessing}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SidebarLayout>
  );
}

const styles = StyleSheet.create({
  hhcCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    marginVertical: 10,
  },
  hhcTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  hhcSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  hhcBadgeActive: {
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  hhcBadgeActiveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0D7377',
  },

  container: { flex: 1 },
  content: { padding: 20, gap: 24, paddingBottom: 60 },
  contentDesktop: { maxWidth: 1200, alignSelf: 'center', width: '100%', padding: 36, gap: 28 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' },
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
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, marginTop: 4, lineHeight: 19 },

  pastelMetricCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    overflow: 'hidden',
    position: 'relative',
    minHeight: 104,
    shadowColor: '#0f0f0f',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValueText: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  metricLabelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 8,
  },
  waveContainer: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    opacity: 0.65,
    pointerEvents: 'none',
  },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  addBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },

  statsGridDesktop: { flexDirection: 'row', gap: 16 },
  statsGridMobile: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: {
    flex: 1,
    minWidth: 140,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  statIconWrap: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { fontSize: 12, fontWeight: '500' },

  filterBar: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  chipText: { fontSize: 12, fontWeight: '600' },

  tableCard: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  tableHeader: { padding: 18, borderBottomWidth: 1 },
  tableTitle: { fontSize: 16, fontWeight: '700' },

  userList: { padding: 4 },
  userRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 10,
    flexWrap: 'wrap',
  },
  userRowMobile: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  modernDesktopUserCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 18,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  modernDesktopUserCardSelected: {
    borderColor: '#7C3AED',
    backgroundColor: '#FAF5FF',
  },
  desktopAvatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  desktopAvatarText: {
    color: '#7C3AED',
    fontSize: 16.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  desktopStatusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  desktopUserCol: {
    flex: 1.4,
    minWidth: 220,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  desktopNameText: {
    fontSize: 15.5,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  roleBadgeLavender: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 10,
    paddingVertical: 2.5,
    borderRadius: 12,
    alignSelf: 'center',
  },
  roleBadgeLavenderText: {
    color: '#7C3AED',
    fontSize: 12,
    fontWeight: '600',
  },
  desktopContactText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '400',
  },
  desktopUnitCol: {
    flex: 1.2,
    minWidth: 180,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  desktopColHeader: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    marginBottom: 6,
  },
  desktopUnitPill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 14,
    paddingVertical: 5.5,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  desktopUnitPillText: {
    color: '#1E293B',
    fontSize: 12.5,
    fontWeight: '500',
  },
  desktopEmpCol: {
    flex: 1,
    minWidth: 140,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  desktopEmpPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 3.5,
    borderRadius: 14,
    alignSelf: 'flex-start',
  },
  desktopEmpPillText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '500',
  },
  desktopActionsCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 12,
  },
  desktopViewProfileBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  desktopViewProfileText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  desktopMoreBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modernMobileUserCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  modernMobileUserCardSelected: {
    backgroundColor: '#FAF5FF',
    borderColor: '#7C3AED',
  },
  mobileCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  mobileAvatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileAvatarText: {
    color: '#7C3AED',
    fontSize: 15,
    fontWeight: '700',
  },
  cardNameText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  mobilePillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  mobileCardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  mobileViewProfileBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mobileViewProfileText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
  mobileUserCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ECEEF5',
    padding: 12,
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  mobileUserCardSelected: {
    backgroundColor: '#FAF8FF',
    borderColor: '#C4B5FD',
  },
  mobileCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avatarStatusBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  mobileCardName: {
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  mobileCardEmail: {
    fontSize: 12,
    marginTop: 1,
  },
  mobileRolePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  mobileRolePillText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  mobileKebabBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  mobileCardRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
    flexWrap: 'nowrap',
    overflow: 'hidden',
  },
  mobileRibbonChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mobileRibbonChipText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#475569',
  },
  mobileRibbonPhone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
  mobileRibbonPhoneText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  userName: { fontSize: 15, fontWeight: '700' },
  userMeta: { fontSize: 12 },
  userActions: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 6 },
  mobileManageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F0F9F8',
    borderWidth: 1,
    borderColor: '#0D737740',
    alignSelf: 'center',
  },
  mobileManageBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0D7377',
  },
  actionSheetHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  operationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  opIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  opTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  opSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  opCancelBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 6,
  },
  opCancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  actionBtnText: { fontSize: 12, fontWeight: '600' },

  emptyState: { padding: 48, alignItems: 'center' },
  alertBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },

  switchCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
  empFieldsBox: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#fafafa',
    gap: 12,
  },
  formSubHeader: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  floatingMassBar: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  massBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  massBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
