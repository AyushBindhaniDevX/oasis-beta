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
import * as Haptics from 'expo-haptics';

interface TabItem {
  key: string;
  label: string;
  icon: React.ElementType;
  href: string;
  feature?: string;
}

const getTabsForRole = (role?: string | null): TabItem[] => [
  { key: 'home', label: 'Home', icon: LayoutDashboard, href: role === 'admin' ? '/(admin)/dashboard' : role === 'hr' ? '/(hr)/dashboard' : '/(employee)/dashboard' },
  { key: 'attendance', label: 'Attendance', icon: CalendarClock, href: '/(employee)/attendance', feature: 'attendance' },
  { key: 'leave', label: 'Leave', icon: CalendarDays, href: '/(employee)/leave', feature: 'leave' },
  { key: 'payslips', label: 'Payslips', icon: Banknote, href: '/(employee)/payslips', feature: 'payroll' },
  { key: 'more', label: 'More', icon: MoreHorizontal, href: '' },
];

interface MoreItem {
  label: string;
  icon: React.ElementType;
  href: string;
  feature?: string;
  description?: string;
}

const MORE_ITEMS: MoreItem[] = [
  { label: 'Directory', icon: Users, href: '/(employee)/directory', feature: 'users', description: 'Staff & Hospital Departments' },
  { label: 'Holidays', icon: CalendarDays, href: '/(employee)/holidays', feature: 'holidays', description: 'Official Holiday Calendar' },
  { label: 'Performance', icon: Award, href: '/(employee)/performance', feature: 'performance', description: 'Appraisals, Goals & Kudos' },
  { label: 'Learning', icon: GraduationCap, href: '/(employee)/learning', feature: 'learning', description: 'Training Courses & CME' },
  { label: 'Expenses', icon: Receipt, href: '/(employee)/expenses', feature: 'expenses', description: 'Mileage & Claims' },
  { label: 'Helpdesk', icon: HelpCircle, href: '/(employee)/helpdesk', feature: 'helpdesk', description: 'IT, HR & Facility Support' },
  { label: 'Notifications', icon: Bell, href: '/(employee)/notifications', description: 'Alerts & Bulletins' },
  { label: 'My Profile', icon: User, href: '/(employee)/profile', description: 'Personal Details & Identity' },
  { label: 'Settings', icon: Settings, href: '/(employee)/settings', description: 'Preferences & Security' },
];

function getActiveTab(pathname: string): string {
  if (pathname.includes('/dashboard')) return 'home';
  if (pathname.includes('/attendance')) return 'attendance';
  if (pathname.includes('/leave')) return 'leave';
  if (pathname.includes('/payslips') || pathname.includes('/payslip')) return 'payslips';
  return 'more';
}

interface BottomTabBarProps {
  children: React.ReactNode;
  tabs?: TabItem[];
  moreItems?: MoreItem[];
}

