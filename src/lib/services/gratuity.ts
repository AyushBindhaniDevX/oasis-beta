/**
 * Gratuity Calculation Engine
 * Compliance with Payment of Gratuity Act, 1972 (India)
 * Shanti Memorial Hospital & Chikitsa Unit
 */

import { formatCurrency, formatDate } from '@/utils/format';
import { exportOrPrintPdf } from '@/utils/pdf';
import type { Employee } from '@/types';

export interface GratuityCalculationResult {
  employee_id: string;
  employee_code: string;
  employee_name: string;
  joining_date: string;
  separation_date: string;
  total_days_service: number;
  completed_years: number;
  fraction_months: number;
  rounded_qualifying_years: number;
  last_drawn_basic: number;
  is_eligible: boolean;
  ineligibility_reason?: string;
  gratuity_amount: number;
  formula_applied: string;
  statutory_maximum_limit: number;
  exceeds_statutory_limit: boolean;
  final_payable_gratuity: number;
}

export const STATUTORY_GRATUITY_CAP = 2000000; // INR 20 Lakhs max statutory limit

export function calculateEmployeeGratuity(
  employee: Employee,
  separationDateStr: string = new Date().toISOString().split('T')[0],
  options?: {
    isDeathOrDisability?: boolean;
    customLastBasic?: number;
  }
): GratuityCalculationResult {
  const joiningDateStr = employee.joining_date || new Date().toISOString().split('T')[0];
  const joinDate = new Date(joiningDateStr);
  const sepDate = new Date(separationDateStr);

  const diffTime = Math.max(0, sepDate.getTime() - joinDate.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  // Compute years and remainder months
  const totalMonths = (sepDate.getFullYear() - joinDate.getFullYear()) * 12 + (sepDate.getMonth() - joinDate.getMonth());
  const completedYears = Math.floor(totalMonths / 12);
  const fractionMonths = Math.max(0, totalMonths % 12);

  // Partial Year Rounding: If remaining service > 6 months, round up to 1 full year
  let qualifyingYears = completedYears;
  if (fractionMonths > 6) {
    qualifyingYears += 1;
  }

  // Statutory Eligibility: Minimum 5 years of continuous service (exempt in case of death or disability)
  const isEligible = options?.isDeathOrDisability || completedYears >= 5;
  let ineligibilityReason: string | undefined;
  if (!isEligible) {
    ineligibilityReason = `Continuous service is ${completedYears} year(s) and ${fractionMonths} month(s). Minimum 5 years required under Payment of Gratuity Act, 1972.`;
  }

  // Last Drawn Basic Salary
  const lastBasic = options?.customLastBasic && options.customLastBasic > 0
    ? options.customLastBasic
    : employee.basic_salary
    ? Math.round(employee.basic_salary * 0.5)
    : 15000;

  // Statutory Formula: (15 * Last Drawn Basic * Qualifying Years) / 26
  let gratuityAmount = 0;
  if (isEligible && qualifyingYears > 0) {
    gratuityAmount = Math.round((15 * lastBasic * qualifyingYears) / 26);
  }

  const exceedsLimit = gratuityAmount > STATUTORY_GRATUITY_CAP;
  const finalPayable = Math.min(gratuityAmount, STATUTORY_GRATUITY_CAP);

  return {
    employee_id: employee.id,
    employee_code: employee.employee_code || 'SMH-000',
    employee_name: employee.profile?.full_name || 'Staff Member',
    joining_date: joiningDateStr,
    separation_date: separationDateStr,
    total_days_service: diffDays,
    completed_years: completedYears,
    fraction_months: fractionMonths,
    rounded_qualifying_years: qualifyingYears,
    last_drawn_basic: lastBasic,
    is_eligible: isEligible,
    ineligibility_reason: ineligibilityReason,
    gratuity_amount: gratuityAmount,
    formula_applied: `(15 × ₹${lastBasic.toLocaleString()} × ${qualifyingYears} years) ÷ 26`,
    statutory_maximum_limit: STATUTORY_GRATUITY_CAP,
    exceeds_statutory_limit: exceedsLimit,
    final_payable_gratuity: finalPayable,
  };
}

export function generateGratuityStatementHtml(result: GratuityCalculationResult, unitName = 'Shanti Memorial Hospital & Chikitsa Unit'): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Gratuity Settlement Statement - ${result.employee_name} (${result.employee_code})</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { font-family: 'Plus Jakarta Sans', sans-serif; padding: 36px; color: #0F172A; background: #FFF; }
    .card { max-width: 800px; margin: 0 auto; border: 1.5px solid #0D7377; border-radius: 12px; padding: 36px; }
    .header { border-bottom: 2px solid #0D7377; padding-bottom: 16px; margin-bottom: 24px; }
    .title { font-size: 20px; font-weight: 800; color: #0D7377; text-transform: uppercase; }
    .subtitle { font-size: 13px; color: #D97706; font-weight: 700; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 24px; background: #F8FAFC; padding: 16px; border-radius: 8px; border: 1px solid #E2E8F0; }
    .meta-item label { display: block; font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; }
    .meta-item span { font-size: 14px; font-weight: 700; color: #0F172A; }
    .calc-box { background: #F0FDFA; border: 1px solid #99F6E4; border-radius: 8px; padding: 20px; margin-bottom: 24px; }
    .banner { background: #0D7377; color: #FFF; padding: 18px 24px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; }
    .signatures { display: flex; justify-content: space-between; margin-top: 48px; padding-top: 24px; border-top: 1px dashed #CBD5E1; }
    .sig-line { width: 220px; border-top: 1px solid #334155; padding-top: 6px; text-align: center; font-size: 12px; font-weight: 700; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="title">${unitName}</div>
      <div class="subtitle">STATUTORY GRATUITY SETTLEMENT STATEMENT (ACT OF 1972)</div>
    </div>

    <div class="meta-grid">
      <div class="meta-item"><label>Employee Name</label><span>${result.employee_name}</span></div>
      <div class="meta-item"><label>Employee Code</label><span>${result.employee_code}</span></div>
      <div class="meta-item"><label>Date of Joining</label><span>${formatDate(result.joining_date)}</span></div>
      <div class="meta-item"><label>Date of Separation</label><span>${formatDate(result.separation_date)}</span></div>
      <div class="meta-item"><label>Service Length</label><span>${result.completed_years} Yrs, ${result.fraction_months} Mos (${result.total_days_service} days)</span></div>
      <div class="meta-item"><label>Rounded Qualifying Service</label><span>${result.rounded_qualifying_years} Full Years</span></div>
      <div class="meta-item"><label>Last Drawn Basic Salary</label><span>${formatCurrency(result.last_drawn_basic)} / month</span></div>
      <div class="meta-item"><label>Statutory Eligibility</label><span>${result.is_eligible ? 'ELIGIBLE (>= 5 Years)' : 'NOT ELIGIBLE'}</span></div>
    </div>

    <div class="calc-box">
      <div style="font-size: 12px; font-weight: 700; color: #0F766E; text-transform: uppercase; margin-bottom: 6px;">Statutory Formula</div>
      <div style="font-size: 15px; font-weight: 800; color: #0D7377; margin-bottom: 8px;">Gratuity = (15 × Last Drawn Basic × Qualifying Years) ÷ 26</div>
      <div style="font-size: 13px; color: #334155;">Applied: <strong>${result.formula_applied}</strong></div>
      ${result.ineligibility_reason ? `<div style="color: #BA1A1A; font-size: 12px; margin-top: 6px;">Reason: ${result.ineligibility_reason}</div>` : ''}
    </div>

    <div class="banner">
      <div>
        <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Final Payable Gratuity Amount</div>
        <div style="font-size: 11px; opacity: 0.85;">Statutory Cap: ${formatCurrency(result.statutory_maximum_limit)}</div>
      </div>
      <div style="font-size: 26px; font-weight: 800;">${formatCurrency(result.final_payable_gratuity)}</div>
    </div>

    <div class="signatures">
      <div class="sig-line">Employee Signature<br><span style="font-size: 10px; color: #64748B;">Acknowledged Receipt</span></div>
      <div class="sig-line">Accounts & Finance Officer<br><span style="font-size: 10px; color: #64748B;">Shanti Memorial Hospital</span></div>
    </div>
  </div>
</body>
</html>
`;
}

export async function exportGratuityStatementPdf(result: GratuityCalculationResult, unitName = 'Shanti Memorial Hospital & Chikitsa Unit'): Promise<string | null> {
  const html = generateGratuityStatementHtml(result, unitName);
  const fileName = `Gratuity_Statement_${result.employee_code}.pdf`;
  return await exportOrPrintPdf(html, fileName);
}
