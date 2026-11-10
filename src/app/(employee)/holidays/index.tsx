import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import Svg, { Path, SvgXml } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/context/TenantContext';
import { LoadingState } from '@/components/ui/States';
import { InteractiveTile } from '@/components/ui/InteractiveTile';
import { STOCK_10_SVG } from '@/constants/workManagementSvgs';
import { getHolidays } from '@/lib/services/holidays';
import { formatDate } from '@/utils/format';
import type { Holiday } from '@/types';
import {
  CalendarDays,
  CalendarCheck,
  Search,
  Sparkles,
  Building2,
  Clock,
  CheckCircle2,
  ChevronRight,
  RefreshCw,
  X,
  Filter,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

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

export default function EmployeeHolidaysScreen() {
  const { profile } = useAuth();
  const { organization: tenantOrg, employee: tenantEmp } = useTenant();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'upcoming' | 'statutory' | 'optional'>('all');

  const loadData = useCallback(async () => {
    try {
      const orgId = tenantOrg?.id || profile?.organization_id;
      const data = await getHolidays(orgId, selectedYear);
      setHolidays(data);
    } catch (err) {
      console.error('Error loading employee holidays:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantOrg, profile, selectedYear]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Filtered holidays
  const filtered = useMemo(() => {
    return holidays.filter((h) => {
      const isOptional = h.type === 'optional' || h.type === 'restricted' || (h as any).is_optional;

      // Type filter
      if (filterType === 'upcoming' && h.date < todayStr) return false;
      if (filterType === 'statutory' && isOptional) return false;
      if (filterType === 'optional' && !isOptional) return false;

      // Search query
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchesName = (h.name || '').toLowerCase().includes(q);
        const matchesDesc = (h.description || '').toLowerCase().includes(q);
        if (!matchesName && !matchesDesc) return false;
      }

      return true;
    });
  }, [holidays, filterType, search, todayStr]);

  // Statistics
  const totalCount = holidays.length;
  const statutoryCount = holidays.filter((h) => h.type !== 'optional' && h.type !== 'restricted' && !(h as any).is_optional).length;
  const optionalCount = holidays.filter((h) => h.type === 'optional' || h.type === 'restricted' || (h as any).is_optional).length;

  const nextUpcoming = useMemo(() => {
    const upcoming = holidays
      .filter((h) => h.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date));
    return upcoming.length > 0 ? upcoming[0] : null;
  }, [holidays, todayStr]);

  const daysUntilNext = useMemo(() => {
    if (!nextUpcoming) return null;
    const diff = Math.ceil(
      (new Date(nextUpcoming.date).getTime() - new Date(todayStr).getTime()) / (1000 * 60 * 60 * 24)
    );
    return diff;
  }, [nextUpcoming, todayStr]);

  if (loading) return <LoadingState />;

  const kpiCardWidth = isDesktop ? undefined : (width - 32 - 12) / 2;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: '#F8F9FC' }]}
      contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <Animated.View entering={FadeInDown.duration(280)} style={styles.headerRow}>
        <View style={{ flex: 1, minWidth: 260 }}>
          <Text style={styles.pageTitle}>Holiday Calendar</Text>
          <Text style={styles.pageSubtitle}>
            Statutory public holidays, festive observances, and scheduled company closures across{' '}
            <Text style={{ fontWeight: '700', color: '#0F172A' }}>{tenantOrg?.name || 'Workspace'}</Text>.
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={onRefresh}
            disabled={refreshing}
            activeOpacity={0.8}
          >
            <RefreshCw size={14} color="#64748B" />
            <Text style={styles.refreshBtnText}>Refresh</Text>
          </TouchableOpacity>

          <View style={styles.yearToggleWrap}>
            {[currentYear - 1, currentYear, currentYear + 1].map((yr) => (
              <TouchableOpacity
                key={yr}
                style={[styles.yearToggleBtn, selectedYear === yr && styles.yearToggleBtnActive]}
                onPress={() => setSelectedYear(yr)}
              >
                <Text
                  style={[
                    styles.yearToggleBtnText,
                    selectedYear === yr && styles.yearToggleBtnTextActive,
                  ]}
                >
                  {yr}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Animated.View>

      {/* ── 4 Metric KPI Cards ──────────────────────────────────────────────── */}
      <Animated.View entering={FadeInDown.delay(50).duration(280)} style={styles.kpiRow}>
        {/* Tile 1: Total Holidays */}
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
              <CalendarDays size={18} color="#7C3AED" />
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.metricValueText, { color: '#5B21B6' }]}>{totalCount}</Text>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#7C3AED', marginTop: 1 }}>
                Scheduled
              </Text>
            </View>
          </View>
          <Text style={styles.metricLabelText}>Total Holidays ({selectedYear})</Text>
          <View style={styles.waveContainer}>
            <MetricWave color="#8B5CF6" width={isDesktop ? 140 : 80} height={24} />
          </View>
        </InteractiveTile>

        {/* Tile 2: Statutory Public */}
        <InteractiveTile
          style={[
            styles.pastelMetricCard,
            {
              backgroundColor: '#ECFDF5',
              borderColor: '#D1FAE5',
              flex: isDesktop ? 1 : undefined,
              minWidth: isDesktop ? 160 : undefined,
              width: kpiCardWidth,
            },
          ]}
        >
          <View style={styles.cardTopRow}>
            <View style={[styles.iconBox, { backgroundColor: '#D1FAE5' }]}>
              <CheckCircle2 size={18} color="#059669" />
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.metricValueText, { color: '#065F46' }]}>{statutoryCount}</Text>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#059669', marginTop: 1 }}>
                Mandatory Off
              </Text>
            </View>
          </View>
          <Text style={styles.metricLabelText}>Statutory Public Holidays</Text>
          <View style={styles.waveContainer}>
            <MetricWave color="#10B981" width={isDesktop ? 140 : 80} height={24} />
          </View>
        </InteractiveTile>

        {/* Tile 3: Optional / Restricted */}
        <InteractiveTile
          style={[
            styles.pastelMetricCard,
            {
              backgroundColor: '#FFF7ED',
              borderColor: '#FFEDD5',
              flex: isDesktop ? 1 : undefined,
              minWidth: isDesktop ? 160 : undefined,
              width: kpiCardWidth,
            },
          ]}
        >
          <View style={styles.cardTopRow}>
            <View style={[styles.iconBox, { backgroundColor: '#FFEDD5' }]}>
              <Sparkles size={18} color="#EA580C" />
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.metricValueText, { color: '#9A3412' }]}>{optionalCount}</Text>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#EA580C', marginTop: 1 }}>
                Elective Days
              </Text>
            </View>
          </View>
          <Text style={styles.metricLabelText}>Optional / Restricted</Text>
          <View style={styles.waveContainer}>
            <MetricWave color="#F97316" width={isDesktop ? 140 : 80} height={24} />
          </View>
        </InteractiveTile>

        {/* Tile 4: Next Upcoming Holiday */}
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
              <Clock size={18} color="#2563EB" />
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.metricValueText, { color: '#1E40AF', fontSize: 18 }]}>
                {daysUntilNext !== null ? (daysUntilNext === 0 ? 'Today' : `${daysUntilNext}d`) : '—'}
              </Text>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#2563EB', marginTop: 1 }}>
                Countdown
              </Text>
            </View>
          </View>
          <Text style={styles.metricLabelText} numberOfLines={1}>
            {nextUpcoming ? nextUpcoming.name : 'No more this year'}
          </Text>
          <View style={styles.waveContainer}>
            <MetricWave color="#3B82F6" width={isDesktop ? 140 : 80} height={24} />
          </View>
        </InteractiveTile>
      </Animated.View>

      {/* ── Search & Filter Bar ─────────────────────────────────────────────── */}
      <View style={styles.filterSection}>
        <View style={styles.searchBoxModern}>
          <Search size={15} color="#94A3B8" />
          <TextInput
            placeholder="Search holiday by name, festive festival, or keyword..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
            style={styles.searchInputModern}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <X size={15} color="#94A3B8" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Filter Pills */}
        <View style={styles.filterTabsRow}>
          <TouchableOpacity
            style={[styles.filterTab, filterType === 'all' && styles.filterTabActive]}
            onPress={() => setFilterType('all')}
          >
            <Text style={[styles.filterTabText, filterType === 'all' && styles.filterTabTextActive]}>
              All ({holidays.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterTab, filterType === 'upcoming' && styles.filterTabActive]}
            onPress={() => setFilterType('upcoming')}
          >
            <Text
              style={[
                styles.filterTabText,
                filterType === 'upcoming' && styles.filterTabTextActive,
              ]}
            >
              Upcoming ({holidays.filter((h) => h.date >= todayStr).length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterTab, filterType === 'statutory' && styles.filterTabActive]}
            onPress={() => setFilterType('statutory')}
          >
            <Text
              style={[
                styles.filterTabText,
                filterType === 'statutory' && styles.filterTabTextActive,
              ]}
            >
              Statutory ({statutoryCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterTab, filterType === 'optional' && styles.filterTabActive]}
            onPress={() => setFilterType('optional')}
          >
            <Text
              style={[
                styles.filterTabText,
                filterType === 'optional' && styles.filterTabTextActive,
              ]}
            >
              Optional ({optionalCount})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Holiday Cards List ──────────────────────────────────────────────── */}
      <View style={styles.listContainer}>
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <CalendarCheck size={36} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No Holidays Found</Text>
            <Text style={styles.emptySub}>
              No scheduled holidays match your current filter or search criteria.
            </Text>
          </View>
        ) : (
          filtered.map((h, idx) => {
            const hDate = new Date(h.date);
            const isPast = h.date < todayStr;
            const isToday = h.date === todayStr;
            const dayNum = hDate.getDate();
            const monthStr = hDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
            const weekdayStr = hDate.toLocaleDateString('en-US', { weekday: 'long' });

            const diffDays = Math.ceil(
              (new Date(h.date).getTime() - new Date(todayStr).getTime()) / (1000 * 60 * 60 * 24)
            );

            return (
              <Animated.View
                key={h.id}
                entering={FadeInDown.delay(idx * 20).duration(240)}
                style={[
                  styles.holidayCard,
                  isToday && styles.holidayCardToday,
                  isPast && styles.holidayCardPast,
                ]}
              >
                {/* Date Box */}
                <View
                  style={[
                    styles.dateBox,
                    isToday
                      ? styles.dateBoxToday
                      : isPast
                      ? styles.dateBoxPast
                      : styles.dateBoxUpcoming,
                  ]}
                >
                  <Text
                    style={[
                      styles.dateMonthText,
                      isToday
                        ? { color: '#7C3AED' }
                        : isPast
                        ? { color: '#94A3B8' }
                        : { color: '#059669' },
                    ]}
                  >
                    {monthStr}
                  </Text>
                  <Text
                    style={[
                      styles.dateDayText,
                      isToday
                        ? { color: '#7C3AED' }
                        : isPast
                        ? { color: '#64748B' }
                        : { color: '#0F172A' },
                    ]}
                  >
                    {dayNum}
                  </Text>
                </View>

                {/* Holiday Details */}
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Text
                      style={[
                        styles.holidayName,
                        isPast && { color: '#64748B' },
                      ]}
                      numberOfLines={1}
                    >
                      {h.name}
                    </Text>

                    {/* Status / Countdown Pill */}
                    {isToday ? (
                      <View style={[styles.countdownPill, { backgroundColor: '#F3EEFE', borderColor: '#DDD6FE' }]}>
                        <Text style={[styles.countdownText, { color: '#7C3AED' }]}>TODAY</Text>
                      </View>
                    ) : isPast ? (
                      <View style={[styles.countdownPill, { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }]}>
                        <Text style={[styles.countdownText, { color: '#94A3B8' }]}>PASSED</Text>
                      </View>
                    ) : (
                      <View style={[styles.countdownPill, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                        <Text style={[styles.countdownText, { color: '#059669' }]}>
                          IN {diffDays} DAY{diffDays !== 1 ? 'S' : ''}
                        </Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.weekdayText}>
                    {weekdayStr} • {formatDate(h.date)}
                  </Text>

                  {h.description ? (
                    <Text style={styles.holidayDescText} numberOfLines={2}>
                      {h.description}
                    </Text>
                  ) : null}
                </View>

                {/* Type Badge */}
                <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                  {(() => {
                    const isOpt = h.type === 'optional' || h.type === 'restricted' || (h as any).is_optional;
                    return (
                      <View
                        style={[
                          styles.typeBadge,
                          isOpt ? styles.typeBadgeOptional : styles.typeBadgeStatutory,
                        ]}
                      >
                        <Text
                          style={[
                            styles.typeBadgeText,
                            isOpt ? { color: '#7C3AED' } : { color: '#047857' },
                          ]}
                        >
                          {isOpt ? 'Optional' : 'Statutory'}
                        </Text>
                      </View>
                    );
                  })()}
                </View>
              </Animated.View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { gap: 16, padding: 16, paddingBottom: 64 },
  contentDesktop: {
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 32,
    paddingTop: 24,
    gap: 18,
  },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  pageSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
    maxWidth: 620,
    lineHeight: 18,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  refreshBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#475569',
  },
  yearToggleWrap: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 3,
    gap: 3,
  },
  yearToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 7,
  },
  yearToggleBtnActive: {
    backgroundColor: '#0F172A',
  },
  yearToggleBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  yearToggleBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // KPI Row
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  pastelMetricCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValueText: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  metricLabelText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#475569',
  },
  waveContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    opacity: 0.8,
  },

  // Filter Section
  filterSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 10,
  },
  searchBoxModern: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    height: 40,
  },
  searchInputModern: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
  },
  filterTabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  filterTabActive: {
    backgroundColor: '#0F172A',
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // List Cards
  listContainer: {
    gap: 10,
  },
  holidayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  holidayCardToday: {
    borderColor: '#7C3AED',
    borderWidth: 1.5,
    backgroundColor: '#FAF5FF',
  },
  holidayCardPast: {
    opacity: 0.75,
  },
  dateBox: {
    width: 52,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateBoxUpcoming: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  dateBoxToday: {
    backgroundColor: '#F3EEFE',
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  dateBoxPast: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dateMonthText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  dateDayText: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: -2,
  },
  holidayName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  weekdayText: {
    fontSize: 12,
    color: '#64748B',
  },
  holidayDescText: {
    fontSize: 11.5,
    color: '#94A3B8',
    lineHeight: 16,
  },
  countdownPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  countdownText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeBadgeStatutory: {
    backgroundColor: '#DCFCE7',
  },
  typeBadgeOptional: {
    backgroundColor: '#F3EEFE',
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },

  emptyState: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
  },
  emptySub: {
    fontSize: 12.5,
    color: '#64748B',
  },
});
