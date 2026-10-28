import { db, sanitizeFirestoreData } from '@/lib/firebase';
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';

export interface TemplateVariable {
  key: string;
  label: string;
  example: string;
}

export const TEMPLATE_VARIABLES: TemplateVariable[] = [
  { key: '{{employee_name}}', label: 'Employee Name', example: 'Alex Morgan' },
  { key: '{{employee_code}}', label: 'Employee Code', example: 'EMP-1021' },
  { key: '{{designation}}', label: 'Designation', example: 'Senior Operations Lead' },
  { key: '{{department}}', label: 'Department', example: 'Operations & Facilities' },
  { key: '{{unit}}', label: 'Unit / Sub-Brand', example: 'Headquarters Campus' },
  { key: '{{organization_name}}', label: 'Organization Name', example: 'Acme Enterprise Solutions' },
  { key: '{{joining_date}}', label: 'Joining Date', example: '15 Jan 2026' },
  { key: '{{relieving_date}}', label: 'Relieving Date', example: '31 Oct 2026' },
  { key: '{{effective_date}}', label: 'Effective Date', example: '01 Nov 2026' },
  { key: '{{basic_salary}}', label: 'Basic Salary', example: '₹25,000' },
  { key: '{{gross_salary}}', label: 'Gross Salary', example: '₹50,000' },
  { key: '{{annual_salary}}', label: 'Annual CTC', example: '₹6,00,000' },
  { key: '{{ref_number}}', label: 'Reference Number', example: 'HR/APT/2026/EMP-1021' },
  { key: '{{signatory_name}}', label: 'Signatory Name', example: 'Sarah Jenkins' },
  { key: '{{signatory_title}}', label: 'Signatory Title', example: 'Head of Human Resources' },
  { key: '{{portal_url}}', label: 'Portal URL', example: 'https://workforce.company.com' },
  { key: '{{user_email}}', label: 'User Email', example: 'alex.morgan@company.com' },
  { key: '{{temporary_password}}', label: 'Temporary Password', example: 'Welcome@123' },
  { key: '{{cycle_name}}', label: 'Appraisal Cycle Name', example: 'Annual Performance Review 2026' },
  { key: '{{self_review_deadline}}', label: 'Self Review Deadline', example: '15 Nov 2026' },
  { key: '{{manager_review_deadline}}', label: 'Manager Review Deadline', example: '30 Nov 2026' },
  { key: '{{date}}', label: 'Current Date', example: new Date().toLocaleDateString('en-GB') },
];

export interface DocumentTemplate {
  id: string;
  organization_id: string;
  key: string;
  type: 'document' | 'email';
  name: string;
  description: string;
  subject?: string;
  title?: string;
  subtitle?: string;
  salutation?: string;
  body: string;
  clauses?: string[];
  signatory_name?: string;
  signatory_title?: string;
  variables: string[];
  updated_at: string;
  updated_by?: string;
}

