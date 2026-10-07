import { db } from '@/lib/firebase';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
} from 'firebase/firestore';
import { getEmployees } from './employee';
import { MONTHS } from '@/constants/config';
import type { PayrollPeriod, Payroll, Payslip, Employee, Profile, Department } from '@/types';
import { getHolidaysForDateRange } from './holidays';

export async function getPayslips(employeeId: string): Promise<Payslip[]> {
  try {
    const [payslipSnap, payrollSnap] = await Promise.all([
      getDocs(query(collection(db, 'payslips'), where('employee_id', '==', employeeId))),
      getDocs(collection(db, 'payroll')),
    ]);

    const payrollMap = new Map<string, Payroll>();
    payrollSnap.forEach((d) => payrollMap.set(d.id, { id: d.id, ...d.data() } as Payroll));

    const payslips: Payslip[] = [];
    payslipSnap.forEach((d) => {
      const ps = { id: d.id, ...d.data() } as Payslip;
      ps.payroll = ps.payroll_id ? payrollMap.get(ps.payroll_id) : undefined;
      payslips.push(ps);
    });

    payslips.sort((a, b) => {
      if (a.period_year !== b.period_year) return b.period_year - a.period_year;
      return b.period_month - a.period_month;
    });

    return payslips;
  } catch (err) {
    console.error('getPayslips error:', err);
    return [];
  }
}

export async function getPayslipDetail(payslipId: string): Promise<Payslip | null> {
  try {
    const snap = await getDoc(doc(db, 'payslips', payslipId));
    if (!snap.exists()) return null;
    const ps = { id: snap.id, ...snap.data() } as Payslip;

    if (ps.payroll_id) {
      const pSnap = await getDoc(doc(db, 'payroll', ps.payroll_id));
      if (pSnap.exists()) {
        const payrollData = { id: pSnap.id, ...pSnap.data() } as Payroll;
        if (payrollData.employee_id) {
          const empSnap = await getDoc(doc(db, 'employees', payrollData.employee_id));
          if (empSnap.exists()) {
            const empData = { id: empSnap.id, ...empSnap.data() } as Employee;
            if (empData.profile_id) {
              const profSnap = await getDoc(doc(db, 'profiles', empData.profile_id));
              if (profSnap.exists()) {
                empData.profile = { id: profSnap.id, ...profSnap.data() } as Profile;
              }
            }
            payrollData.employee = empData;
          }
        }
        ps.payroll = payrollData;
      }
    }

    return ps;
  } catch (err) {
    console.error('getPayslipDetail error:', err);
    return null;
  }
}

export async function getPayrollPeriods(organizationId?: string): Promise<PayrollPeriod[]> {
  try {
    const snap = await getDocs(collection(db, 'payroll_periods'));
    const periods: PayrollPeriod[] = [];
    snap.forEach((d) => {
      const p = { id: d.id, ...d.data() } as PayrollPeriod;
      if (!organizationId || !p.organization_id || p.organization_id === organizationId) {
        periods.push(p);
      }
    });

    periods.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });

    return periods;
  } catch (err) {
    console.error('getPayrollPeriods error:', err);
    return [];
  }
}

