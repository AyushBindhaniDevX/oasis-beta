import { HR_NAV, ADMIN_NAV } from '@/constants/navigation';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  RefreshControl,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/context/TenantContext';
import { useTheme } from '@/hooks/use-theme';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { LoadingState } from '@/components/ui/States';
import { SidebarLayout } from '@/components/layout/Sidebar';
import {
  getPayrollEntries,
  createPayrollEntry,
  processPayrollPeriod,
  distributePayroll,
  updatePayrollEntry,
  generatePayslipForEntry,
  recalculatePeriodEntries,
  calculateStatutoryForEmployee,
} from '@/lib/services/payroll';
import { getAllEmployees } from '@/lib/services/employee';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { formatCurrency } from '@/utils/format';
import {
  MONTHS,
  HOSPITAL_UNITS,
  EMPLOYMENT_TYPES,
  normalizeHospitalUnit,
  normalizeEmploymentType,
} from '@/constants/config';
import { CustomPayrollItemsManager } from '@/components/payroll/CustomPayrollItemsManager';
import type { Payroll, PayrollPeriod, Employee, CustomPayrollItem } from '@/types';
import {
  ChevronLeft,
  RefreshCw,
  Sparkles,
  Calculator,
  ShieldCheck,
  CheckCircle2,
  FileText,
  CreditCard,
  DollarSign,
  TrendingDown,
  Percent,
  Sliders,
  Send,
  Lock,
  Download,
  Printer,
  Building2,
  Briefcase,
  Search,
  FileSpreadsheet,
} from 'lucide-react-native';

import { exportExcel, exportTxt } from '@/utils/excel';
import {
  exportSalaryRegisterPdf,
  exportSalaryRegisterExcel,
} from '@/utils/salary-register-export';

