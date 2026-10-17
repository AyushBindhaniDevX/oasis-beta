// Database types for Oasis HRMS Cloud Architecture

export type UserRole = 'employee' | 'hr' | 'admin';
export type EmploymentStatus = 'active' | 'inactive' | 'terminated';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'half_day' | 'on_leave';
export type LeaveRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'l1_approved' | 'l2_approved';
export type PayrollStatus = 'draft' | 'processed' | 'paid';
export type PayrollPeriodStatus = 'open' | 'processing' | 'closed';

export type ApprovalLevel = 1 | 2 | 3;
export interface ApprovalStep {
  level: ApprovalLevel;
  status: 'pending' | 'approved' | 'rejected';
  approver_id: string | null;
  acted_by?: string | null;
  acted_at?: string | null;
  comments?: string | null;
}

export interface ApprovalConfig {
  id: string;
  organization_id: string;
  module: 'leave' | 'attendance' | 'late_deduction' | 'expense' | 'overtime';
  levels: number; // 1 to 3
  l1_approver_role?: 'manager' | 'department_head' | 'hr' | 'admin' | 'specific_user';
  l1_specific_user_id?: string;
  l2_approver_role?: 'manager' | 'department_head' | 'hr' | 'admin' | 'specific_user';
  l2_specific_user_id?: string;
  l3_approver_role?: 'manager' | 'department_head' | 'hr' | 'admin' | 'specific_user';
  l3_specific_user_id?: string;
}

export type SubscriptionPlan = 'starter' | 'growth' | 'enterprise';

export interface OrganizationFeatures {
  payroll?: boolean;
  biometrics?: boolean;
  geofencing?: boolean;
  performance?: boolean;
  learning?: boolean;
  recruitment?: boolean;
  expenses?: boolean;
  helpdesk?: boolean;
  assets?: boolean;
  audit_logs?: boolean;
  wfh?: boolean;
  attendance?: boolean;
  leave?: boolean;
  holidays?: boolean;
  shifts?: boolean;
  departments?: boolean;
  users?: boolean;
  locations?: boolean;
  directory?: boolean;
  [key: string]: boolean | undefined;
}

export interface Organization {
  id: string;
  name: string;
  slug?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  accent_color?: string | null;
  package_type?: 'basic' | 'silver' | 'gold' | 'starter' | 'growth' | 'enterprise';
  plan?: SubscriptionPlan;
  features?: OrganizationFeatures;
  max_employees?: number;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
}

export interface Profile {
  id: string;
  organization_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  role: UserRole;
  is_active: boolean;
  session_id?: string;
  last_login_ip?: string;
  last_active?: string;
  biometric_enrolled?: boolean;
  needs_password_change?: boolean;
  must_change_password?: boolean;
  is_hhc_enabled?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  manager_id?: string | null;
  created_at: string;
  // Joined
  manager?: Employee;
  employee_count?: number;
}

export interface CustomPayrollItem {
  id: string;
  name: string;
  type: 'earning' | 'deduction' | 'reimbursement';
  amount_type: 'fixed' | 'percentage';
  value: number;
  icon?: string;
  color?: string;
  is_taxable?: boolean;
  is_recurring?: boolean;
}

export interface TaxConfig {
  pf_number?: string | null;
  uan_number?: string | null;
  esi_number?: string | null;
  tax_regime?: 'old' | 'new' | 'custom' | string;
  tds_percentage?: number | null;
  epf_percentage?: number | null;
  pt_amount?: number | null;
  hra_percentage?: number | null;
  custom_tax_percentage?: number | null;
  esop_value?: number | null;
  hra_type?: 'metro' | 'non-metro' | 'custom';
  epf_exempt?: boolean;
  esi_exempt?: boolean;
  transport_allowance?: number | null;
  custom_items?: CustomPayrollItem[];
}

