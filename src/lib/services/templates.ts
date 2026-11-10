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
  { key: '{{organization_name}}', label: 'Organization Name', example: 'Shanti Memorial Hospital' },
  { key: '{{joining_date}}', label: 'Joining Date', example: '15 Jan 2026' },
  { key: '{{relieving_date}}', label: 'Relieving Date', example: '31 Oct 2026' },
  { key: '{{effective_date}}', label: 'Effective Date', example: '01 Nov 2026' },
  { key: '{{basic_salary}}', label: 'Basic Salary', example: '₹25,000' },
  { key: '{{gross_salary}}', label: 'Gross Salary', example: '₹50,000' },
  { key: '{{annual_salary}}', label: 'Annual CTC', example: '₹6,00,000' },
  { key: '{{ref_number}}', label: 'Reference Number', example: 'SMH/HR/APT/2026/EMP-1021' },
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
  is_custom?: boolean;
}

/**
 * Returns organization aliases to prevent multi-tenant docId discrepancies
 * (e.g. 'shanti-memorial-hospital' vs 'smh')
 */
export function getOrgAliases(orgId: string): string[] {
  const aliases = [orgId];
  if (orgId === 'shanti-memorial-hospital') aliases.push('smh');
  if (orgId === 'smh') aliases.push('shanti-memorial-hospital');
  if (orgId === 'gopal-trust') aliases.push('gopal_trust', 'Gopal Trust');
  if (orgId === 'gopal_trust') aliases.push('gopal-trust', 'Gopal Trust');
  if (orgId === 'chikitsa') aliases.push('csmh', 'Chikitsa');
  if (orgId === 'csmh') aliases.push('chikitsa', 'Chikitsa');
  if (orgId === 'subedge_org') aliases.push('subedge');
  if (orgId === 'subedge') aliases.push('subedge_org');
  return aliases;
}

/**
 * Generates initial organization-specific templates dynamically branded for that entity.
 * Distinguishes between Healthcare/Hospital vs Enterprise/Corporate entities.
 */
