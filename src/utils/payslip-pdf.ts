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
  const monthName = MONTHS[payslip.period_month - 1] || 'Current Month';
  const year = payslip.period_year;
  const orgName = organization?.name || 'SHANTI MEMORIAL HOSPITAL';
  const hospitalUnit = (p as any)?.hospital_unit || employee?.hospital_unit || 'Chikitsa Unit of Shanti Memorial Hospital';

  const empName = employee?.profile?.full_name || payslip.employee?.profile?.full_name || 'Healthcare Staff';
  const empCode = employee?.employee_code || payslip.employee?.employee_code || payslip.payslip_number || 'SMH-000';
  const designation = employee?.designation || payslip.employee?.designation || 'Staff Member';
  const department = employee?.department?.name || payslip.employee?.department?.name || 'Hospital Operations';
  const doj = employee?.joining_date ? formatDate(employee.joining_date) : 'N/A';
  const bankAcc = employee?.bank_details?.account_number ? `****${employee.bank_details.account_number.slice(-4)}` : 'Bank Transfer';
  const uan = (employee as any)?.tax_config?.uan_number || 'N/A';
  const pfNo = (employee as any)?.tax_config?.pf_number || 'N/A';
  const esiNo = (employee as any)?.tax_config?.esi_number || 'N/A';

  // Attendance Metrics
  const payableDays = (p as any)?.payable_days ?? 30;
  const presentDays = (p as any)?.present_days ?? 26;
  const offDays = (p as any)?.off_days ?? 4;
  const leaveDays = (p as any)?.leave_days ?? 0;
  const holidayDays = (p as any)?.holiday_days ?? 0;
  const paidDays = (p as any)?.paid_days ?? (presentDays + offDays + leaveDays + holidayDays);
  const otUnits = (p as any)?.ot_hours_or_days ?? 0;

  // Earnings Breakdown
  const basic = (p as any)?.basic ?? p?.basic_salary ?? Math.round(((p?.gross_salary || 0) * 0.5));
  const hra = (p as any)?.hra ?? Math.round(((p?.gross_salary || 0) * 0.2));
  const conveyance = (p as any)?.conveyance ?? p?.allowances?.['Conveyance Allowance'] ?? 1200;
  const washing = (p as any)?.washing ?? p?.allowances?.['Washing Allowance'] ?? 500;
  const specialAllowance = (p as any)?.special_allowance ?? p?.allowances?.['Special Allowance'] ?? Math.max(0, (p?.gross_salary || 0) - (basic + hra + conveyance + washing));
  const otAmount = (p as any)?.ot_amount ?? p?.allowances?.['Overtime Pay'] ?? 0;
  const otherAllowances = (p as any)?.other_allowances ?? p?.allowances?.['Other Allowances'] ?? 0;
  const grossSalary = (p as any)?.gross_salary ?? (basic + hra + conveyance + washing + specialAllowance);

  // Deductions Breakdown
  const pf = (p as any)?.pf ?? p?.deductions?.['PF'] ?? p?.deductions?.['EPF'] ?? 0;
  const esi = (p as any)?.esi ?? p?.deductions?.['ESIC'] ?? 0;
  const ptTds = (p as any)?.pt_tds ?? ((p?.deductions?.['Professional Tax'] || 0) + (p?.deductions?.['TDS'] || 0));
  const otDed = (p as any)?.ot_ded ?? p?.deductions?.['Miscellaneous Deductions'] ?? 0;
  const totalDeductions = (p as any)?.gross_deductions ?? (pf + esi + ptTds + otDed);

  // Net Salary
  const netSalary = (p as any)?.net_salary ?? Math.max(0, grossSalary - totalDeductions + otAmount + otherAllowances);
  const netInWords = numberToWords(Math.round(netSalary));

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Salary Slip - ${monthName} ${year} - ${empName} (${empCode})</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      margin: 0;
      padding: 24px;
      color: #0B1C30;
      background: #FFFFFF;
    }
    .payslip-container {
      max-width: 820px;
      margin: 0 auto;
      border: 1.5px solid #0D7377;
      border-radius: 12px;
      padding: 28px;
      box-shadow: 0 4px 18px rgba(0,0,0,0.04);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0D7377;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .hospital-title {
      font-size: 20px;
      font-weight: 800;
      color: #0D7377;
      text-transform: uppercase;
      letter-spacing: -0.3px;
    }
    .hospital-subtitle {
      font-size: 13px;
      font-weight: 700;
      color: #D97706;
      text-transform: uppercase;
      margin-top: 2px;
    }
    .hospital-subtext {
      font-size: 11px;
      color: #64748B;
      margin-top: 2px;
    }
    .payslip-tag {
      text-align: right;
    }
    .payslip-tag h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 800;
      color: #0D7377;
    }
    .payslip-tag p {
      margin: 2px 0 0;
      font-size: 12px;
      color: #64748B;
      font-weight: 600;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 8px;
      padding: 14px 16px;
      margin-bottom: 16px;
    }
    .meta-item label {
      display: block;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748B;
      margin-bottom: 2px;
    }
    .meta-item span {
      font-size: 13px;
      font-weight: 700;
      color: #0F172A;
    }
    .attendance-bar {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 8px;
      background: #F0FDFA;
      border: 1px solid #99F6E4;
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 20px;
      text-align: center;
    }
    .att-cell label {
      display: block;
      font-size: 10px;
      font-weight: 700;
      color: #0F766E;
      text-transform: uppercase;
    }
    .att-cell span {
      font-size: 13px;
      font-weight: 800;
      color: #0D7377;
    }
    .salary-tables {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 20px;
    }
    .table-card {
      border: 1px solid #E2E8F0;
      border-radius: 8px;
      overflow: hidden;
    }
    .table-header {
      background: #F8FAFC;
      padding: 8px 14px;
      font-weight: 800;
      font-size: 12px;
      text-transform: uppercase;
      color: #0D7377;
      border-bottom: 1px solid #E2E8F0;
      letter-spacing: 0.5px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12.5px;
    }
    table td {
      padding: 7px 12px;
      border-bottom: 1px solid #F1F5F9;
    }
    .total-row td {
      background: #F8FAFC;
      font-weight: 800;
      color: #0D7377;
      border-top: 1.5px solid #CBD5E1;
      padding: 9px 12px;
    }
    .net-banner {
      background: #0D7377;
      color: #FFFFFF;
      border-radius: 8px;
      padding: 16px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .net-label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      opacity: 0.9;
      font-weight: 600;
    }
    .net-value {
      font-size: 26px;
      font-weight: 800;
      color: #FFFFFF;
    }
    .net-words {
      font-size: 11.5px;
      color: #475569;
      font-style: italic;
      margin-bottom: 24px;
      padding: 6px 12px;
      background: #F8FAFC;
      border-left: 3px solid #0D7377;
      border-radius: 4px;
    }
    .signatures {
      display: flex;
      justify-content: space-between;
      padding-top: 36px;
      border-top: 1px dashed #CBD5E1;
      font-size: 11.5px;
    }
    .sig-block {
      width: 220px;
      text-align: center;
    }
    .sig-line {
      border-top: 1px solid #334155;
      padding-top: 4px;
      font-weight: 700;
      color: #0F172A;
    }
    @media print {
      body { padding: 0; }
      .payslip-container { border: none; box-shadow: none; padding: 10px; }
    }
  </style>