export interface Employee {
  id: string;
  profile_id: string;
  organization_id?: string | null;
  employee_code: string | null;
  department_id: string | null;
  designation: string | null;
  joining_date: string | null;
  date_of_birth?: string | null;
  workplace_id: string | null;
  manager_id?: string | null;
  default_shift_id?: string | null;
  basic_salary: number;
  employment_status: EmploymentStatus;
  onboarding_completed: boolean;
  is_hhc_enabled?: boolean;
  is_pf_eligible?: boolean; // PF vs Non-PF categorization
  is_overtime_eligible?: boolean; // Overtime calculation designated staff
  hospital_unit?: 'Shanti Memorial Hospital' | 'Chikitsa Unit' | string;
  conveyance_allowance?: number;
  washing_allowance?: number;
  special_allowance?: number;
  ot_deduction?: number; // miscellaneous deductions
  home_address?: string | null;
  bank_details?: {
    bank_name: string;
    account_number: string;
    routing_number: string;
  } | null;
  tax_config?: TaxConfig | null;
  emergency_contact?: {
    name: string;
    phone: string;
    relationship?: string;
  } | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  profile?: Profile;
  department?: Department;
  workplace?: Workplace;
  manager?: Employee;
  shift?: WorkShift;
  direct_reports?: Employee[];
}

export interface Workplace {
  id: string;
  organization_id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  radius_meters: number;
  is_active: boolean;
  created_at: string;
}

export interface Attendance {
  id: string;
  employee_id: string;
  workplace_id: string | null;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  clock_in_latitude: number | null;
  clock_in_longitude: number | null;
  clock_out_latitude: number | null;
  clock_out_longitude: number | null;
  clock_in_verified: boolean;
  clock_out_verified: boolean;
  face_verified?: boolean;
  face_snapshot_url?: string | null;
  working_minutes: number;
  status: AttendanceStatus;
  breaks?: { start: string; end: string | null; reason: string }[];
  overtime_minutes?: number;
  is_remote?: boolean;
  remote_reason?: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  employee?: Employee;
  workplace?: Workplace;
}

export interface LeaveType {
  id: string;
  organization_id: string;
  name: string;
  annual_days: number;
  is_paid: boolean;
  created_at: string;
  description?: string | null;
}

export type HolidayType = 'public' | 'optional' | 'restricted' | 'company';

export interface Holiday {
  id: string;
  organization_id: string;
  name: string;
  date: string; // YYYY-MM-DD
  type: HolidayType;
  description?: string | null;
  is_recurring?: boolean;
  created_at: string;
  updated_at?: string;
}

export interface LeaveBalance {
  id: string;
  employee_id: string;
  leave_type_id: string;
  year: number;
  allocated_days: number;
  used_days: number;
  remaining_days: number;
  // Joined
  leave_type?: LeaveType;
}

export interface LeaveApprovalTierAction {
  tier: number; // 1, 2, 3, 4
  role_title: string; // e.g. "Reporting Manager", "HOD", "Medical Superintendent", "HR Head"
  approver_id: string;
  approver_name: string;
  action: 'approved' | 'rejected';
  timestamp: string;
  notes?: string | null;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  days: number;
  is_half_day: boolean;
  reason: string | null;
  status: LeaveRequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  // Four-tier approval fields
  current_tier?: number; // 1: Reporting Officer, 2: HOD, 3: Medical Superintendent, 4: HR Admin, 5: Fully Approved
  approval_history?: LeaveApprovalTierAction[];
  is_locked?: boolean; // Locked once fully approved, cannot be modified without authorized admin intervention
  created_at: string;
  updated_at: string;
  // Joined
  leave_type?: LeaveType;
  employee?: Employee;
  reviewer?: Profile;
}

export interface AttendanceRegularization {
  id: string;
  employee_id: string;
  organization_id: string | null;
  attendance_id: string | null;
  date: string; // YYYY-MM-DD
  requested_clock_in: string | null;
  requested_clock_out: string | null;
  requested_status: AttendanceStatus | null;
  reason: string;
  status: LeaveRequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  employee?: Employee;
}

export interface LateAttendanceDeduction {
  id: string;
  organization_id: string;
  employee_id: string;
  payroll_period_id: string;
  consecutive_days: number;
  late_dates: string[];
  amount: number;
  status: LeaveRequestStatus; // reuse status
  approval_steps?: ApprovalStep[];
  current_approval_level?: number;
  created_at: string;
  updated_at: string;
  // Joined
  employee?: Employee;
}

export interface PayrollPeriod {
  id: string;
  organization_id: string;
  month: number;
  year: number;
  status: PayrollPeriodStatus;
  processed_at: string | null;
  created_at: string;
}

