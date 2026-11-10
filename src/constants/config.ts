import {
  INDUSTRY_PRESETS,
  resolveOrganizationIndustry,
  getOrganizationTerminology,
  type IndustryType,
  type IndustryTerminology,
  type IndustryPreset,
} from './industries';

export {
  INDUSTRY_PRESETS,
  resolveOrganizationIndustry,
  getOrganizationTerminology,
};
export type { IndustryType, IndustryTerminology, IndustryPreset };

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
  'Shanti Memorial Hospital - Cuttack',
  'Chikitsa',
  'Gopal Trust',
  'Main Branch',
  'Branch Office',
] as const;

export const ORGANIZATION_UNITS = BUSINESS_UNITS;
export const HOSPITAL_UNITS = BUSINESS_UNITS;

export type BusinessUnit = (typeof BUSINESS_UNITS)[number] | string;
export type HospitalUnit = BusinessUnit;

/**
 * Multi-Tenant Helper: Check if an organization is Shanti Memorial Hospital.
 * (HHC / Home Health Care is strictly scoped to Shanti Memorial Hospital only).
 */
export function isShantiHospitalOrg(orgId?: string | null, orgName?: string | null): boolean {
  if (!orgId && !orgName) return false;
  const normId = (orgId || '').toLowerCase().trim();
  const normName = (orgName || '').toLowerCase().trim();
  return (
    normId === 'shanti-memorial-hospital' ||
    normId === 'smh' ||
    normName.includes('shanti')
  );
}

/**
 * Multi-Tenant Helper: Get default unit/brand names scoped strictly to a specific organization.
 * Supports custom database-configured units, industry-tailored defaults, and hospital unit mappings.
 */
export function getTenantDefaultUnits(
  orgName?: string | null,
  orgId?: string | null,
  customUnits?: string[],
  industryHint?: string
): string[] {
  // 1. If organization has custom units configured in database, prioritize them
  if (customUnits && Array.isArray(customUnits) && customUnits.length > 0) {
    return customUnits;
  }

  // 2. Specific known tenants
  if (isShantiHospitalOrg(orgId, orgName)) {
    return [
      'Shanti Memorial Hospital - Cuttack',
      'Chikitsa',
      'Gopal Trust',
    ];
  }

  // 3. Fallback to dynamic industry preset units
  const industry = resolveOrganizationIndustry({
    name: orgName || undefined,
    id: orgId || undefined,
    settings: industryHint ? { industry: industryHint } : undefined,
  });

  const preset = INDUSTRY_PRESETS[industry];
  if (preset && preset.defaultUnits && preset.defaultUnits.length > 0) {
    return preset.defaultUnits;
  }

  const primary = orgName ? `${orgName} - Headquarters` : 'Headquarters';
  return [primary, 'Main Branch', 'Branch Office'];
}

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
