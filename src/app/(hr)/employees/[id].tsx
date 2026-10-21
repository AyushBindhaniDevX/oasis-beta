import { HR_NAV } from '@/constants/navigation';
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/context/TenantContext';
import { useTheme } from '@/hooks/use-theme';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LoadingState } from '@/components/ui/States';
import { SidebarLayout } from '@/components/layout/Sidebar';
import {
  updateEmployee,
  getDepartments,
  getWorkplaces,
  getEmployees,
  getEmployeeById,
} from '@/lib/services/employee';
import { getShifts, assignEmployeeShift } from '@/lib/services/shifts';
import { updateUserProfileData } from '@/lib/services/organization';
import { getLeaveBalances, getLeaveTypes, updateLeaveBalance } from '@/lib/services/leave';
import { formatDate, formatCurrency } from '@/utils/format';
import { AppointmentLetterModal } from '@/components/AppointmentLetterModal';
import { resendAppointmentLetterEmail, downloadAppointmentLetterPdf } from '@/lib/services/appointmentLetters';
import type { Employee, Department, Workplace, WorkShift, LeaveBalance, LeaveType } from '@/types';
import { Edit3, AlertCircle, Umbrella, CheckCircle2, HeartPulse, FileText, Mail, Download } from 'lucide-react-native';

const statusVariant = (s: string): 'success' | 'danger' | 'warning' | 'neutral' => {
  if (s === 'active') return 'success';
  if (s === 'terminated' || s === 'suspended') return 'danger';
  if (s === 'on_leave') return 'warning';
  return 'neutral';
};