export interface Payroll {
  id: string;
  payroll_period_id: string;
  employee_id: string;
  basic_salary: number;
  allowances: Record<string, number>;
  deductions: Record<string, number>;
  lop_days: number;
  lop_amount: number;
  gross_salary: number;
  net_salary: number;
  status: PayrollStatus;
  // Shanti Memorial Hospital & Chikitsa Unit explicit breakdown fields
  hospital_unit?: string;
  is_pf_eligible?: boolean;
  salary_details?: number; // Base monthly scale
  payable_days?: number; // Standard 30 days
  present_days?: number;
  off_days?: number;
  leave_days?: number;
  holiday_days?: number;
  paid_days?: number;
  basic?: number; // 50% of G. Salary
  hra?: number; // 20% of G. Salary
  conveyance?: number;
  washing?: number;
  special_allowance?: number;
  pt_tds?: number;
  esi?: number;
  pf?: number;
  ot_ded?: number; // miscellaneous deductions
  gross_deductions?: number;
  ot_hours_or_days?: number;
  ot_amount?: number;
  other_allowances?: number;
  created_at: string;
  updated_at: string;
  // Joined
  employee?: Employee;
  payroll_period?: PayrollPeriod;
}

export interface Payslip {
  id: string;
  payroll_id: string;
  employee_id: string;
  payslip_number: string;
  period_month: number;
  period_year: number;
  file_url: string | null;
  created_at: string;
  // Joined
  payroll?: Payroll;
  employee?: Employee;
}

export interface AuditLog {
  id: string;
  organization_id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  // Joined
  user?: Partial<Profile> | null;
}

export interface Notification {
  id: string;
  profile_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  action_url: string | null;
  created_at: string;
}

export interface Announcement {
  id: string;
  organization_id: string;
  title: string;
  message: string;
  target_audience: 'all' | 'department' | 'branch';
  target_department_id?: string | null;
  target_branch_id?: string | null;
  published_by: string; // Profile ID
  published_at: string;
  expiry_date?: string | null;
  priority: 'low' | 'normal' | 'high';
  created_at: string;
}

// RPC Response types
export interface GeofenceResponse {
  success: boolean;
  message?: string;
  error?: string;
  attendance_id?: string;
  status?: AttendanceStatus;
  distance_meters?: number;
  face_verified?: boolean;
  clock_in?: string;
  clock_out?: string;
  working_minutes?: number;
}

export interface LeaveProcessResponse {
  success: boolean;
  message?: string;
  error?: string;
  request_id?: string;
  status?: LeaveRequestStatus;
  new_status?: LeaveRequestStatus;
}

// Performance & OKRs Management Types
export type GoalCategory = 'company' | 'department' | 'individual';
export type GoalPriority = 'low' | 'medium' | 'high';
export type GoalStatus = 'not_started' | 'in_progress' | 'on_track' | 'at_risk' | 'completed';

export interface KeyResult {
  id: string;
  title: string;
  target_value: number;
  current_value: number;
  unit: string;
  completed?: boolean;
}

export interface Goal {
  id: string;
  organization_id: string;
  employee_id?: string | null;
  department_id?: string | null;
  title: string;
  description: string | null;
  category: GoalCategory;
  priority: GoalPriority;
  status: GoalStatus;
  progress: number; // 0 - 100
  start_date: string;
  target_date: string;
  key_results: KeyResult[];
  created_at: string;
  updated_at: string;
  // Joined
  employee?: Employee;
  department?: Department;
}

export type AppraisalStatus = 'self_review' | 'manager_review' | 'completed';
export type AppraisalRecommendation = 'promotion' | 'salary_increment' | 'maintain' | 'pip';

export interface PerformanceRatingBreakdown {
  technical_skills: number; // 1-5
  productivity: number; // 1-5
  communication: number; // 1-5
  leadership: number; // 1-5
  teamwork: number; // 1-5
}

