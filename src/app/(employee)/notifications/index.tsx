import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
  RefreshControl,
} from 'react-native';
import {
  CraftButton,
  CraftCard,
  CraftHeader,
  Typography,
  T,
  S,
} from '@/components/ui/CraftKit';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/useAuth';
import {
  Bell,
  CheckCircle2,
  Clock,
  X,
  MessageSquare,
  FileText,
  Calendar,
  Wallet,
  Check,
  AlertCircle,
  Sparkles,
  LifeBuoy,
  Briefcase,
  Gift,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '@/lib/services/notifications';
import type { Notification } from '@/types';

type NotificationTab = 'all' | 'unread' | 'approvals';

export default function NotificationsScreen() {
  const colors = useTheme();
  const router = useRouter();
  const { profile } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const [activeTab, setActiveTab] = useState<NotificationTab>('all');
  const [liveNotifs, setLiveNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifs = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const data = await getUserNotifications(profile.id);
      setLiveNotifs(data);
    } catch (e) {
      console.error('Error fetching notifications:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    loadNotifs();
  }, [loadNotifs]);

  const handleMarkAllRead = async () => {
    if (!profile?.id) return;
    await markAllNotificationsAsRead(profile.id);
    setLiveNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const handleCardClick = async (notif: Notification) => {
    if (!notif.is_read) {
      await markNotificationAsRead(notif.id);
      setLiveNotifs((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
      );
    }
    if (notif.action_url) {
      router.push(notif.action_url as never);
    }
  };

  const getNotifIconAndColor = (type: string) => {
    switch (type) {
      case 'leave':
        return { icon: Calendar, color: '#059669' };
      case 'expense':
        return { icon: Wallet, color: '#D97706' };
      case 'ticket':
        return { icon: LifeBuoy, color: '#0D7377' };
      case 'onboarding':
      case 'recruitment':
        return { icon: Briefcase, color: '#7C3AED' };
      case 'kudos':
        return { icon: Gift, color: '#EC4899' };
      default:
        return { icon: Bell, color: '#0D7377' };
    }
  };

  // Combine live notifications with seed defaults if empty
  const SEED_FALLBACK: Notification[] = [
    {
      id: 'seed_1',
      profile_id: profile?.id || 'demo',
      type: 'leave',
      title: 'Welcome to Oasis Notifications',
      message: 'Leave approvals, expense settlements, support tickets, and company announcements appear live here.',
      created_at: new Date(Date.now() - 3600000).toISOString(),
      is_read: false,
      action_url: '/(employee)/leave',
    },
  ];

  const displayList = liveNotifs.length > 0 ? liveNotifs : SEED_FALLBACK;

  const filtered = displayList.filter((n) => {
    if (activeTab === 'unread') return !n.is_read;
    if (activeTab === 'approvals') return n.type === 'leave' || n.type === 'expense';
    return true;
  });

  const unreadCount = displayList.filter((n) => !n.is_read).length;

  const Content = (
    <>
      <View style={[styles.tabsRow, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'all' && [styles.tabBtnActive, { borderBottomColor: '#0D7377' }]]}
          onPress={() => setActiveTab('all')}
        >
          <Text
            style={[
              styles.tabText,
              { color: colors.textSecondary },
              activeTab === 'all' && [styles.tabTextActive, { color: '#0F172A' }],
            ]}
          >
            Inbox ({displayList.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'unread' && [styles.tabBtnActive, { borderBottomColor: '#0D7377' }]]}
          onPress={() => setActiveTab('unread')}
        >
          <Text
            style={[
              styles.tabText,
              { color: colors.textSecondary },
              activeTab === 'unread' && [styles.tabTextActive, { color: '#0F172A' }],
            ]}
          >
            Unread {unreadCount > 0 ? `(${unreadCount})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'approvals' && [styles.tabBtnActive, { borderBottomColor: '#0D7377' }]]}
          onPress={() => setActiveTab('approvals')}
        >
          <Text
            style={[
              styles.tabText,
              { color: colors.textSecondary },
              activeTab === 'approvals' && [styles.tabTextActive, { color: '#0F172A' }],
            ]}
          >
            Approvals
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadNotifs();
            }}
          />
        }
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Bell size={48} color={colors.textSecondary} opacity={0.2} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>You're all caught up</Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>No new notifications in this view.</Text>
          </View>
        ) : (
          filtered.map((item, idx) => {
            const { icon: Icon, color } = getNotifIconAndColor(item.type);
            const isUnread = !item.is_read;

            return (
              <Animated.View key={item.id} entering={FadeInDown.delay(idx * 40).duration(300).springify()}>
                <CraftCard
                  variant={isUnread ? 'pastel' : 'base'}
                  pastelTint={isUnread ? T.mint : undefined}
                  style={[
                    styles.notifCard,
                    {
                      borderBottomColor: colors.border,
                    },
                  ]}
                  onPress={() => handleCardClick(item)}
                  padding={14}
                >
                  {isUnread && <View style={styles.unreadIndicator} />}
                  <View style={[styles.iconBox, { backgroundColor: color + '15' }]}>
                    <Icon size={20} color={color} />
                  </View>
                  <View style={styles.cardBody}>
                    <View style={styles.cardHeader}>
                      <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
                      <Text style={[styles.cardTime, { color: colors.textSecondary }]}>
                        {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    <Text style={[styles.cardMessage, { color: colors.textSecondary }]}>{item.message}</Text>
                  </View>
                </CraftCard>
              </Animated.View>
            );
          })
        )}
      </ScrollView>
    </>
  );

  if (!isDesktop) {
    return (
      <View style={[styles.root, { backgroundColor: T.canvas }]}>
        <CraftHeader
          title="Notifications"
          subtitle="Updates on leaves, expenses & company requests"
          onBack={() => router.back()}
          right={
            <CraftButton
              title="Mark all read"
              variant="secondary"
              size="sm"
              icon={<CheckCircle2 size={13} color={T.ink} />}
              onPress={handleMarkAllRead}
            />
          }
        />
        {Content}
      </View>
    );
  }

  // Desktop
  return (
    <View style={[styles.root, { backgroundColor: T.canvas }]}>
      <CraftHeader
        title="Notifications & Activity"
        subtitle="Live updates on your leave approvals, expenses, and tickets"
        right={
          <CraftButton
            title="Mark all as read"
            variant="secondary"
            icon={<CheckCircle2 size={14} color={T.ink} />}
            onPress={handleMarkAllRead}
          />
        }
      />
      <View style={styles.dContainer}>
        <View style={[styles.dCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {Content}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  mHeader: {
    paddingTop: Platform.OS === 'ios' ? 48 : 24,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mHeaderTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  tabsRow: { flexDirection: 'row', paddingHorizontal: 16, borderBottomWidth: 1 },
  tabBtn: { paddingVertical: 14, paddingHorizontal: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: '#006a61' },
  tabText: { fontSize: 14, fontWeight: '600' },
  tabTextActive: { fontWeight: '800' },

  scrollContent: { paddingBottom: 110 },

  notifCard: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
  },
  unreadIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: '#006a61',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardBody: { flex: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardTime: { fontSize: 12 },
  cardMessage: { fontSize: 14, lineHeight: 20 },

  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '800', marginTop: 16 },
  emptySub: { fontSize: 14, marginTop: 4 },

  dHeader: {
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  dSubtitle: { fontSize: 14, marginTop: 4 },
  dMarkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EDF8F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  dMarkBtnText: { fontSize: 13, fontWeight: '700', color: '#006a61' },
  dContainer: { padding: 24, flex: 1, alignItems: 'center' },
  dCard: { width: '100%', maxWidth: 800, flex: 1, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
});
