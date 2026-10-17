import { db } from '@/lib/firebase';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
} from 'firebase/firestore';
import type { AttendanceRegularization, AttendanceStatus, Attendance, Employee, Profile, Department } from '@/types';

function ymd(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function getMyRegularizations(employeeId: string): Promise<AttendanceRegularization[]> {
  if (!employeeId) return [];
  try {
    const q = query(
      collection(db, 'attendance_regularizations'),
      where('employee_id', '==', employeeId)
    );
    const snap = await getDocs(q);
    const results: AttendanceRegularization[] = [];
    snap.forEach((d) => results.push({ id: d.id, ...d.data() } as AttendanceRegularization));
    results.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    return results;
  } catch (err) {
    console.error('getMyRegularizations error:', err);
    return [];
  }
}

export async function getOrgRegularizations(
  organizationId?: string,
  status?: AttendanceRegularization['status']
): Promise<AttendanceRegularization[]> {
  try {
    const [regSnap, empsSnap, profsSnap, deptsSnap] = await Promise.all([
      getDocs(collection(db, 'attendance_regularizations')),
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

    const results: AttendanceRegularization[] = [];
    regSnap.forEach((d) => {
      const reg = { id: d.id, ...d.data() } as AttendanceRegularization;
      const emp = reg.employee_id ? empMap.get(reg.employee_id) : undefined;

      if (organizationId && reg.organization_id && reg.organization_id !== organizationId) {
        if (!emp?.profile?.organization_id || emp.profile.organization_id !== organizationId) {
          return;
        }
      }

      if (status && reg.status !== status) {
        return;
      }

      reg.employee = emp;
      results.push(reg);
    });

    results.sort((a, b) => {
      if (status === 'pending') {
        return (a.created_at || '').localeCompare(b.created_at || '');
      }
      return (b.created_at || '').localeCompare(a.created_at || '');
    });

    return results;
  } catch (err) {
    console.error('getOrgRegularizations error:', err);
    return [];
  }
}

export async function getPendingRegularizations(
  organizationId?: string
): Promise<AttendanceRegularization[]> {
  return getOrgRegularizations(organizationId, 'pending');
}

export const MAX_MONTHLY_REGULARIZATIONS = 5;

export async function getMonthlyRegularizationCount(
  employeeId: string,
  monthYear: string
): Promise<{ count: number; remaining: number; max: number }> {
  try {
    const q = query(
      collection(db, 'attendance_regularizations'),
      where('employee_id', '==', employeeId)
    );
    const snap = await getDocs(q);
    let count = 0;
    snap.forEach((d) => {
      const data = d.data() as AttendanceRegularization;
      if (data.status === 'cancelled') return;
      const dateKey = (data.date || data.created_at || '').slice(0, 7);
      if (dateKey === monthYear) {
        count++;
      }
    });
    return {
      count,
      remaining: Math.max(0, MAX_MONTHLY_REGULARIZATIONS - count),
      max: MAX_MONTHLY_REGULARIZATIONS,
    };
  } catch (err) {
    console.error('getMonthlyRegularizationCount error:', err);
    return { count: 0, remaining: MAX_MONTHLY_REGULARIZATIONS, max: MAX_MONTHLY_REGULARIZATIONS };
  }
}

export interface SubmitRegularizationParams {
  employee_id: string;
  date: string;
  requested_clock_in?: string | null;
  requested_clock_out?: string | null;
  requested_status?: AttendanceStatus | null;
  reason: string;
  bypass_limit?: boolean; // For authorized administrative intervention
}

export async function submitRegularization(
  params: SubmitRegularizationParams
): Promise<AttendanceRegularization> {
  const now = new Date().toISOString();

  if (!params.employee_id) {
    throw new Error('Your employee record could not be identified. Please try again.');
  }
  if (!params.reason || !params.reason.trim()) {
    throw new Error('Please provide a reason for this regularization.');
  }
  if (!params.date) {
    throw new Error('Please select the date to regularize.');
  }

  const day = ymd(params.date);
  const monthKey = day.slice(0, 7);

  // Enforce Policy: No more than 5 times per month
  if (!params.bypass_limit) {
    const { count, max } = await getMonthlyRegularizationCount(params.employee_id, monthKey);
    if (count >= max) {
      throw new Error(
        `Monthly policy limit reached: You have already submitted ${count} of ${max} allowed regularization requests for ${monthKey}. As per hospital policy, employees may regularize missed punches no more than 5 times per calendar month.`
      );
    }
  }

  let orgId: string | null = null;

  try {
    const empSnap = await getDoc(doc(db, 'employees', params.employee_id));
    if (empSnap.exists()) {
      const emp = empSnap.data() as Employee;
      orgId = emp.organization_id || null;
    }
  } catch {}

  const candidateId = `${params.employee_id}_${day}`;
  let attendanceId: string | null = candidateId;

  const regId = `reg-${Date.now()}`;
  const record: AttendanceRegularization = {
    id: regId,
    employee_id: params.employee_id,
    organization_id: orgId || '00000000-0000-0000-0000-000000000001',
    attendance_id: attendanceId,
    date: day,
    requested_clock_in: params.requested_clock_in || null,
    requested_clock_out: params.requested_clock_out || null,
    requested_status: params.requested_status || null,
    reason: params.reason.trim(),
    status: 'pending',
    reviewed_by: null,
    reviewed_at: null,
    review_note: null,
    created_at: now,
    updated_at: now,
  };

  await setDoc(doc(db, 'attendance_regularizations', regId), record);

  // Background: Email notification to Manager
  try {
    const freshEmpSnap = await getDoc(doc(db, 'employees', params.employee_id));
    if (freshEmpSnap.exists()) {
      const empData = freshEmpSnap.data() as any;
      const managerId = empData.manager_id;
      let empName = 'Employee';
      if (empData.profile_id) {
        const empProfSnap = await getDoc(doc(db, 'profiles', empData.profile_id));
        if (empProfSnap.exists()) empName = empProfSnap.data().full_name || 'Employee';
      }
      if (managerId) {
        const mgrProfSnap = await getDoc(doc(db, 'profiles', managerId));
        if (mgrProfSnap.exists()) {
          const mgrProf = mgrProfSnap.data() as any;
          const { sendAttendanceRegularizationEmail } = await import('./resend');
          await sendAttendanceRegularizationEmail(
            mgrProf.email,
            mgrProf.full_name || 'Manager',
            empName,
            day,
            params.reason,
            { organizationId: orgId }
          );
        }
      }
    }
  } catch (err) {}

  return record;
}

export async function cancelRegularization(id: string): Promise<void> {
  await updateDoc(doc(db, 'attendance_regularizations', id), {
    status: 'cancelled',
    updated_at: new Date().toISOString(),
  });
}

async function applyToAttendance(reg: AttendanceRegularization): Promise<void> {
  const now = new Date().toISOString();
  const day = ymd(reg.date);
  const attendanceId = reg.attendance_id || `${reg.employee_id}_${day}`;

  const attSnap = await getDoc(doc(db, 'attendance', attendanceId));
  const existing = attSnap.exists() ? (attSnap.data() as Attendance) : null;

  const clockIn = reg.requested_clock_in ?? existing?.clock_in ?? null;
  const clockOut = reg.requested_clock_out ?? existing?.clock_out ?? null;

  let workingMinutes = existing?.working_minutes ?? 0;
  if (clockIn && clockOut) {
    const mins = Math.floor((new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 60000);
    if (!isNaN(mins) && mins >= 0) workingMinutes = mins;
  }

  const status = reg.requested_status ?? existing?.status ?? 'present';

  const payload: Partial<Attendance> = {
    id: attendanceId,
    employee_id: reg.employee_id,
    workplace_id: existing?.workplace_id ?? null,
    date: day,
    clock_in: clockIn,
    clock_out: clockOut,
    working_minutes: workingMinutes,
    status,
    updated_at: now,
    created_at: existing?.created_at || now,
  };

  await setDoc(doc(db, 'attendance', attendanceId), payload, { merge: true });
}

export async function reviewRegularization(
  id: string,
  action: 'approve' | 'reject',
  reviewerId?: string,
  reviewNote?: string
): Promise<{ success: boolean; message: string }> {
  const now = new Date().toISOString();

  const regSnap = await getDoc(doc(db, 'attendance_regularizations', id));
  if (!regSnap.exists()) {
    throw new Error('Regularization request not found.');
  }

  const reg = { id: regSnap.id, ...regSnap.data() } as AttendanceRegularization;

  if (action === 'approve') {
    await applyToAttendance(reg);
  }

  await updateDoc(doc(db, 'attendance_regularizations', id), {
    status: action === 'approve' ? 'approved' : 'rejected',
    reviewed_by: reviewerId || 'HR Management',
    reviewed_at: now,
    review_note: reviewNote?.trim() || null,
    updated_at: now,
  });

  // Notify the employee
  try {
    const empSnap = await getDoc(doc(db, 'employees', reg.employee_id));
    if (empSnap.exists()) {
      const emp = empSnap.data() as Employee;
      if (emp.profile_id) {
        // Send Email
        try {
          const profSnap = await getDoc(doc(db, 'profiles', emp.profile_id));
          if (profSnap.exists()) {
            const prof = profSnap.data() as any;
            const { sendRegularizationStatusEmail } = await import('./resend');
            await sendRegularizationStatusEmail(
              prof.email,
              prof.full_name || 'Employee',
              action === 'approve' ? 'approved' : 'rejected',
              ymd(reg.date),
              reviewerId || 'HR Management',
              { organizationId: reg.organization_id }
            );
          }
        } catch (e) {}

        const { createNotification } = await import('./notifications');
        await createNotification(
          emp.profile_id,
          action === 'approve' ? 'success' : 'alert',
          `Attendance Regularization ${action === 'approve' ? 'Approved' : 'Rejected'}`,
          `Your attendance regularization for ${ymd(reg.date)} has been ${
            action === 'approve' ? 'approved and applied' : 'rejected'
          }.`
        );
      }
    }
  } catch (e) {}

  return {
    success: true,
    message: `Regularization ${action === 'approve' ? 'approved' : 'rejected'} successfully.`,
  };
}
