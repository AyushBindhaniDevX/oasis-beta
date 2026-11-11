import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Switch,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import Svg, { Path, SvgXml } from 'react-native-svg';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { InteractiveTile } from '@/components/ui/InteractiveTile';
import { Modal } from '@/components/ui/Modal';
import {
  STOCK_4_SVG,
  STOCK_6_SVG,
  STOCK_10_SVG,
  STOCK_12_SVG,
} from '@/constants/workManagementSvgs';
import { useRouter } from 'expo-router';

function MetricWave({ color, width = 85, height = 28 }: { color: string; width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 90 30" fill="none">
      <Path
        d="M 2 18 C 16 26, 26 8, 42 16 C 56 24, 66 6, 88 12"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

import {
  Building2,
  Building,
  Plus,
  CheckCircle2,
  Lock,
  Unlock,
  Shield,
  CreditCard,
  ScanFace,
  MapPin,
  Award,
  GraduationCap,
  Briefcase,
  Receipt,
  LifeBuoy,
  Laptop,
  Check,
  X,
  Sparkles,
  Zap,
  Home,
  Clock,
  Umbrella,
  CalendarDays,
  CalendarClock,
  Network,
  Users,
  ArrowLeft,
  Edit2,
  Trash2,
  AlertTriangle,
  Layers,
  RefreshCw,
} from 'lucide-react-native';
import { SidebarLayout } from '@/components/layout/Sidebar';
import { useTenant, PLAN_FEATURE_DEFAULTS } from '@/context/TenantContext';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/use-theme';
import { getTenantDefaultUnits } from '@/constants/config';
import type { Organization, SubscriptionPlan } from '@/types';

// Feature definition metadata
const FEATURE_CATALOG = [
  {
    key: 'wfh',
    name: 'Work From Home (WFH) & Remote Clock-In',
    desc: 'Empower staff to punch attendance remotely outside geofenced campus with GPS & selfie verification.',
    icon: Home,
    tier: 'growth',
  },
  {
    key: 'attendance',
    name: 'Attendance & Time Tracking',
    desc: 'Real-time shift clock-in/out, automated work hours calculation, and live daily status.',
    icon: CalendarClock,
    tier: 'starter',
  },
  {
    key: 'leave',
    name: 'Leave & Time Off Approvals',
    desc: 'Leave balance management, annual/sick/casual leave applications, and manager approval chains.',
    icon: Umbrella,
    tier: 'starter',
  },
  {
    key: 'holidays',
    name: 'Holiday Calendar',
    desc: 'Official organization and regional holiday lists, seasonal closures, and optional holidays.',
    icon: CalendarDays,
    tier: 'starter',
  },
  {
    key: 'shifts',
    name: 'Shifts & Roster Planning',
    desc: 'Multi-shift operational rosters, rotational schedules, night shifts, and shift assignment.',
    icon: Clock,
    tier: 'starter',
  },
  {
    key: 'departments',
    name: 'Department Management',
    desc: 'Department structure, cost centers, department heads, and organizational tree.',
    icon: Network,
    tier: 'starter',
  },
  {
    key: 'users',
    name: 'Staff & User Directory',
    desc: 'Employee directory, profile management, role permissions, and onboarding status.',
    icon: Users,
    tier: 'starter',
  },
  {
    key: 'locations',
    name: 'Campus & Office Locations',
    desc: 'Geofenced hospital premises, satellite clinics, branch coordinates, and tolerance radii.',
    icon: MapPin,
    tier: 'starter',
  },
  {
    key: 'payroll',
    name: 'Automated Payroll & Tax Regimes',
    desc: 'Auto-calculate EPF, TDS, HRA, professional tax, and generate one-click payslips.',
    icon: CreditCard,
    tier: 'growth',
  },
  {
    key: 'performance',
    name: 'Performance Appraisals & OKRs',
    desc: 'Periodic reviews, KPI scorecards, peer feedback, and bonus rating cycles.',
    icon: Award,
    tier: 'growth',
  },
  {
    key: 'biometrics',
    name: 'Biometric & AI Face Verification',
    desc: 'Kiosk face scan matching, mobile biometric authentication, and spoof detection.',
    icon: ScanFace,
    tier: 'enterprise',
  },
  {
    key: 'geofencing',
    name: 'Geofenced Campus Radius',
    desc: 'GPS geofencing bounds for hospital campuses, clinics, and regional branches.',
    icon: MapPin,
    tier: 'starter',
  },
  {
    key: 'helpdesk',
    name: 'IT & Medical Equipment Helpdesk',
    desc: 'Internal support tickets, equipment repairs, priority SLAs, and agent routing.',
    icon: LifeBuoy,
    tier: 'growth',
  },
  {
    key: 'audit_logs',
    name: 'SOC 2 Enterprise Audit Logging',
    desc: 'Zero-trust tamper-proof activity logs, credential change histories, and export tools.',
    icon: Shield,
    tier: 'enterprise',
  },
  {
    key: 'learning',
    name: 'LMS & Training Academy',
    desc: 'Medical compliance certifications, onboarding training courses, and quiz tracking.',
    icon: GraduationCap,
    tier: 'enterprise',
  },
];

const PRESET_COLORS = [
  '#0D7377',
  '#4F46E5',
  '#7C3AED',
  '#0284C7',
  '#059669',
  '#E11D48',
  '#EA580C',
  '#1E293B',
];

export default function CentralPortalScreen() {
  const router = useRouter();
  const colors = useTheme();
  const { profile } = useAuth();
  const {
    organization,
    allOrganizations,
    switchOrganization,
    updateOrganizationPlan,
    toggleFeatureLock,
    createOrganization,
    updateOrganization,
    deleteOrganization,
    updateOrganizationUnits,
    refreshTenant,
  } = useTenant();

  // Guard: Central Portal is exclusively accessible to ayushbindhani001@gmail.com
  if (profile?.email !== 'ayushbindhani001@gmail.com') {
    return (
      <SidebarLayout>
        <View style={styles.accessDeniedContainer}>
          <View style={styles.accessDeniedCard}>
            <View style={styles.accessDeniedIconWrap}>
              <Shield size={40} color="#DC2626" />
            </View>
            <View style={styles.restrictedBadge}>
              <Text style={styles.restrictedBadgeText}>SUPER ADMIN RESTRICTED</Text>
            </View>
            <Text style={styles.accessDeniedTitle}>Access Denied</Text>
            <Text style={styles.accessDeniedDesc}>
              The Central Management Portal is exclusively reserved for Oasis Platform Super Admin (ayushbindhani001@gmail.com).
            </Text>
            <Text style={styles.accessDeniedSub}>
              Your current account ({profile?.email || 'unauthorized'}) does not have super administrative privileges to manage tenant organizations and global feature gates.
            </Text>
            <TouchableOpacity
              style={styles.backToDashBtn}
              onPress={() => router.replace('/(admin)/dashboard' as never)}
              activeOpacity={0.85}
            >
              <ArrowLeft size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.backToDashBtnText}>Return to Dashboard</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SidebarLayout>
    );
  }

  // Filter & Toast state
  const [searchFilter, setSearchFilter] = useState('');
  const [tierFilter, setTierFilter] = useState<'all' | 'enterprise' | 'growth' | 'starter'>('all');
  const [switchFeedback, setSwitchFeedback] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modals
  const [selectedOrgForConfig, setSelectedOrgForConfig] = useState<Organization | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [deletingOrg, setDeletingOrg] = useState<Organization | null>(null);
  const [managingUnitsOrg, setManagingUnitsOrg] = useState<Organization | null>(null);

  // Create Form State
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgSlug, setNewOrgSlug] = useState('');
  const [newOrgLogo, setNewOrgLogo] = useState('');
  const [newOrgColor, setNewOrgColor] = useState('#0D7377');
  const [newOrgAddress, setNewOrgAddress] = useState('');
  const [newOrgPlan, setNewOrgPlan] = useState<SubscriptionPlan>('enterprise');
  const [newOrgUnits, setNewOrgUnits] = useState('Main Branch, Home Health Care (HHC) Unit');
  const [creating, setCreating] = useState(false);

  // Edit Form State
  const [editName, setEditName] = useState('');
  const [editLogo, setEditLogo] = useState('');
  const [editColor, setEditColor] = useState('#0D7377');
  const [editAddress, setEditAddress] = useState('');
  const [editPlan, setEditPlan] = useState<SubscriptionPlan>('enterprise');
  const [editMaxEmployees, setEditMaxEmployees] = useState('1000');
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete Form State
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Units Management State
  const [unitsList, setUnitsList] = useState<string[]>([]);
  const [newUnitInput, setNewUnitInput] = useState('');
  const [savingUnits, setSavingUnits] = useState(false);

  const [savingConfig, setSavingConfig] = useState(false);

  // Filtered organizations
  const filteredOrgs = useMemo(() => {
    return allOrganizations.filter((org) => {
      const q = searchFilter.toLowerCase().trim();
      const matchesSearch =
        !q ||
        org.name.toLowerCase().includes(q) ||
        (org.slug || '').toLowerCase().includes(q) ||
        (org.plan || '').toLowerCase().includes(q);

      const orgPlan = (org.plan || org.package_type || 'starter').toLowerCase();
      const matchesTier = tierFilter === 'all' || orgPlan === tierFilter;

      return matchesSearch && matchesTier;
    });
  }, [allOrganizations, searchFilter, tierFilter]);

  const tierCounts = useMemo(() => {
    let enterprise = 0;
    let growth = 0;
    let starter = 0;
    for (const o of allOrganizations) {
      const p = (o.plan || o.package_type || 'starter').toLowerCase();
      if (p === 'enterprise') enterprise++;
      else if (p === 'growth' || p === 'silver') growth++;
      else starter++;
    }
    return { enterprise, growth, starter };
  }, [allOrganizations]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshTenant();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSwitchContext = async (targetOrg: Organization) => {
    if (targetOrg.id === organization?.id) return;
    try {
      await switchOrganization(targetOrg.id);
      setSwitchFeedback(`Switched context to "${targetOrg.name}"`);
      setTimeout(() => setSwitchFeedback(null), 3500);
    } catch (err) {
      console.error('Failed to switch context:', err);
    }
  };

  const handleCreateOrg = async () => {
    if (!newOrgName.trim() || !newOrgSlug.trim()) return;
    setCreating(true);
    try {
      const parsedUnits = newOrgUnits
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const created = await createOrganization({
        name: newOrgName.trim(),
        slug: newOrgSlug.trim(),
        logo_url: newOrgLogo.trim() || undefined,
        primary_color: newOrgColor,
        address: newOrgAddress.trim() || undefined,
        plan: newOrgPlan,
        units: parsedUnits.length > 0 ? parsedUnits : undefined,
      });

      setShowCreateModal(false);
      setNewOrgName('');
      setNewOrgSlug('');
      setNewOrgLogo('');
      setNewOrgAddress('');
      setNewOrgUnits('Main Branch, Home Health Care (HHC) Unit');
      setSelectedOrgForConfig(created);
      setSwitchFeedback(`Successfully created "${created.name}"`);
      setTimeout(() => setSwitchFeedback(null), 3500);
    } catch (err) {
      console.error('Failed to create organization:', err);
    } finally {
      setCreating(false);
    }
  };

  // Modify Org handlers
  const openEditModal = (org: Organization) => {
    setEditingOrg(org);
    setEditName(org.name || '');
    setEditLogo(org.logo_url || '');
    setEditColor(org.primary_color || '#0D7377');
    setEditAddress((org.settings as any)?.address || org.address || '');
    setEditPlan(((org.plan || org.package_type || 'enterprise') as SubscriptionPlan));
    setEditMaxEmployees(String(org.max_employees || (org.plan === 'enterprise' ? 1000 : 500)));
  };

  const handleSaveEdit = async () => {
    if (!editingOrg || !editName.trim()) return;
    setSavingEdit(true);
    try {
      await updateOrganization(editingOrg.id, {
        name: editName.trim(),
        logo_url: editLogo.trim() || undefined,
        primary_color: editColor,
        plan: editPlan,
        package_type: editPlan,
        max_employees: parseInt(editMaxEmployees, 10) || 500,
        settings: {
          ...(editingOrg.settings || {}),
          address: editAddress.trim(),
        },
      });
      setEditingOrg(null);
      setSwitchFeedback(`Updated "${editName}" details.`);
      setTimeout(() => setSwitchFeedback(null), 3500);
    } catch (err) {
      console.error('Failed to update organization:', err);
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete Org handlers
  const openDeleteModal = (org: Organization) => {
    setDeletingOrg(org);
    setDeleteConfirmText('');
  };

  const handleConfirmDelete = async () => {
    if (!deletingOrg) return;
    setDeleting(true);
    try {
      const deletedName = deletingOrg.name;
      await deleteOrganization(deletingOrg.id);
      setDeletingOrg(null);
      setSwitchFeedback(`Deleted organization "${deletedName}".`);
      setTimeout(() => setSwitchFeedback(null), 3500);
    } catch (err) {
      console.error('Failed to delete organization:', err);
    } finally {
      setDeleting(false);
    }
  };

  // Manage Units handlers
  const openUnitsModal = (org: Organization) => {
    setManagingUnitsOrg(org);
    const defaults = org.units && org.units.length > 0
      ? org.units
      : getTenantDefaultUnits(org.name, org.id);
    setUnitsList([...defaults]);
    setNewUnitInput('');
  };

  const handleAddUnit = () => {
    const trimmed = newUnitInput.trim();
    if (!trimmed) return;
    if (unitsList.includes(trimmed)) return;
    setUnitsList([...unitsList, trimmed]);
    setNewUnitInput('');
  };

  const handleRemoveUnit = (unitToRemove: string) => {
    setUnitsList(unitsList.filter((u) => u !== unitToRemove));
  };

  const handleResetUnitsToDefault = () => {
    if (!managingUnitsOrg) return;
    const defaults = getTenantDefaultUnits(managingUnitsOrg.name, managingUnitsOrg.id);
    setUnitsList([...defaults]);
  };

  const handleSaveUnits = async () => {
    if (!managingUnitsOrg) return;
    setSavingUnits(true);
    try {
      await updateOrganizationUnits(managingUnitsOrg.id, unitsList);
      setManagingUnitsOrg(null);
      setSwitchFeedback(`Saved units for "${managingUnitsOrg.name}"`);
      setTimeout(() => setSwitchFeedback(null), 3500);
    } catch (err) {
      console.error('Failed to save units:', err);
    } finally {
      setSavingUnits(false);
    }
  };

  const handlePlanChange = async (targetPlan: SubscriptionPlan) => {
    if (!selectedOrgForConfig) return;
    setSavingConfig(true);
    try {
      await updateOrganizationPlan(selectedOrgForConfig.id, targetPlan);
      setSelectedOrgForConfig((prev) =>
        prev
          ? {
              ...prev,
              plan: targetPlan,
              package_type: targetPlan,
              features: PLAN_FEATURE_DEFAULTS[targetPlan],
            }
          : null
      );
    } catch (err) {
      console.error('Failed to update plan:', err);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleFeatureToggle = async (featureKey: string, nextVal: boolean) => {
    if (!selectedOrgForConfig) return;
    try {
      await toggleFeatureLock(selectedOrgForConfig.id, featureKey, nextVal);
      setSelectedOrgForConfig((prev) =>
        prev
          ? {
              ...prev,
              features: {
                ...(prev.features || {}),
                [featureKey]: nextVal,
              },
            }
          : null
      );
    } catch (err) {
      console.error('Failed to toggle feature:', err);
    }
  };

  const getPlanColor = (plan?: string) => {
    switch (plan) {
      case 'enterprise':
        return { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0', label: 'ENTERPRISE' };
      case 'growth':
      case 'silver':
        return { bg: '#EFF6FF', text: '#1E40AF', border: '#BFDBFE', label: 'GROWTH' };
      default:
        return { bg: '#F8FAFC', text: '#475569', border: '#E2E8F0', label: 'STARTER' };
    }
  };

  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const kpiCardWidth = isDesktop
    ? undefined
    : Platform.OS === 'web'
    ? 'calc(50% - 6px)'
    : Math.floor((width - 40 - 18) / 2);

  return (
    <SidebarLayout>
      <ScrollView style={[styles.container, { backgroundColor: '#FAF9FD' }]} contentContainerStyle={styles.contentContainer}>
        {/* Floating feedback toast */}
        {switchFeedback && (
          <View style={styles.toastNotice}>
            <CheckCircle2 size={16} color="#10B981" />
            <Text style={styles.toastNoticeText}>{switchFeedback}</Text>
          </View>
        )}

        {/* Page Top Header with STOCK 6 SVG */}
        <Animated.View entering={FadeInDown.duration(280)} style={styles.headerRow}>
          <View style={{ flex: 1, minWidth: 260 }}>
            <Text style={[styles.pageTitle, { color: '#0F172A' }]}>Central Management Portal</Text>
            <Text style={[styles.pageSubtitle, { color: '#64748B' }]}>
              Create client organizations, modify tenant metadata, manage multi-location operational units, assign subscription tiers, and dynamically lock or unlock enterprise modules.
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={handleManualRefresh}
              disabled={isRefreshing}
              activeOpacity={0.8}
            >
              <RefreshCw size={16} color="#64748B" />
              <Text style={styles.refreshBtnText}>Refresh</Text>
            </TouchableOpacity>

            <View style={{ opacity: 0.95 }}>
              <SvgXml xml={STOCK_6_SVG} width={isDesktop ? 120 : 85} height={isDesktop ? 85 : 60} />
            </View>

            <TouchableOpacity
              style={[styles.createBtn, { backgroundColor: '#7C3AED' }]}
              onPress={() => setShowCreateModal(true)}
              activeOpacity={0.88}
            >
              <Plus size={18} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.createBtnText}>Create Organization</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* 4 Pastel KPI Metric Cards with InteractiveTile */}
        <Animated.View entering={FadeInDown.delay(50).duration(280)} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          {/* Tile 1: Organizations */}
          <InteractiveTile
            style={[
              styles.pastelMetricCard,
              {
                backgroundColor: '#F3EEFE',
                borderColor: '#E4DCFD',
                flex: isDesktop ? 1 : undefined,
                minWidth: isDesktop ? 160 : undefined,
                width: kpiCardWidth,
              },
            ]}
          >
            <View style={styles.cardTopRow}>
              <View style={[styles.iconBox, { backgroundColor: '#DDD6FE' }]}>
                <SvgXml xml={STOCK_6_SVG} width={34} height={25} />
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.metricValueText, { color: '#1E1B4B' }]}>{allOrganizations.length}</Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#10B981', marginTop: 1 }}>Tenants</Text>
              </View>
            </View>
            <Text style={styles.metricLabelText}>Client Organizations</Text>
            <View style={styles.waveContainer}>
              <MetricWave color="#8B5CF6" width={isDesktop ? 150 : 80} height={24} />
            </View>
          </InteractiveTile>

          {/* Tile 2: Enterprise Tiers */}
          <InteractiveTile
            style={[
              styles.pastelMetricCard,
              {
                backgroundColor: '#EDFAF2',
                borderColor: '#CEF2DE',
                flex: isDesktop ? 1 : undefined,
                minWidth: isDesktop ? 160 : undefined,
                width: kpiCardWidth,
              },
            ]}
          >
            <View style={styles.cardTopRow}>
              <View style={[styles.iconBox, { backgroundColor: '#D1FAE5' }]}>
                <SvgXml xml={STOCK_10_SVG} width={34} height={25} />
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.metricValueText, { color: '#064E3B' }]}>
                  {tierCounts.enterprise}
                </Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#10B981', marginTop: 1 }}>Top Tier</Text>
              </View>
            </View>
            <Text style={styles.metricLabelText}>Enterprise Tiers</Text>
            <View style={styles.waveContainer}>
              <MetricWave color="#10B981" width={isDesktop ? 150 : 80} height={24} />
            </View>
          </InteractiveTile>

          {/* Tile 3: Modular Features */}
          <InteractiveTile
            style={[
              styles.pastelMetricCard,
              {
                backgroundColor: '#FFF4EB',
                borderColor: '#FFE2CD',
                flex: isDesktop ? 1 : undefined,
                minWidth: isDesktop ? 160 : undefined,
                width: kpiCardWidth,
              },
            ]}
          >
            <View style={styles.cardTopRow}>
              <View style={[styles.iconBox, { backgroundColor: '#FFEDD5' }]}>
                <SvgXml xml={STOCK_4_SVG} width={34} height={25} />
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.metricValueText, { color: '#7C2D12' }]}>{FEATURE_CATALOG.length}</Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#EA580C', marginTop: 1 }}>Modular</Text>
              </View>
            </View>
            <Text style={styles.metricLabelText}>System Modules</Text>
            <View style={styles.waveContainer}>
              <MetricWave color="#F97316" width={isDesktop ? 150 : 80} height={24} />
            </View>
          </InteractiveTile>

          {/* Tile 4: Active Context */}
          <InteractiveTile
            style={[
              styles.pastelMetricCard,
              {
                backgroundColor: '#EFF6FF',
                borderColor: '#DBEAFE',
                flex: isDesktop ? 1 : undefined,
                minWidth: isDesktop ? 160 : undefined,
                width: kpiCardWidth,
              },
            ]}
          >
            <View style={styles.cardTopRow}>
              <View style={[styles.iconBox, { backgroundColor: '#DBEAFE' }]}>
                <SvgXml xml={STOCK_12_SVG} width={34} height={25} />
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.metricValueText, { color: '#1E3A8A' }]} numberOfLines={1}>
                  Active
                </Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#2563EB', marginTop: 1 }}>Workspace</Text>
              </View>
            </View>
            <Text style={styles.metricLabelText}>{organization?.name || 'All Organizations'}</Text>
            <View style={styles.waveContainer}>
              <MetricWave color="#3B82F6" width={isDesktop ? 150 : 80} height={24} />
            </View>
          </InteractiveTile>
        </Animated.View>

        {/* Organizations Filter & Search Bar with Tier Filter Pills */}
        <View style={styles.filterBarContainer}>
          <View style={styles.searchBar}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search organizations by name, slug, or tier..."
              placeholderTextColor="#94A3B8"
              value={searchFilter}
              onChangeText={setSearchFilter}
            />
          </View>

          <View style={styles.tierFilterRow}>
            {(
              [
                { id: 'all', label: `All (${allOrganizations.length})` },
                { id: 'enterprise', label: `Enterprise (${tierCounts.enterprise})` },
                { id: 'growth', label: `Growth (${tierCounts.growth})` },
                { id: 'starter', label: `Starter (${tierCounts.starter})` },
              ] as const
            ).map((tf) => {
              const active = tierFilter === tf.id;
              return (
                <TouchableOpacity
                  key={tf.id}
                  style={[styles.tierFilterPill, active && styles.tierFilterPillActive]}
                  onPress={() => setTierFilter(tf.id)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tierFilterPillText, active && styles.tierFilterPillTextActive]}>
                    {tf.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Organization Cards Grid */}
        <View style={styles.orgGrid}>
          {filteredOrgs.map((org) => {
            const isCurrent = organization?.id === org.id;
            const badge = getPlanColor(org.plan || org.package_type);
            const activeFeatureCount = FEATURE_CATALOG.filter((f) => {
              if (org.features && typeof org.features[f.key] === 'boolean') {
                return org.features[f.key] === true;
              }
              const planKey = (org.plan || org.package_type || 'starter') as SubscriptionPlan;
              return (PLAN_FEATURE_DEFAULTS[planKey] as any)?.[f.key] === true;
            }).length;

            const orgUnits = org.units && org.units.length > 0
              ? org.units
              : getTenantDefaultUnits(org.name, org.id);

            return (
              <View
                key={org.id}
                style={[
                  styles.orgCard,
                  isCurrent && styles.orgCardCurrent,
                ]}
              >
                {/* Header: Logo, Name, Slug, Tier Badge */}
                <View style={styles.orgCardHeader}>
                  <View style={[styles.orgLogoBox, { borderColor: org.primary_color ? `${org.primary_color}40` : '#E2E8F0' }]}>
                    {org.logo_url ? (
                      <Image
                        source={{ uri: org.logo_url }}
                        style={styles.orgLogo}
                        resizeMode="contain"
                      />
                    ) : (
                      <Building2 size={24} color={org.primary_color || '#0D7377'} />
                    )}
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={styles.orgTitleRow}>
                      <Text style={styles.orgName} numberOfLines={1}>
                        {org.name}
                      </Text>
                    </View>
                    <Text style={styles.orgSlug}>ID: {org.id}</Text>
                  </View>

                  <View
                    style={[
                      styles.tierBadge,
                      { backgroundColor: badge.bg, borderColor: badge.border },
                    ]}
                  >
                    <Text style={[styles.tierBadgeText, { color: badge.text }]}>
                      {badge.label}
                    </Text>
                  </View>
                </View>

                {/* Meta Row: Feature Count, Units Badge, Active Context */}
                <View style={styles.orgMetaRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Text style={styles.orgMetaText}>
                      Features:{' '}
                      <Text style={{ fontWeight: '700', color: '#1E293B' }}>
                        {activeFeatureCount}/{FEATURE_CATALOG.length} Unlocked
                      </Text>
                    </Text>

                    {/* Interactive Units Badge */}
                    <TouchableOpacity
                      style={styles.unitsPill}
                      onPress={() => openUnitsModal(org)}
                      activeOpacity={0.8}
                    >
                      <Layers size={11} color="#6366F1" />
                      <Text style={styles.unitsPillText}>{orgUnits.length} Units</Text>
                    </TouchableOpacity>
                  </View>

                  {isCurrent && (
                    <View style={styles.activePill}>
                      <Check size={12} color="#0D7377" strokeWidth={3} />
                      <Text style={styles.activePillText}>Active Context</Text>
                    </View>
                  )}
                </View>

                {/* Units List Snippet */}
                <View style={styles.unitsSnippetRow}>
                  <View style={styles.unitsSnippetHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Layers size={12} color="#6366F1" />
                      <Text style={styles.unitsSnippetLabel}>
                        Operational Units ({orgUnits.length}):
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => openUnitsModal(org)}
                      style={styles.manageUnitsBtn}
                      activeOpacity={0.7}
                    >
                      <Plus size={11} color="#6366F1" strokeWidth={2.5} />
                      <Text style={styles.manageUnitsBtnText}>Manage Units</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.unitsSnippetChips}>
                    {orgUnits.slice(0, 2).map((uName, uIdx) => (
                      <View
                        key={uName + uIdx}
                        style={styles.unitChip}
                      >
                        <Building2 size={10} color="#64748B" />
                        <Text style={styles.unitChipText} numberOfLines={1} ellipsizeMode="tail">
                          {uName}
                        </Text>
                      </View>
                    ))}
                    {orgUnits.length > 2 && (
                      <TouchableOpacity
                        onPress={() => openUnitsModal(org)}
                        style={styles.unitMoreChip}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.unitMoreChipText}>+{orgUnits.length - 2} more</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Primary Action Buttons */}
                <View style={styles.orgCardActions}>
                  <TouchableOpacity
                    style={[
                      styles.switchBtn,
                      isCurrent && styles.switchBtnActive,
                    ]}
                    onPress={() => handleSwitchContext(org)}
                    disabled={isCurrent}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.switchBtnText,
                        isCurrent && styles.switchBtnTextActive,
                      ]}
                    >
                      {isCurrent ? 'Current Workspace' : 'Switch Context'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.configBtn}
                    onPress={() => setSelectedOrgForConfig(org)}
                    activeOpacity={0.8}
                  >
                    <Lock size={14} color="#0D7377" />
                    <Text style={styles.configBtnText}>Plan & Feature Lock</Text>
                  </TouchableOpacity>
                </View>

                {/* Secondary Action Toolbar: Units, Modify/Edit, Delete */}
                <View style={styles.orgSecondaryActions}>
                  <TouchableOpacity
                    style={styles.secondaryActionBtn}
                    onPress={() => openUnitsModal(org)}
                    activeOpacity={0.8}
                  >
                    <Layers size={13} color="#4F46E5" />
                    <Text style={[styles.secondaryActionBtnText, { color: '#4F46E5' }]}>Units</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryActionBtn}
                    onPress={() => openEditModal(org)}
                    activeOpacity={0.8}
                  >
                    <Edit2 size={13} color="#0F766E" />
                    <Text style={[styles.secondaryActionBtnText, { color: '#0F766E' }]}>Modify Org</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.secondaryActionBtn, styles.deleteActionBtn]}
                    onPress={() => openDeleteModal(org)}
                    activeOpacity={0.8}
                    disabled={allOrganizations.length <= 1}
                  >
                    <Trash2 size={13} color="#DC2626" />
                    <Text style={[styles.secondaryActionBtnText, { color: '#DC2626' }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>

        {/* ==================================================== */}
        {/* PLAN & FEATURE LOCK MODAL */}
        {/* ==================================================== */}
        {selectedOrgForConfig && (
          <Modal
            visible={Boolean(selectedOrgForConfig)}
            onClose={() => setSelectedOrgForConfig(null)}
            title={selectedOrgForConfig.name}
            subtitle="Configure subscription plan tier and toggle granular feature locks."
            icon={
              selectedOrgForConfig.logo_url ? (
                <Image
                  source={{ uri: selectedOrgForConfig.logo_url }}
                  style={{ width: 28, height: 28 }}
                  resizeMode="contain"
                />
              ) : (
                <Building2 size={20} color="#0D7377" />
              )
            }
            size="lg"
            primaryAction={{
              label: 'Close & Apply Changes',
              onPress: () => setSelectedOrgForConfig(null),
              variant: 'primary',
            }}
          >
            {/* Plan Tier Selector Section */}
            <View style={styles.sectionWrap}>
              <Text style={styles.sectionHeader}>Subscription Plan Tier</Text>
              <Text style={styles.sectionDesc}>
                Selecting a plan automatically applies default feature unlocks for this tenant.
              </Text>

              <View style={styles.planSelectorRow}>
                {(['starter', 'growth', 'enterprise'] as SubscriptionPlan[]).map((p) => {
                  const currentPlan = selectedOrgForConfig.plan || selectedOrgForConfig.package_type || 'starter';
                  const isSelected = currentPlan === p;

                  return (
                    <TouchableOpacity
                      key={p}
                      style={[
                        styles.planOptionCard,
                        isSelected && styles.planOptionCardSelected,
                      ]}
                      onPress={() => handlePlanChange(p)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.planOptionHeader}>
                        <Text
                          style={[
                            styles.planOptionTitle,
                            isSelected && styles.planOptionTitleSelected,
                          ]}
                        >
                          {p.toUpperCase()}
                        </Text>
                        {isSelected && <CheckCircle2 size={18} color="#0D7377" />}
                      </View>
                      <Text style={styles.planOptionDesc}>
                        {p === 'starter'
                          ? 'Core Attendance & Directory'
                          : p === 'growth'
                          ? 'Payroll, Expenses & Appraisals'
                          : `All ${FEATURE_CATALOG.length} Modules + AI Face Verif`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Feature Lock Matrix Section */}
            <View style={styles.sectionWrap}>
              <Text style={styles.sectionHeader}>Modular Feature Lock & Unlock Matrix</Text>
              <Text style={styles.sectionDesc}>
                Override specific feature availability for this organization regardless of tier.
              </Text>

              <View style={styles.featureList}>
                {FEATURE_CATALOG.map((f) => {
                  const IconComponent = f.icon;
                  const isUnlocked =
                    selectedOrgForConfig.features &&
                    typeof selectedOrgForConfig.features[f.key] === 'boolean'
                      ? (selectedOrgForConfig.features[f.key] as boolean)
                      : (PLAN_FEATURE_DEFAULTS[
                          (selectedOrgForConfig.plan as SubscriptionPlan) || 'starter'
                        ] as any)?.[f.key] ?? false;

                  return (
                    <View
                      key={f.key}
                      style={[
                        styles.featureItemRow,
                        isUnlocked ? styles.featureItemUnlocked : styles.featureItemLocked,
                      ]}
                    >
                      <View
                        style={[
                          styles.featureIconCircle,
                          isUnlocked && { backgroundColor: '#F0F7F7' },
                        ]}
                      >
                        <IconComponent
                          size={20}
                          color={isUnlocked ? '#0D7377' : '#94A3B8'}
                        />
                      </View>

                      <View style={{ flex: 1, paddingRight: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={styles.featureName}>{f.name}</Text>
                          {isUnlocked ? (
                            <View style={styles.unlockedChip}>
                              <Unlock size={10} color="#0D7377" />
                              <Text style={styles.unlockedChipText}>UNLOCKED</Text>
                            </View>
                          ) : (
                            <View style={styles.lockedChip}>
                              <Lock size={10} color="#DC2626" />
                              <Text style={styles.lockedChipText}>LOCKED</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.featureDesc}>{f.desc}</Text>
                      </View>

                      <Switch
                        value={isUnlocked}
                        onValueChange={(val) => handleFeatureToggle(f.key, val)}
                        trackColor={{ false: '#E2E8F0', true: '#0D7377' }}
                        thumbColor="#FFFFFF"
                      />
                    </View>
                  );
                })}
              </View>
            </View>
          </Modal>
        )}

        {/* ==================================================== */}
        {/* MANAGE UNITS & SUB-BRANDS MODAL */}
        {/* ==================================================== */}
        {managingUnitsOrg && (
          <Modal
            visible={Boolean(managingUnitsOrg)}
            onClose={() => setManagingUnitsOrg(null)}
            title="Manage Hospital Units & Sub-Brands"
            subtitle={`Organize ${managingUnitsOrg.name} across satellite clinics, wings, and home health care units.`}
            icon={<Layers size={20} color="#4F46E5" />}
            iconBgColor="#EEF2FF"
            iconBorderColor="#C7D2FE"
            size="md"
            primaryAction={{
              label: 'Save Units',
              onPress: handleSaveUnits,
              loading: savingUnits,
              variant: 'primary',
            }}
            secondaryAction={{
              label: 'Cancel',
              onPress: () => setManagingUnitsOrg(null),
              disabled: savingUnits,
            }}
          >
            {/* Add Unit Row */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Add New Unit / Campus / Wing</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  style={[styles.formInput, { flex: 1 }]}
                  placeholder="e.g. Home Health Care (HHC) Unit, ICU Wing, Satellite Clinic"
                  value={newUnitInput}
                  onChangeText={setNewUnitInput}
                  placeholderTextColor="#94A3B8"
                  onSubmitEditing={handleAddUnit}
                />
                <TouchableOpacity
                  style={styles.addUnitBtn}
                  onPress={handleAddUnit}
                  activeOpacity={0.85}
                >
                  <Plus size={16} color="#FFFFFF" />
                  <Text style={styles.addUnitBtnText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Configured Units List */}
            <View style={styles.sectionWrap}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={styles.sectionHeader}>Configured Units ({unitsList.length})</Text>
                <TouchableOpacity onPress={handleResetUnitsToDefault} activeOpacity={0.7}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#4F46E5' }}>Reset to Defaults</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.sectionDesc}>
                These units will be selectable throughout employee onboarding, roster shifts, and attendance reports.
              </Text>

              {unitsList.length === 0 ? (
                <View style={styles.emptyUnitsBox}>
                  <Text style={styles.emptyUnitsText}>No units configured yet. Add your first unit above.</Text>
                </View>
              ) : (
                <View style={styles.unitsGridList}>
                  {unitsList.map((unitName, idx) => (
                    <View key={unitName} style={styles.unitItemCard}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                        <View style={styles.unitItemBadge}>
                          <Text style={styles.unitItemBadgeText}>{idx + 1}</Text>
                        </View>
                        <Text style={styles.unitItemName} numberOfLines={1}>
                          {unitName}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.unitDeleteBtn}
                        onPress={() => handleRemoveUnit(unitName)}
                        activeOpacity={0.75}
                      >
                        <Trash2 size={14} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </Modal>
        )}

        {/* ==================================================== */}
        {/* MODIFY / EDIT ORGANIZATION MODAL */}
        {/* ==================================================== */}
        {editingOrg && (
          <Modal
            visible={Boolean(editingOrg)}
            onClose={() => setEditingOrg(null)}
            title="Modify Organization"
            subtitle={`Update brand identity, headquarter campus, and subscription quota for ${editingOrg.name}.`}
            icon={<Edit2 size={18} color="#0F766E" />}
            size="md"
            primaryAction={{
              label: 'Save Changes',
              onPress: handleSaveEdit,
              loading: savingEdit,
              disabled: !editName.trim(),
              variant: 'primary',
            }}
            secondaryAction={{
              label: 'Cancel',
              onPress: () => setEditingOrg(null),
              disabled: savingEdit,
            }}
          >
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Organization Legal Name *</Text>
              <TextInput
                style={styles.formInput}
                value={editName}
                onChangeText={setEditName}
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Brand Logo URL</Text>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <TextInput
                  style={[styles.formInput, { flex: 1 }]}
                  placeholder="https://domain.com/logo.png"
                  value={editLogo}
                  onChangeText={setEditLogo}
                  autoCapitalize="none"
                  placeholderTextColor="#94A3B8"
                />
                <View style={styles.logoPreviewBox}>
                  {editLogo ? (
                    <Image
                      source={{ uri: editLogo }}
                      style={{ width: 28, height: 28 }}
                      resizeMode="contain"
                    />
                  ) : (
                    <Building2 size={20} color="#94A3B8" />
                  )}
                </View>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Brand Primary Color</Text>
              <View style={styles.colorSwatchesRow}>
                {PRESET_COLORS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: c },
                      editColor === c && styles.colorSwatchActive,
                    ]}
                    onPress={() => setEditColor(c)}
                  >
                    {editColor === c && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Headquarters / Campus Address</Text>
              <TextInput
                style={styles.formInput}
                value={editAddress}
                onChangeText={setEditAddress}
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Subscription Plan Tier</Text>
              <View style={styles.planPickerRow}>
                {(['starter', 'growth', 'enterprise'] as SubscriptionPlan[]).map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.planPickerBtn,
                      editPlan === p && styles.planPickerBtnActive,
                    ]}
                    onPress={() => setEditPlan(p)}
                  >
                    <Text
                      style={[
                        styles.planPickerText,
                        editPlan === p && styles.planPickerTextActive,
                      ]}
                    >
                      {p.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Maximum Employee Quota</Text>
              <TextInput
                style={styles.formInput}
                value={editMaxEmployees}
                onChangeText={setEditMaxEmployees}
                keyboardType="numeric"
                placeholder="e.g. 1000"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </Modal>
        )}

        {/* ==================================================== */}
        {/* DELETE ORGANIZATION CONFIRMATION MODAL */}
        {/* ==================================================== */}
        {deletingOrg && (
          <Modal
            visible={Boolean(deletingOrg)}
            onClose={() => setDeletingOrg(null)}
            title="Delete Organization"
            subtitle="Permanent tenant deletion safeguard"
            icon={<AlertTriangle size={20} color="#DC2626" />}
            iconBgColor="#FEF2F2"
            iconBorderColor="#FCA5A5"
            size="sm"
            primaryAction={{
              label: 'Delete Permanently',
              onPress: handleConfirmDelete,
              loading: deleting,
              disabled: deleteConfirmText !== deletingOrg.name || deleting,
              variant: 'danger',
            }}
            secondaryAction={{
              label: 'Cancel',
              onPress: () => setDeletingOrg(null),
              disabled: deleting,
            }}
          >
            <Text style={styles.deleteModalDesc}>
              Are you sure you want to permanently delete{' '}
              <Text style={{ fontWeight: '800', color: '#0F172A' }}>{deletingOrg.name}</Text>?
            </Text>
            <Text style={styles.deleteModalWarning}>
              This action will permanently delete all associated workplaces, unit assignments, and tenant configuration.
              {organization?.id === deletingOrg.id && (
                <Text style={{ color: '#B91C1C', fontWeight: '700' }}>
                  {'\n\n'}Note: This is currently your active workspace. Deleting it will automatically switch your session to another organization.
                </Text>
              )}
            </Text>

            <View style={{ width: '100%', marginTop: 16 }}>
              <Text style={styles.deleteInputLabel}>
                Type <Text style={{ fontWeight: '800' }}>{deletingOrg.name}</Text> to confirm:
              </Text>
              <TextInput
                style={styles.deleteInput}
                placeholder={deletingOrg.name}
                value={deleteConfirmText}
                onChangeText={setDeleteConfirmText}
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
              />
            </View>
          </Modal>
        )}

        {/* ==================================================== */}
        {/* CREATE ORGANIZATION MODAL */}
        {/* ==================================================== */}
        {showCreateModal && (
          <Modal
            visible={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            title="Create New Organization"
            subtitle="Deploy a new isolated client tenant with geofenced workplace & subscription plan."
            icon={<Plus size={20} color="#7C3AED" />}
            iconBgColor="#F5F3FF"
            iconBorderColor="#DDD6FE"
            size="md"
            primaryAction={{
              label: 'Deploy Tenant',
              onPress: handleCreateOrg,
              loading: creating,
              disabled: creating || !newOrgName.trim() || !newOrgSlug.trim(),
              variant: 'primary',
            }}
            secondaryAction={{
              label: 'Cancel',
              onPress: () => setShowCreateModal(false),
              disabled: creating,
            }}
          >
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Organization Legal Name *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g., Apollo Health Clinic"
                value={newOrgName}
                onChangeText={(text) => {
                  setNewOrgName(text);
                  if (!newOrgSlug) {
                    setNewOrgSlug(
                      text
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/(^-|-$)/g, '')
                    );
                  }
                }}
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Tenant Slug / Unique Identifier *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g., apollo-clinic"
                value={newOrgSlug}
                onChangeText={setNewOrgSlug}
                autoCapitalize="none"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Brand Primary Color</Text>
              <View style={styles.colorSwatchesRow}>
                {PRESET_COLORS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: c },
                      newOrgColor === c && styles.colorSwatchActive,
                    ]}
                    onPress={() => setNewOrgColor(c)}
                  >
                    {newOrgColor === c && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Brand Logo URL (Optional)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="https://domain.com/logo.png"
                value={newOrgLogo}
                onChangeText={setNewOrgLogo}
                autoCapitalize="none"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Headquarters / Primary Campus Address</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g., Manglabag, Cuttack, Odisha"
                value={newOrgAddress}
                onChangeText={setNewOrgAddress}
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Hospital Units / Sub-Brands (Comma Separated)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g., Main Branch, Home Health Care (HHC) Unit, ICU Wing"
                value={newOrgUnits}
                onChangeText={setNewOrgUnits}
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Initial Subscription Plan</Text>
              <View style={styles.planPickerRow}>
                {(['starter', 'growth', 'enterprise'] as SubscriptionPlan[]).map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.planPickerBtn,
                      newOrgPlan === p && styles.planPickerBtnActive,
                    ]}
                    onPress={() => setNewOrgPlan(p)}
                  >
                    <Text
                      style={[
                        styles.planPickerText,
                        newOrgPlan === p && styles.planPickerTextActive,
                      ]}
                    >
                      {p.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </Modal>
        )}
      </ScrollView>
    </SidebarLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  contentContainer: {
    padding: 32,
    maxWidth: 1300,
    width: '100%',
    alignSelf: 'center',
  },

  // Floating Toast
  toastNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 16,
    alignSelf: 'flex-start',
    ...Platform.select({
      web: { boxShadow: '0 4px 12px rgba(16, 185, 129, 0.15)' },
      default: { elevation: 2 },
    }),
  },
  toastNoticeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    flexWrap: 'wrap',
    gap: 16,
  },
  eyebrowChip: {
    backgroundColor: '#F0F7F7',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(13, 115, 119, 0.2)',
    marginBottom: 8,
  },
  eyebrowText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0D7377',
    letterSpacing: 1,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1A1A2E',
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
    maxWidth: 640,
    lineHeight: 20,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  refreshBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0D7377',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    ...Platform.select({
      web: { boxShadow: '0 4px 12px rgba(124, 58, 237, 0.25)' },
      default: { elevation: 2 },
    }),
  },
  createBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Pastel Metric Cards
  pastelMetricCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    overflow: 'hidden',
    position: 'relative',
    minHeight: 104,
    shadowColor: '#0f0f0f',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValueText: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  metricLabelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 8,
  },
  waveContainer: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    opacity: 0.65,
    pointerEvents: 'none',
  },

  // Filter Bar Container
  filterBarContainer: {
    marginBottom: 24,
    gap: 12,
  },
  searchBar: {
    width: '100%',
  },
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1A1A2E',
  },
  tierFilterRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  tierFilterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tierFilterPillActive: {
    backgroundColor: '#0D7377',
    borderColor: '#0D7377',
  },
  tierFilterPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  tierFilterPillTextActive: {
    color: '#FFFFFF',
  },

  // Org Grid
  orgGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
  },
  orgCard: {
    flex: 1,
    minWidth: 360,
    maxWidth: 580,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 22,
    ...Platform.select({
      web: { boxShadow: '0 2px 10px -2px rgba(0, 0, 0, 0.04)' },
      default: { elevation: 1 },
    }),
  },
  orgCardCurrent: {
    borderColor: '#0D7377',
    borderWidth: 1.5,
    backgroundColor: '#FAFCFC',
  },
  orgCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  orgLogoBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  orgLogo: {
    width: 38,
    height: 38,
  },
  orgTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orgName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  orgSlug: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  tierBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    borderWidth: 1,
  },
  tierBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  orgMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 10,
    flexWrap: 'wrap',
    gap: 8,
  },
  orgMetaText: {
    fontSize: 12,
    color: '#64748B',
  },
  unitsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
  },
  unitsPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F7F7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
  },
  activePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0D7377',
  },

  unitsSnippetRow: {
    flexDirection: 'column',
    gap: 8,
    marginBottom: 14,
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
  },
  unitsSnippetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  unitsSnippetLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    letterSpacing: 0.2,
  },
  manageUnitsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  manageUnitsBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#6366F1',
  },
  unitsSnippetChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    width: '100%',
    alignItems: 'center',
  },
  unitChip: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 155,
  },
  unitChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1E293B',
  },
  unitMoreChip: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  unitMoreChipText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#4F46E5',
  },

  // Primary Action Buttons
  orgCardActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  switchBtn: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  switchBtnActive: {
    backgroundColor: '#F0F7F7',
    borderColor: 'rgba(13, 115, 119, 0.3)',
  },
  switchBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  switchBtnTextActive: {
    color: '#0D7377',
    fontWeight: '700',
  },
  configBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F0F7F7',
    borderWidth: 1,
    borderColor: 'rgba(13, 115, 119, 0.2)',
  },
  configBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0D7377',
  },

  // Secondary Toolbar Buttons (Units, Modify, Delete)
  orgSecondaryActions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: '#F8FAFC',
  },
  secondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  secondaryActionBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  deleteActionBtn: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FEE2E2',
  },

  // Modals Common
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  configModalCard: {
    maxWidth: 720,
    width: '100%',
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    ...Platform.select({
      web: { boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.2)' },
      default: { elevation: 6 },
    }),
  },
  createModalCard: {
    maxWidth: 560,
    width: '100%',
    maxHeight: '88%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
  },
  unitsModalCard: {
    maxWidth: 580,
    width: '100%',
    maxHeight: '88%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
  },
  deleteModalCard: {
    maxWidth: 440,
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
  },
  deleteIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  deleteModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  deleteModalDesc: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
  },
  deleteModalWarning: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 18,
  },
  deleteInputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  deleteInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#1A1A2E',
  },
  deleteModalFooter: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  confirmDeleteBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmDeleteBtnDisabled: {
    opacity: 0.4,
  },
  confirmDeleteBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalLogoBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1A2E',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    maxWidth: 480,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 8,
  },
  modalScroll: {
    marginVertical: 18,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
  },

  // Units Management Styles
  addUnitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#4F46E5',
    paddingHorizontal: 16,
    borderRadius: 10,
    justifyContent: 'center',
  },
  addUnitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyUnitsBox: {
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  emptyUnitsText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  unitsGridList: {
    gap: 8,
  },
  unitItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  unitItemBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitItemBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4F46E5',
  },
  unitItemName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  unitDeleteBtn: {
    padding: 6,
    borderRadius: 6,
  },

  // Config Modal Sections
  sectionWrap: {
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  sectionDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 14,
  },

  // Plan Selector
  planSelectorRow: {
    flexDirection: 'row',
    gap: 12,
  },
  planOptionCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 14,
    backgroundColor: '#FFFFFF',
  },
  planOptionCardSelected: {
    borderColor: '#0D7377',
    backgroundColor: '#F0F7F7',
  },
  planOptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  planOptionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.6,
  },
  planOptionTitleSelected: {
    color: '#0D7377',
  },
  planOptionDesc: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
  },

  // Feature List
  featureList: {
    gap: 10,
  },
  featureItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  featureItemUnlocked: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  featureItemLocked: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    opacity: 0.75,
  },
  featureIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  featureName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  featureDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  unlockedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 100,
  },
  unlockedChipText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#166534',
  },
  lockedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 100,
  },
  lockedChipText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#DC2626',
  },

  doneBtn: {
    backgroundColor: '#0D7377',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  doneBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Color Swatches
  colorSwatchesRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatchActive: {
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    ...Platform.select({
      web: { boxShadow: '0 0 0 2px #0F172A' },
      default: { elevation: 3 },
    }),
  },
  logoPreviewBox: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  // Form Controls
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#1A1A2E',
  },
  planPickerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  planPickerBtn: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  planPickerBtnActive: {
    borderColor: '#0D7377',
    backgroundColor: '#F0F7F7',
  },
  planPickerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  planPickerTextActive: {
    color: '#0D7377',
    fontWeight: '800',
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  submitBtn: {
    backgroundColor: '#0D7377',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 120,
    alignItems: 'center',
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Access Denied Screen
  accessDeniedContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    minHeight: 500,
  },
  accessDeniedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    maxWidth: 480,
    width: '100%',
    padding: 36,
    alignItems: 'center',
    textAlign: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  accessDeniedIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  restrictedBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 14,
  },
  restrictedBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#DC2626',
    letterSpacing: 0.8,
  },
  accessDeniedTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
  },
  accessDeniedDesc: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  accessDeniedSub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  backToDashBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D7377',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  backToDashBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