async function countLopDays(employeeId: string, month: number, year: number): Promise<number> {
  try {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endMonth = month === 12 ? 1 : month + 1;
    const endYear = month === 12 ? year + 1 : year;
    const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

    const holidays = await getHolidaysForDateRange(startDate, endDate);
    const holidayDates = new Set(holidays.filter((h) => h.type !== 'optional').map((h) => h.date));

    // Absent attendance days
    const attQ = query(
      collection(db, 'attendance'),
      where('employee_id', '==', employeeId),
      where('status', '==', 'absent')
    );
    const attSnap = await getDocs(attQ);
    let absentDays = 0;
    attSnap.forEach((d) => {
      const data = d.data();
      if (data.date >= startDate && data.date < endDate && !holidayDates.has(data.date)) {
        absentDays++;
      }
    });

    // Unpaid leaves
    const leaveQ = query(
      collection(db, 'leave_requests'),
      where('employee_id', '==', employeeId),
      where('status', '==', 'approved')
    );
    const leaveSnap = await getDocs(leaveQ);
    let unpaidLeaveDays = 0;
    leaveSnap.forEach((d) => {
      const data = d.data();
      if (data.start_date >= startDate && data.start_date < endDate) {
        unpaidLeaveDays += data.days || 0;
      }
    });

    // Handle Late Days based on Org Settings
    let lateDays = 0;
    const lateQ = query(
      collection(db, 'attendance'),
      where('employee_id', '==', employeeId),
      where('status', '==', 'late')
    );
    const lateSnap = await getDocs(lateQ);
    lateSnap.forEach((d) => {
      const data = d.data();
      if (data.date >= startDate && data.date < endDate && !holidayDates.has(data.date)) {
        lateDays++;
      }
    });

    // Check Org Settings for late deduction
    let lateLopPenalty = 0;
    try {
      const empSnap = await getDoc(doc(db, 'employees', employeeId));
      if (empSnap.exists()) {
        const orgId = empSnap.data().organization_id;
        if (orgId) {
          const orgSnap = await getDoc(doc(db, 'organizations', orgId));
          if (orgSnap.exists()) {
            const settings = orgSnap.data().settings || {};
            if (settings.late_attendance_deduction_enabled) {
              const maxLate = settings.max_late_days_allowed || 3;
              if (lateDays > maxLate) {
                // E.g., for every late day above maxLate, add 0.5 LOP day
                lateLopPenalty = (lateDays - maxLate) * 0.5;
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('Could not calculate late penalty:', e);
    }

    return absentDays + unpaidLeaveDays + lateLopPenalty;
  } catch {
    return 0;
  }
}

export function calculateTds(annualBasic: number, taxConfig?: Record<string, any>): number {
  if (taxConfig?.tds_percentage != null && !isNaN(Number(taxConfig.tds_percentage)) && taxConfig.tds_percentage !== '') {
    return Math.round((annualBasic * Number(taxConfig.tds_percentage)) / 100);
  }

  const regime = taxConfig?.tax_regime || 'new';
  const annualTaxable = annualBasic * 12;

  if (regime === 'custom') {
    const customRate = Number(taxConfig?.custom_tax_percentage ?? taxConfig?.tds_percentage ?? 0);
    return Math.round((annualBasic * customRate) / 100);
  }

  if (regime === 'old') {
    let tax = 0;
    if (annualTaxable <= 250000) tax = 0;
    else if (annualTaxable <= 500000) tax = (annualTaxable - 250000) * 0.05;
    else if (annualTaxable <= 1000000) tax = 12500 + (annualTaxable - 500000) * 0.2;
    else tax = 112500 + (annualTaxable - 1000000) * 0.3;
    return Math.round(tax / 12);
  } else {
    let tax = 0;
    if (annualTaxable <= 300000) tax = 0;
    else if (annualTaxable <= 700000) tax = (annualTaxable - 300000) * 0.05;
    else if (annualTaxable <= 1000000) tax = 20000 + (annualTaxable - 700000) * 0.1;
    else if (annualTaxable <= 1200000) tax = 50000 + (annualTaxable - 1000000) * 0.15;
    else if (annualTaxable <= 1500000) tax = 80000 + (annualTaxable - 1200000) * 0.2;
    else tax = 140000 + (annualTaxable - 1500000) * 0.3;
    if (annualTaxable <= 700000) tax = 0;
    return Math.round(tax / 12);
  }
}

export async function calculateStatutoryForEmployee(
  emp: Employee,
  month: number,
  year: number,
  customLopDays?: number
): Promise<{
  basic_salary: number;
  allowances: Record<string, number>;
  deductions: Record<string, number>;
  lop_days: number;
  lop_amount: number;
  gross_salary: number;
  net_salary: number;
}> {
  const basic = emp.basic_salary || 0;
  const taxConfig = (emp as any).tax_config || {};

  let epfRate = 0.12;
  if (taxConfig.epf_exempt) {
    epfRate = 0;
  } else if (taxConfig.epf_percentage != null && !isNaN(Number(taxConfig.epf_percentage))) {
    epfRate = Number(taxConfig.epf_percentage) / 100;
  }
  const epf = Math.round(basic * epfRate);

  let pt = basic > 15000 ? 200 : 0;
  if (taxConfig.pt_amount != null && !isNaN(Number(taxConfig.pt_amount))) {
    pt = Number(taxConfig.pt_amount);
  }

  const tds = calculateTds(basic, taxConfig);
  const lopDays = customLopDays !== undefined ? customLopDays : await countLopDays(emp.id, month, year);
  const lopAmount = lopDays > 0 ? Math.round((basic / 26) * lopDays) : 0;

  let hraRate = taxConfig.hra_type === 'metro' ? 0.5 : 0.4;
  if (taxConfig.hra_percentage != null && !isNaN(Number(taxConfig.hra_percentage))) {
    hraRate = Number(taxConfig.hra_percentage) / 100;
  }
  const hra = Math.round(basic * hraRate);
  const specialAllowance = Math.max(0, Math.round(basic * 0.1));

  const allowances: Record<string, number> = {
    'HRA': hra,
    'Special Allowance': specialAllowance,
  };

  if (taxConfig.transport_allowance && Number(taxConfig.transport_allowance) > 0) {
    allowances['Transport Allowance'] = Math.round(Number(taxConfig.transport_allowance));
  }

  const deductions: Record<string, number> = {
    'EPF': epf,
    'Professional Tax': pt,
    'TDS': tds,
  };

  const customItems: any[] = Array.isArray(taxConfig.custom_items) ? taxConfig.custom_items : [];
  customItems.forEach((item) => {
    if (!item.name || !item.value) return;
    const isPercentage = item.amount_type === 'percentage';
    const computedVal = isPercentage ? Math.round((basic * Number(item.value)) / 100) : Math.round(Number(item.value));

    if (item.type === 'deduction') {
      deductions[item.name] = computedVal;
    } else {
      allowances[item.name] = computedVal;
    }
  });

  const totalAllowances = Object.values(allowances).reduce((sum, v) => sum + v, 0);
  const gross = basic + totalAllowances - lopAmount;
  const totalDeductions = Object.values(deductions).reduce((sum, v) => sum + v, 0);
  const netSalary = Math.max(0, gross - totalDeductions);

  return {
    basic_salary: basic,
    allowances,
    deductions,
    lop_days: lopDays,
    lop_amount: lopAmount,
    gross_salary: gross,
    net_salary: netSalary,
  };
}

export async function createPayrollPeriod(month: number, year: number, orgId: string): Promise<PayrollPeriod> {
  if (!orgId) {
    throw new Error('No organization is linked to your account, so payroll cannot be generated.');
  }
  if (!month || month < 1 || month > 12) {
    throw new Error('Please choose a valid month before generating payroll.');
  }

  const periodId = `pp_${orgId}_${year}_${month}`;
  const now = new Date().toISOString();

  // Check for duplicate
  const existingSnap = await getDoc(doc(db, 'payroll_periods', periodId));
  if (existingSnap.exists()) {
    throw new Error(`A payroll period for ${MONTHS[month - 1]} ${year} already exists.`);
  }

  const period: PayrollPeriod = {
    id: periodId,
    month,
    year,
    organization_id: orgId,
    status: 'open',
    processed_at: null,
    created_at: now,
  };

  await setDoc(doc(db, 'payroll_periods', periodId), period);

  // Fetch active employees
  const employees = await getEmployees({ organization_id: orgId, employment_status: 'active' });

  if (!employees || employees.length === 0) {
    await deleteDoc(doc(db, 'payroll_periods', periodId));
    throw new Error('No active employees were found for this organization. Add employees first, then try again.');
  }

  // Generate entries
  for (const emp of employees) {
    const breakdown = await calculateStatutoryForEmployee(emp, month, year);
    const entryId = `payroll_${emp.id}_${year}_${month}`;
    const entryData: Payroll = {
      id: entryId,
      payroll_period_id: periodId,
      employee_id: emp.id,
      basic_salary: breakdown.basic_salary,
      allowances: breakdown.allowances,
      deductions: breakdown.deductions,
      lop_days: breakdown.lop_days,
      lop_amount: breakdown.lop_amount,
      gross_salary: breakdown.gross_salary,
      net_salary: breakdown.net_salary,
      status: 'draft',
      created_at: now,
      updated_at: now,
    };
    await setDoc(doc(db, 'payroll', entryId), entryData);
  }

  return period;
}

export async function recalculatePeriodEntries(periodId: string): Promise<void> {
  const periodSnap = await getDoc(doc(db, 'payroll_periods', periodId));
  if (!periodSnap.exists()) throw new Error('Payroll period not found');
  const period = periodSnap.data() as PayrollPeriod;

  const entriesQ = query(collection(db, 'payroll'), where('payroll_period_id', '==', periodId));
  const entriesSnap = await getDocs(entriesQ);

  const now = new Date().toISOString();
  for (const d of entriesSnap.docs) {
    const entry = d.data() as Payroll;
    const empSnap = await getDoc(doc(db, 'employees', entry.employee_id));
    if (empSnap.exists()) {
      const emp = { id: empSnap.id, ...empSnap.data() } as Employee;
      const breakdown = await calculateStatutoryForEmployee(emp, period.month, period.year, entry.lop_days);
      await updateDoc(doc(db, 'payroll', d.id), {
        basic_salary: breakdown.basic_salary,
        allowances: breakdown.allowances,
        deductions: breakdown.deductions,
        lop_amount: breakdown.lop_amount,
        gross_salary: breakdown.gross_salary,
        net_salary: breakdown.net_salary,
        updated_at: now,
      });
    }
  }
}

export async function getPayrollEntries(periodId: string): Promise<Payroll[]> {
  try {
    const [entriesSnap, empsSnap, profsSnap, deptsSnap] = await Promise.all([
      getDocs(query(collection(db, 'payroll'), where('payroll_period_id', '==', periodId))),
      getDocs(collection(db, 'employees')),
      getDocs(collection(db, 'profiles')),
      getDocs(collection(db, 'departments')),
    ]);

    const profMap = new Map<string, Profile>();
    profsSnap.forEach((d) => profMap.set(d.id, { id: d.id, ...d.data() } as Profile));

    const deptMap = new Map<string, Department>();
    deptsSnap.forEach((d) => deptMap.set(d.id, { id: d.id, ...d.data() } as Department));

    const empMap = new Map<string, Employee>();
    empsSnap.forEach((d) => {
      const emp = { id: d.id, ...d.data() } as Employee;
      emp.profile = emp.profile_id ? profMap.get(emp.profile_id) : undefined;
      emp.department = emp.department_id ? deptMap.get(emp.department_id) : undefined;
      empMap.set(d.id, emp);
    });

    const entries: Payroll[] = [];
    entriesSnap.forEach((d) => {
      const entry = { id: d.id, ...d.data() } as Payroll;
      entry.employee = entry.employee_id ? empMap.get(entry.employee_id) : undefined;
      entries.push(entry);
    });

    return entries;
  } catch (err) {
    console.error('getPayrollEntries error:', err);
    return [];
  }
}

export async function createPayrollEntry(entry: {
  payroll_period_id: string;
  employee_id: string;
  basic_salary: number;
  allowances: Record<string, number>;
  deductions: Record<string, number>;
  lop_days: number;
  lop_amount: number;
  gross_salary: number;
  net_salary: number;
}): Promise<Payroll> {
  const entryId = `payroll_${entry.employee_id}_${Date.now()}`;
  const now = new Date().toISOString();
  const payrollObj: Payroll = {
    id: entryId,
    ...entry,
    status: 'draft',
    created_at: now,
    updated_at: now,
  };

  await setDoc(doc(db, 'payroll', entryId), payrollObj);
  return payrollObj;
}

export async function updatePayrollEntry(id: string, updates: Partial<Payroll>): Promise<void> {
  await updateDoc(doc(db, 'payroll', id), {
    ...updates,
    updated_at: new Date().toISOString(),
  });
}

export async function processPayrollPeriod(periodId: string): Promise<void> {
  const now = new Date().toISOString();

  const entriesQ = query(collection(db, 'payroll'), where('payroll_period_id', '==', periodId));
  const entriesSnap = await getDocs(entriesQ);

  for (const d of entriesSnap.docs) {
    await updateDoc(doc(db, 'payroll', d.id), { status: 'processed', updated_at: now });
  }

  await updateDoc(doc(db, 'payroll_periods', periodId), {
    status: 'closed',
    processed_at: now,
    updated_at: now,
  });
}

export async function distributePayroll(periodId: string, month: number, year: number): Promise<void> {
  const now = new Date().toISOString();

  const entriesQ = query(collection(db, 'payroll'), where('payroll_period_id', '==', periodId));
  const entriesSnap = await getDocs(entriesQ);

  for (const d of entriesSnap.docs) {
    const entry = { id: d.id, ...d.data() } as Payroll;
    await updateDoc(doc(db, 'payroll', d.id), { status: 'paid', updated_at: now });

    const payslipId = `ps_${entry.employee_id}_${year}_${month}`;
    const payslipData: Payslip = {
      id: payslipId,
      payroll_id: entry.id,
      employee_id: entry.employee_id,
      payslip_number: `PS-${year}${String(month).padStart(2, '0')}-${entry.id.substring(0, 5).toUpperCase()}`,
      period_month: month,
      period_year: year,
      file_url: null,
      created_at: now,
      payroll: entry,
    };
    await setDoc(doc(db, 'payslips', payslipId), payslipData);
  }
}

export async function generatePayslipForEntry(
  payrollEntry: Payroll,
  month: number,
  year: number
): Promise<Payslip> {
  const now = new Date().toISOString();
  const payslipId = `ps_${payrollEntry.employee_id}_${year}_${month}`;

  const existingSnap = await getDoc(doc(db, 'payslips', payslipId));
  if (existingSnap.exists()) {
    return { id: existingSnap.id, ...existingSnap.data() } as Payslip;
  }

  await updateDoc(doc(db, 'payroll', payrollEntry.id), { status: 'paid', updated_at: now });

  const payslipNumber = `PS-${year}${String(month).padStart(2, '0')}-${payrollEntry.id.substring(0, 5).toUpperCase()}`;
  const payslip: Payslip = {
    id: payslipId,
    payroll_id: payrollEntry.id,
    employee_id: payrollEntry.employee_id,
    payslip_number: payslipNumber,
    period_month: month,
    period_year: year,
    file_url: null,
    created_at: now,
    payroll: payrollEntry,
  };

  await setDoc(doc(db, 'payslips', payslipId), payslip);
  return payslip;
}
