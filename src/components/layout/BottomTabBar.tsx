import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  useWindowDimensions,
  Alert,
  ScrollView,
  TextInput,
  Image,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import {
  LayoutDashboard,
  CalendarClock,
  CalendarDays,
  Banknote,
  MoreHorizontal,
  User,
  Settings,
  Receipt,
  Award,
  Users,
  Bell,
  HelpCircle,
  GraduationCap,
  X,
  Lock,
  Search,
  LogOut,
  ChevronRight,
  ShieldCheck,
  Building2,
  Laptop,
  Clock,
  Briefcase,
  CreditCard,
  FileText,
  BarChart3,
} from 'lucide-react-native';
import Animated, {
  FadeInDown,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { useTheme } from '@/hooks/use-theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTenant } from '@/context/TenantContext';
import { useAuth } from '@/hooks/useAuth';
import { FeatureGate } from '@/components/ui/FeatureGate';
import { getRouteFeature } from '@/components/layout/Sidebar';
import { useNotifications } from '@/context/NotificationContext';
import { BorderRadius, NotionColors, Shadows } from '@/constants/theme';
import * as Haptics from 'expo-haptics';

export interface TabItem {
  key: string;
  label: string;
  icon: React.ElementType;
  href: string;
  feature?: string;
}

export const getTabsForRole = (role?: string | null): TabItem[] => {
  if (role === 'admin') {
    return [
      { key: 'home', label: 'Console', icon: LayoutDashboard, href: '/(admin)/dashboard' },
      { key: 'users', label: 'Users', icon: Users, href: '/(admin)/users', feature: 'users' },
      { key: 'attendance', label: 'Attendance', icon: CalendarClock, href: '/(hr)/attendance', feature: 'attendance' },
      { key: 'leave', label: 'Leave', icon: CalendarDays, href: '/(hr)/leave', feature: 'leave' },
      { key: 'more', label: 'More', icon: MoreHorizontal, href: '' },
    ];
  }
  if (role === 'hr') {
    return [
      { key: 'home', label: 'Console', icon: LayoutDashboard, href: '/(hr)/dashboard' },
      { key: 'staff', label: 'Staff', icon: Users, href: '/(admin)/users', feature: 'users' },
      { key: 'attendance', label: 'Attendance', icon: CalendarClock, href: '/(hr)/attendance', feature: 'attendance' },
      { key: 'leave', label: 'Leave', icon: CalendarDays, href: '/(hr)/leave', feature: 'leave' },
      { key: 'more', label: 'More', icon: MoreHorizontal, href: '' },
    ];
  }
  // Employee
  return [
    { key: 'home', label: 'Home', icon: LayoutDashboard, href: '/(employee)/dashboard' },
    { key: 'attendance', label: 'Attendance', icon: CalendarClock, href: '/(employee)/attendance', feature: 'attendance' },
    { key: 'leave', label: 'Leave', icon: CalendarDays, href: '/(employee)/leave', feature: 'leave' },
    { key: 'payslips', label: 'Salary', icon: Banknote, href: '/(employee)/payslips', feature: 'payroll' },
    { key: 'more', label: 'More', icon: MoreHorizontal, href: '' },
  ];
};

export interface MoreItem {
  label: string;
  icon: React.ElementType;
  href: string;
  feature?: string;
  description?: string;
  badge?: string;
}

export const getMoreItemsForRole = (role?: string | null): MoreItem[] => {
  if (role === 'admin' || role === 'hr') {
    return [
      { label: 'Expenses & Claims', icon: Receipt, href: '/(hr)/expenses', feature: 'expenses', description: 'Review & approve employee claims' },
      { label: 'Asset Management', icon: Laptop, href: '/(hr)/assets', feature: 'assets', description: 'Hardware inventory & barcode auditing' },
      { label: 'Learning & LMS', icon: GraduationCap, href: '/(hr)/learning', feature: 'learning', description: 'Course creation & training metrics' },
      { label: 'Shifts & Rosters', icon: Clock, href: '/(hr)/shifts', feature: 'shifts', description: 'Staff shift assignments & rotas' },
      { label: 'Payroll', icon: CreditCard, href: '/(hr)/payroll', feature: 'payroll', description: 'Salary registers & payslips' },
      { label: 'Performance', icon: Award, href: '/(hr)/performance', feature: 'performance', description: 'KPIs, appraisal cycles & reviews' },
      { label: 'Recruitment & ATS', icon: Briefcase, href: '/(hr)/recruitment', feature: 'recruitment', description: 'Job openings, candidates & pipelines' },
      { label: 'Helpdesk Tickets', icon: HelpCircle, href: '/(hr)/helpdesk', feature: 'helpdesk', description: 'Employee requests & ticket triage' },
      { label: 'Templates & Letters', icon: FileText, href: '/(hr)/templates', feature: 'templates', description: 'Appointment & experience letters' },
      { label: 'Reports & Analytics', icon: BarChart3, href: role === 'admin' ? '/(admin)/reports' : '/(hr)/reports', description: 'Forensic audits & workforce analytics' },
      { label: 'Settings', icon: Settings, href: '/(admin)/settings', description: 'System policies & permissions' },
    ];
  }
  return [
    { label: 'Directory', icon: Users, href: '/(employee)/directory', feature: 'users', description: 'Staff directory & departments' },
    { label: 'Holidays', icon: CalendarDays, href: '/(employee)/holidays', feature: 'holidays', description: 'Official company calendar' },
    { label: 'Expenses', icon: Receipt, href: '/(employee)/expenses', feature: 'expenses', description: 'Mileage & expense claims' },
    { label: 'My Assets', icon: Laptop, href: '/(employee)/assets', feature: 'assets', description: 'Custody & equipment requisitions' },
    { label: 'Learning & LMS', icon: GraduationCap, href: '/(employee)/learning', feature: 'learning', description: 'Training courses & certificates' },
    { label: 'Performance', icon: Award, href: '/(employee)/performance', feature: 'performance', description: 'Reviews, goals & kudos' },
    { label: 'Helpdesk', icon: HelpCircle, href: '/(employee)/helpdesk', feature: 'helpdesk', description: 'IT, HR & facilities support' },
    { label: 'Notifications', icon: Bell, href: '/(employee)/notifications', description: 'Announcements & updates' },
    { label: 'My Profile', icon: User, href: '/(employee)/profile', description: 'Personal details & credentials' },
    { label: 'Settings', icon: Settings, href: '/(employee)/settings', description: 'Preferences & security' },
  ];
};

function getActiveTab(pathname: string): string {
  if (pathname.includes('/dashboard')) return 'home';
  if (pathname.includes('/attendance')) return 'attendance';
  if (pathname.includes('/leave')) return 'leave';
  if (pathname.includes('/payslips') || pathname.includes('/payroll')) return 'payslips';
  if (pathname.includes('/users')) return 'users';
  return 'more';
}

interface BottomTabBarProps {
  children: React.ReactNode;
  tabs?: TabItem[];
  moreItems?: MoreItem[];
}

export function BottomTabBar({ children, tabs, moreItems }: BottomTabBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const { isFeatureEnabled, organization, companyName, companyLogoUrl, activePlan } = useTenant();
  const { profile, signOut, role } = useAuth();
  const { unreadCount } = useNotifications();

  const userRole = profile?.role || role;
  const resolvedTabs = tabs || getTabsForRole(userRole);
  const resolvedMoreItems = moreItems || getMoreItemsForRole(userRole);

  const bottomInset = Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 12);

  const [moreOpen, setMoreOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const currentRouteFeat = useMemo(() => getRouteFeature(pathname), [pathname]);
  const isCurrentRouteLocked = Boolean(
    currentRouteFeat && !isFeatureEnabled(currentRouteFeat.feature)
  );

  if (isDesktop) return <>{children}</>;

  const activeTab = getActiveTab(pathname);

  const isTabLocked = (tab: TabItem) => {
    return Boolean(tab.feature && !isFeatureEnabled(tab.feature));
  };

  const isMoreItemLocked = (item: MoreItem) => {
    return Boolean(item.feature && !isFeatureEnabled(item.feature));
  };

  const handleTabPress = (tab: TabItem) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    if (tab.key === 'more') {
      setMoreOpen(true);
      return;
    }

    if (isTabLocked(tab)) {
      Alert.alert(
        'Module Locked',
        `The "${tab.label}" feature is locked for ${organization?.name || 'your organization'}. Please contact your administrator.`,
        [{ text: 'OK' }]
      );
      return;
    }

    if (tab.href) {
      router.push(tab.href as never);
    }
  };

  const handleMoreItemPress = (item: MoreItem) => {
    if (isMoreItemLocked(item)) {
      Alert.alert(
        'Module Locked',
        `The "${item.label}" feature is locked for ${organization?.name || 'your organization'}. Please contact your administrator.`,
        [{ text: 'OK' }]
      );
      return;
    }
    setMoreOpen(false);
    router.push(item.href as never);
  };

  const filteredMoreItems = resolvedMoreItems.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return item.label.toLowerCase().includes(q) || (item.description || '').toLowerCase().includes(q);
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Main Content Area with Route Feature Interception */}
      <View style={styles.content}>
        {isCurrentRouteLocked && currentRouteFeat ? (
          <FeatureGate
            feature={currentRouteFeat.feature}
            featureName={currentRouteFeat.name}
            description={`The ${currentRouteFeat.name} feature is currently locked for ${organization?.name || 'your organization'} on the ${String(activePlan).toUpperCase()} plan.`}
          >
            {children}
          </FeatureGate>
        ) : (
          children
        )}
      </View>

      {/* Notion-Style "More" Bottom Sheet */}
      {moreOpen && (
        <Animated.View
          entering={FadeIn.duration(160)}
          exiting={FadeOut.duration(120)}
          style={styles.moreOverlay}
        >
          <TouchableOpacity
            style={styles.moreBackdrop}
            activeOpacity={1}
            onPress={() => setMoreOpen(false)}
          />
          <Animated.View
            entering={FadeInDown.duration(240).springify().damping(20)}
            style={[
              styles.moreSheet,
              {
                backgroundColor: '#ffffff',
                paddingBottom: Math.max(insets.bottom, 16) + 12,
              },
            ]}
          >
            {/* Sheet Handle */}
            <View style={styles.sheetHandleWrap}>
              <View style={styles.sheetHandle} />
            </View>

            {/* Header with Organization Branding */}
            <View style={[styles.moreHeader, { borderBottomColor: colors.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                {companyLogoUrl ? (
                  <Image source={{ uri: companyLogoUrl }} style={styles.orgLogo} resizeMode="contain" />
                ) : (
                  <View style={[styles.orgLogoPlaceholder, { backgroundColor: NotionColors.cardTintLavender }]}>
                    <Building2 size={18} color={NotionColors.primary} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.moreTitle, { color: NotionColors.ink }]} numberOfLines={1}>
                    {organization?.name || companyName || 'Workspace'}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <View style={[styles.activePlanChip, { backgroundColor: NotionColors.cardTintLavender }]}>
                      <ShieldCheck size={10} color={NotionColors.brandPurple800} />
                      <Text style={[styles.activePlanText, { color: NotionColors.brandPurple800 }]}>
                        {String(activePlan || 'TEAM').toUpperCase()}
                      </Text>
                    </View>
                    <Text style={[styles.moreSubtitle, { color: NotionColors.steel }]}>
                      {String(profile?.role || role || 'employee').toUpperCase()} SUITE
                    </Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => setMoreOpen(false)}
                style={[styles.moreCloseBtn, { backgroundColor: colors.backgroundElement }]}
                activeOpacity={0.7}
              >
                <X size={16} color={NotionColors.steel} />
              </TouchableOpacity>
            </View>

            {/* Notion Search Pill */}
            <View style={[styles.searchBar, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
              <Search size={15} color={NotionColors.steel} />
              <TextInput
                style={[styles.searchInput, { color: NotionColors.ink }]}
                placeholder="Search workspace modules & tools..."
                placeholderTextColor={NotionColors.steel}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <X size={14} color={NotionColors.steel} />
                </TouchableOpacity>
              )}
            </View>

            {/* Modules List */}
            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 24 }}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.moreGrid}>
                {filteredMoreItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname.includes(item.href.split('/').pop() || '___');
                  const isLocked = isMoreItemLocked(item);

                  return (
                    <TouchableOpacity
                      key={item.label}
                      style={[
                        styles.moreItem,
                        { backgroundColor: '#ffffff', borderColor: colors.border },
                        isActive && { backgroundColor: NotionColors.cardTintLavender, borderColor: NotionColors.brandPurple300 },
                        isLocked && { opacity: 0.6 },
                      ]}
                      onPress={() => handleMoreItemPress(item)}
                      activeOpacity={0.75}
                    >
                      <View
                        style={[
                          styles.moreItemIcon,
                          isActive
                            ? { backgroundColor: NotionColors.primary }
                            : { backgroundColor: colors.backgroundElement },
                          isLocked && { backgroundColor: NotionColors.cardTintRose },
                        ]}
                      >
                        <Icon size={18} color={isActive ? '#ffffff' : isLocked ? NotionColors.semanticError : NotionColors.ink} />
                        {isLocked && (
                          <View style={styles.lockBadgeIcon}>
                            <Lock size={8} color="#ffffff" strokeWidth={2.5} />
                          </View>
                        )}
                      </View>

                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text
                            style={[
                              styles.moreItemLabel,
                              { color: NotionColors.ink },
                              isActive && { color: NotionColors.primary, fontWeight: '600' },
                              isLocked && { color: NotionColors.slate },
                            ]}
                            numberOfLines={1}
                          >
                            {item.label}
                          </Text>
                          {isLocked && (
                            <View style={[styles.lockedChip, { backgroundColor: NotionColors.cardTintRose }]}>
                              <Text style={[styles.lockedChipText, { color: NotionColors.semanticError }]}>LOCKED</Text>
                            </View>
                          )}
                        </View>
                        {item.description ? (
                          <Text style={[styles.moreItemDesc, { color: NotionColors.steel }]} numberOfLines={1}>
                            {item.description}
                          </Text>
                        ) : null}
                      </View>

                      <ChevronRight size={14} color={isActive ? NotionColors.primary : NotionColors.hairlineStrong} />
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Bottom Quick Action: Sign Out */}
              <View style={[styles.sheetFooter, { borderTopColor: colors.border }]}>
                <TouchableOpacity
                  style={[styles.signOutBtn, { backgroundColor: NotionColors.cardTintRose }]}
                  onPress={() => {
                    setMoreOpen(false);
                    signOut();
                  }}
                  activeOpacity={0.8}
                >
                  <LogOut size={16} color={NotionColors.semanticError} />
                  <Text style={[styles.signOutText, { color: NotionColors.semanticError }]}>Sign Out of Workspace</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Animated.View>
        </Animated.View>
      )}

      {/* Notion Mobile Bottom Tab Bar */}
      <View
        style={[
          styles.tabBar,
          {
            backgroundColor: '#ffffff',
            borderTopColor: colors.border,
            paddingBottom: bottomInset,
            minHeight: 52 + bottomInset,
          },
        ]}
      >
        {resolvedTabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const isLocked = isTabLocked(tab);
          const Icon = tab.icon;

          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => handleTabPress(tab)}
              style={[styles.tab, isLocked && { opacity: 0.55 }]}
              activeOpacity={0.75}
            >
              <View
                style={[
                  styles.tabIndicator,
                  isActive && {
                    backgroundColor: '#F3EEFE',
                    borderWidth: 1,
                    borderColor: '#DDD6FE',
                    borderRadius: 16,
                    paddingHorizontal: 8,
                  },
                ]}
              >
                <Icon
                  size={19}
                  color={isActive ? '#7C3AED' : isLocked ? NotionColors.muted : NotionColors.steel}
                  strokeWidth={isActive ? 2.5 : 1.8}
                />
                {isLocked && (
                  <View style={styles.tabLockBadge}>
                    <Lock size={7} color="#ffffff" strokeWidth={3} />
                  </View>
                )}
                {tab.key === 'more' && unreadCount > 0 && !isLocked && (
                  <View style={[styles.tabCountBadge, { backgroundColor: NotionColors.primary }]}>
                    <Text style={styles.tabCountText}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </Text>
                  </View>
                )}
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  { color: isActive ? '#6D28D9' : isLocked ? NotionColors.muted : NotionColors.slate },
                  isActive && { fontWeight: '800', color: '#6D28D9' },
                ]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
              {isActive && (
                <View style={{ width: 16, height: 3, backgroundColor: '#7C3AED', borderRadius: 1.5, marginTop: 2 }} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    paddingTop: 6,
    borderTopWidth: 1,
    ...Platform.select({
      web: { boxShadow: '0 -2px 10px rgba(15, 15, 15, 0.05)' } as any,
      default: {
        shadowColor: '#0f0f0f',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 4,
      },
    }),
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    position: 'relative',
    minHeight: 44, // Touch target
  },
  tabIndicator: {
    width: 44,
    height: 28,
    borderRadius: BorderRadius.full, // 9999px for pill tab indicator
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
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
    borderColor: '#ffffff',
  },
  tabCountBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    minWidth: 15,
    height: 15,
    borderRadius: 7.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  tabCountText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#ffffff',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  tabLabelActive: {
    fontWeight: '600',
  },

  // More Sheet
  moreOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 999,
  },
  moreBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(10, 21, 48, 0.65)', // Notion brand-navy
  },
  moreSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '84%',
    borderTopLeftRadius: BorderRadius.xl, // 16px
    borderTopRightRadius: BorderRadius.xl,
    paddingTop: 10,
    ...Platform.select({
      web: { boxShadow: '0 -10px 40px rgba(15, 15, 15, 0.16)' } as any,
      default: {
        shadowColor: '#0f0f0f',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.16,
        shadowRadius: 24,
        elevation: 20,
      },
    }),
  },
  sheetHandleWrap: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e5e3df',
  },
  moreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  orgLogo: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md, // 8px
  },
  orgLogoPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  activePlanChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: BorderRadius.xs, // 4px
  },
  activePlanText: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  moreSubtitle: {
    fontSize: 11,
    fontWeight: '500',
  },
  moreCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: BorderRadius.sm, // 6px
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    height: 44, // 44px Notion search-pill
    borderRadius: BorderRadius.md, // 8px
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  sheetScroll: {
    paddingHorizontal: 20,
    paddingTop: 6,
  },
  moreGrid: {
    gap: 8,
  },
  moreItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: BorderRadius.lg, // 12px Notion standard
    borderWidth: 1,
  },
  moreItemIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md, // 8px
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  lockBadgeIcon: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: NotionColors.semanticError,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreItemLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  moreItemDesc: {
    fontSize: 12,
    marginTop: 1,
  },
  lockedChip: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: BorderRadius.xs,
  },
  lockedChipText: {
    fontSize: 9,
    fontWeight: '600',
  },
  sheetFooter: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: BorderRadius.md, // 8px
  },
  signOutText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

export function useTabBarHeight() {
  const insets = useSafeAreaInsets();
  return 52 + Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 12);
}
