import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Image,
  Switch,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Building2,
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
  ExternalLink,
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
} from 'lucide-react-native';
import { SidebarLayout } from '@/components/layout/Sidebar';
import { useTenant, PLAN_FEATURE_DEFAULTS } from '@/context/TenantContext';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/use-theme';
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
    key: 'expenses',
    name: 'Expense Claims & Reimbursements',
    desc: 'Multi-currency receipts, OCR auto-extraction, and manager approval chains.',
    icon: Receipt,
    tier: 'growth',
  },
  {
    key: 'helpdesk',
    name: 'IT & Medical Equipment Helpdesk',
    desc: 'Internal support tickets, equipment repairs, priority SLAs, and agent routing.',
    icon: LifeBuoy,
    tier: 'growth',
  },
  {
    key: 'assets',
    name: 'Asset & Hardware Allocation',
    desc: 'Inventory tracking, medical diagnostic equipment checkouts, and warranty alerts.',
    icon: Laptop,
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
  {
    key: 'recruitment',
    name: 'Recruitment & ATS Pipeline',
    desc: 'Job board publishing, candidate resume indexing, and multi-stage interview scheduling.',
    icon: Briefcase,
    tier: 'enterprise',
  },
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

  // Modals & Drawers
  const [selectedOrgForConfig, setSelectedOrgForConfig] = useState<Organization | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  // Create Form State
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgSlug, setNewOrgSlug] = useState('');
  const [newOrgLogo, setNewOrgLogo] = useState('');
  const [newOrgColor, setNewOrgColor] = useState('#0D7377');
  const [newOrgAddress, setNewOrgAddress] = useState('');
  const [newOrgPlan, setNewOrgPlan] = useState<SubscriptionPlan>('enterprise');
  const [creating, setCreating] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  // Filtered organizations
  const filteredOrgs = useMemo(() => {
    return allOrganizations.filter((org) => {
      const q = searchFilter.toLowerCase().trim();
      if (!q) return true;
      return (
        org.name.toLowerCase().includes(q) ||
        (org.slug || '').toLowerCase().includes(q) ||
        (org.plan || '').toLowerCase().includes(q)
      );
    });
  }, [allOrganizations, searchFilter]);

  const handleCreateOrg = async () => {
    if (!newOrgName.trim() || !newOrgSlug.trim()) return;
    setCreating(true);
    try {
      const created = await createOrganization({
        name: newOrgName.trim(),
        slug: newOrgSlug.trim(),
        logo_url: newOrgLogo.trim() || undefined,
        primary_color: newOrgColor,
        address: newOrgAddress.trim() || undefined,
        plan: newOrgPlan,
      });
      setShowCreateModal(false);
      setNewOrgName('');
      setNewOrgSlug('');
      setNewOrgLogo('');
      setNewOrgAddress('');
      // Auto-open config for newly created org
      setSelectedOrgForConfig(created);
    } catch (err) {
      console.error('Failed to create organization:', err);
    } finally {
      setCreating(false);
    }
  };

  const handlePlanChange = async (targetPlan: SubscriptionPlan) => {
    if (!selectedOrgForConfig) return;
    setSavingConfig(true);
    try {
      await updateOrganizationPlan(selectedOrgForConfig.id, targetPlan);
      // Update local selected copy
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

  return (
    <SidebarLayout>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* Page Top Header */}
        <View style={styles.headerRow}>
          <View>
            <View style={styles.eyebrowChip}>
              <Text style={styles.eyebrowText}>SUBEDGE MULTI-TENANT CLOUD</Text>
            </View>
            <Text style={styles.pageTitle}>Central Management Portal</Text>
            <Text style={styles.pageSubtitle}>
              Create client organizations, assign subscription tiers, and dynamically lock or unlock enterprise modules.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.createBtn}
            onPress={() => setShowCreateModal(true)}
            activeOpacity={0.88}
          >
            <Plus size={18} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={styles.createBtnText}>Create Organization</Text>
          </TouchableOpacity>
        </View>

        {/* Overview Stats Metric Strip */}
        <View style={styles.statsStrip}>
          <View style={styles.statCard}>
            <Building2 size={24} color="#0D7377" />
            <View>
              <Text style={styles.statNumber}>{allOrganizations.length}</Text>
              <Text style={styles.statLabel}>Client Organizations</Text>
            </View>
          </View>

          <View style={styles.statCard}>
            <Sparkles size={24} color="#10B981" />
            <View>
              <Text style={styles.statNumber}>
                {allOrganizations.filter((o) => o.plan === 'enterprise' || o.package_type === 'enterprise').length}
              </Text>
              <Text style={styles.statLabel}>Enterprise Tiers</Text>
            </View>
          </View>

          <View style={styles.statCard}>
            <Zap size={24} color="#6366F1" />
            <View>
              <Text style={styles.statNumber}>10</Text>
              <Text style={styles.statLabel}>Modular Features</Text>
            </View>
          </View>

          <View style={[styles.statCard, styles.activeTenantCard]}>
            <CheckCircle2 size={24} color="#0D7377" />
            <View style={{ flex: 1 }}>
              <Text style={styles.activeTenantLabel}>ACTIVE WORKSPACE CONTEXT</Text>
              <Text style={styles.activeTenantName} numberOfLines={1}>
                {organization?.name || 'All Organizations'}
              </Text>
            </View>
          </View>
        </View>

        {/* Organizations Filter & Search Bar */}
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search organizations by name, slug, or tier..."
            placeholderTextColor="#94A3B8"
            value={searchFilter}
            onChangeText={setSearchFilter}
          />
        </View>

        {/* Organization Cards Grid */}
        <View style={styles.orgGrid}>
          {filteredOrgs.map((org) => {
            const isCurrent = organization?.id === org.id;
            const badge = getPlanColor(org.plan || org.package_type);
            const activeFeatureCount = org.features
              ? Object.values(org.features).filter(Boolean).length
              : org.plan === 'enterprise'
              ? 10
              : org.plan === 'growth'
              ? 6
              : 2;

            return (
              <View
                key={org.id}
                style={[
                  styles.orgCard,
                  isCurrent && styles.orgCardCurrent,
                ]}
              >
                <View style={styles.orgCardHeader}>
                  <View style={styles.orgLogoBox}>
                    {org.logo_url ? (
                      <Image
                        source={{ uri: org.logo_url }}
                        style={styles.orgLogo}
                        resizeMode="contain"
                      />
                    ) : (
                      <Building2 size={24} color="#0D7377" />
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

                <View style={styles.orgMetaRow}>
                  <Text style={styles.orgMetaText}>
                    Features: <Text style={{ fontWeight: '700', color: '#1E293B' }}>{activeFeatureCount}/10 Unlocked</Text>
                  </Text>
                  {isCurrent && (
                    <View style={styles.activePill}>
                      <Check size={12} color="#0D7377" strokeWidth={3} />
                      <Text style={styles.activePillText}>Active Context</Text>
                    </View>
                  )}
                </View>

                {/* Card Actions */}
                <View style={styles.orgCardActions}>
                  <TouchableOpacity
                    style={[
                      styles.switchBtn,
                      isCurrent && styles.switchBtnActive,
                    ]}
                    onPress={() => switchOrganization(org.id)}
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
              </View>
            );
          })}
        </View>

        {/* ==================================================== */}
        {/* PLAN & FEATURE LOCK MODAL / DRAWER */}
        {/* ==================================================== */}
        {selectedOrgForConfig && (
          <Modal
            visible={Boolean(selectedOrgForConfig)}
            transparent
            animationType="fade"
            onRequestClose={() => setSelectedOrgForConfig(null)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.configModalCard}>
                {/* Modal Header */}
                <View style={styles.modalHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={styles.modalLogoBox}>
                      {selectedOrgForConfig.logo_url ? (
                        <Image
                          source={{ uri: selectedOrgForConfig.logo_url }}
                          style={{ width: 36, height: 36 }}
                          resizeMode="contain"
                        />
                      ) : (
                        <Building2 size={20} color="#0D7377" />
                      )}
                    </View>
                    <View>
                      <Text style={styles.modalTitle}>{selectedOrgForConfig.name}</Text>
                      <Text style={styles.modalSubtitle}>
                        Configure subscription plan tier and toggle granular feature locks.
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => setSelectedOrgForConfig(null)}
                    style={styles.modalCloseBtn}
                  >
                    <X size={20} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
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
                                : 'All 10 Modules + Biometrics & AI'}
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
                </ScrollView>

                <View style={styles.modalFooter}>
                  <TouchableOpacity
                    style={styles.doneBtn}
                    onPress={() => setSelectedOrgForConfig(null)}
                  >
                    <Text style={styles.doneBtnText}>Close & Apply Changes</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}

        {/* ==================================================== */}
        {/* CREATE ORGANIZATION MODAL */}
        {/* ==================================================== */}
        {showCreateModal && (
          <Modal
            visible={showCreateModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowCreateModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.createModalCard}>
                <View style={styles.modalHeader}>
                  <View>
                    <Text style={styles.modalTitle}>Create New Organization</Text>
                    <Text style={styles.modalSubtitle}>
                      Deploy a new isolated client tenant with geofenced workplace & subscription plan.
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setShowCreateModal(false)}
                    style={styles.modalCloseBtn}
                  >
                    <X size={20} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
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
                </ScrollView>

                <View style={styles.modalFooter}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => setShowCreateModal(false)}
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.submitBtn, creating && { opacity: 0.7 }]}
                    onPress={handleCreateOrg}
                    disabled={creating || !newOrgName.trim() || !newOrgSlug.trim()}
                  >
                    {creating ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.submitBtnText}>Deploy Tenant</Text>
                    )}
                  </TouchableOpacity>
                </View>
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

  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 28,
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
    maxWidth: 620,
    lineHeight: 20,
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
      web: { boxShadow: '0 4px 12px rgba(13, 115, 119, 0.2)' },
      default: { elevation: 2 },
    }),
  },
  createBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Stats Strip
  statsStrip: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 28,
    flexWrap: 'wrap',
  },
  statCard: {
    flex: 1,
    minWidth: 200,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A2E',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
  },
  activeTenantCard: {
    backgroundColor: '#F0F7F7',
    borderColor: 'rgba(13, 115, 119, 0.3)',
  },
  activeTenantLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0D7377',
    letterSpacing: 0.8,
  },
  activeTenantName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A2E',
    marginTop: 2,
  },

  // Search Bar
  searchBar: {
    marginBottom: 24,
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
    marginBottom: 16,
  },
  orgLogoBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 16,
  },
  orgMetaText: {
    fontSize: 12,
    color: '#64748B',
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
  orgCardActions: {
    flexDirection: 'row',
    gap: 10,
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

  // Modal Common
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
    maxWidth: 540,
    width: '100%',
    maxHeight: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
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

  // Create Modal Forms
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
