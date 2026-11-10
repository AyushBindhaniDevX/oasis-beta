/**
 * Industry Configuration & Multi-Tenant Domain Generalization Engine
 * Powers cross-vertical adaptability for Hospitals, Banks, Technology, Manufacturing, Retail, and Corporate Enterprises.
 */

export type IndustryType =
  | 'healthcare'
  | 'banking'
  | 'technology'
  | 'manufacturing'
  | 'retail'
  | 'education'
  | 'corporate';

export interface IndustryTerminology {
  employee: string;
  employees: string;
  workplace: string;
  workplaces: string;
  department: string;
  departments: string;
  unit: string;
  units: string;
  manager: string;
  roster: string;
}

export interface IndustryPreset {
  id: IndustryType;
  label: string;
  sectorTag: string;
  description: string;
  color: string;
  bg: string;
  border: string;
  terminology: IndustryTerminology;
  defaultUnits: string[];
  suggestedDepartments: { name: string; description: string }[];
  suggestedShifts: { name: string; start: string; end: string }[];
  defaultFeatures: Record<string, boolean>;
}

export const INDUSTRY_PRESETS: Record<IndustryType, IndustryPreset> = {
  // ── 1. Healthcare & Hospitals ─────────────────────────────────────────────
  healthcare: {
    id: 'healthcare',
    label: 'Healthcare & Hospital Systems',
    sectorTag: 'Clinical & Hospital Network',
    description: 'Multi-specialty hospitals, clinical diagnostic centers, nursing homes, and outpatient networks.',
    color: '#0D9488',
    bg: '#CCFBF1',
    border: '#99F6E4',
    terminology: {
      employee: 'Staff / Doctor',
      employees: 'Doctors & Clinical Staff',
      workplace: 'Hospital Campus',
      workplaces: 'Hospital Units & Facilities',
      department: 'Clinical Speciality',
      departments: 'Specialities & Clinical Wards',
      unit: 'Hospital Unit / Sub-Brand',
      units: 'Hospital Units & Campuses',
      manager: 'Head of Department (HOD) / Medical Supdt',
      roster: 'Doctor Duty Roster & Night Shifts',
    },
    defaultUnits: [
      'Main Hospital Campus',
      'Specialty Care Centre',
      'Diagnostic & Outreach Clinic',
      'Home Health Care (HHC) Unit',
      'Administrative Wing',
    ],
    suggestedDepartments: [
      { name: 'Cardiology & Cath Lab', description: 'Invasive & non-invasive cardiology, ICU & Cath Lab operations.' },
      { name: 'Emergency & Trauma (24x7)', description: 'Critical care, emergency stabilization, and ambulance response.' },
      { name: 'Intensive Care Unit (ICU)', description: 'Multi-disciplinary critical care and ventilator support.' },
      { name: 'Radiology & Central Pathology', description: 'Diagnostic imaging, CT/MRI, biochemistry, and blood bank.' },
      { name: 'In-Patient Nursing Services', description: 'Ward administration, clinical nursing, and patient care.' },
      { name: 'General & Laparoscopic Surgery', description: 'Operation theatres, surgical suites, and day-care procedures.' },
      { name: 'Hospital Administration & Billing', description: 'Patient registration, TPA insurance, cashiering, and discharge.' },
      { name: 'Human Resources & Medical Staffing', description: 'Doctor credentialing, statutory compliances, and clinical rosters.' },
    ],
    suggestedShifts: [
      { name: 'Morning Clinical Shift', start: '08:00', end: '16:00' },
      { name: 'Evening Ward Shift', start: '14:00', end: '22:00' },
      { name: 'Emergency Night Shift', start: '20:00', end: '08:00' },
    ],
    defaultFeatures: {
      attendance: true,
      shifts: true,
      biometrics: true,
      geofencing: true,
      departments: true,
      leave: true,
      payroll: true,
      recruitment: true,
      performance: true,
      learning: true,
      assets: true,
      helpdesk: true,
      audit_logs: true,
      locations: true,
      templates: true,
      users: true,
      holidays: true,
    },
  },

  // ── 2. Banking & Financial Institutions ───────────────────────────────────
  banking: {
    id: 'banking',
    label: 'Banking & Financial Institutions',
    sectorTag: 'Banking & NBFC Network',
    description: 'Commercial banks, credit societies, NBFCs, wealth management firms, and insurance operations.',
    color: '#0284C7',
    bg: '#E0F2FE',
    border: '#BAE6FD',
    terminology: {
      employee: 'Bank Officer / Associate',
      employees: 'Officers & Banking Personnel',
      workplace: 'Branch / Regional Office',
      workplaces: 'Branches & Regional Zones',
      department: 'Banking Division',
      departments: 'Divisions & Functional Units',
      unit: 'Branch Code / Zonal Office',
      units: 'Branches & Zonal Offices',
      manager: 'Branch Manager / Chief General Manager',
      roster: 'Branch Operations & Clearing Timings',
    },
    defaultUnits: [
      'Head Office & Corporate Center',
      'Central Operations & Clearing Hub',
      'Metro Commercial Branch',
      'Retail Banking Zone',
      'Regional Treasury Office',
    ],
    suggestedDepartments: [
      { name: 'Retail Banking & Teller Operations', description: 'Frontline customer accounts, cash management, and counter services.' },
      { name: 'Credit Appraisal & Loans', description: 'Retail, SME, and corporate loan processing and underwriting.' },
      { name: 'Risk Management & Regulatory Compliance', description: 'AML, KYC monitoring, RBI regulatory reporting, and credit risk.' },
      { name: 'Treasury, Forex & Capital Markets', description: 'Interbank currency trading, liquidity, and investment portfolio.' },
      { name: 'Internal Audit & Vigilance', description: 'Branch inspection, compliance verification, and operational audits.' },
      { name: 'Digital Banking & IT Systems', description: 'Core Banking Solutions (CBS), mobile banking apps, and ATM networks.' },
      { name: 'Human Resources & Training Academy', description: 'Officer promotions, departmental transfers, and staff training.' },
      { name: 'Legal & Recovery Division', description: 'NPA recovery, debt resolution, and legal proceedings.' },
    ],
    suggestedShifts: [
      { name: 'General Banking Shift', start: '09:30', end: '18:30' },
      { name: 'Forex & Treasury Early Shift', start: '07:30', end: '16:00' },
      { name: 'ATM & Cash Transit Shift', start: '08:00', end: '17:00' },
    ],
    defaultFeatures: {
      attendance: true,
      shifts: true,
      biometrics: true,
      geofencing: true,
      departments: true,
      leave: true,
      payroll: true,
      recruitment: true,
      performance: true,
      learning: true,
      assets: true,
      helpdesk: true,
      audit_logs: true,
      locations: true,
      templates: true,
      users: true,
      holidays: true,
    },
  },

  // ── 3. Technology, Software & IT Enterprises ──────────────────────────────
  technology: {
    id: 'technology',
    label: 'Technology & Software Enterprises',
    sectorTag: 'Tech & SaaS Enterprise',
    description: 'Product SaaS startups, cloud engineering firms, IT services, and digital innovation hubs.',
    color: '#7C3AED',
    bg: '#F3EEFE',
    border: '#DDD6FE',
    terminology: {
      employee: 'Team Member / Engineer',
      employees: 'Engineers & Tech Personnel',
      workplace: 'Development Hub / Coworking Space',
      workplaces: 'Office Hubs & Remote Regions',
      department: 'Engineering Squad / Team',
      departments: 'Squads & Functional Departments',
      unit: 'Tech Hub / Regional Center',
      units: 'Development Hubs & Remote Regions',
      manager: 'Engineering Manager / Product Lead',
      roster: 'Sprint Rotations & On-Call Shifts',
    },
    defaultUnits: [
      'Global Headquarters (HQ)',
      'Engineering & R&D Campus',
      'Remote Workforce / Global Hub',
      'Client Delivery Center',
    ],
    suggestedDepartments: [
      { name: 'Frontend & Mobile Engineering', description: 'React, React Native, iOS, Android, and web client development.' },
      { name: 'Backend & Cloud Infrastructure', description: 'Microservices, APIs, database architecture, and DevOps/SRE.' },
      { name: 'Product Management & Design', description: 'Product roadmap, UX/UI design systems, and user research.' },
      { name: 'Quality Engineering & QA', description: 'Automated test pipelines, load testing, and release certification.' },
      { name: 'Data Engineering & AI/ML', description: 'Data pipelines, analytics warehouses, and machine learning models.' },
      { name: 'Customer Success & Technical Support', description: 'Client onboarding, SLA resolution, and solution architecture.' },
      { name: 'People Operations & Tech Recruiting', description: 'Technical hiring, employee experience, and compensation.' },
      { name: 'Sales & Enterprise Growth', description: 'Enterprise outbound sales, account executive management, and partnerships.' },
    ],
    suggestedShifts: [
      { name: 'Flexible Core Hours', start: '10:00', end: '19:00' },
      { name: 'US Client Support Shift', start: '18:00', end: '03:00' },
      { name: 'Europe Client Shift', start: '13:00', end: '22:00' },
    ],
    defaultFeatures: {
      attendance: true,
      shifts: true,
      geofencing: true,
      departments: true,
      leave: true,
      payroll: true,
      recruitment: true,
      performance: true,
      learning: true,
      assets: true,
      helpdesk: true,
      audit_logs: true,
      locations: true,
      templates: true,
      users: true,
      holidays: true,
      wfh: true,
    },
  },

  // ── 4. Manufacturing & Supply Chain ───────────────────────────────────────
  manufacturing: {
    id: 'manufacturing',
    label: 'Manufacturing, Plants & Supply Chain',
    sectorTag: 'Industrial & Plant Network',
    description: 'Factory assembly lines, heavy industries, automotive, chemical, and warehousing networks.',
    color: '#D97706',
    bg: '#FEF3C7',
    border: '#FDE68A',
    terminology: {
      employee: 'Plant Operator / Technician',
      employees: 'Operators & Plant Personnel',
      workplace: 'Manufacturing Plant / Warehouse',
      workplaces: 'Factory Plants & Distribution Hubs',
      department: 'Production Division / Line',
      departments: 'Production Lines & Quality Units',
      unit: 'Plant Unit / Factory Bay',
      units: 'Plants & Warehouse Units',
      manager: 'Plant Superintendent / General Manager',
      roster: 'Plant 3-Shift Industrial Rotation',
    },
    defaultUnits: [
      'Main Industrial Plant',
      'Raw Material Warehouse',
      'Finished Goods Distribution Center',
      'Corporate Administration Complex',
    ],
    suggestedDepartments: [
      { name: 'Production Line & Assembly', description: 'Shop floor manufacturing, machine operations, and assembly bays.' },
      { name: 'Quality Assurance & Metallurgical Lab', description: 'Batch testing, tolerance checks, and ISO manufacturing certification.' },
      { name: 'Supply Chain & Material Logistics', description: 'Inbound logistics, warehouse inventory, and fleet dispatch.' },
      { name: 'Plant Maintenance & Electrical', description: 'Preventive maintenance, heavy machinery, and power systems.' },
      { name: 'Environmental Health & Safety (EHS)', description: 'Workplace safety compliance, hazard audits, and PPE standards.' },
      { name: 'Industrial Relations & Plant HR', description: 'Factory payroll, labor welfare, union relations, and shift rosters.' },
      { name: 'Procurement & Vendor Management', description: 'Raw material purchasing, vendor contracts, and supplier billing.' },
    ],
    suggestedShifts: [
      { name: 'Morning Shift (Shift A)', start: '06:00', end: '14:00' },
      { name: 'Afternoon Shift (Shift B)', start: '14:00', end: '22:00' },
      { name: 'Night Shift (Shift C)', start: '22:00', end: '06:00' },
    ],
    defaultFeatures: {
      attendance: true,
      shifts: true,
      biometrics: true,
      geofencing: true,
      departments: true,
      leave: true,
      payroll: true,
      recruitment: true,
      performance: true,
      assets: true,
      helpdesk: true,
      audit_logs: true,
      locations: true,
      templates: true,
      users: true,
      holidays: true,
    },
  },

  // ── 5. Retail, FMCG & Hospitality ─────────────────────────────────────────
  retail: {
    id: 'retail',
    label: 'Retail, FMCG & Multi-Store Chains',
    sectorTag: 'Retail & Multi-Outlet Chain',
    description: 'Supermarket chains, fashion outlets, restaurants, hospitality resorts, and retail franchises.',
    color: '#EC4899',
    bg: '#FCE7F3',
    border: '#FBCFE8',
    terminology: {
      employee: 'Store Associate / Team Member',
      employees: 'Store Associates & Retail Staff',
      workplace: 'Store Location / Outlet',
      workplaces: 'Stores & Retail Outlets',
      department: 'Store Department / Section',
      departments: 'Store Sections & Operational Teams',
      unit: 'Store Code / Franchise Outlet',
      units: 'Store Locations & Outlets',
      manager: 'Store General Manager / Territory Lead',
      roster: 'Floor Roster & Weekend Shifts',
    },
    defaultUnits: [
      'Flagship Downtown Store',
      'Mall Outlet Branch',
      'Central Fulfillment Hub',
      'Regional Corporate Office',
    ],
    suggestedDepartments: [
      { name: 'Store Floor & Customer Sales', description: 'Floor customer advisory, product display, and shelf stocking.' },
      { name: 'Cash Counter & POS Billing', description: 'Checkout registers, digital payment reconciliation, and returns.' },
      { name: 'Inventory & Stockroom Logistics', description: 'Goods receiving, barcode scanning, shrinkage, and restocking.' },
      { name: 'Merchandising & Visual Design', description: 'Window displays, promotional banners, and product layout.' },
      { name: 'Loss Prevention & Security', description: 'Store surveillance, entrance bag checks, and loss mitigation.' },
      { name: 'Retail Store HR & Staffing', description: 'Weekend temp staffing, overtime approvals, and store commissions.' },
    ],
    suggestedShifts: [
      { name: 'Store Opening Shift', start: '09:00', end: '18:00' },
      { name: 'Store Peak Evening Shift', start: '13:00', end: '22:00' },
      { name: 'Inventory Restocking Shift', start: '21:00', end: '06:00' },
    ],
    defaultFeatures: {
      attendance: true,
      shifts: true,
      biometrics: true,
      geofencing: true,
      departments: true,
      leave: true,
      payroll: true,
      recruitment: true,
      performance: true,
      assets: true,
      helpdesk: true,
      audit_logs: true,
      locations: true,
      templates: true,
      users: true,
      holidays: true,
    },
  },

  // ── 6. Education, Universities & Schools ──────────────────────────────────
  education: {
    id: 'education',
    label: 'Education, Universities & Institutions',
    sectorTag: 'Academic & University Campus',
    description: 'Higher education universities, private colleges, K-12 school networks, and research academies.',
    color: '#4F46E5',
    bg: '#EEF2FF',
    border: '#C7D2FE',
    terminology: {
      employee: 'Faculty Member / Staff',
      employees: 'Faculty, Professors & Academic Staff',
      workplace: 'University Campus / School Wing',
      workplaces: 'Campuses & Educational Centers',
      department: 'Academic Faculty / School',
      departments: 'Faculties & Academic Departments',
      unit: 'Campus Wing / College Branch',
      units: 'Campuses & Institutes',
      manager: 'Dean / Principal / Department Chair',
      roster: 'Lecture Roster & Lab Schedules',
    },
    defaultUnits: [
      'Main University Campus',
      'Medical & Science Complex',
      'Engineering & Technology Wing',
      'Administrative Directorate',
    ],
    suggestedDepartments: [
      { name: 'School of Medicine & Health Sciences', description: 'Clinical professorships, hospital residencies, and medical labs.' },
      { name: 'Faculty of Engineering & Technology', description: 'Computer science, mechanical, and electrical academic streams.' },
      { name: 'Faculty of Commerce & Management', description: 'Finance, accounting, marketing, and business administration.' },
      { name: 'Examination & Student Affairs', description: 'Admissions, exam schedules, student grading, and certification.' },
      { name: 'Central Library & Digital Archives', description: 'Library cataloging, academic journal subscriptions, and study halls.' },
      { name: 'University Administration & HR', description: 'Faculty tenure, academic leave, UGC compliance, and payroll.' },
    ],
    suggestedShifts: [
      { name: 'Full Academic Day Shift', start: '08:30', end: '16:30' },
      { name: 'Evening Lecture Shift', start: '13:00', end: '20:30' },
    ],
    defaultFeatures: {
      attendance: true,
      shifts: true,
      biometrics: true,
      geofencing: true,
      departments: true,
      leave: true,
      payroll: true,
      recruitment: true,
      performance: true,
      learning: true,
      assets: true,
      helpdesk: true,
      audit_logs: true,
      locations: true,
      templates: true,
      users: true,
      holidays: true,
    },
  },

  // ── 7. Corporate & General Enterprise (Universal Fallback) ────────────────
  corporate: {
    id: 'corporate',
    label: 'Corporate & Multi-National Enterprise',
    sectorTag: 'Enterprise Conglomerate',
    description: 'Universal enterprise architecture adaptable to any business model, consultancy, or group of companies.',
    color: '#0D7377',
    bg: '#E6FFFA',
    border: '#B2F5EA',
    terminology: {
      employee: 'Employee',
      employees: 'Employees & Workforce',
      workplace: 'Office Location / Workplace',
      workplaces: 'Office Locations & Workplaces',
      department: 'Department',
      departments: 'Departments & Divisions',
      unit: 'Business Unit / Branch',
      units: 'Business Units & Branches',
      manager: 'Department Head / Manager',
      roster: 'Weekly Work Schedules & Shifts',
    },
    defaultUnits: [
      'Headquarters (HQ)',
      'Main Branch',
      'Operations Unit',
      'Regional Office',
    ],
    suggestedDepartments: [
      { name: 'Finance & Accounts', description: 'Financial statements, budgeting, corporate treasury, and invoicing.' },
      { name: 'Human Resources & Administration', description: 'Talent lifecycle, organizational culture, compliance, and compensation.' },
      { name: 'Sales & Business Development', description: 'Client acquisition, commercial proposals, and revenue generation.' },
      { name: 'Marketing & Corporate Communications', description: 'Brand management, public relations, and digital marketing.' },
      { name: 'Operations & Facilities', description: 'Workplace management, business operations, and supply chain.' },
      { name: 'Information Technology & Systems', description: 'Enterprise IT infrastructure, security, and employee helpdesk.' },
      { name: 'Legal & Regulatory Compliance', description: 'Contract management, corporate governance, and legal affairs.' },
    ],
    suggestedShifts: [
      { name: 'Standard Business Shift', start: '09:00', end: '18:00' },
      { name: 'Operations Shift', start: '08:00', end: '17:00' },
    ],
    defaultFeatures: {
      attendance: true,
      shifts: true,
      biometrics: true,
      geofencing: true,
      departments: true,
      leave: true,
      payroll: true,
      recruitment: true,
      performance: true,
      learning: true,
      assets: true,
      helpdesk: true,
      audit_logs: true,
      locations: true,
      templates: true,
      users: true,
      holidays: true,
      wfh: true,
    },
  },
};