export const DEFAULT_TEMPLATES: Record<string, Omit<DocumentTemplate, 'id' | 'organization_id' | 'updated_at'>> = {
  appointment_letter: {
    key: 'appointment_letter',
    type: 'document',
    name: 'Official Appointment Letter',
    description: 'Issued to new hires upon joining, specifying compensation structure, duty hours, probation, and terms.',
    title: 'LETTER OF APPOINTMENT',
    subtitle: 'Workforce & Human Capital Management',
    salutation: 'Dear {{employee_name}},',
    body: 'We are pleased to offer you the position of {{designation}} at {{organization_name}} ({{unit}}). Your appointment is effective from {{joining_date}}. This letter confirms your role, reporting expectations, and compensation structure.',
    clauses: [
      '1. Role & Responsibilities: You are appointed as {{designation}} in the {{department}} department. You will report to your designated supervisor at {{unit}}.',
      '2. Compensation Structure: Your gross remuneration is ₹{{gross_salary}} per month (Basic: ₹{{basic_salary}}), subject to statutory withholdings including EPF and professional tax.',
      '3. Working Hours & Shift: You shall adhere to scheduled rotational rosters or general shifts as communicated by management.',
      '4. Probation Period: You will be on probation for a period of 6 months. Confirmation will be subject to satisfactory performance and conduct.',
      '5. Notice Period: Following confirmation, either party may terminate this employment by giving 30 calendar days notice in writing or equivalent salary in lieu thereof.',
      '6. Confidentiality & Code of Conduct: You agree to uphold company ethics, protect client and business confidential data, and comply with all organizational policies.',
    ],
    signatory_name: 'Authorized Signatory',
    signatory_title: 'Head of Human Resources',
    variables: ['{{employee_name}}', '{{designation}}', '{{organization_name}}', '{{unit}}', '{{joining_date}}', '{{department}}', '{{gross_salary}}', '{{basic_salary}}'],
  },
  offer_letter: {
    key: 'offer_letter',
    type: 'document',
    name: 'Job Offer Letter',
    description: 'Preliminary offer letter extended to prospective candidates before formal onboarding.',
    title: 'OFFER OF EMPLOYMENT',
    subtitle: 'Talent Acquisition & People Operations',
    salutation: 'Dear {{employee_name}},',
    body: 'Following our recent interview rounds, we are delighted to extend this formal offer of employment for the position of {{designation}} with {{organization_name}}.',
    clauses: [
      '1. Position & Department: You will join our team as {{designation}} in the {{department}} department based at {{unit}}.',
      '2. Annualized Compensation: Your annual Cost to Company (CTC) will be ₹{{annual_salary}} (₹{{gross_salary}} gross monthly).',
      '3. Proposed Start Date: Your anticipated date of joining is {{joining_date}}.',
      '4. Contingency: This offer is subject to satisfactory reference checks and submission of verified academic/experience credentials.',
      '5. Acceptance: Please sign and return a duplicate copy of this letter within 5 business days to confirm your acceptance.',
    ],
    signatory_name: 'Talent Acquisition Director',
    signatory_title: 'Talent Acquisition & Onboarding',
    variables: ['{{employee_name}}', '{{designation}}', '{{organization_name}}', '{{department}}', '{{unit}}', '{{annual_salary}}', '{{gross_salary}}', '{{joining_date}}'],
  },
  experience_letter: {
    key: 'experience_letter',
    type: 'document',
    name: 'Relieving & Experience Certificate',
    description: 'Official clearance and service verification letter given to departing employees.',
    title: 'EXPERIENCE & RELIEVING CERTIFICATE',
    subtitle: 'Human Resources Service Verification',
    salutation: 'TO WHOMSOEVER IT MAY CONCERN,',
    body: 'This is to certify that {{employee_name}} (Employee Code: {{employee_code}}) was employed with {{organization_name}} from {{joining_date}} to {{relieving_date}} in the {{department}} department as {{designation}}.',
    clauses: [
      'During their tenure at {{unit}}, their conduct and professional dedication were found to be satisfactory and commendable.',
      'All company assets, data handovers, and department clearance procedures have been completed with no outstanding dues.',
      'We thank {{employee_name}} for their dedicated contributions and wish them every success in their future endeavors.',
    ],
    signatory_name: 'HR Operations Lead',
    signatory_title: 'Human Resources & Compliance',
    variables: ['{{employee_name}}', '{{employee_code}}', '{{organization_name}}', '{{joining_date}}', '{{relieving_date}}', '{{department}}', '{{designation}}', '{{unit}}'],
  },
  promotion_letter: {
    key: 'promotion_letter',
    type: 'document',
    name: 'Promotion & Increment Letter',
    description: 'Issued following performance appraisal cycles to confirm promotions and revised salary scales.',
    title: 'PROMOTION & COMPENSATION REVISION',
    subtitle: 'Annual Performance Appraisal Recognition',
    salutation: 'Dear {{employee_name}},',
    body: 'In recognition of your outstanding performance, leadership, and notable contributions during the recent review period, management is pleased to announce your promotion to {{designation}}.',
    clauses: [
      '1. Effective Date: Your revised designation and compensation are effective from {{effective_date}}.',
      '2. Revised Remuneration: Your revised monthly gross remuneration will be ₹{{gross_salary}} (Basic Salary: ₹{{basic_salary}}).',
      '3. Leadership Expectations: We look forward to your continued drive in spearheading departmental objectives and guiding team members.',
    ],
    signatory_name: 'Managing Director / Executive',
    signatory_title: 'Office of Executive Leadership',
    variables: ['{{employee_name}}', '{{designation}}', '{{effective_date}}', '{{gross_salary}}', '{{basic_salary}}', '{{department}}', '{{unit}}'],
  },
  welcome_credentials: {
    key: 'welcome_credentials',
    type: 'email',
    name: 'New User Welcome & Credentials',
    description: 'Email sent when a new employee or staff login is provisioned.',
    subject: 'Welcome to {{organization_name}} — Your Oasis Portal Login Credentials',
    salutation: 'Dear {{employee_name}},',
    body: 'Welcome to {{organization_name}}!\n\nYour workforce portal account is active. You can now track your attendance, view duty shifts, request leaves, and access salary slips.\n\nYour Login Credentials:\n• Portal Link: {{portal_url}}\n• User ID / Email: {{user_email}}\n• Temporary Password: {{temporary_password}}\n• Designated Unit: {{unit}}\n\nPlease sign in, change your password immediately, and complete your biometric attendance setup.',
    variables: ['{{employee_name}}', '{{organization_name}}', '{{portal_url}}', '{{user_email}}', '{{temporary_password}}', '{{unit}}'],
  },
  appointment_issued: {
    key: 'appointment_issued',
    type: 'email',
    name: 'Appointment Letter Issued Notification',
    description: 'Email notifying an employee that their official appointment letter has been signed and issued.',
    subject: 'Official Appointment Letter Issued — {{organization_name}}',
    salutation: 'Dear {{employee_name}},',
    body: 'Congratulations! Your official Letter of Appointment has been issued by {{organization_name}} (Reference: {{ref_number}}).\n\nPlease find your formal document attached as a PDF. You can also view, print, or download your digitally signed appointment letter anytime from your employee self-service portal.',
    variables: ['{{employee_name}}', '{{organization_name}}', '{{ref_number}}', '{{designation}}', '{{unit}}'],
  },
  payslip_notification: {
    key: 'payslip_notification',
    type: 'email',
    name: 'Monthly Payslip Notification',
    description: 'Email sent automatically when monthly payroll registers are published.',
    subject: 'Salary Slip Released for {{month}} {{year}} — {{organization_name}}',
    salutation: 'Dear {{employee_name}},',
    body: 'Your salary slip for the month of {{month}} {{year}} has been generated and released.\n\nSummary:\n• Gross Salary: ₹{{gross_salary}}\n• Net Disbursed: ₹{{net_salary}}\n• Unit: {{unit}}\n\nYou can view and download your full breakdown payslip directly from your mobile app or web portal.',
    variables: ['{{employee_name}}', '{{month}}', '{{year}}', '{{organization_name}}', '{{gross_salary}}', '{{net_salary}}', '{{unit}}'],
  },
  appraisal_cycle_launched: {
    key: 'appraisal_cycle_launched',
    type: 'email',
    name: 'Appraisal Cycle Launch Notice',
    description: 'Sent to staff when a scheduled performance appraisal cycle opens for self-review.',
    subject: 'Action Required: {{cycle_name}} Self-Appraisal is Now Open',
    salutation: 'Dear {{employee_name}},',
    body: 'The {{cycle_name}} performance evaluation cycle is officially open.\n\nPlease visit the Performance section on your Oasis dashboard to complete your self-assessment before the deadline.\n\n• Self-Appraisal Deadline: {{self_review_deadline}}\n• Manager Review Deadline: {{manager_review_deadline}}',
    variables: ['{{employee_name}}', '{{cycle_name}}', '{{self_review_deadline}}', '{{manager_review_deadline}}'],
  },
  leave_status_update: {
    key: 'leave_status_update',
    type: 'email',
    name: 'Leave Request Decision Notice',
    description: 'Email sent to employees when their leave request is approved or rejected by a manager.',
    subject: 'Leave Request {{status}} — {{organization_name}}',
    salutation: 'Dear {{employee_name}},',
    body: 'Your leave application from {{start_date}} to {{end_date}} has been marked as {{status}} by your reporting manager.\n\n• Days: {{days}}\n• Manager Remarks: {{remarks}}\n• Remaining Balance: {{remaining_balance}} days',
    variables: ['{{employee_name}}', '{{status}}', '{{organization_name}}', '{{start_date}}', '{{end_date}}', '{{days}}', '{{remarks}}', '{{remaining_balance}}'],
  },
};

