import { db, auth, secondaryAuth } from '@/lib/firebase';
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
import { createUserWithEmailAndPassword, updateProfile as fbUpdateProfile, sendPasswordResetEmail } from 'firebase/auth';
import type { Organization, Profile, Department, Workplace, Employee } from '@/types';

function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function getOrganization(orgId: string): Promise<Organization | null> {
  try {
    const targetId = orgId === 'smh' ? 'shanti-memorial-hospital' : orgId;
    const snap = await getDoc(doc(db, 'organizations', targetId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Organization;
  } catch (err) {
    console.error('getOrganization error:', err);
    return null;
  }
}

export async function updateOrganization(orgId: string, updates: Partial<Organization>): Promise<void> {
  await updateDoc(doc(db, 'organizations', orgId), {
    ...updates,
    updated_at: new Date().toISOString(),
  });
}

export async function getOrgUsers(organizationId?: string): Promise<Profile[]> {
  try {
    let q = query(collection(db, 'profiles'));
    if (organizationId) {
      q = query(collection(db, 'profiles'), where('organization_id', '==', organizationId));
    }

    const [profilesSnap, employeesSnap, deptsSnap, workplacesSnap] = await Promise.all([
      getDocs(q),
      getDocs(collection(db, 'employees')),
      getDocs(collection(db, 'departments')),
      getDocs(collection(db, 'workplaces')),
    ]);

    const deptsMap = new Map<string, Department>();
    deptsSnap.forEach((d) => deptsMap.set(d.id, { id: d.id, ...d.data() } as Department));

    const workplacesMap = new Map<string, Workplace>();
    workplacesSnap.forEach((w) => workplacesMap.set(w.id, { id: w.id, ...w.data() } as Workplace));

    const employeesByProfileId = new Map<string, Employee>();
    employeesSnap.forEach((e) => {
      const empData = { id: e.id, ...e.data() } as Employee;
      if (empData.profile_id) {
        empData.department = empData.department_id ? deptsMap.get(empData.department_id) : undefined;
        empData.workplace = empData.workplace_id ? workplacesMap.get(empData.workplace_id) : undefined;
        employeesByProfileId.set(empData.profile_id, empData);
      }
    });

    const profiles: Profile[] = [];
    profilesSnap.forEach((p) => {
      const prof = { id: p.id, ...p.data() } as Profile;
      (prof as any).employee = employeesByProfileId.get(prof.id);
      profiles.push(prof);
    });

    // Sort by role then full_name
    profiles.sort((a, b) => {
      if (a.role !== b.role) return a.role.localeCompare(b.role);
      return (a.full_name || '').localeCompare(b.full_name || '');
    });

    return profiles;
  } catch (err) {
    console.error('getOrgUsers error:', err);
    return [];
  }
}

export async function updateUserRole(userId: string, role: string): Promise<void> {
  await updateDoc(doc(db, 'profiles', userId), {
    role,
    updated_at: new Date().toISOString(),
  });

  try {
    const { createAuditLog } = await import('./audit');
    await createAuditLog('user_role_updated', 'profile', userId, { new_role: role });
  } catch (e) {}
}

export async function updateUserProfileData(
  userId: string,
  data: { full_name?: string; phone?: string | null; role?: string; is_hhc_enabled?: boolean }
): Promise<void> {
  await updateDoc(doc(db, 'profiles', userId), {
    ...data,
    updated_at: new Date().toISOString(),
  });

  try {
    const { createAuditLog } = await import('./audit');
    await createAuditLog('user_profile_updated', 'profile', userId, data);
  } catch (e) {}
}

export async function toggleUserActive(userId: string, isActive: boolean): Promise<void> {
  await updateDoc(doc(db, 'profiles', userId), {
    is_active: isActive,
    updated_at: new Date().toISOString(),
  });

  try {
    const { createAuditLog } = await import('./audit');
    await createAuditLog(
      isActive ? 'user_account_activated' : 'user_account_deactivated',
      'profile',
      userId,
      { is_active: isActive }
    );
  } catch (e) {}
}

export async function deleteUserRecord(userId: string): Promise<void> {
  // Delete linked employee records
  const empQ = query(collection(db, 'employees'), where('profile_id', '==', userId));
  const empSnap = await getDocs(empQ);
  for (const empDoc of empSnap.docs) {
    await deleteDoc(doc(db, 'employees', empDoc.id));
  }

  // Delete from profiles
  await deleteDoc(doc(db, 'profiles', userId));

  try {
    const { createAuditLog } = await import('./audit');
    await createAuditLog('user_account_deleted', 'profile', userId);
  } catch (e) {}
}

export async function createSystemUser(params: {
  email: string;
  password: string;
  full_name: string;
  role: 'admin' | 'hr' | 'employee';
  organization_id: string;
  phone?: string;
  create_employee_record?: boolean;
  employee_code?: string;
  department_id?: string;
  designation?: string;
  joining_date?: string;
  workplace_id?: string;
  basic_salary?: number;
  employment_type?: 'full_time' | 'part_time' | 'contract' | 'intern' | string;
  default_shift_id?: string;
  manager_id?: string;
  date_of_birth?: string;
  uan_number?: string;
  esi_number?: string;
  esi_exempt?: boolean;
  epf_percentage?: number | string;
  socso_percentage?: number | string;
  tax_percentage?: number | string;
  tax_regime?: string;
  hra_percentage?: number | string;
  transport_allowance?: number;
  conveyance_allowance?: number | string;
  washing_allowance?: number | string;
  special_allowance?: number | string;
  custom_items?: any[];
  tax_config?: Record<string, any>;
  is_hhc_enabled?: boolean;
}): Promise<string> {
  let orgId = params.organization_id;
  if (!orgId) {
    const orgsQ = query(collection(db, 'organizations'), limit(1));
    const orgsSnap = await getDocs(orgsQ);
    if (!orgsSnap.empty) {
      orgId = orgsSnap.docs[0].id;
    } else {
      orgId = '00000000-0000-0000-0000-000000000001';
    }
  }

  const cleanEmail = params.email.trim().toLowerCase();
  let uid = generateUuid();

  // Try creating in Firebase Auth
  try {
    const defaultPassword = params.password || (params.phone ? `Pass@${params.phone.slice(-4)}` : 'Welcome@123');
    const cred = await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, defaultPassword);
    if (cred.user?.uid) {
      uid = cred.user.uid;
      await fbUpdateProfile(cred.user, { displayName: params.full_name });
      try {
        await sendPasswordResetEmail(secondaryAuth, cleanEmail);
      } catch (e) {
        console.warn('Could not send password reset email', e);
      }
      await secondaryAuth.signOut();
    }
  } catch (authErr: any) {
    try {
      await sendPasswordResetEmail(secondaryAuth, cleanEmail);
    } catch (e) {
      console.warn('Could not send password reset email', e);
    }
    // If account exists in Firebase Auth or admin context
    console.warn('Firebase Auth user creation notice:', authErr?.message || authErr);
    throw authErr; // Important: prevent creating orphaned firestore records with a random UID
  }

  const now = new Date().toISOString();
  const profPayload: Profile = {
    id: uid,
    full_name: params.full_name,
    email: cleanEmail,
    role: params.role,
    organization_id: orgId,
    phone: params.phone || null,
    avatar_url: null,
    is_active: true,
    is_hhc_enabled: params.is_hhc_enabled ?? false,
    created_at: now,
    updated_at: now,
  };

  await setDoc(doc(db, 'profiles', uid), profPayload);

  let empPayload: Employee | null = null;

  // Create employee record if requested
  if (params.create_employee_record) {
    const empId = `emp-${Date.now()}`;
    const taxConfig = {
      ...(params.tax_config || {}),
      epf_percentage: params.epf_percentage != null ? Number(params.epf_percentage) : 12,
      socso_percentage: params.socso_percentage != null ? Number(params.socso_percentage) : 0.5,
      tax_percentage: params.tax_percentage != null ? Number(params.tax_percentage) : 5,
      tds_percentage: params.tax_percentage != null ? Number(params.tax_percentage) : 5,
      tax_regime: params.tax_regime || 'custom',
      hra_percentage: params.hra_percentage != null ? Number(params.hra_percentage) : 40,
      transport_allowance: params.transport_allowance || 0,
      custom_items: params.custom_items || params.tax_config?.custom_items || [],
    };

    empPayload = {
      id: empId,
      profile_id: uid,
      organization_id: orgId,
      employee_code: params.employee_code || `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
      department_id: params.department_id || null,
      designation: params.designation || (params.role === 'admin' ? 'Administrator' : params.role === 'hr' ? 'HR Manager' : 'Staff'),
      joining_date: params.joining_date || now.split('T')[0],
      workplace_id: params.workplace_id || null,
      manager_id: params.manager_id || null,
      default_shift_id: params.default_shift_id || null,
      is_hhc_enabled: params.is_hhc_enabled ?? false,
      date_of_birth: params.date_of_birth || null,
      basic_salary: params.basic_salary || 0,
      conveyance_allowance: (params as any).conveyance_allowance !== undefined ? Number((params as any).conveyance_allowance) : 1200,
      washing_allowance: (params as any).washing_allowance !== undefined ? Number((params as any).washing_allowance) : 500,
      special_allowance: (params as any).special_allowance !== undefined ? Number((params as any).special_allowance) : undefined,
      employment_status: 'active',
      onboarding_completed: true,
      tax_config: {
        ...taxConfig,
        uan_number: params.uan_number || null,
        esi_number: params.esi_number || null,
        esi_exempt: params.esi_exempt ?? false,
      },
      created_at: now,
      updated_at: now,
    };

    await setDoc(doc(db, 'employees', empId), empPayload);

    if (params.default_shift_id) {
      const today = now.split('T')[0];
      const shiftDocId = `${empId}_${today}`;
      await setDoc(doc(db, 'employee_shifts', shiftDocId), {
        id: shiftDocId,
        employee_id: empId,
        date: today,
        shift_id: params.default_shift_id,
        organization_id: orgId,
        created_at: now,
      });
    }
  }

  try {
    const { createAuditLog } = await import('./audit');
    await createAuditLog('user_account_created', 'profile', uid, {
      full_name: params.full_name,
      email: params.email,
      role: params.role,
      has_employee_record: !!params.create_employee_record,
    });
  } catch (e) {}

  let deptName = '';
  let wpName = '';
  let resolvedOrgName = '';

  // Dispatch Welcome & Credentials Email to the provisioned user
  try {
    const { sendWelcomeEmail } = await import('./resend');
    if (orgId) {
      if (orgId === 'shanti-memorial-hospital' || orgId === 'smh') {
        resolvedOrgName = 'Shanti Memorial Hospital';
      } else {
        try {
          const orgSnap = await getDoc(doc(db, 'organizations', orgId));
          if (orgSnap.exists()) {
            resolvedOrgName = orgSnap.data()?.name || '';
          }
        } catch (oErr) {}
      }
    }
    if (params.department_id) {
      try {
        const dSnap = await getDoc(doc(db, 'departments', params.department_id));
        if (dSnap.exists()) deptName = dSnap.data()?.name || '';
      } catch (dErr) {}
    }
    if (params.workplace_id) {
      try {
        const wSnap = await getDoc(doc(db, 'workplaces', params.workplace_id));
        if (wSnap.exists()) wpName = wSnap.data()?.name || '';
      } catch (wErr) {}
    }

    const defaultPassword = params.password || (params.phone ? `Pass@${params.phone.slice(-4)}` : 'Welcome@123');
    await sendWelcomeEmail(
      cleanEmail,
      params.full_name,
      params.employee_code || `EMP-${uid.slice(0, 6).toUpperCase()}`,
      params.designation || (params.role === 'admin' ? 'Administrator' : params.role === 'hr' ? 'HR Manager' : 'Staff'),
      {
        organizationId: orgId,
        organizationName: resolvedOrgName || undefined,
        department: deptName,
        workplace: wpName,
        temporaryPassword: defaultPassword,
        designation: params.designation,
      }
    );
  } catch (mailErr) {
    console.warn('System user welcome email notification dispatch warning:', mailErr);
  }

  // Automated Appointment Letter Generation & Email Dispatch for Provisioned Employee
  if (params.create_employee_record && empPayload) {
    try {
      const { createAndStoreAppointmentLetter } = await import('./appointmentLetters');
      await createAndStoreAppointmentLetter(
        {
          ...empPayload,
          profile: profPayload,
          department: params.department_id ? ({ id: params.department_id, name: deptName } as any) : undefined,
        },
        orgId,
        resolvedOrgName ? ({ id: orgId, name: resolvedOrgName } as any) : undefined,
        true
      );
    } catch (aptErr) {
      console.warn('System user appointment letter generation notice:', aptErr);
    }
  }

  return uid;
}

export async function createDepartment(orgId: string, name: string, description: string): Promise<string> {
  const deptId = `dept-${Date.now()}`;
  const now = new Date().toISOString();
  await setDoc(doc(db, 'departments', deptId), {
    id: deptId,
    organization_id: orgId,
    name,
    description,
    manager_id: null,
    created_at: now,
    updated_at: now,
  });
  return deptId;
}

export async function createWorkplace(
  orgId: string,
  name: string,
  address: string,
  latitude: number,
  longitude: number,
  radiusMeters: number
): Promise<string> {
  const wpId = `wp-${Date.now()}`;
  const now = new Date().toISOString();
  await setDoc(doc(db, 'workplaces', wpId), {
    id: wpId,
    organization_id: orgId,
    name,
    address,
    latitude,
    longitude,
    radius_meters: radiusMeters,
    is_active: true,
    created_at: now,
    updated_at: now,
  });
  return wpId;
}
