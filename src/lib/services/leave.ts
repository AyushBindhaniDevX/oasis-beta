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
import type { LeaveType, LeaveBalance, LeaveRequest, LeaveProcessResponse, Employee, Profile, Department } from '@/types';
import { getWorkingDaysCount } from './holidays';

const DEFAULT_LEAVE_TYPES = [
  { name: 'Annual Leave', annual_days: 18, is_paid: true, description: 'Standard paid annual leave for vacation & personal rest' },
  { name: 'Sick Leave', annual_days: 12, is_paid: true, description: 'Medical & health recovery leave' },
  { name: 'Casual Leave', annual_days: 7, is_paid: true, description: 'Short unplanned personal emergencies' },
  { name: 'Maternity Leave', annual_days: 90, is_paid: true, description: 'Paid maternity leave for female employees' },
  { name: 'Paternity Leave', annual_days: 7, is_paid: true, description: 'Paid paternity leave for new fathers' },
  { name: 'Compensatory Leave', annual_days: 5, is_paid: true, description: 'Comp-off for overtime or weekend duties' },
  { name: 'Bereavement Leave', annual_days: 5, is_paid: true, description: 'Compassionate leave for family loss' },
  { name: 'Unpaid Leave', annual_days: 30, is_paid: false, description: 'Extended leave without salary pay (LOP)' },
];

export async function getLeaveTypes(organizationId?: string): Promise<LeaveType[]> {
  try {
    const snap = await getDocs(collection(db, 'leave_types'));
    const types: LeaveType[] = [];
    snap.forEach((d) => {
      const lt = { id: d.id, ...d.data() } as LeaveType;
      if (organizationId) {
        if (lt.organization_id === organizationId || (organizationId === 'shanti-memorial-hospital' && lt.organization_id === 'smh')) {
          types.push(lt);
        }
      } else {
        types.push(lt);
      }
    });

    if (types.length > 0) {
      types.sort((a, b) => a.name.localeCompare(b.name));
      return types;
    }

    // Auto-seed real leave types into Firestore if this organization has none yet
    const resolvedOrgId = organizationId || '00000000-0000-0000-0000-000000000001';
    const seeded: LeaveType[] = [];
    for (let i = 0; i < DEFAULT_LEAVE_TYPES.length; i++) {
      const lt = DEFAULT_LEAVE_TYPES[i];
      const ltId = `lt-${resolvedOrgId}-${i + 1}`;
      const docData: LeaveType = {
        id: ltId,
        organization_id: resolvedOrgId,
        name: lt.name,
        annual_days: lt.annual_days,
        is_paid: lt.is_paid,
        description: lt.description,
        created_at: new Date().toISOString(),
      };
      await setDoc(doc(db, 'leave_types', ltId), docData);
      seeded.push(docData);
    }
    return seeded;
  } catch (err) {
    console.warn('Could not query Firestore leave_types, using defaults:', err);
  }

  return DEFAULT_LEAVE_TYPES.map((lt, idx) => ({
    id: `lt-${idx + 1}`,
    name: lt.name,
    annual_days: lt.annual_days,
    is_paid: lt.is_paid,
    description: lt.description,
    organization_id: organizationId || '00000000-0000-0000-0000-000000000001',
    created_at: new Date().toISOString(),
  })) as LeaveType[];
}

export async function createLeaveType(data: {
  name: string;
  annual_days: number;
  is_paid: boolean;
  description?: string;
  organization_id?: string;
}): Promise<LeaveType> {
  const ltId = `lt-${Date.now()}`;
  const now = new Date().toISOString();
  const orgId = data.organization_id || '00000000-0000-0000-0000-000000000001';

  const newType: LeaveType = {
    id: ltId,
    organization_id: orgId,
    name: data.name.trim(),
    annual_days: data.annual_days || 12,
    is_paid: data.is_paid ?? true,
    description: data.description?.trim() || null,
    created_at: now,
  };

  await setDoc(doc(db, 'leave_types', ltId), newType);
  return newType;
}

export async function updateLeaveType(
  id: string,
  updates: Partial<Omit<LeaveType, 'id' | 'created_at'>>
): Promise<LeaveType> {
  await updateDoc(doc(db, 'leave_types', id), updates);
  const snap = await getDoc(doc(db, 'leave_types', id));
  return { id: snap.id, ...snap.data() } as LeaveType;
}

export async function deleteLeaveType(id: string): Promise<void> {
  await deleteDoc(doc(db, 'leave_types', id));
}