/**
 * Fetch all document and email templates for an organization, merging with defaults.
 */
export async function getTemplates(organizationId: string): Promise<DocumentTemplate[]> {
  try {
    const q = query(collection(db, 'organization_templates'), where('organization_id', '==', organizationId));
    const snap = await getDocs(q);
    const customMap: Record<string, DocumentTemplate> = {};
    snap.docs.forEach((d) => {
      const data = d.data() as DocumentTemplate;
      customMap[data.key] = { ...data, id: d.id };
    });

    const result: DocumentTemplate[] = Object.keys(DEFAULT_TEMPLATES).map((key) => {
      const def = DEFAULT_TEMPLATES[key];
      if (customMap[key]) {
        return customMap[key];
      }
      return {
        id: `${organizationId}_${key}`,
        organization_id: organizationId,
        ...def,
        updated_at: new Date().toISOString(),
      };
    });

    return result;
  } catch (err) {
    console.error('getTemplates error:', err);
    return Object.keys(DEFAULT_TEMPLATES).map((key) => ({
      id: `${organizationId}_${key}`,
      organization_id: organizationId,
      ...DEFAULT_TEMPLATES[key],
      updated_at: new Date().toISOString(),
    }));
  }
}

/**
 * Get a specific template by key for an organization.
 */
