/**
 * Automated PF & ESIC Challan Generation Service
 * Official EPFO ECR & ESIC Portal Return Generator
 * Shanti Memorial Hospital & Chikitsa Unit
 */

import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { exportExcel, exportTxt } from '@/utils/excel';
import type { Payroll, Employee, Profile } from '@/types';

export interface EpfEcrRow {
  uan: string;
  name: string;
  gross_wages: number;
  epf_wages: number;
  eps_wages: number;
  edli_wages: number;
  ee_contribution: number;
  eps_contribution: number;
  er_contribution: number;
  ncp_days: number;
  refund_advance: number;
}

export interface EsicChallanRow {
  ip_number: string;
  ip_name: string;
  paid_days: number;
  monthly_wages: number;
  employee_share: number; // 0.75%
  employer_share: number; // 3.25%
  reason_code: string;
}

export async function generateEpfoEcrTextFile(periodId: string, orgId?: string): Promise<{ success: boolean; totalMembers: number; totalContribution: number }> {
  const [payrollSnap, empsSnap, profsSnap] = await Promise.all([
    getDocs(query(collection(db, 'payroll'), where('payroll_period_id', '==', periodId))),
    getDocs(collection(db, 'employees')),
    getDocs(collection(db, 'profiles')),
  ]);

  const profMap = new Map<string, Profile>();
  profsSnap.forEach((d) => profMap.set(d.id, { id: d.id, ...d.data() } as Profile));

  const empMap = new Map<string, Employee>();
  empsSnap.forEach((d) => {
    const emp = { id: d.id, ...d.data() } as Employee;
    emp.profile = emp.profile_id ? profMap.get(emp.profile_id) : undefined;
    empMap.set(d.id, emp);
  });

  const lines: string[] = [];
  let totalContrib = 0;
  let membersCount = 0;

  payrollSnap.forEach((d) => {
    const p = d.data() as Payroll;
    const emp = empMap.get(p.employee_id);
    if (!emp) return;

    // Filter only PF eligible employees
    const isPf = (p as any).is_pf_eligible ?? (emp.is_pf_eligible !== false);
    if (!isPf) return;

    const uan = (emp as any).tax_config?.uan_number || '101000000000';
    const name = (emp.profile?.full_name || 'STAFF MEMBER').toUpperCase().replace(/[^A-Z ]/g, '');
    const gross = (p as any).gross_salary || 25000;
    const basic = (p as any).basic || Math.round(gross * 0.5);

    // Statutory EPF Wage ceiling is ₹15,000 for standard statutory deduction
    const epfWages = Math.min(15000, basic);
    const epsWages = epfWages;
    const edliWages = epfWages;

    // EE Contribution: 12% of EPF Wages
    const eeContrib = Math.round(epfWages * 0.12);

    // EPS Contribution: 8.33% of EPS Wages, max ₹1,250
    const epsContrib = Math.min(1250, Math.round(epsWages * 0.0833));

    // ER Contribution: Difference (3.67%)
    const erContrib = Math.max(0, eeContrib - epsContrib);

    const ncpDays = p.lop_days || 0;
    const refundAdv = 0;

    // Official EPFO ECR Delimiter is #~#
    const ecrLine = `${uan}#~#${name}#~#${gross}#~#${epfWages}#~#${epsWages}#~#${edliWages}#~#${eeContrib}#~#${epsContrib}#~#${erContrib}#~#${ncpDays}#~#${refundAdv}`;
    lines.push(ecrLine);
    totalContrib += (eeContrib + epsContrib + erContrib);
    membersCount++;
  });

  const fileContent = lines.join('\r\n');
  const filename = `SMH_EPFO_ECR_${periodId.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
  await exportTxt(filename, fileContent);

  return { success: true, totalMembers: membersCount, totalContribution: totalContrib };
}

export async function generateEsicChallanExcel(periodId: string, orgId?: string): Promise<{ success: boolean; totalEmployees: number; totalContribution: number }> {
  const [payrollSnap, empsSnap, profsSnap] = await Promise.all([
    getDocs(query(collection(db, 'payroll'), where('payroll_period_id', '==', periodId))),
    getDocs(collection(db, 'employees')),
    getDocs(collection(db, 'profiles')),
  ]);

  const profMap = new Map<string, Profile>();
  profsSnap.forEach((d) => profMap.set(d.id, { id: d.id, ...d.data() } as Profile));

  const empMap = new Map<string, Employee>();
  empsSnap.forEach((d) => {
    const emp = { id: d.id, ...d.data() } as Employee;
    emp.profile = emp.profile_id ? profMap.get(emp.profile_id) : undefined;
    empMap.set(d.id, emp);
  });

  const rows: any[][] = [];
  let totalContrib = 0;
  let eligibleCount = 0;

  payrollSnap.forEach((d) => {
    const p = d.data() as Payroll;
    const emp = empMap.get(p.employee_id);
    if (!emp) return;

    const salaryDetails = (p as any).salary_details || emp.basic_salary || 25000;
    // Statutory ESIC threshold is Gross <= ₹21,000
    if (salaryDetails > 21000) return;

    const ipNumber = (emp as any).tax_config?.esi_number || '2100000000';
    const ipName = (emp.profile?.full_name || 'Staff Member').toUpperCase();
    const paidDays = (p as any).paid_days || 30;
    const grossWages = (p as any).gross_salary || salaryDetails;

    // Employee Share: 0.75%, Employer Share: 3.25%
    const eeShare = Math.round(grossWages * 0.0075);
    const erShare = Math.round(grossWages * 0.0325);

    rows.push([
      rows.length + 1,
      ipNumber,
      ipName,
      paidDays,
      grossWages,
      eeShare,
      erShare,
      eeShare + erShare,
      paidDays === 0 ? '01 - Leave Without Pay' : ''
    ]);

    totalContrib += (eeShare + erShare);
    eligibleCount++;
  });

  const headers = [
    'Sl. No', 'IP Number (10 Digit)', 'IP Name', 'Paid Days',
    'Total Monthly Wages', 'Employee Share (0.75%)', 'Employer Share (3.25%)',
    'Total ESIC Contribution', 'Zero Working Days Reason Code'
  ];

  await exportExcel(`SMH_ESIC_Monthly_Challan_${periodId.replace(/[^a-zA-Z0-9]/g, '_')}`, [
    { name: 'ESIC Monthly Return', headers, rows }
  ]);

  return { success: true, totalEmployees: eligibleCount, totalContribution: totalContrib };
}
