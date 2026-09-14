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
import type { Employee, Profile, Department, Workplace } from '@/types';

function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function getEmployeeByProfileId(profileId: string, organizationId?: string): Promise<Employee | null> {
  try {
    const empQ = query(collection(db, 'employees'), where('profile_id', '==', profileId));
    const empSnap = await getDocs(empQ);

    let simpleEmp: Employee | null = null;

    if (!empSnap.empty) {
      if (organizationId) {
        const match = empSnap.docs.find((d) => {
          const data = d.data();
          return (
            data.organization_id === organizationId ||
            (organizationId === 'shanti-memorial-hospital' && data.organization_id === 'smh')
          );
        });
        if (match) {
          simpleEmp = { id: match.id, ...match.data() } as Employee;
        }
      }
      if (!simpleEmp && empSnap.docs.length > 0) {
        const firstDoc = empSnap.docs[0];
        simpleEmp = { id: firstDoc.id, ...firstDoc.data() } as Employee;
      }
    }

    // Auto-provision or link an employee record if user has a profile but no employee row in this org
    if (!simpleEmp || (organizationId && simpleEmp.organization_id !== organizationId && !(organizationId === 'shanti-memorial-hospital' && simpleEmp.organization_id === 'smh'))) {
      const profSnap = await getDoc(doc(db, 'profiles', profileId));
      if (profSnap.exists()) {
        const prof = profSnap.data() as Profile;
        const targetOrg = organizationId || prof.organization_id || '00000000-0000-0000-0000-000000000001';
        const isSMH = targetOrg === 'shanti-memorial-hospital' || targetOrg === 'smh';
        const empId = `emp-${Date.now()}`;
        const empCode = isSMH ? 'SMH-' + Math.floor(1000 + Math.random() * 9000) : 'EMP-' + Math.floor(1000 + Math.random() * 9000);
        
        const newEmpPayload: Employee = {
          id: empId,
          profile_id: profileId,
          organization_id: targetOrg,
          employee_code: empCode,
          designation: prof.role === 'admin' ? (isSMH ? 'Medical Director / Administrator' : 'System Administrator') : prof.role === 'hr' ? (isSMH ? 'Hospital Operations & HR' : 'HR Manager') : (isSMH ? 'Clinical Staff Member' : 'Team Member'),
          department_id: isSMH ? 'dept-smh-admin' : null,
          workplace_id: isSMH ? 'wp-smh-main' : null,
          default_shift_id: isSMH ? 'shift-smh-general' : null,
          employment_status: 'active',
          joining_date: new Date().toISOString().split('T')[0],
          basic_salary: isSMH ? 75000 : 35000,
          onboarding_completed: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        await setDoc(doc(db, 'employees', empId), newEmpPayload);
        simpleEmp = newEmpPayload;
      }
    }

    if (!simpleEmp) return null;

    // Fetch associated Profile, Department, and Workplace
    const [profSnap, deptSnap, wpSnap] = await Promise.all([
      getDoc(doc(db, 'profiles', profileId)),
      simpleEmp.department_id ? getDoc(doc(db, 'departments', simpleEmp.department_id)) : Promise.resolve(null),
      simpleEmp.workplace_id ? getDoc(doc(db, 'workplaces', simpleEmp.workplace_id)) : Promise.resolve(null),
    ]);

    return {
      ...simpleEmp,
      profile: profSnap?.exists() ? ({ id: profSnap.id, ...profSnap.data() } as Profile) : undefined,
      department: deptSnap?.exists() ? ({ id: deptSnap.id, ...deptSnap.data() } as Department) : undefined,
      workplace: wpSnap?.exists() ? ({ id: wpSnap.id, ...wpSnap.data() } as Workplace) : undefined,
    };
  } catch (err) {
    if ((err as any)?.code !== 'permission-denied') { console.error('Error fetching employee by profile ID:', err); }
    return null;
  }
}

export async function getEmployeeById(id: string): Promise<Employee | null> {
  try {
    const empSnap = await getDoc(doc(db, 'employees', id));
    if (!empSnap.exists()) return null;
    const simpleEmp = { id: empSnap.id, ...empSnap.data() } as Employee;

    const [profSnap, deptSnap, wpSnap] = await Promise.all([
      simpleEmp.profile_id ? getDoc(doc(db, 'profiles', simpleEmp.profile_id)) : Promise.resolve(null),
      simpleEmp.department_id ? getDoc(doc(db, 'departments', simpleEmp.department_id)) : Promise.resolve(null),
      simpleEmp.workplace_id ? getDoc(doc(db, 'workplaces', simpleEmp.workplace_id)) : Promise.resolve(null),
    ]);

    return {
      ...simpleEmp,
      profile: profSnap?.exists() ? ({ id: profSnap.id, ...profSnap.data() } as Profile) : undefined,
      department: deptSnap?.exists() ? ({ id: deptSnap.id, ...deptSnap.data() } as Department) : undefined,
      workplace: wpSnap?.exists() ? ({ id: wpSnap.id, ...wpSnap.data() } as Workplace) : undefined,
    };
  } catch (err) {
    console.error('Error fetching employee by ID:', err);
    return null;
  }
}

export async function getEmployees(params?: {
  department_id?: string;
  workplace_id?: string;
  employment_status?: string;
  search?: string;
  organization_id?: string;
}): Promise<Employee[]> {
  const { department_id, workplace_id, employment_status, search, organization_id } = params || {};

  try {
    const [empSnap, profSnap, deptSnap, wpSnap] = await Promise.all([
      getDocs(collection(db, 'employees')),
      getDocs(collection(db, 'profiles')),
      getDocs(collection(db, 'departments')),
      getDocs(collection(db, 'workplaces')),
    ]);

    const profMap = new Map<string, Profile>();
    profSnap.forEach((d) => profMap.set(d.id, { id: d.id, ...d.data() } as Profile));

    const deptMap = new Map<string, Department>();
    deptSnap.forEach((d) => deptMap.set(d.id, { id: d.id, ...d.data() } as Department));

    const wpMap = new Map<string, Workplace>();
    wpSnap.forEach((d) => wpMap.set(d.id, { id: d.id, ...d.data() } as Workplace));

    const employees: Employee[] = [];
    empSnap.forEach((d) => {
      const emp = { id: d.id, ...d.data() } as Employee;
      emp.profile = emp.profile_id ? profMap.get(emp.profile_id) : undefined;
      emp.department = emp.department_id ? deptMap.get(emp.department_id) : undefined;
      emp.workplace = emp.workplace_id ? wpMap.get(emp.workplace_id) : undefined;
      employees.push(emp);
    });

    let results = employees;

    if (department_id) {
      results = results.filter((e) => e.department_id === department_id);
    }
    if (workplace_id) {
      results = results.filter((e) => e.workplace_id === workplace_id);
    }
    if (employment_status) {
      results = results.filter((e) => e.employment_status === employment_status);
    }
    if (organization_id) {
      results = results.filter(
        (e) =>
          e.organization_id === organization_id ||
          e.profile?.organization_id === organization_id ||
          e.workplace?.organization_id === organization_id ||
          e.department?.organization_id === organization_id ||
          (organization_id === 'shanti-memorial-hospital' &&
            (e.organization_id === 'smh' || e.profile?.organization_id === 'smh'))
      );
    }
    if (search) {
      const s = search.toLowerCase();
      results = results.filter(
        (e) =>
          e.profile?.full_name?.toLowerCase().includes(s) ||
          e.designation?.toLowerCase().includes(s) ||
          e.employee_code?.toLowerCase().includes(s) ||
          e.profile?.email?.toLowerCase().includes(s)
      );
    }

    return results;
  } catch (err) {
    console.error('getEmployees error:', err);
    return [];
  }
}

export async function getDirectory(search?: string, departmentId?: string, organizationId?: string): Promise<Employee[]> {
  const emps = await getEmployees({
    department_id: departmentId,
    search,
    organization_id: organizationId,
  });

  return emps.filter((e) => e.employment_status !== 'terminated');
}

export async function getAllEmployees(organizationId?: string): Promise<Employee[]> {
  return getEmployees(organizationId ? { organization_id: organizationId } : undefined);
}

export async function createEmployee(params: {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  role?: string;
  organization_id: string;
  employee_code: string;
  department_id?: string;
  manager_id?: string;
  designation?: string;
  basic_salary?: number;
  workplace_id?: string;
  default_shift_id?: string;
  tax_config?: any;
    is_hhc_enabled?: boolean;
}): Promise<void> {
  const cleanEmail = params.email.trim().toLowerCase();
  let uid = generateUuid();
  const resolvedOrgId = params.organization_id || '00000000-0000-0000-0000-000000000001';

  // Check if profile exists by email
  const profQuery = query(collection(db, 'profiles'), where('email', '==', cleanEmail), limit(1));
  const profSnap = await getDocs(profQuery);

  if (!profSnap.empty) {
    uid = profSnap.docs[0].id;
  } else {
    try {
      const defaultPassword = params.password?.trim() || 'Welcome@123';
      const cred = await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, defaultPassword);
      if (cred.user?.uid) {
        uid = cred.user.uid;
        await fbUpdateProfile(cred.user, { displayName: params.full_name });
        try {
          await sendPasswordResetEmail(secondaryAuth, cleanEmail);
        } catch (e) {
          console.warn('Could not send password reset email', e);
        }
        await secondaryAuth.signOut(); // Prevent accumulating state
      }
    } catch (authErr: any) {
      console.warn('Firebase Auth employee pre-registration notice:', authErr?.message || authErr);
    }
  }

  const now = new Date().toISOString();

  // Create or update Profile (enforcing password change on first login)
  const profPayload: Profile = {
    id: uid,
    full_name: params.full_name,
    email: cleanEmail,
    role: (params.role as any) || 'employee',
    organization_id: resolvedOrgId,
    phone: params.phone || null,
    avatar_url: null,
    is_active: true,
    needs_password_change: true,
    must_change_password: true,
    is_hhc_enabled: params.is_hhc_enabled ?? false,
    created_at: now,
    updated_at: now,
  };

  await setDoc(doc(db, 'profiles', uid), profPayload);

  // Create Employee
  const empId = `emp-${Date.now()}`;
  const empPayload: Employee = {
    id: empId,
    profile_id: uid,
    organization_id: resolvedOrgId,
    employee_code: params.employee_code,
    department_id: params.department_id || null,
    manager_id: params.manager_id || null,
    workplace_id: params.workplace_id || null,
    default_shift_id: params.default_shift_id || null,
    employment_status: 'active',
    joining_date: now.split('T')[0],
    designation: params.designation || null,
    basic_salary: params.basic_salary || 0,
    tax_config: params.tax_config || null,
    onboarding_completed: false,
    is_hhc_enabled: params.is_hhc_enabled ?? false,
    created_at: now,
    updated_at: now,
  };

  await setDoc(doc(db, 'employees', empId), empPayload);

  // Link initial shift to employee_shifts roster
  if (params.default_shift_id) {
    const today = now.split('T')[0];
    const shiftDocId = `${empId}_${today}`;
    await setDoc(doc(db, 'employee_shifts', shiftDocId), {
      id: shiftDocId,
      employee_id: empId,
      date: today,
      shift_id: params.default_shift_id,
      organization_id: resolvedOrgId,
      created_at: now,
    });
  }

  // Send Welcome Email
  try {
    const { sendWelcomeEmail } = await import('./resend');
    let deptName = '';
    let wpName = '';
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

    await sendWelcomeEmail(
      params.email,
      params.full_name || 'Team Member',
      params.employee_code,
      params.designation || 'Staff',
      {
        organizationId: resolvedOrgId,
        department: deptName,
        workplace: wpName,
        designation: params.designation || 'Staff',
        temporaryPassword: params.password?.trim() || 'Welcome@123',
      }
    );
  } catch (mailErr) {
    console.warn('Resend welcome notification dispatch warning:', mailErr);
  }
}

