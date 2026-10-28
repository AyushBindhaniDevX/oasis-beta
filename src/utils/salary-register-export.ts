import { exportOrPrintPdf } from './pdf';
import { exportExcel } from './excel';
import { MONTHS, normalizeHospitalUnit, normalizeEmploymentType } from '@/constants/config';
import type { Payroll, PayrollPeriod, Organization } from '@/types';

export interface SalaryRegisterExportOptions {
  period: PayrollPeriod;
  entries: Payroll[];
  unitName?: string;
  employmentType?: 'All' | 'Regular' | 'Contractual';
  organization?: Organization | null;
}

export interface FormattedRegisterRow {
  sno: number;
  name: string;
  empCode: string;
  dept: string;
  grade: string;
  offerSalary: number;
  presentDay: number;
  offDay: number;
  pl: number;
  cl: number;
  sl: number;
  holiday: number;
  paidDays: number;
  grossSalary: number;
  basicSalary: number;
  hra: number;
  convAll: number;
  washAll: number;
  specialAll: number;
  epf: number;
  esic: number;
  tds: number;
  otherDed: number;
  grossDed: number;
  totalSalary: number;
  overTime: number;
  otherAllow: number;
  netSalary: number;
  unit: string;
  category: 'Regular' | 'Contractual';
}

export function prepareRegisterRows(entries: Payroll[]): FormattedRegisterRow[] {
  return entries.map((entry, idx) => {
    const emp = entry.employee as any;
    const name = (emp?.profile?.full_name || 'Staff Member').toUpperCase();
    const empCode = emp?.employee_code || emp?.id || `EMP-${idx + 1}`;
    const dept = (emp?.department?.name || emp?.designation || 'General').toUpperCase();
    const grade = (emp?.grade || emp?.designation || 'M1').toUpperCase();

    const offerSalary = Math.round(entry.salary_details ?? entry.basic_salary ?? 25000);
    const presentDay = entry.present_days ?? 26;
    const offDay = entry.off_days ?? 4;
    const pl = entry.pl_days ?? 0;
    const cl = entry.cl_days ?? 0;
    const sl = entry.sl_days ?? 0;
    const holiday = entry.holiday_days ?? 0;
    const paidDays = entry.paid_days ?? (presentDay + offDay + pl + cl + sl + holiday);

    const grossSalary = Math.round(entry.gross_salary ?? 0);
    const basicSalary = Math.round(entry.basic ?? (entry.basic_salary || Math.round(grossSalary * 0.5)));
    const hra = Math.round(entry.hra ?? (entry.allowances?.['HRA'] || entry.allowances?.hra || Math.round(grossSalary * 0.2)));
    const convAll = Math.round(entry.conveyance ?? (entry.allowances?.['Conveyance Allowance'] || 2000));
    const washAll = Math.round(entry.washing ?? (entry.allowances?.['Washing Allowance'] || 1000));
    const specialAll = Math.round(entry.special_allowance ?? (entry.allowances?.['Special Allowance'] || 0));

    const epf = Math.round(entry.pf ?? (entry.deductions?.['EPF'] || entry.deductions?.pf || 0));
    const esic = Math.round(entry.esi ?? (entry.deductions?.['ESIC'] || entry.deductions?.esi || 0));
    const tds = Math.round(entry.tds ?? entry.pt_tds ?? (entry.deductions?.['TDS'] || entry.deductions?.tax || 0));
    const otherDed = Math.round(entry.ot_ded ?? (entry.deductions?.['Miscellaneous Deductions'] || 0));
    const grossDed = Math.round(entry.total_deductions ?? entry.gross_deductions ?? (epf + esic + tds + otherDed));

    const totalSalary = Math.round(entry.total_salary ?? Math.max(0, grossSalary - grossDed));
    const overTime = Math.round(entry.ot_amount ?? (entry.allowances?.['Overtime Pay'] || 0));
    const otherAllow = Math.round(entry.other_allowances ?? (entry.allowances?.['Other Allowances'] || 0));
    const netSalary = Math.round(entry.net_salary ?? (totalSalary + overTime + otherAllow));

    const unit = normalizeHospitalUnit(entry.hospital_unit || emp?.hospital_unit);
    const category = normalizeEmploymentType(entry.employment_type || emp?.employment_type);

    return {
      sno: idx + 1,
      name,
      empCode,
      dept,
      grade,
      offerSalary,
      presentDay,
      offDay,
      pl,
      cl,
      sl,
      holiday,
      paidDays,
      grossSalary,
      basicSalary,
      hra,
      convAll,
      washAll,
      specialAll,
      epf,
      esic,
      tds,
      otherDed,
      grossDed,
      totalSalary,
      overTime,
      otherAllow,
      netSalary,
      unit,
      category,
    };
  });
}