export default function PayrollDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useTheme();
  const { profile } = useAuth();
  const { organization: tenantOrg } = useTenant();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const [period, setPeriod] = useState<PayrollPeriod | null>(null);
  const [entries, setEntries] = useState<Payroll[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [distributing, setDistributing] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatingSlip, setGeneratingSlip] = useState<string | null>(null);
  const [generatedSlips, setGeneratedSlips] = useState<Set<string>>(new Set());

  // Filter & Search states
  const [selectedUnit, setSelectedUnit] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<'All' | 'Regular' | 'Contractual'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  // Form state
  const [selEmpId, setSelEmpId] = useState<string | null>(null);
  const [basicSalary, setBasicSalary] = useState('');
  const [hra, setHra] = useState('0');
  const [ta, setTa] = useState('0');
  const [pf, setPf] = useState('0');
  const [tax, setTax] = useState('0');
  const [lopDays, setLopDays] = useState('0');
  const [entryCustomItems, setEntryCustomItems] = useState<CustomPayrollItem[]>([]);
  const [adding, setAdding] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Payroll | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const orgId = tenantOrg?.id || profile?.organization_id;
      const [periodSnap, entriesData, emps] = await Promise.all([
        getDoc(doc(db, 'payroll_periods', id!)),
        getPayrollEntries(id!),
        getAllEmployees(orgId),
      ]);
      const p = periodSnap.exists() ? ({ id: periodSnap.id, ...periodSnap.data() } as PayrollPeriod) : null;
      setPeriod(p);
      setEntries(entriesData);
      setEmployees(emps);
      if (p?.hospital_unit || (p as any)?.unit) {
        setSelectedUnit(p?.hospital_unit || (p as any)?.unit || 'All');
      }
      if (emps.length > 0 && !selEmpId) {
        setSelEmpId(emps[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load payroll details. Please check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, profile, tenantOrg, selEmpId]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
  };

  const handleSelectEmployee = async (empId: string | null) => {
    setSelEmpId(empId);
    if (!empId || !period) return;
    const emp = employees.find((e) => e.id === empId);
    if (emp) {
      const breakdown = await calculateStatutoryForEmployee(emp, period.month, period.year);
      setBasicSalary(String(breakdown.basic_salary));
      setHra(String(breakdown.allowances?.['HRA'] || 0));
      setTa(String(breakdown.allowances?.['Special Allowance'] || 0));
      setPf(String(breakdown.deductions?.['EPF'] || 0));
      setTax(String(breakdown.deductions?.['TDS'] || 0));
      setLopDays(String(breakdown.lop_days || 0));
      const tc = (emp as any).tax_config || {};
      setEntryCustomItems(Array.isArray(tc.custom_items) ? tc.custom_items : []);
    }
  };

  const openEdit = (entry: Payroll) => {
    setEditingEntry(entry);
    setBasicSalary(String(entry.basic_salary));
    setHra(String(entry.allowances?.hra || entry.allowances?.HRA || 0));
    setTa(String(entry.allowances?.ta || entry.allowances?.['Special Allowance'] || 0));
    setPf(String(entry.deductions?.pf || entry.deductions?.EPF || 0));
    setTax(String(entry.deductions?.tax || entry.deductions?.TDS || 0));
    setLopDays(String(entry.lop_days || 0));
    const emp = entry.employee as any;
    const tc = emp?.tax_config || {};
    setEntryCustomItems(Array.isArray(tc.custom_items) ? tc.custom_items : []);
  };

  const handleResetToStatutory = async () => {
    if (!editingEntry || !period) return;
    const emp = editingEntry.employee as any;
    if (emp) {
      const breakdown = await calculateStatutoryForEmployee(emp, period.month, period.year);
      setBasicSalary(String(breakdown.basic_salary));
      setHra(String(breakdown.allowances?.['HRA'] || 0));
      setTa(String(breakdown.allowances?.['Special Allowance'] || 0));
      setPf(String(breakdown.deductions?.['EPF'] || 0));
      setTax(String(breakdown.deductions?.['TDS'] || 0));
      setLopDays(String(breakdown.lop_days || 0));
      const tc = (emp as any).tax_config || {};
      setEntryCustomItems(Array.isArray(tc.custom_items) ? tc.custom_items : []);
    }
  };

  const handleUpdate = async () => {
    if (!editingEntry) return;
    setAdding(true);
    try {
      const basic = parseFloat(basicSalary) || 0;
      const lopd = parseFloat(lopDays) || 0;
      const lopa = Math.round((basic / 26) * lopd);

      const aHra = parseFloat(hra) || 0;
      const aTa = parseFloat(ta) || 0;
      const dPf = parseFloat(pf) || 0;
      const dTax = parseFloat(tax) || 0;

      const allowances: Record<string, number> = { 'HRA': aHra, 'Special Allowance': aTa };
      const deductions: Record<string, number> = { 'EPF': dPf, 'TDS': dTax };

      entryCustomItems.forEach((item) => {
        if (!item.name || !item.value) return;
        const computedVal = item.amount_type === 'percentage'
          ? Math.round((basic * Number(item.value)) / 100)
          : Math.round(Number(item.value));
        if (item.type === 'deduction') {
          deductions[item.name] = computedVal;
        } else {
          allowances[item.name] = computedVal;
        }
      });

      const totalAllowances = Object.values(allowances).reduce((sum, v) => sum + v, 0);
      const totalDeductions = Object.values(deductions).reduce((sum, v) => sum + v, 0);
      const gross = basic + totalAllowances - lopa;
      const net = Math.max(0, gross - totalDeductions);

      await updatePayrollEntry(editingEntry.id, {
        basic_salary: basic,
        allowances,
        deductions,
        lop_days: lopd,
        lop_amount: lopa,
        gross_salary: gross,
        net_salary: net,
      });
      setEditingEntry(null);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Could not save changes to this payroll entry.');
    }
    setAdding(false);
  };

  const handleAddEntry = async () => {
    if (!selEmpId || !basicSalary || !period) return;
    setAdding(true);
    const basic = parseFloat(basicSalary) || 0;
    const allowances: Record<string, number> = { 'HRA': parseFloat(hra) || 0, 'Special Allowance': parseFloat(ta) || 0 };
    const deductions: Record<string, number> = { 'EPF': parseFloat(pf) || 0, 'TDS': parseFloat(tax) || 0 };

    entryCustomItems.forEach((item) => {
      if (!item.name || !item.value) return;
      const computedVal = item.amount_type === 'percentage'
        ? Math.round((basic * Number(item.value)) / 100)
        : Math.round(Number(item.value));
      if (item.type === 'deduction') {
        deductions[item.name] = computedVal;
      } else {
        allowances[item.name] = computedVal;
      }
    });

    const totalAllowances = Object.values(allowances).reduce((a, b) => a + b, 0);
    const totalDeductions = Object.values(deductions).reduce((a, b) => a + b, 0);
    const lDays = parseFloat(lopDays) || 0;
    const lopAmount = lDays > 0 ? Math.round((basic / 26) * lDays) : 0;
    const gross = basic + totalAllowances - lopAmount;
    const net = Math.max(0, gross - totalDeductions);

    try {
      await createPayrollEntry({
        payroll_period_id: id!,
        employee_id: selEmpId,
        basic_salary: basic,
        allowances,
        deductions,
        lop_days: lDays,
        lop_amount: lopAmount,
        gross_salary: gross,
        net_salary: net,
      });
      setShowAdd(false);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Could not add this payroll entry.');
    }
    setAdding(false);
  };

  const handleSyncRecalculate = async () => {
    if (!id) return;
    setRecalculating(true);
    try {
      await recalculatePeriodEntries(id);
      await load();
    } catch (e) {
      console.error('Recalculate error:', e);
    } finally {
      setRecalculating(false);
    }
  };

  const handleProcess = async () => {
    setProcessing(true);
    setError(null);
    try {
      await processPayrollPeriod(id!);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Could not finalize this payroll period.');
    }
    setProcessing(false);
  };

  const handleDistribute = async () => {
    setDistributing(true);
    setError(null);
    try {
      await distributePayroll(id!, period!.month, period!.year);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Could not distribute payslips for this period.');
    }
    setDistributing(false);
  };

  const handleGenerateSlip = async (entry: Payroll) => {
    if (!period) return;
    setGeneratingSlip(entry.id);
    try {
      await generatePayslipForEntry(entry, period.month, period.year);
      setGeneratedSlips((prev) => new Set([...prev, entry.id]));
    } catch (e) {
      console.error('Generate slip error:', e);
    } finally {
      setGeneratingSlip(null);
    }
  };

  // Filtered entries according to unit, employment type category, and search query
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const emp = entry.employee as any;
      const unit = normalizeHospitalUnit(entry.hospital_unit || emp?.hospital_unit);
      const category = normalizeEmploymentType(entry.employment_type || emp?.employment_type);
      const name = (emp?.profile?.full_name || '').toLowerCase();
      const code = (emp?.employee_code || emp?.id || '').toLowerCase();
      const q = searchQuery.trim().toLowerCase();

      if (selectedUnit !== 'All' && unit !== selectedUnit) return false;
      if (selectedCategory !== 'All' && category !== selectedCategory) return false;
      if (q && !name.includes(q) && !code.includes(q)) return false;

      return true;
    });
  }, [entries, selectedUnit, selectedCategory, searchQuery]);

  // Export Prescribed 28-Column Salary Register as PDF / Landscape Print
  const handleExportRegisterPdf = async () => {
    if (!period) return;
    if (filteredEntries.length === 0) {
      Alert.alert('No Data', 'No payroll entries found for the selected unit and employment filter.');
      return;
    }
    setExportingPdf(true);
    try {
      const activeUnit = selectedUnit !== 'All' ? selectedUnit : period.hospital_unit || (period as any).unit || undefined;
      await exportSalaryRegisterPdf({
        period,
        entries: filteredEntries,
        unitName: activeUnit,
        employmentType: selectedCategory,
        organization: tenantOrg,
      });
    } catch (err: any) {
      console.error('Export PDF error:', err);
      Alert.alert('Export Failed', err?.message || 'Could not generate salary register PDF.');
    } finally {
      setExportingPdf(false);
    }
  };

  // Export Prescribed Multi-Sheet Salary Register as Excel
  const handleExportRegisterExcel = async () => {
    if (!period) return;
    if (filteredEntries.length === 0) {
      Alert.alert('No Data', 'No payroll entries found for the selected unit and employment filter.');
      return;
    }
    setExportingExcel(true);
    try {
      const activeUnit = selectedUnit !== 'All' ? selectedUnit : period.hospital_unit || (period as any).unit || undefined;
      await exportSalaryRegisterExcel({
        period,
        entries: filteredEntries,
        unitName: activeUnit,
        employmentType: selectedCategory,
        organization: tenantOrg,
      });
    } catch (err: any) {
      console.error('Export Excel error:', err);
      Alert.alert('Export Failed', err?.message || 'Could not generate salary register Excel.');
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportECR = async () => {
    if (filteredEntries.length === 0) {
      Alert.alert('Validation Error', 'No payroll entries found for ECR generation.');
      return;
    }

    const lines = filteredEntries.map((entry) => {
      const emp = entry.employee as any;
      const tc = emp?.tax_config || {};
      const uan = tc.uan_number || tc.pf_number || '';
      const name = emp?.profile?.full_name || '';
      const gross = Math.round(entry.gross_salary || 0);
      const epfWages = Math.min(Math.round(entry.basic_salary || 0), 15000);
      const epsWages = epfWages;
      const edliWages = epfWages;
      const epfContri = Math.round(entry.deductions?.['EPF'] || entry.deductions?.['pf'] || 0);
      const epsContri = Math.round((epsWages * 8.33) / 100);
      const epfDiff = Math.round((epfWages * 3.67) / 100);
      const ncpDays = entry.lop_days || 0;
      const refund = 0;

      return `${uan}#~#${name}#~#${gross}#~#${epfWages}#~#${epsWages}#~#${edliWages}#~#${epfContri}#~#${epsContri}#~#${epfDiff}#~#${ncpDays}#~#${refund}`;
    });

    const content = lines.join('\n');
    await exportTxt(`ECR_${period?.month}_${period?.year}`, content);
  };

  const handleExportESI = async () => {
    if (filteredEntries.length === 0) {
      Alert.alert('Validation Error', 'No payroll entries found for ESI generation.');
      return;
    }

    const rows = filteredEntries.map((entry) => {
      const emp = entry.employee as any;
      const tc = emp?.tax_config || {};
      const ipNum = tc.esi_number || '';
      const name = emp?.profile?.full_name || '';
      const sanitizedName = name.replace(/[^a-zA-Z\s]/g, '');
      const days = 30 - (entry.lop_days || 0);
      const gross = Math.round(entry.gross_salary || 0);
      const reasonCode = days === 0 ? '2' : '';
      const lwd = '';

      return [ipNum, sanitizedName, days, gross, reasonCode, lwd];
    });

    const headers = ['IP Number', 'IP Name', 'No. of Days', 'Total Monthly Wages', 'Reason Code', 'Last Working Day'];
    await exportExcel(`ESI_${period?.month}_${period?.year}`, [{ name: 'ESI Voucher', headers, rows }]);
  };

  if (loading) return <LoadingState />;

  const totalGross = filteredEntries.reduce((sum, e) => sum + (e.gross_salary || 0), 0);
  const totalNet = filteredEntries.reduce((sum, e) => sum + (e.net_salary || 0), 0);
  const totalEpf = filteredEntries.reduce((sum, e) => sum + (e.deductions?.['EPF'] || e.deductions?.['pf'] || 0), 0);
  const totalTds = filteredEntries.reduce((sum, e) => sum + (e.deductions?.['TDS'] || e.deductions?.['tax'] || 0), 0);

  const navItems = profile?.role === 'admin' ? ADMIN_NAV : HR_NAV;

  const unitBadgeColor = (u: string) => {
    if (u === 'Shanti Memorial Hospital') return { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' };
    if (u === 'Gopal Trust') return { bg: '#FDF2F8', text: '#BE185D', border: '#FBCFE8' };
    if (u === 'Chikitsa') return { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' };
    return { bg: '#F3F4F6', text: '#4B5563', border: '#E5E7EB' };
  };

  return (
    <SidebarLayout items={navItems}>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Top Header ──────────────────────────────────────────────────── */}
        <View style={styles.headerRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 280 }}>
            <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { borderColor: colors.border }]}>
              <ChevronLeft size={20} color={colors.text} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Text style={[styles.title, { color: colors.text }]}>
                  {period ? `${MONTHS[period.month - 1]} ${period.year} Salary Register` : 'Payroll Details'}
                </Text>
                {period?.hospital_unit ? (
                  <View style={[styles.unitChip, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                    <Building2 size={13} color="#2563EB" />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#1D4ED8' }}>
                      {period.hospital_unit}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.subTitle, { color: colors.textSecondary }]}>
                Standard 28-column format with unit separation and Regular / Contractual categorization.
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {period?.status === 'open' && (
              <>
                <TouchableOpacity
                  style={[styles.syncBtn, { borderColor: colors.primary, backgroundColor: colors.surface }]}
                  onPress={handleSyncRecalculate}
                  disabled={recalculating}
                >
                  <RefreshCw size={15} color={colors.primary} />
                  <Text style={[styles.syncBtnText, { color: colors.primary }]}>
                    {recalculating ? 'Syncing...' : 'Sync Profiles'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.addBtn, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    handleSelectEmployee(employees[0]?.id || null);
                    setShowAdd(true);
                  }}
                >
                  <Text style={styles.addBtnText}>+ Add Custom Entry</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* ── Inline Error Banner ─────────────────────────────────────────── */}
        {error ? (
          <View style={{ backgroundColor: colors.dangerLight, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ flex: 1, color: colors.danger, fontSize: 13, fontWeight: '600' }}>{error}</Text>
            <TouchableOpacity onPress={() => setError(null)}>
              <Text style={{ color: colors.danger, fontWeight: '800', fontSize: 13 }}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ── PRESCRIBED SALARY REGISTER EXPORT BAR ────────────────────────── */}
        <View style={[styles.exportCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.exportCardTop}>
            <View style={{ flex: 1, minWidth: 240 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <FileSpreadsheet size={20} color={colors.primary} />
                <Text style={[styles.exportTitle, { color: colors.text }]}>
                  Monthly Salary Report Register (Prescribed Format)
                </Text>
              </View>
              <Text style={[styles.exportSub, { color: colors.textSecondary }]}>
                Generates the exact 28-column sheet with unit header, paid days, breakdown, statutory withholdings, and signature blocks.
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <TouchableOpacity
                style={[styles.exportActionBtn, { backgroundColor: '#1E40AF' }]}
                onPress={handleExportRegisterPdf}
                disabled={exportingPdf}
              >
                <Printer size={16} color="#FFF" />
                <Text style={styles.exportActionBtnText}>
                  {exportingPdf ? 'Preparing PDF...' : 'Print / Download PDF Register'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.exportActionBtn, { backgroundColor: '#059669' }]}
                onPress={handleExportRegisterExcel}
                disabled={exportingExcel}
              >
                <Download size={16} color="#FFF" />
                <Text style={styles.exportActionBtnText}>
                  {exportingExcel ? 'Generating...' : 'Export Excel Register'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Unit & Employment Type Filter Tabs */}
          <View style={[styles.filterBar, { borderTopColor: colors.border }]}>
            {/* Unit Filter */}
            <View style={styles.filterSection}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 6 }}>
                <Building2 size={14} color={colors.textSecondary} />
                <Text style={{ fontSize: 11, fontWeight: '800', color: colors.textSecondary }}>UNIT:</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {['All', ...HOSPITAL_UNITS].map((u) => {
                  const active = selectedUnit === u;
                  return (
                    <TouchableOpacity
                      key={u}
                      onPress={() => setSelectedUnit(u)}
                      style={[
                        styles.chipBtn,
                        {
                          backgroundColor: active ? colors.primary : colors.background,
                          borderColor: active ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.chipBtnText, { color: active ? '#FFF' : colors.text }]}>
                        {u === 'All' ? 'All Units' : u}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Employment Type Filter */}
            <View style={styles.filterSection}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 6 }}>
                <Briefcase size={14} color={colors.textSecondary} />
                <Text style={{ fontSize: 11, fontWeight: '800', color: colors.textSecondary }}>TYPE:</Text>
              </View>
              {(['All', 'Regular', 'Contractual'] as const).map((cat) => {
                const active = selectedCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setSelectedCategory(cat)}
                    style={[
                      styles.chipBtn,
                      {
                        backgroundColor: active ? '#7C3AED' : colors.background,
                        borderColor: active ? '#7C3AED' : colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.chipBtnText, { color: active ? '#FFF' : colors.text }]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* ── Summary KPI Cards for Active Selection ────────────────────────── */}
        <View style={styles.kpiGrid}>
          {/* Total Net */}
          <View style={[styles.kpiCard, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
            <View style={[styles.kpiIcon, { backgroundColor: '#DCFCE7' }]}>
              <DollarSign size={22} color="#16A34A" />
            </View>
            <View>
              <Text style={[styles.kpiLabel, { color: '#166534' }]}>TOTAL NET PAYOUT</Text>
              <Text style={[styles.kpiValue, { color: '#14532D' }]}>{formatCurrency(totalNet)}</Text>
              <Text style={[styles.kpiSub, { color: '#15803D' }]}>{filteredEntries.length} Listed Employees</Text>
            </View>
          </View>

          {/* Total Gross */}
          <View style={[styles.kpiCard, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
            <View style={[styles.kpiIcon, { backgroundColor: '#DBEAFE' }]}>
              <CreditCard size={22} color="#2563EB" />
            </View>
            <View>
              <Text style={[styles.kpiLabel, { color: '#1E40AF' }]}>GROSS COMPENSATION</Text>
              <Text style={[styles.kpiValue, { color: '#1E3A8A' }]}>{formatCurrency(totalGross)}</Text>
              <Text style={[styles.kpiSub, { color: '#3B82F6' }]}>Basic + Allowances</Text>
            </View>
          </View>

          {/* EPF Withholding */}
          <View style={[styles.kpiCard, { backgroundColor: '#FAF5FF', borderColor: '#E9D5FF' }]}>
            <View style={[styles.kpiIcon, { backgroundColor: '#F3E8FF' }]}>
              <ShieldCheck size={22} color="#9333EA" />
            </View>
            <View>
              <Text style={[styles.kpiLabel, { color: '#6B21A8' }]}>TOTAL EPF DEDUCTIONS</Text>
              <Text style={[styles.kpiValue, { color: '#581C87' }]}>{formatCurrency(totalEpf)}</Text>
              <Text style={[styles.kpiSub, { color: '#7E22CE' }]}>Provident Fund Remittance</Text>
            </View>
          </View>

          {/* TDS Withholding */}
          <View style={[styles.kpiCard, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
            <View style={[styles.kpiIcon, { backgroundColor: '#FDE68A' }]}>
              <Percent size={22} color="#D97706" />
            </View>
            <View>
              <Text style={[styles.kpiLabel, { color: '#92400E' }]}>TOTAL TDS WITHHELD</Text>
              <Text style={[styles.kpiValue, { color: '#78350F' }]}>{formatCurrency(totalTds)}</Text>
              <Text style={[styles.kpiSub, { color: '#B45309' }]}>Income Tax Withholding</Text>
            </View>
          </View>
        </View>

        {/* ── Payroll Entries List ────────────────────────────────────────── */}
        <View style={[styles.entriesCard, { backgroundColor: colors.surface, borderColor: '#e2e8f0' }]}>
          <View style={styles.entriesCardHeader}>
            <View style={{ flex: 1, minWidth: 220 }}>
              <Text style={[styles.entriesTitle, { color: colors.text }]}>
                Employee Salary Register ({filteredEntries.length})
              </Text>
              <Text style={[styles.entriesSub, { color: colors.textSecondary }]}>
                Showing {selectedUnit !== 'All' ? selectedUnit : 'All Units'} • {selectedCategory !== 'All' ? selectedCategory : 'All Categories'}
              </Text>
            </View>

            {/* Quick search input */}
            <View style={[styles.searchBox, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Search size={14} color={colors.textSecondary} />
              <Input
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search staff or code..."
                style={styles.searchInput}
              />
            </View>
          </View>

          {filteredEntries.length === 0 ? (
            <View style={styles.emptyBox}>
              <CreditCard size={40} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No employee records match the active unit, category, or search filters.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 12, padding: 16 }}>
              {filteredEntries.map((entry, idx) => {
                const emp = entry.employee as any;
                const empName = emp?.profile?.full_name || 'Staff Member';
                const empCode = emp?.employee_code || emp?.id || `EMP-${idx + 1}`;
                const slipGenerated = generatedSlips.has(entry.id);
                const taxCfg = emp?.tax_config || {};

                const unit = normalizeHospitalUnit(entry.hospital_unit || emp?.hospital_unit);
                const category = normalizeEmploymentType(entry.employment_type || emp?.employment_type);
                const grade = emp?.grade || 'M1';
                const uColor = unitBadgeColor(unit);

                const offerSalary = Math.round(entry.salary_details ?? entry.basic_salary ?? 25000);
                const paidDays = entry.paid_days ?? 26;
                const convAll = Math.round(entry.conveyance ?? (entry.allowances?.['Conveyance Allowance'] || 1200));
                const washAll = Math.round(entry.washing ?? (entry.allowances?.['Washing Allowance'] || 500));
                const specialAll = Math.round(entry.special_allowance ?? (entry.allowances?.['Special Allowance'] || 0));
                const epf = Math.round(entry.pf ?? (entry.deductions?.['EPF'] || entry.deductions?.pf || 0));
                const esic = Math.round(entry.esi ?? (entry.deductions?.['ESIC'] || entry.deductions?.esi || 0));
                const tds = Math.round(entry.pt_tds ?? (entry.deductions?.['TDS'] || entry.deductions?.tax || 0));
                const otherDed = Math.round(entry.ot_ded ?? (entry.deductions?.['Miscellaneous Deductions'] || 0));
                const grossDed = Math.round(entry.total_deductions ?? entry.gross_deductions ?? (epf + esic + tds + otherDed));

                return (
                  <View
                    key={entry.id}
                    style={[styles.entryItemCard, { backgroundColor: colors.background, borderColor: '#e2e8f0' }]}
                  >
                    <View style={styles.entryItemTop}>
                      <View style={{ flex: 1, minWidth: 260 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <Text style={[styles.snoPill, { color: colors.textSecondary }]}>#{idx + 1}</Text>
                          <Text style={[styles.empNameText, { color: colors.text }]}>{empName}</Text>
                          <View style={styles.codePill}>
                            <Text style={styles.codePillText}>{empCode}</Text>
                          </View>

                          {/* Unit Badge */}
                          <View style={[styles.unitPill, { backgroundColor: uColor.bg, borderColor: uColor.border }]}>
                            <Text style={[styles.unitPillText, { color: uColor.text }]}>{unit}</Text>
                          </View>

                          {/* Employment Type Badge */}
                          <View
                            style={[
                              styles.catPill,
                              {
                                backgroundColor: category === 'Regular' ? '#F0FDF4' : '#FFFBEB',
                                borderColor: category === 'Regular' ? '#BBF7D0' : '#FDE68A',
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.catPillText,
                                { color: category === 'Regular' ? '#15803D' : '#B45309' },
                              ]}
                            >
                              {category}
                            </Text>
                          </View>

                          {/* Grade Pill */}
                          <View style={styles.gradePill}>
                            <Text style={styles.gradePillText}>Grade: {grade}</Text>
                          </View>
                        </View>

                        <Text style={[styles.empDesigText, { color: colors.textSecondary }]}>
                          {emp?.department?.name || 'General'} • {emp?.designation || 'Staff'} • Offer: {formatCurrency(offerSalary)} • Paid: {paidDays}d • Gross: {formatCurrency(entry.gross_salary)}
                        </Text>

                        {/* Prescribed Register breakdown tags */}
                        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                          <Text style={[styles.breakdownTag, { color: '#0369A1' }]}>
                            Basic: {formatCurrency(entry.basic_salary)}
                          </Text>
                          <Text style={[styles.breakdownTag, { color: '#0369A1' }]}>
                            HRA: {formatCurrency(entry.allowances?.['HRA'] || entry.allowances?.hra || 0)}
                          </Text>
                          {convAll > 0 ? (
                            <Text style={[styles.breakdownTag, { color: '#0369A1' }]}>
                              Conv: {formatCurrency(convAll)}
                            </Text>
                          ) : null}
                          {washAll > 0 ? (
                            <Text style={[styles.breakdownTag, { color: '#0369A1' }]}>
                              Wash: {formatCurrency(washAll)}
                            </Text>
                          ) : null}
                          {specialAll > 0 ? (
                            <Text style={[styles.breakdownTag, { color: '#0369A1' }]}>
                              Special: {formatCurrency(specialAll)}
                            </Text>
                          ) : null}
                          <Text style={[styles.deductionTag, { color: '#B45309' }]}>
                            EPF: {formatCurrency(epf)}
                          </Text>
                          {esic > 0 ? (
                            <Text style={[styles.deductionTag, { color: '#B45309' }]}>
                              ESIC: {formatCurrency(esic)}
                            </Text>
                          ) : null}
                          {tds > 0 ? (
                            <Text style={[styles.deductionTag, { color: '#DC2626' }]}>
                              TDS: {formatCurrency(tds)}
                            </Text>
                          ) : null}
                          <Text style={[styles.deductionTag, { color: '#991B1B', fontWeight: '800' }]}>
                            Tot Ded: {formatCurrency(grossDed)}
                          </Text>
                        </View>
                      </View>

                      {/* Net Salary & Action buttons */}
                      <View style={{ alignItems: 'flex-end', gap: 6, minWidth: 140 }}>
                        <Text style={[styles.netSalaryText, { color: '#059669' }]}>
                          {formatCurrency(entry.net_salary)}
                        </Text>
                        <Text style={styles.netSalaryLabel}>Net Take-Home</Text>

                        <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {period?.status === 'open' && (
                            <TouchableOpacity
                              style={[styles.smallActionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                              onPress={() => openEdit(entry)}
                            >
                              <Text style={[styles.smallActionBtnText, { color: colors.text }]}>Edit</Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity
                            style={[
                              styles.smallActionBtn,
                              {
                                backgroundColor: slipGenerated ? '#DCFCE7' : colors.primary,
                                borderColor: slipGenerated ? '#86EFAC' : colors.primary,
                              },
                            ]}
                            onPress={() => handleGenerateSlip(entry)}
                            disabled={generatingSlip === entry.id}
                          >
                            <Text
                              style={[
                                styles.smallActionBtnText,
                                { color: slipGenerated ? '#166534' : '#FFF' },
                              ]}
                            >
                              {slipGenerated ? 'Slip Ready' : generatingSlip === entry.id ? '...' : 'PDF Slip'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Bottom Batch Actions */}
          <View style={[styles.batchActionsRow, { borderTopColor: '#f1f5f9' }]}>
            <View style={{ flexDirection: 'row', gap: 10, flex: 1, flexWrap: 'wrap' }}>
              <TouchableOpacity
                style={[styles.processBatchBtn, { backgroundColor: '#F3F4F6' }]}
                onPress={handleExportECR}
              >
                <Download size={16} color="#4B5563" />
                <Text style={[styles.processBatchBtnText, { color: '#4B5563' }]}>EPFO ECR</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.processBatchBtn, { backgroundColor: '#F3F4F6' }]}
                onPress={handleExportESI}
              >
                <Download size={16} color="#4B5563" />
                <Text style={[styles.processBatchBtnText, { color: '#4B5563' }]}>ESI Data</Text>
              </TouchableOpacity>
            </View>

            {period?.status === 'open' && (
              <TouchableOpacity
                style={[styles.processBatchBtn, { backgroundColor: colors.primary }]}
                onPress={handleProcess}
                disabled={processing || entries.length === 0}
              >
                <Lock size={16} color="#FFF" />
                <Text style={styles.processBatchBtnText}>
                  {processing ? 'Processing...' : 'Close & Finalize Payroll Period'}
                </Text>
              </TouchableOpacity>
            )}

            {period?.status === 'closed' && (
              <TouchableOpacity
                style={[styles.processBatchBtn, { backgroundColor: '#2563EB' }]}
                onPress={handleDistribute}
                disabled={distributing}
              >
                <Send size={16} color="#FFF" />
                <Text style={styles.processBatchBtnText}>
                  {distributing ? 'Distributing...' : 'Distribute Digital Payslips'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Add Custom Entry Modal ──────────────────────────────────────── */}
        <Modal visible={showAdd} onClose={() => setShowAdd(false)} title="Add Custom Payroll Entry">
          <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false}>
            <View style={{ gap: 14 }}>
              <Select
                label="Select Employee"
                options={employees.map((e) => ({
                  label: `${e.profile?.full_name || e.employee_code || 'Employee'} (${e.designation || 'Staff'})`,
                  value: e.id,
                }))}
                value={selEmpId}
                onValueChange={(v) => handleSelectEmployee(v)}
              />

              <Input label="Basic Salary" value={basicSalary} onChangeText={setBasicSalary} keyboardType="numeric" />
              <Input label="HRA (House Rent Allowance)" value={hra} onChangeText={setHra} keyboardType="numeric" />
              <Input label="Special Allowance / Transport" value={ta} onChangeText={setTa} keyboardType="numeric" />
              <Input label="EPF Deduction (Provident Fund)" value={pf} onChangeText={setPf} keyboardType="numeric" />
              <Input label="TDS (Income Tax Deduction)" value={tax} onChangeText={setTax} keyboardType="numeric" />
              <Input label="Loss of Pay (LOP Days)" value={lopDays} onChangeText={setLopDays} keyboardType="numeric" />

              {/* Custom Bonuses and Deductions Manager */}
              <CustomPayrollItemsManager
                items={entryCustomItems}
                onChange={setEntryCustomItems}
                basicSalary={parseFloat(basicSalary) || 0}
              />

              <View style={{ gap: 8, marginTop: 8 }}>
                <Button title="Add Entry to Period" onPress={handleAddEntry} loading={adding} />
                <Button title="Cancel" variant="ghost" onPress={() => setShowAdd(false)} />
              </View>
            </View>
          </ScrollView>
        </Modal>

        {/* ── Edit Entry Modal ────────────────────────────────────────────── */}
        <Modal visible={!!editingEntry} onClose={() => setEditingEntry(null)} title="Edit Employee Payroll">
          <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false}>
            <View style={{ gap: 14 }}>
              <TouchableOpacity
                style={[styles.syncBtn, { borderColor: colors.primary, alignSelf: 'flex-start' }]}
                onPress={handleResetToStatutory}
              >
                <Calculator size={14} color={colors.primary} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>
                  Reset to Enrolled Tax Defaults
                </Text>
              </TouchableOpacity>

              <Input label="Basic Salary" value={basicSalary} onChangeText={setBasicSalary} keyboardType="numeric" />
              <Input label="HRA" value={hra} onChangeText={setHra} keyboardType="numeric" />
              <Input label="Special Allowance" value={ta} onChangeText={setTa} keyboardType="numeric" />
              <Input label="EPF Deduction" value={pf} onChangeText={setPf} keyboardType="numeric" />
              <Input label="TDS Deduction" value={tax} onChangeText={setTax} keyboardType="numeric" />
              <Input label="Loss of Pay (LOP Days)" value={lopDays} onChangeText={setLopDays} keyboardType="numeric" />

              {/* Custom Bonuses and Deductions Manager */}
              <CustomPayrollItemsManager
                items={entryCustomItems}
                onChange={setEntryCustomItems}
                basicSalary={parseFloat(basicSalary) || 0}
              />

              <View style={{ gap: 8, marginTop: 8 }}>
                <Button title="Save Changes" onPress={handleUpdate} loading={adding} />
                <Button title="Cancel" variant="ghost" onPress={() => setEditingEntry(null)} />
              </View>
            </View>
          </ScrollView>
        </Modal>

        <View style={{ height: 60 }} />
      </ScrollView>
    </SidebarLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 20 },
  contentDesktop: { padding: 32, maxWidth: 1400, alignSelf: 'center', width: '100%', gap: 24 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 24, fontWeight: '800' },
  subTitle: { fontSize: 13, marginTop: 2, maxWidth: 700 },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  syncBtnText: { fontSize: 13, fontWeight: '700' },
  addBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  addBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  kpiCard: {
    flex: 1,
    minWidth: 260,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  kpiIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  kpiValue: { fontSize: 19, fontWeight: '800', marginVertical: 2 },
  kpiSub: { fontSize: 11, fontWeight: '500' },
  entriesCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  entriesCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  entriesTitle: { fontSize: 17, fontWeight: '800' },
  entriesSub: { fontSize: 12, marginTop: 2 },
  emptyBox: {
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: { fontSize: 13, textAlign: 'center', maxWidth: 400 },
  entryItemCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  entryItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    flexWrap: 'wrap',
  },
  empNameText: { fontSize: 16, fontWeight: '800' },
  codePill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  codePillText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  taxPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  empDesigText: { fontSize: 13, marginTop: 4 },
  deductionTag: {
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  netSalaryText: { fontSize: 18, fontWeight: '800' },
  netSalaryLabel: { fontSize: 10, fontWeight: '700', color: '#64748B', textTransform: 'uppercase' },
  smallActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  smallActionBtnText: { fontSize: 11, fontWeight: '700' },
  batchActionsRow: {
    padding: 16,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  processBatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  processBatchBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  exportCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 16,
    gap: 14,
  },
  exportCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  exportTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  exportSub: {
    fontSize: 12,
    marginTop: 3,
    maxWidth: 650,
  },
  exportActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  exportActionBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
  },
  filterBar: {
    borderTopWidth: 1,
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16,
  },
  filterSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  chipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  unitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  unitPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  unitPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  catPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  catPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  gradePill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  gradePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#334155',
  },
  snoPill: {
    fontSize: 12,
    fontWeight: '800',
  },
  breakdownTag: {
    fontSize: 11,
    fontWeight: '600',
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#BAE6FD',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 200,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    paddingVertical: 4,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
});