export default function EmployeeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useTheme();
  const { profile } = useAuth();
  const { organization: tenantOrg } = useTenant();
  const router = useRouter();
  const [emp, setEmp] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  // Leave Balances State
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [customQuotas, setCustomQuotas] = useState<Record<string, string>>({});
  const [savingLeave, setSavingLeave] = useState(false);
  const [leaveSuccessMsg, setLeaveSuccessMsg] = useState('');

  // Edit Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Appointment Letter State
  const [appointmentModalOpen, setAppointmentModalOpen] = useState(false);
  const [sendingApptEmail, setSendingApptEmail] = useState(false);
  const [downloadingApptPdf, setDownloadingApptPdf] = useState(false);
  const [apptFeedback, setApptFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleQuickSendApptEmail = async () => {
    if (!emp) return;
    setSendingApptEmail(true);
    setApptFeedback(null);
    try {
      const email = emp.profile?.email || (emp as any).email;
      await resendAppointmentLetterEmail({
        employee: emp,
        organization: tenantOrg,
      });
      setApptFeedback({
        type: 'success',
        message: `Appointment Letter sent to ${email} successfully!`,
      });
      setTimeout(() => setApptFeedback(null), 5000);
    } catch (err: any) {
      setApptFeedback({
        type: 'error',
        message: err.message || 'Failed to send appointment letter email.',
      });
    } finally {
      setSendingApptEmail(false);
    }
  };

  const handleQuickDownloadApptPdf = async () => {
    if (!emp) return;
    setDownloadingApptPdf(true);
    setApptFeedback(null);
    try {
      await downloadAppointmentLetterPdf({
        employee: emp,
        organization: tenantOrg,
      });
      setApptFeedback({
        type: 'success',
        message: 'Appointment letter PDF generated and ready for print/download.',
      });
      setTimeout(() => setApptFeedback(null), 5000);
    } catch (err: any) {
      setApptFeedback({
        type: 'error',
        message: err.message || 'Failed to download appointment letter PDF.',
      });
    } finally {
      setDownloadingApptPdf(false);
    }
  };

  // Dropdown lists
  const [departments, setDepartments] = useState<Department[]>([]);
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [shifts, setShifts] = useState<WorkShift[]>([]);
  const [managers, setManagers] = useState<Employee[]>([]);

  // Edit Form Fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'admin' | 'hr' | 'employee'>('employee');
  const [empCode, setEmpCode] = useState('');
  const [designation, setDesignation] = useState('');
  const [deptId, setDeptId] = useState<string | null>(null);
  const [workplaceId, setWorkplaceId] = useState<string | null>(null);
  const [shiftId, setShiftId] = useState<string | null>(null);
  const [managerId, setManagerId] = useState<string | null>(null);
  const [l1ManagerId, setL1ManagerId] = useState<string | null>(null);
  const [l2ManagerId, setL2ManagerId] = useState<string | null>(null);
  const [l3ManagerId, setL3ManagerId] = useState<string | null>(null);
  const [l4ManagerId, setL4ManagerId] = useState<string | null>(null);
  const [basicSalary, setBasicSalary] = useState('');
  const [status, setStatus] = useState<string>('active');
  const [isHhcEnabled, setIsHhcEnabled] = useState(false);
  const [joiningDate, setJoiningDate] = useState('');

  // Tax Configuration State
  const [taxRegime, setTaxRegime] = useState<string>('new');
  const [tdsPercentage, setTdsPercentage] = useState('0');
  const [epfPercentage, setEpfPercentage] = useState('12');
  const [hraPercentage, setHraPercentage] = useState('40');
  const [ptAmount, setPtAmount] = useState('200');
  const [pfNumber, setPfNumber] = useState('');
  const [epfExempt, setEpfExempt] = useState<string>('no');
  const [esopValue, setEsopValue] = useState('');

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const employeeData = await getEmployeeById(id);
      setEmp(employeeData);

      const orgId = employeeData?.organization_id || employeeData?.profile?.organization_id || employeeData?.department?.organization_id || tenantOrg?.id || profile?.organization_id;
      if (orgId && id) {
        const [deptList, wpList, shiftList, empList, balances, lTypes] = await Promise.all([
          getDepartments(orgId),
          getWorkplaces(orgId),
          getShifts(orgId),
          getEmployees({ organization_id: orgId }),
          getLeaveBalances(id),
          getLeaveTypes(orgId),
        ]);
        setDepartments(deptList || []);
        setWorkplaces(wpList || []);
        setShifts(shiftList || []);
        setManagers(empList?.filter(e => e.id !== id) || []);
        setLeaveBalances(balances || []);
        setLeaveTypes(lTypes || []);
      }
    } catch (e) {
      console.error('Error loading employee details:', e);
    } finally {
      setLoading(false);
    }
  }, [id, profile, tenantOrg]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openLeaveModal = () => {
    const quotaMap: Record<string, string> = {};
    leaveTypes.forEach((lt) => {
      const existing = leaveBalances.find((b) => b.leave_type_id === lt.id || b.leave_type?.name === lt.name);
      quotaMap[lt.id] = String(existing ? existing.allocated_days : lt.annual_days || 12);
    });
    setCustomQuotas(quotaMap);
    setLeaveSuccessMsg('');
    setLeaveModalOpen(true);
  };

  const handleSaveLeaveBalances = async () => {
    if (!emp) return;
    setSavingLeave(true);
    setLeaveSuccessMsg('');
    try {
      for (const lt of leaveTypes) {
        const days = parseFloat(customQuotas[lt.id] || '0') || 0;
        const existing = leaveBalances.find((b) => b.leave_type_id === lt.id || b.leave_type?.name === lt.name);
        await updateLeaveBalance(emp.id, lt.id, days, existing?.used_days || 0);
      }
      setLeaveSuccessMsg('Leave balances updated successfully!');
      await loadData();
      setTimeout(() => {
        setLeaveModalOpen(false);
        setLeaveSuccessMsg('');
      }, 1000);
    } catch (err) {
      console.error('Failed to update leave quotas:', err);
    } finally {
      setSavingLeave(false);
    }
  };

  const openEditModal = () => {
    if (!emp) return;
    setFullName(emp.profile?.full_name || '');
    setPhone(emp.profile?.phone || '');
    setRole((emp.profile?.role as any) || 'employee');
    setEmpCode(emp.employee_code || '');
    setDesignation(emp.designation || '');
    setDeptId(emp.department_id || null);
    setWorkplaceId(emp.workplace_id || null);
    setShiftId((emp as any).default_shift_id || null);
    setManagerId(emp.l1_manager_id || emp.manager_id || null);
    setL1ManagerId(emp.l1_manager_id || emp.manager_id || null);
    setL2ManagerId(emp.l2_manager_id || null);
    setL3ManagerId(emp.l3_manager_id || null);
    setL4ManagerId(emp.l4_manager_id || null);
    setBasicSalary(emp.basic_salary ? String(emp.basic_salary) : '0');
    setStatus(emp.employment_status || 'active');
    setIsHhcEnabled(!!emp.is_hhc_enabled || !!emp.profile?.is_hhc_enabled);
    setJoiningDate(emp.joining_date || '');

    // Populate tax config
    const tc = emp.tax_config || {};
    setTaxRegime(tc.tax_regime || 'new');
    setTdsPercentage(tc.tds_percentage != null ? String(tc.tds_percentage) : '0');
    setEpfPercentage(tc.epf_percentage != null ? String(tc.epf_percentage) : (tc.epf_exempt ? '0' : '12'));
    setHraPercentage(tc.hra_percentage != null ? String(tc.hra_percentage) : (tc.hra_type === 'metro' ? '50' : '40'));
    setPtAmount(tc.pt_amount != null ? String(tc.pt_amount) : '200');
    setPfNumber(tc.pf_number || '');
    setEpfExempt(tc.epf_exempt ? 'yes' : 'no');
    setEsopValue(tc.esop_value != null ? String(tc.esop_value) : '');

    setSaveError('');
    setEditModalOpen(true);
  };

  const handleDeptChange = (val: string | null) => {
    setDeptId(val);
    if (val) {
      const dept = departments.find(d => d.id === val);
      if (dept && dept.manager_id) {
        setManagerId(dept.manager_id);
      }
    }
  };

  const handleSaveEdit = async () => {
    if (!emp) return;
    if (!fullName.trim()) {
      setSaveError('Full Name is required');
      return;
    }
    if (!empCode.trim()) {
      setSaveError('Employee Code is required');
      return;
    }

    setSaving(true);
    setSaveError('');
    try {
      // 1. Update Profile (Name, Phone, Role)
      if (emp.profile_id) {
        await updateUserProfileData(emp.profile_id, {
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          role,
          is_hhc_enabled: isHhcEnabled,
        });
      }

      // 2. Update Employee operational fields & custom tax configuration
      await updateEmployee(emp.id, {
        employee_code: empCode.trim(),
        designation: designation.trim() || null,
        department_id: deptId || null,
        workplace_id: workplaceId || null,
        default_shift_id: shiftId || null,
        manager_id: l1ManagerId || null,
        l1_manager_id: l1ManagerId || null,
        l2_manager_id: l2ManagerId || null,
        l3_manager_id: l3ManagerId || null,
        l4_manager_id: l4ManagerId || null,
        basic_salary: parseFloat(basicSalary) || 0,
        employment_status: status as any,
        joining_date: joiningDate || undefined,
        is_hhc_enabled: isHhcEnabled,
        tax_config: {
          pf_number: pfNumber.trim() || null,
          tax_regime: taxRegime as any,
          tds_percentage: parseFloat(tdsPercentage) || 0,
          epf_percentage: parseFloat(epfPercentage) || 0,
          hra_percentage: parseFloat(hraPercentage) || 0,
          pt_amount: parseFloat(ptAmount) || 0,
          custom_tax_percentage: parseFloat(tdsPercentage) || 0,
          esop_value: parseFloat(esopValue) || null,
          epf_exempt: epfExempt === 'yes',
        },
      });

      // 3. Link Shift into employee_shifts roster if shift selected
      if (shiftId && emp.profile?.organization_id) {
        try {
          const today = new Date().toISOString().split('T')[0];
          await assignEmployeeShift(emp.id, today, shiftId, emp.profile.organization_id);
        } catch (sErr) {
          console.warn('Could not update employee_shifts roster:', sErr);
        }
      }

      await loadData();
      setEditModalOpen(false);
    } catch (err: any) {
      console.error('Failed to update employee:', err);
      setSaveError(err.message || 'Failed to update employee. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    setDeactivating(true);
    try {
      const newStatus = emp?.employment_status === 'active' ? 'inactive' : 'active';
      await updateEmployee(id!, { employment_status: newStatus as any });
      setEmp(prev => prev ? { ...prev, employment_status: newStatus as any } : null);
    } catch {}
    setDeactivating(false);
    setShowDeactivate(false);
  };

  if (loading) return <LoadingState />;
  if (!emp) {
    return (
      <SidebarLayout>
        <View style={[styles.container, { backgroundColor: colors.background, padding: 20, alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ color: colors.text, fontSize: 16 }}>Employee not found</Text>
          <Button title="Back to Employees" onPress={() => router.back()} style={{ marginTop: 12 }} />
        </View>
      </SidebarLayout>
    );
  }

  const l1Manager = managers.find(m => m.id === (emp.l1_manager_id || emp.manager_id)) || emp.l1_manager || emp.manager;
  const l2Manager = managers.find(m => m.id === emp.l2_manager_id) || emp.l2_manager;
  const l3Manager = managers.find(m => m.id === emp.l3_manager_id) || emp.l3_manager;
  const l4Manager = managers.find(m => m.id === emp.l4_manager_id) || emp.l4_manager;
  const currentShift = shifts.find(s => s.id === (emp as any).default_shift_id);
  const tc = emp.tax_config || {};

  return (
    <SidebarLayout>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Button title="← Back" onPress={() => router.back()} variant="ghost" size="sm" />
          <Text style={[styles.title, { color: colors.text }]}>Employee Details</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, maxWidth: 800, alignSelf: 'center', width: '100%' }}>
          {/* Header Card */}
          <Card style={{ alignItems: 'center', padding: 24, marginBottom: 16 }}>
            <Avatar name={emp.profile?.full_name || 'User'} size={72} url={emp.profile?.avatar_url} />
            <Text style={[styles.empName, { color: colors.text }]}>{emp.profile?.full_name || 'Unnamed'}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 14, marginBottom: 8 }}>{emp.designation || 'Staff'}</Text>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Badge label={emp.employment_status || 'active'} variant={statusVariant(emp.employment_status || 'active')} />
              <Badge label={emp.profile?.role || 'employee'} variant="neutral" />
              {(emp.is_hhc_enabled || emp.profile?.is_hhc_enabled) && (
                <Badge label="HHC Provider" variant="success" />
              )}
            </View>
          </Card>

          {/* Details Card */}
          <Card style={{ marginBottom: 16 }}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Employment Information</Text>
            <Row label="Employee Code" value={emp.employee_code || 'N/A'} colors={colors} />
            <Row label="Work Email" value={emp.profile?.email || 'N/A'} colors={colors} />
            <Row label="Phone Number" value={emp.profile?.phone || 'N/A'} colors={colors} />
            <Row label="Department" value={emp.department?.name || 'Unassigned'} colors={colors} />
            <Row label="Workplace Location" value={emp.workplace?.name || 'Unassigned'} colors={colors} />
            <Row label="L1 Manager (Supervisor)" value={l1Manager?.profile?.full_name || l1Manager?.employee_code || 'None / Not Assigned'} colors={colors} />
            <Row label="L2 Manager (HOD)" value={l2Manager?.profile?.full_name ? `${l2Manager.profile.full_name} (${l2Manager.employee_code || 'HOD'})` : 'None / Not Assigned'} colors={colors} />
            <Row label="L3 Manager (HR Head)" value={l3Manager?.profile?.full_name ? `${l3Manager.profile.full_name} (${l3Manager.employee_code || 'HR'})` : 'None / Not Assigned'} colors={colors} />
            <Row label="L4 Manager (Director / MS)" value={l4Manager?.profile?.full_name ? `${l4Manager.profile.full_name} (${l4Manager.employee_code || 'Director'})` : 'None / Not Assigned'} colors={colors} />
            <Row label="Assigned Shift" value={currentShift ? `${currentShift.name} (${currentShift.start_time} - ${currentShift.end_time})` : 'Standard'} colors={colors} />
            <Row label="Basic Salary" value={formatCurrency(emp.basic_salary)} colors={colors} />
            <Row label="Joining Date" value={emp.joining_date ? formatDate(emp.joining_date) : 'N/A'} colors={colors} />
            <Row label="Home Health Care (HHC)" value={(emp.is_hhc_enabled || emp.profile?.is_hhc_enabled) ? 'Enabled (Doctor / Provider)' : 'Disabled'} colors={colors} />
          </Card>

          {/* Statutory & Tax Settings Card */}
          <Card style={{ marginBottom: 16 }}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Tax Regime & Deduction Percentages</Text>
            <Row label="Tax Regime" value={String(tc.tax_regime || 'new').toUpperCase() + ' REGIME'} colors={colors} />
            <Row label="TDS Deduction Rate" value={`${tc.tds_percentage ?? 0}%`} colors={colors} />
            <Row label="EPF Rate" value={tc.epf_exempt ? 'Exempt (0%)' : `${tc.epf_percentage ?? 12}%`} colors={colors} />
            <Row label="HRA Rate" value={`${tc.hra_percentage ?? (tc.hra_type === 'metro' ? 50 : 40)}%`} colors={colors} />
            <Row label="Professional Tax (PT)" value={`₹${tc.pt_amount ?? 200}`} colors={colors} />
            <Row label="PF / UAN Number" value={tc.pf_number || 'Not Assigned'} colors={colors} />
          </Card>

          {/* Leave Balances Card */}
          <Card style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Umbrella size={18} color={colors.primary} />
                <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>Leave Balances & Quotas</Text>
              </View>
              <Button
                title="Set Quotas"
                onPress={openLeaveModal}
                size="sm"
                variant="outline"
                style={{ borderRadius: 8 }}
              />
            </View>

            <View style={{ gap: 8 }}>
              {leaveBalances.length === 0 ? (
                <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: 'center', paddingVertical: 12 }}>
                  No leave quotas set yet. Click &quot;Set Quotas&quot; to assign.
                </Text>
              ) : (
                leaveBalances.map((b) => (
                  <View
                    key={b.id || b.leave_type_id}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingVertical: 6,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border + '30',
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>
                      {b.leave_type?.name || 'Leave'}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                        Used: {b.used_days || 0}d / Total: {b.allocated_days || 0}d
                      </Text>
                      <Badge
                        label={`${b.remaining_days ?? b.allocated_days ?? 0}d Left`}
                        variant={(b.remaining_days ?? 0) > 0 ? 'success' : 'neutral'}
                      />
                    </View>
                  </View>
                ))
              )}
            </View>
          </Card>

          {/* Official Letter of Appointment Card */}
          <Card style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <FileText size={18} color="#0D7377" />
                <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>
                  Letter of Appointment
                </Text>
              </View>
              <Badge label="Official Document" variant="success" />
            </View>

            <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 12, lineHeight: 18 }}>
              Ref No: <Text style={{ fontWeight: '700', color: colors.text }}>{`SMH/HR/APT/${new Date().getFullYear()}/${emp.employee_code || 'SMH-000'}`}</Text>
              {'\n'}Issued to: <Text style={{ fontWeight: '600', color: colors.text }}>{emp.profile?.email || 'Registered Email'}</Text>
            </Text>

            {apptFeedback && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: apptFeedback.type === 'success' ? '#D1FAE5' : '#FEE2E2',
                  padding: 10,
                  borderRadius: 8,
                  marginBottom: 12,
                }}
              >
                {apptFeedback.type === 'success' ? (
                  <CheckCircle2 size={16} color="#059669" />
                ) : (
                  <AlertCircle size={16} color="#DC2626" />
                )}
                <Text
                  style={{
                    fontSize: 12.5,
                    fontWeight: '600',
                    color: apptFeedback.type === 'success' ? '#065F46' : '#991B1B',
                    flex: 1,
                  }}
                >
                  {apptFeedback.message}
                </Text>
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
              <Button
                title={sendingApptEmail ? 'Sending Email...' : 'Resend Email'}
                onPress={handleQuickSendApptEmail}
                disabled={sendingApptEmail}
                size="sm"
                variant="outline"
                style={{ flex: 1, minWidth: 130, borderColor: '#4F46E5', borderRadius: 8 }}
              />
              <Button
                title={downloadingApptPdf ? 'Generating PDF...' : 'Download PDF'}
                onPress={handleQuickDownloadApptPdf}
                disabled={downloadingApptPdf}
                size="sm"
                variant="outline"
                style={{ flex: 1, minWidth: 130, borderColor: '#0D7377', borderRadius: 8 }}
              />
              <Button
                title="Manage / Preview"
                onPress={() => setAppointmentModalOpen(true)}
                size="sm"
                variant="primary"
                style={{ flex: 1, minWidth: 130, borderRadius: 8 }}
              />
            </View>
          </Card>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Button
              title="Edit Details"
              onPress={openEditModal}
              style={{ flex: 1 }}
              variant="primary"
            />
            <Button
              title={emp.employment_status === 'active' ? 'Deactivate' : 'Activate'}
              onPress={() => setShowDeactivate(true)}
              variant={emp.employment_status === 'active' ? 'danger' : 'secondary'}
              style={{ flex: 1 }}
            />
          </View>
        </ScrollView>

        {/* Modal: Set Leave Quotas */}
        <Modal
          visible={leaveModalOpen}
          onClose={() => setLeaveModalOpen(false)}
          title={`Set Leave Quotas for ${emp.profile?.full_name || 'Employee'}`}
        >
          <ScrollView style={{ maxHeight: 480 }}>
            <View style={{ gap: 14 }}>
              {leaveSuccessMsg ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#D1FAE5', padding: 10, borderRadius: 8, gap: 6 }}>
                  <CheckCircle2 size={16} color="#059669" />
                  <Text style={{ color: '#065F46', fontSize: 13, fontWeight: '600' }}>{leaveSuccessMsg}</Text>
                </View>
              ) : null}

              <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 4 }}>
                Enter the annual allocated days for each leave category for the current year.
              </Text>

              {leaveTypes.map((lt) => (
                <Input
                  key={lt.id}
                  label={`${lt.name} (Days per Year)`}
                  value={customQuotas[lt.id] || ''}
                  onChangeText={(val) => setCustomQuotas((prev) => ({ ...prev, [lt.id]: val }))}
                  placeholder={String(lt.annual_days || 12)}
                  keyboardType="numeric"
                />
              ))}

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <Button
                  title="Cancel"
                  onPress={() => setLeaveModalOpen(false)}
                  variant="outline"
                  style={{ flex: 1, borderRadius: 8 }}
                />
                <Button
                  title={savingLeave ? 'Saving...' : 'Save Leave Quotas'}
                  onPress={handleSaveLeaveBalances}
                  loading={savingLeave}
                  style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 8 }}
                />
              </View>
            </View>
          </ScrollView>
        </Modal>

        {/* Full Edit Employee Modal */}
        <Modal
          visible={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          title="Edit Employee Details"
        >
          <ScrollView style={{ maxHeight: 520, paddingRight: 4 }}>
            {saveError ? (
              <View style={[styles.errorBanner, { backgroundColor: '#FEE2E2', borderColor: '#F87171' }]}>
                <AlertCircle size={16} color="#DC2626" />
                <Text style={{ color: '#B91C1C', fontSize: 13, flex: 1, marginLeft: 6 }}>{saveError}</Text>
              </View>
            ) : null}

            <Text style={[styles.groupLabel, { color: colors.textSecondary }]}>Personal & Account</Text>
            <Input
              label="Full Name *"
              value={fullName}
              onChangeText={setFullName}
              placeholder="e.g. Sarah Jenkins"
            />
            <Input
              label="Phone Number"
              value={phone}
              onChangeText={setPhone}
              placeholder="+91 98765 43210"
              keyboardType="phone-pad"
            />
            <Select
              label="System Role"
              value={role}
              onValueChange={(val) => setRole(val as any)}
              options={[
                { label: 'Employee (Standard Access)', value: 'employee' },
                { label: 'HR Manager', value: 'hr' },
                { label: 'System Admin', value: 'admin' },
              ]}
            />

            <Text style={[styles.groupLabel, { color: colors.textSecondary, marginTop: 14 }]}>Job & Assignment</Text>
            <Input
              label="Employee Code *"
              value={empCode}
              onChangeText={setEmpCode}
              placeholder="e.g. EMP-1001"
            />
            <Input
              label="Designation / Job Title"
              value={designation}
              onChangeText={setDesignation}
              placeholder="e.g. Senior Software Engineer"
            />

            <Select
              label="Department"
              value={deptId}
              onValueChange={handleDeptChange}
              options={[
                { label: 'None / Unassigned', value: '' },
                ...departments.map(d => ({ label: d.name, value: d.id })),
              ]}
            />

            <Select
              label="Primary Workplace (Location)"
              value={workplaceId}
              onValueChange={setWorkplaceId}
              options={[
                { label: 'None / Unassigned', value: '' },
                ...workplaces.map(w => ({ label: w.name, value: w.id })),
              ]}
            />

            <Text style={[styles.groupLabel, { color: colors.textSecondary, marginTop: 14 }]}>Reporting Hierarchy (4-Tier Approval Chain)</Text>

            <Select
              label="L1 Manager (Immediate Reporting Supervisor)"
              value={l1ManagerId || ''}
              onValueChange={(v) => {
                setL1ManagerId(v || null);
                setManagerId(v || null);
              }}
              options={[
                { label: 'None / Top Level', value: '' },
                ...managers.map(m => ({
                  label: `${m.profile?.full_name || 'Staff'} (${m.employee_code || 'EMP'}${m.designation ? ' - ' + m.designation : ''})`,
                  value: m.id,
                })),
              ]}
            />

            <Select
              label="L2 Manager (Department Head / HOD)"
              value={l2ManagerId || ''}
              onValueChange={(v) => setL2ManagerId(v || null)}
              options={[
                { label: 'None / Not Assigned', value: '' },
                ...managers.map(m => ({
                  label: `${m.profile?.full_name || 'Staff'} (${m.employee_code || 'EMP'}${m.designation ? ' - ' + m.designation : ''})`,
                  value: m.id,
                })),
              ]}
            />

            <Select
              label="L3 Manager (HR Manager / Operations Head)"
              value={l3ManagerId || ''}
              onValueChange={(v) => setL3ManagerId(v || null)}
              options={[
                { label: 'None / Not Assigned', value: '' },
                ...managers.map(m => ({
                  label: `${m.profile?.full_name || 'Staff'} (${m.employee_code || 'EMP'}${m.designation ? ' - ' + m.designation : ''})`,
                  value: m.id,
                })),
              ]}
            />

            <Select
              label="L4 Manager (Director / Medical Superintendent / Admin)"
              value={l4ManagerId || ''}
              onValueChange={(v) => setL4ManagerId(v || null)}
              options={[
                { label: 'None / Not Assigned', value: '' },
                ...managers.map(m => ({
                  label: `${m.profile?.full_name || 'Staff'} (${m.employee_code || 'EMP'}${m.designation ? ' - ' + m.designation : ''})`,
                  value: m.id,
                })),
              ]}
            />

            <Select
              label="Default Shift (For Attendance)"
              value={shiftId}
              onValueChange={setShiftId}
              options={[
                { label: 'Standard / Unset', value: '' },
                ...shifts.map(s => ({
                  label: `${s.name} (${s.start_time} - ${s.end_time})`,
                  value: s.id,
                })),
              ]}
            />

            <Input
              label="Basic Monthly Salary (₹)"
              value={basicSalary}
              onChangeText={setBasicSalary}
              placeholder="50000"
              keyboardType="numeric"
            />

            <Select
              label="Employment Status"
              value={status}
              onValueChange={(v) => setStatus(v || 'active')}
              options={[
                { label: 'Active', value: 'active' },
                { label: 'On Leave', value: 'on_leave' },
                { label: 'Suspended', value: 'suspended' },
                { label: 'Terminated', value: 'terminated' },
              ]}
            />

            {/* Healthcare & HHC Toggle */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setIsHhcEnabled(!isHhcEnabled)}
              style={[
                styles.hhcCard,
                {
                  backgroundColor: isHhcEnabled ? '#F0F9FF' : colors.surface,
                  borderColor: isHhcEnabled ? '#0D7377' : colors.border,
                },
              ]}
            >
              <View style={{ flex: 1, paddingRight: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <HeartPulse size={18} color={isHhcEnabled ? '#0D7377' : '#64748B'} />
                  <Text style={[styles.hhcTitle, { color: isHhcEnabled ? '#0D7377' : colors.text }]}>
                    Home Health Care (HHC) Provider
                  </Text>
                  {isHhcEnabled && (
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
                value={isHhcEnabled}
                onValueChange={setIsHhcEnabled}
                trackColor={{ false: '#E2E8F0', true: '#0D7377' }}
                thumbColor="#FFFFFF"
              />
            </TouchableOpacity>

            <Input
              label="Joining Date (YYYY-MM-DD)"
              value={joiningDate}
              onChangeText={setJoiningDate}
              placeholder="2026-08-27"
            />

            <Text style={[styles.groupLabel, { color: colors.textSecondary, marginTop: 14 }]}>Tax Regime & Custom Percentages</Text>

            <Select
              label="Tax Regime"
              value={taxRegime}
              onValueChange={(v) => setTaxRegime(v || 'new')}
              options={[
                { label: 'New Regime (Default 2024-25 Slabs)', value: 'new' },
                { label: 'Old Regime (Standard Old Slabs)', value: 'old' },
                { label: 'Custom Regime (Custom Percentages)', value: 'custom' },
              ]}
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Input
                  label="TDS Rate (%)"
                  value={tdsPercentage}
                  onChangeText={setTdsPercentage}
                  placeholder="0"
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="EPF Rate (%)"
                  value={epfPercentage}
                  onChangeText={setEpfPercentage}
                  placeholder="12"
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Input
                  label="HRA Rate (%)"
                  value={hraPercentage}
                  onChangeText={setHraPercentage}
                  placeholder="40"
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="PT Amount (₹)"
                  value={ptAmount}
                  onChangeText={setPtAmount}
                  placeholder="200"
                  keyboardType="numeric"
                />
              </View>
            </View>

            <Input
              label="PF / EPF Number (UAN)"
              value={pfNumber}
              onChangeText={setPfNumber}
              placeholder="100XXXXXXXXX"
              autoCapitalize="characters"
            />

            <Select
              label="EPF Exemption"
              value={epfExempt}
              onValueChange={(v) => setEpfExempt(v || 'no')}
              options={[
                { label: 'Applicable (Standard)', value: 'no' },
                { label: 'Exempt (0% deduction)', value: 'yes' },
              ]}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20, marginBottom: 12 }}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setEditModalOpen(false)}
                style={{ flex: 1 }}
                disabled={saving}
              />
              <Button
                title={saving ? 'Saving...' : 'Save Changes'}
                variant="primary"
                onPress={handleSaveEdit}
                style={{ flex: 1 }}
                disabled={saving}
              />
            </View>
          </ScrollView>
        </Modal>

        <ConfirmDialog
          visible={showDeactivate}
          title={emp.employment_status === 'active' ? 'Deactivate?' : 'Activate?'}
          message={`Are you sure you want to ${emp.employment_status === 'active' ? 'deactivate' : 'activate'} this employee?`}
          onConfirm={handleDeactivate}
          onCancel={() => setShowDeactivate(false)}
          loading={deactivating}
        />

        <AppointmentLetterModal
          visible={appointmentModalOpen}
          onClose={() => setAppointmentModalOpen(false)}
          employee={emp}
          profile={emp.profile}
          organization={tenantOrg}
          onSuccess={(msg) => {
            setApptFeedback({ type: 'success', message: msg });
            setTimeout(() => setApptFeedback(null), 5000);
          }}
        />
      </View>
    </SidebarLayout>
  );
}

function Row({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={[rowStyles.row, { borderBottomColor: colors.border }]}>
      <Text style={[rowStyles.label, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[rowStyles.value, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hhcCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 10,
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
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  hhcBadgeActiveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0D7377',
  },

  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1 },
  title: { fontSize: 17, fontWeight: '600' },
  empName: { fontSize: 22, fontWeight: '700', marginTop: 12, marginBottom: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  groupLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 8, borderWidth: 1, marginBottom: 12 },
});

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  label: { fontSize: 14 },
  value: { fontSize: 14, fontWeight: '500' },
});
