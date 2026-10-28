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

/**
 * Overtime Hours to OT Days converter:
 * After completion of regular 8-hour shift:
 * 4 hours approved OT = 0.5 day OT (half-day OT)
 * 7 hours approved OT = 1.0 day OT (one-day OT)
 */
export function calculateOtDaysFromHours(approvedHours: number): number {
  if (approvedHours <= 0) return 0;
  const fullDays = Math.floor(approvedHours / 7);
  const remainder = approvedHours % 7;
  let extra = 0;
  if (remainder >= 4) {
    extra = 0.5;
  }
  return fullDays + extra;
}

export async function calculateStatutoryForEmployee(
  emp: Employee,
  month: number,
  year: number,
  customLopDays?: number,
  customOtUnits?: number,
  customManualValues?: {
    tds?: number;
    other_allowances?: number;
    other_deductions?: number;
    offer_salary?: number;
    present_days?: number;
    off_days?: number;
    pl_days?: number;
    sl_days?: number;
    cl_days?: number;
    holiday_days?: number;
    paid_days?: number;
    ot_hours?: number;
    basic?: number;
    hra?: number;
    conveyance?: number;
    washing?: number;
    special_allowance?: number;
    gross_salary?: number;
    pf?: number;
    esi?: number;
    pt?: number;
  }
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
  pl_days: number;
  cl_days: number;
  sl_days: number;
  lwp_days: number;
  basic: number;
  hra: number;
  conveyance: number;
  washing: number;
  special_allowance: number;
  pt_tds: number;
  esi: number;
  pf: number;
  tds: number;
  ot_ded: number;
  gross_deductions: number;
  total_salary: number;
  ot_hours_or_days: number;
  ot_hours: number;
  ot_amount: number;
  other_allowances: number;
  is_pf_eligible: boolean;
  is_overtime_eligible: boolean;
  hospital_unit: string;
}> {
  const taxConfig = (emp as any).tax_config || {};
  const empType = (emp.employment_type || '').toLowerCase();
  const isRegular = empType !== 'contractual' && empType !== 'contract';
  const isPfEligible = isRegular && emp.is_pf_eligible === true && !taxConfig.epf_exempt;
  const isOvertimeEligible = emp.is_overtime_eligible === true || taxConfig.is_overtime_eligible === true;
  const hospitalUnit = emp.hospital_unit || 'Main Branch';

  // Base monthly salary scale (Offer Salary / SALARY DETAILS in Hospital Sheet)
  const offerSalary = customManualValues?.offer_salary ?? (emp.basic_salary && emp.basic_salary > 0 ? emp.basic_salary : 25000);

  // Requirement 2: Payable days = total calendar days of the respective month (30, 31, 28/29)
  const payableDays = new Date(year, month, 0).getDate();

  // Compute actual attendance breakdown for the month
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

  // Holidays
  let holidayDays = customManualValues?.holiday_days ?? 0;
  if (customManualValues?.holiday_days === undefined) {
    try {
      const holidays = await getHolidaysForDateRange(startDate, endDate);
      holidayDays = holidays.filter((h) => h.type !== 'optional').length;
    } catch {}
  }

  // Leaves (PL, SL, CL)
  let plDays = customManualValues?.pl_days ?? 0;
  let slDays = customManualValues?.sl_days ?? 0;
  let clDays = customManualValues?.cl_days ?? 0;
  if (customManualValues?.pl_days === undefined && customManualValues?.sl_days === undefined && customManualValues?.cl_days === undefined) {
    try {
      const leaveQ = query(
        collection(db, 'leave_requests'),
        where('employee_id', '==', emp.id),
        where('status', '==', 'approved')
      );
      const leaveSnap = await getDocs(leaveQ);
      leaveSnap.forEach((d) => {
        const data = d.data();
        if (data.start_date >= startDate && data.start_date < endDate) {
          const typeName = (data.leave_type_name || data.leave_type || '').toLowerCase();
          const days = Number(data.days || 1);
          if (typeName.includes('sick') || typeName.includes('sl') || typeName.includes('medical')) {
            slDays += days;
          } else if (typeName.includes('casual') || typeName.includes('cl')) {
            clDays += days;
          } else {
            plDays += days;
          }
        }
      });
    } catch {}
  }

  // Weekly Offs (Standard 4 weekly offs per month)
  const offDays = customManualValues?.off_days ?? 4;

  // Present Days
  let presentDays = customManualValues?.present_days ?? 0;
  if (customManualValues?.present_days === undefined) {
    let matchedAttCount = 0;
    let attRecordsFound = false;
    try {
      const attQ = query(
        collection(db, 'attendance'),
        where('employee_id', '==', emp.id)
      );
      const attSnap = await getDocs(attQ);
      attSnap.forEach((d) => {
        const data = d.data();
        if (data.date >= startDate && data.date < endDate) {
          attRecordsFound = true;
          if (data.status === 'present' || data.status === 'late') {
            matchedAttCount += 1;
          } else if (data.status === 'half_day') {
            matchedAttCount += 0.5;
          }
        }
      });
    } catch {}

    if (attRecordsFound) {
      presentDays = matchedAttCount;
    } else {
      // Default standard present days when punch log hasn't been individually created
      presentDays = Math.max(0, payableDays - offDays - holidayDays - plDays - slDays - clDays);
    }
  }

  // Requirement 1: Paid days = sum of Present Days, Weekly Offs, PL, SL, CL and Holidays
  const calculatedPaidDays = presentDays + offDays + plDays + slDays + clDays + holidayDays;
  const paidDays = customManualValues?.paid_days !== undefined
    ? customManualValues.paid_days
    : customLopDays !== undefined
      ? Math.max(0, payableDays - customLopDays)
      : Math.min(payableDays, Math.max(0, calculatedPaidDays));

  // LWP (Leave Without Pay)
  const lwpDays = Math.max(0, payableDays - paidDays);
  const lopDays = lwpDays;
  const paidRatio = payableDays > 0 ? paidDays / payableDays : 0;

  // Requirement 2: Gross salary calculated proportionately based on paid days against total calendar days
  const grossEarnings = customManualValues?.gross_salary ?? Math.round(offerSalary * paidRatio);

  // Requirement 3: Earnings Breakup - Basic (50%), HRA (20%), Conveyance, Washing, and Special Allowance
  // calculated automatically in proportion to paid days
  const fullBasic = Math.round(offerSalary * 0.50); // 50% Basic
  const fullHra = Math.round(offerSalary * 0.20); // 20% HRA
  const fullConveyance = customManualValues?.conveyance !== undefined
    ? customManualValues.conveyance
    : (emp.conveyance_allowance ?? (offerSalary >= 30000 ? 2000 : offerSalary >= 20000 ? 1200 : offerSalary >= 15000 ? 800 : 350));
  const fullWashing = customManualValues?.washing !== undefined
    ? customManualValues.washing
    : (emp.washing_allowance ?? (offerSalary >= 30000 ? 1000 : offerSalary >= 20000 ? 500 : 300));
  const fullSpecialAllowance = Math.max(0, offerSalary - (fullBasic + fullHra + fullConveyance + fullWashing));

  const basic = customManualValues?.basic ?? Math.round(fullBasic * paidRatio);
  const hra = customManualValues?.hra ?? Math.round(fullHra * paidRatio);
  const conveyance = customManualValues?.conveyance ?? Math.round(fullConveyance * paidRatio);
  const washing = customManualValues?.washing ?? Math.round(fullWashing * paidRatio);
  // Ensure the components sum up exactly to the proportioned Gross Earnings
  const specialAllowance = customManualValues?.special_allowance ?? Math.max(0, grossEarnings - (basic + hra + conveyance + washing));

  // Requirements 4 & 5: EPF Calculation & Applicability
  // EPF = 12% of Basic Salary for regular employees only.
  // For employees whose Basic Salary exceeds ₹25,000, EPF calculation base is capped at ₹25,000 (maximum of Rs. 3,000).
  // Deduction enabled ONLY for selected regular employees. Employees with Basic > 25,000 not enrolled in EPF have 0 EPF.
  let pf = 0;
  if (customManualValues?.pf !== undefined) {
    pf = customManualValues.pf;
  } else if (isPfEligible) {
    const epfWageBase = Math.min(basic, 25000);
    pf = Math.round(epfWageBase * 0.12);
  }

  // Requirement 6: ESIC Calculation: 0.75% of ESIC Salary, where ESIC Salary = Gross Salary - Washing Allowance
  const esicSalary = Math.max(0, grossEarnings - washing);
  let esi = 0;
  const isEsiExempt = taxConfig.esi_exempt === true || emp.is_esi_eligible === false;
  if (customManualValues?.esi !== undefined) {
    esi = customManualValues.esi;
  } else if (!isEsiExempt) {
    esi = Math.round(esicSalary * 0.0075);
  }

  // Requirement 7: TDS should be entered manually
  const tds = customManualValues?.tds !== undefined
    ? customManualValues.tds
    : Number(taxConfig.manual_tds ?? taxConfig.tds_amount ?? 0);

  // Professional Tax (PT)
  const pt = customManualValues?.pt !== undefined ? customManualValues.pt : 0;
  const ptTds = pt + tds;

  // Miscellaneous / Other Deductions
  const otDed = customManualValues?.other_deductions !== undefined
    ? customManualValues.other_deductions
    : (emp.ot_deduction ?? Number(taxConfig.ot_deduction ?? 0));
  const grossDeductions = pf + esi + ptTds + otDed;

  // Requirement 8: Overtime (OT)
  // Calculated ONLY for employees authorized for overtime.
  // After completion of regular 8-hour shift:
  // 4 hours of approved OT = 0.5 day OT, 7 hours of approved OT = 1.0 day OT.
  let otDays = 0;
  let otAmount = 0;
  const inputOtHours = customManualValues?.ot_hours ?? Number((emp as any).ot_hours ?? 0);

  if (isOvertimeEligible) {
    if (customOtUnits !== undefined) {
      otDays = customOtUnits;
    } else if (inputOtHours > 0) {
      otDays = calculateOtDaysFromHours(inputOtHours);
    } else {
      otDays = Number((emp as any).ot_hours_or_days ?? 0);
    }

    if (otDays > 0) {
      const dailyRate = payableDays > 0 ? offerSalary / payableDays : 0;
      otAmount = Math.round(dailyRate * otDays);
    }
  }

  // Requirement 9: Other allowances should be entered manually
  const otherAllowances = customManualValues?.other_allowances !== undefined
    ? customManualValues.other_allowances
    : Number((emp as any).other_allowances ?? 0);

  // Total Salary & Net Pay
  // Total Salary = Gross Earnings - Gross Deductions
  // Net Pay = Total Salary + Overtime Pay + Other Allowances
  const totalSalary = Math.max(0, grossEarnings - grossDeductions);
  const netSalary = Math.max(0, totalSalary + otAmount + otherAllowances);

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
    'TDS': tds,
  };
  if (pt > 0) {
    deductions['Professional Tax'] = pt;
  }
  if (otDed > 0) {
    deductions['Miscellaneous Deductions'] = otDed;
  }

  return {
    basic_salary: basic,
    allowances,
    deductions,
    lop_days: lopDays,
    lop_amount: Math.round((offerSalary / payableDays) * lopDays),
    gross_salary: grossEarnings,
    net_salary: netSalary,
    salary_details: offerSalary,
    payable_days: payableDays,
    present_days: presentDays,
    off_days: offDays,
    leave_days: plDays + slDays + clDays,
    pl_days: plDays,
    cl_days: clDays,
    sl_days: slDays,
    holiday_days: holidayDays,
    paid_days: paidDays,
    lwp_days: lwpDays,
    basic,
    hra,
    conveyance,
    washing,
    special_allowance: specialAllowance,
    pt_tds: ptTds,
    esi,
    pf,
    tds,
    ot_ded: otDed,
    gross_deductions: grossDeductions,
    total_salary: totalSalary,
    ot_hours_or_days: otDays,
    ot_hours: inputOtHours,
    ot_amount: otAmount,
    other_allowances: otherAllowances,
    is_pf_eligible: isPfEligible,
    is_overtime_eligible: isOvertimeEligible,
    hospital_unit: hospitalUnit,
  };
}