export async function getTemplate(organizationId: string, templateKey: string): Promise<DocumentTemplate> {
  const docId = `${organizationId}_${templateKey}`;
  try {
    const snap = await getDoc(doc(db, 'organization_templates', docId));
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as DocumentTemplate;
    }
  } catch (err) {
    console.warn(`Could not read template ${docId}:`, err);
  }

  const def = DEFAULT_TEMPLATES[templateKey] || DEFAULT_TEMPLATES.appointment_letter;
  return {
    id: docId,
    organization_id: organizationId,
    ...def,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Save / update a template in Firestore.
 */
export async function saveTemplate(template: DocumentTemplate): Promise<void> {
  const docId = `${template.organization_id}_${template.key}`;
  const payload = {
    ...template,
    id: docId,
    updated_at: new Date().toISOString(),
  };
  await setDoc(doc(db, 'organization_templates', docId), sanitizeFirestoreData(payload));
}

/**
 * Reset a template back to system default.
 */
export async function resetTemplate(organizationId: string, templateKey: string): Promise<DocumentTemplate> {
  const docId = `${organizationId}_${templateKey}`;
  try {
    await deleteDoc(doc(db, 'organization_templates', docId));
  } catch (err) {
    console.warn(`Error deleting template ${docId}:`, err);
  }

  const def = DEFAULT_TEMPLATES[templateKey] || DEFAULT_TEMPLATES.appointment_letter;
  return {
    id: docId,
    organization_id: organizationId,
    ...def,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Replace {{variable}} tags in a text string with actual values.
 */
export function renderTemplateString(text: string, variables: Record<string, any>): string {
  if (!text) return '';
  let rendered = text;
  Object.keys(variables).forEach((k) => {
    const pattern = new RegExp(`{{${k}}}`, 'g');
    const val = variables[k] !== undefined && variables[k] !== null ? String(variables[k]) : '';
    rendered = rendered.replace(pattern, val);
  });
  return rendered;
}
