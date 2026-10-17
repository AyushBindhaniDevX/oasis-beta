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
} from 'firebase/firestore';
import type {
  Goal,
  KeyResult,
  AppraisalReview,
  PerformanceRatingBreakdown,
  Kudos,
  KudosBadge,
  AppraisalRecommendation,
  Employee,
  Profile,
  Department,
} from '@/types';
import { createAuditLog } from './audit';
import { createNotification } from './notifications';

const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';

export async function getGoals(options?: {
  employeeId?: string;
  departmentId?: string;
  category?: string;
  status?: string;
  organizationId?: string;
}): Promise<Goal[]> {
  try {
    const [goalsSnap, empsSnap, profsSnap, deptsSnap] = await Promise.all([
      getDocs(collection(db, 'goals')),
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
      empMap.set(d.id, emp);
    });

    const goals: Goal[] = [];
    goalsSnap.forEach((d) => {
      const g = { id: d.id, ...d.data() } as Goal;
      if (options?.employeeId && g.employee_id !== options.employeeId) return;
      if (options?.departmentId && g.department_id !== options.departmentId) return;
      if (options?.category && g.category !== options.category) return;
      if (options?.status && g.status !== options.status) return;
      if (options?.organizationId && g.organization_id && g.organization_id !== options.organizationId) return;

      g.employee = g.employee_id ? empMap.get(g.employee_id) : undefined;
      g.department = g.department_id ? deptMap.get(g.department_id) : undefined;
      goals.push(g);
    });

    goals.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    return goals;
  } catch (err) {
    console.error('getGoals error:', err);
    return [];
  }
}

export async function createGoal(
  data: Omit<Goal, 'id' | 'created_at' | 'updated_at'>,
  userId?: string
): Promise<Goal> {
  const goalId = `goal_${Date.now()}`;
  const now = new Date().toISOString();
  const goal: Goal = {
    ...data,
    id: goalId,
    created_at: now,
    updated_at: now,
  };

  await setDoc(doc(db, 'goals', goalId), goal);

  await createAuditLog('CREATE_GOAL', 'goal', goalId, {
    title: goal.title,
    category: goal.category,
    priority: goal.priority,
  });

  return goal;
}

export async function deleteGoal(goalId: string, userId?: string): Promise<boolean> {
  try {
    await deleteDoc(doc(db, 'goals', goalId));
    if (userId) {
      await createAuditLog('DELETE_GOAL', 'goal', goalId, { deleted_by: userId });
    }
    return true;
  } catch {
    return false;
  }
}

export async function updateGoal(
  id: string,
  data: Partial<Goal>,
  userId?: string
): Promise<Goal> {
  const now = new Date().toISOString();
  await updateDoc(doc(db, 'goals', id), { ...data, updated_at: now });
  const snap = await getDoc(doc(db, 'goals', id));
  return { id: snap.id, ...snap.data() } as Goal;
}

export async function updateKeyResult(
  goalId: string,
  krId: string,
  currentValue: number,
  userId?: string
): Promise<Goal> {
  const snap = await getDoc(doc(db, 'goals', goalId));
  if (!snap.exists()) throw new Error('Goal not found');
  const goal = snap.data() as Goal;

  const keyResults = (goal.key_results || []).map((kr: KeyResult) => {
    if (kr.id === krId) {
      const completed = currentValue >= kr.target_value;
      return { ...kr, current_value: currentValue, completed };
    }
    return kr;
  });

  const completedCount = keyResults.filter((kr: KeyResult) => kr.completed).length;
  const progress = keyResults.length > 0 ? Math.round((completedCount / keyResults.length) * 100) : 0;
  const status = progress === 100 ? 'completed' : progress > 0 ? 'on_track' : goal.status;

  return updateGoal(goalId, { key_results: keyResults, progress, status }, userId);
}