/**
 * Filter rows by Unit and Employment Category
 */
export function filterRegisterRows(
  rows: FormattedRegisterRow[],
  targetUnit?: string,
  category?: 'All' | 'Regular' | 'Contractual'
): FormattedRegisterRow[] {
  let filtered = rows;
  if (targetUnit && targetUnit !== 'All' && targetUnit !== 'All Units') {
    const tLower = targetUnit.toLowerCase().trim();
    filtered = filtered.filter((r) => r.unit.toLowerCase().includes(tLower) || tLower.includes(r.unit.toLowerCase()));
  }
  if (category && category !== 'All') {
    filtered = filtered.filter((r) => r.category === category);
  }
  return filtered.map((r, i) => ({ ...r, sno: i + 1 }));
}

/**
 * Generate Printable Landscape HTML matching the exact hospital salary sheet format
 */
export function generateSalaryRegisterHtml(
  rows: FormattedRegisterRow[],
  period: PayrollPeriod,
  unitDisplayName: string,
  categoryLabel: string
): string {
  const monthName = (MONTHS[period.month - 1] || 'Current Month').toUpperCase();
  const year = period.year;

  // Summary Totals
  const totals = rows.reduce(
    (acc, r) => ({
      offerSalary: acc.offerSalary + r.offerSalary,
      presentDay: acc.presentDay + r.presentDay,
      offDay: acc.offDay + r.offDay,
      pl: acc.pl + r.pl,
      cl: acc.cl + r.cl,
      sl: acc.sl + r.sl,
      holiday: acc.holiday + r.holiday,
      paidDays: acc.paidDays + r.paidDays,
      grossSalary: acc.grossSalary + r.grossSalary,
      basicSalary: acc.basicSalary + r.basicSalary,
      hra: acc.hra + r.hra,
      convAll: acc.convAll + r.convAll,
      washAll: acc.washAll + r.washAll,
      specialAll: acc.specialAll + r.specialAll,
      epf: acc.epf + r.epf,
      esic: acc.esic + r.esic,
      tds: acc.tds + r.tds,
      otherDed: acc.otherDed + r.otherDed,
      grossDed: acc.grossDed + r.grossDed,
      totalSalary: acc.totalSalary + r.totalSalary,
      overTime: acc.overTime + r.overTime,
      otherAllow: acc.otherAllow + r.otherAllow,
      netSalary: acc.netSalary + r.netSalary,
    }),
    {
      offerSalary: 0,
      presentDay: 0,
      offDay: 0,
      pl: 0,
      cl: 0,
      sl: 0,
      holiday: 0,
      paidDays: 0,
      grossSalary: 0,
      basicSalary: 0,
      hra: 0,
      convAll: 0,
      washAll: 0,
      specialAll: 0,
      epf: 0,
      esic: 0,
      tds: 0,
      otherDed: 0,
      grossDed: 0,
      totalSalary: 0,
      overTime: 0,
      otherAllow: 0,
      netSalary: 0,
    }
  );

  const rowHtml = rows
    .map(
      (r) => `
    <tr>
      <td class="center">${r.sno}</td>
      <td class="left bold">${r.name}</td>
      <td class="left">${r.empCode}</td>
      <td class="left">${r.dept}</td>
      <td class="center">${r.grade}</td>
      <td class="right">${r.offerSalary}</td>
      <td class="center">${r.presentDay}</td>
      <td class="center">${r.offDay.toFixed(2)}</td>
      <td class="center">${r.pl}</td>
      <td class="center">${r.cl}</td>
      <td class="center">${r.sl}</td>
      <td class="center">${r.holiday}</td>
      <td class="center bold">${r.paidDays}</td>
      <td class="right bold">${r.grossSalary}</td>
      <td class="right">${r.basicSalary}</td>
      <td class="right">${r.hra}</td>
      <td class="right">${r.convAll}</td>
      <td class="right">${r.washAll}</td>
      <td class="right">${r.specialAll}</td>
      <td class="right">${r.epf}</td>
      <td class="right">${r.esic}</td>
      <td class="right">${r.tds}</td>
      <td class="right">${r.otherDed}</td>
      <td class="right bold">${r.grossDed}</td>
      <td class="right bold">${r.totalSalary}</td>
      <td class="right">${r.overTime}</td>
      <td class="right">${r.otherAllow}</td>
      <td class="right bold net-col">${r.netSalary}</td>
    </tr>
  `
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${unitDisplayName} - Salary Register - ${monthName} ${year}</title>
  <style>
    @page {
      size: A3 landscape;
      margin: 8mm 6mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      margin: 0;
      padding: 10px;
      color: #000000;
      background: #FFFFFF;
      font-size: 8.5pt;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .header-box {
      text-align: center;
      margin-bottom: 12px;
      padding-bottom: 6px;
    }
    .unit-title {
      font-size: 16pt;
      font-weight: 800;
      letter-spacing: 0.5px;
      margin: 0 0 2px 0;
      text-transform: uppercase;
    }
    .sub-title-1 {
      font-size: 11pt;
      font-weight: 600;
      margin: 0 0 2px 0;
    }
    .sub-title-2 {
      font-size: 11pt;
      font-weight: 700;
      letter-spacing: 0.3px;
      margin: 0;
    }
    .meta-tag {
      display: inline-block;
      margin-top: 4px;
      font-size: 9pt;
      font-weight: 700;
      background: #f1f5f9;
      padding: 2px 8px;
      border-radius: 4px;
      border: 1px solid #cbd5e1;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 7.8pt;
    }
    th, td {
      border: 1px solid #333333;
      padding: 4px 2px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    th {
      background-color: #f8fafc;
      font-weight: 700;
      text-align: center;
      line-height: 1.1;
      vertical-align: middle;
      font-size: 7.5pt;
    }
    tr:nth-child(even) td {
      background-color: #fafbfc;
    }
    .center { text-align: center; }
    .left { text-align: left; padding-left: 3px; }
    .right { text-align: right; padding-right: 3px; }
    .bold { font-weight: 700; }
    .net-col {
      background-color: #ecfdf5 !important;
      color: #065f46;
      font-weight: 800;
    }
    .total-row td {
      background-color: #f1f5f9 !important;
      font-weight: 800;
      border-top: 2px solid #000;
      border-bottom: 2px solid #000;
    }
    .signature-section {
      display: flex;
      justify-content: space-between;
      margin-top: 36px;
      padding: 0 40px;
      font-size: 10pt;
      font-weight: 700;
    }
    .sig-line {
      border-top: 1.5px solid #000;
      width: 180px;
      text-align: center;
      padding-top: 4px;
    }
  </style>
</head>
<body>
  <div class="header-box">
    <div class="unit-title">${unitDisplayName}</div>
    <div class="sub-title-1">Monthly Salary Report Register</div>
    <div class="sub-title-2">SALARY REGISTER FOR THE MONTH OF : ${monthName}-${year}</div>
    <div class="meta-tag">EMPLOYMENT CATEGORY: ${categoryLabel.toUpperCase()} &nbsp;|&nbsp; TOTAL EMPLOYEES: ${rows.length}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 25px;">Sno</th>
        <th style="width: 110px;">Employee Name</th>
        <th style="width: 65px;">Emp<br/>Code</th>
        <th style="width: 75px;">Dept</th>
        <th style="width: 45px;">Grade</th>
        <th style="width: 50px;">Offer<br/>Salary</th>
        <th style="width: 32px;">Present<br/>Day</th>
        <th style="width: 30px;">Off<br/>Day</th>
        <th style="width: 22px;">PL</th>
        <th style="width: 22px;">CL</th>
        <th style="width: 22px;">SL</th>
        <th style="width: 30px;">Holi<br/>day</th>
        <th style="width: 32px;">Paid<br/>days</th>
        <th style="width: 55px;">Gross<br/>Salary</th>
        <th style="width: 50px;">Basic<br/>Salary</th>
        <th style="width: 45px;">HRA</th>
        <th style="width: 40px;">Conv<br/>All</th>
        <th style="width: 40px;">Wash<br/>All</th>
        <th style="width: 45px;">Special<br/>All</th>
        <th style="width: 45px;">EPF</th>
        <th style="width: 40px;">ESIC</th>
        <th style="width: 35px;">TDS</th>
        <th style="width: 35px;">Other<br/>Ded</th>
        <th style="width: 48px;">Gross<br/>Ded</th>
        <th style="width: 52px;">Total<br/>Salary</th>
        <th style="width: 35px;">Over<br/>Time</th>
        <th style="width: 40px;">Other<br/>Allow</th>
        <th style="width: 55px;">Net<br/>Salary</th>
      </tr>
    </thead>
    <tbody>
      ${rowHtml}
    </tbody>
    <tfoot>
      <tr class="total-row">
        <td class="center" colspan="5">TOTAL / GRAND SUMMARY</td>
        <td class="right">${totals.offerSalary}</td>
        <td class="center">${totals.presentDay}</td>
        <td class="center">${totals.offDay.toFixed(0)}</td>
        <td class="center">${totals.pl}</td>
        <td class="center">${totals.cl}</td>
        <td class="center">${totals.sl}</td>
        <td class="center">${totals.holiday}</td>
        <td class="center">${totals.paidDays}</td>
        <td class="right">${totals.grossSalary}</td>
        <td class="right">${totals.basicSalary}</td>
        <td class="right">${totals.hra}</td>
        <td class="right">${totals.convAll}</td>
        <td class="right">${totals.washAll}</td>
        <td class="right">${totals.specialAll}</td>
        <td class="right">${totals.epf}</td>
        <td class="right">${totals.esic}</td>
        <td class="right">${totals.tds}</td>
        <td class="right">${totals.otherDed}</td>
        <td class="right">${totals.grossDed}</td>
        <td class="right">${totals.totalSalary}</td>
        <td class="right">${totals.overTime}</td>
        <td class="right">${totals.otherAllow}</td>
        <td class="right net-col">${totals.netSalary}</td>
      </tr>
    </tfoot>
  </table>

  <div class="signature-section">
    <div class="sig-line">Prepared By (HR Executive)</div>
    <div class="sig-line">Checked By (Accounts Dept)</div>
    <div class="sig-line">Approved By (Medical Superintendent / Director)</div>
  </div>
</body>
</html>
  `;
}

/**
 * Export PDF for Salary Register
 */
export async function exportSalaryRegisterPdf(opts: SalaryRegisterExportOptions): Promise<boolean> {
  const allRows = prepareRegisterRows(opts.entries);
  const targetUnit = opts.unitName || 'All Units';
  const category = opts.employmentType || 'All';
  const filteredRows = filterRegisterRows(allRows, targetUnit, category);

  const monthName = MONTHS[opts.period.month - 1] || 'Current';
  const unitTitle = targetUnit === 'All Units' ? (opts.organization?.name || 'Company Register') : targetUnit;
  const docTitle = `${unitTitle} - Salary Register - ${monthName} ${opts.period.year}`;

  const html = generateSalaryRegisterHtml(filteredRows, opts.period, unitTitle, category);
  const result = await exportOrPrintPdf(html, docTitle);
  return !!result;
}

/**
 * Export Multi-Sheet Excel Workbook
 * Separate sheet per unit and categorized as Regular and Contractual
 */
export async function exportSalaryRegisterExcel(opts: SalaryRegisterExportOptions): Promise<boolean> {
  const allRows = prepareRegisterRows(opts.entries);
  const monthName = MONTHS[opts.period.month - 1] || 'Current';
  const year = opts.period.year;

  const headers = [
    'Sno',
    'Employee Name',
    'Emp Code',
    'Dept',
    'Grade',
    'Offer Salary',
    'Present Day',
    'Off Day',
    'PL',
    'CL',
    'SL',
    'Holi day',
    'Paid days',
    'Gross Salary',
    'Basic Salary',
    'HRA',
    'Conv All',
    'Wash All',
    'Special All',
    'EPF',
    'ESIC',
    'TDS',
    'Other Ded',
    'Gross Ded',
    'Total Salary',
    'Over Time',
    'Other Allow',
    'Net Salary',
    'Unit',
    'Employment Type',
  ];

  const buildSheetRows = (rows: FormattedRegisterRow[]) => {
    const dataRows = rows.map((r) => [
      r.sno,
      r.name,
      r.empCode,
      r.dept,
      r.grade,
      r.offerSalary,
      r.presentDay,
      r.offDay,
      r.pl,
      r.cl,
      r.sl,
      r.holiday,
      r.paidDays,
      r.grossSalary,
      r.basicSalary,
      r.hra,
      r.convAll,
      r.washAll,
      r.specialAll,
      r.epf,
      r.esic,
      r.tds,
      r.otherDed,
      r.grossDed,
      r.totalSalary,
      r.overTime,
      r.otherAllow,
      r.netSalary,
      r.unit,
      r.category,
    ]);

    // Add total row
    const totals = rows.reduce(
      (sum, r) => {
        sum.offerSalary += r.offerSalary;
        sum.presentDay += r.presentDay;
        sum.offDay += r.offDay;
        sum.pl += r.pl;
        sum.cl += r.cl;
        sum.sl += r.sl;
        sum.holiday += r.holiday;
        sum.paidDays += r.paidDays;
        sum.grossSalary += r.grossSalary;
        sum.basicSalary += r.basicSalary;
        sum.hra += r.hra;
        sum.convAll += r.convAll;
        sum.washAll += r.washAll;
        sum.specialAll += r.specialAll;
        sum.epf += r.epf;
        sum.esic += r.esic;
        sum.tds += r.tds;
        sum.otherDed += r.otherDed;
        sum.grossDed += r.grossDed;
        sum.totalSalary += r.totalSalary;
        sum.overTime += r.overTime;
        sum.otherAllow += r.otherAllow;
        sum.netSalary += r.netSalary;
        return sum;
      },
      {
        offerSalary: 0,
        presentDay: 0,
        offDay: 0,
        pl: 0,
        cl: 0,
        sl: 0,
        holiday: 0,
        paidDays: 0,
        grossSalary: 0,
        basicSalary: 0,
        hra: 0,
        convAll: 0,
        washAll: 0,
        specialAll: 0,
        epf: 0,
        esic: 0,
        tds: 0,
        otherDed: 0,
        grossDed: 0,
        totalSalary: 0,
        overTime: 0,
        otherAllow: 0,
        netSalary: 0,
      }
    );

    const totalRow = [
      'TOTAL',
      'GRAND SUMMARY',
      '',
      '',
      '',
      totals.offerSalary,
      totals.presentDay,
      totals.offDay,
      totals.pl,
      totals.cl,
      totals.sl,
      totals.holiday,
      totals.paidDays,
      totals.grossSalary,
      totals.basicSalary,
      totals.hra,
      totals.convAll,
      totals.washAll,
      totals.specialAll,
      totals.epf,
      totals.esic,
      totals.tds,
      totals.otherDed,
      totals.grossDed,
      totals.totalSalary,
      totals.overTime,
      totals.otherAllow,
      totals.netSalary,
      '',
      '',
    ];

    return [...dataRows, totalRow];
  };

  const sheets: { name: string; headers: string[]; rows: any[][] }[] = [];

  // If specific unit or category requested, export just that sheet
  if (opts.unitName && opts.unitName !== 'All Units') {
    const unitFiltered = filterRegisterRows(allRows, opts.unitName, opts.employmentType);
    const sheetName = `${opts.unitName.slice(0, 20)}_${opts.employmentType || 'All'}`;
    sheets.push({
      name: sheetName.replace(/[:\\/?*[\]]/g, ''),
      headers,
      rows: buildSheetRows(unitFiltered),
    });
  } else {
    // Generate Master Sheet + Unit Sheets categorized by Regular & Contractual
    sheets.push({
      name: 'Master Salary Register',
      headers,
      rows: buildSheetRows(allRows),
    });

    // Dynamically derive all company units present in the salary register entries
    const presentUnits = Array.from(new Set(allRows.map((r) => r.unit).filter(Boolean)));
    const units = presentUnits.length > 0 ? presentUnits : ['Main Branch'];

    for (const unit of units) {
      const regRows = filterRegisterRows(allRows, unit, 'Regular');
      if (regRows.length > 0) {
        const shortName = unit.length > 15 ? unit.slice(0, 15) : unit;
        sheets.push({
          name: `${shortName} Reg`.slice(0, 31),
          headers,
          rows: buildSheetRows(regRows),
        });
      }

      const contRows = filterRegisterRows(allRows, unit, 'Contractual');
      if (contRows.length > 0) {
        const shortName = unit.length > 15 ? unit.slice(0, 15) : unit;
        sheets.push({
          name: `${shortName} Cont`.slice(0, 31),
          headers,
          rows: buildSheetRows(contRows),
        });
      }
    }
  }

  const filenameBase = `Salary_Register_${opts.unitName ? opts.unitName.replace(/\s+/g, '_') : 'Hospital'}_${monthName}_${year}`;
  return await exportExcel(filenameBase, sheets);
}