export async function updateEmployee(id: string, updates: Record<string, any>): Promise<void> {
  const payload = { ...updates, updated_at: new Date().toISOString() };
  await updateDoc(doc(db, 'employees', id), payload);
  if (updates.is_hhc_enabled !== undefined) {
    try {
      const empSnap = await getDoc(doc(db, 'employees', id));
      const profId = empSnap.data()?.profile_id;
      if (profId) {
        await updateDoc(doc(db, 'profiles', profId), {
          is_hhc_enabled: updates.is_hhc_enabled,
          updated_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.warn('Could not sync profile is_hhc_enabled:', err);
    }
  }
}

export async function getHHCDoctors(organizationId?: string): Promise<Employee[]> {
  try {
    const snap = await getDocs(collection(db, 'employees'));
    const list: Employee[] = [];
    snap.forEach((d) => {
      const data = d.data() as Employee;
      if (data.is_hhc_enabled) {
        list.push({ id: d.id, ...data });
      }
    });
    return list;
  } catch (e) {
    console.error('getHHCDoctors error:', e);
    return [];
  }
}

export async function completeOnboarding(
  employeeId: string,
  profileId: string,
  data: {
    home_address: string;
    bank_details: { bank_name: string; account_number: string; routing_number: string };
    emergency_contact: { name: string; phone: string; relationship: string };
  },
  avatarUrl?: string
) {
  const now = new Date().toISOString();
  await updateDoc(doc(db, 'employees', employeeId), {
    ...data,
    onboarding_completed: true,
    updated_at: now,
  });

  if (avatarUrl) {
    await updateDoc(doc(db, 'profiles', profileId), {
      avatar_url: avatarUrl,
      updated_at: now,
    });
  }
}

export async function getDepartments(organizationId?: string): Promise<Department[]> {
  try {
    const snap = await getDocs(collection(db, 'departments'));
    const depts: Department[] = [];
    snap.forEach((d) => {
      const dept = { id: d.id, ...d.data() } as Department;
      if (!organizationId || dept.organization_id === organizationId || (organizationId === 'shanti-memorial-hospital' && dept.organization_id === 'smh')) {
        depts.push(dept);
      }
    });

    depts.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return depts;
  } catch (err) {
    console.error('getDepartments error:', err);
    return [];
  }
}

export async function getDepartmentsWithStats(organizationId?: string): Promise<Department[]> {
  try {
    const [departments, employees] = await Promise.all([
      getDepartments(organizationId),
      getEmployees(organizationId ? { organization_id: organizationId } : undefined),
    ]);

    for (const dept of departments) {
      const deptEmps = employees.filter((e) => e.department_id === dept.id);
      dept.employee_count = deptEmps.length;

      if (dept.manager_id) {
        dept.manager = employees.find((e) => e.id === dept.manager_id);
      }
    }

    return departments;
  } catch (err) {
    console.error('getDepartmentsWithStats error:', err);
    return [];
  }
}

export async function createDepartment(params: {
  organization_id: string;
  name: string;
  description?: string;
  manager_id?: string | null;
}): Promise<Department> {
  const deptId = `dept-${Date.now()}`;
  const now = new Date().toISOString();
  const dept: Department = {
    id: deptId,
    organization_id: params.organization_id,
    name: params.name,
    description: params.description || null,
    manager_id: params.manager_id || null,
    created_at: now,
  };

  await setDoc(doc(db, 'departments', deptId), dept);
  return dept;
}

export async function updateDepartment(
  id: string,
  updates: Partial<Pick<Department, 'name' | 'description' | 'manager_id'>>
): Promise<void> {
  await updateDoc(doc(db, 'departments', id), updates);
}

export async function deleteDepartment(id: string): Promise<void> {
  await deleteDoc(doc(db, 'departments', id));
}

export async function updateReportingManager(employeeId: string, managerId: string | null): Promise<void> {
  await updateDoc(doc(db, 'employees', employeeId), {
    manager_id: managerId,
    updated_at: new Date().toISOString(),
  });
}

export async function getOrgHierarchy(organizationId?: string): Promise<Employee[]> {
  const allEmployees = await getEmployees(organizationId ? { organization_id: organizationId } : undefined);

  const empMap = new Map<string, Employee>();
  for (const e of allEmployees) {
    e.direct_reports = [];
    empMap.set(e.id, e);
  }

  for (const e of allEmployees) {
    if (e.manager_id && empMap.has(e.manager_id)) {
      const manager = empMap.get(e.manager_id);
      if (manager) {
        manager.direct_reports = manager.direct_reports || [];
        manager.direct_reports.push(e);
      }
    }
  }

  return allEmployees;
}

export async function getWorkplaces(organizationId?: string): Promise<Workplace[]> {
  try {
    const snap = await getDocs(collection(db, 'workplaces'));
    const wps: Workplace[] = [];
    snap.forEach((d) => {
      const wp = { id: d.id, ...d.data() } as Workplace;
      if (!organizationId || wp.organization_id === organizationId || (organizationId === 'shanti-memorial-hospital' && wp.organization_id === 'smh')) {
        wps.push(wp);
      }
    });

    wps.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return wps;
  } catch (err) {
    console.error('getWorkplaces error:', err);
    return [];
  }
}

export async function createWorkplace(params: {
  organization_id: string;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
}): Promise<Workplace> {
  const wpId = `wp-${Date.now()}`;
  const now = new Date().toISOString();
  const wp: Workplace = {
    id: wpId,
    organization_id: params.organization_id,
    name: params.name,
    address: params.address || '',
    latitude: params.latitude,
    longitude: params.longitude,
    radius_meters: params.radius_meters,
    is_active: true,
    created_at: now,
  };

  await setDoc(doc(db, 'workplaces', wpId), wp);
  return wp;
}

export async function updateWorkplace(id: string, updates: Partial<Workplace>): Promise<void> {
  await updateDoc(doc(db, 'workplaces', id), updates);
}

export async function getEmployeeCount(organizationId?: string): Promise<number> {
  try {
    let q = query(collection(db, 'profiles'), where('is_active', '==', true));
    if (organizationId) {
      q = query(collection(db, 'profiles'), where('organization_id', '==', organizationId), where('is_active', '==', true));
    }
    const snap = await getDocs(q);
    return snap.size;
  } catch (e) {
    const emps = await getEmployees(organizationId ? { organization_id: organizationId, employment_status: 'active' } : { employment_status: 'active' });
    return emps.length;
  }
}
