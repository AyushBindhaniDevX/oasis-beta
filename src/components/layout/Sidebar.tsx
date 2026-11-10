import { Avatar } from '@/components/ui/Avatar';
import { FeatureGate } from '@/components/ui/FeatureGate';
import { SubedgeBrand } from '@/components/ui/SubedgeBrand';
import { getNavForRole, NavItem } from '@/constants/navigation';
import { BorderRadius, NotionColors } from '@/constants/theme';
import { useNotifications } from '@/context/NotificationContext';
import { useTenant } from '@/context/TenantContext';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/useAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePathname, useRouter } from 'expo-router';
import {
  Banknote,
  BarChart3,
  Bell,
  Building2,
  CalendarClock, CalendarDays,
  ChevronDown,
  ChevronRight,
  Grid,
  HelpCircle,
  Home,
  LayoutDashboard,
  Lock,
  LogOut,
  MoreHorizontal,
  PanelLeftClose, PanelLeftOpen,
  Plus,
  Search,
  Settings,
  Users,
  X,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Modal, Platform,
  Pressable,
  ScrollView, StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const SIDEBAR_COLLAPSED_KEY = 'oasis.sidebar.collapsed.v2';
const W_EXPANDED = 260;
const W_COLLAPSED = 72;

export function getRouteFeature(pathname: string): { feature: string; name: string } | null {
  if (pathname.includes('/attendance')) return { feature: 'attendance', name: 'Attendance & Time Tracking' };
  if (pathname.includes('/leave')) return { feature: 'leave', name: 'Leave & Time Off' };
  if (pathname.includes('/holidays')) return { feature: 'holidays', name: 'Holiday Calendar' };
  if (pathname.includes('/shifts')) return { feature: 'shifts', name: 'Shifts & Rosters' };
  if (pathname.includes('/performance')) return { feature: 'performance', name: 'Performance Management' };
  if (pathname.includes('/payroll') || pathname.includes('/payslips')) return { feature: 'payroll', name: 'Payroll & Compensation' };
  if (pathname.includes('/users') || pathname.includes('/directory')) return { feature: 'users', name: 'Staff & User Directory' };
  if (pathname.includes('/departments')) return { feature: 'departments', name: 'Department Management' };
  if (pathname.includes('/locations')) return { feature: 'locations', name: 'Units / Sub-Brands' };
  if (pathname.includes('/templates')) return { feature: 'templates', name: 'Document & Email Templates' };
  if (pathname.includes('/audit-logs')) return { feature: 'audit_logs', name: 'Audit & Compliance Logs' };
  if (pathname.includes('/expenses')) return { feature: 'expenses', name: 'Expense Management' };
  if (pathname.includes('/helpdesk')) return { feature: 'helpdesk', name: 'Helpdesk & Support' };
  if (pathname.includes('/assets')) return { feature: 'assets', name: 'Asset Management' };
  if (pathname.includes('/learning')) return { feature: 'learning', name: 'Learning & LMS' };
  if (pathname.includes('/recruitment')) return { feature: 'recruitment', name: 'Recruitment & ATS' };
  return null;
}

function DesktopQuickActionBtn({
  collapsed,
  effectiveRole,
  onPress,
}: {
  collapsed: boolean;
  effectiveRole: string;
  onPress: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  if (collapsed) {
    return (
      <Pressable
        onPress={onPress}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        style={[
          styles.collapsedIconBtn,
          { backgroundColor: hovered ? '#6D28D9' : '#7C3AED' },
        ]}
      >
        <Plus size={16} color="#fff" strokeWidth={2.5} />
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={[
        styles.newRequestBtn,
        hovered && styles.newRequestBtnHover,
      ]}
    >
      <View style={styles.newRequestIconPill}>
        <Plus size={14} color="#FFFFFF" strokeWidth={2.8} />
      </View>
      <Text style={styles.newRequestText}>
        {effectiveRole === 'employee' ? 'New Request' : 'Quick Action'}
      </Text>
      <View style={styles.newRequestShortcutBadge}>
        <Text style={styles.newRequestShortcutText}>⚡</Text>
      </View>
    </Pressable>
  );
}

function DesktopNavItem({
  item,
  active,
  collapsed,
  isLocked,
  onPress,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  isLocked: boolean;
  onPress: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const IconComponent = item.icon;

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={[
        styles.navItem,
        collapsed && styles.navItemCollapsed,
        active && styles.navItemActive,
        hovered && !active && styles.navItemHover,
        isLocked && { opacity: 0.55 },
      ]}
    >
      {active && !collapsed && <View style={styles.navActiveLeftBar} />}

      {IconComponent && (
        <View
          style={[
            styles.navIconBox,
            hovered && !active && styles.navIconBoxHover,
            active && styles.navIconBoxActive,
          ]}
        >
          <IconComponent
            size={17}
            color={active ? '#7C3AED' : hovered ? '#0F172A' : isLocked ? NotionColors.muted : '#64748B'}
            strokeWidth={active ? 2.3 : 1.8}
          />
        </View>
      )}

      {!collapsed && (
        <Text
          numberOfLines={1}
          style={[
            styles.navLabel,
            {
              color: active ? '#7C3AED' : hovered ? '#0F172A' : isLocked ? NotionColors.muted : '#334155',
              fontWeight: active ? '700' : hovered ? '600' : '500',
            },
          ]}
        >
          {item.label}
        </Text>
      )}

      {!collapsed && active && (
        <View style={styles.sidebarActiveDot} />
      )}

      {!collapsed && isLocked && (
        <View style={styles.lockedPill}>
          <Lock size={9} color={NotionColors.semanticError} strokeWidth={2.5} />
          <Text style={styles.lockedPillText}>LOCKED</Text>
        </View>
      )}

      {collapsed && isLocked && (
        <View style={styles.collapsedLockDot}>
          <Lock size={7} color="#fff" strokeWidth={2.5} />
        </View>
      )}
    </Pressable>
  );
}

interface SidebarProps { items?: NavItem[]; children: React.ReactNode; }

export function SidebarLayout({ items, children }: SidebarProps) {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const pathname = usePathname();
  const { profile, role, signOut } = useAuth();
  const { companyName, companyLogoUrl, organization, isFeatureEnabled } = useTenant();
  const { unreadCount } = useNotifications();

  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [moreSearchQuery, setMoreSearchQuery] = useState('');

  /* ── Collapse state (simple boolean, no animation) ───────────────── */
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(SIDEBAR_COLLAPSED_KEY)
      .then((v) => { if (v === '1') setCollapsed(true); })
      .catch(() => { });
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      AsyncStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0').catch(() => { });
      return next;
    });
  }, []);

  const effectiveRole = profile?.role || role || 'employee';
  const effectiveItems: NavItem[] = useMemo(
    () => items || getNavForRole(effectiveRole, profile?.email),
    [effectiveRole, items, profile?.email],
  );

  const navGroups = useMemo(() => {
    const list = effectiveItems;
    if (effectiveRole === 'admin') {
      const g1 = list.filter((i) => ['Dashboard', 'Central Portal'].includes(i.label));
      const g2 = list.filter((i) =>
        ['My Attendance', 'Users & Employees', 'Departments', 'Team Attendance', 'Shifts & Rosters', 'Leave', 'Holiday Calendar', 'Recruitment & Hiring'].includes(i.label)
      );
      const g3 = list.filter((i) => ['Payroll', 'Expenses & Claims', 'Performance', 'Reports & Analytics'].includes(i.label));
      const g4 = list.filter((i) =>
        ['Asset Management', 'Learning & LMS', 'Helpdesk & Support', 'Units / Sub-Brands', 'Templates & Letters'].includes(i.label)
      );
      const g5 = list.filter((i) => !g1.includes(i) && !g2.includes(i) && !g3.includes(i) && !g4.includes(i));
      return [
        { key: 'overview', title: 'OVERVIEW', items: g1 },
        { key: 'workforce', title: 'WORKFORCE & ROSTER', items: g2 },
        { key: 'finance', title: 'PAYROLL & EXPENSES', items: g3 },
        { key: 'operations', title: 'OPERATIONS & ASSETS', items: g4 },
        { key: 'admin', title: 'ADMINISTRATION & POLICIES', items: g5 },
      ].filter((g) => g.items.length > 0);
    }
    if (effectiveRole === 'hr') {
      const g1 = list.filter((i) => ['Dashboard', 'My Attendance'].includes(i.label));
      const g2 = list.filter((i) =>
        ['Users & Employees', 'Departments', 'Team Attendance', 'Shifts & Rosters', 'Leave', 'Holiday Calendar', 'Recruitment & Hiring'].includes(i.label)
      );
      const g3 = list.filter((i) => ['Payroll', 'Expenses & Claims', 'Performance', 'Reports & Analytics'].includes(i.label));
      const g4 = list.filter((i) =>
        ['Asset Management', 'Learning & LMS', 'Helpdesk & Support', 'Units / Sub-Brands', 'Templates & Letters'].includes(i.label)
      );
      const g5 = list.filter((i) => !g1.includes(i) && !g2.includes(i) && !g3.includes(i) && !g4.includes(i));
      return [
        { key: 'overview', title: 'OVERVIEW', items: g1 },
        { key: 'workforce', title: 'WORKFORCE', items: g2 },
        { key: 'finance', title: 'PAYROLL & EXPENSES', items: g3 },
        { key: 'operations', title: 'OPERATIONS & ASSETS', items: g4 },
        { key: 'org', title: 'ORGANIZATION', items: g5 },
      ].filter((g) => g.items.length > 0);
    }
    // Employee
    const g1 = list.filter((i) => ['Dashboard'].includes(i.label));
    const g2 = list.filter((i) => ['Attendance', 'Leave', 'Holiday Calendar'].includes(i.label));
    const g3 = list.filter((i) => !g1.includes(i) && !g2.includes(i));
    return [
      { key: 'overview', title: 'OVERVIEW', items: g1 },
      { key: 'time', title: 'ATTENDANCE & TIME', items: g2 },
      { key: 'career', title: 'COMPENSATION & MODULES', items: g3 },
    ].filter((g) => g.items.length > 0);
  }, [effectiveItems, effectiveRole]);

  const isDesktop = width >= 1024;

  const isItemActive = (href: string) => {
    if (!href || !pathname) return false;
    if (pathname === href) return true;

    // Clean leading/trailing slashes and group identifiers like (admin), (hr), (employee)
    const cleanPath = pathname.replace(/\/\([^)]+\)/g, '').replace(/^\/+|\/+$/g, '').toLowerCase();
    const cleanHref = href.replace(/\/\([^)]+\)/g, '').replace(/^\/+|\/+$/g, '').toLowerCase();

    // 1. Exact match after stripping route groups
    if (cleanPath === cleanHref) return true;

    // 2. Dashboard match: when pathname is /dashboard or root /
    if (cleanHref === 'dashboard') {
      return (
        cleanPath === 'dashboard' ||
        cleanPath === '' ||
        cleanPath === 'admin' ||
        cleanPath === 'hr' ||
        cleanPath === 'employee'
      );
    }

    // 3. Reports match
    if (cleanHref.includes('reports') && cleanPath.includes('reports')) {
      return true;
    }

    // 4. Attendance & Group disambiguation:
    if (href.includes('/(employee)/') && (pathname.includes('/(hr)/') || pathname.includes('/(admin)/'))) return false;
    if ((href.includes('/(hr)/') || href.includes('/(admin)/')) && pathname.includes('/(employee)/')) return false;

    if (href === '/(employee)/attendance') {
      return pathname.includes('/(employee)/') || cleanPath === 'employee/attendance';
    }
    if (href === '/(hr)/attendance') {
      return (cleanPath === 'attendance' || cleanPath.startsWith('attendance/')) && !pathname.includes('/(employee)/');
    }

    // 5. Sub-route match (e.g. /leave/apply or /leave/123 matching /leave)
    if (cleanHref && (cleanPath === cleanHref || cleanPath.startsWith(cleanHref + '/'))) {
      return true;
    }

    // 6. Direct segment check for single-slug modules
    const hrefSegment = cleanHref.split('/')[0];
    const pathSegment = cleanPath.split('/')[0];
    if (hrefSegment && pathSegment && hrefSegment === pathSegment) {
      return true;
    }

    return false;
  };

  const mobileTabs = useMemo(() => {
    if (effectiveRole === 'admin' || effectiveRole === 'hr') {
      const reportsHref = effectiveRole === 'admin' ? '/(admin)/reports' : '/(hr)/reports';
      return [
        { label: 'Home', href: effectiveRole === 'admin' ? '/(admin)/dashboard' : '/(hr)/dashboard', icon: Home },
        { label: 'Employees', href: '/(admin)/users', icon: Users, feature: 'users' },
        { label: 'Attendance', href: '/(hr)/attendance', icon: CalendarDays, feature: 'attendance' },
        { label: 'Reports', href: reportsHref, icon: BarChart3 },
      ];
    }
    return [
      { label: 'Home', href: '/(employee)/dashboard', icon: Home },
      { label: 'Attendance', href: '/(employee)/attendance', icon: CalendarClock, feature: 'attendance' },
      { label: 'Leave', href: '/(employee)/leave', icon: CalendarDays, feature: 'leave' },
      { label: 'Salary', href: '/(employee)/payslips', icon: Banknote, feature: 'payroll' },
    ];
  }, [effectiveRole]);

  const isItemLocked = (item: NavItem) => {
    if (item.feature) return !isFeatureEnabled(item.feature);
    if (item.href === '/(admin)/portal' && profile?.email !== 'ayushbindhani001@gmail.com') return true;
    return false;
  };

  const handleLockedItemPress = (label: string) =>
    Alert.alert('Feature Locked', `The "${label}" module is locked for your organization.`);

  const currentRouteFeat = getRouteFeature(pathname);
  const isCurrentRouteLocked = currentRouteFeat ? !isFeatureEnabled(currentRouteFeat.feature) : false;

  const handleSearchSubmit = () => {
    if (!searchQuery.trim()) return;
    const q = encodeURIComponent(searchQuery.trim());
    router.push(effectiveRole === 'employee' ? (`/(employee)/directory?q=${q}` as never) : (`/(admin)/users?q=${q}` as never));
  };
  const handleNewAction = () =>
    router.push((effectiveRole === 'employee' ? '/(employee)/leave/apply' : '/(admin)/users') as never);
  const handleNotificationPress = () => router.push('/(employee)/notifications' as never);
  const handleSettingsPress = () =>
    router.push((effectiveRole === 'admin' ? '/(admin)/settings' : '/(employee)/settings') as never);
  const handleDashboardPress = () => {
    if (effectiveRole === 'admin') router.push('/(admin)/dashboard' as never);
    else if (effectiveRole === 'hr') router.push('/(hr)/dashboard' as never);
    else router.push('/(employee)/dashboard' as never);
  };
  const handleHelpPress = () => {
    if (effectiveRole === 'admin') router.push('/(admin)/help' as never);
    else if (effectiveRole === 'hr') router.push('/(hr)/help' as never);
    else router.push('/(employee)/help' as never);
  };

  const filteredMoreModules = effectiveItems.filter((item) =>
    item.label.toLowerCase().includes(moreSearchQuery.toLowerCase()),
  );

  /* ─── MOBILE (Floating Modern Pill Navbar & Top Header) ───────── */
  const userInitial = (profile?.full_name || profile?.email || 'A').charAt(0).toUpperCase();
  const orgDisplayName = companyName || organization?.name || 'WorkGrid';
  const orgSubName = organization?.slug ? organization.slug.replace(/-/g, ' ') : `${String(effectiveRole).toUpperCase()} SUITE`;

  if (!isDesktop) {
    return (
      <View style={{ flex: 1, backgroundColor: NotionColors.canvas }}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: NotionColors.canvas }} />

        {/* ── Mobile Top Bar: Org Branding on Left, Bell & Profile Avatar on Right ── */}
        <View style={styles.mobileTopBar}>
          {/* Top Left: Organization Branding Pill */}
          <TouchableOpacity
            style={styles.mobileOrgPill}
            activeOpacity={0.8}
            onPress={handleSettingsPress}
          >
            <View style={styles.mobileOrgIconBox}>
              {companyLogoUrl && /^(https?:|data:image\/|\/)/.test(companyLogoUrl) ? (
                <Image
                  source={{ uri: companyLogoUrl }}
                  style={{ width: 22, height: 22, borderRadius: 6 }}
                  resizeMode="contain"
                />
              ) : (
                <Building2 size={16} color="#7C3AED" />
              )}
            </View>
            <View style={styles.mobileOrgTextCol}>
              <Text style={styles.mobileOrgTitle} numberOfLines={1}>
                {orgDisplayName}
              </Text>
              <View style={styles.mobileRoleBadge}>
                <Text style={styles.mobileRoleBadgeText}>
                  {String(effectiveRole).toUpperCase()}
                </Text>
              </View>
            </View>
            <ChevronDown size={13} color="#94A3B8" style={{ marginLeft: 2 }} />
          </TouchableOpacity>

          {/* Top Right: Notification Bell + Profile Avatar */}
          <View style={styles.mobileTopRightActions}>
            <TouchableOpacity
              onPress={handleNotificationPress}
              style={styles.mobileBellBtn}
              activeOpacity={0.8}
            >
              <Bell size={18} color="#334155" strokeWidth={2} />
              {unreadCount > 0 && <View style={styles.mobileNotificationDot} />}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/(employee)/profile' as never)}
              style={styles.mobileAvatarBtn}
              activeOpacity={0.8}
            >
              {profile?.avatar_url ? (
                <Image
                  source={{ uri: profile.avatar_url }}
                  style={{ width: 34, height: 34, borderRadius: 17 }}
                />
              ) : (
                <View style={styles.mobileAvatarFallback}>
                  <Text style={styles.mobileAvatarText}>{userInitial}</Text>
                </View>
              )}
              <View style={styles.mobileAvatarOnlineDot} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ flex: 1, backgroundColor: NotionColors.canvas }}>
          {isCurrentRouteLocked && currentRouteFeat ? (
            <FeatureGate feature={currentRouteFeat.feature} featureName={currentRouteFeat.name}>
              {children}
            </FeatureGate>
          ) : children}
        </View>

        {/* Floating Modern Pill Navbar */}
        <View
          pointerEvents="box-none"
          style={[
            styles.floatingNavWrapper,
            { bottom: Math.max(insets.bottom, 12) },
          ]}
        >
          <View style={styles.floatingNavBar}>
            {mobileTabs.map((tab) => {
              const active = isItemActive(tab.href);
              const IconComp = tab.icon;
              const isLocked = tab.feature ? !isFeatureEnabled(tab.feature) : false;
              return (
                <TouchableOpacity
                  key={tab.href}
                  onPress={() => (isLocked ? handleLockedItemPress(tab.label) : router.push(tab.href as never))}
                  style={[
                    styles.floatingTabBtn,
                    active && styles.floatingTabBtnActive,
                    isLocked && { opacity: 0.55 },
                  ]}
                  activeOpacity={0.7}
                >
                  <View style={styles.tabIconContainer}>
                    <IconComp
                      size={20}
                      color={active ? '#7C3AED' : isLocked ? NotionColors.muted : '#94A3B8'}
                      strokeWidth={active ? 2.5 : 1.8}
                    />
                    {isLocked && (
                      <View style={styles.tabLockBadge}>
                        <Lock size={7} color="#fff" strokeWidth={3} />
                      </View>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.tabLabel,
                      active && styles.tabLabelActive,
                      isLocked && { color: NotionColors.muted },
                    ]}
                    numberOfLines={1}
                  >
                    {tab.label}
                  </Text>
                  {active && <View style={styles.activeIndicatorBar} />}
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              onPress={() => setShowMoreSheet(true)}
              style={[
                styles.floatingTabBtn,
                showMoreSheet && styles.floatingTabBtnActive,
              ]}
              activeOpacity={0.7}
            >
              <View style={styles.tabIconContainer}>
                <MoreHorizontal
                  size={20}
                  color={showMoreSheet ? '#7C3AED' : '#94A3B8'}
                  strokeWidth={showMoreSheet ? 2.5 : 1.8}
                />
                {unreadCount > 0 && (
                  <View style={styles.tabCountBadge}>
                    <Text style={styles.tabCountText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                  </View>
                )}
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  showMoreSheet && styles.tabLabelActive,
                ]}
              >
                More
              </Text>
              {showMoreSheet && <View style={styles.activeIndicatorBar} />}
            </TouchableOpacity>
          </View>
        </View>

        <Modal visible={showMoreSheet} animationType="slide" transparent onRequestClose={() => setShowMoreSheet(false)}>
          <View style={styles.sheetOverlay}>
            <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setShowMoreSheet(false)} />
            <View style={[styles.sheetContainer, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetTitle}>All Oasis Modules</Text>
                  <Text style={styles.sheetSubtitle}>{String(effectiveRole).toUpperCase()} Console</Text>
                </View>
                <TouchableOpacity onPress={() => setShowMoreSheet(false)} style={styles.sheetCloseBtn}>
                  <X size={16} color={NotionColors.steel} />
                </TouchableOpacity>
              </View>
              <View style={styles.sheetSearchBox}>
                <Search size={14} color={NotionColors.steel} />
                <TextInput
                  style={styles.sheetSearchInput}
                  placeholder="Search apps, payroll, documents…"
                  value={moreSearchQuery}
                  onChangeText={setMoreSearchQuery}
                  placeholderTextColor={NotionColors.steel}
                />
                {moreSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setMoreSearchQuery('')}>
                    <X size={12} color={NotionColors.steel} />
                  </TouchableOpacity>
                )}
              </View>
              <ScrollView
                style={styles.sheetScroll}
                contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 24 }}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.appLauncherGrid}>
                  {filteredMoreModules.map((item) => {
                    const active = isItemActive(item.href);
                    const IconComponent = item.icon || LayoutDashboard;
                    const isLocked = isItemLocked(item);
                    return (
                      <TouchableOpacity
                        key={item.href}
                        onPress={() => {
                          setShowMoreSheet(false);
                          if (isLocked) handleLockedItemPress(item.label);
                          else router.push(item.href as never);
                        }}
                        style={[styles.appGridItem, isLocked && { opacity: 0.6 }]}
                        activeOpacity={0.8}
                      >
                        <View
                          style={[
                            styles.appIconCircle,
                            active && { backgroundColor: NotionColors.cardTintLavender, borderColor: NotionColors.brandPurple300 },
                            isLocked && { backgroundColor: NotionColors.cardTintRose, borderColor: '#fde0ec' },
                          ]}
                        >
                          <IconComponent
                            size={20}
                            color={active ? NotionColors.primary : isLocked ? NotionColors.semanticError : NotionColors.ink}
                            strokeWidth={active ? 2.2 : 1.8}
                          />
                          {isLocked && (
                            <View style={styles.moreLockBadge}>
                              <Lock size={8} color="#fff" strokeWidth={2.5} />
                            </View>
                          )}
                        </View>
                        <Text
                          style={[
                            styles.appGridLabel,
                            active && { color: NotionColors.primary, fontWeight: '600' },
                            isLocked && { color: NotionColors.steel },
                          ]}
                          numberOfLines={2}
                        >
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={styles.sheetUserSection}>
                  {[
                    { icon: Settings, label: 'Account & App Settings', onPress: handleSettingsPress },
                    { icon: HelpCircle, label: 'Help & Support Center', onPress: handleHelpPress },
                  ].map((a) => (
                    <TouchableOpacity
                      key={a.label}
                      onPress={() => { setShowMoreSheet(false); a.onPress(); }}
                      style={styles.sheetActionRow}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <a.icon size={16} color={NotionColors.steel} />
                        <Text style={styles.sheetActionText}>{a.label}</Text>
                      </View>
                      <ChevronRight size={14} color={NotionColors.hairlineStrong} />
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    onPress={() => { setShowMoreSheet(false); signOut(); }}
                    style={[styles.sheetActionRow, { borderBottomWidth: 0 }]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <LogOut size={16} color={NotionColors.semanticError} />
                      <Text style={[styles.sheetActionText, { color: NotionColors.semanticError, fontWeight: '600' }]}>Sign Out</Text>
                    </View>
                    <ChevronRight size={14} color={NotionColors.semanticError} />
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  /* ─── DESKTOP (working collapsible) ──────────────────────────────── */
  const sideWidth = collapsed ? W_COLLAPSED : W_EXPANDED;

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: NotionColors.canvas }}>
      {/* SIDEBAR — width driven by state, no Animated wrapper */}
      <View
        style={[
          styles.sidebar,
          {
            width: sideWidth,
            minWidth: sideWidth,
            maxWidth: sideWidth,
            borderRightColor: '#EDE9FE',
          },
        ]}
      >
        {/* Brand row */}
        <View style={[styles.brandRow, collapsed && styles.brandRowCollapsed]}>
          <TouchableOpacity
            onPress={handleDashboardPress}
            style={[styles.brandTouchable, collapsed && { justifyContent: 'center' }]}
            activeOpacity={0.75}
          >
            {collapsed ? (
              companyLogoUrl && /^(https?:|data:image\/|\/)/.test(companyLogoUrl) ? (
                <Image
                  source={{ uri: companyLogoUrl }}
                  style={{ width: 34, height: 34, borderRadius: 10 }}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.collapsedBrandChip}>
                  <Text style={styles.collapsedBrandText}>
                    {(companyName || 'Oasis').slice(0, 1).toUpperCase()}
                  </Text>
                </View>
              )
            ) : (
              <View style={styles.desktopBrandCard}>
                <View style={styles.desktopBrandIconBox}>
                  {companyLogoUrl && /^(https?:|data:image\/|\/)/.test(companyLogoUrl) ? (
                    <Image
                      source={{ uri: companyLogoUrl }}
                      style={{ width: 28, height: 28, borderRadius: 6 }}
                      resizeMode="contain"
                    />
                  ) : (
                    <Building2 size={16} color="#7C3AED" />
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.desktopBrandTitle} numberOfLines={1}>
                    {companyName || 'Oasis HRMS'}
                  </Text>
                  <View style={styles.desktopRoleBadgeRow}>
                    <Text style={styles.desktopRoleBadgeText}>
                      {String(effectiveRole).toUpperCase()} SUITE
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </TouchableOpacity>

          {!collapsed && (
            <TouchableOpacity
              onPress={toggleCollapsed}
              style={styles.collapseBtn}
              activeOpacity={0.7}
              accessibilityLabel="Collapse Sidebar"
            >
              <PanelLeftClose size={15} color="#64748B" strokeWidth={1.8} />
            </TouchableOpacity>
          )}
        </View>

        {/* Action Button: Quick Action / New Request */}
        <View style={!collapsed ? styles.brandContainer : styles.collapsedToolsRow}>
          {collapsed && (
            <TouchableOpacity onPress={toggleCollapsed} style={styles.collapsedIconBtn} activeOpacity={0.7}>
              <PanelLeftOpen size={16} color="#64748B" strokeWidth={1.8} />
            </TouchableOpacity>
          )}
          <DesktopQuickActionBtn
            collapsed={collapsed}
            effectiveRole={effectiveRole}
            onPress={handleNewAction}
          />
        </View>

        {/* Nav list with modern categorized sections */}
        <ScrollView
          style={styles.navList}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.navListContent,
            collapsed && { alignItems: 'center' },
          ]}
        >
          {navGroups.map((group, gIdx) => (
            <View key={group.key} style={styles.navGroupWrapper}>
              {!collapsed ? (
                <Text style={styles.navGroupTitle}>{group.title}</Text>
              ) : gIdx > 0 ? (
                <View style={styles.collapsedGroupDivider} />
              ) : null}

              {group.items.map((item) => {
                const active = isItemActive(item.href);
                const isLocked = isItemLocked(item);

                return (
                  <DesktopNavItem
                    key={item.href}
                    item={item}
                    active={active}
                    collapsed={collapsed}
                    isLocked={isLocked}
                    onPress={() => (isLocked ? handleLockedItemPress(item.label) : router.push(item.href as never))}
                  />
                );
              })}
            </View>
          ))}
        </ScrollView>

        {/* User Card & Footer */}
        <View style={[styles.footerActions, collapsed && styles.footerActionsCollapsed]}>
          {!collapsed ? (
            <View style={styles.footerProfileCard}>
              <TouchableOpacity
                onPress={() => router.push('/(employee)/profile' as never)}
                style={styles.footerProfileRow}
                activeOpacity={0.8}
              >
                <View style={styles.footerAvatarWrapper}>
                  {profile?.avatar_url ? (
                    <Image
                      source={{ uri: profile.avatar_url }}
                      style={{ width: 34, height: 34, borderRadius: 17 }}
                    />
                  ) : (
                    <View style={styles.footerAvatarFallback}>
                      <Text style={styles.footerAvatarInitial}>{userInitial}</Text>
                    </View>
                  )}
                  <View style={styles.footerOnlineBadge} />
                </View>
                <View style={styles.footerProfileTextCol}>
                  <Text style={styles.footerProfileName} numberOfLines={1}>
                    {profile?.full_name || 'Ayush Bindhani'}
                  </Text>
                  <Text style={styles.footerProfileRole} numberOfLines={1}>
                    {String(effectiveRole).toUpperCase()}
                  </Text>
                </View>
              </TouchableOpacity>

              <View style={styles.footerActionsButtonRow}>
                <TouchableOpacity
                  onPress={handleHelpPress}
                  style={styles.footerPillBtn}
                  activeOpacity={0.7}
                >
                  <HelpCircle size={14} color="#64748B" strokeWidth={1.8} />
                  <Text style={styles.footerPillBtnText}>Help</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={signOut}
                  style={[styles.footerPillBtn, styles.footerPillBtnLogout]}
                  activeOpacity={0.7}
                >
                  <LogOut size={14} color={NotionColors.semanticError} strokeWidth={1.8} />
                  <Text style={[styles.footerPillBtnText, { color: NotionColors.semanticError, fontWeight: '600' }]}>
                    Logout
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.collapsedFooterIcons}>
              <TouchableOpacity
                onPress={() => router.push('/(employee)/profile' as never)}
                style={styles.collapsedAvatarBtn}
                activeOpacity={0.8}
              >
                {profile?.avatar_url ? (
                  <Image
                    source={{ uri: profile.avatar_url }}
                    style={{ width: 32, height: 32, borderRadius: 16 }}
                  />
                ) : (
                  <View style={[styles.footerAvatarFallback, { width: 32, height: 32, borderRadius: 16 }]}>
                    <Text style={[styles.footerAvatarInitial, { fontSize: 13 }]}>{userInitial}</Text>
                  </View>
                )}
                <View style={[styles.footerOnlineBadge, { bottom: 0, right: 0 }]} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleHelpPress}
                style={styles.footerBtnCollapsed}
                activeOpacity={0.7}
              >
                <HelpCircle size={16} color="#64748B" strokeWidth={1.8} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={signOut}
                style={[styles.footerBtnCollapsed, { backgroundColor: '#FEF2F2', borderColor: '#FEE2E2' }]}
                activeOpacity={0.7}
              >
                <LogOut size={16} color={NotionColors.semanticError} strokeWidth={1.8} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* MAIN CONTENT */}
      <View style={{ flex: 1, backgroundColor: NotionColors.canvas }}>
        <View style={styles.topBar}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 }}>
            <View style={styles.searchContainer}>
              <Search size={15} color="#7C3AED" />
              <TextInput
                placeholder={effectiveRole === 'employee' ? 'Search directory…' : 'Search employees, departments, roster…'}
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearchSubmit}
                returnKeyType="search"
                style={styles.searchInput}
              />
              <View style={styles.searchShortcutPill}>
                <Text style={styles.searchShortcutText}>/</Text>
              </View>
            </View>
          </View>

          <View style={styles.topBarActions}>
            <TouchableOpacity
              onPress={handleNotificationPress}
              style={styles.topBarActionBtn}
              activeOpacity={0.8}
            >
              <Bell size={18} color="#334155" strokeWidth={2} />
              {unreadCount > 0 && <View style={styles.mobileNotificationDot} />}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSettingsPress}
              style={styles.topBarActionBtn}
              activeOpacity={0.8}
            >
              <Settings size={18} color="#64748B" strokeWidth={1.8} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/(employee)/profile' as never)}
              style={styles.topBarAvatarBtn}
              activeOpacity={0.8}
            >
              {profile?.avatar_url ? (
                <Image
                  source={{ uri: profile.avatar_url }}
                  style={{ width: 36, height: 36, borderRadius: 18 }}
                />
              ) : (
                <View style={[styles.mobileAvatarFallback, { width: 36, height: 36, borderRadius: 18 }]}>
                  <Text style={[styles.mobileAvatarText, { fontSize: 14 }]}>{userInitial}</Text>
                </View>
              )}
              <View style={styles.mobileAvatarOnlineDot} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ flex: 1, backgroundColor: NotionColors.canvas }}>
          {isCurrentRouteLocked && currentRouteFeat ? (
            <FeatureGate feature={currentRouteFeat.feature} featureName={currentRouteFeat.name}>
              {children}
            </FeatureGate>
          ) : children}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /* Mobile Floating Modern Navbar */
  floatingNavWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 99,
  },
  floatingNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    maxWidth: 480,
    height: 64,
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(237, 233, 254, 0.95)',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 10px 32px -4px rgba(108, 92, 231, 0.18), 0 3px 10px rgba(15, 23, 42, 0.05)',
        } as any)
      : {
          elevation: 12,
          shadowColor: '#6C5CE7',
          shadowOffset: { width: 0, height: 7 },
          shadowOpacity: 0.16,
          shadowRadius: 18,
        }),
  },
  floatingTabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 3,
    paddingHorizontal: 2,
    minHeight: 48,
    borderRadius: 22,
    marginHorizontal: 1,
  },
  floatingTabBtnActive: {
    backgroundColor: '#F3EEFE',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
    elevation: 3,
  },
  tabIconContainer: {
    width: 38,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabLabel: {
    fontSize: 10.5,
    marginTop: 2,
    fontWeight: '500',
    letterSpacing: -0.1,
    color: '#64748B',
  },
  tabLabelActive: {
    color: '#6D28D9',
    fontWeight: '800',
  },
  activeIndicatorBar: {
    width: 18,
    height: 3,
    backgroundColor: '#7C3AED',
    borderRadius: 1.5,
    marginTop: 2,
  },
  tabLockBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: NotionColors.semanticError,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  tabCountBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    minWidth: 15,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: NotionColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  tabCountText: { fontSize: 9, fontWeight: '600', color: '#fff' },

  /* More sheet */
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(10,21,48,0.65)', justifyContent: 'flex-end' },
  sheetBackdrop: { flex: 1 },
  sheetContainer: {
    backgroundColor: NotionColors.canvas,
    borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl,
    maxHeight: '84%',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 -10px 40px rgba(15,15,15,0.16)' } as any)
      : { elevation: 20, shadowColor: '#0f0f0f', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.16, shadowRadius: 24 }),
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: NotionColors.hairline, alignSelf: 'center', marginTop: 10, marginBottom: 6,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: NotionColors.hairline,
  },
  sheetTitle: { fontSize: 15, fontWeight: '600', color: NotionColors.ink },
  sheetSubtitle: { fontSize: 11, color: NotionColors.steel, marginTop: 2 },
  sheetCloseBtn: {
    width: 30, height: 30, borderRadius: BorderRadius.sm,
    backgroundColor: NotionColors.surface, alignItems: 'center', justifyContent: 'center',
  },
  sheetSearchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: NotionColors.surface,
    marginHorizontal: 20, marginTop: 14, marginBottom: 10,
    paddingHorizontal: 12, height: 44,
    borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: NotionColors.hairline, gap: 8,
  },
  sheetSearchInput: { flex: 1, fontSize: 13, color: NotionColors.ink },
  sheetScroll: { paddingHorizontal: 16 },
  appLauncherGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 10 },
  appGridItem: { width: '33.33%', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 6 },
  appIconCircle: {
    width: 48, height: 48, borderRadius: BorderRadius.md,
    backgroundColor: NotionColors.surface,
    borderWidth: 1, borderColor: NotionColors.hairline,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  appGridLabel: { fontSize: 12, fontWeight: '500', color: NotionColors.ink, textAlign: 'center', lineHeight: 15 },
  moreLockBadge: {
    position: 'absolute', top: -2, right: -2, width: 14, height: 14, borderRadius: 7,
    backgroundColor: NotionColors.semanticError, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#fff',
  },
  sheetUserSection: {
    marginTop: 14, borderTopWidth: 1,
    borderTopColor: NotionColors.hairline, paddingTop: 8, marginHorizontal: 4,
  },
  sheetActionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 12,
    borderBottomWidth: 1, borderBottomColor: NotionColors.hairlineSoft,
  },
  sheetActionText: { fontSize: 13, fontWeight: '500', color: NotionColors.ink },

  /* ── Desktop sidebar ─────────────────────────────── */
  sidebar: {
    paddingVertical: 14,
    borderRightWidth: 1,
    borderRightColor: '#EDE9FE',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '4px 0 24px rgba(124, 58, 237, 0.03)',
        } as any)
      : {}),
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 10,
    gap: 6,
  },
  brandRowCollapsed: {
    paddingHorizontal: 0,
    justifyContent: 'center',
    marginBottom: 8,
  },
  brandTouchable: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  desktopBrandCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    backgroundColor: '#FAF9FD',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EDE9FE',
  },
  desktopBrandIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EDE9FE',
  },
  desktopBrandTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  desktopRoleBadgeRow: {
    marginTop: 2,
    alignSelf: 'flex-start',
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  desktopRoleBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#7C3AED',
    letterSpacing: 0.3,
  },
  collapsedBrandChip: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 4px 10px rgba(124, 58, 237, 0.25)',
        } as any)
      : {}),
  },
  collapsedBrandText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  collapseBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAF9FD',
    borderWidth: 1,
    borderColor: '#EDE9FE',
  },

  brandContainer: {
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  newRequestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#7C3AED',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 6px 18px rgba(124, 58, 237, 0.28)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        } as any)
      : {
          shadowColor: '#7C3AED',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.28,
          shadowRadius: 10,
          elevation: 4,
        }),
  },
  newRequestBtnHover: {
    backgroundColor: '#6D28D9',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 8px 22px rgba(124, 58, 237, 0.38)',
          transform: 'translateY(-1px)',
        } as any)
      : {}),
  },
  newRequestIconPill: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newRequestText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: -0.1,
    flex: 1,
    marginLeft: 10,
  },
  newRequestShortcutBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  newRequestShortcutText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },

  collapsedToolsRow: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    marginBottom: 10,
  },
  collapsedIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#EDE9FE',
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          boxShadow: '0 2px 6px rgba(124, 58, 237, 0.08)',
        } as any)
      : {}),
  },

  navList: { flex: 1, paddingHorizontal: 6 },
  navListContent: { paddingVertical: 4 },
  navGroupWrapper: { marginBottom: 8 },
  navGroupTitle: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1.0,
    textTransform: 'uppercase',
    paddingHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  collapsedGroupDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 6,
    marginHorizontal: 14,
  },

  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 40,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginHorizontal: 4,
    marginVertical: 1,
    position: 'relative',
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        } as any)
      : {}),
  },
  navItemHover: {
    backgroundColor: '#FAF9FD',
  },
  navItemActive: {
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.16)',
  },
  navActiveLeftBar: {
    position: 'absolute',
    left: -4,
    top: 8,
    bottom: 8,
    width: 3.5,
    borderRadius: 2,
    backgroundColor: '#7C3AED',
  },
  navIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconBoxHover: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EDE9FE',
  },
  navIconBoxActive: {
    backgroundColor: '#EDE9FE',
    borderColor: '#DDD6FE',
  },
  sidebarActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#7C3AED',
    marginLeft: 'auto',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 0 6px rgba(124, 58, 237, 0.6)',
        } as any)
      : {}),
  },
  navItemCollapsed: {
    paddingHorizontal: 0,
    justifyContent: 'center',
    gap: 0,
    marginHorizontal: 6,
    width: 44,
    height: 42,
  },
  navLabel: {
    fontSize: 13,
    flex: 1,
    letterSpacing: -0.1,
  },

  lockedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: NotionColors.cardTintRose,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
    marginLeft: 'auto',
    gap: 3,
  },
  lockedPillText: { fontSize: 9, fontWeight: '600', color: NotionColors.semanticError, letterSpacing: 0.5 },

  collapsedLockDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: NotionColors.semanticError,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },

  /* Footer Card & Actions */
  footerActions: {
    borderTopWidth: 1,
    borderTopColor: '#EDE9FE',
    paddingTop: 10,
    paddingHorizontal: 8,
    backgroundColor: '#FFFFFF',
  },
  footerActionsCollapsed: {
    paddingHorizontal: 0,
    alignItems: 'center',
  },
  footerProfileCard: {
    backgroundColor: '#FAF9FD',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#EDE9FE',
  },
  footerProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  footerAvatarWrapper: {
    position: 'relative',
  },
  footerAvatarFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  footerAvatarInitial: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#7C3AED',
  },
  footerOnlineBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#10B981',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  footerProfileTextCol: {
    flex: 1,
    minWidth: 0,
  },
  footerProfileName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.1,
  },
  footerProfileRole: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 1,
  },
  footerActionsButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: '#EDE9FE',
    paddingTop: 8,
  },
  footerPillBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
        } as any)
      : {}),
  },
  footerPillBtnLogout: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FEE2E2',
  },
  footerPillBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  collapsedFooterIcons: {
    alignItems: 'center',
    gap: 8,
    paddingBottom: 4,
  },
  collapsedAvatarBtn: {
    marginBottom: 4,
  },
  footerBtnCollapsed: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAF9FD',
    borderWidth: 1,
    borderColor: '#EDE9FE',
  },

  /* Topbar */
  topBar: {
    height: 64,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    ...Platform.select({
      web: { boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.03)' },
      default: { elevation: 1 },
    }),
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 42,
    width: 420,
    maxWidth: '100%',
    ...Platform.select({
      web: {
        transition: 'all 0.2s ease',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
      },
      default: {},
    }),
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    backgroundColor: 'transparent',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  } as any,
  searchShortcutPill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  searchShortcutText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  topBarActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  topBarActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      },
      default: {},
    }),
  },
  topBarAvatarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 2,
    borderColor: '#EDE9FE',
    ...Platform.select({
      web: { cursor: 'pointer' },
      default: {},
    }),
  },
  topBarUser: { marginLeft: 6 },
  notificationDot: {
    position: 'absolute', top: 2, right: 2, width: 7, height: 7, borderRadius: 3.5,
  },

  /* Mobile Top App Bar */
  mobileTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    ...Platform.select({
      web: { boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.04)' },
      default: { elevation: 2 },
    }),
  },
  mobileOrgPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    maxWidth: '68%',
    ...Platform.select({
      web: { cursor: 'pointer' },
      default: {},
    }),
  },
  mobileOrgIconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#E0E7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileOrgTextCol: {
    flexShrink: 1,
    gap: 2,
  },
  mobileOrgTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  mobileRoleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F3EEFE',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  mobileRoleBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#7C3AED',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  mobileTopRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mobileBellBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...Platform.select({
      web: { cursor: 'pointer' },
      default: {},
    }),
  },
  mobileNotificationDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  mobileAvatarBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    position: 'relative',
    borderWidth: 2,
    borderColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: { cursor: 'pointer' },
      default: {},
    }),
  },
  mobileAvatarOnlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  mobileAvatarFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileAvatarText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
});