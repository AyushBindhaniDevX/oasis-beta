export const COMPANY_NAME = 'Subedge Technology Pvt Ltd';
export const PRODUCT_NAME = 'Oasis Platform: Oasis HRMS';
export const APP_NAME = 'Oasis HRMS';
export const TAGLINE = 'Enterprise Workforce & Human Capital Management';
export const POWERED_BY = 'Subedge Technology Pvt Ltd';
export const WEBSITE_URL = 'https://subedge.vercel.app/';

export const WORKING_HOURS = {
  start: 9, // 9 AM
  end: 18, // 6 PM
  lateThresholdMinutes: 15,
};

export const DEFAULT_GEOFENCE_RADIUS = 150; // meters

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const BUSINESS_UNITS = [
  'Headquarters',
  'Branch Office',
  'Operations Unit',
  'Corporate Campus',
  'Main Branch',
] as const;

export const ORGANIZATION_UNITS = BUSINESS_UNITS;
export const HOSPITAL_UNITS = BUSINESS_UNITS;

export type BusinessUnit = (typeof BUSINESS_UNITS)[number] | string;
export type HospitalUnit = BusinessUnit;

export const EMPLOYMENT_TYPES = [
  { label: 'Regular', value: 'Regular' },
  { label: 'Contractual', value: 'Contractual' },
] as const;

export type EmploymentTypeCategory = 'Regular' | 'Contractual';

export function normalizeBusinessUnit(raw?: string | null, defaultUnit = 'Main Branch'): string {
  if (!raw) return defaultUnit;
  const trimmed = raw.trim();
  if (!trimmed) return defaultUnit;
  return trimmed;
}

export const normalizeHospitalUnit = normalizeBusinessUnit;

export function normalizeEmploymentType(raw?: string | null): 'Regular' | 'Contractual' {
  if (!raw) return 'Regular';
  const l = raw.toLowerCase().trim();
  if (l.includes('contract')) return 'Contractual';
  return 'Regular';
}
