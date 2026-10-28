import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  TextInput,
  Modal,
  Platform,
  Image,
  Alert,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/context/TenantContext';
import { Avatar } from '@/components/ui/Avatar';
import { FeatureGate } from '@/components/ui/FeatureGate';
import {
  LogOut,
  HelpCircle,
  Bell,
  Settings,
  Search,
  Bot,
  Plus,
  LayoutDashboard,
  CalendarClock,
  CalendarDays,
  Banknote,
  Users,
  Briefcase,
  Network,
  Calendar,
  Umbrella,
  Award,
  CreditCard,
  Receipt,
  Laptop,
  LifeBuoy,
  GraduationCap,
  FileText,
  Clock,
  BarChart3,
  MapPin,
  Key,
  Workflow,
  Shield,
  Grid,
  X,
  ChevronRight,
  Lock,
} from 'lucide-react-native';
import { SubedgeBrand } from '@/components/ui/SubedgeBrand';
import { useNotifications } from '@/context/NotificationContext';
import { getNavForRole, ADMIN_NAV, HR_NAV, EMPLOYEE_NAV, NavItem } from '@/constants/navigation';

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
  if (pathname.includes('/audit-logs')) return { feature: 'audit_logs', name: 'Audit & Compliance Logs' };
  if (pathname.includes('/expenses')) return { feature: 'expenses', name: 'Expense Management' };
  if (pathname.includes('/helpdesk')) return { feature: 'helpdesk', name: 'Helpdesk & Support' };
  if (pathname.includes('/assets')) return { feature: 'assets', name: 'Asset Management' };
  if (pathname.includes('/learning')) return { feature: 'learning', name: 'Learning & LMS' };
  if (pathname.includes('/recruitment')) return { feature: 'recruitment', name: 'Recruitment & ATS' };
  return null;
}

interface SidebarProps {
  items?: NavItem[];
  children: React.ReactNode;
}