export interface AppraisalReview {
  id: string;
  organization_id: string;
  employee_id: string;
  reviewer_id?: string | null;
  cycle_name: string;
  period: string; // e.g. "Q1 2026", "Annual 2026"
  status: AppraisalStatus;
  self_rating: number; // 1-5
  self_comments?: string | null;
  self_submitted_at?: string | null;
  manager_rating?: number | null; // 1-5
  manager_comments?: string | null;
  manager_submitted_at?: string | null;
  ratings_breakdown?: PerformanceRatingBreakdown | null;
  overall_score?: number | null; // out of 100 or 5.0
  recommendation?: AppraisalRecommendation | null;
  created_at: string;
  updated_at: string;
  // Joined
  employee?: Employee;
  reviewer?: Profile;
}

export type KudosBadge = 'star' | 'team_player' | 'innovator' | 'leadership' | 'rockstar' | 'problem_solver';

export interface Kudos {
  id: string;
  organization_id: string;
  sender_id: string;
  receiver_id: string;
  badge: KudosBadge;
  message: string;
  created_at: string;
  // Joined
  sender?: Profile;
  receiver?: Profile;
}

// ==========================================
// 1. RECRUITMENT & ATS MODULE
// ==========================================
export type JobStatus = 'draft' | 'published' | 'closed';
export type JobEmploymentType = 'full-time' | 'part-time' | 'contract' | 'remote' | 'hybrid';
export type JobPriority = 'urgent' | 'high' | 'normal' | 'low';
export type CandidateStage =
  | 'applied'
  | 'screening'
  | 'shortlisted'
  | 'assessment'
  | 'interview'
  | 'hr_round'
  | 'offer'
  | 'pre_joining'
  | 'hired'
  | 'rejected'
  | 'talent_pool';

export type RejectionReasonCode =
  | 'skills_mismatch'
  | 'notice_period_too_long'
  | 'budget_constraint'
  | 'position_filled'
  | 'cultural_fit'
  | 'knockout_failed'
  | 'other';

export interface ScreeningQuestion {
  id: string;
  question: string;
  type: 'boolean' | 'choice' | 'text';
  options?: string[];
  knockout_answer?: string; // If user's answer matches this, flagged as knockout
  required?: boolean;
}

export interface PipelineStageConfig {
  id: string;
  name: string;
  key: string;
  color: string;
  requires_scorecard: boolean;
  sla_days: number;
}

export interface CustomPipeline {
  id: string;
  name: string;
  department: string;
  is_default: boolean;
  stages: PipelineStageConfig[];
}

export interface JobOpening {
  id: string;
  organization_id: string;
  title: string;
  department: string;
  location: string;
  type: JobEmploymentType;
  experience_level: string;
  salary_range: string;
  positions_count: number;
  priority?: JobPriority;
  target_joining_date?: string;
  hiring_manager?: string;
  description: string;
  requirements: string[];
  skills?: string[];
  responsibilities?: string[];
  perks_and_benefits?: string[];
  about_team?: string;
  hiring_process?: string[];
  remote_policy?: string;
  equity_or_bonus?: string;
  status: JobStatus;
  applicants_count: number;
  published_portals?: ('careers_page' | 'linkedin' | 'indeed' | 'naukri')[];
  pipeline_id?: string;
  screening_questions?: ScreeningQuestion[];
  created_at: string;
}

export interface CandidateTimelineEvent {
  id: string;
  type: 'applied' | 'stage_change' | 'interview_scheduled' | 'scorecard_added' | 'offer_sent' | 'rejected' | 'talent_pool' | 'note';
  title: string;
  description: string;
  created_at: string;
  actor_name: string;
}

export interface CandidateEvaluation {
  technical_score: number; // 1-5
  problem_solving_score: number; // 1-5
  communication_score: number; // 1-5
  culture_fit_score: number; // 1-5
  recommendation: 'strong_hire' | 'hire' | 'hold' | 'reject';
  interviewer_notes: string;
  evaluated_at?: string;
  evaluator_name?: string;
}

export interface CandidateAIMatch {
  overall: number; // 0-100%
  skills: number; // 0-100%
  experience: number; // 0-100%
  education: number; // 0-100%
  location: number; // 0-100%
  salary: number; // 0-100%
  strengths: string[];
  gaps: string[];
}

