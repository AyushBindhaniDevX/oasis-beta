import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Path, SvgXml } from 'react-native-svg';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SidebarLayout } from '@/components/layout/Sidebar';
import { LoadingState } from '@/components/ui/States';
import { DatePicker } from '@/components/ui/DatePicker';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { InteractiveTile } from '@/components/ui/InteractiveTile';
import { MONTHS, getTenantDefaultUnits, normalizeHospitalUnit } from '@/constants/config';
import { getNavForRole } from '@/constants/navigation';
import { useTenant } from '@/context/TenantContext';
import { useAuth } from '@/hooks/useAuth';
import { STOCK_10_SVG, STOCK_4_SVG, STOCK_8_SVG, STOCK_12_SVG } from '@/constants/workManagementSvgs';
import {
  createHoliday,
  deleteHoliday,
  getHolidays,
  updateHoliday,
} from '@/lib/services/holidays';
import type { Holiday, HolidayType } from '@/types';
import { formatDate } from '@/utils/format';
import {
  CalendarCheck,
  CalendarDays,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Edit2,
  PartyPopper,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
  Building2,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react-native';

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

const HOLIDAY_TYPE_OPTIONS: { label: string; value: HolidayType }[] = [
  { label: 'Public Mandatory Holiday', value: 'public' },
  { label: 'Company / Hospital Off', value: 'company' },
  { label: 'Optional / Restricted Holiday', value: 'optional' },
  { label: 'Restricted Observance', value: 'restricted' },
];

interface HolidaysCalendarScreenProps {
  wrapInSidebar?: boolean;
}

export default function HolidaysCalendarScreen({ wrapInSidebar = true }: HolidaysCalendarScreenProps = {}) {
  const { profile } = useAuth();
  const { organization: tenantOrg, units: tenantUnits } = useTenant();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const isHRorAdmin = profile?.role === 'admin' || profile?.role === 'hr';

  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [unitFilter, setUnitFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

  const [currentDate, setCurrentDate] = useState(new Date());
  const selectedYear = currentDate.getFullYear();
  const selectedMonth = currentDate.getMonth();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [formName, setFormName] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formType, setFormType] = useState<HolidayType>('public');
  const [formDescription, setFormDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const availableUnits = useMemo(() => {
    if (tenantUnits && tenantUnits.length > 0) return tenantUnits;
    return getTenantDefaultUnits(tenantOrg?.name, tenantOrg?.id);
  }, [tenantUnits, tenantOrg]);

  const load = useCallback(async () => {
    try {
      const orgId = tenantOrg?.id || profile?.organization_id;
      const data = await getHolidays(orgId, selectedYear);
      setHolidays(data);
    } catch (err) {
      console.error('Error loading holidays:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile, tenantOrg, selectedYear]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
  };

  const handleOpenAdd = () => {
    setEditingHoliday(null);
    setFormName('');
    const m = String(selectedMonth + 1).padStart(2, '0');
    setFormDate(`${selectedYear}-${m}-15`);
    setFormType('public');
    setFormDescription('');
    setFormError('');
    setShowAddModal(true);
  };

  const handleOpenEdit = (h: Holiday) => {
    setEditingHoliday(h);
    setFormName(h.name);
    setFormDate(h.date);
    setFormType(h.type);
    setFormDescription(h.description || '');
    setFormError('');
    setShowAddModal(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formDate) {
      setFormError('Holiday name and date are required.');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      const orgId = tenantOrg?.id || profile?.organization_id || '';
      if (editingHoliday) {
        await updateHoliday(editingHoliday.id, {
          name: formName.trim(),
          date: formDate,
          type: formType,
          description: formDescription.trim() || null,
          is_recurring: true,
        });
      } else {
        await createHoliday({
          organization_id: orgId,
          name: formName.trim(),
          date: formDate,
          type: formType,
          description: formDescription.trim() || null,
          is_recurring: true,
        });
      }
      setShowAddModal(false);
      await load();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to save holiday');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const proceed = async () => {
      try {
        await deleteHoliday(id);
        await load();
      } catch (err) {
        console.error('Delete error:', err);
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`Remove "${name}" from the holiday calendar?`)) await proceed();
    } else {
      Alert.alert('Remove Holiday', `Remove "${name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: proceed },
      ]);
    }
  };

  const filteredHolidays = useMemo(() => {
    return holidays.filter((h) => {
      const matchesSearch =
        !search ||
        h.name.toLowerCase().includes(search.toLowerCase()) ||
        (h.description || '').toLowerCase().includes(search.toLowerCase()) ||
        h.date.includes(search);
      const matchesType = selectedType === 'all' || h.type === selectedType;
      return matchesSearch && matchesType;
    });
  }, [holidays, search, selectedType]);

  const todayStr = new Date().toISOString().split('T')[0];
  const upcomingHolidays = useMemo(
    () => holidays.filter((h) => h.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date)),
    [holidays, todayStr],
  );
  const nextHoliday = upcomingHolidays[0];

  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(selectedYear, selectedMonth, 1).getDay();

  const changeMonth = (delta: number) => {
    setCurrentDate(new Date(selectedYear, selectedMonth + delta, 1));
  };

  const typeMeta = (type: HolidayType) => {
    switch (type) {
      case 'public':
        return { bg: '#D1FAE5', fg: '#047857', border: '#A7F3D0', label: 'Public Mandatory' };
      case 'company':
        return { bg: '#DBEAFE', fg: '#1D4ED8', border: '#BFDBFE', label: 'Hospital Off' };
      case 'optional':
        return { bg: '#FFEDD5', fg: '#C2410C', border: '#FED7AA', label: 'Optional Holiday' };
      case 'restricted':
        return { bg: '#FEE2E2', fg: '#B91C1C', border: '#FECACA', label: 'Restricted' };
      default:
        return { bg: '#F1F5F9', fg: '#475569', border: '#E2E8F0', label: type };
    }
  };

  if (loading) return <LoadingState />;

  const kpiCardWidth = isDesktop ? undefined : (width - 40 - 12) / 2;

  const content = (
    <ScrollView
      style={[styles.container, { backgroundColor: '#FAF9FD' }]}
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
        {/* Modern Header with STOCK 10 SVG */}
        <Animated.View entering={FadeInDown.duration(280)} style={styles.headerRow}>
          <View style={{ flex: 1, minWidth: 260 }}>
            <View style={styles.breadcrumbRow}>
              <Text style={styles.breadcrumbMuted}>Dashboard</Text>
              <Text style={styles.breadcrumbMuted}>/</Text>
              <Text style={styles.breadcrumbActive}>Holiday Calendar</Text>
            </View>

            <Text style={[styles.pageTitle, { color: '#0F172A' }]}>Holiday Calendar & Closures</Text>
            <Text style={[styles.pageSubtitle, { color: '#64748B' }]}>
              Manage statutory public holidays, optional religious observances, and operational closures across{' '}
              <Text style={{ fontWeight: '700', color: '#0F172A' }}>{tenantOrg?.name || 'Workspace'}</Text>.
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={onRefresh}
              disabled={refreshing}
              activeOpacity={0.8}
            >
              <RefreshCw size={15} color="#64748B" />
              <Text style={styles.refreshBtnText}>Refresh</Text>
            </TouchableOpacity>

            <View style={{ opacity: 0.95 }}>
              <SvgXml xml={STOCK_10_SVG} width={isDesktop ? 120 : 85} height={isDesktop ? 85 : 60} />
            </View>

            {isHRorAdmin && (
              <TouchableOpacity
                style={[styles.headerPrimaryBtn, { backgroundColor: '#7C3AED' }]}
                onPress={handleOpenAdd}
                activeOpacity={0.88}
              >
                <Plus size={16} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={styles.headerPrimaryBtnText}>Add Holiday</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        {/* 4 Pastel KPI Metric Cards with InteractiveTile */}
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
                <Text style={[styles.metricValueText, { color: '#1E1B4B' }]}>{holidays.length}</Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#8B5CF6', marginTop: 1 }}>{selectedYear}</Text>
              </View>
            </View>
            <Text style={styles.metricLabelText}>Total Annual Holidays</Text>
            <View style={styles.waveContainer}>
              <MetricWave color="#8B5CF6" width={isDesktop ? 150 : 80} height={24} />
            </View>
          </InteractiveTile>

          {/* Tile 2: Public Mandatory */}
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
                <CalendarCheck size={18} color="#10B981" />
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.metricValueText, { color: '#064E3B' }]}>
                  {holidays.filter((h) => h.type === 'public').length}
                </Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#10B981', marginTop: 1 }}>Gazetted</Text>
              </View>
            </View>
            <Text style={styles.metricLabelText}>Public Statutory</Text>
            <View style={styles.waveContainer}>
              <MetricWave color="#10B981" width={isDesktop ? 150 : 80} height={24} />
            </View>
          </InteractiveTile>

          {/* Tile 3: Optional / Restricted */}
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
                <PartyPopper size={18} color="#EA580C" />
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.metricValueText, { color: '#7C2D12' }]}>
                  {holidays.filter((h) => h.type === 'optional' || h.type === 'restricted').length}
                </Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#EA580C', marginTop: 1 }}>Restricted</Text>
              </View>
            </View>
            <Text style={styles.metricLabelText}>Optional Holidays</Text>
            <View style={styles.waveContainer}>
              <MetricWave color="#F97316" width={isDesktop ? 150 : 80} height={24} />
            </View>
          </InteractiveTile>

          {/* Tile 4: Next Holiday */}
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
                <Sparkles size={18} color="#2563EB" />
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.metricValueText, { color: '#1E3A8A', fontSize: 16 }]} numberOfLines={1}>
                  {nextHoliday ? formatDate(nextHoliday.date) : 'Completed'}
                </Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#2563EB', marginTop: 1 }}>Upcoming</Text>
              </View>
            </View>
            <Text style={styles.metricLabelText} numberOfLines={1}>
              {nextHoliday ? nextHoliday.name : 'No more holidays'}
            </Text>
            <View style={styles.waveContainer}>
              <MetricWave color="#3B82F6" width={isDesktop ? 150 : 80} height={24} />
            </View>
          </InteractiveTile>
        </Animated.View>

        {/* View Mode Selector Tabs */}
        <View style={styles.viewModeTabs}>
          <TouchableOpacity
            style={[styles.viewTabBtn, viewMode === 'calendar' && styles.viewTabBtnActive]}
            onPress={() => setViewMode('calendar')}
            activeOpacity={0.8}
          >
            <Calendar size={15} color={viewMode === 'calendar' ? '#7C3AED' : '#64748B'} />
            <Text style={[styles.viewTabBtnText, viewMode === 'calendar' && styles.viewTabBtnTextActive]}>
              Interactive Calendar Grid
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.viewTabBtn, viewMode === 'list' && styles.viewTabBtnActive]}
            onPress={() => setViewMode('list')}
            activeOpacity={0.8}
          >
            <CalendarDays size={15} color={viewMode === 'list' ? '#7C3AED' : '#64748B'} />
            <Text style={[styles.viewTabBtnText, viewMode === 'list' && styles.viewTabBtnTextActive]}>
              Chronological Schedule ({filteredHolidays.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Filter Section: Search and Workplace Unit Pills */}
        <View style={styles.filterSection}>
          <View style={styles.searchRow}>
            <View style={styles.searchBox}>
              <Search size={16} color="#94A3B8" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search holidays by name or description..."
                placeholderTextColor="#94A3B8"
                value={search}
                onChangeText={setSearch}
              />
              {search ? (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <X size={15} color="#94A3B8" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Type selector pills */}
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              {(
                [
                  { id: 'all', label: 'All Types' },
                  { id: 'public', label: 'Public' },
                  { id: 'company', label: 'Hospital' },
                  { id: 'optional', label: 'Optional' },
                ] as const
              ).map((t) => {
                const active = selectedType === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.typeFilterPill, active && styles.typeFilterPillActive]}
                    onPress={() => setSelectedType(t.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.typeFilterPillText, active && styles.typeFilterPillTextActive]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Unit pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.unitPillsRow}>
            <TouchableOpacity
              style={[styles.unitFilterPill, unitFilter === 'all' && styles.unitFilterPillActive]}
              onPress={() => setUnitFilter('all')}
              activeOpacity={0.8}
            >
              <Text style={[styles.unitFilterPillText, unitFilter === 'all' && styles.unitFilterPillTextActive]}>
                All Units ({holidays.length})
              </Text>
            </TouchableOpacity>

            {availableUnits.map((u) => {
              const normalized = normalizeHospitalUnit(u);
              const active = unitFilter.toLowerCase() === u.toLowerCase();
              return (
                <TouchableOpacity
                  key={u}
                  style={[styles.unitFilterPill, active && styles.unitFilterPillActive]}
                  onPress={() => setUnitFilter(active ? 'all' : u)}
                  activeOpacity={0.8}
                >
                  <Building2 size={12} color={active ? '#7C3AED' : '#64748B'} />
                  <Text style={[styles.unitFilterPillText, active && styles.unitFilterPillTextActive]}>
                    {normalized}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ── View 1: Calendar Grid ────────────────────────────────────────── */}
        {viewMode === 'calendar' ? (
          <View style={styles.calendarCard}>
            {/* Month & Year Navigation Header */}
            <View style={styles.calendarHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={styles.calendarMonthTitle}>
                  {MONTHS[selectedMonth]} {selectedYear}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity
                  style={styles.calNavBtn}
                  onPress={() => changeMonth(-1)}
                  activeOpacity={0.8}
                >
                  <ChevronLeft size={16} color="#0F172A" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.todayBtn}
                  onPress={() => setCurrentDate(new Date())}
                  activeOpacity={0.8}
                >
                  <Text style={styles.todayBtnText}>Today</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.calNavBtn}
                  onPress={() => changeMonth(1)}
                  activeOpacity={0.8}
                >
                  <ChevronRight size={16} color="#0F172A" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Weekdays Row */}
            <View style={styles.weekdaysRow}>
              {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day) => (
                <View key={day} style={styles.weekdayCell}>
                  <Text style={styles.weekdayText}>{day}</Text>
                </View>
              ))}
            </View>

            {/* Calendar Days Matrix */}
            <View style={styles.daysGrid}>
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <View key={`empty-${i}`} style={styles.dayCellEmpty} />
              ))}

              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const mStr = String(selectedMonth + 1).padStart(2, '0');
                const dStr = String(dayNum).padStart(2, '0');
                const currentDayDateStr = `${selectedYear}-${mStr}-${dStr}`;
                const daysHolidays = holidays.filter((h) => h.date === currentDayDateStr);
                const isToday = currentDayDateStr === todayStr;

                return (
                  <View
                    key={`day-${dayNum}`}
                    style={[styles.dayCell, isToday && styles.dayCellToday]}
                  >
                    <View style={styles.dayCellHeader}>
                      <Text style={[styles.dayNumText, isToday && styles.dayNumTextToday]}>
                        {dayNum}
                      </Text>
                      {daysHolidays.length > 0 && (
                        <View style={[styles.holidayCountDot, { backgroundColor: '#7C3AED' }]} />
                      )}
                    </View>

                    <View style={{ gap: 3 }}>
                      {daysHolidays.map((h) => {
                        const meta = typeMeta(h.type);
                        return (
                          <TouchableOpacity
                            key={h.id}
                            style={[styles.holidayTagPill, { backgroundColor: meta.bg, borderColor: meta.border }]}
                            onPress={() => isHRorAdmin && handleOpenEdit(h)}
                            activeOpacity={0.8}
                          >
                            <Text style={[styles.holidayTagText, { color: meta.fg }]} numberOfLines={1}>
                              {h.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ) : (
          /* ── View 2: Chronological List View (Modern Cards matching Image 1) ── */
          <View style={{ gap: 10 }}>
            {filteredHolidays.length === 0 ? (
              <View style={styles.emptyCard}>
                <CalendarDays size={36} color="#94A3B8" />
                <Text style={styles.emptyTitle}>No Holidays Found</Text>
                <Text style={styles.emptySub}>
                  {search ? `No holidays match "${search}"` : 'No holidays registered for this calendar filter.'}
                </Text>
              </View>
            ) : (
              filteredHolidays.map((item) => {
                const meta = typeMeta(item.type);
                const holidayDate = new Date(item.date);
                const monthStr = holidayDate.toLocaleString('default', { month: 'short' }).toUpperCase();
                const dayStr = holidayDate.getDate();

                return (
                  <View key={item.id} style={styles.holidayCardModern}>
                    {/* Date Badge Box */}
                    <View style={styles.dateBox}>
                      <Text style={styles.dateBoxMonth}>{monthStr}</Text>
                      <Text style={styles.dateBoxDay}>{dayStr}</Text>
                    </View>

                    {/* Holiday Info */}
                    <View style={styles.holidayInfoCol}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <Text style={styles.holidayNameText}>{item.name}</Text>
                        <View style={[styles.typeBadgePill, { backgroundColor: meta.bg, borderColor: meta.border }]}>
                          <Text style={[styles.typeBadgeText, { color: meta.fg }]}>{meta.label}</Text>
                        </View>
                      </View>
                      <Text style={styles.holidayDescText} numberOfLines={2}>
                        {item.description || 'Statutory day off for all permanent and contractual hospital workforce.'}
                      </Text>
                    </View>

                    {/* Unit Applicability */}
                    <View style={styles.unitCol}>
                      <Text style={styles.colHeaderLabel}>Applicability</Text>
                      <View style={styles.unitPill}>
                        <Building2 size={11} color="#64748B" />
                        <Text style={styles.unitPillText}>All Hospital Units</Text>
                      </View>
                    </View>

                    {/* Date Details */}
                    <View style={styles.dateDetailCol}>
                      <Text style={styles.colHeaderLabel}>Date & Day</Text>
                      <Text style={styles.dateDetailText}>{formatDate(item.date)}</Text>
                    </View>

                    {/* Actions */}
                    {isHRorAdmin && (
                      <View style={styles.actionsCol}>
                        <TouchableOpacity
                          style={styles.editBtn}
                          onPress={() => handleOpenEdit(item)}
                          activeOpacity={0.8}
                        >
                          <Edit2 size={14} color="#0F172A" />
                          <Text style={styles.editBtnText}>Edit</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.deleteBtn}
                          onPress={() => handleDelete(item.id, item.name)}
                          activeOpacity={0.8}
                        >
                          <Trash2 size={14} color="#DC2626" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* ── Add / Edit Holiday Modal ────────────────────────────────────── */}
        <Modal
          visible={showAddModal}
          onClose={() => setShowAddModal(false)}
          title={editingHoliday ? 'Edit Holiday Schedule' : 'Create Holiday Event'}
          subtitle={`Annual calendar adjustment for ${tenantOrg?.name || 'Workspace'}`}
          icon={<CalendarDays size={20} color="#7C3AED" />}
          badge={{ text: 'CALENDAR SCHEDULER', variant: 'primary' }}
          size="md"
        >
          <View style={{ gap: 14 }}>
            {formError ? (
              <View style={styles.modalErrorBox}>
                <Text style={styles.modalErrorText}>{formError}</Text>
              </View>
            ) : null}

            <View>
              <Text style={styles.modalFieldLabel}>Holiday Name *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Gandhi Jayanti / Diwali / Foundation Day"
                placeholderTextColor="#94A3B8"
                value={formName}
                onChangeText={setFormName}
              />
            </View>

            <View>
              <Text style={styles.modalFieldLabel}>Holiday Date *</Text>
              <DatePicker
                label="Date"
                value={new Date(formDate)}
                onChange={(d) => setFormDate(d ? d.toISOString().split('T')[0] : formDate)}
              />
            </View>

            <View>
              <Text style={styles.modalFieldLabel}>Classification / Type</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                {HOLIDAY_TYPE_OPTIONS.map((opt) => {
                  const active = formType === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.typeSelectPill, active && styles.typeSelectPillActive]}
                      onPress={() => setFormType(opt.value)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.typeSelectText, active && styles.typeSelectTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View>
              <Text style={styles.modalFieldLabel}>Description or Notes (Optional)</Text>
              <TextInput
                style={[styles.modalInput, { minHeight: 70, textAlignVertical: 'top' }]}
                placeholder="Additional instructions or department exemptions..."
                placeholderTextColor="#94A3B8"
                value={formDescription}
                onChangeText={setFormDescription}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowAddModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSaveBtn, submitting && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={submitting}
                activeOpacity={0.85}
              >
                <Text style={styles.modalSaveBtnText}>
                  {submitting ? 'Saving...' : editingHoliday ? 'Update Holiday' : 'Create Holiday'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
  );

  if (!wrapInSidebar) {
    return <View style={{ flex: 1, backgroundColor: '#FAF9FD' }}>{content}</View>;
  }

  return (
    <SidebarLayout items={getNavForRole(profile?.role || 'hr', profile?.email)}>
      {content}
    </SidebarLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { padding: 24, paddingBottom: 64 },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 20,
  },
  breadcrumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  breadcrumbMuted: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  breadcrumbActive: {
    fontSize: 12,
    color: '#7C3AED',
    fontWeight: '700',
  },
  eyebrowChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#F3EEFE',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 6,
  },
  eyebrowText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#7C3AED',
    letterSpacing: 0.5,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  pageSubtitle: {
    fontSize: 13,
    marginTop: 4,
    maxWidth: 620,
    lineHeight: 19,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
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
  headerPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 9,
  },
  headerPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
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
    marginBottom: 10,
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

  viewModeTabs: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    gap: 4,
    flexWrap: 'wrap',
  },
  viewTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9,
  },
  viewTabBtnActive: {
    backgroundColor: '#F3EEFE',
  },
  viewTabBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748B',
  },
  viewTabBtnTextActive: {
    color: '#7C3AED',
    fontWeight: '700',
  },

  filterSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  searchBox: {
    flex: 1,
    minWidth: 240,
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
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
  },
  typeFilterPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  typeFilterPillActive: {
    backgroundColor: '#FAF5FF',
    borderColor: '#C084FC',
  },
  typeFilterPillText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
  },
  typeFilterPillTextActive: {
    color: '#7C3AED',
    fontWeight: '700',
  },
  unitPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 2,
  },
  unitFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  unitFilterPillActive: {
    backgroundColor: '#FAF5FF',
    borderColor: '#C084FC',
  },
  unitFilterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  unitFilterPillTextActive: {
    color: '#7C3AED',
    fontWeight: '700',
  },

  // Calendar Grid View styles
  calendarCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
  },
  calendarHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 12,
  },
  calendarMonthTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  calNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  todayBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  todayBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  weekdaysRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 8,
    marginBottom: 6,
  },
  weekdayCell: {
    width: '14.285%',
    alignItems: 'center',
  },
  weekdayText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCellEmpty: {
    width: '14.285%',
    height: 82,
  },
  dayCell: {
    width: '14.285%',
    minHeight: 82,
    padding: 6,
    borderWidth: 0.5,
    borderColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  dayCellToday: {
    backgroundColor: '#FAF5FF',
    borderColor: '#C084FC',
  },
  dayCellHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  dayNumText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
  dayNumTextToday: {
    color: '#7C3AED',
    fontWeight: '800',
  },
  holidayCountDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  holidayTagPill: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  holidayTagText: {
    fontSize: 9.5,
    fontWeight: '700',
  },

  // Chronological List View styles (Modern Cards matching Image 1)
  holidayCardModern: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
    gap: 12,
  },
  dateBox: {
    width: 48,
    height: 52,
    borderRadius: 10,
    backgroundColor: '#F3EEFE',
    borderWidth: 1,
    borderColor: '#E4DCFD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateBoxMonth: {
    fontSize: 10,
    fontWeight: '800',
    color: '#7C3AED',
  },
  dateBoxDay: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1E1B4B',
  },
  holidayInfoCol: {
    flex: 1,
    minWidth: 180,
  },
  holidayNameText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  holidayDescText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 3,
  },
  typeBadgePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  typeBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  unitCol: {
    width: 160,
  },
  colHeaderLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  unitPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  unitPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  dateDetailCol: {
    width: 140,
  },
  dateDetailText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
  actionsCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    backgroundColor: '#FFF5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Modal styles
  modalErrorBox: {
    backgroundColor: '#FEE2E2',
    padding: 10,
    borderRadius: 8,
  },
  modalErrorText: {
    color: '#DC2626',
    fontSize: 13,
  },
  modalFieldLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
  },
  typeSelectPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  typeSelectPillActive: {
    backgroundColor: '#FAF5FF',
    borderColor: '#C084FC',
  },
  typeSelectText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  typeSelectTextActive: {
    color: '#7C3AED',
    fontWeight: '700',
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  modalCancelBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#475569',
  },
  modalSaveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#7C3AED',
  },
  modalSaveBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 12.5,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },
});
