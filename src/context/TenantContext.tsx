import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  limit,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import type {
  Organization,
  Workplace,
  Employee,
  SubscriptionPlan,
  OrganizationFeatures,
} from '@/types';
import {
  COMPANY_NAME,
  resolveOrganizationIndustry,
  INDUSTRY_PRESETS,
  getTenantDefaultUnits,
  type IndustryType,
  type IndustryTerminology,
} from '@/constants/config';
import { invalidateOrgMetaCache, invalidateEmployeeCache } from '@/lib/services/employee';

// Default modular feature allocations per subscription tier
export const PLAN_FEATURE_DEFAULTS: Record<SubscriptionPlan, OrganizationFeatures> = {
  starter: {
    payroll: false,
    biometrics: false,
    geofencing: true,
    performance: false,
    learning: false,
    recruitment: false,
    expenses: false,
    helpdesk: false,
    assets: false,
    audit_logs: false,
    wfh: false,
    attendance: true,
    leave: true,
    holidays: true,
    shifts: true,
    departments: true,
    users: true,
    locations: true,
    directory: true,
    templates: true,
  },
  growth: {
    payroll: true,
    biometrics: false,
    geofencing: true,
    performance: true,
    learning: false,
    recruitment: false,
    expenses: false,
    helpdesk: true,
    assets: false,
    audit_logs: false,
    wfh: true,
    attendance: true,
    leave: true,
    holidays: true,
    shifts: true,
    departments: true,
    users: true,
    locations: true,
    directory: true,
    templates: true,
  },
  enterprise: {
    payroll: true,
    biometrics: true,
    geofencing: true,
    performance: true,
    learning: true,
    recruitment: false,
    expenses: false,
    helpdesk: true,
    assets: false,
    audit_logs: true,
    wfh: true,
    attendance: true,
    leave: true,
    holidays: true,
    shifts: true,
    departments: true,
    users: true,
    locations: true,
    directory: true,
    templates: true,
  },
};

export interface TenantContextState {
  organization: Organization | null;
  workplace: Workplace | null;
  employee: Employee | null;
  allOrganizations: Organization[];
  authorizedOrganizations: Organization[];
  canSwitchOrganization: boolean;
  primaryColor: string;
  companyName: string;
  companyLogoUrl: string | null;
  officeName: string;
  activePlan: SubscriptionPlan;
  features: OrganizationFeatures;
  industry: IndustryType;
  terminology: IndustryTerminology;
  units: string[];
  isLoadingTenant: boolean;
  refreshTenant: () => Promise<void>;
  switchOrganization: (orgId: string) => Promise<void>;
  isFeatureEnabled: (featureKey: string) => boolean;
  updateOrganizationPlan: (orgId: string, plan: SubscriptionPlan) => Promise<void>;
  toggleFeatureLock: (orgId: string, featureKey: string, isUnlocked: boolean) => Promise<void>;
  createOrganization: (data: {
    name: string;
    slug: string;
    logo_url?: string;
    primary_color?: string;
    plan?: SubscriptionPlan;
    industry?: IndustryType;
    address?: string;
    units?: string[];
  }) => Promise<Organization>;
  updateOrganization: (orgId: string, data: Partial<Organization>) => Promise<void>;
  deleteOrganization: (orgId: string) => Promise<void>;
  updateOrganizationUnits: (orgId: string, units: string[]) => Promise<void>;
}