export interface Candidate {
  id: string;
  job_id: string;
  organization_id: string;
  full_name: string;
  email: string;
  phone: string;
  stage: CandidateStage;
  rating: number; // 1-5
  experience_years: number;
  current_company: string;
  expected_salary: string;
  notice_period_days?: number;
  location?: string;
  current_location?: string;
  education?: string;
  skills?: string[];
  source?: string;
  resume_url?: string;
  linkedin_url?: string;
  portfolio_url?: string;
  screening_answers?: Record<string, string>;
  knockout_passed?: boolean;
  rejection_reason?: RejectionReasonCode;
  rejection_notes?: string;
  talent_pool_tags?: string[];
  is_silver_medalist?: boolean;
  scorecard_notes?: string;
  ai_match?: CandidateAIMatch;
  evaluation?: CandidateEvaluation;
  timeline?: CandidateTimelineEvent[];
  applied_at: string;
  job?: JobOpening;
}

export interface InterviewSchedule {
  id: string;
  candidate_id: string;
  candidate_name: string;
  job_id: string;
  job_title: string;
  round_name: string;
  interviewer_name: string;
  scheduled_time: string;
  duration_minutes: number;
  meeting_link: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  notes?: string;
}

export interface OfferLetter {
  id: string;
  candidate_id: string;
  candidate_name: string;
  candidate_email: string;
  job_id: string;
  designation: string;
  department: string;
  annual_ctc: number;
  joining_date: string;
  probation_months: number;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  created_at: string;
}

export interface ManpowerPlan {
  id: string;
  department: string;
  approved_headcount: number;
  current_headcount: number;
  requested_positions: number;
  annual_budget: number;
  budget_spent: number;
  status: 'approved' | 'pending' | 'review';
}

// ==========================================
// 2. EXPENSE & REIMBURSEMENTS MODULE
// ==========================================
export type ExpenseCategory = 'travel' | 'meals' | 'internet' | 'learning' | 'hardware' | 'other';
export type ExpenseStatus = 'pending' | 'approved' | 'rejected' | 'reimbursed';

export interface ExpenseClaim {
  id: string;
  organization_id: string;
  employee_id: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  currency: string;
  receipt_url?: string | null;
  description: string;
  status: ExpenseStatus;
  spent_at: string;
  approved_by?: string | null;
  approved_at?: string | null;
  comments?: string;
  created_at: string;
  employee?: Employee;
}

// ==========================================
// 3. ASSET & INVENTORY MANAGEMENT
// ==========================================
export type AssetCategory = 'laptop' | 'monitor' | 'phone' | 'tablet' | 'security_token' | 'furniture' | 'accessories' | 'other';
export type AssetStatus = 'in_use' | 'available' | 'maintenance' | 'retired';

export interface CompanyAsset {
  id: string;
  organization_id: string;
  name: string;
  asset_tag: string; // e.g. "SUB-LPT-009"
  category: AssetCategory;
  model: string;
  serial_number: string;
  purchase_date: string;
  value: number;
  assigned_to_id?: string | null;
  assigned_employee_name?: string | null;
  status: AssetStatus;
  notes?: string;
  qr_code?: string;
  warranty_expiry?: string;
  last_audited_at?: string;
  last_auditor_name?: string;
  salvage_value?: number;
  disposal_reason?: string;
  disposed_at?: string;
  created_at: string;
  assigned_employee?: Employee;
}

// ==========================================
// 4. EMPLOYEE HELPDESK & TICKETS MODULE
// ==========================================
export type TicketCategory = 'it_support' | 'hr_query' | 'payroll_issue' | 'facility' | 'general';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface SupportTicket {
  id: string;
  organization_id: string;
  employee_id: string;
  ticket_number: string; // e.g. "TKT-1042"
  title: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  description: string;
  assigned_to_id?: string | null;
  resolution_notes?: string;
  created_at: string;
  updated_at: string;
  employee?: Employee;
  assigned_agent?: Profile;
}

// ==========================================
// 5. LEARNING & DEVELOPMENT (L&D) MODULE
// ==========================================
export type LessonType = 'video' | 'article' | 'document' | 'quiz' | 'external_link';

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation?: string;
}

export interface CourseLesson {
  id: string;
  title: string;
  type: LessonType;
  duration_minutes: number;
  video_url?: string;
  content_markdown?: string;
  attachment_url?: string;
  attachment_name?: string;
  quiz_questions?: QuizQuestion[];
  order: number;
}