export async function getAppraisals(options?: {
  employeeId?: string;
  status?: string;
  period?: string;
  organizationId?: string;
}): Promise<AppraisalReview[]> {
  try {
    const [appSnap, empsSnap, profsSnap] = await Promise.all([
      getDocs(collection(db, 'appraisal_reviews')),
      getDocs(collection(db, 'employees')),
      getDocs(collection(db, 'profiles')),
    ]);

    const profMap = new Map<string, Profile>();
    profsSnap.forEach((d) => profMap.set(d.id, { id: d.id, ...d.data() } as Profile));

    const empMap = new Map<string, Employee>();
    empsSnap.forEach((d) => {
      const emp = { id: d.id, ...d.data() } as Employee;
      emp.profile = emp.profile_id ? profMap.get(emp.profile_id) : undefined;
      empMap.set(d.id, emp);
    });

    const appraisals: AppraisalReview[] = [];
    appSnap.forEach((d) => {
      const a = { id: d.id, ...d.data() } as AppraisalReview;
      if (options?.employeeId && a.employee_id !== options.employeeId) return;
      if (options?.status && a.status !== options.status) return;
      if (options?.period && a.period !== options.period) return;
      if (options?.organizationId && a.organization_id && a.organization_id !== options.organizationId) return;

      a.employee = a.employee_id ? empMap.get(a.employee_id) : undefined;
      a.reviewer = a.reviewer_id ? profMap.get(a.reviewer_id) : undefined;
      appraisals.push(a);
    });

    appraisals.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    return appraisals;
  } catch (err) {
    console.error('getAppraisals error:', err);
    return [];
  }
}

export async function createAppraisal(
  data: Omit<AppraisalReview, 'id' | 'created_at' | 'updated_at'>,
  userId?: string
): Promise<AppraisalReview> {
  const appId = `app_${Date.now()}`;
  const now = new Date().toISOString();
  const appraisal: AppraisalReview = {
    ...data,
    id: appId,
    created_at: now,
    updated_at: now,
  };

  await setDoc(doc(db, 'appraisal_reviews', appId), appraisal);

  await createAuditLog('INITIATE_APPRAISAL', 'appraisal_review', appId, {
    cycle: appraisal.cycle_name,
    employee_id: appraisal.employee_id,
  });

  return appraisal;
}

export async function submitSelfReview(
  id: string,
  data: {
    self_rating: number;
    self_comments: string;
    ratings_breakdown?: PerformanceRatingBreakdown;
  },
  userId?: string
): Promise<void> {
  const now = new Date().toISOString();
  await updateDoc(doc(db, 'appraisal_reviews', id), {
    self_rating: data.self_rating,
    self_comments: data.self_comments,
    ratings_breakdown: data.ratings_breakdown || null,
    self_submitted_at: now,
    status: 'manager_review',
    updated_at: now,
  });

  await createAuditLog('SUBMIT_SELF_APPRAISAL', 'appraisal_review', id, {
    rating: data.self_rating,
  });
}

export async function submitManagerReview(
  id: string,
  data: {
    manager_rating: number;
    manager_comments: string;
    overall_score: number;
    recommendation: AppraisalRecommendation;
    ratings_breakdown?: PerformanceRatingBreakdown;
    reviewer_id: string;
  },
  employeeProfileId?: string
): Promise<void> {
  const now = new Date().toISOString();
  await updateDoc(doc(db, 'appraisal_reviews', id), {
    manager_rating: data.manager_rating,
    manager_comments: data.manager_comments,
    overall_score: data.overall_score,
    recommendation: data.recommendation,
    ratings_breakdown: data.ratings_breakdown || null,
    reviewer_id: data.reviewer_id,
    manager_submitted_at: now,
    status: 'completed',
    updated_at: now,
  });

  await createAuditLog('COMPLETE_MANAGER_APPRAISAL', 'appraisal_review', id, {
    rating: data.manager_rating,
    overall_score: data.overall_score,
    recommendation: data.recommendation,
  });

  if (employeeProfileId) {
    await createNotification(
      employeeProfileId,
      'performance',
      'Appraisal Review Completed',
      `Your appraisal review has been finalized with an overall score of ${data.overall_score}/100.`
    );
  }
}

