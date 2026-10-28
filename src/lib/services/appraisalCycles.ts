import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { exportExcel, importExcelObjects } from '@/utils/excel';
import { getEmployees } from '@/lib/services/employee';
import type { AppraisalReview, AppraisalKpi } from '@/types';

export interface AppraisalQuestion {
  id: string;
  question: string;
  category: string;
  weightage: number; // Percentage, e.g. 20
  max_score: number; // e.g. 5 or 10
  description?: string;
}

export type AppraisalCycleType = 'annual' | 'half_yearly' | 'quarterly' | 'probation';
export type AppraisalCycleStatus = 'draft' | 'scheduled' | 'active' | 'closed';

export interface AppraisalCycle {
  id: string;
  organization_id: string;
  name: string;
  cycle_type: AppraisalCycleType;
  review_period: string; // e.g. "Q1 2026", "Jan 2026 - Dec 2026"
  start_date: string;
  self_review_deadline: string;
  manager_review_deadline: string;
  target_unit?: string; // 'All Units' or specific unit
  target_department_id?: string | null;
  status: AppraisalCycleStatus;
  questions: AppraisalQuestion[];
  total_questions: number;
  total_weightage: number;
  created_at: string;
  updated_at: string;
}

export const SAMPLE_APPRAISAL_QUESTIONS: AppraisalQuestion[] = [
  {
    id: 'q_tech_exec',
    question: 'Technical Execution & Functional Competency',
    category: 'Functional Competency',
    weightage: 25,
    max_score: 5,
    description: 'Demonstrates deep functional role knowledge, delivers high-quality output, and troubleshoots operational roadblocks independently.',
  },
  {
    id: 'q_prod_delivery',
    question: 'Productivity, Delivery & Deadline Compliance',
    category: 'Operational Output',
    weightage: 25,
    max_score: 5,
    description: 'Consistently meets project milestones, manages workload efficiently, and complies with scheduled work rosters and delivery timelines.',
  },
  {
    id: 'q_team_collab',
    question: 'Teamwork, Cross-Functional Collaboration & Ethics',
    category: 'Culture & Collaboration',
    weightage: 20,
    max_score: 5,
    description: 'Fosters team spirit, actively assists colleagues across units, communicates with clarity, and strictly adheres to organizational code of conduct.',
  },
  {
    id: 'q_problem_solve',
    question: 'Ownership, Problem Solving & Continuous Improvement',
    category: 'Initiative & Leadership',
    weightage: 15,
    max_score: 5,
    description: 'Takes proactive ownership beyond assigned tasks, proposes process enhancements, and demonstrates resilience when facing unexpected challenges.',
  },
  {
    id: 'q_client_stakeholder',
    question: 'Client & Stakeholder Responsiveness',
    category: 'Customer & Quality',
    weightage: 15,
    max_score: 5,
    description: 'Maintains highest service standards, prioritizes customer/stakeholder needs, and handles escalations with empathy and professional tact.',
  },
];

/**
 * Fetch all appraisal cycles for an organization.
 */
export async function getAppraisalCycles(organizationId: string): Promise<AppraisalCycle[]> {
  try {
    const q = query(
      collection(db, 'appraisal_cycles'),
      where('organization_id', '==', organizationId)
    );
    const snap = await getDocs(q);
    const cycles: AppraisalCycle[] = [];
    snap.forEach((d) => {
      cycles.push({ id: d.id, ...d.data() } as AppraisalCycle);
    });
    cycles.sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''));
    return cycles;
  } catch (err) {
    console.error('getAppraisalCycles error:', err);
    return [];
  }
}

/**
 * Create a new scheduled appraisal cycle.
 */
