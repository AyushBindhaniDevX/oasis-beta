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
  processPayrollPeriod,
  distributePayroll,
  updatePayrollEntry,
  generatePayslipForEntry,
  recalculatePeriodEntries,
  calculateStatutoryForEmployee,
} from '@/lib/services/payroll';
import { getAllEmployees } from '@/lib/services/employee';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
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
} from 'lucide-react-native';

import { exportExcel, exportTxt } from '@/utils/excel';
import {
  exportSalaryRegisterPdf,
  exportSalaryRegisterExcel,
} from '@/utils/salary-register-export';
import { exportPayslipPdf } from '@/utils/payslip-pdf';

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

  // Detailed Entry Form state (Matches 9 User Requirements & Hospital Slip)
  const [selEmpId, setSelEmpId] = useState<string | null>(null);
  const [formOfferSalary, setFormOfferSalary] = useState('37400');
  const [formPresentDays, setFormPresentDays] = useState('26');
  const [formOffDays, setFormOffDays] = useState('4');
  const [formPlDays, setFormPlDays] = useState('0');
  const [formSlDays, setFormSlDays] = useState('0');
  const [formClDays, setFormClDays] = useState('0');
  const [formHolidayDays, setFormHolidayDays] = useState('0');
  const [formPaidDays, setFormPaidDays] = useState('30');
  const [formLwpDays, setFormLwpDays] = useState('0');

  const [formBasic, setFormBasic] = useState('18700');
  const [formHra, setFormHra] = useState('7480');
  const [formConv, setFormConv] = useState('2000');
  const [formWash, setFormWash] = useState('1000');
  const [formSpecial, setFormSpecial] = useState('7098');
  const [formGross, setFormGross] = useState('37400');

  const [formPf, setFormPf] = useState('2244');
  const [formEsi, setFormEsi] = useState('273');
  const [formTds, setFormTds] = useState('0'); // Manual TDS (Requirement 7)
  const [formOtherDed, setFormOtherDed] = useState('0');
  const [formTotalDed, setFormTotalDed] = useState('2517');

  const [formOtHours, setFormOtHours] = useState('0'); // Requirement 8: 4h = 0.5d, 7h = 1d
  const [formOtDays, setFormOtDays] = useState('0');
  const [formOtAmount, setFormOtAmount] = useState('0');
  const [formOtherAllowances, setFormOtherAllowances] = useState('0'); // Manual Other Allowances (Requirement 9)

  const [formTotalSalary, setFormTotalSalary] = useState('34883');
  const [formNetSalary, setFormNetSalary] = useState('34883');
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

  // Helper to recompute entire earnings, deductions, and net pay in proportion to paid days
  const applyFormRecalculation = (
    offerSal: number,
    present: number,
    off: number,
    pl: number,
    sl: number,
    cl: number,
    hol: number,
    manualTds: number,
    otHrs: number,
    otherAll: number,
    otherDed: number,
    emp?: Employee | null
  ) => {
    const payableDays = period ? new Date(period.year, period.month, 0).getDate() : 30;
    // Rule 1: Paid days = sum of Present Days, Weekly Offs, PL, SL, CL and Holidays
    const paid = present + off + pl + sl + cl + hol;
    const lwp = Math.max(0, payableDays - paid);
    // Rule 2: Proportionate based on paid days against total calendar days of the month
    const ratio = payableDays > 0 ? paid / payableDays : 0;

    const gross = Math.round(offerSal * ratio);
    // Rule 3: Basic (50%), HRA (20%), Conv, Wash, Special calculated in proportion to paid days
    const fullBasic = Math.round(offerSal * 0.50);
    const fullHra = Math.round(offerSal * 0.20);
    const fullConv = emp?.conveyance_allowance ?? (offerSal >= 25000 ? 1200 : offerSal >= 18000 ? 800 : 350);
    const fullWash = emp?.washing_allowance ?? (offerSal >= 25000 ? 500 : 300);
    const fullSpecial = Math.max(0, offerSal - (fullBasic + fullHra + fullConv + fullWash));

    const basic = Math.round(fullBasic * ratio);
    const hraVal = Math.round(fullHra * ratio);
    const convVal = Math.round(fullConv * ratio);
    const washVal = Math.round(fullWash * ratio);
    const specialVal = Math.max(0, gross - (basic + hraVal + convVal + washVal));

    // Rule 4 & 5: EPF Calculation & Applicability
    // 12% of Basic, base capped at 25,000 (maximum of Rs. 3,000), regular employees only
    const empType = (emp?.employment_type || '').toLowerCase();
    const isRegular = empType !== 'contractual' && empType !== 'contract';
    const taxCfg = (emp as any)?.tax_config || {};
    const isPf = isRegular && emp?.is_pf_eligible === true && !taxCfg.epf_exempt;
    const pfVal = isPf ? Math.round(Math.min(basic, 25000) * 0.12) : 0;

    // Rule 6: ESIC = 0.75% of (Gross - Washing Allowance)
    const esicSal = Math.max(0, gross - washVal);
    const isEsiExempt = taxCfg.esi_exempt === true || emp?.is_esi_eligible === false;
    const esiVal = !isEsiExempt ? Math.round(esicSal * 0.0075) : 0;

    // Rule 8: Overtime (OT)
    // Only for authorized staff. After 8h shift: 4h approved OT = 0.5d, 7h approved OT = 1.0d
    const isOtEligible = emp?.is_overtime_eligible === true || taxCfg.is_overtime_eligible === true;
    let otDaysVal = 0;
    let otAmtVal = 0;
    if (isOtEligible && otHrs > 0) {
      const fullDays = Math.floor(otHrs / 7);
      const rem = otHrs % 7;
      otDaysVal = fullDays + (rem >= 4 ? 0.5 : 0);
      otAmtVal = Math.round((offerSal / payableDays) * otDaysVal);
    }

    const totDed = pfVal + esiVal + manualTds + otherDed;
    const totSal = Math.max(0, gross - totDed);
    const net = Math.max(0, totSal + otAmtVal + otherAll);

    setFormOfferSalary(String(offerSal));
    setFormPresentDays(String(present));
    setFormOffDays(String(off));
    setFormPlDays(String(pl));
    setFormSlDays(String(sl));
    setFormClDays(String(cl));
    setFormHolidayDays(String(hol));
    setFormPaidDays(String(paid));
    setFormLwpDays(String(lwp));

    setFormBasic(String(basic));
    setFormHra(String(hraVal));
    setFormConv(String(convVal));
    setFormWash(String(washVal));
    setFormSpecial(String(specialVal));
    setFormGross(String(gross));

    setFormPf(String(pfVal));
    setFormEsi(String(esiVal));
    setFormTds(String(manualTds));
    setFormOtherDed(String(otherDed));
    setFormTotalDed(String(totDed));

    setFormOtHours(String(otHrs));
    setFormOtDays(String(otDaysVal));
    setFormOtAmount(String(otAmtVal));
    setFormOtherAllowances(String(otherAll));

    setFormTotalSalary(String(totSal));
    setFormNetSalary(String(net));
  };

  const handleSelectEmployee = async (empId: string | null) => {
    setSelEmpId(empId);
    if (!empId || !period) return;
    const emp = employees.find((e) => e.id === empId);
    if (emp) {
      const breakdown = await calculateStatutoryForEmployee(emp, period.month, period.year);
      setFormOfferSalary(String(breakdown.salary_details));
      setFormPresentDays(String(breakdown.present_days));
      setFormOffDays(String(breakdown.off_days));
      setFormPlDays(String(breakdown.pl_days));
      setFormSlDays(String(breakdown.sl_days));
      setFormClDays(String(breakdown.cl_days));
      setFormHolidayDays(String(breakdown.holiday_days));
      setFormPaidDays(String(breakdown.paid_days));
      setFormLwpDays(String(breakdown.lwp_days));

      setFormBasic(String(breakdown.basic));
      setFormHra(String(breakdown.hra));
      setFormConv(String(breakdown.conveyance));
      setFormWash(String(breakdown.washing));
      setFormSpecial(String(breakdown.special_allowance));
      setFormGross(String(breakdown.gross_salary));

      setFormPf(String(breakdown.pf));
      setFormEsi(String(breakdown.esi));
      setFormTds(String(breakdown.tds));
      setFormOtherDed(String(breakdown.ot_ded));
      setFormTotalDed(String(breakdown.gross_deductions));

      setFormOtHours(String(breakdown.ot_hours));
      setFormOtDays(String(breakdown.ot_hours_or_days));
      setFormOtAmount(String(breakdown.ot_amount));
      setFormOtherAllowances(String(breakdown.other_allowances));

      setFormTotalSalary(String(breakdown.total_salary));
      setFormNetSalary(String(breakdown.net_salary));

      const tc = (emp as any).tax_config || {};
      setEntryCustomItems(Array.isArray(tc.custom_items) ? tc.custom_items : []);
    }
  };

  const openEdit = (entry: Payroll) => {
    setEditingEntry(entry);
    const emp = entry.employee as any;
    const offerSal = Math.round(entry.salary_details ?? entry.basic_salary ?? 25000);
    const pres = entry.present_days ?? 26;
    const off = entry.off_days ?? 4;
    const pl = entry.pl_days ?? 0;
    const sl = entry.sl_days ?? 0;
    const cl = entry.cl_days ?? 0;
    const hol = entry.holiday_days ?? 0;
    const paid = entry.paid_days ?? (pres + off + pl + sl + cl + hol);
    const lwp = entry.lwp_days ?? entry.lop_days ?? 0;

    const basicVal = Math.round(entry.basic ?? Math.round(offerSal * 0.5));
    const hraVal = Math.round(entry.hra ?? Math.round(offerSal * 0.2));
    const convVal = Math.round(entry.conveyance ?? (entry.allowances?.['Conveyance Allowance'] || 2000));
    const washVal = Math.round(entry.washing ?? (entry.allowances?.['Washing Allowance'] || 1000));
    const specialVal = Math.round(entry.special_allowance ?? (entry.allowances?.['Special Allowance'] || 0));
    const grossVal = Math.round(entry.gross_salary ?? (basicVal + hraVal + convVal + washVal + specialVal));

    const pfVal = Math.round(entry.pf ?? (entry.deductions?.['PF'] || entry.deductions?.['EPF'] || 0));
    const esiVal = Math.round(entry.esi ?? (entry.deductions?.['ESIC'] || 0));
    const tdsVal = Math.round(entry.tds ?? entry.pt_tds ?? (entry.deductions?.['TDS'] || 0));
    const otherDedVal = Math.round(entry.ot_ded ?? (entry.deductions?.['Miscellaneous Deductions'] || 0));
    const totalDedVal = Math.round(entry.total_deductions ?? entry.gross_deductions ?? (pfVal + esiVal + tdsVal + otherDedVal));

    const otH = entry.ot_hours ?? 0;
    const otD = entry.ot_hours_or_days ?? 0;
    const otAmt = Math.round(entry.ot_amount ?? (entry.allowances?.['Overtime Pay'] || 0));
    const otherAll = Math.round(entry.other_allowances ?? (entry.allowances?.['Other Allowances'] || 0));

    const totSal = Math.round(entry.total_salary ?? Math.max(0, grossVal - totalDedVal));
    const net = Math.round(entry.net_salary ?? Math.max(0, totSal + otAmt + otherAll));

    setFormOfferSalary(String(offerSal));
    setFormPresentDays(String(pres));
    setFormOffDays(String(off));
    setFormPlDays(String(pl));
    setFormSlDays(String(sl));
    setFormClDays(String(cl));
    setFormHolidayDays(String(hol));
    setFormPaidDays(String(paid));
    setFormLwpDays(String(lwp));

    setFormBasic(String(basicVal));
    setFormHra(String(hraVal));
    setFormConv(String(convVal));
    setFormWash(String(washVal));
    setFormSpecial(String(specialVal));
    setFormGross(String(grossVal));

    setFormPf(String(pfVal));
    setFormEsi(String(esiVal));
    setFormTds(String(tdsVal));
    setFormOtherDed(String(otherDedVal));
    setFormTotalDed(String(totalDedVal));

    setFormOtHours(String(otH));
    setFormOtDays(String(otD));
    setFormOtAmount(String(otAmt));
    setFormOtherAllowances(String(otherAll));

    setFormTotalSalary(String(totSal));
    setFormNetSalary(String(net));

    const tc = emp?.tax_config || {};
    setEntryCustomItems(Array.isArray(tc.custom_items) ? tc.custom_items : []);
  };

  const handleResetToStatutory = async () => {
    if (!editingEntry || !period) return;
    const emp = editingEntry.employee as any;
    if (emp) {
      const breakdown = await calculateStatutoryForEmployee(emp, period.month, period.year);
      setFormOfferSalary(String(breakdown.salary_details));
      setFormPresentDays(String(breakdown.present_days));
      setFormOffDays(String(breakdown.off_days));
      setFormPlDays(String(breakdown.pl_days));
      setFormSlDays(String(breakdown.sl_days));
      setFormClDays(String(breakdown.cl_days));
      setFormHolidayDays(String(breakdown.holiday_days));
      setFormPaidDays(String(breakdown.paid_days));
      setFormLwpDays(String(breakdown.lwp_days));

      setFormBasic(String(breakdown.basic));
      setFormHra(String(breakdown.hra));
      setFormConv(String(breakdown.conveyance));
      setFormWash(String(breakdown.washing));
      setFormSpecial(String(breakdown.special_allowance));
      setFormGross(String(breakdown.gross_salary));

      setFormPf(String(breakdown.pf));
      setFormEsi(String(breakdown.esi));
      setFormTds(String(breakdown.tds));
      setFormOtherDed(String(breakdown.ot_ded));
      setFormTotalDed(String(breakdown.gross_deductions));

      setFormOtHours(String(breakdown.ot_hours));
      setFormOtDays(String(breakdown.ot_hours_or_days));
      setFormOtAmount(String(breakdown.ot_amount));
      setFormOtherAllowances(String(breakdown.other_allowances));

      setFormTotalSalary(String(breakdown.total_salary));
      setFormNetSalary(String(breakdown.net_salary));

      const tc = (emp as any).tax_config || {};
      setEntryCustomItems(Array.isArray(tc.custom_items) ? tc.custom_items : []);
    }
  };

  const handleUpdate = async () => {
    if (!editingEntry || !period) return;
    setAdding(true);
    try {
      const payableDays = new Date(period.year, period.month, 0).getDate();
      const offerSal = parseFloat(formOfferSalary) || 0;
      const pres = parseFloat(formPresentDays) || 0;
      const off = parseFloat(formOffDays) || 0;
      const pl = parseFloat(formPlDays) || 0;
      const sl = parseFloat(formSlDays) || 0;
      const cl = parseFloat(formClDays) || 0;
      const hol = parseFloat(formHolidayDays) || 0;
      const paid = parseFloat(formPaidDays) || (pres + off + pl + sl + cl + hol);
      const lwp = parseFloat(formLwpDays) || Math.max(0, payableDays - paid);

      const basic = parseFloat(formBasic) || 0;
      const hraVal = parseFloat(formHra) || 0;
      const convVal = parseFloat(formConv) || 0;
      const washVal = parseFloat(formWash) || 0;
      const specialVal = parseFloat(formSpecial) || 0;
      const grossVal = parseFloat(formGross) || (basic + hraVal + convVal + washVal + specialVal);

      const pfVal = parseFloat(formPf) || 0;
      const esiVal = parseFloat(formEsi) || 0;
      const tdsVal = parseFloat(formTds) || 0; // Manual TDS (Requirement 7)
      const otherDedVal = parseFloat(formOtherDed) || 0;
      const grossDedVal = pfVal + esiVal + tdsVal + otherDedVal;

      const otHVal = parseFloat(formOtHours) || 0;
      const otDVal = parseFloat(formOtDays) || 0;
      const otAmtVal = parseFloat(formOtAmount) || 0;
      const otherAllVal = parseFloat(formOtherAllowances) || 0; // Manual Other Allowances (Requirement 9)

      const totSalVal = Math.max(0, grossVal - grossDedVal);
      const netVal = Math.max(0, totSalVal + otAmtVal + otherAllVal);

      const allowances: Record<string, number> = {
        'Basic': basic,
        'HRA': hraVal,
        'Conveyance Allowance': convVal,
        'Washing Allowance': washVal,
        'Special Allowance': specialVal,
      };
      if (otAmtVal > 0) allowances['Overtime Pay'] = otAmtVal;
      if (otherAllVal > 0) allowances['Other Allowances'] = otherAllVal;

      const deductions: Record<string, number> = {
        'PF': pfVal,
        'ESIC': esiVal,
        'TDS': tdsVal,
      };
      if (otherDedVal > 0) deductions['Miscellaneous Deductions'] = otherDedVal;

      await updatePayrollEntry(editingEntry.id, {
        basic_salary: basic,
        allowances,
        deductions,
        lop_days: lwp,
        lop_amount: Math.round((offerSal / payableDays) * lwp),
        gross_salary: grossVal,
        net_salary: netVal,
        salary_details: offerSal,
        payable_days: payableDays,
        present_days: pres,
        off_days: off,
        pl_days: pl,
        sl_days: sl,
        cl_days: cl,
        holiday_days: hol,
        paid_days: paid,
        lwp_days: lwp,
        basic,
        hra: hraVal,
        conveyance: convVal,
        washing: washVal,
        special_allowance: specialVal,
        pt_tds: tdsVal,
        esi: esiVal,
        pf: pfVal,
        tds: tdsVal,
        ot_ded: otherDedVal,
        gross_deductions: grossDedVal,
        total_deductions: grossDedVal,
        total_salary: totSalVal,
        ot_hours_or_days: otDVal,
        ot_hours: otHVal,
        ot_amount: otAmtVal,
        other_allowances: otherAllVal,
      });
      setEditingEntry(null);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Could not save changes to this payroll entry.');
    } finally {
      setAdding(false);
    }
  };

  const handleAddEntry = async () => {
    if (!selEmpId || !period) return;
    setAdding(true);
    try {
      const payableDays = new Date(period.year, period.month, 0).getDate();
      const offerSal = parseFloat(formOfferSalary) || 0;
      const pres = parseFloat(formPresentDays) || 0;
      const off = parseFloat(formOffDays) || 0;
      const pl = parseFloat(formPlDays) || 0;
      const sl = parseFloat(formSlDays) || 0;
      const cl = parseFloat(formClDays) || 0;
      const hol = parseFloat(formHolidayDays) || 0;
      const paid = parseFloat(formPaidDays) || (pres + off + pl + sl + cl + hol);
      const lwp = parseFloat(formLwpDays) || Math.max(0, payableDays - paid);

      const basic = parseFloat(formBasic) || 0;
      const hraVal = parseFloat(formHra) || 0;
      const convVal = parseFloat(formConv) || 0;
      const washVal = parseFloat(formWash) || 0;
      const specialVal = parseFloat(formSpecial) || 0;
      const grossVal = parseFloat(formGross) || (basic + hraVal + convVal + washVal + specialVal);

      const pfVal = parseFloat(formPf) || 0;
      const esiVal = parseFloat(formEsi) || 0;
      const tdsVal = parseFloat(formTds) || 0;
      const otherDedVal = parseFloat(formOtherDed) || 0;
      const grossDedVal = pfVal + esiVal + tdsVal + otherDedVal;

      const otHVal = parseFloat(formOtHours) || 0;
      const otDVal = parseFloat(formOtDays) || 0;
      const otAmtVal = parseFloat(formOtAmount) || 0;
      const otherAllVal = parseFloat(formOtherAllowances) || 0;

      const totSalVal = Math.max(0, grossVal - grossDedVal);
      const netVal = Math.max(0, totSalVal + otAmtVal + otherAllVal);

      const allowances: Record<string, number> = {
        'Basic': basic,
        'HRA': hraVal,
        'Conveyance Allowance': convVal,
        'Washing Allowance': washVal,
        'Special Allowance': specialVal,
      };
      if (otAmtVal > 0) allowances['Overtime Pay'] = otAmtVal;
      if (otherAllVal > 0) allowances['Other Allowances'] = otherAllVal;

      const deductions: Record<string, number> = {
        'PF': pfVal,
        'ESIC': esiVal,
        'TDS': tdsVal,
      };
      if (otherDedVal > 0) deductions['Miscellaneous Deductions'] = otherDedVal;

      const emp = employees.find((e) => e.id === selEmpId);
      const entryId = `payroll_${selEmpId}_${period.year}_${period.month}_${Date.now()}`;
      const now = new Date().toISOString();

      await setDoc(doc(db, 'payroll', entryId), {
        id: entryId,
        payroll_period_id: id!,
        employee_id: selEmpId,
        basic_salary: basic,
        allowances,
        deductions,
        lop_days: lwp,
        lop_amount: Math.round((offerSal / payableDays) * lwp),
        gross_salary: grossVal,
        net_salary: netVal,
        salary_details: offerSal,
        payable_days: payableDays,
        present_days: pres,
        off_days: off,
        pl_days: pl,
        sl_days: sl,
        cl_days: cl,
        holiday_days: hol,
        paid_days: paid,
        lwp_days: lwp,
        basic,
        hra: hraVal,
        conveyance: convVal,
        washing: washVal,
        special_allowance: specialVal,
        pt_tds: tdsVal,
        esi: esiVal,
        pf: pfVal,
        tds: tdsVal,
        ot_ded: otherDedVal,
        gross_deductions: grossDedVal,
        total_deductions: grossDedVal,
        total_salary: totSalVal,
        ot_hours_or_days: otDVal,
        ot_hours: otHVal,
        ot_amount: otAmtVal,
        other_allowances: otherAllVal,
        is_pf_eligible: emp?.is_pf_eligible === true,
        is_overtime_eligible: emp?.is_overtime_eligible === true,
        hospital_unit: emp?.hospital_unit || tenantOrg?.name || 'Main Branch',
        employment_type: emp?.employment_type || 'Regular',
        status: 'draft',
        created_at: now,
        updated_at: now,
      });

      setShowAdd(false);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Could not add this payroll entry.');
    } finally {
      setAdding(false);
    }
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

  const handleDownloadSlip = async (entry: Payroll) => {
    if (!period) return;
    setGeneratingSlip(entry.id);
    try {
      const payslip = await generatePayslipForEntry(entry, period.month, period.year);
      setGeneratedSlips((prev) => new Set([...prev, entry.id]));
      await exportPayslipPdf(payslip, entry.employee, tenantOrg);
    } catch (e: any) {
      console.error('Download slip error:', e);
      Alert.alert('Download Error', e?.message || 'Could not download payslip PDF.');
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

  const unitBadgeColor = (_u: string) => {
    return { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' };
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
        {/* ── Top Header ──────────────────────────────────────────────────── */}
        <View style={styles.headerRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 280 }}>
            <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { borderColor: colors.border }]}>
              <ChevronLeft size={20} color={colors.text} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Text style={[styles.title, { color: colors.text }]}>
                  {period ? `${MONTHS[period.month - 1]} ${period.year} Payroll` : 'Payroll'}
                </Text>
                {period?.hospital_unit ? (
                  <View style={[styles.unitChip, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                    <Building2 size={13} color="#2563EB" />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#1D4ED8' }}>
                      {period.hospital_unit}
                    </Text>
                  </View>
                ) : null}
                <Badge
                  label={period?.status?.toUpperCase() || 'OPEN'}
                  variant={period?.status === 'closed' ? 'success' : 'default'}
                />
              </View>
              <Text style={[styles.subTitle, { color: colors.textSecondary }]}>
                {filteredEntries.length} {filteredEntries.length === 1 ? 'employee' : 'employees'}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
              onPress={handleExportRegisterPdf}
              disabled={exportingPdf}
            >
              <Printer size={15} color={colors.text} />
              <Text style={[styles.actionBtnText, { color: colors.text }]}>
                {exportingPdf ? 'Exporting...' : 'Export PDF'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
              onPress={handleExportRegisterExcel}
              disabled={exportingExcel}
            >
              <Download size={15} color={colors.text} />
              <Text style={[styles.actionBtnText, { color: colors.text }]}>
                {exportingExcel ? 'Exporting...' : 'Export Excel'}
              </Text>
            </TouchableOpacity>

            {period?.status === 'open' && (
              <>
                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: colors.primary, backgroundColor: colors.surface }]}
                  onPress={handleSyncRecalculate}
                  disabled={recalculating}
                >
                  <RefreshCw size={15} color={colors.primary} />
                  <Text style={[styles.actionBtnText, { color: colors.primary }]}>
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
                  <Text style={styles.addBtnText}>+ Add Entry</Text>
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

        {/* ── Filter Toolbar ──────────────────────────────────────────────── */}
        <View style={[styles.filterBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Unit Filter */}
          <View style={styles.filterSection}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 6 }}>
              <Building2 size={13} color={colors.textSecondary} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary }}>Unit:</Text>
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

          {/* Type Filter */}
          <View style={styles.filterSection}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 6 }}>
              <Briefcase size={13} color={colors.textSecondary} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary }}>Type:</Text>
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
                      backgroundColor: active ? colors.primary : colors.background,
                      borderColor: active ? colors.primary : colors.border,
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

        {/* ── Summary KPI Cards ────────────────────────────────────────────── */}
        <View style={styles.kpiGrid}>
          {/* Total Net */}
          <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.kpiIcon, { backgroundColor: '#DCFCE7' }]}>
              <DollarSign size={20} color="#16A34A" />
            </View>
            <View>
              <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Net Payout</Text>
              <Text style={[styles.kpiValue, { color: colors.text }]}>{formatCurrency(totalNet)}</Text>
            </View>
          </View>

          {/* Total Gross */}
          <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.kpiIcon, { backgroundColor: '#DBEAFE' }]}>
              <CreditCard size={20} color="#2563EB" />
            </View>
            <View>
              <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Gross Compensation</Text>
              <Text style={[styles.kpiValue, { color: colors.text }]}>{formatCurrency(totalGross)}</Text>
            </View>
          </View>

          {/* EPF Withholding */}
          <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.kpiIcon, { backgroundColor: '#F3E8FF' }]}>
              <ShieldCheck size={20} color="#9333EA" />
            </View>
            <View>
              <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>EPF Deductions</Text>
              <Text style={[styles.kpiValue, { color: colors.text }]}>{formatCurrency(totalEpf)}</Text>
            </View>
          </View>

          {/* TDS Withholding */}
          <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.kpiIcon, { backgroundColor: '#FEF3C7' }]}>
              <Percent size={20} color="#D97706" />
            </View>
            <View>
              <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>TDS Withholding</Text>
              <Text style={[styles.kpiValue, { color: colors.text }]}>{formatCurrency(totalTds)}</Text>
            </View>
          </View>
        </View>

        {/* ── Payroll Entries List ────────────────────────────────────────── */}
        <View style={[styles.entriesCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.entriesCardHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.entriesTitle, { color: colors.text }]}>
              Employees ({filteredEntries.length})
            </Text>

            {/* Quick search input */}
            <View style={[styles.searchBox, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Search size={14} color={colors.textSecondary} />
              <Input
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search employee..."
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
                                backgroundColor: colors.primary,
                                borderColor: colors.primary,
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 4,
                              },
                            ]}
                            onPress={() => handleDownloadSlip(entry)}
                            disabled={generatingSlip === entry.id}
                          >
                            <Download size={12} color="#FFF" />
                            <Text
                              style={[
                                styles.smallActionBtnText,
                                { color: '#FFF' },
                              ]}
                            >
                              {generatingSlip === entry.id ? 'Preparing...' : 'Download Slip'}
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
                  {processing ? 'Processing...' : 'Finalize Period'}
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
                  {distributing ? 'Distributing...' : 'Distribute Payslips'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Add Custom Entry Modal ──────────────────────────────────────── */}
        <Modal visible={showAdd} onClose={() => setShowAdd(false)} title="Add Payroll Entry">
          <ScrollView style={{ maxHeight: 650 }} showsVerticalScrollIndicator={false}>
            <View style={{ gap: 14 }}>
              <Select
                label="Select Employee"
                options={employees.map((e) => ({
                  label: `${e.profile?.full_name || e.employee_code || 'Employee'} (${e.designation || 'Staff'} • ${e.hospital_unit || 'Unit'})`,
                  value: e.id,
                }))}
                value={selEmpId}
                onValueChange={(v) => handleSelectEmployee(v)}
              />

              {/* Offer Salary */}
              <Input
                label="Offer Salary (Monthly CTC)"
                value={formOfferSalary}
                onChangeText={(v) => {
                  setFormOfferSalary(v);
                  const emp = employees.find((e) => e.id === selEmpId);
                  applyFormRecalculation(
                    parseFloat(v) || 0,
                    parseFloat(formPresentDays) || 0,
                    parseFloat(formOffDays) || 0,
                    parseFloat(formPlDays) || 0,
                    parseFloat(formSlDays) || 0,
                    parseFloat(formClDays) || 0,
                    parseFloat(formHolidayDays) || 0,
                    parseFloat(formTds) || 0,
                    parseFloat(formOtHours) || 0,
                    parseFloat(formOtherAllowances) || 0,
                    parseFloat(formOtherDed) || 0,
                    emp
                  );
                }}
                keyboardType="numeric"
              />

              {/* Attendance & Paid Days */}
              <View style={{ backgroundColor: colors.background, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, gap: 10 }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: colors.text, textTransform: 'uppercase' }}>
                  Attendance & Paid Days
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="Present Days"
                      value={formPresentDays}
                      onChangeText={(v) => {
                        setFormPresentDays(v);
                        const emp = employees.find((e) => e.id === selEmpId);
                        applyFormRecalculation(
                          parseFloat(formOfferSalary) || 0,
                          parseFloat(v) || 0,
                          parseFloat(formOffDays) || 0,
                          parseFloat(formPlDays) || 0,
                          parseFloat(formSlDays) || 0,
                          parseFloat(formClDays) || 0,
                          parseFloat(formHolidayDays) || 0,
                          parseFloat(formTds) || 0,
                          parseFloat(formOtHours) || 0,
                          parseFloat(formOtherAllowances) || 0,
                          parseFloat(formOtherDed) || 0,
                          emp
                        );
                      }}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="Weekly Off"
                      value={formOffDays}
                      onChangeText={(v) => {
                        setFormOffDays(v);
                        const emp = employees.find((e) => e.id === selEmpId);
                        applyFormRecalculation(
                          parseFloat(formOfferSalary) || 0,
                          parseFloat(formPresentDays) || 0,
                          parseFloat(v) || 0,
                          parseFloat(formPlDays) || 0,
                          parseFloat(formSlDays) || 0,
                          parseFloat(formClDays) || 0,
                          parseFloat(formHolidayDays) || 0,
                          parseFloat(formTds) || 0,
                          parseFloat(formOtHours) || 0,
                          parseFloat(formOtherAllowances) || 0,
                          parseFloat(formOtherDed) || 0,
                          emp
                        );
                      }}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="Holidays"
                      value={formHolidayDays}
                      onChangeText={(v) => {
                        setFormHolidayDays(v);
                        const emp = employees.find((e) => e.id === selEmpId);
                        applyFormRecalculation(
                          parseFloat(formOfferSalary) || 0,
                          parseFloat(formPresentDays) || 0,
                          parseFloat(formOffDays) || 0,
                          parseFloat(formPlDays) || 0,
                          parseFloat(formSlDays) || 0,
                          parseFloat(formClDays) || 0,
                          parseFloat(v) || 0,
                          parseFloat(formTds) || 0,
                          parseFloat(formOtHours) || 0,
                          parseFloat(formOtherAllowances) || 0,
                          parseFloat(formOtherDed) || 0,
                          emp
                        );
                      }}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="PL (Paid Leave)"
                      value={formPlDays}
                      onChangeText={(v) => {
                        setFormPlDays(v);
                        const emp = employees.find((e) => e.id === selEmpId);
                        applyFormRecalculation(
                          parseFloat(formOfferSalary) || 0,
                          parseFloat(formPresentDays) || 0,
                          parseFloat(formOffDays) || 0,
                          parseFloat(v) || 0,
                          parseFloat(formSlDays) || 0,
                          parseFloat(formClDays) || 0,
                          parseFloat(formHolidayDays) || 0,
                          parseFloat(formTds) || 0,
                          parseFloat(formOtHours) || 0,
                          parseFloat(formOtherAllowances) || 0,
                          parseFloat(formOtherDed) || 0,
                          emp
                        );
                      }}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="SL (Sick Leave)"
                      value={formSlDays}
                      onChangeText={(v) => {
                        setFormSlDays(v);
                        const emp = employees.find((e) => e.id === selEmpId);
                        applyFormRecalculation(
                          parseFloat(formOfferSalary) || 0,
                          parseFloat(formPresentDays) || 0,
                          parseFloat(formOffDays) || 0,
                          parseFloat(formPlDays) || 0,
                          parseFloat(v) || 0,
                          parseFloat(formClDays) || 0,
                          parseFloat(formHolidayDays) || 0,
                          parseFloat(formTds) || 0,
                          parseFloat(formOtHours) || 0,
                          parseFloat(formOtherAllowances) || 0,
                          parseFloat(formOtherDed) || 0,
                          emp
                        );
                      }}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="CL (Casual Leave)"
                      value={formClDays}
                      onChangeText={(v) => {
                        setFormClDays(v);
                        const emp = employees.find((e) => e.id === selEmpId);
                        applyFormRecalculation(
                          parseFloat(formOfferSalary) || 0,
                          parseFloat(formPresentDays) || 0,
                          parseFloat(formOffDays) || 0,
                          parseFloat(formPlDays) || 0,
                          parseFloat(formSlDays) || 0,
                          parseFloat(v) || 0,
                          parseFloat(formHolidayDays) || 0,
                          parseFloat(formTds) || 0,
                          parseFloat(formOtHours) || 0,
                          parseFloat(formOtherAllowances) || 0,
                          parseFloat(formOtherDed) || 0,
                          emp
                        );
                      }}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#F0FDFA', padding: 8, borderRadius: 6 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#0F766E' }}>
                    Calculated Paid Days: {formPaidDays}
                  </Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#B45309' }}>
                    LWP: {formLwpDays}
                  </Text>
                </View>
              </View>

              {/* Earnings Breakdown */}
              <View style={{ backgroundColor: colors.background, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, gap: 10 }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: colors.text, textTransform: 'uppercase' }}>
                  Earnings Breakdown
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Input label="Basic Salary" value={formBasic} onChangeText={setFormBasic} keyboardType="numeric" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input label="HRA" value={formHra} onChangeText={setFormHra} keyboardType="numeric" />
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Input label="Conveyance" value={formConv} onChangeText={setFormConv} keyboardType="numeric" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input label="Washing Allowance" value={formWash} onChangeText={setFormWash} keyboardType="numeric" />
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Input label="Special Allowance" value={formSpecial} onChangeText={setFormSpecial} keyboardType="numeric" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input label="Gross Earnings" value={formGross} onChangeText={setFormGross} keyboardType="numeric" />
                  </View>
                </View>
              </View>

              {/* Deductions */}
              <View style={{ backgroundColor: colors.background, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, gap: 10 }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: colors.text, textTransform: 'uppercase' }}>
                  Deductions
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Input label="EPF" value={formPf} onChangeText={setFormPf} keyboardType="numeric" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input label="ESIC" value={formEsi} onChangeText={setFormEsi} keyboardType="numeric" />
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="TDS"
                      value={formTds}
                      onChangeText={(v) => {
                        setFormTds(v);
                        const pfVal = parseFloat(formPf) || 0;
                        const esiVal = parseFloat(formEsi) || 0;
                        const tdsVal = parseFloat(v) || 0;
                        const otherDedVal = parseFloat(formOtherDed) || 0;
                        const totDed = pfVal + esiVal + tdsVal + otherDedVal;
                        setFormTotalDed(String(totDed));
                        const grossVal = parseFloat(formGross) || 0;
                        const totSal = Math.max(0, grossVal - totDed);
                        setFormTotalSalary(String(totSal));
                        const otAmt = parseFloat(formOtAmount) || 0;
                        const otherAll = parseFloat(formOtherAllowances) || 0;
                        setFormNetSalary(String(totSal + otAmt + otherAll));
                      }}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input label="Other Deductions" value={formOtherDed} onChangeText={setFormOtherDed} keyboardType="numeric" />
                  </View>
                </View>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#DC2626' }}>
                  Total Deductions: ₹{formTotalDed}
                </Text>
              </View>

              {/* Overtime & Other Allowances */}
              <View style={{ backgroundColor: colors.background, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, gap: 10 }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: colors.text, textTransform: 'uppercase' }}>
                  Overtime & Additional Pay
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="Approved OT Hours"
                      placeholder="e.g. 4 or 8"
                      value={formOtHours}
                      onChangeText={(v) => {
                        setFormOtHours(v);
                        const emp = employees.find((e) => e.id === selEmpId);
                        applyFormRecalculation(
                          parseFloat(formOfferSalary) || 0,
                          parseFloat(formPresentDays) || 0,
                          parseFloat(formOffDays) || 0,
                          parseFloat(formPlDays) || 0,
                          parseFloat(formSlDays) || 0,
                          parseFloat(formClDays) || 0,
                          parseFloat(formHolidayDays) || 0,
                          parseFloat(formTds) || 0,
                          parseFloat(v) || 0,
                          parseFloat(formOtherAllowances) || 0,
                          parseFloat(formOtherDed) || 0,
                          emp
                        );
                      }}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input label="OT Pay Amount" value={formOtAmount} onChangeText={setFormOtAmount} keyboardType="numeric" />
                  </View>
                </View>

                <Input
                  label="Other Allowances"
                  value={formOtherAllowances}
                  onChangeText={(v) => {
                    setFormOtherAllowances(v);
                    const totSal = parseFloat(formTotalSalary) || 0;
                    const otAmt = parseFloat(formOtAmount) || 0;
                    const otherAll = parseFloat(v) || 0;
                    setFormNetSalary(String(totSal + otAmt + otherAll));
                  }}
                  keyboardType="numeric"
                />
              </View>

              {/* Net Payout Summary Card */}
              <View style={{ backgroundColor: '#0B1C30', padding: 14, borderRadius: 10, gap: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>Gross Salary:</Text>
                  <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 12 }}>₹{formGross}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>Total Deductions:</Text>
                  <Text style={{ color: '#FCA5A5', fontWeight: '700', fontSize: 12 }}>-₹{formTotalDed}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>Total Salary:</Text>
                  <Text style={{ color: '#93C5FD', fontWeight: '700', fontSize: 12 }}>₹{formTotalSalary}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>Overtime Pay:</Text>
                  <Text style={{ color: '#86EFAC', fontWeight: '700', fontSize: 12 }}>+₹{formOtAmount}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>Other Allowance:</Text>
                  <Text style={{ color: '#86EFAC', fontWeight: '700', fontSize: 12 }}>+₹{formOtherAllowances}</Text>
                </View>
                <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 4 }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: '#86F2E4', fontWeight: '800', fontSize: 14 }}>NET TAKE-HOME:</Text>
                  <Text style={{ color: '#86F2E4', fontWeight: '800', fontSize: 20 }}>₹{formNetSalary}</Text>
                </View>
              </View>

              <View style={{ gap: 8, marginTop: 8 }}>
                <Button title="Add Entry to Period" onPress={handleAddEntry} loading={adding} />
                <Button title="Cancel" variant="ghost" onPress={() => setShowAdd(false)} />
              </View>
            </View>
          </ScrollView>
        </Modal>

        {/* ── Edit Entry Modal ────────────────────────────────────────────── */}
        <Modal visible={!!editingEntry} onClose={() => setEditingEntry(null)} title={`Edit Payroll: ${editingEntry?.employee?.profile?.full_name || 'Staff'}`}>
          <ScrollView style={{ maxHeight: 650 }} showsVerticalScrollIndicator={false}>
            <View style={{ gap: 14 }}>
              <TouchableOpacity
                style={[styles.syncBtn, { borderColor: colors.primary, alignSelf: 'flex-start' }]}
                onPress={handleResetToStatutory}
              >
                <Calculator size={14} color={colors.primary} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>
                  Reset to Enrolled Defaults
                </Text>
              </TouchableOpacity>

              {/* Offer Salary */}
              <Input
                label="Offer Salary (Base Scale)"
                value={formOfferSalary}
                onChangeText={(v) => {
                  setFormOfferSalary(v);
                  const emp = editingEntry?.employee as any;
                  applyFormRecalculation(
                    parseFloat(v) || 0,
                    parseFloat(formPresentDays) || 0,
                    parseFloat(formOffDays) || 0,
                    parseFloat(formPlDays) || 0,
                    parseFloat(formSlDays) || 0,
                    parseFloat(formClDays) || 0,
                    parseFloat(formHolidayDays) || 0,
                    parseFloat(formTds) || 0,
                    parseFloat(formOtHours) || 0,
                    parseFloat(formOtherAllowances) || 0,
                    parseFloat(formOtherDed) || 0,
                    emp
                  );
                }}
                keyboardType="numeric"
              />

              {/* Attendance & Paid Days */}
              <View style={{ backgroundColor: colors.background, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, gap: 10 }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: colors.text, textTransform: 'uppercase' }}>
                  Attendance & Paid Days
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="Present Days"
                      value={formPresentDays}
                      onChangeText={(v) => {
                        setFormPresentDays(v);
                        const emp = editingEntry?.employee as any;
                        applyFormRecalculation(
                          parseFloat(formOfferSalary) || 0,
                          parseFloat(v) || 0,
                          parseFloat(formOffDays) || 0,
                          parseFloat(formPlDays) || 0,
                          parseFloat(formSlDays) || 0,
                          parseFloat(formClDays) || 0,
                          parseFloat(formHolidayDays) || 0,
                          parseFloat(formTds) || 0,
                          parseFloat(formOtHours) || 0,
                          parseFloat(formOtherAllowances) || 0,
                          parseFloat(formOtherDed) || 0,
                          emp
                        );
                      }}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="Weekly Off"
                      value={formOffDays}
                      onChangeText={(v) => {
                        setFormOffDays(v);
                        const emp = editingEntry?.employee as any;
                        applyFormRecalculation(
                          parseFloat(formOfferSalary) || 0,
                          parseFloat(formPresentDays) || 0,
                          parseFloat(v) || 0,
                          parseFloat(formPlDays) || 0,
                          parseFloat(formSlDays) || 0,
                          parseFloat(formClDays) || 0,
                          parseFloat(formHolidayDays) || 0,
                          parseFloat(formTds) || 0,
                          parseFloat(formOtHours) || 0,
                          parseFloat(formOtherAllowances) || 0,
                          parseFloat(formOtherDed) || 0,
                          emp
                        );
                      }}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="Holidays"
                      value={formHolidayDays}
                      onChangeText={(v) => {
                        setFormHolidayDays(v);
                        const emp = editingEntry?.employee as any;
                        applyFormRecalculation(
                          parseFloat(formOfferSalary) || 0,
                          parseFloat(formPresentDays) || 0,
                          parseFloat(formOffDays) || 0,
                          parseFloat(formPlDays) || 0,
                          parseFloat(formSlDays) || 0,
                          parseFloat(formClDays) || 0,
                          parseFloat(v) || 0,
                          parseFloat(formTds) || 0,
                          parseFloat(formOtHours) || 0,
                          parseFloat(formOtherAllowances) || 0,
                          parseFloat(formOtherDed) || 0,
                          emp
                        );
                      }}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="PL"
                      value={formPlDays}
                      onChangeText={(v) => {
                        setFormPlDays(v);
                        const emp = editingEntry?.employee as any;
                        applyFormRecalculation(
                          parseFloat(formOfferSalary) || 0,
                          parseFloat(formPresentDays) || 0,
                          parseFloat(formOffDays) || 0,
                          parseFloat(v) || 0,
                          parseFloat(formSlDays) || 0,
                          parseFloat(formClDays) || 0,
                          parseFloat(formHolidayDays) || 0,
                          parseFloat(formTds) || 0,
                          parseFloat(formOtHours) || 0,
                          parseFloat(formOtherAllowances) || 0,
                          parseFloat(formOtherDed) || 0,
                          emp
                        );
                      }}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="SL"
                      value={formSlDays}
                      onChangeText={(v) => {
                        setFormSlDays(v);
                        const emp = editingEntry?.employee as any;
                        applyFormRecalculation(
                          parseFloat(formOfferSalary) || 0,
                          parseFloat(formPresentDays) || 0,
                          parseFloat(formOffDays) || 0,
                          parseFloat(formPlDays) || 0,
                          parseFloat(v) || 0,
                          parseFloat(formClDays) || 0,
                          parseFloat(formHolidayDays) || 0,
                          parseFloat(formTds) || 0,
                          parseFloat(formOtHours) || 0,
                          parseFloat(formOtherAllowances) || 0,
                          parseFloat(formOtherDed) || 0,
                          emp
                        );
                      }}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="CL"
                      value={formClDays}
                      onChangeText={(v) => {
                        setFormClDays(v);
                        const emp = editingEntry?.employee as any;
                        applyFormRecalculation(
                          parseFloat(formOfferSalary) || 0,
                          parseFloat(formPresentDays) || 0,
                          parseFloat(formOffDays) || 0,
                          parseFloat(formPlDays) || 0,
                          parseFloat(formSlDays) || 0,
                          parseFloat(v) || 0,
                          parseFloat(formHolidayDays) || 0,
                          parseFloat(formTds) || 0,
                          parseFloat(formOtHours) || 0,
                          parseFloat(formOtherAllowances) || 0,
                          parseFloat(formOtherDed) || 0,
                          emp
                        );
                      }}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#F0FDFA', padding: 8, borderRadius: 6 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#0F766E' }}>
                    Paid Days: {formPaidDays}
                  </Text>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#B45309' }}>
                    LWP: {formLwpDays}
                  </Text>
                </View>
              </View>

              {/* Earnings Breakdown */}
              <View style={{ backgroundColor: colors.background, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, gap: 10 }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: colors.text, textTransform: 'uppercase' }}>
                  Earnings Breakdown
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Input label="Basic Salary" value={formBasic} onChangeText={setFormBasic} keyboardType="numeric" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input label="HRA" value={formHra} onChangeText={setFormHra} keyboardType="numeric" />
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Input label="Conveyance" value={formConv} onChangeText={setFormConv} keyboardType="numeric" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input label="Washing Allowance" value={formWash} onChangeText={setFormWash} keyboardType="numeric" />
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Input label="Special Allowance" value={formSpecial} onChangeText={setFormSpecial} keyboardType="numeric" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input label="Gross Earnings" value={formGross} onChangeText={setFormGross} keyboardType="numeric" />
                  </View>
                </View>
              </View>

              {/* Deductions */}
              <View style={{ backgroundColor: colors.background, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, gap: 10 }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: colors.text, textTransform: 'uppercase' }}>
                  Deductions
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Input label="EPF" value={formPf} onChangeText={setFormPf} keyboardType="numeric" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input label="ESIC" value={formEsi} onChangeText={setFormEsi} keyboardType="numeric" />
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="TDS"
                      value={formTds}
                      onChangeText={(v) => {
                        setFormTds(v);
                        const pfVal = parseFloat(formPf) || 0;
                        const esiVal = parseFloat(formEsi) || 0;
                        const tdsVal = parseFloat(v) || 0;
                        const otherDedVal = parseFloat(formOtherDed) || 0;
                        const totDed = pfVal + esiVal + tdsVal + otherDedVal;
                        setFormTotalDed(String(totDed));
                        const grossVal = parseFloat(formGross) || 0;
                        const totSal = Math.max(0, grossVal - totDed);
                        setFormTotalSalary(String(totSal));
                        const otAmt = parseFloat(formOtAmount) || 0;
                        const otherAll = parseFloat(formOtherAllowances) || 0;
                        setFormNetSalary(String(totSal + otAmt + otherAll));
                      }}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input label="Other Deductions" value={formOtherDed} onChangeText={setFormOtherDed} keyboardType="numeric" />
                  </View>
                </View>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#DC2626' }}>
                  Total Deductions: ₹{formTotalDed}
                </Text>
              </View>

              {/* Overtime & Other Allowances */}
              <View style={{ backgroundColor: colors.background, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, gap: 10 }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: colors.text, textTransform: 'uppercase' }}>
                  Overtime & Additional Pay
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="Approved OT Hours"
                      placeholder="e.g. 4 or 8"
                      value={formOtHours}
                      onChangeText={(v) => {
                        setFormOtHours(v);
                        const emp = editingEntry?.employee as any;
                        applyFormRecalculation(
                          parseFloat(formOfferSalary) || 0,
                          parseFloat(formPresentDays) || 0,
                          parseFloat(formOffDays) || 0,
                          parseFloat(formPlDays) || 0,
                          parseFloat(formSlDays) || 0,
                          parseFloat(formClDays) || 0,
                          parseFloat(formHolidayDays) || 0,
                          parseFloat(formTds) || 0,
                          parseFloat(v) || 0,
                          parseFloat(formOtherAllowances) || 0,
                          parseFloat(formOtherDed) || 0,
                          emp
                        );
                      }}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input label="OT Pay Amount" value={formOtAmount} onChangeText={setFormOtAmount} keyboardType="numeric" />
                  </View>
                </View>

                <Input
                  label="Other Allowances"
                  value={formOtherAllowances}
                  onChangeText={(v) => {
                    setFormOtherAllowances(v);
                    const totSal = parseFloat(formTotalSalary) || 0;
                    const otAmt = parseFloat(formOtAmount) || 0;
                    const otherAll = parseFloat(v) || 0;
                    setFormNetSalary(String(totSal + otAmt + otherAll));
                  }}
                  keyboardType="numeric"
                />
              </View>

              {/* Net Payout Summary Card */}
              <View style={{ backgroundColor: '#0B1C30', padding: 14, borderRadius: 10, gap: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>Gross Salary:</Text>
                  <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 12 }}>₹{formGross}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>Total Deductions:</Text>
                  <Text style={{ color: '#FCA5A5', fontWeight: '700', fontSize: 12 }}>-₹{formTotalDed}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>Total Salary:</Text>
                  <Text style={{ color: '#93C5FD', fontWeight: '700', fontSize: 12 }}>₹{formTotalSalary}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>Overtime Pay:</Text>
                  <Text style={{ color: '#86EFAC', fontWeight: '700', fontSize: 12 }}>+₹{formOtAmount}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>Other Allowance:</Text>
                  <Text style={{ color: '#86EFAC', fontWeight: '700', fontSize: 12 }}>+₹{formOtherAllowances}</Text>
                </View>
                <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 4 }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: '#86F2E4', fontWeight: '800', fontSize: 14 }}>NET TAKE-HOME:</Text>
                  <Text style={{ color: '#86F2E4', fontWeight: '800', fontSize: 20 }}>₹{formNetSalary}</Text>
                </View>
              </View>

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
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionBtnText: { fontSize: 13, fontWeight: '600' },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  kpiCard: {
    flex: 1,
    minWidth: 200,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  kpiIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiLabel: { fontSize: 12, fontWeight: '600' },
  kpiValue: { fontSize: 18, fontWeight: '800', marginTop: 2 },
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
  filterBar: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
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