export async function getLeaveBalances(
  employeeId: string,
  year?: number,
  organizationId?: string
): Promise<LeaveBalance[]> {
  const y = year ?? new Date().getFullYear();
  try {
    const q = query(
      collection(db, 'leave_balances'),
      where('employee_id', '==', employeeId),
      where('year', '==', y)
    );
    const snap = await getDocs(q);

    if (!snap.empty) {
      const types = await getLeaveTypes(organizationId);
      const typeMap = new Map(types.map((t) => [t.id, t]));

      const balances: LeaveBalance[] = [];
      snap.forEach((d) => {
        const bal = { id: d.id, ...d.data() } as LeaveBalance;
        bal.leave_type = typeMap.get(bal.leave_type_id);
        if (!organizationId || bal.leave_type) {
          balances.push(bal);
        }
      });
      if (balances.length > 0) {
        return balances;
      }
    }
  } catch (err) {}

  // Generate default active quotas from leave types strictly for this organization
  const types = await getLeaveTypes(organizationId);
  return types.map((lt) => ({
    id: `bal_${employeeId}_${lt.id}_${y}`,
    employee_id: employeeId,
    leave_type_id: lt.id,
    year: y,
    allocated_days: lt.annual_days || 12,
    used_days: 0,
    remaining_days: lt.annual_days || 12,
    leave_type: lt,
  })) as LeaveBalance[];
}

export async function getLeaveRequests(employeeId: string, organizationId?: string): Promise<LeaveRequest[]> {
  try {
    const [reqSnap, types] = await Promise.all([
      getDocs(query(collection(db, 'leave_requests'), where('employee_id', '==', employeeId))),
      getLeaveTypes(organizationId),
    ]);

    const typeMap = new Map(types.map((t) => [t.id, t]));
    const requests: LeaveRequest[] = [];
    reqSnap.forEach((d) => {
      const req = { id: d.id, ...d.data() } as LeaveRequest;
      req.leave_type = typeMap.get(req.leave_type_id);
      if (!organizationId || req.leave_type) {
        requests.push(req);
      }
    });

    requests.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    return requests;
  } catch (err) {
    console.error('getLeaveRequests error:', err);
    return [];
  }
}

export async function applyLeave(params: {
  employee_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  days: number;
  is_half_day: boolean;
  reason: string;
  organization_id?: string;
}): Promise<LeaveRequest> {
  const now = new Date().toISOString();
  const empId = params.employee_id;

  if (!empId) {
    throw new Error('Employee record could not be identified. Please ensure your profile is active.');
  }

  // Verify leave type exists for this organization
  const types = await getLeaveTypes(params.organization_id);
  let matchedType = types.find((t) => t.id === params.leave_type_id);
  if (!matchedType && types.length > 0) {
    matchedType = types[0];
  }

  const validLeaveTypeId = matchedType?.id || params.leave_type_id;

  // Calculate working days
  let calculatedDays = params.days;
  try {
    const workingDaysInfo = await getWorkingDaysCount(params.start_date, params.end_date);
    if (workingDaysInfo.workingDays > 0) {
      calculatedDays = params.is_half_day ? 0.5 : workingDaysInfo.workingDays;
    }
  } catch (e) {}

  const reqId = `lr-${Date.now()}`;
  const request: LeaveRequest = {
    id: reqId,
    employee_id: empId,
    leave_type_id: validLeaveTypeId,
    start_date: params.start_date,
    end_date: params.end_date,
    days: calculatedDays,
    is_half_day: params.is_half_day,
    reason: params.reason,
    status: 'pending',
    current_tier: 1, // Hospital 4-Tier: Tier 1 (Reporting Officer) -> Tier 2 (HOD) -> Tier 3 (Medical Superintendent) -> Tier 4 (HR/Admin)
    approval_history: [],
    is_locked: false,
    reviewed_by: null,
    reviewed_at: null,
    created_at: now,
    updated_at: now,
  };

  await setDoc(doc(db, 'leave_requests', reqId), request);
  request.leave_type = matchedType;

  // Background: Email notification to Manager
  try {
    const empSnap = await getDoc(doc(db, 'employees', empId));
    if (empSnap.exists()) {
      const empData = empSnap.data() as any;
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
          const { sendLeaveApplicationEmail } = await import('./resend');
          await sendLeaveApplicationEmail(
            mgrProf.email,
            mgrProf.full_name || 'Manager',
            empName,
            matchedType?.name || 'Leave',
            `${params.start_date} to ${params.end_date} (${calculatedDays} days)`,
            params.reason,
            { organizationId: params.organization_id }
          );
        }
      }
    }
  } catch (emailErr) {
    console.error('Failed to send leave application email:', emailErr);
  }

  return request;
}