const TenantContext = createContext<TenantContextState | undefined>(undefined);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { profile, isAuthenticated } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [workplace, setWorkplace] = useState<Workplace | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [allOrganizations, setAllOrganizations] = useState<Organization[]>([]);
  const [manualOrgId, setManualOrgId] = useState<string | null>(null);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [isLoadingTenant, setIsLoadingTenant] = useState(false);

  // Restore stored organization context on boot
  useEffect(() => {
    AsyncStorage.getItem('@oasis_active_org_id').then((saved) => {
      if (saved) setManualOrgId(saved);
    }).catch(() => {});
  }, []);

  // Fetch all unique tenant organizations
  const fetchAllOrganizations = useCallback(async () => {
    try {
      const orgsSnap = await getDocs(collection(db, 'organizations'));
      const orgMap = new Map<string, Organization>();

      // First pass: collect any child units that declare a parent_organization_id
      const subUnitsMap = new Map<string, string[]>();
      subUnitsMap.set('shanti-memorial-hospital', [
        'Shanti Memorial Hospital - Cuttack',
        'Chikitsa',
        'Gopal Trust',
      ]);
      subUnitsMap.set('00000000-0000-0000-0000-000000000001', [
        'Subedge - Headquarters',
        'Main Branch',
        'Branch Office',
      ]);

      for (const d of orgsSnap.docs) {
        const data = d.data() as any;
        const pId = data.parent_organization_id || (d.id === 'chikitsa' || d.id === 'gopal-trust' ? 'shanti-memorial-hospital' : null);
        if (pId) {
          const currentList = subUnitsMap.get(pId) || [];
          if (data.name && !currentList.includes(data.name)) {
            currentList.push(data.name);
          }
          subUnitsMap.set(pId, currentList);
        }
      }

      // Second pass: register only root client organizations
      for (const d of orgsSnap.docs) {
        const data = d.data() as any;
        const normalizedName = (data.name || d.id).toLowerCase().trim();
        // Skip short slug aliases
        if (d.id === 'smh' || d.id === 'oasis' || d.id === 'subedge') continue;
        // Child units belong to their parent organization, not as separate top-level tenants
        if (data.parent_organization_id || data.is_unit || d.id === 'chikitsa' || d.id === 'gopal-trust') continue;

        if (!orgMap.has(normalizedName)) {
          let finalUnits: string[];
          if (Array.isArray(data.units)) {
            finalUnits = data.units.filter((u: any) => typeof u === 'string' && u.trim().length > 0);
          } else {
            const childUnits = subUnitsMap.get(d.id) || [];
            const defaultUnits = getTenantDefaultUnits(data.name, d.id);
            finalUnits = Array.from(new Set([...defaultUnits, ...childUnits]));
          }

          orgMap.set(normalizedName, {
            ...data,
            id: d.id,
            units: finalUnits,
          });
        }
      }
      setAllOrganizations(Array.from(orgMap.values()));
    } catch (err) {
      if ((err as any)?.code !== 'permission-denied') { console.warn('Error fetching all organizations:', err); }
    }
  }, []);

  const fetchTenantData = useCallback(async () => {
    setIsLoadingTenant(true);
    try {
      let resolvedOrg: Organization | null = null;
      let targetOrgId = manualOrgId || profile?.organization_id;
      if (
        !manualOrgId &&
        (profile?.email === 'ayushbindhani001@gmail.com' || profile?.email === 'ab3682@srmist.edu.in') &&
        (!targetOrgId || targetOrgId === '00000000-0000-0000-0000-000000000001' || targetOrgId === 'subedge')
      ) {
        targetOrgId = 'shanti-memorial-hospital';
      }
      if (targetOrgId === 'chikitsa' || targetOrgId === 'gopal-trust' || targetOrgId === 'smh') {
        targetOrgId = 'shanti-memorial-hospital';
      } else if (targetOrgId === 'subedge') {
        targetOrgId = '00000000-0000-0000-0000-000000000001';
      }

      // 1. Resolve organization by explicit ID or profile ID
      if (targetOrgId) {
        const orgRef = doc(db, 'organizations', targetOrgId);
        const orgSnap = await getDoc(orgRef);
        if (orgSnap.exists()) {
          const orgData = { id: orgSnap.id, ...orgSnap.data() } as any;
          // If this is a child unit/sub-brand, resolve to the parent tenant organization
          const parentId = orgData.parent_organization_id || (orgSnap.id === 'chikitsa' || orgSnap.id === 'gopal-trust' ? 'shanti-memorial-hospital' : null);
          if (parentId) {
            const parentRef = doc(db, 'organizations', parentId);
            const parentSnap = await getDoc(parentRef);
            if (parentSnap.exists()) {
              resolvedOrg = { id: parentSnap.id, ...parentSnap.data() } as Organization;
            } else {
              resolvedOrg = orgData as Organization;
            }
          } else {
            resolvedOrg = orgData as Organization;
          }
        }
      }

      // 2. Fallback to Shanti Memorial Hospital or first available
      if (!resolvedOrg) {
        const smhRef = doc(db, 'organizations', 'shanti-memorial-hospital');
        const smhSnap = await getDoc(smhRef);
        if (smhSnap.exists()) {
          resolvedOrg = { id: smhSnap.id, ...smhSnap.data() } as Organization;
        } else {
          const orgsQ = query(collection(db, 'organizations'), limit(1));
          const orgsSnap = await getDocs(orgsQ);
          if (!orgsSnap.empty) {
            const firstOrgDoc = orgsSnap.docs[0];
            resolvedOrg = { id: firstOrgDoc.id, ...firstOrgDoc.data() } as Organization;
          }
        }
      }

      setOrganization(resolvedOrg);
      if (resolvedOrg?.id) {
        setCurrentOrgId(resolvedOrg.id);
      }

      // 3. Fetch employee record for the current active organization
      let currentEmp: Employee | null = null;
      let currentWp: Workplace | null = null;

      if (profile?.id && resolvedOrg) {
        const empQ = query(
          collection(db, 'employees'),
          where('profile_id', '==', profile.id),
          where('organization_id', '==', resolvedOrg.id),
          limit(1)
        );
        const empSnap = await getDocs(empQ);

        if (!empSnap.empty) {
          const empDoc = empSnap.docs[0];
          currentEmp = { id: empDoc.id, ...empDoc.data() } as Employee;
          setEmployee(currentEmp);

          if (currentEmp.workplace_id) {
            const wpRef = doc(db, 'workplaces', currentEmp.workplace_id);
            const wpSnap = await getDoc(wpRef);
            if (wpSnap.exists()) {
              currentWp = { id: wpSnap.id, ...wpSnap.data() } as Workplace;
              setWorkplace(currentWp);
            }
          }
        } else {
          // Check employee record across any org
          const anyEmpQ = query(
            collection(db, 'employees'),
            where('profile_id', '==', profile.id),
            limit(1)
          );
          const anyEmpSnap = await getDocs(anyEmpQ);
          if (!anyEmpSnap.empty) {
            currentEmp = { id: anyEmpSnap.docs[0].id, ...anyEmpSnap.docs[0].data() } as Employee;
            setEmployee(currentEmp);
          }
        }
      }

      // 4. Default workplace fallback if not assigned
      if (!currentWp && resolvedOrg) {
        const wpQ = query(
          collection(db, 'workplaces'),
          where('organization_id', '==', resolvedOrg.id),
          limit(1)
        );
        const wpSnap = await getDocs(wpQ);
        if (!wpSnap.empty) {
          const wpDoc = wpSnap.docs[0];
          setWorkplace({ id: wpDoc.id, ...wpDoc.data() } as Workplace);
        }
      }
    } catch (err) {
      console.error('Error fetching tenant details:', err);
    } finally {
      setIsLoadingTenant(false);
    }
  }, [profile, manualOrgId]);

  const isSuperAdmin = Boolean(
    profile?.email === 'ayushbindhani001@gmail.com' ||
    profile?.email === 'ab3682@srmist.edu.in' ||
    (profile?.role as any) === 'superadmin'
  );

  // Authorized organizations for the signed in user
  const authorizedOrganizations = useMemo(() => {
    if (isSuperAdmin) {
      return allOrganizations;
    }
    // Check if user has multiple authorized organizations assigned
    const explicitIds = (profile as any)?.authorized_organization_ids;
    if (Array.isArray(explicitIds) && explicitIds.length > 0) {
      const allowed = allOrganizations.filter((o) => explicitIds.includes(o.id));
      if (allowed.length > 0) return allowed;
    }

    // Standard user: strictly scoped to single assigned organization
    const targetOrgId = organization?.id || profile?.organization_id;
    if (!targetOrgId) {
      return allOrganizations.slice(0, 1);
    }
    const matched = allOrganizations.filter(
      (o) => o.id === targetOrgId || (organization?.slug && o.slug === organization.slug)
    );
    return matched.length > 0 ? matched : (organization ? [organization] : []);
  }, [isSuperAdmin, allOrganizations, profile, organization]);

  const canSwitchOrganization = authorizedOrganizations.length > 1;

  // Switch active organization context
  const switchOrganization = useCallback(async (orgId: string) => {
    let targetId = orgId;
    if (targetId === 'chikitsa' || targetId === 'gopal-trust' || targetId === 'smh') {
      targetId = 'shanti-memorial-hospital';
    } else if (targetId === 'subedge') {
      targetId = '00000000-0000-0000-0000-000000000001';
    }

    // Validate access: Ensure user is authorized to switch to this organization
    if (!isSuperAdmin) {
      const isAllowed = authorizedOrganizations.some(
        (o) => o.id === targetId || (o.slug && o.slug === targetId)
      );
      if (!isAllowed) {
        console.warn('Unauthorized organization switch attempt blocked:', targetId);
        return;
      }
    }

    try {
      const snap = await getDoc(doc(db, 'organizations', targetId));
      if (snap.exists() && (snap.data() as any)?.parent_organization_id) {
        targetId = (snap.data() as any).parent_organization_id;
      }
    } catch {}

    // Invalidate service caches before updating state to prevent stale data bleed
    invalidateOrgMetaCache();
    invalidateEmployeeCache();

    setManualOrgId(targetId);
    try {
      await AsyncStorage.setItem('@oasis_active_org_id', targetId);
    } catch {}
    if (profile?.id) {
      try {
        await updateDoc(doc(db, 'profiles', profile.id), {
          organization_id: targetId,
          updated_at: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('Profile organization update note:', err);
      }
    }
    await fetchTenantData();
  }, [profile?.id, isSuperAdmin, authorizedOrganizations, fetchTenantData]);

  // Compute active plan
  const activePlan: SubscriptionPlan = useMemo(() => {
    const rawPlan = organization?.plan || organization?.package_type;
    if (rawPlan === 'enterprise' || rawPlan === 'gold') return 'enterprise';
    if (rawPlan === 'growth' || rawPlan === 'silver') return 'growth';
    return 'starter';
  }, [organization?.plan, organization?.package_type]);

  // Compute resolved features
  const features: OrganizationFeatures = useMemo(() => {
    const defaults = PLAN_FEATURE_DEFAULTS[activePlan] || PLAN_FEATURE_DEFAULTS.starter;
    const orgFeatures = organization?.features || {};
    return { ...defaults, ...orgFeatures };
  }, [activePlan, organization?.features]);

  // Check if a specific feature is enabled
  const isFeatureEnabled = useCallback((featureKey: string): boolean => {
    if (featureKey === 'templates') return true; // Templates unlocked to all
    if (organization?.features && typeof organization.features[featureKey] === 'boolean') {
      return organization.features[featureKey] as boolean;
    }
    const defaults = PLAN_FEATURE_DEFAULTS[activePlan] || PLAN_FEATURE_DEFAULTS.starter;
    return Boolean(defaults[featureKey]);
  }, [organization?.features, activePlan]);

  // Update subscription plan for an organization
  const updateOrganizationPlan = useCallback(async (orgId: string, plan: SubscriptionPlan) => {
    const planDefaults = PLAN_FEATURE_DEFAULTS[plan];
    await updateDoc(doc(db, 'organizations', orgId), {
      plan,
      package_type: plan,
      features: planDefaults,
      max_employees: plan === 'enterprise' ? 1000 : 500,
      updated_at: new Date().toISOString(),
    });
    await fetchAllOrganizations();
    await fetchTenantData();
  }, [fetchAllOrganizations, fetchTenantData]);

  // Toggle individual feature lock/unlock for an organization
  const toggleFeatureLock = useCallback(async (orgId: string, featureKey: string, isUnlocked: boolean) => {
    try {
      await updateDoc(doc(db, 'organizations', orgId), {
        [`features.${featureKey}`]: isUnlocked,
        updated_at: new Date().toISOString(),
      });
    } catch {
      await setDoc(
        doc(db, 'organizations', orgId),
        {
          features: {
            [featureKey]: isUnlocked,
          },
          updated_at: new Date().toISOString(),
        },
        { merge: true }
      );
    }
    await fetchAllOrganizations();
    await fetchTenantData();
  }, [fetchAllOrganizations, fetchTenantData]);

  // Create a new organization
  const createOrganization = useCallback(async (data: {
    name: string;
    slug: string;
    logo_url?: string;
    primary_color?: string;
    plan?: SubscriptionPlan;
    industry?: IndustryType;
    address?: string;
    units?: string[];
  }): Promise<Organization> => {
    const orgId = data.slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-');
    const selectedPlan = data.plan || 'growth';
    const now = new Date().toISOString();
    const resolvedIndustry: IndustryType = data.industry || resolveOrganizationIndustry({ name: data.name, id: orgId });
    const industryPreset = INDUSTRY_PRESETS[resolvedIndustry];
    const resolvedUnits = data.units && data.units.length > 0
      ? data.units
      : (industryPreset?.defaultUnits || [data.name, 'Main Branch', 'Branch Office']);

    const newOrg: Organization = {
      id: orgId,
      name: data.name,
      slug: orgId,
      logo_url: data.logo_url || null,
      primary_color: data.primary_color || industryPreset?.color || '#0D7377',
      accent_color: '#14B8A6',
      plan: selectedPlan,
      package_type: selectedPlan,
      features: PLAN_FEATURE_DEFAULTS[selectedPlan],
      max_employees: selectedPlan === 'enterprise' ? 1000 : 500,
      units: resolvedUnits,
      settings: {
        industry: industryPreset?.label || 'Corporate & General Enterprise',
        industry_type: resolvedIndustry,
        address: data.address || 'Corporate Headquarters',
        working_hours_start: '09:00',
        working_hours_end: '18:00',
        default_radius_meters: 250,
        currency: 'INR',
        timezone: 'Asia/Kolkata',
      },
      created_at: now,
      updated_at: now,
    };

    await setDoc(doc(db, 'organizations', orgId), newOrg);

    // Create default primary workplace
    const wpId = `wp-${orgId}-main`;
    await setDoc(doc(db, 'workplaces', wpId), {
      id: wpId,
      organization_id: orgId,
      name: `${data.name} - Primary Campus`,
      address: data.address || 'Headquarters',
      latitude: 20.4625,
      longitude: 85.8830,
      radius_meters: 250,
      is_active: true,
      created_at: now,
    });

    await fetchAllOrganizations();
    return newOrg;
  }, [fetchAllOrganizations]);

  // Update an existing organization
  const updateOrganization = useCallback(async (orgId: string, data: Partial<Organization>) => {
    const orgRef = doc(db, 'organizations', orgId);
    const updatePayload: Record<string, any> = {
      ...data,
      updated_at: new Date().toISOString(),
    };
    delete updatePayload.id;

    await setDoc(orgRef, updatePayload, { merge: true });
    await fetchAllOrganizations();
    await fetchTenantData();
  }, [fetchAllOrganizations, fetchTenantData]);

  // Delete an organization and clean up primary workplaces
  const deleteOrganization = useCallback(async (orgId: string) => {
    await deleteDoc(doc(db, 'organizations', orgId));

    try {
      const wpSnap = await getDocs(query(collection(db, 'workplaces'), where('organization_id', '==', orgId)));
      for (const d of wpSnap.docs) {
        await deleteDoc(doc(db, 'workplaces', d.id));
      }
    } catch (wpErr) {
      console.warn('Note: cleaning up workplaces:', wpErr);
    }

    if (organization?.id === orgId) {
      const remaining = allOrganizations.filter((o) => o.id !== orgId);
      if (remaining.length > 0) {
        await switchOrganization(remaining[0].id);
      }
    }

    await fetchAllOrganizations();
    await fetchTenantData();
  }, [allOrganizations, fetchAllOrganizations, fetchTenantData, organization?.id, switchOrganization]);

  // Update units / sub-brands array for an organization
  const updateOrganizationUnits = useCallback(async (orgId: string, units: string[]) => {
    const cleanedUnits = Array.from(new Set(units.map((u) => u.trim()).filter((u) => u.length > 0)));
    
    // 1. Save to Firestore organization document
    await setDoc(doc(db, 'organizations', orgId), {
      units: cleanedUnits,
      updated_at: new Date().toISOString(),
    }, { merge: true });

    // 2. If SMH alias exists, keep it in sync
    if (orgId === 'shanti-memorial-hospital') {
      try {
        await setDoc(doc(db, 'organizations', 'smh'), {
          units: cleanedUnits,
          updated_at: new Date().toISOString(),
        }, { merge: true });
      } catch {}
    }

    // 3. Sync workplaces collection so geofences and unit locations match
    try {
      const isSMH = orgId === 'shanti-memorial-hospital' || orgId === 'smh';
      const wpQuery = query(
        collection(db, 'workplaces'),
        where('organization_id', '==', isSMH ? 'shanti-memorial-hospital' : orgId)
      );
      const wpSnap = await getDocs(wpQuery);
      const existingWpNames = new Set<string>();
      wpSnap.docs.forEach((d) => {
        const wpData = d.data();
        if (wpData.name) existingWpNames.add(wpData.name.trim().toLowerCase());
      });

      // Add missing units as active workplaces
      for (const unitName of cleanedUnits) {
        if (!existingWpNames.has(unitName.toLowerCase())) {
          const wpId = `wp-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
          await setDoc(doc(db, 'workplaces', wpId), {
            id: wpId,
            organization_id: isSMH ? 'shanti-memorial-hospital' : orgId,
            name: unitName,
            address: isSMH ? 'Manglabag, Thoria Sahi, Cuttack, Odisha 753001' : 'Main Workplace Campus',
            latitude: isSMH ? 20.46933 : 13.0403,
            longitude: isSMH ? 85.88301 : 80.22957,
            radius_meters: 500,
            is_active: true,
            created_at: new Date().toISOString(),
          });
        }
      }
    } catch (wpErr) {
      console.warn('Could not auto-sync workplaces:', wpErr);
    }

    // 4. Invalidate caches
    invalidateOrgMetaCache();
    invalidateEmployeeCache();

    // 5. Optimistic local state update
    setAllOrganizations((prev) =>
      prev.map((o) => (o.id === orgId ? { ...o, units: cleanedUnits } : o))
    );
    if (organization?.id === orgId) {
      setOrganization((prev) => (prev ? { ...prev, units: cleanedUnits } : null));
    }

    // 6. Full refresh
    await fetchAllOrganizations();
    await fetchTenantData();
  }, [fetchAllOrganizations, fetchTenantData, organization?.id]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchAllOrganizations();
      fetchTenantData();
    } else {
      setOrganization(null);
      setCurrentOrgId(null);
      setWorkplace(null);
      setEmployee(null);
      setAllOrganizations([]);
    }
  }, [isAuthenticated, fetchTenantData, fetchAllOrganizations]);

  // Real-time synchronization of active organization features & plan
  useEffect(() => {
    if (!isAuthenticated || !currentOrgId) return;

    const orgDocRef = doc(db, 'organizations', currentOrgId);
    const unsubscribe = onSnapshot(
      orgDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const freshData = { id: docSnap.id, ...docSnap.data() } as Organization;
          setOrganization((prev) => {
            if (!prev) return freshData;
            const featuresChanged = JSON.stringify(prev.features || {}) !== JSON.stringify(freshData.features || {});
            const planChanged = prev.plan !== freshData.plan || prev.package_type !== freshData.package_type;
            const metaChanged = prev.name !== freshData.name || prev.logo_url !== freshData.logo_url;
            if (featuresChanged || planChanged || metaChanged) {
              return freshData;
            }
            return prev;
          });
        }
      },
      (error) => {
        console.warn('Real-time tenant snapshot subscription warning:', error);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [isAuthenticated, currentOrgId]);

  const companyName = organization?.name || COMPANY_NAME;
  const companyLogoUrl = organization?.logo_url || (organization?.settings as any)?.logo_url || null;
  const officeName = workplace?.name || 'Main Office';

  // Dynamic industry detection & cross-vertical terminology resolution
  const industry: IndustryType = useMemo(() => {
    return resolveOrganizationIndustry(organization);
  }, [organization]);

  const terminology: IndustryTerminology = useMemo(() => {
    return INDUSTRY_PRESETS[industry]?.terminology || INDUSTRY_PRESETS.corporate.terminology;
  }, [industry]);

  const units: string[] = useMemo(() => {
    return getTenantDefaultUnits(organization?.name, organization?.id, organization?.units, industry);
  }, [organization, industry]);

  const primaryColor: string = useMemo(() => {
    return (
      organization?.primary_color ||
      (industry && INDUSTRY_PRESETS[industry]?.color) ||
      '#5645d4'
    );
  }, [organization?.primary_color, industry]);

  const value: TenantContextState = {
    organization,
    workplace,
    employee,
    allOrganizations,
    authorizedOrganizations,
    canSwitchOrganization,
    primaryColor,
    companyName,
    companyLogoUrl,
    officeName,
    activePlan,
    features,
    industry,
    terminology,
    units,
    isLoadingTenant,
    refreshTenant: fetchTenantData,
    switchOrganization,
    isFeatureEnabled,
    updateOrganizationPlan,
    toggleFeatureLock,
    createOrganization,
    updateOrganization,
    deleteOrganization,
    updateOrganizationUnits,
  };

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant(): TenantContextState {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}
