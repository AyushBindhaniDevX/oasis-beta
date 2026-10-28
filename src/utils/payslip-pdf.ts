import { exportOrPrintPdf } from './pdf';
import { Platform } from 'react-native';
import { formatCurrency, formatDate } from '@/utils/format';
import { MONTHS } from '@/constants/config';
import type { Payslip, Employee, Organization } from '@/types';

function numberToWords(num: number): string {
  const a = [
    '', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ',
    'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return '';
  let str = '';
  str += (Number(n[1]) != 0) ? (a[Number(n[1])] || b[Number(n[1][0])] + ' ' + a[Number(n[1][1])]) + 'Crore ' : '';
  str += (Number(n[2]) != 0) ? (a[Number(n[2])] || b[Number(n[2][0])] + ' ' + a[Number(n[2][1])]) + 'Lakh ' : '';
  str += (Number(n[3]) != 0) ? (a[Number(n[3])] || b[Number(n[3][0])] + ' ' + a[Number(n[3][1])]) + 'Thousand ' : '';
  str += (Number(n[4]) != 0) ? (a[Number(n[4])] || b[Number(n[4][0])] + ' ' + a[Number(n[4][1])]) + 'Hundred ' : '';
  str += (Number(n[5]) != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[Number(n[5][0])] + ' ' + a[Number(n[5][1])]) + 'Only' : 'Only';
  return 'Rupees ' + str;
}

export function generatePayslipHtml(payslip: Payslip, employee?: Employee | null, organization?: Organization | null): string {
  const p = payslip.payroll;
  const monthName = (MONTHS[payslip.period_month - 1] || 'Current Month').toUpperCase();
  const year = payslip.period_year;
  const orgName = (organization?.name || (p as any)?.hospital_unit || 'COMPANY NAME').toUpperCase();

  const empName = (employee?.profile?.full_name || payslip.employee?.profile?.full_name || (p?.employee as any)?.profile?.full_name || 'Staff Member').toUpperCase();
  const empCode = employee?.employee_code || payslip.employee?.employee_code || (p?.employee as any)?.employee_code || payslip.payslip_number || 'EMP001';
  const empType = ((p as any)?.employment_type || employee?.employment_type || ((p as any)?.is_pf_eligible ? 'CONFIRMED' : 'CONTRACTUAL')).toUpperCase();

  // Date formatting (DD/MM/YYYY)
  let slipDate = '05/10/2026';
  try {
    const rawDate = payslip.created_at || (p as any)?.created_at || new Date().toISOString();
    const d = new Date(rawDate);
    if (!isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      slipDate = `${dd}/${mm}/${yyyy}`;
    }
  } catch {}

  // Attendance Metrics
  const payableDays = (p as any)?.payable_days ?? 30;
  const holidayDays = (p as any)?.holiday_days ?? 0;
  const clDays = (p as any)?.cl_days ?? 0;
  const slDays = (p as any)?.sl_days ?? 0;
  const plDays = (p as any)?.pl_days ?? 0;
  const offDays = (p as any)?.off_days ?? 4;
  const lwpDays = (p as any)?.lwp_days ?? (p as any)?.lop_days ?? Math.max(0, payableDays - ((p as any)?.paid_days ?? payableDays));
  const paidDays = (p as any)?.paid_days ?? Math.max(0, payableDays - lwpDays);
  const offerSalary = Math.round((p as any)?.salary_details ?? employee?.basic_salary ?? p?.basic_salary ?? 37400);

  // Earnings Breakdown
  const basic = Math.round((p as any)?.basic ?? p?.basic_salary ?? Math.round(offerSalary * 0.5));
  const hra = (p as any)?.hra ?? Math.round(offerSalary * 0.2);
  const conveyance = (p as any)?.conveyance ?? p?.allowances?.['Conveyance Allowance'] ?? 2000;
  const washing = (p as any)?.washing ?? p?.allowances?.['Washing Allowance'] ?? 1000;
  const specialAllowance = (p as any)?.special_allowance ?? p?.allowances?.['Special Allowance'] ?? 0;
  const grossSalary = (p as any)?.gross_salary ?? p?.gross_salary ?? (basic + hra + conveyance + washing + specialAllowance);

  // Deductions Breakdown
  const pf = (p as any)?.pf ?? p?.deductions?.['PF'] ?? p?.deductions?.['EPF'] ?? 0;
  const pt = (p as any)?.deductions?.['Professional Tax'] ?? 0;
  const esi = (p as any)?.esi ?? p?.deductions?.['ESIC'] ?? 0;
  const tds = (p as any)?.tds ?? p?.deductions?.['TDS'] ?? 0;
  const lateComing = (p as any)?.late_coming ?? 0;
  const otherDed = (p as any)?.ot_ded ?? p?.deductions?.['Miscellaneous Deductions'] ?? 0;
  const totalDeductions = (p as any)?.total_deductions ?? (p as any)?.gross_deductions ?? (pf + pt + esi + tds + lateComing + otherDed);

  // Summary / Bottom Row
  const totalSalary = (p as any)?.total_salary ?? Math.max(0, grossSalary - totalDeductions);
  const otAmount = (p as any)?.ot_amount ?? p?.allowances?.['Overtime Pay'] ?? 0;
  const otherAllowances = (p as any)?.other_allowances ?? p?.allowances?.['Other Allowances'] ?? 0;
  const netSalary = (p as any)?.net_salary ?? Math.max(0, totalSalary + otAmount + otherAllowances);

  const fmtCurrency = (n: number) => {
    return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Salary Slip - ${monthName} ${year} - ${empName} (${empCode})</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm;
    }
    body {
      font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
      margin: 0;
      padding: 12px;
      color: #000000;
      background: #FFFFFF;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .slip-container {
      border: 1.5px solid #000000;
      padding: 16px 20px;
      max-width: 900px;
      margin: 0 auto;
      background: #FFFFFF;
      box-sizing: border-box;
    }
    .slip-header {
      text-align: center;
      padding-bottom: 8px;
      border-bottom: 1.5px solid #000000;
      margin-bottom: 12px;
    }
    .hospital-title {
      font-size: 18px;
      font-weight: bold;
      letter-spacing: 0.5px;
      margin: 0 0 4px 0;
      text-transform: uppercase;
    }
    .payslip-period {
      font-size: 13px;
      font-weight: bold;
      letter-spacing: 0.3px;
      margin: 0;
      text-transform: uppercase;
    }
    .meta-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      margin-bottom: 14px;
    }
    .meta-table td {
      padding: 3px 2px;
      vertical-align: middle;
      white-space: nowrap;
    }
    .meta-lbl {
      width: 115px;
      font-weight: 500;
    }
    .meta-sep {
      width: 12px;
      text-align: center;
      font-weight: 500;
    }
    .meta-val {
      font-weight: 600;
      padding-right: 14px;
    }
    .grid-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      margin-bottom: -1px;
      table-layout: fixed;
    }
    .grid-table th, .grid-table td {
      border: 1px solid #000000;
      padding: 6px 8px;
      text-align: center;
      vertical-align: middle;
      box-sizing: border-box;
    }
    .grid-table th {
      font-weight: bold;
      background: #FFFFFF;
    }
    .side-cell {
      font-weight: bold;
      letter-spacing: 0.5px;
      width: 120px;
      background: #FFFFFF;
      text-align: center;
    }
    .val-cell {
      font-weight: 500;
      text-align: center;
    }
    .val-cell-bold {
      font-weight: bold;
      text-align: center;
    }
    .footer-section {
      width: 100%;
      border-collapse: collapse;
      margin-top: 14px;
      font-size: 11px;
    }
    .footer-section td {
      vertical-align: top;
      padding: 0;
    }
    .disclaimer {
      font-size: 10.5px;
      font-style: italic;
      color: #111111;
      padding-top: 8px;
      max-width: 55%;
    }
    .summary-box {
      border-collapse: collapse;
      margin-left: auto;
      font-size: 11.5px;
    }
    .summary-box td {
      padding: 2.5px 3px;
      white-space: nowrap;
    }
    .sum-lbl {
      width: 120px;
      font-weight: 500;
    }
    .sum-sep {
      width: 14px;
      text-align: center;
    }
    .sum-val {
      text-align: right;
      font-weight: 600;
      min-width: 70px;
    }
    .sum-val-bold {
      font-weight: bold;
    }
    @media print {
      body { padding: 0; }
      .slip-container { border: 1.5px solid #000000; margin: 0; max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="slip-container">
    <!-- Header -->
    <div class="slip-header">
      <div class="hospital-title">${orgName}</div>
      <div class="payslip-period">PAYSLIP ${monthName} ${year}</div>
    </div>

    <!-- Employee & Attendance Info Grid -->
    <table class="meta-table">
      <tr>
        <td class="meta-lbl">Employee Name</td>
        <td class="meta-sep">:</td>
        <td class="meta-val" style="width: 28%;">${empName}</td>

        <td class="meta-lbl">Payable Days</td>
        <td class="meta-sep">:</td>
        <td class="meta-val">${payableDays.toFixed(2)}</td>

        <td class="meta-lbl">Week Off</td>
        <td class="meta-sep">:</td>
        <td class="meta-val">${offDays.toFixed(2)}</td>
      </tr>
      <tr>
        <td class="meta-lbl">Employee Code</td>
        <td class="meta-sep">:</td>
        <td class="meta-val">${empCode}</td>

        <td class="meta-lbl">Paid Holiday</td>
        <td class="meta-sep">:</td>
        <td class="meta-val">${holidayDays.toFixed(2)}</td>

        <td class="meta-lbl">PL</td>
        <td class="meta-sep">:</td>
        <td class="meta-val">${plDays.toFixed(2)}</td>
      </tr>
      <tr>
        <td class="meta-lbl">Date</td>
        <td class="meta-sep">:</td>
        <td class="meta-val">${slipDate}</td>

        <td class="meta-lbl">CL</td>
        <td class="meta-sep">:</td>
        <td class="meta-val">${clDays.toFixed(2)} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; SL : ${slDays.toFixed(2)}</td>

        <td class="meta-lbl">LWP</td>
        <td class="meta-sep">:</td>
        <td class="meta-val">${lwpDays.toFixed(2)}</td>
      </tr>
      <tr>
        <td class="meta-lbl">Employee Type</td>
        <td class="meta-sep">:</td>
        <td class="meta-val">${empType}</td>

        <td class="meta-lbl">Offer Salary</td>
        <td class="meta-sep">:</td>
        <td class="meta-val">${offerSalary}</td>

        <td class="meta-lbl">Paid Days</td>
        <td class="meta-sep">:</td>
        <td class="meta-val">${paidDays}</td>
      </tr>
    </table>

    <!-- Earnings Grid -->
    <table class="grid-table">
      <tr>
        <td class="side-cell" rowspan="2">EARNINGS</td>
        <th>Basic</th>
        <th>HRA</th>
        <th>Conv Allow</th>
        <th>Washing Allow</th>
        <th>Special Allow</th>
        <th></th>
        <th>Total Earning</th>
      </tr>
      <tr>
        <td class="val-cell">${basic}</td>
        <td class="val-cell">${fmtCurrency(hra)}</td>
        <td class="val-cell">${fmtCurrency(conveyance)}</td>
        <td class="val-cell">${fmtCurrency(washing)}</td>
        <td class="val-cell">${fmtCurrency(specialAllowance)}</td>
        <td class="val-cell"></td>
        <td class="val-cell-bold">${fmtCurrency(grossSalary)}</td>
      </tr>
    </table>

    <!-- Deductions Grid -->
    <table class="grid-table" style="border-top: none;">
      <tr>
        <td class="side-cell" rowspan="2">DEDUCTION</td>
        <th>Provident Fund</th>
        <th>ProfessionlTax</th>
        <th>ESIC</th>
        <th>TDS</th>
        <th>Late Coming</th>
        <th>Other Deduction</th>
        <th>Total Deduction</th>
      </tr>
      <tr>
        <td class="val-cell">${fmtCurrency(pf)}</td>
        <td class="val-cell">${fmtCurrency(pt)}</td>
        <td class="val-cell">${fmtCurrency(esi)}</td>
        <td class="val-cell">${fmtCurrency(tds)}</td>
        <td class="val-cell">${lateComing > 0 ? fmtCurrency(lateComing) : ''}</td>
        <td class="val-cell">${fmtCurrency(otherDed)}</td>
        <td class="val-cell-bold">${fmtCurrency(totalDeductions)}</td>
      </tr>
    </table>

    <!-- Bottom Summary & Disclaimer -->
    <table class="footer-section">
      <tr>
        <td class="disclaimer">
          This is a computer generated document and does not require signature.
        </td>
        <td>
          <table class="summary-box">
            <tr>
              <td class="sum-lbl">Total Salary</td>
              <td class="sum-sep">:</td>
              <td class="sum-val">${Math.round(totalSalary)}</td>
            </tr>
            <tr>
              <td class="sum-lbl">Overtime</td>
              <td class="sum-sep">:</td>
              <td class="sum-val">${fmtCurrency(otAmount)}</td>
            </tr>
            <tr>
              <td class="sum-lbl">Other Allowance</td>
              <td class="sum-sep">:</td>
              <td class="sum-val">${fmtCurrency(otherAllowances)}</td>
            </tr>
            <tr>
              <td class="sum-lbl sum-val-bold">Net Pay</td>
              <td class="sum-sep sum-val-bold">:</td>
              <td class="sum-val sum-val-bold">${Math.round(netSalary)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
`;
}

export async function exportPayslipPdf(payslip: Payslip, employee?: Employee | null, organization?: Organization | null): Promise<string | null> {
  const html = generatePayslipHtml(payslip, employee, organization);
  const empCode = employee?.employee_code || payslip.employee?.employee_code || payslip.payslip_number || 'EMP';
  const fileName = `Salary_Slip_${empCode}_${payslip.period_month}_${payslip.period_year}.pdf`;
  return await exportOrPrintPdf(html, fileName);
}

export const downloadOrPrintPayslip = exportPayslipPdf;