export function getDefaultTemplatesForOrg(
  organizationId: string,
  orgNameParam?: string
): Record<string, Omit<DocumentTemplate, 'id' | 'organization_id' | 'updated_at'>> {
  const normId = (organizationId || '').toLowerCase().trim();
  const normName = (orgNameParam || '').toLowerCase().trim();

  const isGopal = normId.includes('gopal') || normName.includes('gopal');
  const isChikitsa = normId.includes('chikitsa') || normName.includes('chikitsa');
  const isSMH =
    normId === 'shanti-memorial-hospital' ||
    normId === 'smh' ||
    normName.includes('shanti') ||
    normName.includes('memorial');

  const isHospital =
    isSMH ||
    isGopal ||
    isChikitsa ||
    normName.includes('hospital') ||
    normName.includes('trust') ||
    normName.includes('clinic');

  const isSubedge = normId.includes('subedge') || normName.includes('subedge');

  let orgName = orgNameParam;
  let unitName = 'Headquarters Campus';
  let signatoryTitle = 'Managing Director / HR Director';
  let signatoryName = 'Executive Administration Board';
  let portalName = 'Oasis Enterprise Portal';

  if (isGopal) {
    orgName = orgNameParam || 'Gopal Trust';
    unitName = 'Gopal Trust Healthcare Unit';
    signatoryTitle = 'Trust Administrator / HR Lead';
    signatoryName = 'Gopal Trust Administration';
    portalName = 'Gopal Trust Workforce Portal';
  } else if (isChikitsa) {
    orgName = orgNameParam || 'Chikitsa';
    unitName = 'Chikitsa Multi-Specialty Unit';
    signatoryTitle = 'Medical Administrator / HR Lead';
    signatoryName = 'Chikitsa Hospital Administration';
    portalName = 'Chikitsa Workforce Portal';
  } else if (isSMH) {
    orgName = orgNameParam || 'Shanti Memorial Hospital';
    unitName = 'Central Hospital Campus';
    signatoryTitle = 'Medical Superintendent / HR Director';
    signatoryName = 'Medical Administration Board';
    portalName = 'SMH Oasis Workforce Portal';
  } else if (isSubedge) {
    orgName = orgNameParam || 'Subedge Technology Pvt Ltd';
    unitName = 'Technology Development Centre';
    signatoryTitle = 'Head of Human Resources';
    signatoryName = 'Talent Operations Director';
    portalName = 'Oasis Enterprise Portal';
  } else {
    orgName = orgNameParam || (isHospital ? 'Shanti Memorial Hospital' : 'Enterprise Workplace');
    unitName = isHospital ? 'Central Hospital Campus' : 'Headquarters Campus';
    signatoryTitle = isHospital ? 'Medical Superintendent / HR Director' : 'Head of Human Resources';
    signatoryName = isHospital ? 'Medical Administration Board' : 'Talent Operations Director';
    portalName = isHospital ? 'SMH Oasis Workforce Portal' : 'Oasis Enterprise Portal';
  }

  return {
    appointment_letter: {
      key: 'appointment_letter',
      type: 'document',
      name: `${orgName} - Official Appointment Letter`,
      description: `Formal employment appointment letter issued by ${orgName}, specifying compensation, duties, and statutory compliance.`,
      title: 'LETTER OF APPOINTMENT',
      subtitle: isHospital ? 'Clinical & Hospital Workforce Administration' : 'Enterprise Workforce & Human Capital Operations',
      salutation: 'Dear {{employee_name}},',
      body: `We are pleased to offer you the position of {{designation}} at ${orgName} ({{unit}}). Your appointment is effective from {{joining_date}}. This letter confirms your role, reporting expectations, and compensation structure within our organization.`,
      clauses: isHospital
        ? [
            `1. Role & Department: You are appointed as {{designation}} in the {{department}} department at ${orgName} ({{unit}}). You will report to the Department Head / Medical Administrator.`,
            '2. Compensation Structure: Your gross monthly remuneration is ₹{{gross_salary}} (Basic: ₹{{basic_salary}}), subject to statutory withholdings including EPF and Professional Tax.',
            '3. Hospital Duty & Shifts: You shall adhere to rotational duty rosters (Day, Evening, or Emergency Shifts) as assigned by hospital management to maintain round-the-clock patient care standards.',
            '4. Punctuality & Attendance Policy: You must punch in via the biometric face terminal. Up to 3 late punches per month are allowed under grace period; 4th late punch onwards incurs a 0.5 Day Loss of Pay (LOP) penalty.',
            '5. Clinical Ethics & Confidentiality: You agree to uphold hospital ethical codes, protect patient clinical confidentiality, and strictly adhere to NABH healthcare standards.',
            '6. Probation & Notice: You will be on probation for 6 months. Confirmation is subject to performance and clinical reviews. Post-confirmation notice period is 30 days.',
          ]
        : [
            `1. Role & Department: You are appointed as {{designation}} in the {{department}} department at ${orgName} ({{unit}}). You will report to your designated team supervisor.`,
            '2. Compensation Structure: Your gross monthly remuneration is ₹{{gross_salary}} (Basic: ₹{{basic_salary}}), subject to statutory EPF, ESI, and tax deductions.',
            '3. Work Hours & Attendance: You shall adhere to designated work shifts and log attendance daily through the Oasis geofenced biometric portal.',
            '4. Intellectual Property & Confidentiality: All intellectual property, project software, algorithms, and confidential business data developed during your tenure remain the exclusive property of the company.',
            '5. Probation Period: You will be on probation for 6 months. Confirmation will follow satisfactory evaluation of deliverables and team collaboration.',
            '6. Notice Period: Following confirmation, either party may terminate employment with 30 calendar days written notice or gross salary in lieu thereof.',
          ],
      signatory_name: signatoryName,
      signatory_title: signatoryTitle,
      variables: [
        '{{employee_name}}',
        '{{designation}}',
        '{{organization_name}}',
        '{{unit}}',
        '{{joining_date}}',
        '{{department}}',
        '{{gross_salary}}',
        '{{basic_salary}}',
        '{{ref_number}}',
      ],
    },
    offer_letter: {
      key: 'offer_letter',
      type: 'document',
      name: `${orgName} - Job Offer Letter`,
      description: `Preliminary offer of employment extended to candidates joining ${orgName}.`,
      title: 'OFFER OF EMPLOYMENT',
      subtitle: `${orgName} Talent Acquisition & People Operations`,
      salutation: 'Dear {{employee_name}},',
      body: `Following our recent interview and selection rounds, we are delighted to extend this formal offer of employment for the position of {{designation}} with ${orgName}.`,
      clauses: [
        `1. Position & Location: You will join our team as {{designation}} in the {{department}} department based at {{unit}}.`,
        '2. Annualized Compensation: Your total Cost to Company (CTC) will be ₹{{annual_salary}} (Gross: ₹{{gross_salary}} per month).',
        '3. Proposed Start Date: Your anticipated date of joining is {{joining_date}}.',
        '4. Reference & Verification: This offer is contingent upon successful background check and verification of educational credentials.',
        '5. Acceptance: Please sign and return a duplicate copy of this letter within 5 business days to confirm your acceptance.',
      ],
      signatory_name: signatoryName,
      signatory_title: 'Talent Acquisition Director',
      variables: [
        '{{employee_name}}',
        '{{designation}}',
        '{{organization_name}}',
        '{{department}}',
        '{{unit}}',
        '{{annual_salary}}',
        '{{gross_salary}}',
        '{{joining_date}}',
      ],
    },
    experience_letter: {
      key: 'experience_letter',
      type: 'document',
      name: `${orgName} - Relieving & Experience Certificate`,
      description: `Official service verification and clearance certificate for departing staff of ${orgName}.`,
      title: 'EXPERIENCE & RELIEVING CERTIFICATE',
      subtitle: `${orgName} Human Resources Operations`,
      salutation: 'TO WHOMSOEVER IT MAY CONCERN,',
      body: `This is to certify that {{employee_name}} (Employee Code: {{employee_code}}) was employed with ${orgName} from {{joining_date}} to {{relieving_date}} in the {{department}} department as {{designation}}.`,
      clauses: [
        `During their tenure at {{unit}}, their conduct and professional dedication were found to be satisfactory and commendable.`,
        'All company assets, data handovers, and department clearance procedures have been completed with no outstanding dues.',
        `We thank {{employee_name}} for their dedicated contributions to ${orgName} and wish them every success in their future endeavors.`,
      ],
      signatory_name: signatoryName,
      signatory_title: signatoryTitle,
      variables: [
        '{{employee_name}}',
        '{{employee_code}}',
        '{{organization_name}}',
        '{{joining_date}}',
        '{{relieving_date}}',
        '{{department}}',
        '{{designation}}',
        '{{unit}}',
      ],
    },
    promotion_letter: {
      key: 'promotion_letter',
      type: 'document',
      name: `${orgName} - Promotion & Increment Letter`,
      description: `Issued after performance reviews to confirm role elevations and compensation revisions at ${orgName}.`,
      title: 'PROMOTION & COMPENSATION REVISION',
      subtitle: `${orgName} Annual Performance Appraisal Recognition`,
      salutation: 'Dear {{employee_name}},',
      body: `In recognition of your outstanding performance, leadership, and notable contributions to ${orgName}, management is pleased to announce your promotion to {{designation}}.`,
      clauses: [
        '1. Effective Date: Your revised designation and compensation are effective from {{effective_date}}.',
        '2. Revised Remuneration: Your revised monthly gross remuneration will be ₹{{gross_salary}} (Basic Salary: ₹{{basic_salary}}).',
        `3. Leadership Expectations: We look forward to your continued drive in spearheading departmental objectives at ${orgName}.`,
      ],
      signatory_name: signatoryName,
      signatory_title: 'Executive Leadership Board',
      variables: [
        '{{employee_name}}',
        '{{designation}}',
        '{{effective_date}}',
        '{{gross_salary}}',
        '{{basic_salary}}',
        '{{department}}',
        '{{unit}}',
      ],
    },
    welcome_credentials: {
      key: 'welcome_credentials',
      type: 'email',
      name: `${orgName} - User Welcome & Login Credentials`,
      description: `Email dispatch sent when a new staff profile is provisioned on ${portalName}.`,
      subject: `Welcome to ${orgName} — Your ${portalName} Login Credentials`,
      salutation: 'Dear {{employee_name}},',
      body: `Welcome to ${orgName}!\n\nYour workforce portal account is active. You can now track your attendance, view duty shifts, request leaves, and access salary slips.\n\nYour Login Credentials:\n• Portal Link: {{portal_url}}\n• User ID / Email: {{user_email}}\n• Temporary Password: {{temporary_password}}\n• Designated Unit: {{unit}}\n\nPlease sign in, change your password immediately, and complete your biometric attendance setup.`,
      variables: [
        '{{employee_name}}',
        '{{organization_name}}',
        '{{portal_url}}',
        '{{user_email}}',
        '{{temporary_password}}',
        '{{unit}}',
      ],
    },
    appointment_issued: {
      key: 'appointment_issued',
      type: 'email',
      name: `${orgName} - Appointment Letter Notification`,
      description: `Email notifying employee that their official appointment letter has been signed and issued.`,
      subject: `Official Appointment Letter Issued — ${orgName}`,
      salutation: 'Dear {{employee_name}},',
      body: `Congratulations! Your official Letter of Appointment has been issued by ${orgName} (Reference: {{ref_number}}).\n\nPlease find your formal document attached as a PDF. You can also view, print, or download your digitally signed appointment letter anytime from your ${portalName} self-service portal.`,
      variables: ['{{employee_name}}', '{{organization_name}}', '{{ref_number}}', '{{designation}}', '{{unit}}'],
    },
    payslip_notification: {
      key: 'payslip_notification',
      type: 'email',
      name: `${orgName} - Monthly Salary Slip Notification`,
      description: `Email sent automatically when monthly payroll registers are published.`,
      subject: `Salary Slip Released for {{month}} {{year}} — ${orgName}`,
      salutation: 'Dear {{employee_name}},',
      body: `Your salary slip for the month of {{month}} {{year}} has been generated and released.\n\nSummary:\n• Gross Salary: ₹{{gross_salary}}\n• Net Disbursed: ₹{{net_salary}}\n• Unit: {{unit}}\n\nYou can view and download your full breakdown payslip directly from your mobile app or web portal.`,
      variables: ['{{employee_name}}', '{{month}}', '{{year}}', '{{organization_name}}', '{{gross_salary}}', '{{net_salary}}', '{{unit}}'],
    },
    appraisal_cycle_launched: {
      key: 'appraisal_cycle_launched',
      type: 'email',
      name: `${orgName} - Performance Review Cycle Notice`,
      description: `Sent to staff when a scheduled performance appraisal cycle opens for self-review.`,
      subject: `Action Required: {{cycle_name}} Self-Appraisal is Now Open — ${orgName}`,
      salutation: 'Dear {{employee_name}},',
      body: `The {{cycle_name}} performance evaluation cycle is officially open at ${orgName}.\n\nPlease visit the Performance section on your Oasis dashboard to complete your self-assessment before the deadline.\n\n• Self-Appraisal Deadline: {{self_review_deadline}}\n• Manager Review Deadline: {{manager_review_deadline}}`,
      variables: ['{{employee_name}}', '{{cycle_name}}', '{{self_review_deadline}}', '{{manager_review_deadline}}', '{{organization_name}}'],
    },
    leave_status_update: {
      key: 'leave_status_update',
      type: 'email',
      name: `${orgName} - Leave Application Decision Notice`,
      description: `Email sent to employees when their leave request is reviewed by management.`,
      subject: `Leave Request {{status}} — ${orgName}`,
      salutation: 'Dear {{employee_name}},',
      body: `Your leave application from {{start_date}} to {{end_date}} has been marked as {{status}} by your reporting manager.\n\n• Days: {{days}}\n• Manager Remarks: {{remarks}}\n• Remaining Balance: {{remaining_balance}} days`,
      variables: ['{{employee_name}}', '{{status}}', '{{organization_name}}', '{{start_date}}', '{{end_date}}', '{{days}}', '{{remarks}}', '{{remaining_balance}}'],
    },
  };
}