export async function cancelLeave(requestId: string, userRole?: string): Promise<void> {
  const reqSnap = await getDoc(doc(db, 'leave_requests', requestId));
  if (!reqSnap.exists()) throw new Error('Leave request not found');
  const reqData = reqSnap.data() as LeaveRequest;

  // Enforce administrative lock once fully approved
  if (reqData.is_locked || reqData.status === 'approved') {
    const isAuthorizedAdmin = userRole === 'admin' || userRole === 'superadmin' || userRole === 'hr';
    if (!isAuthorizedAdmin) {
      throw new Error(
        'Leave request has completed the four-tier approval process and is locked. Modifications or cancellation require authorized administrative intervention.'
      );
    }
  }

  await updateDoc(doc(db, 'leave_requests', requestId), {
    status: 'cancelled',
    updated_at: new Date().toISOString(),
  });
}

export async function getPendingLeaveRequests(organizationId?: string): Promise<LeaveRequest[]> {
  return getFilteredLeaveRequests(organizationId, 'pending');
}

export async function getAllLeaveRequests(organizationId?: string): Promise<LeaveRequest[]> {
  return getFilteredLeaveRequests(organizationId);
}

async function getFilteredLeaveRequests(
  organizationId?: string,
  status?: LeaveRequest['status']
): Promise<LeaveRequest[]> {
  try {
    const [reqSnap, empsSnap, profsSnap, deptsSnap, types] = await Promise.all([
      getDocs(collection(db, 'leave_requests')),
      getDocs(collection(db, 'employees')),
      getDocs(collection(db, 'profiles')),
      getDocs(collection(db, 'departments')),
      getLeaveTypes(organizationId),
    ]);

    const typeMap = new Map(types.map((t) => [t.id, t]));
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

    const requests: LeaveRequest[] = [];
    reqSnap.forEach((d) => {
      const req = { id: d.id, ...d.data() } as LeaveRequest;
      const emp = req.employee_id ? empMap.get(req.employee_id) : undefined;

      if (organizationId) {
        const empOrg = emp?.organization_id || emp?.profile?.organization_id;
        if (empOrg && empOrg !== organizationId && !(organizationId === 'shanti-memorial-hospital' && empOrg === 'smh')) {
          return;
        }
      }
      if (status && req.status !== status) {
        return;
      }

      req.employee = emp;
      req.leave_type = typeMap.get(req.leave_type_id);
      requests.push(req);
    });

    requests.sort((a, b) => {
      if (status === 'pending') {
        return (a.created_at || '').localeCompare(b.created_at || '');
      }
      return (b.created_at || '').localeCompare(a.created_at || '');
    });

    return requests;
  } catch (err) {
    console.error('getFilteredLeaveRequests error:', err);
    return [];
  }
}

export const HOSPITAL_LEAVE_TIERS = [
  { tier: 1, name: 'Reporting Officer / Supervisor', code: 'L1' },
  { tier: 2, name: 'Immediate Head of Department (HOD)', code: 'L2' },
  { tier: 3, name: 'Medical Superintendent / Operations Head', code: 'L3' },
  { tier: 4, name: 'HR Head / Administration (Final Approval)', code: 'L4' },
];

