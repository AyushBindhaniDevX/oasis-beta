import { HR_NAV } from '@/constants/navigation';
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/context/TenantContext';
import { useTheme } from '@/hooks/use-theme';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { SidebarLayout } from '@/components/layout/Sidebar';
import { getDepartments, createEmployee, getEmployees, getWorkplaces } from '@/lib/services/employee';
import { getShifts } from '@/lib/services/shifts';
import { CustomPayrollItemsManager } from '@/components/payroll/CustomPayrollItemsManager';
import { HOSPITAL_UNITS } from '@/constants/config';
import type { Department, Employee, WorkShift, Workplace, CustomPayrollItem } from '@/types';
import { RefreshCw, ShieldCheck, ChevronDown, ChevronUp, Sliders, Eye, EyeOff, KeyRound, HeartPulse } from 'lucide-react-native';

export default function CreateEmployeeScreen() {
  const colors = useTheme();
  const { profile } = useAuth();
  const { organization: tenantOrg } = useTenant();
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [managers, setManagers] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<WorkShift[]>([]);
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showTaxSection, setShowTaxSection] = useState(false);

  // Basic fields
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [empCode, setEmpCode] = useState('');
  const [hospitalUnit, setHospitalUnit] = useState<string>('Shanti Memorial Hospital');
  const [employmentType, setEmploymentType] = useState<string>('Regular');
  const [grade, setGrade] = useState<string>('M1');
  const [password, setPassword] = useState('Welcome@123');
  const [showPassword, setShowPassword] = useState(false);
  const [deptId, setDeptId] = useState<string | null>(null);
  const [workplaceId, setWorkplaceId] = useState<string | null>(null);
  const [managerId, setManagerId] = useState<string | null>(null);
  const [l1ManagerId, setL1ManagerId] = useState<string | null>(null);
  const [l2ManagerId, setL2ManagerId] = useState<string | null>(null);
  const [l3ManagerId, setL3ManagerId] = useState<string | null>(null);
  const [l4ManagerId, setL4ManagerId] = useState<string | null>(null);
  const [shiftId, setShiftId] = useState<string | null>(null);
  const [role, setRole] = useState<string>('employee');
  const [designation, setDesignation] = useState('');
  const [isHhcEnabled, setIsHhcEnabled] = useState(false);
  const [basicSalary, setBasicSalary] = useState('');

  // Tax config & custom percentages
  const [pfNumber, setPfNumber] = useState('');
  const [taxRegime, setTaxRegime] = useState<string>('new');
  const [tdsPercentage, setTdsPercentage] = useState('');
  const [epfPercentage, setEpfPercentage] = useState('12');
  const [hraPercentage, setHraPercentage] = useState('40');
  const [ptAmount, setPtAmount] = useState('200');
  const [esopValue, setEsopValue] = useState('');
  const [hraType, setHraType] = useState<string>('non-metro');
  const [epfExempt, setEpfExempt] = useState<string>('no');
  const [conveyanceAllowance, setConveyanceAllowance] = useState('1200');
  const [washingAllowance, setWashingAllowance] = useState('500');
  const [specialAllowance, setSpecialAllowance] = useState('');
  const [customItems, setCustomItems] = useState<CustomPayrollItem[]>([]);

  const tenantDomain = (tenantOrg?.settings as any)?.domain || (typeof window !== 'undefined' && window.location.hostname.includes('shanti') ? 'shantimemorialhospital.com' : 'subedge.com');

  const generateRandomCode = () => {
    const prefix = tenantDomain.includes('shanti') ? 'SMH' : 'EMP';
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${randomDigits}`;
  };

  useEffect(() => {
    setEmpCode(generateRandomCode());
  }, [tenantDomain]);

  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;
      (async () => {
        const orgId = tenantOrg?.id || profile?.organization_id || '';
        const [d, m, s, wp] = await Promise.all([
          getDepartments(orgId),
          getEmployees({ organization_id: orgId }),
          getShifts(orgId),
          getWorkplaces(orgId)
        ]);
        if (isActive) {
          setDepartments(d || []);
          setManagers(m || []);
          setShifts(s || []);
          setWorkplaces(wp || []);
        }
      })();
      return () => { isActive = false; };
    }, [profile, tenantOrg])
  );

  // When HRA type changes, update HRA percentage default unless custom
  useEffect(() => {
    if (hraType === 'metro') {
      setHraPercentage('50');
    } else if (hraType === 'non-metro') {
      setHraPercentage('40');
    }
  }, [hraType]);

  // When EPF exemption changes, update EPF percentage
  useEffect(() => {
    if (epfExempt === 'yes') {
      setEpfPercentage('0');
    } else if (epfPercentage === '0') {
      setEpfPercentage('12');
    }
  }, [epfExempt]);

  // Auto-suggest TDS based on basic salary & regime when salary changes
  useEffect(() => {
    if (!basicSalary) return;
    const basic = parseFloat(basicSalary) || 0;
    const annual = basic * 12;
    let suggested = 0;
    if (taxRegime === 'old') {
      if (annual > 1000000) suggested = 30;
      else if (annual > 500000) suggested = 20;
      else if (annual > 250000) suggested = 5;
    } else if (taxRegime === 'new') {
      if (annual > 1500000) suggested = 30;
      else if (annual > 1200000) suggested = 20;
      else if (annual > 1000000) suggested = 15;
      else if (annual > 700000) suggested = 10;
      else if (annual > 300000) suggested = 5;
    }
    if (taxRegime !== 'custom') {
      setTdsPercentage(suggested > 0 ? String(suggested) : '0');
    }
  }, [basicSalary, taxRegime]);

  const handleNameChange = (name: string) => {
    setFullName(name);
    const words = name.trim().split(/\s+/);
    const cleanWords = words.filter((w) => !/^(dr|mr|mrs|ms|prof)\.?$/i.test(w));
    const mainName = cleanWords[0] || words[0] || '';
    const usernamePrefix = mainName.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (usernamePrefix) setUsername(usernamePrefix);
  };

  const handleDeptChange = (val: string | null) => {
    setDeptId(val);
    if (val) {
      const dept = departments.find(d => d.id === val);
      if (dept && dept.manager_id) {
        setManagerId(dept.manager_id);
        setL2ManagerId(dept.manager_id);
        if (!l1ManagerId) setL1ManagerId(dept.manager_id);
      }
    }
  };

  const handleCreate = async () => {
    if (!fullName || !username || !empCode || !phone) {
      setError('Name, username, phone, and employee code are required');
      return;
    }
    if (!shiftId) {
      setError('Please select a default shift for the employee');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const orgId = tenantOrg?.id || profile?.organization_id || '';
      const fullEmail = username.trim().toLowerCase();

      await createEmployee({
        full_name: fullName.trim(),
        email: fullEmail,
        password: password.trim() || 'Welcome@123',
        phone: phone.trim(),
        organization_id: orgId,
        employee_code: empCode.trim(),
        department_id: deptId || undefined,
        workplace_id: workplaceId || undefined,
        manager_id: l1ManagerId || managerId || undefined,
        l1_manager_id: l1ManagerId || managerId || undefined,
        l2_manager_id: l2ManagerId || undefined,
        l3_manager_id: l3ManagerId || undefined,
        l4_manager_id: l4ManagerId || undefined,
        default_shift_id: shiftId || undefined,
        role: role,
        designation: designation.trim() || undefined,
        hospital_unit: hospitalUnit,
        employment_type: employmentType,
        grade: grade.trim() || undefined,
        is_hhc_enabled: isHhcEnabled,
        basic_salary: parseFloat(basicSalary) || 0,
        conveyance_allowance: parseFloat(conveyanceAllowance) || 1200,
        washing_allowance: parseFloat(washingAllowance) || 500,
        special_allowance: specialAllowance.trim() ? parseFloat(specialAllowance) : null,
        tax_config: {
          pf_number: pfNumber.trim() || null,
          tax_regime: taxRegime as any,
          tds_percentage: parseFloat(tdsPercentage) || 0,
          epf_percentage: parseFloat(epfPercentage) || 0,
          hra_percentage: parseFloat(hraPercentage) || 0,
          pt_amount: parseFloat(ptAmount) || 0,
          custom_tax_percentage: parseFloat(tdsPercentage) || 0,
          esop_value: parseFloat(esopValue) || null,
          hra_type: hraType as any,
          epf_exempt: epfExempt === 'yes',
          conveyance_allowance: parseFloat(conveyanceAllowance) || 1200,
          washing_allowance: parseFloat(washingAllowance) || 500,
          special_allowance: specialAllowance.trim() ? parseFloat(specialAllowance) : null,
          custom_items: customItems,
        },
      });
      router.replace('/(hr)/employees' as never);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create employee');
    } finally {
      setLoading(false);
    }
  };

  // Dynamic Live Calculation
  const basic = parseFloat(basicSalary) || 0;
  const epfPct = parseFloat(epfPercentage) || 0;
  const epf = epfExempt === 'yes' ? 0 : Math.round((basic * epfPct) / 100);
  const tdsPct = parseFloat(tdsPercentage) || 0;
  const tds = Math.round((basic * tdsPct) / 100);
  const pt = parseFloat(ptAmount) || 0;
  const hraPct = parseFloat(hraPercentage) || 0;
  const hra = Math.round((basic * hraPct) / 100);
  const esop = parseFloat(esopValue) ? Math.round(parseFloat(esopValue) / 12) : 0;
  const conveyanceVal = parseFloat(conveyanceAllowance) || 0;
  const washingVal = parseFloat(washingAllowance) || 0;
  const customEarnings = customItems
    .filter((ci) => ci.type !== 'deduction')
    .reduce((sum, ci) => sum + (ci.amount_type === 'percentage' ? Math.round((basic * Number(ci.value)) / 100) : Number(ci.value)), 0);
  const customDeductions = customItems
    .filter((ci) => ci.type === 'deduction')
    .reduce((sum, ci) => sum + (ci.amount_type === 'percentage' ? Math.round((basic * Number(ci.value)) / 100) : Number(ci.value)), 0);
  const specialVal = specialAllowance.trim()
    ? parseFloat(specialAllowance) || 0
    : Math.max(0, (basic > 20000 ? basic : basic * 2) - (basic + hra + conveyanceVal + washingVal + customEarnings));
  const totalEarnings = basic + hra + conveyanceVal + washingVal + specialVal + customEarnings + esop;
  const totalDeductions = epf + tds + pt + customDeductions;
  const netEstimate = totalEarnings - totalDeductions;

  return (
    <SidebarLayout>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Button title="← Cancel" onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace('/'); } }} variant="ghost" size="sm" />
          <Text style={[styles.title, { color: colors.text }]}>Add New Employee</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView contentContainerStyle={styles.form}>
          {error ? (
            <View style={[styles.errorBox, { backgroundColor: colors.dangerLight }]}>
              <Text style={{ color: colors.danger }}>{error}</Text>
            </View>
          ) : null}

          {/* ─── Basic Info ─────────────────────────────────────────────── */}
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>PERSONAL INFORMATION</Text>

          <Input
            label="Full Name *"
            placeholder="e.g. Rahul Sharma"
            value={fullName}
            onChangeText={handleNameChange}
          />

          <Input
            label="Work Email Address *"
            placeholder="e.g. rahul.sharma@company.com"
            value={username}
            onChangeText={setUsername}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Input
            label="Employee Code *"
            value={empCode}
            onChangeText={setEmpCode}
            rightElement={
              <TouchableOpacity
                onPress={() => setEmpCode(generateRandomCode())}
                style={styles.randomBtn}
                activeOpacity={0.7}
              >
                <RefreshCw size={13} color="#0D7377" />
                <Text style={styles.randomBtnText}>Random</Text>
              </TouchableOpacity>
            }
          />

          <Input label="Phone Number *" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+91 98765 43210" />

          {/* ─── Login & Security Credentials ───────────────────────────── */}
          <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: 8 }]}>LOGIN & SECURITY CREDENTIALS</Text>

          <View style={[styles.credentialsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Input
              label="Initial Temporary Password *"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              rightElement={
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeBtn}
                  activeOpacity={0.7}
                >
                  {showPassword ? <EyeOff size={16} color="#64748B" /> : <Eye size={16} color="#64748B" />}
                </TouchableOpacity>
              }
            />

            <View style={[styles.policyNotice, { backgroundColor: '#edf8f6', borderColor: '#c4ece7' }]}>
              <ShieldCheck size={18} color="#006a61" style={{ marginTop: 2 }} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.policyNoticeTitle}>Force Password Change Enforced</Text>
                <Text style={styles.policyNoticeText}>
                  Default temporary password: <Text style={{ fontWeight: '700' }}>{password || 'Welcome@123'}</Text>. The employee will be required to set their own secure password immediately upon logging in for the first time.
                </Text>
              </View>
            </View>
          </View>
          <Input label="Designation / Position" placeholder="e.g. Chief Medical Officer" value={designation} onChangeText={setDesignation} />
          <Input label="Monthly Base Salary (INR) *" value={basicSalary} onChangeText={setBasicSalary} keyboardType="numeric" placeholder="50000" />

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Input
                label="Conveyance Allowance (₹)"
                placeholder="1200"
                value={conveyanceAllowance}
                onChangeText={setConveyanceAllowance}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label="Washing Allowance (₹)"
                placeholder="500"
                value={washingAllowance}
                onChangeText={setWashingAllowance}
                keyboardType="numeric"
              />
            </View>
          </View>

          <Input
            label="Special Allowance (₹) (Optional - auto balances if left blank)"
            placeholder="e.g. 13300"
            value={specialAllowance}
            onChangeText={setSpecialAllowance}
            keyboardType="numeric"
          />

          <CustomPayrollItemsManager
            items={customItems}
            onChange={setCustomItems}
            basicSalary={parseFloat(basicSalary) || 0}
          />

          {/* ─── Org Structure ──────────────────────────────────────────── */}
          <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: 8 }]}>ORGANISATION & UNIT</Text>

          {/* Locked Active Org */}
          <View style={{ backgroundColor: colors.surface, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <View>
              <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textSecondary, letterSpacing: 0.5 }}>PARENT ORGANIZATION</Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 2 }}>
                {tenantOrg?.name || 'Shanti Memorial Hospital'}
              </Text>
            </View>
            <View style={{ backgroundColor: '#E2E8F0', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#475569' }}>SCOPED</Text>
            </View>
          </View>

          {/* Unit / Sub-Brand Selector */}
          <Select
            label="Hospital Unit / Sub-Brand *"
            options={HOSPITAL_UNITS.map((u) => ({ label: u, value: u }))}
            value={hospitalUnit}
            onValueChange={(val) => setHospitalUnit(val || 'Shanti Memorial Hospital')}
          />

          {/* Employment Category */}
          <Select
            label="Employment Category *"
            options={[
              { label: 'Regular (Direct Payroll)', value: 'Regular' },
              { label: 'Contractual (Contract Basis)', value: 'Contractual' },
            ]}
            value={employmentType}
            onValueChange={(val) => setEmploymentType(val || 'Regular')}
          />

          <Input
            label="Grade / Band (e.g. M1, M2, N2, N4, Housekeeping)"
            placeholder="e.g. M1"
            value={grade}
            onChangeText={setGrade}
          />

          <Select
            label="Department"
            options={departments.map((d) => ({ label: d.name, value: d.id }))}
            value={deptId}
            onValueChange={handleDeptChange}
          />

          <Select
            label="Primary Workplace (Location)"
            options={workplaces.map((w) => ({ label: w.name, value: w.id }))}
            value={workplaceId}
            onValueChange={setWorkplaceId}
          />

          {/* ─── Reporting Hierarchy (4-Tier Approval Chain) ─── */}
          <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: 16 }]}>
            REPORTING HIERARCHY (4-TIER APPROVAL CHAIN)
          </Text>
          <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 14, gap: 12 }}>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 2 }}>
              Configure the 4-tier chain for leave approvals, duty rosters, and escalation hierarchy.
            </Text>

            <Select
              label="L1 Manager (Immediate Reporting Supervisor)"
              options={[
                { label: 'None / Not Assigned', value: '' },
                ...managers.map((m) => ({
                  label: `${m.profile?.full_name || 'Staff'} (${m.employee_code || 'EMP'}${m.designation ? ' - ' + m.designation : ''})`,
                  value: m.id,
                })),
              ]}
              value={l1ManagerId || managerId || ''}
              onValueChange={(val) => {
                setL1ManagerId(val || null);
                setManagerId(val || null);
              }}
            />

            <Select
              label="L2 Manager (Department Head / HOD)"
              options={[
                { label: 'None / Not Assigned', value: '' },
                ...managers.map((m) => ({
                  label: `${m.profile?.full_name || 'Staff'} (${m.employee_code || 'EMP'}${m.designation ? ' - ' + m.designation : ''})`,
                  value: m.id,
                })),
              ]}
              value={l2ManagerId || ''}
              onValueChange={(val) => setL2ManagerId(val || null)}
            />

            <Select
              label="L3 Manager (HR Manager / Operations Head)"
              options={[
                { label: 'None / Not Assigned', value: '' },
                ...managers.map((m) => ({
                  label: `${m.profile?.full_name || 'Staff'} (${m.employee_code || 'EMP'}${m.designation ? ' - ' + m.designation : ''})`,
                  value: m.id,
                })),
              ]}
              value={l3ManagerId || ''}
              onValueChange={(val) => setL3ManagerId(val || null)}
            />

            <Select
              label="L4 Manager (Director / Medical Superintendent / Admin)"
              options={[
                { label: 'None / Not Assigned', value: '' },
                ...managers.map((m) => ({
                  label: `${m.profile?.full_name || 'Staff'} (${m.employee_code || 'EMP'}${m.designation ? ' - ' + m.designation : ''})`,
                  value: m.id,
                })),
              ]}
              value={l4ManagerId || ''}
              onValueChange={(val) => setL4ManagerId(val || null)}
            />
          </View>

          <Select
            label="Default Shift (For Attendance) *"
            placeholder="Select a shift..."
            options={shifts.map((s) => ({ label: `${s.name} (${s.start_time} - ${s.end_time})`, value: s.id }))}
            value={shiftId || ''}
            onValueChange={(val) => setShiftId(val || null)}
          />

          <Select
            label="System Role"
            options={[
              { label: 'Employee', value: 'employee' },
              { label: 'HR Manager', value: 'hr' },
              { label: 'Administrator', value: 'admin' },
            ]}
            value={role}
            onValueChange={(val) => setRole(val || 'employee')}
          />

          {/* ─── Home Health Care (HHC) Provider Configuration ─── */}
          <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: 16 }]}>
            HEALTHCARE & EXTENSION ROLES
          </Text>

          <View
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
                <Text style={[styles.hhcTitle, { color: colors.text }]}>
                  Home Health Care (HHC) Provider
                </Text>
                {isHhcEnabled && (
                  <View style={styles.hhcBadgeActive}>
                    <Text style={styles.hhcBadgeActiveText}>ACTIVE DOCTOR / NURSE</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.hhcSubtitle, { color: colors.textSecondary }]}>
                Enable this staff member/doctor to be assigned patient care leads in the Home Health Care Portal and perform field visits.
              </Text>
            </View>
            <Switch
              value={isHhcEnabled}
              onValueChange={setIsHhcEnabled}
              trackColor={{ false: '#E2E8F0', true: '#0D7377' }}
              thumbColor="#FFFFFF"
            />
          </View>


          {/* ─── Tax & Statutory Configuration ──────────────────────────── */}
          <TouchableOpacity
            style={[styles.taxToggle, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setShowTaxSection(!showTaxSection)}
            activeOpacity={0.7}
          >
            <View style={styles.taxToggleLeft}>
              <View style={styles.taxIconWrap}>
                <ShieldCheck size={18} color="#0D7377" />
              </View>
              <View>
                <Text style={[styles.taxToggleTitle, { color: colors.text }]}>Custom Tax Regime & Percentages</Text>
                <Text style={[styles.taxToggleSub, { color: colors.textSecondary }]}>Configure & edit custom TDS, EPF, HRA, and PT</Text>
              </View>
            </View>
            {showTaxSection
              ? <ChevronUp size={18} color={colors.textSecondary} />
              : <ChevronDown size={18} color={colors.textSecondary} />}
          </TouchableOpacity>

          {showTaxSection && (
            <View style={[styles.taxCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Select
                label="Tax Regime Configuration"
                options={[
                  { label: 'New Regime (Standard 2024-25 Default Slabs)', value: 'new' },
                  { label: 'Old Regime (Standard Old Tax Slabs & Exemptions)', value: 'old' },
                  { label: 'Custom Regime (Fully Editable Custom Percentages)', value: 'custom' },
                ]}
                value={taxRegime}
                onValueChange={(v) => setTaxRegime(v || 'new')}
              />

              <View style={styles.customGrid}>
                <View style={{ flex: 1 }}>
                  <Input
                    label="TDS Deduction (%)"
                    placeholder="e.g. 10"
                    value={tdsPercentage}
                    onChangeText={setTdsPercentage}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="EPF Contribution (%)"
                    placeholder="12"
                    value={epfPercentage}
                    onChangeText={setEpfPercentage}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.customGrid}>
                <View style={{ flex: 1 }}>
                  <Input
                    label="HRA Rate (%)"
                    placeholder="40"
                    value={hraPercentage}
                    onChangeText={setHraPercentage}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Professional Tax (₹)"
                    placeholder="200"
                    value={ptAmount}
                    onChangeText={setPtAmount}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <Input
                label="PF / EPF Member Number (UAN)"
                placeholder="e.g. 100XXXXXXXXX"
                value={pfNumber}
                onChangeText={setPfNumber}
                autoCapitalize="characters"
              />

              <Select
                label="EPF Exemption Status"
                options={[
                  { label: 'Applicable — standard deduction', value: 'no' },
                  { label: 'Exempt (contractual or salary opt-out)', value: 'yes' },
                ]}
                value={epfExempt}
                onValueChange={(v) => setEpfExempt(v || 'no')}
              />

              <Select
                label="City Classification (HRA Presets)"
                options={[
                  { label: 'Non-Metro City (40% Default)', value: 'non-metro' },
                  { label: 'Metro City (50% Default)', value: 'metro' },
                  { label: 'Custom Percentage Set Above', value: 'custom' },
                ]}
                value={hraType}
                onValueChange={(v) => setHraType(v || 'non-metro')}
              />

              <Input
                label="Annual ESOP Value (INR)"
                placeholder="e.g. 120000"
                value={esopValue}
                onChangeText={setEsopValue}
                keyboardType="numeric"
              />

              {/* Live payroll estimate */}
              {Boolean(basic > 0) ? (
                <View style={[styles.estimateBox, { backgroundColor: '#edf8f6', borderColor: '#c4ece7' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={styles.estimateTitle}>Live Payroll Calculation</Text>
                    <Text style={{ fontSize: 11, color: '#006a61', fontWeight: '700' }}>
                      {taxRegime.toUpperCase()} REGIME
                    </Text>
                  </View>

                  <View style={styles.estimateRow}>
                    <Text style={styles.estimateLabel}>Basic Salary</Text>
                    <Text style={styles.estimateVal}>₹{basic.toLocaleString('en-IN')}</Text>
                  </View>

                  <View style={styles.estimateRow}>
                    <Text style={styles.estimateLabel}>HRA ({hraPct}%)</Text>
                    <Text style={[styles.estimateVal, { color: '#006a61' }]}>+₹{hra.toLocaleString('en-IN')}</Text>
                  </View>

                  <View style={styles.estimateRow}>
                    <Text style={styles.estimateLabel}>Conveyance Allowance</Text>
                    <Text style={[styles.estimateVal, { color: '#006a61' }]}>+₹{conveyanceVal.toLocaleString('en-IN')}</Text>
                  </View>

                  <View style={styles.estimateRow}>
                    <Text style={styles.estimateLabel}>Washing Allowance</Text>
                    <Text style={[styles.estimateVal, { color: '#006a61' }]}>+₹{washingVal.toLocaleString('en-IN')}</Text>
                  </View>

                  {specialVal > 0 ? (
                    <View style={styles.estimateRow}>
                      <Text style={styles.estimateLabel}>Special Allowance</Text>
                      <Text style={[styles.estimateVal, { color: '#006a61' }]}>+₹{specialVal.toLocaleString('en-IN')}</Text>
                    </View>
                  ) : null}

                  {customEarnings > 0 ? (
                    <View style={styles.estimateRow}>
                      <Text style={styles.estimateLabel}>Custom Earnings / Bonuses</Text>
                      <Text style={[styles.estimateVal, { color: '#006a61' }]}>+₹{customEarnings.toLocaleString('en-IN')}</Text>
                    </View>
                  ) : null}

                  {esop > 0 ? (
                    <View style={styles.estimateRow}>
                      <Text style={styles.estimateLabel}>ESOP (Monthly Spread)</Text>
                      <Text style={[styles.estimateVal, { color: '#006a61' }]}>+₹{esop.toLocaleString('en-IN')}</Text>
                    </View>
                  ) : null}

                  <View style={[styles.estimateDivider]} />

                  <View style={styles.estimateRow}>
                    <Text style={styles.estimateLabel}>EPF ({epfPct}%)</Text>
                    <Text style={[styles.estimateVal, { color: '#dc2626' }]}>-₹{epf.toLocaleString('en-IN')}</Text>
                  </View>

                  <View style={styles.estimateRow}>
                    <Text style={styles.estimateLabel}>TDS / Income Tax ({tdsPct}%)</Text>
                    <Text style={[styles.estimateVal, { color: '#dc2626' }]}>-₹{tds.toLocaleString('en-IN')}</Text>
                  </View>

                  <View style={styles.estimateRow}>
                    <Text style={styles.estimateLabel}>Professional Tax</Text>
                    <Text style={[styles.estimateVal, { color: '#dc2626' }]}>-₹{pt.toLocaleString('en-IN')}</Text>
                  </View>

                  {customDeductions > 0 ? (
                    <View style={styles.estimateRow}>
                      <Text style={styles.estimateLabel}>Custom Deductions</Text>
                      <Text style={[styles.estimateVal, { color: '#dc2626' }]}>-₹{customDeductions.toLocaleString('en-IN')}</Text>
                    </View>
                  ) : null}

                  <View style={[styles.estimateDivider]} />

                  <View style={styles.estimateRow}>
                    <Text style={[styles.estimateLabel, { fontWeight: '800', color: '#006a61' }]}>Estimated Net Salary</Text>
                    <Text style={[styles.estimateVal, { fontWeight: '800', color: '#006a61', fontSize: 16 }]}>
                      ₹{Math.max(netEstimate, 0).toLocaleString('en-IN')}
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>
          )}

          <Button
            title="Create & Onboard Employee"
            onPress={handleCreate}
            loading={loading}
            size="lg"
            style={{ marginTop: 16 }}
          />
        </ScrollView>
      </View>
    </SidebarLayout>
  );
}

const styles = StyleSheet.create({
  hhcCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    marginVertical: 6,
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
    letterSpacing: 0.5,
  },

  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  title: { fontSize: 20, fontWeight: '700' },
  form: { padding: 24, maxWidth: 680, width: '100%', alignSelf: 'center', gap: 6, paddingBottom: 48 },
  errorBox: { padding: 12, borderRadius: 8, marginBottom: 12 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 4,
  },

  domainBadge: {
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderLeftWidth: 1,
    borderLeftColor: '#CBD5E1',
    alignSelf: 'stretch',
  },
  domainText: { fontSize: 13, fontWeight: '600', color: '#64748B' },

  randomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    backgroundColor: '#E6F4F4',
    borderLeftWidth: 1,
    borderLeftColor: '#CBD5E1',
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  randomBtnText: { fontSize: 12, fontWeight: '700', color: '#0D7377' },

  credentialsCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    marginTop: 4,
  },
  eyeBtn: {
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: '#CBD5E1',
    alignSelf: 'stretch',
  },
  policyNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  policyNoticeTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#006a61',
  },
  policyNoticeText: {
    fontSize: 12,
    lineHeight: 17,
    color: '#006a61',
  },

  taxToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
  },
  taxToggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  taxIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#edf8f6', alignItems: 'center', justifyContent: 'center' },
  taxToggleTitle: { fontSize: 14, fontWeight: '700' },
  taxToggleSub: { fontSize: 12, marginTop: 1 },

  taxCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    marginTop: 4,
  },

  customGrid: {
    flexDirection: 'row',
    gap: 12,
  },

  estimateBox: {
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 8,
    gap: 6,
  },
  estimateTitle: { fontSize: 13, fontWeight: '700', color: '#0D7377', marginBottom: 4 },
  estimateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
  estimateLabel: { fontSize: 13, color: '#475569', fontWeight: '500' },
  estimateVal: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  estimateDivider: { height: 1, backgroundColor: '#c4ece7', marginVertical: 4 },
});
