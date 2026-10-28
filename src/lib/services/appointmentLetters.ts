import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  updateDoc,
} from 'firebase/firestore';
import { Platform } from 'react-native';
import * as Print from 'expo-print';
import type { Employee, Organization } from '@/types';
import { exportAppointmentLetterPdf, generateAppointmentLetterHtml } from '@/utils/appointment-letter-pdf';
import { sendAppointmentLetterEmail } from './resend';
import { createAuditLog } from './audit';

export interface StoredAppointmentLetter {
  id: string;
  organization_id: string;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  employee_email?: string;
  designation: string;
  department_name: string;
  unit: string;
  ref_number: string;
  issued_at: string;
  created_at: string;
  email_sent?: boolean;
  last_emailed_at?: string;
  resend_count?: number;
}

export async function createAndStoreAppointmentLetter(
  employee: Employee,
  orgId: string,
  organization?: Organization | null,
  sendEmail: boolean = true
): Promise<StoredAppointmentLetter> {
  const now = new Date().toISOString();
  const year = new Date().getFullYear();
  const orgName = organization?.name || 'Enterprise Workplace';
  const isSMH = !!(organization && (orgId === 'smh' || orgId === 'shanti-memorial-hospital' || orgName.toLowerCase().includes('shanti')));
  const empCode = employee.employee_code || (isSMH ? 'SMH-000' : 'EMP-000');
  const refPrefix = isSMH ? 'SMH' : orgName.replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase() || 'HR';
  const refNo = `${refPrefix}/HR/APT/${year}/${empCode}`;
  const letterId = `apt-${employee.id}-${Date.now()}`;

  const prof = employee.profile;
  const empEmail = prof?.email || (employee as any).email || '';
  const unit = employee.hospital_unit || (isSMH ? 'Shanti Memorial Hospital & Chikitsa Unit' : `${orgName} Campus`);

  const letterRecord: StoredAppointmentLetter = {
    id: letterId,
    organization_id: orgId,
    employee_id: employee.id,
    employee_code: empCode,
    employee_name: prof?.full_name || 'Staff Member',
    employee_email: empEmail,
    designation: employee.designation || 'Healthcare Professional',
    department_name: employee.department?.name || 'General Operations',
    unit,
    ref_number: refNo,
    issued_at: now,
    created_at: now,
    email_sent: false,
    resend_count: 0,
  };

  try {
    await setDoc(doc(db, 'appointment_letters', letterId), letterRecord);
  } catch (err) {
    console.error('Failed to store appointment letter in Firestore:', err);
  }

  // Automatically dispatch Letter of Appointment via Email upon creation
  if (sendEmail && empEmail) {
    try {
      let base64Pdf: string | undefined;
      if (Platform.OS !== 'web') {
        try {
          const html = generateAppointmentLetterHtml({ employee, organization, refNumber: refNo });
          const printRes = await Print.printToFileAsync({ html, base64: true });
          if (printRes?.base64) base64Pdf = printRes.base64;
        } catch (e) {
          console.warn('PDF attachment generation notice:', e);
        }
      }

      await sendAppointmentLetterEmail(
        empEmail,
        letterRecord.employee_name,
        empCode,
        letterRecord.designation,
        {
          organizationId: orgId,
          organizationName: orgName,
          department: letterRecord.department_name,
          unit,
          designation: letterRecord.designation,
          joiningDate: employee.joining_date || now.split('T')[0],
          refNumber: refNo,
          basicSalary: employee.basic_salary,
          conveyanceAllowance: employee.conveyance_allowance,
          washingAllowance: employee.washing_allowance,
          isPfEligible: employee.is_pf_eligible,
          pdfBase64: base64Pdf,
          pdfFileName: `Appointment_Letter_${empCode}.pdf`,
        }
      );

      letterRecord.email_sent = true;
      letterRecord.last_emailed_at = new Date().toISOString();
      letterRecord.resend_count = 1;

      try {
        await updateDoc(doc(db, 'appointment_letters', letterId), {
          email_sent: true,
          last_emailed_at: letterRecord.last_emailed_at,
          resend_count: 1,
        });
      } catch (uErr) {
        // Silently continue if update fails
      }

      await createAuditLog('appointment_letter_sent', 'employee', employee.id, {
        email: empEmail,
        employee_code: empCode,
        ref_number: refNo,
      });
    } catch (mailErr) {
      console.warn('Failed to dispatch appointment letter email on creation:', mailErr);
    }
  }

  return letterRecord;
}

