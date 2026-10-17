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
  customLopDays?: number,
  customOtUnits?: number
): Promise<{
  basic_salary: number;
  allowances: Record<string, number>;
  deductions: Record<string, number>;
  lop_days: number;
  lop_amount: number;
  gross_salary: number;
  net_salary: number;
  // Shanti Memorial Hospital & Chikitsa Unit structured payroll fields
  salary_details: number;
  payable_days: number;
  present_days: number;
  off_days: number;
  leave_days: number;
  holiday_days: number;
  paid_days: number;
  basic: number;
  hra: number;
  conveyance: number;
  washing: number;
  special_allowance: number;
  pt_tds: number;
  esi: number;
  pf: number;
  ot_ded: number;
  gross_deductions: number;
  ot_hours_or_days: number;
  ot_amount: number;
  other_allowances: number;
  is_pf_eligible: boolean;
  hospital_unit: string;
}> {
  const taxConfig = (emp as any).tax_config || {};
  const isPfEligible = emp.is_pf_eligible !== false && !taxConfig.epf_exempt;
  const isOvertimeEligible = emp.is_overtime_eligible === true || taxConfig.is_overtime_eligible === true;
  const hospitalUnit = emp.hospital_unit || 'Shanti Memorial Hospital & Chikitsa Unit';

  // Base monthly salary scale (SALARY DETAILS in Hospital Sheet)
  const baseSalary = emp.basic_salary && emp.basic_salary > 0 ? emp.basic_salary : 25000;
  const payableDays = 30;

  // Compute actual attendance breakdown for the month
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

  let presentDays = 26;
  let offDays = 4;
  let leaveDays = 0;
  let holidayDays = 0;

  try {
    const holidays = await getHolidaysForDateRange(startDate, endDate);
    holidayDays = holidays.filter((h) => h.type !== 'optional').length;

    const attQ = query(
      collection(db, 'attendance'),
      where('employee_id', '==', emp.id)
    );
    const attSnap = await getDocs(attQ);
    let matchedAttCount = 0;
    attSnap.forEach((d) => {
      const data = d.data();
      if (data.date >= startDate && data.date < endDate) {
        if (data.status === 'present' || data.status === 'late') {
          matchedAttCount++;
        }
      }
    });
    if (matchedAttCount > 0) {
      presentDays = matchedAttCount;
    }
  } catch {}

  const paidDays = Math.min(payableDays, Math.max(0, presentDays + offDays + leaveDays + holidayDays));
  const lopDays = customLopDays !== undefined ? customLopDays : Math.max(0, payableDays - paidDays);
  const paidRatio = paidDays / payableDays;

  // Gross Earnings Formula: Basic Salary + HRA + Conveyance Allowance + Washing Allowance + Special Allowance
  const fullBasic = Math.round(baseSalary * 0.50); // 50% Basic
  const fullHra = Math.round(baseSalary * 0.20); // 20% HRA
  const fullConveyance = emp.conveyance_allowance ?? (baseSalary >= 25000 ? 1200 : baseSalary >= 18000 ? 800 : 350);
  const fullWashing = emp.washing_allowance ?? (baseSalary >= 25000 ? 500 : 300);
  const fullSpecialAllowance = Math.max(0, baseSalary - (fullBasic + fullHra + fullConveyance + fullWashing));

  const basic = Math.round(fullBasic * paidRatio);
  const hra = Math.round(fullHra * paidRatio);
  const conveyance = Math.round(fullConveyance * paidRatio);
  const washing = Math.round(fullWashing * paidRatio);
  const specialAllowance = Math.round(fullSpecialAllowance * paidRatio);

  const grossEarnings = basic + hra + conveyance + washing + specialAllowance;

  // Gross Deductions Formula: PF + ESIC + TDS/PT + Miscellaneous Deductions (OT. DED)
  let pf = 0;
  if (isPfEligible) {
    // 12% of Basic, statutory ceiling capped at ₹1,800 or actual
    const calculatedPf = Math.round(basic * 0.12);
    pf = basic > 15000 ? Math.min(1800, calculatedPf) : calculatedPf;
  }

  // ESIC: 0.75% of Gross if Gross <= ₹21,000, 0 otherwise
  let esi = 0;
  if (baseSalary <= 21000) {
    esi = Math.round(grossEarnings * 0.0075);
  }

  // Professional Tax / TDS
  let pt = 0;
  if (taxConfig.pt_amount != null && !isNaN(Number(taxConfig.pt_amount))) {
    pt = Number(taxConfig.pt_amount);
  } else if (baseSalary > 20000) {
    pt = 0; // TDS handles higher slabs or state-specific
  } else if (baseSalary >= 18000) {
    pt = 146;
  } else if (baseSalary >= 15000) {
    pt = 124;
  } else if (baseSalary >= 10000) {
    pt = 90;
  }

  const tds = calculateTds(basic, taxConfig);
  const ptTds = pt + tds;

  // Miscellaneous Deductions (OT. DED in Hospital Sheet)
  const otDed = emp.ot_deduction ?? Number(taxConfig.ot_deduction ?? 0);
  const grossDeductions = pf + esi + ptTds + otDed;

  // Overtime Calculation (Requirement 5: designated employees only, after scheduled 8-hour shift)
  const otUnits = customOtUnits !== undefined ? customOtUnits : Number((emp as any).ot_hours_or_days ?? 0);
  let otAmount = 0;
  if (isOvertimeEligible && otUnits > 0) {
    // (Gross Salary / Payable Days) * OT units
    otAmount = Math.round((baseSalary / payableDays) * otUnits);
  }

  // Other Allowances
  const otherAllowances = Number((emp as any).other_allowances ?? 0);

  // Net Pay Calculation: Gross Earnings - Gross Deductions + Overtime Pay + Other Allowances
  const netSalary = Math.max(0, grossEarnings - grossDeductions + otAmount + otherAllowances);

  const allowances: Record<string, number> = {
    'Basic': basic,
    'HRA': hra,
    'Conveyance Allowance': conveyance,
    'Washing Allowance': washing,
    'Special Allowance': specialAllowance,
  };
  if (otAmount > 0) {
    allowances['Overtime Pay'] = otAmount;
  }
  if (otherAllowances > 0) {
    allowances['Other Allowances'] = otherAllowances;
  }

  const deductions: Record<string, number> = {
    'PF': pf,
    'ESIC': esi,
    'PT/TDS': ptTds,
  };
  if (otDed > 0) {
    deductions['Miscellaneous Deductions'] = otDed;
  }

  return {
    basic_salary: basic,
    allowances,
    deductions,
    lop_days: lopDays,
    lop_amount: Math.round((baseSalary / payableDays) * lopDays),
    gross_salary: grossEarnings,
    net_salary: netSalary,
    salary_details: baseSalary,
    payable_days: payableDays,
    present_days: presentDays,
    off_days: offDays,
    leave_days: leaveDays,
    holiday_days: holidayDays,
    paid_days: paidDays,
    basic,
    hra,
    conveyance,
    washing,
    special_allowance: specialAllowance,
    pt_tds: ptTds,
    esi,
    pf,
    ot_ded: otDed,
    gross_deductions: grossDeductions,
    ot_hours_or_days: otUnits,
    ot_amount: otAmount,
    other_allowances: otherAllowances,
    is_pf_eligible: isPfEligible,
    hospital_unit: hospitalUnit,
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
      salary_details: breakdown.salary_details,
      payable_days: breakdown.payable_days,
      present_days: breakdown.present_days,
      off_days: breakdown.off_days,
      leave_days: breakdown.leave_days,
      holiday_days: breakdown.holiday_days,
      paid_days: breakdown.paid_days,
      basic: breakdown.basic,
      hra: breakdown.hra,
      conveyance: breakdown.conveyance,
      washing: breakdown.washing,
      special_allowance: breakdown.special_allowance,
      pt_tds: breakdown.pt_tds,
      esi: breakdown.esi,
      pf: breakdown.pf,
      ot_ded: breakdown.ot_ded,
      gross_deductions: breakdown.gross_deductions,
      ot_hours_or_days: breakdown.ot_hours_or_days,
      ot_amount: breakdown.ot_amount,
      other_allowances: breakdown.other_allowances,
      is_pf_eligible: breakdown.is_pf_eligible,
      hospital_unit: breakdown.hospital_unit,
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
      const breakdown = await calculateStatutoryForEmployee(emp, period.month, period.year, entry.lop_days, entry.ot_hours_or_days);
      await updateDoc(doc(db, 'payroll', d.id), {
        basic_salary: breakdown.basic_salary,
        allowances: breakdown.allowances,
        deductions: breakdown.deductions,
        lop_amount: breakdown.lop_amount,
        gross_salary: breakdown.gross_salary,
        net_salary: breakdown.net_salary,
        salary_details: breakdown.salary_details,
        payable_days: breakdown.payable_days,
        present_days: breakdown.present_days,
        off_days: breakdown.off_days,
        leave_days: breakdown.leave_days,
        holiday_days: breakdown.holiday_days,
        paid_days: breakdown.paid_days,
        basic: breakdown.basic,
        hra: breakdown.hra,
        conveyance: breakdown.conveyance,
        washing: breakdown.washing,
        special_allowance: breakdown.special_allowance,
        pt_tds: breakdown.pt_tds,
        esi: breakdown.esi,
        pf: breakdown.pf,
        ot_ded: breakdown.ot_ded,
        gross_deductions: breakdown.gross_deductions,
        ot_hours_or_days: breakdown.ot_hours_or_days,
        ot_amount: breakdown.ot_amount,
        other_allowances: breakdown.other_allowances,
        is_pf_eligible: breakdown.is_pf_eligible,
        hospital_unit: breakdown.hospital_unit,
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