</head>
<body>
  <div class="payslip-container">
    <div class="header">
      <div>
        <div class="hospital-title">${orgName}</div>
        <div class="hospital-subtitle">${hospitalUnit}</div>
        <div class="hospital-subtext">NABH Accredited Multi-Specialty Hospital & Healthcare Institute</div>
      </div>
      <div class="payslip-tag">
        <h2>PAYSLIP</h2>
        <p>${monthName.toUpperCase()} ${year}</p>
        <p style="font-family: monospace; font-size: 11px;">#${payslip.payslip_number || 'SMH-PAY-' + payslip.id.slice(0, 6).toUpperCase()}</p>
      </div>
    </div>

    <!-- Employee Details Grid -->
    <div class="meta-grid">
      <div class="meta-item">
        <label>Employee Name</label>
        <span>${empName}</span>
      </div>
      <div class="meta-item">
        <label>Employee Code</label>
        <span>${empCode}</span>
      </div>
      <div class="meta-item">
        <label>Department</label>
        <span>${department}</span>
      </div>
      <div class="meta-item">
        <label>Designation</label>
        <span>${designation}</span>
      </div>
      <div class="meta-item">
        <label>Date of Joining</label>
        <span>${doj}</span>
      </div>
      <div class="meta-item">
        <label>Bank Account</label>
        <span>${bankAcc}</span>
      </div>
      <div class="meta-item">
        <label>PF / UAN No.</label>
        <span>${uan !== 'N/A' ? uan : pfNo}</span>
      </div>
      <div class="meta-item">
        <label>ESIC IP No.</label>
        <span>${esiNo}</span>
      </div>
    </div>

    <!-- Attendance Summary Bar -->
    <div class="attendance-bar">
      <div class="att-cell">
        <label>Payable</label>
        <span>${payableDays}</span>
      </div>
      <div class="att-cell">
        <label>Present</label>
        <span>${presentDays}</span>
      </div>
      <div class="att-cell">
        <label>Weekly Off</label>
        <span>${offDays}</span>
      </div>
      <div class="att-cell">
        <label>Leave</label>
        <span>${leaveDays}</span>
      </div>
      <div class="att-cell">
        <label>Holiday</label>
        <span>${holidayDays}</span>
      </div>
      <div class="att-cell">
        <label>Paid Days</label>
        <span>${paidDays}</span>
      </div>
      <div class="att-cell">
        <label>OT Units</label>
        <span>${otUnits}</span>
      </div>
    </div>

    <!-- Earnings & Deductions Tables -->
    <div class="salary-tables">
      <!-- Earnings -->
      <div class="table-card">
        <div class="table-header">Earnings (Gross Salary)</div>
        <table>
          <tr>
            <td>Basic Salary (50%)</td>
            <td style="text-align: right; font-weight: 600;">${formatCurrency(basic)}</td>
          </tr>
          <tr>
            <td>HRA (20%)</td>
            <td style="text-align: right; font-weight: 600;">${formatCurrency(hra)}</td>
          </tr>
          <tr>
            <td>Conveyance Allowance</td>
            <td style="text-align: right; font-weight: 600;">${formatCurrency(conveyance)}</td>
          </tr>
          <tr>
            <td>Washing Allowance</td>
            <td style="text-align: right; font-weight: 600;">${formatCurrency(washing)}</td>
          </tr>
          <tr>
            <td>Special Allowance</td>
            <td style="text-align: right; font-weight: 600;">${formatCurrency(specialAllowance)}</td>
          </tr>
          ${otAmount > 0 ? `
          <tr>
            <td style="color: #0D7377; font-weight: 600;">Overtime Pay (${otUnits} units)</td>
            <td style="text-align: right; font-weight: 700; color: #0D7377;">+${formatCurrency(otAmount)}</td>
          </tr>` : ''}
          ${otherAllowances > 0 ? `
          <tr>
            <td style="color: #0D7377; font-weight: 600;">Other Allowances</td>
            <td style="text-align: right; font-weight: 700; color: #0D7377;">+${formatCurrency(otherAllowances)}</td>
          </tr>` : ''}
          <tr class="total-row">
            <td>GROSS EARNINGS</td>
            <td style="text-align: right;">${formatCurrency(grossSalary)}</td>
          </tr>
        </table>
      </div>

      <!-- Deductions -->
      <div class="table-card">
        <div class="table-header">Deductions</div>
        <table>
          <tr>
            <td>Provident Fund (PF)</td>
            <td style="text-align: right; font-weight: 600; color: #BA1A1A;">${pf > 0 ? '-' + formatCurrency(pf) : '₹0'}</td>
          </tr>
          <tr>
            <td>ESIC Contribution</td>
            <td style="text-align: right; font-weight: 600; color: #BA1A1A;">${esi > 0 ? '-' + formatCurrency(esi) : '₹0'}</td>
          </tr>
          <tr>
            <td>PT / TDS Deductions</td>
            <td style="text-align: right; font-weight: 600; color: #BA1A1A;">${ptTds > 0 ? '-' + formatCurrency(ptTds) : '₹0'}</td>
          </tr>
          <tr>
            <td>Miscellaneous Deductions</td>
            <td style="text-align: right; font-weight: 600; color: #BA1A1A;">${otDed > 0 ? '-' + formatCurrency(otDed) : '₹0'}</td>
          </tr>
          <tr class="total-row">
            <td style="color: #BA1A1A;">TOTAL DEDUCTIONS</td>
            <td style="text-align: right; color: #BA1A1A;">-${formatCurrency(totalDeductions)}</td>
          </tr>
        </table>
      </div>
    </div>

    <!-- Net Pay Banner -->
    <div class="net-banner">
      <div>
        <div class="net-label">Net Take-Home Salary</div>
        <div style="font-size: 11px; opacity: 0.85;">Formula: Gross Earnings − Gross Deductions + OT Pay + Other Allowances</div>
      </div>
      <div class="net-value">${formatCurrency(netSalary)}</div>
    </div>

    <div class="net-words">
      <strong>Amount in Words:</strong> ${netInWords}
    </div>

    <!-- Footer Signatures -->
    <div class="signatures">
      <div class="sig-block">
        <div class="sig-line">Employee Signature</div>
        <div style="color: #64748B; font-size: 10px; margin-top: 2px;">Acknowledged by ${empName}</div>
      </div>
      <div class="sig-block">
        <div class="sig-line">Authorized Signatory</div>
        <div style="color: #64748B; font-size: 10px; margin-top: 2px;">Shanti Memorial Hospital · Accounts & HR</div>
      </div>
    </div>
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