export async function resendAppointmentLetterEmail(params: {
  employee: Employee;
  targetEmail?: string;
  organizationId?: string;
  organization?: Organization | null;
  signatoryName?: string;
  signatoryTitle?: string;
}): Promise<{ success: boolean; id?: string }> {
  const { employee, organization, signatoryName, signatoryTitle } = params;
  const targetEmail = (params.targetEmail || employee.profile?.email || (employee as any).email || '').trim();

  if (!targetEmail) {
    throw new Error('No valid recipient email address available for this employee.');
  }

  const orgId = params.organizationId || employee.organization_id || organization?.id || '00000000-0000-0000-0000-000000000001';
  const orgName = organization?.name || 'Shanti Memorial Hospital';
  const isSMH = !organization || orgId === 'smh' || orgId === 'shanti-memorial-hospital' || orgName.toLowerCase().includes('shanti');
  const empCode = employee.employee_code || (isSMH ? 'SMH-000' : 'EMP-000');
  const prof = employee.profile;
  const empName = prof?.full_name || 'Staff Member';
  const designation = employee.designation || 'Healthcare Professional';
  const department = employee.department?.name || 'General Operations';
  const unit = employee.hospital_unit || (isSMH ? 'Shanti Memorial Hospital & Chikitsa Unit' : `${orgName} Campus`);
  const year = new Date().getFullYear();
  const refPrefix = isSMH ? 'SMH' : orgName.replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase() || 'HR';
  const refNo = `${refPrefix}/HR/APT/${year}/${empCode}`;

  let base64Pdf: string | undefined;
  if (Platform.OS !== 'web') {
    try {
      const html = generateAppointmentLetterHtml({
        employee,
        organization,
        refNumber: refNo,
        signatoryName,
        signatoryTitle,
      });
      const printRes = await Print.printToFileAsync({ html, base64: true });
      if (printRes?.base64) base64Pdf = printRes.base64;
    } catch (e) {
      console.warn('Native PDF generation notice:', e);
    }
  }

  const result = await sendAppointmentLetterEmail(
    targetEmail,
    empName,
    empCode,
    designation,
    {
      organizationId: orgId,
      organizationName: orgName,
      department,
      unit,
      designation,
      joiningDate: employee.joining_date || new Date().toISOString().split('T')[0],
      refNumber: refNo,
      basicSalary: employee.basic_salary,
      conveyanceAllowance: employee.conveyance_allowance,
      washingAllowance: employee.washing_allowance,
      isPfEligible: employee.is_pf_eligible,
      signatoryName,
      signatoryTitle,
      pdfBase64: base64Pdf,
      pdfFileName: `Appointment_Letter_${empCode}.pdf`,
    }
  );

  // Update record or create if not existing
  try {
    const existing = await getAppointmentLetterByEmployeeId(employee.id);
    const nowIso = new Date().toISOString();
    if (existing?.id) {
      await updateDoc(doc(db, 'appointment_letters', existing.id), {
        employee_email: targetEmail,
        email_sent: true,
        last_emailed_at: nowIso,
        resend_count: (existing.resend_count || 0) + 1,
      });
    } else {
      await createAndStoreAppointmentLetter(employee, orgId, organization, false);
    }
  } catch (err) {
    console.warn('Could not update appointment letter log in Firestore:', err);
  }

  await createAuditLog('appointment_letter_resent', 'employee', employee.id, {
    recipient_email: targetEmail,
    employee_code: empCode,
    ref_number: refNo,
  });

  return result;
}

export async function downloadAppointmentLetterPdf(params: {
  employee: Employee;
  organization?: Organization | null;
  refNumber?: string;
  signatoryName?: string;
  signatoryTitle?: string;
}): Promise<string | null> {
  const result = await exportAppointmentLetterPdf({
    employee: params.employee,
    organization: params.organization,
    refNumber: params.refNumber,
    signatoryName: params.signatoryName,
    signatoryTitle: params.signatoryTitle,
  });

  try {
    await createAuditLog('appointment_letter_pdf_downloaded', 'employee', params.employee.id, {
      employee_code: params.employee.employee_code,
    });
  } catch (e) {}

  return result;
}

export async function getAppointmentLetterByEmployeeId(
  employeeId: string
): Promise<StoredAppointmentLetter | null> {
  try {
    const q = query(collection(db, 'appointment_letters'), where('employee_id', '==', employeeId));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const d = snap.docs[0];
      return { id: d.id, ...d.data() } as StoredAppointmentLetter;
    }
  } catch (err) {
    console.error('getAppointmentLetterByEmployeeId error:', err);
  }
  return null;
}

export async function getAppointmentLetters(organizationId?: string): Promise<StoredAppointmentLetter[]> {
  try {
    const snap = await getDocs(collection(db, 'appointment_letters'));
    const letters: StoredAppointmentLetter[] = [];
    snap.forEach((d) => {
      const l = { id: d.id, ...d.data() } as StoredAppointmentLetter;
      if (!organizationId || l.organization_id === organizationId || (organizationId === 'shanti-memorial-hospital' && l.organization_id === 'smh')) {
        letters.push(l);
      }
    });
    letters.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    return letters;
  } catch (e) {
    console.error('getAppointmentLetters error:', e);
    return [];
  }
}

export { exportAppointmentLetterPdf, generateAppointmentLetterHtml };