// Global static fallback
export const DEFAULT_TEMPLATES = getDefaultTemplatesForOrg('00000000-0000-0000-0000-000000000001');

/**
 * Fetch all document and email templates for an organization, merging with org-tailored defaults.
 */
export async function getTemplates(
  organizationId: string,
  orgName?: string
): Promise<DocumentTemplate[]> {
  const resolvedOrgId = organizationId || '00000000-0000-0000-0000-000000000001';
  const orgDefaults = getDefaultTemplatesForOrg(resolvedOrgId, orgName);
  const aliases = getOrgAliases(resolvedOrgId);

  try {
    const customMap: Record<string, DocumentTemplate> = {};

    // Query for all aliases
    for (const alias of aliases) {
      const q = query(
        collection(db, 'organization_templates'),
        where('organization_id', '==', alias)
      );
      const snap = await getDocs(q);
      snap.docs.forEach((d) => {
        const data = d.data() as DocumentTemplate;
        customMap[data.key] = {
          ...data,
          id: d.id,
          organization_id: resolvedOrgId, // Normalize to requested orgId
          is_custom: true,
        };
      });
    }

    const result: DocumentTemplate[] = Object.keys(orgDefaults).map((key) => {
      const def = orgDefaults[key];
      if (customMap[key]) {
        return customMap[key];
      }
      return {
        id: `${resolvedOrgId}_${key}`,
        organization_id: resolvedOrgId,
        ...def,
        updated_at: new Date().toISOString(),
        is_custom: false,
      };
    });

    return result;
  } catch (err) {
    console.error('getTemplates error:', err);
    return Object.keys(orgDefaults).map((key) => ({
      id: `${resolvedOrgId}_${key}`,
      organization_id: resolvedOrgId,
      ...orgDefaults[key],
      updated_at: new Date().toISOString(),
      is_custom: false,
    }));
  }
}

