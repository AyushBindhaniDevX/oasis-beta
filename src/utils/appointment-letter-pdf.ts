import { exportOrPrintPdf } from './pdf';
import { Platform } from 'react-native';
import { formatCurrency, formatDate } from '@/utils/format';
import type { Employee, Organization } from '@/types';

export interface AppointmentLetterData {
  employee: Employee;
  organization?: Organization | null;
  refNumber?: string;
  issueDate?: string;
  probationMonths?: number;
  signatoryName?: string;
  signatoryTitle?: string;
}

export function generateAppointmentLetterHtml(data: AppointmentLetterData): string {
  const emp = data.employee;
  const prof = emp.profile;
  const empName = prof?.full_name || 'Candidate';
  const empCode = emp.employee_code || 'SMH-000';
  const designation = emp.designation || 'Healthcare Professional';
  const department = emp.department?.name || 'Medical Services';
  const unit = emp.hospital_unit || 'Shanti Memorial Hospital & Chikitsa Unit';
  const joiningDate = emp.joining_date ? formatDate(emp.joining_date) : formatDate(new Date().toISOString());
  const issueDate = data.issueDate ? formatDate(data.issueDate) : formatDate(new Date().toISOString());
  const refNo = data.refNumber || `SMH/HR/APT/${new Date().getFullYear()}/${empCode}`;
  const probationMonths = data.probationMonths || 6;
  const signatoryName = data.signatoryName || 'Dr. Authorized Signatory';
  const signatoryTitle = data.signatoryTitle || 'Medical Superintendent / HR Director';

  // Calculate Salary Components as per Hospital Formula
  const grossMonthly = emp.basic_salary ? (emp.basic_salary > 20000 ? emp.basic_salary : emp.basic_salary * 2) : 25000;
  const basic = Math.round(grossMonthly * 0.50);
  const hra = Math.round(grossMonthly * 0.20);
  const conveyance = emp.conveyance_allowance ?? 1200;
  const washing = emp.washing_allowance ?? 500;
  const specialAllowance = Math.max(0, grossMonthly - (basic + hra + conveyance + washing));

  const isPf = emp.is_pf_eligible !== false;
  const isEsic = grossMonthly <= 21000;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Appointment Letter - ${empName} (${empCode})</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Playfair+Display:wght@700&display=swap');
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      margin: 0;
      padding: 40px;
      color: #0F172A;
      background: #FFFFFF;
      line-height: 1.6;
    }
    .letter-container {
      max-width: 820px;
      margin: 0 auto;
      border: 1px solid #E2E8F0;
      border-radius: 12px;
      padding: 48px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.04);
    }
    .hospital-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 3px double #0D7377;
      padding-bottom: 20px;
      margin-bottom: 28px;
    }
    .hospital-name {
      font-size: 22px;
      font-weight: 800;
      color: #0D7377;
      text-transform: uppercase;
      letter-spacing: -0.3px;
    }
    .hospital-unit {
      font-size: 13px;
      font-weight: 700;
      color: #D97706;
      text-transform: uppercase;
      margin-top: 2px;
    }
    .hospital-address {
      font-size: 11px;
      color: #64748B;
      margin-top: 4px;
    }
    .ref-meta {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      color: #475569;
      margin-bottom: 24px;
      padding-bottom: 12px;
      border-bottom: 1px dashed #CBD5E1;
    }
    .letter-title {
      text-align: center;
      font-size: 18px;
      font-weight: 800;
      color: #0F172A;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 20px 0 24px 0;
      text-decoration: underline;
    }
    .salutation {
      font-size: 14px;
      margin-bottom: 14px;
    }
    p {
      font-size: 13.5px;
      color: #334155;
      margin: 0 0 14px 0;
      text-align: justify;
    }
    .highlight {
      font-weight: 700;
      color: #0F172A;
    }
    .salary-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      font-size: 13px;
    }
    .salary-table th {
      background: #F1F5F9;
      color: #0F172A;
      padding: 10px 14px;
      border: 1px solid #CBD5E1;
      text-align: left;
      font-weight: 700;
    }
    .salary-table td {
      padding: 9px 14px;
      border: 1px solid #CBD5E1;
      color: #334155;
    }
    .salary-table tr.total-row {
      background: #F8FAFC;
      font-weight: 800;
      color: #0D7377;
    }
    .terms-list {
      padding-left: 20px;
      font-size: 13px;
      color: #334155;
      margin: 14px 0;
    }
    .terms-list li {
      margin-bottom: 8px;
    }
    .signature-grid {
      display: flex;
      justify-content: space-between;
      margin-top: 48px;
      padding-top: 24px;
    }
    .sig-box {
      width: 280px;
    }
    .sig-line {
      border-top: 1px solid #0F172A;
      margin-top: 50px;
      padding-top: 6px;
      font-size: 13px;
      font-weight: 700;
      color: #0F172A;
    }
    .sig-role {
      font-size: 12px;
      color: #64748B;
    }
    @media print {
      body { padding: 0; }
      .letter-container { border: none; box-shadow: none; padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="letter-container">
    <div class="hospital-header">
      <div>
        <div class="hospital-name">Shanti Memorial Hospital</div>
        <div class="hospital-unit">Chikitsa Unit of Shanti Memorial Hospital</div>
        <div class="hospital-address">Multi-Super Specialty Healthcare Center · NABH Accredited</div>
      </div>
      <div style="text-align: right;">
        <span style="background: #E6FFFA; color: #0D7377; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 700; border: 1px solid #B2F5EA;">
          OFFICIAL APPOINTMENT
        </span>
      </div>
    </div>

    <div class="ref-meta">
      <div><strong>Ref No:</strong> ${refNo}</div>
      <div><strong>Date of Issue:</strong> ${issueDate}</div>
    </div>

    <div class="salutation">
      <strong>To,</strong><br>
      <strong>${empName}</strong><br>
      <span>Employee Code: <strong>${empCode}</strong></span><br>
      <span>Designation: <strong>${designation}</strong></span><br>
      <span>Department: <strong>${department}</strong></span><br>
      <span>Unit: <strong>${unit}</strong></span>
    </div>

    <div class="letter-title">Formal Letter of Appointment</div>

    <p>Dear <span class="highlight">${empName}</span>,</p>

    <p>
      With reference to your application, subsequent interviews, and master onboarding entry, we are pleased to appoint you as <span class="highlight">${designation}</span> in the <span class="highlight">${department}</span> department at <span class="highlight">${unit}</span>, effective from your date of joining <span class="highlight">${joiningDate}</span>.
    </p>

    <p>
      Your appointment is subject to the terms and operational policies of the Hospital as summarized below:
    </p>

    <div style="font-weight: 700; font-size: 14px; margin-top: 16px; color: #0D7377;">
      Annexure A: Monthly Compensation Structure
    </div>

    <table class="salary-table">
      <thead>
        <tr>
          <th>Salary Component</th>
          <th style="text-align: right;">Monthly Amount (INR)</th>
          <th style="text-align: right;">Annual Amount (INR)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Basic Salary (50% of Gross)</td>
          <td style="text-align: right; font-weight: 600;">${formatCurrency(basic)}</td>
          <td style="text-align: right;">${formatCurrency(basic * 12)}</td>
        </tr>
        <tr>
          <td>House Rent Allowance (HRA - 20% of Gross)</td>
          <td style="text-align: right; font-weight: 600;">${formatCurrency(hra)}</td>
          <td style="text-align: right;">${formatCurrency(hra * 12)}</td>
        </tr>
        <tr>
          <td>Conveyance Allowance</td>
          <td style="text-align: right; font-weight: 600;">${formatCurrency(conveyance)}</td>
          <td style="text-align: right;">${formatCurrency(conveyance * 12)}</td>
        </tr>
        <tr>
          <td>Washing Allowance</td>
          <td style="text-align: right; font-weight: 600;">${formatCurrency(washing)}</td>
          <td style="text-align: right;">${formatCurrency(washing * 12)}</td>
        </tr>
        <tr>
          <td>Special Allowance</td>
          <td style="text-align: right; font-weight: 600;">${formatCurrency(specialAllowance)}</td>
          <td style="text-align: right;">${formatCurrency(specialAllowance * 12)}</td>
        </tr>
        <tr class="total-row">
          <td>Total Gross Earnings</td>
          <td style="text-align: right;">${formatCurrency(grossMonthly)}</td>
          <td style="text-align: right;">${formatCurrency(grossMonthly * 12)}</td>
        </tr>
      </tbody>
    </table>

    <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; font-size: 12px; color: #475569;">
      <strong>Statutory Coverage:</strong> ${isPf ? 'Enrolled under Employees’ Provident Fund (EPF) Act.' : 'Non-PF Staff Category.'} ${isEsic ? 'Covered under ESIC (Gross <= ₹21,000).' : 'Statutory ESIC exempt (Gross > ₹21,000).'}
    </div>

    <div style="font-weight: 700; font-size: 14px; margin-top: 16px; color: #0D7377;">
      Key Terms & Conditions of Employment:
    </div>

    <ol class="terms-list">
      <li><strong>Probation Period:</strong> You will be on probation for a period of ${probationMonths} months from your date of joining. Upon satisfactory performance, your services will be confirmed in writing.</li>
      <li><strong>Duty Roster & Working Hours:</strong> Your duty roster and shift timings will be assigned by your immediate Head of Department (HOD). Standard scheduled shift is 8 hours. Overtime, if designated, will apply only after completion of scheduled shift as per hospital policy.</li>
      <li><strong>Attendance & Missed Punches:</strong> Attendance punches must be marked via the biometric / mobile portal. Missed punch regularizations are permitted a maximum of 5 times per calendar month.</li>
      <li><strong>Patient Confidentiality & Medical Ethics:</strong> You shall strictly uphold NABH protocol, clinical standards, and complete patient data confidentiality.</li>
      <li><strong>Termination & Notice:</strong> During probation, either party may terminate this agreement with 15 days' notice or salary in lieu thereof. Upon confirmation, notice period shall be 30 days.</li>
    </ol>

    <div class="signature-grid">
      <div class="sig-box">
        <div class="sig-line">For Shanti Memorial Hospital</div>
        <div class="sig-role">${signatoryName}<br>${signatoryTitle}</div>
      </div>
      <div class="sig-box">
        <div class="sig-line">Employee Acceptance Signature</div>
        <div class="sig-role">I accept the appointment on the above terms.<br><strong>${empName}</strong></div>
      </div>
    </div>
  </div>
</body>
</html>
`;
}

export async function exportAppointmentLetterPdf(data: AppointmentLetterData): Promise<string | null> {
  const html = generateAppointmentLetterHtml(data);
  const empCode = data.employee.employee_code || 'EMP';
  const fileName = `Appointment_Letter_${empCode}.pdf`;
  return await exportOrPrintPdf(html, fileName);
}