export async function getKudos(): Promise<Kudos[]> {
  try {
    const [kudosSnap, profsSnap] = await Promise.all([
      getDocs(collection(db, 'kudos')),
      getDocs(collection(db, 'profiles')),
    ]);

    const profMap = new Map<string, Profile>();
    profsSnap.forEach((d) => profMap.set(d.id, { id: d.id, ...d.data() } as Profile));

    const kudosList: Kudos[] = [];
    kudosSnap.forEach((d) => {
      const k = { id: d.id, ...d.data() } as Kudos;
      k.sender = k.sender_id ? profMap.get(k.sender_id) : undefined;
      k.receiver = k.receiver_id ? profMap.get(k.receiver_id) : undefined;
      kudosList.push(k);
    });

    kudosList.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    return kudosList;
  } catch (err) {
    console.error('getKudos error:', err);
    return [];
  }
}

export async function sendKudos(data: {
  sender_id: string;
  receiver_id: string;
  badge: KudosBadge;
  message: string;
  sender_name?: string;
}): Promise<Kudos> {
  const kudosId = `kudos_${Date.now()}`;
  const now = new Date().toISOString();
  const kudos: Kudos = {
    id: kudosId,
    organization_id: DEFAULT_ORG_ID,
    sender_id: data.sender_id,
    receiver_id: data.receiver_id,
    badge: data.badge,
    message: data.message,
    created_at: now,
  };

  await setDoc(doc(db, 'kudos', kudosId), kudos);

  await createNotification(
    data.receiver_id,
    'kudos',
    'New Kudos Received',
    `${data.sender_name || 'A teammate'} sent you a "${data.badge.toUpperCase()}" badge: "${data.message}"`
  );

  return kudos;
}

export interface HospitalAppraisalParameter {
  id: string;
  name: string;
  category: string;
  weightage_percent: number;
  description: string;
}

export const DEFAULT_HOSPITAL_APPRAISAL_PARAMS: HospitalAppraisalParameter[] = [
  {
    id: 'param_clinical',
    name: 'Clinical Competence & Patient Care Quality',
    category: 'Core Clinical',
    weightage_percent: 25,
    description: 'Adherence to treatment protocols, diagnostic accuracy, bedside manner, and clinical outcomes.',
  },
  {
    id: 'param_punctuality',
    name: 'Punctuality, Shift Adherence & Attendance',
    category: 'Operational',
    weightage_percent: 20,
    description: 'Adherence to assigned 8-hour duty roster, biometric compliance, and shift handover punctuality.',
  },
  {
    id: 'param_nabh',
    name: 'Patient Safety, NABH Protocols & Infection Control',
    category: 'Compliance',
    weightage_percent: 20,
    description: 'Strict adherence to NABH guidelines, hygiene standards, sterile protocols, and incident reporting.',
  },
  {
    id: 'param_teamwork',
    name: 'Team Collaboration & Inter-Departmental Coordination',
    category: 'Behavioral',
    weightage_percent: 20,
    description: 'Cross-functional teamwork between doctors, nursing, administration, billing, and support departments.',
  },
  {
    id: 'param_documentation',
    name: 'Medical Documentation & Administrative Integrity',
    category: 'Administrative',
    weightage_percent: 15,
    description: 'Accurate and timely patient file documentation, discharge summary completion, and statutory record keeping.',
  },
];