export function BottomTabBar({ children, tabs, moreItems = MORE_ITEMS }: BottomTabBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const { isFeatureEnabled, organization, companyName, companyLogoUrl, activePlan } = useTenant();
  const { profile, signOut, role } = useAuth();
  const { unreadCount } = useNotifications();

  const resolvedTabs = tabs || getTabsForRole(profile?.role || role);

  // Safe bottom inset: ensures Android 3-button nav / gesture bar & iOS home indicators never cover UI
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 12);

  const [moreOpen, setMoreOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Determine if the current route is locked by organization feature gates
  const currentRouteFeat = useMemo(() => getRouteFeature(pathname), [pathname]);
  const isCurrentRouteLocked = Boolean(
    currentRouteFeat && !isFeatureEnabled(currentRouteFeat.feature)
  );

  // If on desktop screen width, pass children through directly
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
        `The "${tab.label}" feature is locked for ${organization?.name || 'your organization'}. Please contact your administrator to unlock this module.`,
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
        `The "${item.label}" feature is locked for ${organization?.name || 'your organization'}. Please contact your administrator to unlock this module.`,
        [{ text: 'OK' }]
      );
      return;
    }
    setMoreOpen(false);
    router.push(item.href as never);
  };

  const filteredMoreItems = moreItems.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return item.label.toLowerCase().includes(q) || (item.description || '').toLowerCase().includes(q);
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Main Content with Route-Level Feature Gate Interception ── */}
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

      {/* ── Enhanced Native-Style "More" Bottom Sheet ── */}
      {moreOpen && (
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(150)}
          style={styles.moreOverlay}
        >
          <TouchableOpacity
            style={styles.moreBackdrop}
            activeOpacity={1}
            onPress={() => setMoreOpen(false)}
          />
          <Animated.View
            entering={FadeInDown.duration(280).springify().damping(18)}
            style={[
              styles.moreSheet,
              {
                backgroundColor: '#FFFFFF',
                paddingBottom: Math.max(insets.bottom, 16) + 12,
              },
            ]}
          >
            {/* Sheet Handle */}
            <View style={styles.sheetHandleWrap}>
              <View style={styles.sheetHandle} />
            </View>

            {/* Header with Organization Branding */}
            <View style={[styles.moreHeader, { borderBottomColor: colors.backgroundElement }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                {companyLogoUrl ? (
                  <Image source={{ uri: companyLogoUrl }} style={styles.orgLogo} resizeMode="contain" />
                ) : (
                  <View style={[styles.orgLogoPlaceholder, { backgroundColor: colors.primaryLight }]}>
                    <Building2 size={18} color={colors.primary} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.moreTitle, { color: colors.text }]} numberOfLines={1}>
                    {organization?.name || companyName}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <View style={[styles.activePlanChip, { backgroundColor: colors.primaryLight }]}>
                      <ShieldCheck size={10} color={colors.primary} />
                      <Text style={[styles.activePlanText, { color: colors.primary }]}>{String(activePlan).toUpperCase()}</Text>
                    </View>
                    <Text style={[styles.moreSubtitle, { color: colors.textSecondary }]}>Apps & Console</Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => setMoreOpen(false)}
                style={[styles.moreCloseBtn, { backgroundColor: colors.backgroundElement }]}
                activeOpacity={0.7}
              >
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Module Search Bar */}
            <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Search size={16} color={colors.textTertiary} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Search modules, claims, support..."
                placeholderTextColor={colors.textTertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <X size={14} color={colors.textTertiary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Modules List */}
            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 32 }}
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
                        { backgroundColor: colors.surface, borderColor: colors.backgroundElement },
                        isActive && { backgroundColor: colors.primaryLight, borderColor: colors.primaryLight },
                        isLocked && { opacity: 0.65 },
                      ]}
                      onPress={() => handleMoreItemPress(item)}
                      activeOpacity={0.75}
                    >
                      <View
                        style={[
                          styles.moreItemIcon,
                          isActive ? { backgroundColor: colors.primary } : { backgroundColor: colors.backgroundElement },
                          isLocked && { backgroundColor: colors.dangerLight },
                        ]}
                      >
                        <Icon size={20} color={isActive ? '#FFFFFF' : isLocked ? colors.danger : colors.text} />
                        {isLocked && (
                          <View style={styles.lockBadgeIcon}>
                            <Lock size={8} color="#FFFFFF" strokeWidth={2.5} />
                          </View>
                        )}
                      </View>

                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text
                            style={[
                              styles.moreItemLabel,
                              { color: colors.text },
                              isActive && { color: colors.primary, fontWeight: '700' },
                              isLocked && { color: colors.textSecondary },
                            ]}
                            numberOfLines={1}
                          >
                            {item.label}
                          </Text>
                          {isLocked && (
                            <View style={[styles.lockedChip, { backgroundColor: colors.dangerLight }]}>
                              <Text style={[styles.lockedChipText, { color: colors.danger }]}>LOCKED</Text>
                            </View>
                          )}
                        </View>
                        {item.description ? (
                          <Text style={[styles.moreItemDesc, { color: colors.textSecondary }]} numberOfLines={1}>
                            {item.description}
                          </Text>
                        ) : null}
                      </View>

                      <ChevronRight size={14} color={isActive ? colors.primary : colors.borderStrong} />
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Bottom Quick Actions: Sign Out */}
              <View style={[styles.sheetFooter, { borderTopColor: colors.backgroundElement }]}>
                <TouchableOpacity
                  style={[styles.signOutBtn, { backgroundColor: colors.dangerLight }]}
                  onPress={() => {
                    setMoreOpen(false);
                    signOut();
                  }}
                  activeOpacity={0.8}
                >
                  <LogOut size={16} color={colors.danger} />
                  <Text style={[styles.signOutText, { color: colors.danger }]}>Sign Out of Oasis HCM</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Animated.View>
        </Animated.View>
      )}

      {/* ── Modern Frosted Mobile Bottom Navigation Bar ── */}
      <View
        style={[
          styles.tabBar,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            paddingBottom: bottomInset,
            minHeight: 56 + bottomInset,
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
              style={[styles.tab, isLocked && { opacity: 0.6 }]}
              activeOpacity={0.75}
            >
              <View
                style={[
                  styles.tabIndicator,
                  isActive && { backgroundColor: colors.primaryLight },
                ]}
              >
                <Icon
                  size={20}
                  color={isActive ? colors.primary : isLocked ? colors.textTertiary : colors.textSecondary}
                  strokeWidth={isActive ? 2.4 : 1.8}
                />
                {isLocked && (
                  <View style={styles.tabLockBadge}>
                    <Lock size={8} color="#FFFFFF" strokeWidth={3} />
                  </View>
                )}
                {tab.key === 'more' && unreadCount > 0 && !isLocked && (
                  <View style={[styles.tabCountBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.tabCountText}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </Text>
                  </View>
                )}
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  { color: isActive ? colors.primary : isLocked ? colors.textTertiary : colors.textSecondary },
                  isActive && styles.tabLabelActive,
                ]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
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

  // Bottom Navigation Bar
  tabBar: {
    flexDirection: 'row',
    paddingTop: 8,
    borderTopWidth: 1,
    ...(Platform.select({
      web: { boxShadow: '0 -4px 20px rgba(0, 77, 71, 0.08)' },
      default: {
        shadowColor: '#004D47',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 10,
      },
    }) as any),
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    position: 'relative',
  },
  tabIndicator: {
    width: 44,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabLockBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  tabCountBadge: {
    position: 'absolute',
    top: -2,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  tabCountText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  tabDotBadge: {
    position: 'absolute',
    top: 4,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#006a61',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  tabLabelActive: {
    fontWeight: '800',
  },

  // More Sheet Overlay
  moreOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 999,
  },
  moreBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  moreSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '82%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    ...(Platform.select({
      web: { boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.2)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 24,
      },
    }) as any),
  },
  sheetHandleWrap: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
  },
  moreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  orgLogo: {
    width: 38,
    height: 38,
    borderRadius: 8,
  },
  orgLogoPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#EDF8F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  activePlanChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#E6F4F2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activePlanText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#006a61',
    letterSpacing: 0.3,
  },
  moreSubtitle: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  moreCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    padding: 0,
  },

  sheetScroll: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  moreGrid: {
    gap: 8,
  },
  moreItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...Platform.select({
      web: { boxShadow: '0 1px 3px rgba(0,0,0,0.02)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.02,
        shadowRadius: 2,
        elevation: 1,
      },
    }),
  },
  moreItemIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  lockBadgeIcon: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  moreItemLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  moreItemDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  lockedChip: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  lockedChipText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#DC2626',
    letterSpacing: 0.4,
  },

  sheetFooter: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
  },
  signOutText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
  },
});

export function useTabBarHeight() {
  const insets = useSafeAreaInsets();
  return 56 + Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 12);
}