export async function createAppraisalCycle(
  data: Omit<AppraisalCycle, 'id' | 'created_at' | 'updated_at'>
): Promise<AppraisalCycle> {
  const cycleId = `cycle_${Date.now()}`;
  const now = new Date().toISOString();
  const totalWeight = data.questions.reduce((sum, q) => sum + (Number(q.weightage) || 0), 0);

  const payload: AppraisalCycle = {
    ...data,
    id: cycleId,
    total_questions: data.questions.length,
    total_weightage: totalWeight,
    created_at: now,
    updated_at: now,
  };

  await setDoc(doc(db, 'appraisal_cycles', cycleId), payload);
  return payload;
}

/**
 * Update an existing appraisal cycle.
 */
export async function updateAppraisalCycle(
  cycleId: string,
  updates: Partial<AppraisalCycle>
): Promise<void> {
  const payload: any = {
    ...updates,
    updated_at: new Date().toISOString(),
  };
  if (updates.questions) {
    payload.total_questions = updates.questions.length;
    payload.total_weightage = updates.questions.reduce((sum, q) => sum + (Number(q.weightage) || 0), 0);
  }
  await updateDoc(doc(db, 'appraisal_cycles', cycleId), payload);
}

/**
 * Delete an appraisal cycle.
 */
export async function deleteAppraisalCycle(cycleId: string): Promise<void> {
  await deleteDoc(doc(db, 'appraisal_cycles', cycleId));
}

/**
 * Download a formatted Excel template with example appraisal questions.
 */
export async function downloadAppraisalQuestionsTemplate(): Promise<boolean> {
  const headers = [
    'Question / KPI Statement',
    'Category / Pillar',
    'Weightage (%)',
    'Max Score',
    'Description / Scoring Rubric',
  ];

  const rows = SAMPLE_APPRAISAL_QUESTIONS.map((q) => [
    q.question,
    q.category,
    q.weightage,
    q.max_score,
    q.description || '',
  ]);

  const instructions = [
    ['Appraisal Questions Excel Template Instructions'],
    [''],
    ['Column', 'Required', 'Description / Valid Values'],
    ['Question / KPI Statement', 'Yes', 'The specific competency or KPI statement being assessed (e.g. Technical Execution, Productivity).'],
    ['Category / Pillar', 'Yes', 'Grouping category (e.g. Functional Competency, Operational Output, Culture, Leadership).'],
    ['Weightage (%)', 'Yes', 'Numeric weight in percentage (e.g. 20 for 20%). The total across all questions should ideally equal 100%.'],
    ['Max Score', 'No', 'Maximum rating points for this question (Default: 5).'],
    ['Description / Scoring Rubric', 'No', 'Guidelines on what score 1 (Needs Improvement) to score 5 (Exceeds Expectations) represents.'],
    [''],
    ['Tips:'],
    ['• You can add as many rows as needed for your organization review criteria.'],
    ['• Keep question names concise and clear for both employees and reviewing managers.'],
  ];

  return await exportExcel('Appraisal_Questions_Template', [
    { name: 'Appraisal_Questions', headers, rows },
    { name: 'Instructions', rows: instructions },
  ]);
}

/**
 * Import and parse appraisal questions from an uploaded Excel file.
 */
