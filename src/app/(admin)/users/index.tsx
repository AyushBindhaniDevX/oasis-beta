import { getNavForRole } from '@/constants/navigation';
import { useRouter } from 'expo-router';
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
  Switch,
} from 'react-native';
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
import { SidebarLayout } from '@/components/layout/Sidebar';
import {
  getOrgUsers,
  updateUserRole,
  updateUserProfileData,
  toggleUserActive,
  createSystemUser,
  deleteUserRecord,
} from '@/lib/services/organization';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getDepartments, getWorkplaces, getEmployees, updateEmployee, getEmployeeByProfileId } from '@/lib/services/employee';
import { getShifts, assignEmployeeShift } from '@/lib/services/shifts';
import { createAuditLog } from '@/lib/services/audit';
import { getLeaveBalances, getLeaveTypes, updateLeaveBalance } from '@/lib/services/leave';
import { formatDate } from '@/utils/format';
import { CustomPayrollItemsManager } from '@/components/payroll/CustomPayrollItemsManager';
import { AppointmentLetterModal } from '@/components/AppointmentLetterModal';
import type { Profile, Department, Workplace, WorkShift, Employee, LeaveBalance, LeaveType, CustomPayrollItem } from '@/types';
import {
  Search,
  UserPlus,
  Shield,
  UserCheck,
  UserX,
  Edit2,
  Lock,
  Mail,
  Phone,
  Briefcase,
  Building,
  CheckCircle2,
  AlertCircle,
  Users,
  ShieldCheck,
  Award,
  Trash2,
  KeyRound,
  RotateCcw,
  RefreshCw,
  Umbrella,
  Eye,
  MoreVertical,
  ChevronRight,
  HeartPulse,
  FileText,
} from 'lucide-react-native';

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
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'hr' | 'employee'>('employee');
  const [newEmploymentType, setNewEmploymentType] = useState('full_time');
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
  const [editEmploymentType, setEditEmploymentType] = useState('full_time');
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

  const tenantDomain = (tenantOrg?.settings as any)?.domain || (typeof window !== 'undefined' && window.location.hostname.includes('shanti') ? 'shantimemorialhospital.com' : 'subedge.com');

  const generateRandomCode = (targetOrgId?: string) => {
    const activeOrg = targetOrgId || newOrgId || tenantOrg?.id || '';
    const isSMH = activeOrg.includes('shanti') || tenantDomain.includes('shanti');
    const prefix = isSMH ? 'SMH' : 'EMP';
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${randomDigits}`;
  };

  const openAddModal = () => {
    const defaultOrgId = tenantOrg?.id || currentAdmin?.organization_id || 'shanti-memorial-hospital';
    setNewOrgId(defaultOrgId);
    setNewFullName('');
    setNewEmail('');
    setNewPhone('');
    setNewRole('employee');
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
      const orgId = newOrgId || tenantOrg?.id || currentAdmin?.organization_id || 'shanti-memorial-hospital';
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
        epf_percentage: parseFloat(newEpfPercentage) || 0,
        socso_percentage: parseFloat(newSocsoPercentage) || 0,
        tax_percentage: parseFloat(newTaxPercentage) || 0,
        tax_regime: newTaxRegime,
        hra_percentage: parseFloat(newHraPercentage) || 0,
        transport_allowance: parseFloat(newTransportAllowance) || 0,
        conveyance_allowance: parseFloat(newConveyanceAllowance) || 1200,
        washing_allowance: parseFloat(newWashingAllowance) || 500,
        special_allowance: newSpecialAllowance.trim() ? parseFloat(newSpecialAllowance) : undefined,
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
        setEditEmploymentType((empData as any).employment_type || 'full_time');
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

        let shiftVal = (empData as any).default_shift_id || null;
        if (!shiftVal) {
          try {
            const today = new Date().toISOString().split('T')[0];
            const shiftSnap = await getDoc(doc(db, 'employee_shifts', `${empData.id}_${today}`));
            if (shiftSnap.exists() && shiftSnap.data()?.shift_id) {
              shiftVal = shiftSnap.data().shift_id;
            }
          } catch (sErr) {}
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
        setEditEmploymentType('full_time');
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
          employee_code: editEmpCode.trim() || undefined,
          designation: editDesignation.trim() || null,
          department_id: editDeptId || null,
          workplace_id: editWorkplaceId || null,
          default_shift_id: editShiftId || null,
          manager_id: editManagerId || null,
          date_of_birth: editDob.trim() || null,
          basic_salary: parseFloat(editSalary) || 0,
          conveyance_allowance: parseFloat(editConveyanceAllowance) || 1200,
          washing_allowance: parseFloat(editWashingAllowance) || 500,
          special_allowance: editSpecialAllowance.trim() ? parseFloat(editSpecialAllowance) : undefined,
          employment_type: editEmploymentType as any,
          tax_config: updatedTaxConfig,
          employment_status: editStatus as any,
          is_hhc_enabled: editIsHhcEnabled,
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
          employment_type: editEmploymentType || 'full_time',
          manager_id: editManagerId || null,
          default_shift_id: editShiftId || null,
          date_of_birth: editDob.trim() || null,
          basic_salary: parseFloat(editSalary) || 0,
          conveyance_allowance: parseFloat(editConveyanceAllowance) || 1200,
          washing_allowance: parseFloat(editWashingAllowance) || 500,
          special_allowance: editSpecialAllowance.trim() ? parseFloat(editSpecialAllowance) : undefined,
          tax_config: updatedTaxConfig,
          employment_status: editStatus as any,
          onboarding_completed: true,
          is_hhc_enabled: editIsHhcEnabled,
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
        } catch (sErr) {}
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
      const emp = managers.find(m => m.profile_id === u.id || (m.profile as any)?.id === u.id);
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
      const { sendPasswordResetEmail } = await import('firebase/auth');
      const { auth } = await import('@/lib/firebase');
      await sendPasswordResetEmail(auth, userEmail.trim().toLowerCase());
      setInfoBanner({
        type: 'success',
        message: `Password reset email has been sent to ${userEmail}.`,
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

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Role filter
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      // Status filter
      if (statusFilter === 'active' && !u.is_active) return false;
      if (statusFilter === 'inactive' && u.is_active) return false;
      // Search
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchesName = u.full_name?.toLowerCase().includes(query);
        const matchesEmail = u.email?.toLowerCase().includes(query);
        const matchesRole = u.role?.toLowerCase().includes(query);
        return matchesName || matchesEmail || matchesRole;
      }
      return true;
    });
  }, [users, roleFilter, statusFilter, search]);

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
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Top Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text }]}>Users & Employees</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Manage organization accounts, roles, and employee records.
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 }}>
              <Badge label={`${String(pkg || 'standard').toUpperCase()} PACKAGE`} variant={pkg === 'gold' ? 'warning' : 'neutral'} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: isLimitReached ? colors.danger : colors.textSecondary }}>
                {activeCount} / {limit} Users active ({Math.max(0, limit - activeCount)} left)
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: isLimitReached ? colors.border : colors.primary }]}
            onPress={openAddModal}
            activeOpacity={0.85}
            disabled={isLimitReached}
          >
            <UserPlus size={16} color="#FFF" />
            <Text style={styles.addBtnText}>{isLimitReached ? 'Limit Reached' : 'Add New User'}</Text>
          </TouchableOpacity>
        </View>

        {infoBanner && (
          <View
            style={[
              styles.alertBox,
              infoBanner.type === 'success'
                ? { backgroundColor: '#edf8f6', borderColor: '#c4ece7' }
                : { backgroundColor: colors.dangerLight, borderColor: colors.danger + '40' },
            ]}
          >
            {infoBanner.type === 'success' ? (
              <CheckCircle2 size={18} color="#006a61" />
            ) : (
              <AlertCircle size={18} color={colors.danger} />
            )}
            <Text
              style={{
                color: infoBanner.type === 'success' ? '#006a61' : colors.danger,
                fontWeight: '600',
                fontSize: 13,
                flex: 1,
              }}
            >
              {infoBanner.message}
            </Text>
          </View>
        )}

        {/* Stats Grid */}
        <View style={isDesktop ? styles.statsGridDesktop : styles.statsGridMobile}>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: '#e2e8f0' }]}>
            <View style={[styles.statIconWrap, { backgroundColor: '#edf8f6' }]}>
              <Users size={18} color="#006a61" />
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>{users.length}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Accounts</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: '#e2e8f0' }]}>
            <View style={[styles.statIconWrap, { backgroundColor: '#eeebff' }]}>
              <ShieldCheck size={18} color="#4f46e5" />
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>{adminCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Administrators</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: '#e2e8f0' }]}>
            <View style={[styles.statIconWrap, { backgroundColor: '#fef3c7' }]}>
              <Award size={18} color="#b45309" />
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>{hrCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>HR Managers</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: '#e2e8f0' }]}>
            <View style={[styles.statIconWrap, { backgroundColor: '#e0f2fe' }]}>
              <UserCheck size={18} color="#0369a1" />
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>{activeCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Active Users</Text>
          </View>
        </View>

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
        </View>

        {/* Users Table / Grid */}
        <View style={[styles.tableCard, { backgroundColor: colors.surface, borderColor: '#e2e8f0' }]}>
          <View style={[styles.tableHeader, { borderBottomColor: '#f1f5f9' }]}>
            <Text style={[styles.tableTitle, { color: colors.text }]}>
              User Accounts ({filteredUsers.length})
            </Text>
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
              {filteredUsers.map((u, idx) => (
                <TouchableOpacity
                  key={u.id}
                  activeOpacity={!isDesktop ? 0.7 : 1}
                  onPress={() => {
                    if (!isDesktop) setActionSheetUser(u);
                  }}
                  style={[
                    styles.userRow,
                    idx !== filteredUsers.length - 1 && {
                      borderBottomWidth: 1,
                      borderBottomColor: '#f1f5f9',
                    },
                    !isDesktop && styles.userRowMobile,
                  ]}
                >
                  <Avatar name={u.full_name} url={u.avatar_url} size={44} />

                  <View style={{ flex: 1, gap: 2, paddingHorizontal: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Text style={[styles.userName, { color: colors.text }]}>{u.full_name}</Text>
                      <Badge
                        label={String(u.role || 'employee').toUpperCase()}
                        variant={getRoleBadgeVariant(u.role)}
                      />
                      <Badge
                        label={u.is_active ? 'ACTIVE' : 'INACTIVE'}
                        variant={u.is_active ? 'successLight' : 'dangerLight'}
                      />
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 2 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Mail size={12} color={colors.textSecondary} />
                        <Text style={[styles.userMeta, { color: colors.textSecondary }]}>{u.email}</Text>
                      </View>
                      {u.phone && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Phone size={12} color={colors.textSecondary} />
                          <Text style={[styles.userMeta, { color: colors.textSecondary }]}>{u.phone}</Text>
                        </View>
                      )}
                      {u.created_at && (
                        <Text style={[styles.userMeta, { color: colors.textSecondary }]}>
                          Added {formatDate(u.created_at)}
                        </Text>
                      )}
                    </View>
                  </View>

                  {!isDesktop ? (
                    <TouchableOpacity
                      onPress={() => setActionSheetUser(u)}
                      style={styles.mobileManageBtn}
                      activeOpacity={0.7}
                    >
                      <MoreVertical size={16} color="#0D7377" />
                      <Text style={styles.mobileManageBtnText}>Manage</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.userActions}>
                      {/* View Employee Profile */}
                      {managers.find(m => m.profile_id === u.id || (m.profile as any)?.id === u.id) && (
                        <TouchableOpacity
                          onPress={() => {
                            const emp = managers.find(m => m.profile_id === u.id || (m.profile as any)?.id === u.id);
                            if (emp?.id) router.push(`/(hr)/employees/${emp.id}`);
                          }}
                          style={[styles.actionBtn, { borderColor: '#e2e8f0', borderWidth: 1, backgroundColor: '#f8faff' }]}
                        >
                          <Eye size={14} color="#4f46e5" />
                          <Text style={[styles.actionBtnText, { color: '#4f46e5' }]}>Profile</Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        onPress={() => handleResendInvite(u)}
                        style={[styles.actionBtn, { borderColor: '#c7d2fe', borderWidth: 1, backgroundColor: '#eef2ff' }]}
                      >
                        <Mail size={14} color="#4f46e5" />
                        <Text style={[styles.actionBtnText, { color: '#4f46e5' }]}>Invite</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => setAppointmentLetterUser(u)}
                        style={[styles.actionBtn, { borderColor: '#0284c740', borderWidth: 1, backgroundColor: '#f0f9ff' }]}
                      >
                        <FileText size={14} color="#0284c7" />
                        <Text style={[styles.actionBtnText, { color: '#0284c7' }]}>Letter</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => openEditModal(u)}
                        style={[styles.actionBtn, { borderColor: '#e2e8f0', borderWidth: 1 }]}
                      >
                        <Edit2 size={14} color={colors.primary} />
                        <Text style={[styles.actionBtnText, { color: colors.primary }]}>Edit</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => openLeaveModalForUser(u)}
                        style={[styles.actionBtn, { borderColor: '#0D737740', borderWidth: 1, backgroundColor: '#F0F9F8' }]}
                      >
                        <Umbrella size={14} color="#0D7377" />
                        <Text style={[styles.actionBtnText, { color: '#0D7377' }]}>Leave</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleResetPassword(u.email)}
                        style={[styles.actionBtn, { borderColor: '#e2e8f0', borderWidth: 1 }]}
                      >
                        <KeyRound size={14} color="#64748B" />
                        <Text style={[styles.actionBtnText, { color: '#64748B' }]}>Reset Pwd</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => setToggleUser(u)}
                        style={[
                          styles.actionBtn,
                          u.is_active
                            ? { backgroundColor: '#fff5f5' }
                            : { backgroundColor: '#edf8f6' },
                        ]}
                      >
                        {u.is_active ? (
                          <>
                            <UserX size={14} color={colors.danger} />
                            <Text style={[styles.actionBtnText, { color: colors.danger }]}>Deactivate</Text>
                          </>
                        ) : (
                          <>
                            <UserCheck size={14} color="#006a61" />
                            <Text style={[styles.actionBtnText, { color: '#006a61' }]}>Activate</Text>
                          </>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => setDeleteUser(u)}
                        style={[styles.actionBtn, { backgroundColor: '#fee2e2' }]}
                      >
                        <Trash2 size={14} color={colors.danger} />
                        <Text style={[styles.actionBtnText, { color: colors.danger }]}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
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

                {/* Organization / Entity Selector */}
                {(() => {
                  const orgOptions =
                    allOrganizations && allOrganizations.length > 0
                      ? allOrganizations.map((o) => ({
                          label: o.name || o.id,
                          value: o.id,
                        }))
                      : [
                          { label: 'Shanti Memorial Hospital', value: 'shanti-memorial-hospital' },
                          { label: 'Subedge Technology Pvt Ltd', value: '00000000-0000-0000-0000-000000000001' },
                        ];
                  return (
                    <Select
                      label="Organization / Entity *"
                      options={orgOptions}
                      value={newOrgId || orgOptions[0]?.value}
                      onValueChange={handleOrgChange}
                    />
                  );
                })()}

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
                  options={[
                    { label: 'Employee (Standard Access)', value: 'employee' },
                    { label: 'HR Manager (Full HR & Payroll Access)', value: 'hr' },
                    { label: 'Administrator (System & Org Settings)', value: 'admin' },
                  ]}
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
                      label="Primary Workplace (Location)"
                      options={workplaces.map((w) => ({ label: w.name, value: w.id }))}
                      value={newWorkplaceId}
                      onValueChange={setNewWorkplaceId}
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
                options={[
                  { label: 'Employee (Standard Access)', value: 'employee' },
                  { label: 'HR Manager (Full HR & Payroll Access)', value: 'hr' },
                  { label: 'Administrator (System & Org Settings)', value: 'admin' },
                ]}
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
                  label="Primary Workplace (Location)"
                  options={[
                    { label: 'None / Unassigned', value: '' },
                    ...workplaces.map((w) => ({ label: w.name, value: w.id })),
                  ]}
                  value={editWorkplaceId}
                  onValueChange={setEditWorkplaceId}
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

                <Select
                  label="Employment Type"
                  options={[
                    { label: 'Full Time (Permanent)', value: 'full_time' },
                    { label: 'Part Time', value: 'part_time' },
                    { label: 'Contract / Consultant', value: 'contract' },
                    { label: 'Intern / Trainee', value: 'intern' },
                  ]}
                  value={editEmploymentType}
                  onValueChange={(val) => setEditEmploymentType(val || 'full_time')}
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

                {/* Healthcare & HHC Toggle */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setEditIsHhcEnabled(!editIsHhcEnabled)}
                  style={[
                    styles.hhcCard,
                    {
                      backgroundColor: editIsHhcEnabled ? '#F0F9FF' : colors.surface,
                      borderColor: editIsHhcEnabled ? '#0D7377' : colors.border,
                    },
                  ]}
                >
                  <View style={{ flex: 1, paddingRight: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <HeartPulse size={18} color={editIsHhcEnabled ? '#0D7377' : '#64748B'} />
                      <Text style={[styles.hhcTitle, { color: editIsHhcEnabled ? '#0D7377' : colors.text }]}>
                        Home Health Care (HHC) Provider
                      </Text>
                      {editIsHhcEnabled && (
                        <View style={styles.hhcBadgeActive}>
                          <Text style={styles.hhcBadgeActiveText}>ACTIVE DOCTOR / NURSE</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.hhcSubtitle, { color: colors.textSecondary }]}>
                      Enable this doctor or staff member for clinical dispatch and patient leads in Cordeliakare HHC.
                    </Text>
                  </View>
                  <Switch
                    value={editIsHhcEnabled}
                    onValueChange={setEditIsHhcEnabled}
                    trackColor={{ false: '#E2E8F0', true: '#0D7377' }}
                    thumbColor="#FFFFFF"
                  />
                </TouchableOpacity>
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
                  const emp = managers.find(m => m.profile_id === actionSheetUser.id || (m.profile as any)?.id === actionSheetUser.id);
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
              ? managers.find(
                  (m) =>
                    m.profile_id === appointmentLetterUser.id ||
                    (m.profile as any)?.id === appointmentLetterUser.id
                ) || null
              : null
          }
          organization={tenantOrg}
          onSuccess={(msg) => {
            setInfoBanner({ type: 'success', message: msg });
            setTimeout(() => setInfoBanner(null), 5000);
          }}
        />
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
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, marginTop: 4, lineHeight: 20 },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
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
});