export async function getHospitalAppraisalParameters(orgId?: string): Promise<HospitalAppraisalParameter[]> {
  try {
    const docId = `appraisal_config_${orgId || DEFAULT_ORG_ID}`;
    const snap = await getDoc(doc(db, 'hospital_appraisal_configs', docId));
    if (snap.exists() && Array.isArray(snap.data()?.parameters)) {
      return snap.data().parameters;
    }
  } catch (e) {
    console.warn('Error reading hospital appraisal parameters:', e);
  }
  return DEFAULT_HOSPITAL_APPRAISAL_PARAMS;
}

export async function saveHospitalAppraisalParameters(
  orgId: string,
  parameters: HospitalAppraisalParameter[]
): Promise<void> {
  const docId = `appraisal_config_${orgId || DEFAULT_ORG_ID}`;
  await setDoc(doc(db, 'hospital_appraisal_configs', docId), {
    id: docId,
    organization_id: orgId || DEFAULT_ORG_ID,
    parameters,
    updated_at: new Date().toISOString(),
  });
}

export interface ConsolidatedAppraisalRow {
  employee_id: string;
  employee_code: string;
  employee_name: string;
  department: string;
  designation: string;
  cycle_name: string;
  period: string;
  self_rating: number;
  manager_rating: number;
  overall_score: number;
  recommendation: string;
  reviewer_name: string;
  status: string;
  submitted_at: string;
}

export async function getConsolidatedAppraisalReport(
  orgId?: string,
  cycle?: string
): Promise<ConsolidatedAppraisalRow[]> {
  const [appraisals, employeesSnap, profsSnap, deptsSnap] = await Promise.all([
    getAppraisals({ organizationId: orgId, period: cycle }),
    getDocs(collection(db, 'employees')),
    getDocs(collection(db, 'profiles')),
    getDocs(collection(db, 'departments')),
  ]);

  const profMap = new Map<string, Profile>();
  profsSnap.forEach((d) => profMap.set(d.id, { id: d.id, ...d.data() } as Profile));

  const deptMap = new Map<string, Department>();
  deptsSnap.forEach((d) => deptMap.set(d.id, { id: d.id, ...d.data() } as Department));

  const empMap = new Map<string, Employee>();
  employeesSnap.forEach((d) => {
    const emp = { id: d.id, ...d.data() } as Employee;
    emp.profile = emp.profile_id ? profMap.get(emp.profile_id) : undefined;
    emp.department = emp.department_id ? deptMap.get(emp.department_id) : undefined;
    empMap.set(d.id, emp);
  });

  const appMap = new Map<string, AppraisalReview>();
  appraisals.forEach((a) => {
    appMap.set(a.employee_id, a);
  });

  const rows: ConsolidatedAppraisalRow[] = [];
  empMap.forEach((emp) => {
    if (orgId && emp.organization_id && emp.organization_id !== orgId) return;
    const app = appMap.get(emp.id);

    rows.push({
      employee_id: emp.id,
      employee_code: emp.employee_code || 'SMH-000',
      employee_name: emp.profile?.full_name || 'Staff Member',
      department: emp.department?.name || 'General',
      designation: emp.designation || 'Staff',
      cycle_name: app?.cycle_name || (cycle || 'Annual 2026'),
      period: app?.period || (cycle || '2026'),
      self_rating: app?.self_rating || 0,
      manager_rating: app?.manager_rating || 0,
      overall_score: app?.overall_score || (app?.manager_rating ? Math.round(app.manager_rating * 20) : 0),
      recommendation: app?.recommendation ? app.recommendation.toUpperCase().replace(/_/g, ' ') : 'PENDING EVALUATION',
      reviewer_name: app?.reviewer?.full_name || (app?.reviewer_id ? profMap.get(app.reviewer_id)?.full_name : null) || 'Immediate HOD',
      status: app?.status ? app.status.toUpperCase().replace(/_/g, ' ') : 'NOT STARTED',
      submitted_at: app?.manager_submitted_at || app?.self_submitted_at || app?.created_at || 'N/A',
    });
  });

  rows.sort((a, b) => a.employee_code.localeCompare(b.employee_code));
  return rows;
}
