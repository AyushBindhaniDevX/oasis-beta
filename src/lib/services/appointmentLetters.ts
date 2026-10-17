import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import type { Employee, Organization } from '@/types';
import { exportAppointmentLetterPdf, generateAppointmentLetterHtml } from '@/utils/appointment-letter-pdf';

export interface StoredAppointmentLetter {
  id: string;
  organization_id: string;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  designation: string;
  department_name: string;
  unit: string;
  ref_number: string;
  issued_at: string;
  created_at: string;
}

export async function createAndStoreAppointmentLetter(
  employee: Employee,
  orgId: string,
  organization?: Organization | null
): Promise<StoredAppointmentLetter> {
  const now = new Date().toISOString();
  const year = new Date().getFullYear();
  const empCode = employee.employee_code || 'SMH-000';
  const refNo = `SMH/HR/APT/${year}/${empCode}`;
  const letterId = `apt-${employee.id}-${Date.now()}`;

  const prof = employee.profile;
  const letterRecord: StoredAppointmentLetter = {
    id: letterId,
    organization_id: orgId,
    employee_id: employee.id,
    employee_code: empCode,
    employee_name: prof?.full_name || 'Staff Member',
    designation: employee.designation || 'Healthcare Staff',
    department_name: employee.department?.name || 'General Operations',
    unit: employee.hospital_unit || 'Shanti Memorial Hospital & Chikitsa Unit',
    ref_number: refNo,
    issued_at: now,
    created_at: now,
  };

  try {
    await setDoc(doc(db, 'appointment_letters', letterId), letterRecord);
  } catch (err) {
    console.error('Failed to store appointment letter in Firestore:', err);
  }

  return letterRecord;
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