export async function importAppraisalQuestionsFromExcel(): Promise<{
  questions: AppraisalQuestion[];
  warnings: string[];
} | null> {
  const sheets = await importExcelObjects();
  if (!sheets) return null;

  // Find sheet: either named 'Appraisal_Questions', 'Questions', or first non-instructions sheet
  const sheetNames = Object.keys(sheets);
  let targetSheetName = sheetNames.find(
    (s) => s.toLowerCase().includes('question') || s.toLowerCase().includes('kpi')
  );
  if (!targetSheetName) {
    targetSheetName = sheetNames.find((s) => !s.toLowerCase().includes('instruction')) || sheetNames[0];
  }

  const rawRows: any[] = sheets[targetSheetName] || [];
  if (rawRows.length === 0) {
    throw new Error('No question rows found in the uploaded spreadsheet.');
  }

  const questions: AppraisalQuestion[] = [];
  const warnings: string[] = [];

  rawRows.forEach((row, idx) => {
    // Read possible variations of column headers
    const questionText =
      row['Question / KPI Statement'] ||
      row['Question'] ||
      row['KPI Statement'] ||
      row['Criteria'] ||
      row['Title'] ||
      '';

    if (!questionText || String(questionText).trim() === '') {
      return; // Skip empty rows
    }

    const category =
      row['Category / Pillar'] ||
      row['Category'] ||
      row['Pillar'] ||
      'General Competencies';

    const weightageVal = parseFloat(row['Weightage (%)'] || row['Weightage'] || row['Weight'] || '20');
    const weightage = isNaN(weightageVal) || weightageVal <= 0 ? 20 : weightageVal;

    const maxScoreVal = parseInt(row['Max Score'] || row['Max Points'] || row['Scale'] || '5', 10);
    const max_score = isNaN(maxScoreVal) || maxScoreVal <= 0 ? 5 : maxScoreVal;

    const description =
      row['Description / Scoring Rubric'] ||
      row['Description'] ||
      row['Rubric'] ||
      '';

    questions.push({
      id: `q_import_${idx + 1}_${Date.now()}`,
      question: String(questionText).trim(),
      category: String(category).trim(),
      weightage,
      max_score,
      description: String(description).trim(),
    });
  });

  if (questions.length === 0) {
    throw new Error('Could not identify valid appraisal questions from the uploaded file.');
  }

  const totalWeight = questions.reduce((sum, q) => sum + q.weightage, 0);
  if (Math.round(totalWeight) !== 100) {
    warnings.push(`Total question weightage sums to ${Math.round(totalWeight)}% (recommended: 100%).`);
  }

  return { questions, warnings };
}

/**
 * Launch an appraisal cycle and provision appraisal review drafts for targeted employees.
 */
export async function launchAppraisalCycle(
  cycle: AppraisalCycle,
  organizationId: string
): Promise<{ initiatedCount: number; message: string }> {
  // 1. Mark cycle as active
  await updateAppraisalCycle(cycle.id, { status: 'active' });

  // 2. Fetch eligible employees
  const allEmployees = await getEmployees({ organization_id: organizationId });
  const eligibleEmployees = allEmployees.filter((emp) => {
    if (emp.employment_status !== 'active') return false;
    if (cycle.target_department_id && emp.department_id !== cycle.target_department_id) {
      return false;
    }
    if (cycle.target_unit && cycle.target_unit !== 'All Units' && emp.hospital_unit !== cycle.target_unit) {
      return false;
    }
    return true;
  });

  // 3. Convert cycle questions to AppraisalKpi format
  const mappedKpis: AppraisalKpi[] = cycle.questions.map((q) => ({
    id: q.id,
    name: q.question,
    description: q.description || q.category,
    weight: q.weightage,
    self_score: null,
    manager_score: null,
  }));

  // 4. Batch create appraisal reviews in Firestore
  let initiatedCount = 0;
  const now = new Date().toISOString();

  for (const emp of eligibleEmployees) {
    const reviewId = `rev_${cycle.id}_${emp.id}`;
    // Check if review already exists for this cycle + employee
    const existingSnap = await getDoc(doc(db, 'appraisal_reviews', reviewId));
    if (!existingSnap.exists()) {
      const reviewPayload: any = {
        id: reviewId,
        cycle_id: cycle.id,
        cycle_name: cycle.name,
        cycle_period: cycle.review_period,
        employee_id: emp.id,
        reviewer_id: emp.manager_id || emp.l1_manager_id || null,
        status: 'self_review',
        self_score: null,
        self_comments: null,
        manager_score: null,
        manager_comments: null,
        overall_score: null,
        recommendation: null,
        custom_kpis: mappedKpis,
        created_at: now,
        updated_at: now,
      };

      await setDoc(doc(db, 'appraisal_reviews', reviewId), reviewPayload);
      initiatedCount++;
    }
  }

  return {
    initiatedCount,
    message: `Appraisal cycle launched successfully. Generated reviews for ${initiatedCount} eligible employees.`,
  };
}