/**
 * Get a specific template by key for an organization.
 */
export async function getTemplate(
  organizationId: string,
  templateKey: string,
  orgName?: string
): Promise<DocumentTemplate> {
  const resolvedOrgId = organizationId || '00000000-0000-0000-0000-000000000001';
  const aliases = getOrgAliases(resolvedOrgId);

  for (const alias of aliases) {
    const docId = `${alias}_${templateKey}`;
    try {
      const snap = await getDoc(doc(db, 'organization_templates', docId));
      if (snap.exists()) {
        return {
          id: snap.id,
          ...snap.data(),
          organization_id: resolvedOrgId,
          is_custom: true,
        } as DocumentTemplate;
      }
    } catch (err) {
      console.warn(`Could not read template ${docId}:`, err);
    }
  }

  const orgDefaults = getDefaultTemplatesForOrg(resolvedOrgId, orgName);
  const def = orgDefaults[templateKey] || orgDefaults.appointment_letter;
  return {
    id: `${resolvedOrgId}_${templateKey}`,
    organization_id: resolvedOrgId,
    ...def,
    updated_at: new Date().toISOString(),
    is_custom: false,
  };
}

/**
 * Save / update a template in Firestore specifically linked to an organization.
 */
export async function saveTemplate(template: DocumentTemplate): Promise<void> {
  const orgId = template.organization_id || '00000000-0000-0000-0000-000000000001';
  const docId = `${orgId}_${template.key}`;
  const payload: DocumentTemplate = {
    ...template,
    id: docId,
    organization_id: orgId,
    is_custom: true,
    updated_at: new Date().toISOString(),
  };
  await setDoc(doc(db, 'organization_templates', docId), sanitizeFirestoreData(payload));
}

/**
 * Reset a template back to the organization-specific default.
 */
export async function resetTemplate(
  organizationId: string,
  templateKey: string,
  orgName?: string
): Promise<DocumentTemplate> {
  const resolvedOrgId = organizationId || '00000000-0000-0000-0000-000000000001';
  const aliases = getOrgAliases(resolvedOrgId);

  for (const alias of aliases) {
    const docId = `${alias}_${templateKey}`;
    try {
      await deleteDoc(doc(db, 'organization_templates', docId));
    } catch (err) {
      console.warn(`Error deleting template ${docId}:`, err);
    }
  }

  const orgDefaults = getDefaultTemplatesForOrg(resolvedOrgId, orgName);
  const def = orgDefaults[templateKey] || orgDefaults.appointment_letter;
  return {
    id: `${resolvedOrgId}_${templateKey}`,
    organization_id: resolvedOrgId,
    ...def,
    updated_at: new Date().toISOString(),
    is_custom: false,
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