export interface CourseModule {
  id: string;
  title: string;
  description?: string;
  lessons: CourseLesson[];
}

export interface TrainingCourse {
  id: string;
  organization_id: string;
  title: string;
  category: string;
  description: string;
  duration_minutes: number;
  modules_count: number;
  is_mandatory: boolean;
  instructor: string;
  rating: number;
  thumbnail_url?: string;
  enrolled_count: number;
  certificate_title?: string;
  pass_percentage?: number;
  curriculum?: CourseModule[];
  created_at: string;
}

export interface CourseEnrollment {
  id: string;
  course_id: string;
  employee_id: string;
  progress_percent: number;
  is_completed: boolean;
  completed_lesson_ids?: string[];
  quiz_scores?: Record<string, number>;
  completed_at?: string | null;
  certificate_url?: string | null;
  course?: TrainingCourse;
}

// ==========================================
// 6. DOCUMENT VAULT & POLICY MANAGEMENT
// ==========================================
export type DocumentCategory = 'policy' | 'contract' | 'tax_form' | 'handbook' | 'certificate';

export interface CompanyDocument {
  id: string;
  organization_id: string;
  title: string;
  category: DocumentCategory;
  file_size_kb: number;
  version: string;
  file_url: string;
  requires_signature: boolean;
  signatures_count: number;
  uploaded_by: string;
  created_at: string;
}

// ==========================================
// 7. SHIFT SCHEDULING & ROSTERS
// ==========================================
export interface WorkShift {
  id: string;
  organization_id: string;
  name: string; // e.g. "General Day", "Morning Rotational", "Night Shift"
  start_time: string; // "09:00"
  end_time: string; // "18:00"
  color: string;
  allowance_per_day: number;
}

export interface ShiftSchedule {
  id: string;
  employee_id: string;
  shift_id: string;
  date: string; // "YYYY-MM-DD"
  is_overtime: boolean;
  shift?: WorkShift;
  employee?: Employee;
}

// ==========================================
// 8. PULSE SURVEYS & ENPS MODULE
// ==========================================
export interface PulseSurvey {
  id: string;
  organization_id: string;
  title: string;
  question: string;
  type: 'rating_1_5' | 'enps_1_10' | 'yes_no';
  status: 'active' | 'closed';
  responses_count: number;
  average_score: number;
  created_at: string;
}

// ==========================================
// 9. REWARDS & RECOGNITION STORE
// ==========================================
export interface RewardItem {
  id: string;
  organization_id: string;
  title: string;
  points_required: number;
  category: 'gift_card' | 'gadget' | 'merch' | 'experience';
  stock: number;
  description: string;
}

export interface RewardClaim {
  id: string;
  employee_id: string;
  reward_id: string;
  points_spent: number;
  status: 'pending' | 'delivered';
  claimed_at: string;
  reward?: RewardItem;
}

// ==========================================
// 10. WORKFLOW AUTOMATION & RESEND EMAIL
// ==========================================
export type AutomationTrigger =
  | 'on_employee_created'
  | 'on_leave_approved'
  | 'on_leave_rejected'
  | 'on_ticket_resolved'
  | 'on_appraisal_submitted'
  | 'on_expense_approved';

export interface AutomationRule {
  id: string;
  organization_id: string;
  name: string;
  trigger: AutomationTrigger;
  action_type: 'send_resend_email' | 'sync_calendar' | 'create_task' | 'send_push';
  is_active: boolean;
  target_recipient: string; // 'employee' | 'manager' | 'hr'
  template_subject: string;
  executions_count: number;
  last_executed_at?: string | null;
}

// ==========================================
// 11. SHIFTS & ROSTERS
// ==========================================
export interface WorkShift {
  id: string;
  organization_id: string;
  name: string;
  start_time: string;
  end_time: string;
  color: string;
  allowance_per_day: number;
  is_night_shift?: boolean;
  created_at?: string;
}

export interface EmployeeShift {
  id: string;
  employee_id: string;
  shift_id: string | null;
  date: string;
  organization_id: string;
  created_at?: string;
  shift?: WorkShift | null;
  employee?: Employee | null;
}