export function SidebarLayout({ items, children }: SidebarProps) {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const pathname = usePathname();
  const { profile, role, signOut } = useAuth();
  const { companyName, companyLogoUrl, organization, isFeatureEnabled } = useTenant();
  const { unreadCount } = useNotifications();
  const [showAssistant, setShowAssistant] = useState(false);
  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [moreSearchQuery, setMoreSearchQuery] = useState('');

  // Effective role determination
  const effectiveRole = profile?.role || role || 'employee';

  const effectiveItems: NavItem[] = React.useMemo(() => {
    return items || getNavForRole(effectiveRole, profile?.email);
  }, [effectiveRole, items, profile?.email]);

  const isDesktop = width >= 1024;

  const isItemActive = (itemHref: string) => {
    if (pathname === itemHref) return true;
    if (
      itemHref === '/(admin)/dashboard' ||
      itemHref === '/(hr)/dashboard' ||
      itemHref === '/(employee)/dashboard'
    ) {
      return false;
    }
    return pathname.startsWith(itemHref);
  };

  // ----------------------------------------------------
  // PRIMARY MOBILE BOTTOM TABS DEFINITION
  // ----------------------------------------------------
  const mobileTabs = React.useMemo(() => {
    if (effectiveRole === 'admin') {
      return [
        { label: 'Dashboard', href: '/(admin)/dashboard', icon: LayoutDashboard },
        { label: 'Users & Staff', href: '/(admin)/users', icon: Users, feature: 'users' },
        { label: 'Attendance', href: '/(hr)/attendance', icon: Calendar, feature: 'attendance' },
        { label: 'Leave', href: '/(hr)/leave', icon: Umbrella, feature: 'leave' },
      ];
    }
    if (effectiveRole === 'hr') {
      return [
        { label: 'Dashboard', href: '/(hr)/dashboard', icon: LayoutDashboard },
        { label: 'Users & Staff', href: '/(admin)/users', icon: Users, feature: 'users' },
        { label: 'Attendance', href: '/(hr)/attendance', icon: Calendar, feature: 'attendance' },
        { label: 'Leave', href: '/(hr)/leave', icon: Umbrella, feature: 'leave' },
      ];
    }
    // Employee
    return [
      { label: 'Dashboard', href: '/(employee)/dashboard', icon: LayoutDashboard },
      { label: 'Attendance', href: '/(employee)/attendance', icon: CalendarClock, feature: 'attendance' },
      { label: 'Leave', href: '/(employee)/leave', icon: CalendarDays, feature: 'leave' },
      { label: 'Salary', href: '/(employee)/payslips', icon: Banknote, feature: 'payroll' },
    ];
  }, [effectiveRole]);

  const isItemLocked = (item: NavItem) => {
    if (item.feature) {
      return !isFeatureEnabled(item.feature);
    }
    if (item.href === '/(admin)/portal' && profile?.email !== 'ayushbindhani001@gmail.com') {
      return true;
    }
    return false;
  };

  const handleLockedItemPress = (label: string) => {
    Alert.alert(
      'Feature Locked',
      `The "${label}" module is currently locked for your organization. Please contact your organization administrator or super admin to unlock this module.`,
      [{ text: 'OK' }]
    );
  };

  const currentRouteFeat = getRouteFeature(pathname);
  const isCurrentRouteLocked = currentRouteFeat ? !isFeatureEnabled(currentRouteFeat.feature) : false;

  const handleSearchSubmit = () => {
    if (!searchQuery.trim()) return;
    const q = encodeURIComponent(searchQuery.trim());
    if (effectiveRole === 'employee') {
      router.push(`/(employee)/directory?q=${q}` as never);
    } else {
      router.push(`/(admin)/users?q=${q}` as never);
    }
  };

  const handleNewAction = () => {
    if (effectiveRole === 'employee') {
      router.push('/(employee)/leave/apply' as never);
    } else {
      router.push('/(admin)/users' as never);
    }
  };

  const handleNotificationPress = () => {
    router.push('/(employee)/notifications' as never);
  };

  const handleSettingsPress = () => {
    if (effectiveRole === 'admin') {
      router.push('/(admin)/settings' as never);
    } else {
      router.push('/(employee)/settings' as never);
    }
  };

  const handleDashboardPress = () => {
    if (effectiveRole === 'admin') {
      router.push('/(admin)/dashboard' as never);
    } else if (effectiveRole === 'hr') {
      router.push('/(hr)/dashboard' as never);
    } else {
      router.push('/(employee)/dashboard' as never);
    }
  };

  const handleHelpPress = () => {
    if (effectiveRole === 'admin') {
      router.push('/(admin)/help' as never);
    } else if (effectiveRole === 'hr') {
      router.push('/(hr)/help' as never);
    } else {
      router.push('/(employee)/help' as never);
    }
  };

  // Filter modules inside More Sheet
  const filteredMoreModules = effectiveItems.filter((item) =>
    item.label.toLowerCase().includes(moreSearchQuery.toLowerCase())
  );

  // ----------------------------------------------------
  // MOBILE / TABLET NATIVE APP LAYOUT
  // ----------------------------------------------------
  if (!isDesktop) {
    return (
      <View style={[styles.mobileRoot, { backgroundColor: colors.background }]}>
        {/* Status bar safe area */}
        <SafeAreaView
          edges={['top']}
          style={{
            backgroundColor: pathname.includes('dashboard')
              ? (effectiveRole === 'admin' ? '#0F172A' : effectiveRole === 'hr' ? '#1E293B' : colors.primary)
              : colors.surface
          }}
        />

        {/* Main Screen Content */}
        <View style={styles.mobileContentWrapper}>
          {isCurrentRouteLocked && currentRouteFeat ? (
            <FeatureGate feature={currentRouteFeat.feature} featureName={currentRouteFeat.name}>
              {children}
            </FeatureGate>
          ) : (
            children
          )}
        </View>

        {/* ==================================================== */}
        {/* NATIVE BOTTOM TAB NAVIGATION BAR */}
        {/* ==================================================== */}
        <SafeAreaView edges={['bottom']} style={styles.bottomNavSafeArea}>
          <View style={styles.bottomTabBar}>
            {mobileTabs.map((tab) => {
              const active = isItemActive(tab.href);
              const IconComp = tab.icon;
              const isLocked = tab.feature ? !isFeatureEnabled(tab.feature) : false;

              return (
                <TouchableOpacity
                  key={tab.href}
                  onPress={() => {
                    if (isLocked) {
                      handleLockedItemPress(tab.label);
                    } else {
                      router.push(tab.href as never);
                    }
                  }}
                  style={[styles.tabBtn, isLocked && { opacity: 0.55 }]}
                  activeOpacity={0.75}
                >
                  <View style={[styles.tabIconContainer, active && { backgroundColor: colors.primaryLight }]}>
                    <IconComp
                      size={20}
                      color={active ? colors.primary : isLocked ? '#94A3B8' : colors.textSecondary}
                      strokeWidth={active ? 2.5 : 2}
                    />
                    {isLocked && (
                      <View style={styles.tabLockBadge}>
                        <Lock size={8} color="#FFFFFF" />
                      </View>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.tabLabel,
                      active
                        ? [styles.tabLabelActive, { color: colors.primary }]
                        : styles.tabLabelInactive,
                      isLocked && { color: '#94A3B8' },
                    ]}
                    numberOfLines={1}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {/* 5th Tab: More / Apps Hub */}
            <TouchableOpacity
              onPress={() => setShowMoreSheet(true)}
              style={styles.tabBtn}
              activeOpacity={0.75}
            >
              <View style={[styles.tabIconContainer, showMoreSheet && { backgroundColor: colors.primaryLight }]}>
                <Grid
                  size={20}
                  color={showMoreSheet ? colors.primary : colors.textSecondary}
                  strokeWidth={showMoreSheet ? 2.5 : 2}
                />
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  showMoreSheet
                    ? [styles.tabLabelActive, { color: colors.primary }]
                    : styles.tabLabelInactive,
                ]}
                numberOfLines={1}
              >
                More
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        {/* ==================================================== */}
        {/* "MORE APPS & MODULES" NATIVE BOTTOM SHEET */}
        {/* ==================================================== */}
        <Modal
          visible={showMoreSheet}
          animationType="slide"
          transparent
          onRequestClose={() => setShowMoreSheet(false)}
        >
          <View style={styles.sheetOverlay}>
            <TouchableOpacity
              style={styles.sheetBackdrop}
              activeOpacity={1}
              onPress={() => setShowMoreSheet(false)}
            />

            <View style={[styles.sheetContainer, { paddingBottom: Math.max(insets.bottom, 20) + 12 }]}>
              {/* Sheet Handle */}
              <View style={styles.sheetHandle} />

              {/* Sheet Header */}
              <View style={styles.sheetHeader}>
                <View>
                  <Text style={styles.sheetTitle}>All Oasis Modules</Text>
                  <Text style={styles.sheetSubtitle}>
                    {String(effectiveRole || 'employee').toUpperCase()} Console & Workflows
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowMoreSheet(false)}
                  style={styles.sheetCloseBtn}
                >
                  <X size={20} color="#64748B" />
                </TouchableOpacity>
              </View>

              {/* Search Modules Filter */}
              <View style={styles.sheetSearchBox}>
                <Search size={16} color="#94A3B8" />
                <TextInput
                  style={styles.sheetSearchInput}
                  placeholder="Search apps, payroll, documents..."
                  value={moreSearchQuery}
                  onChangeText={setMoreSearchQuery}
                  placeholderTextColor="#94A3B8"
                />
                {moreSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setMoreSearchQuery('')}>
                    <X size={14} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              </View>

              {/* 3-Column Modern App Icon Grid */}
              <ScrollView
                style={styles.sheetScroll}
                contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) + 24 }}
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
                          if (isLocked) {
                            handleLockedItemPress(item.label);
                          } else {
                            router.push(item.href as never);
                          }
                        }}
                        style={[styles.appGridItem, isLocked && { opacity: 0.6 }]}
                        activeOpacity={0.8}
                      >
                        <View
                          style={[
                            styles.appIconCircle,
                            active && { backgroundColor: colors.accentLight, borderColor: colors.primary },
                            isLocked && { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' },
                          ]}
                        >
                          <IconComponent
                            size={22}
                            color={active ? colors.primary : isLocked ? '#94A3B8' : colors.text}
                            strokeWidth={active ? 2.5 : 2}
                          />
                          {isLocked && (
                            <View style={styles.moreLockBadge}>
                              <Lock size={9} color="#FFFFFF" />
                            </View>
                          )}
                        </View>
                        <Text
                          style={[
                            styles.appGridLabel,
                            active && { color: colors.primary, fontWeight: '800' },
                            isLocked && { color: '#94A3B8' },
                          ]}
                          numberOfLines={2}
                        >
                          {item.label}
                        </Text>
                        {isLocked && (
                          <View style={styles.moreLockedPill}>
                            <Text style={styles.moreLockedPillText}>LOCKED</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* User & Settings Bar at bottom of Sheet */}
                <View style={styles.sheetUserSection}>
                  <TouchableOpacity
                    onPress={() => {
                      setShowMoreSheet(false);
                      handleSettingsPress();
                    }}
                    style={styles.sheetActionRow}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Settings size={18} color="#475569" />
                      <Text style={styles.sheetActionText}>Account & App Settings</Text>
                    </View>
                    <ChevronRight size={16} color="#94A3B8" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      setShowMoreSheet(false);
                      handleHelpPress();
                    }}
                    style={styles.sheetActionRow}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <HelpCircle size={18} color="#475569" />
                      <Text style={styles.sheetActionText}>Help & Support Center</Text>
                    </View>
                    <ChevronRight size={16} color="#94A3B8" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      setShowMoreSheet(false);
                      signOut();
                    }}
                    style={[styles.sheetActionRow, { borderBottomWidth: 0 }]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <LogOut size={18} color="#DC2626" />
                      <Text style={[styles.sheetActionText, { color: '#DC2626', fontWeight: '700' }]}>
                        Sign Out of Oasis
                      </Text>
                    </View>
                    <ChevronRight size={16} color="#DC2626" />
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

      </View>
    );
  }

  // ----------------------------------------------------
  // DESKTOP / WEB LAYOUT
  // ----------------------------------------------------
  return (
    <SafeAreaView
      style={[styles.desktopContainer, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right', 'bottom']}
    >
      {/* Persistent Consistent Sidebar */}
      <View
        style={[
          styles.sidebar,
          { backgroundColor: colors.background, borderRightColor: colors.border },
        ]}
      >
        <View style={styles.brandContainer}>
          <TouchableOpacity onPress={handleDashboardPress}>
            {companyName ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {companyLogoUrl && (companyLogoUrl.startsWith('http') || companyLogoUrl.startsWith('data:image/') || companyLogoUrl.startsWith('/')) ? (
                  <Image
                    source={{ uri: companyLogoUrl }}
                    style={{ width: 44, height: 44, borderRadius: 8 }}
                    resizeMode="contain"
                  />
                ) : null}
                <View style={{ flexShrink: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }} numberOfLines={1}>
                    {companyName}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '600', letterSpacing: 0.5, marginTop: 2 }}>
                    {`${String(effectiveRole || 'employee').toUpperCase()} SUITE`}
                  </Text>
                </View>
              </View>
            ) : (
              <SubedgeBrand size="md" subtitle={`${String(effectiveRole || 'employee').toUpperCase()} SUITE`} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleNewAction}
            style={[styles.newRequestBtn, { backgroundColor: colors.primary }]}
          >
            <Plus size={18} color="#FFF" strokeWidth={2.5} style={{ marginRight: 6 }} />
            <Text style={styles.newRequestText}>
              {effectiveRole === 'employee' ? 'New Request' : 'Quick Action'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.navList} showsVerticalScrollIndicator={false}>
          {effectiveItems.map((item) => {
            const active = isItemActive(item.href);
            const IconComponent = item.icon;
            const isLocked = isItemLocked(item);

            return (
              <TouchableOpacity
                key={item.href}
                onPress={() => {
                  if (isLocked) {
                    handleLockedItemPress(item.label);
                  } else {
                    router.push(item.href as never);
                  }
                }}
                style={[
                  styles.navItem,
                  active && { backgroundColor: colors.backgroundSelected },
                  isLocked && { opacity: 0.55 },
                ]}
              >
                <View style={styles.navItemContent}>
                  {IconComponent && (
                    <IconComponent
                      size={20}
                      color={active ? colors.primary : isLocked ? '#94A3B8' : colors.textSecondary}
                      strokeWidth={active ? 2.5 : 2}
                    />
                  )}
                  <Text
                    style={[
                      styles.navLabel,
                      { color: active ? colors.primary : isLocked ? '#94A3B8' : colors.textSecondary },
                      active && styles.navLabelActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                  {isLocked && (
                    <View style={styles.lockedPill}>
                      <Lock size={10} color="#DC2626" />
                      <Text style={styles.lockedPillText}>LOCKED</Text>
                    </View>
                  )}
                </View>
                {active && !isLocked && (
                  <View
                    style={[styles.activeIndicator, { backgroundColor: colors.primary }]}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Footer Actions */}
        <View style={[styles.footerActions, { borderTopColor: colors.border }]}>
          <TouchableOpacity onPress={handleHelpPress} style={styles.footerBtn}>
            <HelpCircle size={20} color={colors.textSecondary} />
            <Text style={[styles.footerBtnText, { color: colors.textSecondary }]}>
              Help Center
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={signOut} style={styles.footerBtn}>
            <LogOut size={20} color={colors.danger} />
            <Text style={[styles.footerBtnText, { color: colors.danger }]}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main content Area with White Top Bar */}
      <View style={styles.mainArea}>
        <View
          style={[
            styles.topBar,
            { backgroundColor: '#FFFFFF', borderBottomColor: colors.border },
          ]}
        >
          <View style={styles.searchContainer}>
            <Search size={16} color={colors.textSecondary} />
            <TextInput
              placeholder={
                effectiveRole === 'employee'
                  ? 'Search directory...'
                  : 'Search employees, departments...'
              }
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearchSubmit}
              returnKeyType="search"
              style={styles.searchInput}
            />
          </View>
          <View style={styles.topBarActions}>
            <TouchableOpacity
              onPress={handleNotificationPress}
              style={{ position: 'relative', padding: 4 }}
            >
              <Bell size={20} color={colors.textSecondary} />
              {unreadCount > 0 && <View style={styles.notificationDot} />}
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSettingsPress} style={{ padding: 4 }}>
              <Settings size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            {profile && (
              <TouchableOpacity
                onPress={() => router.push('/(employee)/profile' as never)}
                style={styles.topBarUser}
              >
                <Avatar name={profile.full_name} url={profile.avatar_url} size={32} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.mainContentScroll}>
          {isCurrentRouteLocked && currentRouteFeat ? (
            <FeatureGate feature={currentRouteFeat.feature} featureName={currentRouteFeat.name}>
              {children}
            </FeatureGate>
          ) : (
            children
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // ==========================================
  // MOBILE NATIVE APP STYLES
  // ==========================================
  mobileRoot: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  mobileContentWrapper: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  notificationDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#EF4444',
  },

  // ==========================================
  // NATIVE BOTTOM TAB BAR STYLES
  // ==========================================
  bottomNavSafeArea: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 8,
  },
  bottomTabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: 56,
    paddingHorizontal: 6,
    backgroundColor: '#FFFFFF',
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  tabIconContainer: {
    width: 38,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  tabIconContainerActive: {
    backgroundColor: '#F0FDFA',
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 2,
  },
  tabLabelActive: {
    color: '#0F766E',
    fontWeight: '800',
  },
  tabLabelInactive: {
    color: '#64748B',
    fontWeight: '500',
  },

  // ==========================================
  // MORE APPS & MODULES BOTTOM SHEET
  // ==========================================
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  sheetSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  sheetCloseBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
  },
  sheetSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  sheetSearchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
  },
  sheetScroll: {
    paddingHorizontal: 16,
  },
  appLauncherGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingVertical: 10,
  },
  appGridItem: {
    width: '33.33%',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 6,
  },
  appIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  appGridLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'center',
    lineHeight: 14,
  },
  sheetUserSection: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
    marginHorizontal: 4,
  },
  sheetActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  sheetActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },

  // ==========================================
  // DESKTOP LAYOUT STYLES
  // ==========================================
  desktopContainer: { flex: 1, flexDirection: 'row' },
  sidebar: {
    width: 260,
    paddingVertical: 24,
    justifyContent: 'flex-start',
    borderRightWidth: 1,
  },
  brandContainer: {
    paddingHorizontal: 24,
    marginBottom: 28,
  },
  newRequestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginTop: 20,
    shadowColor: '#0F766E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  newRequestText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  navList: { flex: 1, paddingHorizontal: 14 },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 6,
    overflow: 'hidden',
  },
  navItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  navLabel: { fontSize: 14, fontWeight: '500' },
  navLabelActive: { fontWeight: '700' },
  activeIndicator: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  footerActions: {
    borderTopWidth: 1,
    paddingTop: 16,
    paddingHorizontal: 20,
    gap: 12,
  },
  footerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  footerBtnText: {
    fontSize: 13,
    fontWeight: '500',
  },
  mainArea: { flex: 1, backgroundColor: '#F8FAFC' },
  topBar: {
    height: 60,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    backgroundColor: '#FFFFFF',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    width: 320,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1A1A2E',
    outlineStyle: 'none',
  } as any,
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  topBarUser: {
    marginLeft: 8,
  },
  mainContentScroll: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0F766E',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0F766E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 999,
  },
  tabLockBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreLockBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreLockedPill: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  moreLockedPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#DC2626',
    letterSpacing: 0.5,
  },
  lockedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 'auto',
    gap: 3,
  },
  lockedPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#DC2626',
    letterSpacing: 0.5,
  },
});