/**
 * Detect industry from organization object or settings string
 */
export function resolveOrganizationIndustry(org?: {
  settings?: Record<string, any>;
  name?: string;
  id?: string;
} | null): IndustryType {
  if (!org) return 'corporate';

  // 1. Check explicit setting
  const indSetting = String(org.settings?.industry || '').toLowerCase();
  if (indSetting.includes('health') || indSetting.includes('hospital') || indSetting.includes('clinic')) return 'healthcare';
  if (indSetting.includes('bank') || indSetting.includes('financ') || indSetting.includes('nbfc') || indSetting.includes('insurance')) return 'banking';
  if (indSetting.includes('tech') || indSetting.includes('software') || indSetting.includes('it ') || indSetting.includes('saas')) return 'technology';
  if (indSetting.includes('manuf') || indSetting.includes('plant') || indSetting.includes('factory') || indSetting.includes('industrial')) return 'manufacturing';
  if (indSetting.includes('retail') || indSetting.includes('fmcg') || indSetting.includes('store') || indSetting.includes('hotel') || indSetting.includes('hospitality')) return 'retail';
  if (indSetting.includes('edu') || indSetting.includes('univ') || indSetting.includes('school') || indSetting.includes('college')) return 'education';

  // 2. Fallback to name heuristic
  const normName = String(org.name || org.id || '').toLowerCase();
  if (normName.includes('hospital') || normName.includes('health') || normName.includes('clinic') || normName.includes('shanti')) return 'healthcare';
  if (normName.includes('bank') || normName.includes('finance') || normName.includes('capital')) return 'banking';
  if (normName.includes('tech') || normName.includes('software') || normName.includes('labs') || normName.includes('subedge')) return 'technology';

  return 'corporate';
}

/**
 * Get dynamic terminology for an organization
 */
export function getOrganizationTerminology(org?: {
  settings?: Record<string, any>;
  name?: string;
  id?: string;
} | null): IndustryTerminology {
  const ind = resolveOrganizationIndustry(org);
  return INDUSTRY_PRESETS[ind].terminology;
}