export async function processLeaveRequest(
  requestId: string,
  action: 'approve' | 'reject',
  approverName?: string,
  options?: {
    approverId?: string;
    approverRole?: string;
    notes?: string;
    forceFinalApproval?: boolean;
  }
): Promise<LeaveProcessResponse> {
  const now = new Date().toISOString();

  const reqSnap = await getDoc(doc(db, 'leave_requests', requestId));
  if (!reqSnap.exists()) throw new Error('Leave request not found');
  const reqData = reqSnap.data() as LeaveRequest;

  // Prevent modifying an already locked request without administrative intervention
  if (reqData.is_locked && !options?.forceFinalApproval) {
    throw new Error('This leave request has completed the 4-tier approval process and is locked.');
  }

  const currentTier = reqData.current_tier || 1;
  const currentTierInfo = HOSPITAL_LEAVE_TIERS.find((t) => t.tier === currentTier) || HOSPITAL_LEAVE_TIERS[0];
  const history = Array.isArray(reqData.approval_history) ? [...reqData.approval_history] : [];

  history.push({
    tier: currentTier,
    role_title: options?.approverRole || currentTierInfo.name,
    approver_id: options?.approverId || 'system',
    approver_name: approverName || 'HR Management',
    action: action === 'approve' ? 'approved' : 'rejected',
    timestamp: now,
    notes: options?.notes || null,
  });

  const isFinalTier = options?.forceFinalApproval || currentTier >= 4;

  if (action === 'approve' && isFinalTier) {
    // Final tier 4 approved - deduct balances and lock
    const y = new Date(reqData.start_date).getFullYear();
    const balId = `bal_${reqData.employee_id}_${reqData.leave_type_id}_${y}`;
    const balSnap = await getDoc(doc(db, 'leave_balances', balId));

    if (balSnap.exists()) {
      const balData = balSnap.data() as LeaveBalance;
      const newUsed = (balData.used_days || 0) + reqData.days;
      const newRem = Math.max(0, (balData.allocated_days || 0) - newUsed);
      await updateDoc(doc(db, 'leave_balances', balId), {
        used_days: newUsed,
        remaining_days: newRem,
        updated_at: now,
      });
    } else {
      const types = await getLeaveTypes();
      const lt = types.find((t) => t.id === reqData.leave_type_id);
      const allocated = lt?.annual_days ?? 12;
      const newUsed = reqData.days;
      const newRem = Math.max(0, allocated - newUsed);
      await setDoc(doc(db, 'leave_balances', balId), {
        id: balId,
        employee_id: reqData.employee_id,
        leave_type_id: reqData.leave_type_id,
        year: y,
        allocated_days: allocated,
        used_days: newUsed,
        remaining_days: newRem,
        updated_at: now,
      });
    }

    await updateDoc(doc(db, 'leave_requests', requestId), {
      status: 'approved',
      current_tier: 5, // 5 denotes fully approved through all 4 tiers
      approval_history: history,
      is_locked: true,
      approved_by: approverName || 'HR Management',
      reviewed_by: approverName || 'HR Management',
      reviewed_at: now,
      updated_at: now,
    });
  } else if (action === 'approve') {
    // Intermediate tier approved - forward to next tier
    const nextTier = currentTier + 1;
    await updateDoc(doc(db, 'leave_requests', requestId), {
      current_tier: nextTier,
      approval_history: history,
      reviewed_by: approverName || 'Department Reviewer',
      reviewed_at: now,
      updated_at: now,
    });
  } else {
    // Rejected at any tier
    await updateDoc(doc(db, 'leave_requests', requestId), {
      status: 'rejected',
      approval_history: history,
      approved_by: approverName || 'Management',
      reviewed_by: approverName || 'Management',
      reviewed_at: now,
      updated_at: now,
    });
  }

  // Notify employee via In-App Notification & Resend Email
  try {
    const empSnap = await getDoc(doc(db, 'employees', reqData.employee_id));
    if (empSnap.exists()) {
      const emp = empSnap.data() as Employee;
      let recipientEmail = '';
      let recipientName = 'Colleague';

      if (emp.profile_id) {
        const profSnap = await getDoc(doc(db, 'profiles', emp.profile_id));
        if (profSnap.exists()) {
          const prof = profSnap.data() as Profile;
          recipientEmail = prof.email || '';
          recipientName = prof.full_name || recipientName;
        }

        const { createNotification } = await import('./notifications');
        await createNotification(
          emp.profile_id,
          action === 'approve' ? 'success' : 'alert',
          `Leave Request ${action === 'approve' ? 'Approved' : 'Rejected'}`,
          `Your leave request for ${reqData.days} day(s) from ${reqData.start_date} to ${reqData.end_date} has been ${action === 'approve' ? 'approved' : 'rejected'}.`
        );
      }

      if (recipientEmail) {
        try {
          const { sendLeaveStatusEmail } = await import('./resend');
          const types = await getLeaveTypes(emp.organization_id || undefined);
          const lt = types.find((t) => t.id === reqData.leave_type_id);

          await sendLeaveStatusEmail(
            recipientEmail,
            recipientName,
            action === 'approve' ? 'approved' : 'rejected',
            lt?.name || 'Leave Request',
            `${reqData.start_date} to ${reqData.end_date} (${reqData.days} day${reqData.days > 1 ? 's' : ''})`,
            approverName || 'HR Management',
            {
              organizationId: emp.organization_id || undefined,
              reason: reqData.reason || undefined,
            }
          );
        } catch (mailErr) {
          console.warn('Leave status email dispatch warning:', mailErr);
        }
      }
    }
  } catch (e) {}

  return {
    success: true,
    message: `Leave request ${action}d successfully.`,
    request_id: requestId,
    new_status: action === 'approve' ? 'approved' : 'rejected',
  };
}

export async function updateLeaveBalance(
  employeeId: string,
  leaveTypeId: string,
  allocatedDays: number,
  usedDays: number = 0,
  year?: number
): Promise<void> {
  const y = year ?? new Date().getFullYear();
  const remaining = Math.max(0, allocatedDays - usedDays);
  const now = new Date().toISOString();
  const balId = `bal_${employeeId}_${leaveTypeId}_${y}`;

  await setDoc(
    doc(db, 'leave_balances', balId),
    {
      id: balId,
      employee_id: employeeId,
      leave_type_id: leaveTypeId,
      year: y,
      allocated_days: allocatedDays,
      used_days: usedDays,
      remaining_days: remaining,
      updated_at: now,
    },
    { merge: true }
  );
}
