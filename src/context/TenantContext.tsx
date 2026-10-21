import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
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
  onSnapshot,
} from 'firebase/firestore';
import type {
  Organization,
  Workplace,
  Employee,
  SubscriptionPlan,
  OrganizationFeatures,
} from '@/types';
import { COMPANY_NAME } from '@/constants/config';

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
  },
  growth: {
    payroll: true,
    biometrics: false,
    geofencing: true,
    performance: true,
    learning: false,
    recruitment: false,
    expenses: true,
    helpdesk: true,
    assets: true,
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
  },
  enterprise: {
    payroll: true,
    biometrics: true,
    geofencing: true,
    performance: true,
    learning: true,
    recruitment: true,
    expenses: true,
    helpdesk: true,
    assets: true,
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
  },
};

export interface TenantContextState {
  organization: Organization | null;
  workplace: Workplace | null;
  employee: Employee | null;
  allOrganizations: Organization[];
  companyName: string;
  companyLogoUrl: string | null;
  officeName: string;
  activePlan: SubscriptionPlan;
  features: OrganizationFeatures;
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
    address?: string;
  }) => Promise<Organization>;
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

  // Fetch all unique tenant organizations
  const fetchAllOrganizations = useCallback(async () => {
    try {
      const orgsSnap = await getDocs(collection(db, 'organizations'));
      const orgMap = new Map<string, Organization>();

      for (const d of orgsSnap.docs) {
        const data = d.data() as Organization;
        const normalizedName = (data.name || d.id).toLowerCase().trim();
        // Skip short slug aliases if full org exists
        if (d.id === 'smh' || d.id === 'oasis' || d.id === 'subedge') continue;
        if (!orgMap.has(normalizedName)) {
          orgMap.set(normalizedName, { ...data, id: d.id });
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
      const targetOrgId = manualOrgId || profile?.organization_id;

      // 1. Resolve organization by explicit ID or profile ID
      if (targetOrgId) {
        const orgRef = doc(db, 'organizations', targetOrgId);
        const orgSnap = await getDoc(orgRef);
        if (orgSnap.exists()) {
          resolvedOrg = { id: orgSnap.id, ...orgSnap.data() } as Organization;
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

  // Switch active organization context
  const switchOrganization = useCallback(async (orgId: string) => {
    setManualOrgId(orgId);
    if (profile?.id) {
      try {
        await updateDoc(doc(db, 'profiles', profile.id), {
          organization_id: orgId,
          updated_at: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('Profile organization update note:', err);
      }
    }
  }, [profile?.id]);

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
    address?: string;
  }): Promise<Organization> => {
    const orgId = data.slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-');
    const selectedPlan = data.plan || 'growth';
    const now = new Date().toISOString();

    const newOrg: Organization = {
      id: orgId,
      name: data.name,
      slug: orgId,
      logo_url: data.logo_url || null,
      primary_color: data.primary_color || '#0D7377',
      accent_color: '#14B8A6',
      plan: selectedPlan,
      package_type: selectedPlan,
      features: PLAN_FEATURE_DEFAULTS[selectedPlan],
      max_employees: selectedPlan === 'enterprise' ? 1000 : 500,
      settings: {
        industry: 'General Enterprise',
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

  const value: TenantContextState = {
    organization,
    workplace,
    employee,
    allOrganizations,
    companyName,
    companyLogoUrl,
    officeName,
    activePlan,
    features,
    isLoadingTenant,
    refreshTenant: fetchTenantData,
    switchOrganization,
    isFeatureEnabled,
    updateOrganizationPlan,
    toggleFeatureLock,
    createOrganization,
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
