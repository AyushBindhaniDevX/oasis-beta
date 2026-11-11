import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  useWindowDimensions,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SvgXml } from 'react-native-svg';
import {
  Search,
  X,
  ArrowRight,
  Lock,
  Unlock,
  CheckCircle2,
  Sparkles,
  ChevronRight,
  Users,
  Network,
  Building2,
  CalendarDays,
  Clock,
  Calendar,
  CalendarClock,
  Umbrella,
  Workflow,
  CreditCard,
  Receipt,
  FileText,
  Briefcase,
  Award,
  GraduationCap,
  Gift,
  Laptop,
  LifeBuoy,
  BarChart3,
  Shield,
  FileSpreadsheet,
  Settings,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react-native';

import { SidebarLayout } from '@/components/layout/Sidebar';
import { getNavForRole } from '@/constants/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/context/TenantContext';
import { useTheme } from '@/hooks/use-theme';
import { InteractiveTile } from '@/components/ui/InteractiveTile';
import { Modal } from '@/components/ui/Modal';
import { STOCK_2_SVG } from '@/constants/workManagementSvgs';

export type ModuleCategory = 'all' | 'workforce' | 'attendance' | 'payroll' | 'talent' | 'governance';

export interface ModuleItem {
  id: string;
  name: string;
  category: ModuleCategory;
  categoryLabel: string;
  description: string;
  route: string;
  featureKey: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  badge?: string;
  superAdminOnly?: boolean;
}

const ALL_MODULES: ModuleItem[] = [
  // ─── Workforce & Operations ──────────────────────────────────────────
  {
    id: 'users',
    name: 'Users & Staff Directory',
    category: 'workforce',
    categoryLabel: 'Workforce',
    description: 'Manage staff credentials, business unit allocations, active status, and RBAC permissions.',
    route: '/(admin)/users',
    featureKey: 'users',
    icon: Users,
    iconBg: '#EDE9FE',
    iconColor: '#7C3AED',
    badge: 'Core Directory',
  },
  {
    id: 'departments',
    name: 'Departments & Hierarchy',
    category: 'workforce',
    categoryLabel: 'Workforce',
    description: 'Structure operational departments, business divisions, and department head (HOD) assignments.',
    route: '/(hr)/departments',
    featureKey: 'departments',
    icon: Network,
    iconBg: '#E0F2FE',
    iconColor: '#0284C7',
    badge: 'Org Structure',
  },
  {
    id: 'locations',
    name: 'Units & Branch Workplaces',
    category: 'workforce',
    categoryLabel: 'Workforce',
    description: 'Define physical workplace branches, address geo-coordinates, and unit management boundaries.',
    route: '/(hr)/locations',
    featureKey: 'locations',
    icon: Building2,
    iconBg: '#CCFBF1',
    iconColor: '#0D9488',
    badge: 'Workplaces',
  },
  {
    id: 'holidays',
    name: 'Holiday Calendars',
    category: 'workforce',
    categoryLabel: 'Workforce',
    description: 'Publish national holidays, regional office breaks, and customized operational leave schedules.',
    route: '/(hr)/holidays',
    featureKey: 'holidays',
    icon: CalendarDays,
    iconBg: '#FEF3C7',
    iconColor: '#D97706',
    badge: 'Calendar',
  },
  {
    id: 'shifts',
    name: 'Shifts & Rosters',
    category: 'workforce',
    categoryLabel: 'Workforce',
    description: 'Design rotational morning, evening, and night shifts with automated team on-call schedules.',
    route: '/(hr)/shifts',
    featureKey: 'shifts',
    icon: Clock,
    iconBg: '#EEF2FF',
    iconColor: '#4F46E5',
    badge: 'Rostering',
  },

  // ─── Time & Attendance ───────────────────────────────────────────────
  {
    id: 'attendance',
    name: 'Shift Attendance Operations',
    category: 'attendance',
    categoryLabel: 'Attendance',
    description: 'Live biometric logs, GPS geofenced clock-in verification, late arrivals tracking, and shift check-ins.',
    route: '/(hr)/attendance',
    featureKey: 'attendance',
    icon: Calendar,
    iconBg: '#DCFCE7',
    iconColor: '#16A34A',
    badge: 'Real-Time',
  },
  {
    id: 'my-attendance',
    name: 'My Personal Attendance',
    category: 'attendance',
    categoryLabel: 'Attendance',
    description: 'Personal clock-in card, daily shift duration, remote punch-in, and punch regularization requests.',
    route: '/(employee)/attendance',
    featureKey: 'attendance',
    icon: CalendarClock,
    iconBg: '#F3E8FF',
    iconColor: '#8B5CF6',
    badge: 'Self-Service',
  },
  {
    id: 'leave',
    name: 'Leave Management & Approvals',
    category: 'attendance',
    categoryLabel: 'Attendance',
    description: 'Paid time-off, sick days, duty leave balances, team leave calendar, and multi-tier approval chains.',
    route: '/(hr)/leave',
    featureKey: 'leave',
    icon: Umbrella,
    iconBg: '#FCE7F3',
    iconColor: '#EC4899',
    badge: 'Time Off',
  },
  {
    id: 'approval-workflows',
    name: 'Approval Workflows',
    category: 'attendance',
    categoryLabel: 'Attendance',
    description: 'Configurable multi-level approval hierarchies for leave, expenses, and regularization exceptions.',
    route: '/(admin)/approval-workflows',
    featureKey: 'approval_workflows',
    icon: Workflow,
    iconBg: '#F3E8FF',
    iconColor: '#9333EA',
    badge: 'Governance',
  },

  // ─── Payroll & Finance ───────────────────────────────────────────────
  {
    id: 'payroll',
    name: 'Payroll & Salary Ledgers',
    category: 'payroll',
    categoryLabel: 'Payroll & Finance',
    description: 'Automated monthly salary calculation, PF/ESI statutory compliance, allowances, and direct payslips.',
    route: '/(hr)/payroll',
    featureKey: 'payroll',
    icon: CreditCard,
    iconBg: '#D1FAE5',
    iconColor: '#059669',
    badge: 'Financial',
  },
  {
    id: 'templates',
    name: 'Document Templates & Letters',
    category: 'payroll',
    categoryLabel: 'Payroll & Finance',
    description: 'Generate official appointment letters, experience certificates, and NDAs with dynamic merge tags.',
    route: '/(hr)/templates',
    featureKey: 'templates',
    icon: FileText,
    iconBg: '#DBEAFE',
    iconColor: '#2563EB',
    badge: 'Templates',
  },

  // ─── Talent & Performance ────────────────────────────────────────────
  {
    id: 'performance',
    name: 'Performance Reviews & OKRs',
    category: 'talent',
    categoryLabel: 'Talent & HR',
    description: 'Quarterly appraisals, team 360 evaluations, operational milestone tracking, and goal scorecards.',
    route: '/(hr)/performance',
    featureKey: 'performance',
    icon: Award,
    iconBg: '#FEF3C7',
    iconColor: '#F59E0B',
    badge: 'Reviews',
  },
  {
    id: 'learning',
    name: 'LMS & Professional Training',
    category: 'talent',
    categoryLabel: 'Talent & HR',
    description: 'Onboarding training modules, statutory compliance certifications, and continuing education programs.',
    route: '/(hr)/learning',
    featureKey: 'learning',
    icon: GraduationCap,
    iconBg: '#D1FAE5',
    iconColor: '#10B981',
    badge: 'LMS',
  },
  {
    id: 'surveys',
    name: 'Pulse Surveys & Morale',
    category: 'talent',
    categoryLabel: 'Talent & HR',
    description: 'Employee engagement index, anonymous team surveys, and pulse satisfaction feedback.',
    route: '/(hr)/surveys',
    featureKey: 'surveys',
    icon: Gift,
    iconBg: '#EDE9FE',
    iconColor: '#8B5CF6',
    badge: 'Engagement',
  },

  // ─── Governance & IT ─────────────────────────────────────────────────
  {
    id: 'helpdesk',
    name: 'Internal IT & HR Helpdesk',
    category: 'governance',
    categoryLabel: 'IT & Assets',
    description: 'Employee issue tickets, priority dispatching, category routing, SLA tracking, and resolution history.',
    route: '/(hr)/helpdesk',
    featureKey: 'helpdesk',
    icon: LifeBuoy,
    iconBg: '#FEE2E2',
    iconColor: '#DC2626',
    badge: 'Helpdesk',
  },
  {
    id: 'reports',
    name: 'Real-Time Reports & BI Analytics',
    category: 'governance',
    categoryLabel: 'Governance',
    description: 'Enterprise-wide headcount metrics, payroll distributions, attendance heatmaps, and attrition BI.',
    route: '/(admin)/reports',
    featureKey: 'reports',
    icon: BarChart3,
    iconBg: '#EDE9FE',
    iconColor: '#7C3AED',
    badge: 'Analytics',
  },
  {
    id: 'audit-logs',
    name: 'Audit Logs & Security Trail',
    category: 'governance',
    categoryLabel: 'Governance',
    description: 'Tamper-proof event logs, admin activities, role assignments, and actor IP tracking.',
    route: '/(admin)/audit-logs',
    featureKey: 'audit_logs',
    icon: Shield,
    iconBg: '#F1F5F9',
    iconColor: '#475569',
    badge: 'Security',
  },
  {
    id: 'automations',
    name: 'Automations & Event Triggers',
    category: 'governance',
    categoryLabel: 'Governance',
    description: 'Shift transition triggers, automated notification webhooks, and recurring workflow actions.',
    route: '/(admin)/automations',
    featureKey: 'automations',
    icon: Workflow,
    iconBg: '#FEF3C7',
    iconColor: '#D97706',
    badge: 'Automations',
  },
  {
    id: 'data-management',
    name: 'Data Management & CSV Tools',
    category: 'governance',
    categoryLabel: 'Governance',
    description: 'Batch CSV import/export, database backups, audit archival, and records cleanup utilities.',
    route: '/(admin)/data-management',
    featureKey: 'data_management',
    icon: FileSpreadsheet,
    iconBg: '#D1FAE5',
    iconColor: '#059669',
    badge: 'Data Hub',
  },
  {
    id: 'portal',
    name: 'Central Management Portal',
    category: 'governance',
    categoryLabel: 'Governance',
    description: 'Multi-tenant organization switching, unit allocations, feature unlock switches, and enterprise administration.',
    route: '/(admin)/portal',
    featureKey: 'portal',
    icon: Building2,
    iconBg: '#EDE9FE',
    iconColor: '#7C3AED',
    badge: 'Super Admin',
    superAdminOnly: true,
  },
  {
    id: 'settings',
    name: 'System & Security Settings',
    category: 'governance',
    categoryLabel: 'Governance',
    description: 'Organization profile, branding logos, session security rules, and alert notification preferences.',
    route: '/(admin)/settings',
    featureKey: 'settings',
    icon: Settings,
    iconBg: '#F3F4F6',
    iconColor: '#374151',
    badge: 'Configuration',
  },
];

const CATEGORIES: { key: ModuleCategory; label: string }[] = [
  { key: 'all', label: 'All Modules' },
  { key: 'workforce', label: 'Workforce & Ops' },
  { key: 'attendance', label: 'Time & Attendance' },
  { key: 'payroll', label: 'Payroll & Finance' },
  { key: 'talent', label: 'Talent & HR' },
  { key: 'governance', label: 'Governance & IT' },
];

export default function ModulesDirectoryScreen() {
  const router = useRouter();
  const colors = useTheme();
  const { profile } = useAuth();
  const { organization, activePlan, isFeatureEnabled, toggleFeatureLock, refreshTenant } = useTenant();
  const { width } = useWindowDimensions();

  const isDesktop = width >= 1024;
  const isTablet = width >= 640 && width < 1024;
  const isSuperAdmin = profile?.email === 'ayushbindhani001@gmail.com';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ModuleCategory>('all');
  const [refreshing, setRefreshing] = useState(false);

  // Locked feature modal state
  const [lockedModule, setLockedModule] = useState<ModuleItem | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshTenant();
    setRefreshing(false);
  }, [refreshTenant]);

  // Filter modules based on Super Admin privileges, category, and search query
  const filteredModules = useMemo(() => {
    return ALL_MODULES.filter((m) => {
      // If superAdminOnly, only show if user is super admin
      if (m.superAdminOnly && !isSuperAdmin) return false;

      // Category filter
      if (selectedCategory !== 'all' && m.category !== selectedCategory) return false;

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = m.name.toLowerCase().includes(query);
        const matchesDesc = m.description.toLowerCase().includes(query);
        const matchesBadge = m.badge?.toLowerCase().includes(query);
        const matchesCategory = m.categoryLabel.toLowerCase().includes(query);
        return matchesName || matchesDesc || matchesBadge || matchesCategory;
      }

      return true;
    });
  }, [selectedCategory, searchQuery, isSuperAdmin]);

  // Stats calculation
  const totalCount = ALL_MODULES.filter((m) => !m.superAdminOnly || isSuperAdmin).length;
  const unlockedCount = useMemo(() => {
    return ALL_MODULES.filter((m) => {
      if (m.superAdminOnly && !isSuperAdmin) return false;
      return isFeatureEnabled(m.featureKey);
    }).length;
  }, [isFeatureEnabled, isSuperAdmin]);
  const lockedCount = totalCount - unlockedCount;

  // Handle module click
  const handleModuleClick = (m: ModuleItem) => {
    const isUnlocked = isFeatureEnabled(m.featureKey);
    if (!isUnlocked) {
      setLockedModule(m);
      return;
    }
    router.push(m.route as never);
  };

  // Quick unlock by Super Admin
  const handleQuickUnlock = async () => {
    if (!lockedModule || !organization?.id) return;
    setUnlocking(true);
    try {
      await toggleFeatureLock(organization.id, lockedModule.featureKey, true);
      const modRoute = lockedModule.route;
      setLockedModule(null);
      router.push(modRoute as never);
    } catch (e) {
      console.error('Failed to unlock feature:', e);
    } finally {
      setUnlocking(false);
    }
  };

  const navItems = getNavForRole(profile?.role, profile?.email);

  return (
    <SidebarLayout items={navItems}>
      <ScrollView
        style={[styles.container, { backgroundColor: '#FAF9FD' }]}
        contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* ─── Breadcrumb & Navigation Bar ─────────────────────────────── */}
        <View style={styles.breadcrumbRow}>
          <TouchableOpacity
            onPress={() => router.push('/(admin)/dashboard' as never)}
            style={styles.breadcrumbLink}
          >
            <Text style={styles.breadcrumbText}>Dashboard</Text>
          </TouchableOpacity>
          <ChevronRight size={13} color="#94A3B8" />
          <Text style={[styles.breadcrumbText, { color: '#7C3AED', fontWeight: '700' }]}>
            All Modules & Features Directory
          </Text>
        </View>

        {/* ─── Top Hero Banner ─────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.duration(320)} style={styles.heroBanner}>
          <View style={styles.heroLeft}>
            <View style={styles.heroBadge}>
              <Sparkles size={12} color="#7C3AED" />
              <Text style={styles.heroBadgeText}>Enterprise Architecture</Text>
            </View>
            <Text style={styles.heroTitle}>Modules & Feature Access</Text>
            <Text style={styles.heroSubtitle}>
              Explore, search, and launch all operational, workforce, financial, and governance modules provisioned for{' '}
              <Text style={{ fontWeight: '700', color: '#1E293B' }}>{organization?.name || 'Workspace'}</Text>.
            </Text>

            {/* Quick Stats Strip */}
            <View style={styles.statsStrip}>
              <View style={styles.statPill}>
                <Text style={styles.statPillLabel}>Total Modules</Text>
                <Text style={styles.statPillValue}>{totalCount}</Text>
              </View>
              <View style={[styles.statPill, { backgroundColor: '#EDFAF2', borderColor: '#CEF2DE' }]}>
                <Text style={[styles.statPillLabel, { color: '#059669' }]}>Unlocked</Text>
                <Text style={[styles.statPillValue, { color: '#047857' }]}>{unlockedCount}</Text>
              </View>
              {lockedCount > 0 && (
                <View style={[styles.statPill, { backgroundColor: '#FFF7ED', borderColor: '#FFEDD5' }]}>
                  <Text style={[styles.statPillLabel, { color: '#D97706' }]}>Locked</Text>
                  <Text style={[styles.statPillValue, { color: '#B45309' }]}>{lockedCount}</Text>
                </View>
              )}
              <View style={[styles.statPill, { backgroundColor: '#F3EEFE', borderColor: '#E4DCFD' }]}>
                <Text style={[styles.statPillLabel, { color: '#7C3AED' }]}>Tier</Text>
                <Text style={[styles.statPillValue, { color: '#6D28D9' }]}>{activePlan.toUpperCase()}</Text>
              </View>
            </View>
          </View>

          {isDesktop && (
            <View style={styles.heroRightGraphic}>
              <SvgXml xml={STOCK_2_SVG} width={220} height={150} />
            </View>
          )}
        </Animated.View>

        {/* ─── Search & Category Filters Bar ────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(80).duration(300)} style={styles.filtersContainer}>
          {/* Search Input */}
          <View style={styles.searchBox}>
            <Search size={18} color="#64748B" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search 20+ modules, tools, and configurations..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
                <X size={16} color="#64748B" />
              </TouchableOpacity>
            )}
          </View>

          {/* Category Filter Pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScroll}
          >
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.key;
              const count = ALL_MODULES.filter((m) => {
                if (m.superAdminOnly && !isSuperAdmin) return false;
                if (cat.key === 'all') return true;
                return m.category === cat.key;
              }).length;

              return (
                <TouchableOpacity
                  key={cat.key}
                  style={[styles.categoryPill, isSelected && styles.categoryPillActive]}
                  onPress={() => setSelectedCategory(cat.key)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.categoryPillText, isSelected && styles.categoryPillTextActive]}>
                    {cat.label} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Animated.View>

        {/* ─── Modules Grid ────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(140).duration(320)}>
          {filteredModules.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Search size={28} color="#94A3B8" />
              </View>
              <Text style={styles.emptyTitle}>No matching modules found</Text>
              <Text style={styles.emptySubtitle}>
                Try adjusting your search query or filter by a different functional area.
              </Text>
              <TouchableOpacity
                style={styles.emptyResetBtn}
                onPress={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                }}
              >
                <Text style={styles.emptyResetBtnText}>Reset All Filters</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.modulesGrid, isDesktop && styles.modulesGridDesktop]}>
              {filteredModules.map((item, idx) => {
                const isUnlocked = isFeatureEnabled(item.featureKey);
                const IconComponent = item.icon;

                return (
                  <InteractiveTile
                    key={item.id}
                    style={[
                      styles.moduleCard,
                      isDesktop && styles.moduleCardDesktop,
                      isTablet && styles.moduleCardTablet,
                      !isUnlocked && styles.moduleCardLocked,
                    ]}
                    onPress={() => handleModuleClick(item)}
                  >
                    {/* Card Header Row */}
                    <View style={styles.cardHeaderRow}>
                      <View style={[styles.cardIconBox, { backgroundColor: item.iconBg }]}>
                        <IconComponent size={22} color={item.iconColor} />
                      </View>

                      {/* Status and Badge Pill */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {item.badge && (
                          <View style={styles.cardBadgePill}>
                            <Text style={styles.cardBadgePillText}>{item.badge}</Text>
                          </View>
                        )}
                        <View
                          style={[
                            styles.statusDotPill,
                            isUnlocked ? styles.statusDotPillActive : styles.statusDotPillLocked,
                          ]}
                        >
                          {isUnlocked ? (
                            <>
                              <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
                              <Text style={[styles.statusDotText, { color: '#047857' }]}>Unlocked</Text>
                            </>
                          ) : (
                            <>
                              <Lock size={10} color="#D97706" />
                              <Text style={[styles.statusDotText, { color: '#B45309' }]}>Locked</Text>
                            </>
                          )}
                        </View>
                      </View>
                    </View>

                    {/* Card Title & Category */}
                    <View style={{ marginTop: 12, flex: 1 }}>
                      <Text style={styles.cardCategoryText}>{item.categoryLabel}</Text>
                      <Text style={styles.cardTitleText} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.cardDescText} numberOfLines={3}>
                        {item.description}
                      </Text>
                    </View>

                    {/* Card Footer Action */}
                    <View style={styles.cardFooterRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={styles.cardRouteText} numberOfLines={1}>
                          {item.route}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.cardActionBtn,
                          isUnlocked ? styles.cardActionBtnActive : styles.cardActionBtnLocked,
                        ]}
                      >
                        <Text
                          style={[
                            styles.cardActionBtnText,
                            isUnlocked ? styles.cardActionBtnTextActive : styles.cardActionBtnTextLocked,
                          ]}
                        >
                          {isUnlocked ? 'Launch' : 'Unlock'}
                        </Text>
                        <ArrowRight
                          size={13}
                          color={isUnlocked ? '#7C3AED' : '#94A3B8'}
                        />
                      </View>
                    </View>
                  </InteractiveTile>
                );
              })}
            </View>
          )}
        </Animated.View>

        {/* ─── Super Admin Helper Banner ────────────────────────────────── */}
        {isSuperAdmin && (
          <Animated.View entering={FadeInDown.delay(200).duration(300)} style={styles.superAdminBanner}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.superAdminIconCircle}>
                <ShieldCheck size={20} color="#7C3AED" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.superAdminTitle}>Super Admin Central Control</Text>
                <Text style={styles.superAdminDesc}>
                  Need to enable or disable features across client hospitals and manage unit structures?
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.superAdminBtn}
              onPress={() => router.push('/(admin)/portal' as never)}
              activeOpacity={0.8}
            >
              <Text style={styles.superAdminBtnText}>Open Central Portal</Text>
              <ExternalLink size={13} color="#FFFFFF" />
            </TouchableOpacity>
          </Animated.View>
        )}
      </ScrollView>

      {/* ─── Locked Feature Modal ──────────────────────────────────────── */}
      <Modal
        visible={lockedModule !== null}
        onClose={() => setLockedModule(null)}
        title={lockedModule ? lockedModule.name : 'Feature Locked'}
        subtitle="Tier Restriction & Modular Gating"
        size="md"
        icon={<Lock size={20} color="#D97706" />}
        iconBgColor="#FEF3C7"
        iconBorderColor="#FDE68A"
        badge={{ text: activePlan.toUpperCase(), variant: 'warning' }}
        primaryAction={
          isSuperAdmin
            ? {
                label: 'Unlock Feature for Tenant',
                onPress: handleQuickUnlock,
                loading: unlocking,
                variant: 'primary',
              }
            : {
                label: 'Close',
                onPress: () => setLockedModule(null),
                variant: 'primary',
              }
        }
        secondaryAction={
          isSuperAdmin
            ? {
                label: 'Go to Central Portal',
                onPress: () => {
                  setLockedModule(null);
                  router.push('/(admin)/portal' as never);
                },
              }
            : undefined
        }
      >
        <View style={styles.lockedModalBody}>
          <Text style={styles.lockedModalDesc}>
            The <Text style={{ fontWeight: '700', color: '#1E293B' }}>{lockedModule?.name}</Text> module is currently
            restricted on the{' '}
            <Text style={{ fontWeight: '700', color: '#7C3AED' }}>{activePlan.toUpperCase()}</Text> tier for{' '}
            <Text style={{ fontWeight: '700', color: '#1E293B' }}>{organization?.name || 'this organization'}</Text>.
          </Text>

          <View style={styles.lockedFeatureDetails}>
            <View style={styles.lockedDetailRow}>
              <Text style={styles.lockedDetailLabel}>Module Route:</Text>
              <Text style={styles.lockedDetailValue}>{lockedModule?.route}</Text>
            </View>
            <View style={styles.lockedDetailRow}>
              <Text style={styles.lockedDetailLabel}>Feature Key:</Text>
              <Text style={styles.lockedDetailValue}>{lockedModule?.featureKey}</Text>
            </View>
            <View style={styles.lockedDetailRow}>
              <Text style={styles.lockedDetailLabel}>Functional Area:</Text>
              <Text style={styles.lockedDetailValue}>{lockedModule?.categoryLabel}</Text>
            </View>
          </View>

          {isSuperAdmin ? (
            <View style={styles.superAdminNoticeBox}>
              <CheckCircle2 size={16} color="#059669" />
              <Text style={styles.superAdminNoticeText}>
                As a Super Admin (<Text style={{ fontWeight: '700' }}>{profile?.email}</Text>), you have direct authorization
                to unlock this module instantly or manage tenant plans in the Central Portal.
              </Text>
            </View>
          ) : (
            <View style={styles.standardNoticeBox}>
              <Text style={styles.standardNoticeText}>
                Please contact your hospital Super Administrator or IT Operations Head to request feature activation for this workspace.
              </Text>
            </View>
          )}
        </View>
      </Modal>
    </SidebarLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 60,
  },
  contentDesktop: {
    padding: 28,
    paddingBottom: 70,
    maxWidth: 1440,
    alignSelf: 'center',
    width: '100%',
  },

  /* Breadcrumbs */
  breadcrumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  breadcrumbLink: {
    paddingVertical: 2,
  },
  breadcrumbText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },

  /* Hero Banner */
  heroBanner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8E5F3',
    padding: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 14,
    elevation: 2,
  },
  heroLeft: {
    flex: 1,
    minWidth: 260,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3EEFE',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E4DCFD',
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C3AED',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 13.5,
    color: '#64748B',
    lineHeight: 20,
    maxWidth: 620,
    marginBottom: 16,
  },
  heroRightGraphic: {
    paddingLeft: 20,
    opacity: 0.95,
  },

  /* Stats Strip */
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
  },
  statPillLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  statPillValue: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0F172A',
  },

  /* Filters & Search */
  filtersContainer: {
    marginBottom: 20,
    gap: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#0F172A',
    paddingVertical: 0,
  },
  categoryScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  categoryPillActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  categoryPillText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748B',
  },
  categoryPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  /* Modules Grid */
  modulesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  modulesGridDesktop: {
    gap: 16,
  },
  moduleCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ECECF2',
    padding: 18,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
    justifyContent: 'space-between',
  },
  moduleCardTablet: {
    width: '48.5%',
  },
  moduleCardDesktop: {
    width: '32%',
    minWidth: 300,
  },
  moduleCardLocked: {
    backgroundColor: '#FCFCFD',
    borderColor: '#E2E8F0',
    opacity: 0.88,
  },

  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBadgePill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  cardBadgePillText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#475569',
  },
  statusDotPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusDotPillActive: {
    backgroundColor: '#EDFAF2',
  },
  statusDotPillLocked: {
    backgroundColor: '#FFF7ED',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotText: {
    fontSize: 10.5,
    fontWeight: '700',
  },

  cardCategoryText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  cardTitleText: {
    fontSize: 15.5,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  cardDescText: {
    fontSize: 12.5,
    color: '#64748B',
    lineHeight: 18,
    minHeight: 54,
  },

  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cardRouteText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#94A3B8',
    maxWidth: 160,
  },
  cardActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  cardActionBtnActive: {
    backgroundColor: '#F3EEFE',
  },
  cardActionBtnLocked: {
    backgroundColor: '#F1F5F9',
  },
  cardActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cardActionBtnTextActive: {
    color: '#7C3AED',
  },
  cardActionBtnTextLocked: {
    color: '#64748B',
  },

  /* Empty State */
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 400,
    marginBottom: 16,
  },
  emptyResetBtn: {
    backgroundColor: '#F3EEFE',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  emptyResetBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7C3AED',
  },

  /* Super Admin Banner */
  superAdminBanner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E4DCFD',
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    flexWrap: 'wrap',
    gap: 14,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  superAdminIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F3EEFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  superAdminTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  superAdminDesc: {
    fontSize: 12.5,
    color: '#64748B',
    maxWidth: 600,
  },
  superAdminBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  superAdminBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* Locked Modal Body */
  lockedModalBody: {
    paddingTop: 8,
    gap: 14,
  },
  lockedModalDesc: {
    fontSize: 13.5,
    color: '#475569',
    lineHeight: 20,
  },
  lockedFeatureDetails: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 8,
  },
  lockedDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lockedDetailLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  lockedDetailValue: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#0F172A',
    fontWeight: '600',
  },
  superAdminNoticeBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#EDFAF2',
    borderWidth: 1,
    borderColor: '#CEF2DE',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  superAdminNoticeText: {
    fontSize: 12,
    color: '#065F46',
    lineHeight: 18,
    flex: 1,
  },
  standardNoticeBox: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    padding: 12,
    borderRadius: 10,
  },
  standardNoticeText: {
    fontSize: 12,
    color: '#9A3412',
    lineHeight: 18,
  },
});