export async function createPayrollPeriod(month: number, year: number, orgId: string, unit?: string): Promise<PayrollPeriod> {
  if (!orgId) {
    throw new Error('No organization is linked to your account, so payroll cannot be generated.');
  }
  if (!month || month < 1 || month > 12) {
    throw new Error('Please choose a valid month before generating payroll.');
  }

  const targetUnit = unit && unit !== 'all' && unit !== 'All Units' ? unit : 'All Units';
  const safeUnitSlug = targetUnit !== 'All Units' ? `_${targetUnit.toLowerCase().replace(/[^a-z0-9]/g, '')}` : '';
  const periodId = `pp_${orgId}_${year}_${month}${safeUnitSlug}`;
  const now = new Date().toISOString();

  // Check for duplicate
  const existingSnap = await getDoc(doc(db, 'payroll_periods', periodId));
  if (existingSnap.exists()) {
    const label = targetUnit !== 'All Units' ? ` for ${targetUnit}` : '';
    throw new Error(`A payroll period for ${MONTHS[month - 1]} ${year}${label} already exists.`);
  }

  const period: PayrollPeriod = {
    id: periodId,
    month,
    year,
    organization_id: orgId,
    unit: targetUnit,
    hospital_unit: targetUnit,
    status: 'open',
    processed_at: null,
    created_at: now,
  };

  await setDoc(doc(db, 'payroll_periods', periodId), period);

  // Fetch active employees (filtered by unit if specific unit selected)
  const empFilter: any = { organization_id: orgId, employment_status: 'active' };
  if (targetUnit !== 'All Units') {
    empFilter.hospital_unit = targetUnit;
  }
  const employees = await getEmployees(empFilter);

  if (!employees || employees.length === 0) {
    await deleteDoc(doc(db, 'payroll_periods', periodId));
    const unitMsg = targetUnit !== 'All Units' ? ` for ${targetUnit}` : '';
    throw new Error(`No active employees were found${unitMsg}. Please verify employee profiles and try again.`);
  }

  // Generate entries
  for (const emp of employees) {
    const breakdown = await calculateStatutoryForEmployee(emp, month, year);
    const entryId = `payroll_${emp.id}_${year}_${month}${safeUnitSlug}`;
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
      pl_days: breakdown.pl_days,
      cl_days: breakdown.cl_days,
      sl_days: breakdown.sl_days,
      lwp_days: breakdown.lwp_days,
      basic: breakdown.basic,
      hra: breakdown.hra,
      conveyance: breakdown.conveyance,
      washing: breakdown.washing,
      special_allowance: breakdown.special_allowance,
      pt_tds: breakdown.pt_tds,
      esi: breakdown.esi,
      pf: breakdown.pf,
      tds: breakdown.tds,
      ot_ded: breakdown.ot_ded,
      gross_deductions: breakdown.gross_deductions,
      total_deductions: breakdown.gross_deductions,
      total_salary: breakdown.total_salary,
      ot_hours_or_days: breakdown.ot_hours_or_days,
      ot_hours: breakdown.ot_hours,
      ot_amount: breakdown.ot_amount,
      other_allowances: breakdown.other_allowances,
      is_pf_eligible: breakdown.is_pf_eligible,
      is_overtime_eligible: breakdown.is_overtime_eligible,
      hospital_unit: emp.hospital_unit || breakdown.hospital_unit || 'Main Branch',
      employment_type: emp.employment_type || (breakdown.is_pf_eligible ? 'Regular' : 'Contractual'),
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
      const breakdown = await calculateStatutoryForEmployee(
        emp,
        period.month,
        period.year,
        entry.lop_days,
        entry.ot_hours_or_days,
        {
          tds: entry.tds ?? (entry.deductions?.['TDS'] || entry.deductions?.['tax'] || 0),
          other_allowances: entry.other_allowances ?? (entry.allowances?.['Other Allowances'] || 0),
          other_deductions: entry.ot_ded ?? (entry.deductions?.['Miscellaneous Deductions'] || 0),
          offer_salary: entry.salary_details,
          present_days: entry.present_days,
          off_days: entry.off_days,
          pl_days: entry.pl_days,
          sl_days: entry.sl_days,
          cl_days: entry.cl_days,
          holiday_days: entry.holiday_days,
          paid_days: entry.paid_days,
          ot_hours: entry.ot_hours,
        }
      );
      await updateDoc(doc(db, 'payroll', d.id), {
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
        pl_days: breakdown.pl_days,
        cl_days: breakdown.cl_days,
        sl_days: breakdown.sl_days,
        lwp_days: breakdown.lwp_days,
        basic: breakdown.basic,
        hra: breakdown.hra,
        conveyance: breakdown.conveyance,
        washing: breakdown.washing,
        special_allowance: breakdown.special_allowance,
        pt_tds: breakdown.pt_tds,
        esi: breakdown.esi,
        pf: breakdown.pf,
        tds: breakdown.tds,
        ot_ded: breakdown.ot_ded,
        gross_deductions: breakdown.gross_deductions,
        total_deductions: breakdown.gross_deductions,
        total_salary: breakdown.total_salary,
        ot_hours_or_days: breakdown.ot_hours_or_days,
        ot_hours: breakdown.ot_hours,
        ot_amount: breakdown.ot_amount,
        other_allowances: breakdown.other_allowances,
        is_pf_eligible: breakdown.is_pf_eligible,
        is_overtime_eligible: breakdown.is_overtime_eligible,
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
      const linkedEmp = entry.employee_id ? empMap.get(entry.employee_id) : undefined;
      entry.employee = linkedEmp;
      if (!entry.hospital_unit && linkedEmp?.hospital_unit) {
        entry.hospital_unit = linkedEmp.hospital_unit;
      }
      if (!entry.employment_type && linkedEmp?.employment_type) {
        entry.employment_type = linkedEmp.employment_type;
      }
      if (entry.total_deductions === undefined) {
        entry.total_deductions = entry.gross_deductions ?? Object.values(entry.deductions || {}).reduce((a, b) => a + b, 0);
      }
      if (entry.total_salary === undefined) {
        entry.total_salary = Math.max(0, (entry.gross_salary || 0) - (entry.total_deductions || 0));
      }
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
