import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { DatePicker } from '@/components/ui/DatePicker';
import {
  getLateComersOverview,
  exportLateComersToExcel,
  LateComersOverviewData,
} from '@/lib/services/lateAttendance';
import {
  Clock,
  Search,
  RefreshCw,
  Download,
  AlertTriangle,
  ShieldCheck,
  Users,
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  X,
  FileSpreadsheet,
  AlertCircle,
  Building2,
} from 'lucide-react-native';

interface LateComersOverviewViewProps {
  organizationId?: string;
  onClose?: () => void;
  isModal?: boolean;
}

export function LateComersOverviewView({
  organizationId,
  onClose,
  isModal = false,
}: LateComersOverviewViewProps) {
  const colors = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 860;

  // View Mode: 'daily' (default) or 'monthly'
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily');

  // Daily Mode State
  const getTodayStr = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const [selectedDate, setSelectedDate] = useState<string>(getTodayStr());

  // Monthly Mode State
  const [selectedMonthOffset, setSelectedMonthOffset] = useState<number>(0); // 0 = current, -1 = last month
  const [monthlyTab, setMonthlyTab] = useState<'incidents' | 'summary'>('incidents');

  // General State
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<LateComersOverviewData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [exporting, setExporting] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const targetMonthYear = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + selectedMonthOffset);
    return { month: d.getMonth() + 1, year: d.getFullYear() };
  }, [selectedMonthOffset]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (viewMode === 'daily') {
        const res = await getLateComersOverview(organizationId, {
          mode: 'daily',
          date: selectedDate,
        });
        setData(res);
      } else {
        const res = await getLateComersOverview(organizationId, {
          mode: 'monthly',
          month: targetMonthYear.month,
          year: targetMonthYear.year,
        });
        setData(res);
      }
    } catch (err) {
      console.error('Failed to load late comers overview:', err);
    } finally {
      setLoading(false);
    }
  }, [organizationId, viewMode, selectedDate, targetMonthYear]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Navigate day by offset (-1 for prev, +1 for next)
  const shiftDay = (days: number) => {
    try {
      const parts = selectedDate.split('-');
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      d.setDate(d.getDate() + days);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      setSelectedDate(`${y}-${m}-${day}`);
    } catch {
      setSelectedDate(getTodayStr());
    }
  };

  const isSelectedDateToday = useMemo(() => {
    return selectedDate === getTodayStr();
  }, [selectedDate]);

  const formattedSelectedDate = useMemo(() => {
    try {
      const parts = selectedDate.split('-');
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      return d.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  const filteredIncidents = useMemo(() => {
    if (!data?.incidents) return [];
    if (!searchQuery.trim()) return data.incidents;
    const q = searchQuery.toLowerCase();
    return data.incidents.filter(
      (i) =>
        i.employeeName.toLowerCase().includes(q) ||
        i.employeeCode.toLowerCase().includes(q) ||
        i.department.toLowerCase().includes(q) ||
        i.shiftName.toLowerCase().includes(q) ||
        i.date.includes(q)
    );
  }, [data?.incidents, searchQuery]);

  const filteredSummaries = useMemo(() => {
    if (!data?.employeeSummaries) return [];
    if (!searchQuery.trim()) return data.employeeSummaries;
    const q = searchQuery.toLowerCase();
    return data.employeeSummaries.filter(
      (s) =>
        s.employeeName.toLowerCase().includes(q) ||
        s.employeeCode.toLowerCase().includes(q) ||
        s.department.toLowerCase().includes(q)
    );
  }, [data?.employeeSummaries, searchQuery]);

  const handleExport = async () => {
    if (!data) return;
    setExporting(true);
    try {
      const exportType = viewMode === 'daily' ? 'daily' : monthlyTab;
      await exportLateComersToExcel(data, exportType);
    } catch (e) {
      console.error('Export error:', e);
    } finally {
      setExporting(false);
    }
  };

  const summary = data?.summary || {
    totalLatePunches: 0,
    uniqueStaffCount: 0,
    withinGraceCount: 0,
    lopPenaltiesCount: 0,
    totalLopDaysDeducted: 0,
    totalLateMinutes: 0,
  };

  const formatMinutesToHours = (totalMins: number) => {
    if (!totalMins) return '0m';
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
    if (hrs > 0) return `${hrs}h`;
    return `${mins}m`;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header */}
      <View
        style={[
          styles.headerRow,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Clock size={20} color="#006a61" />
            <Text style={[styles.title, { color: colors.text }]}>
              Late Comers Live Overview
            </Text>
            <Badge label={viewMode === 'daily' ? 'DAILY ROSTER VIEW' : 'MONTHLY AGGREGATE'} variant="accentLight" />
            {organizationId && (
              <View style={[styles.orgBadge, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '40' }]}>
                <Building2 size={12} color={colors.primary} />
                <Text style={[styles.orgBadgeText, { color: colors.primary }]}>
                  {organizationId === 'shanti-memorial-hospital' || organizationId === 'smh' ? 'SMH Hospital' : organizationId}
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {viewMode === 'daily'
              ? `Real-time punctuality monitor for ${formattedSelectedDate} with 3-time monthly grace tracking & 0.5 LOP penalty assessment.`
              : `Monthly summary of late punches, 3-time grace period consumption, and accumulated salary deduction impact.`}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Button
            title="Refresh"
            variant="outline"
            size="sm"
            icon={<RefreshCw size={13} color={colors.text} />}
            onPress={loadData}
          />
          {onClose && (
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Navigation & Mode Control Toolbar */}
        <View style={[styles.controlBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Main Mode Switcher: Daily View vs Monthly View */}
          <View style={styles.modeSwitcherWrap}>
            <TouchableOpacity
              onPress={() => setViewMode('daily')}
              style={[
                styles.modeBtn,
                viewMode === 'daily' && { backgroundColor: '#006a61', borderColor: '#006a61' },
              ]}
            >
              <CalendarDays size={14} color={viewMode === 'daily' ? '#FFFFFF' : colors.textSecondary} />
              <Text
                style={[
                  styles.modeBtnText,
                  { color: viewMode === 'daily' ? '#FFFFFF' : colors.textSecondary },
                  viewMode === 'daily' && { fontWeight: '700' },
                ]}
              >
                Daily View
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setViewMode('monthly')}
              style={[
                styles.modeBtn,
                viewMode === 'monthly' && { backgroundColor: '#006a61', borderColor: '#006a61' },
              ]}
            >
              <Calendar size={14} color={viewMode === 'monthly' ? '#FFFFFF' : colors.textSecondary} />
              <Text
                style={[
                  styles.modeBtnText,
                  { color: viewMode === 'monthly' ? '#FFFFFF' : colors.textSecondary },
                  viewMode === 'monthly' && { fontWeight: '700' },
                ]}
              >
                Monthly View
              </Text>
            </TouchableOpacity>
          </View>

          {/* Conditional Navigation Controls */}
          {viewMode === 'daily' ? (
            /* Daily Date Navigator */
            <View style={styles.dailyNavRow}>
              <TouchableOpacity
                onPress={() => shiftDay(-1)}
                style={[styles.navArrowBtn, { borderColor: colors.border }]}
              >
                <ChevronLeft size={16} color={colors.text} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                style={[styles.dateDisplayBtn, { borderColor: colors.border, backgroundColor: colors.background }]}
              >
                <Calendar size={14} color="#006a61" />
                <Text style={[styles.dateDisplayText, { color: colors.text }]}>
                  {formattedSelectedDate}
                </Text>
                {isSelectedDateToday && (
                  <View style={styles.todayPill}>
                    <Text style={styles.todayPillText}>TODAY</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => shiftDay(1)}
                style={[styles.navArrowBtn, { borderColor: colors.border }]}
              >
                <ChevronRight size={16} color={colors.text} />
              </TouchableOpacity>

              {!isSelectedDateToday && (
                <TouchableOpacity
                  onPress={() => setSelectedDate(getTodayStr())}
                  style={[styles.jumpTodayBtn, { backgroundColor: colors.primary + '15', borderColor: colors.primary }]}
                >
                  <Text style={[styles.jumpTodayText, { color: colors.primary }]}>Jump to Today</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            /* Monthly Controls */
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <View style={styles.monthPills}>
                <TouchableOpacity
                  onPress={() => setSelectedMonthOffset(-1)}
                  style={[
                    styles.monthBtn,
                    selectedMonthOffset === -1 && { backgroundColor: '#006a61', borderColor: '#006a61' },
                  ]}
                >
                  <Text
                    style={[
                      styles.monthBtnText,
                      { color: selectedMonthOffset === -1 ? '#FFFFFF' : colors.textSecondary },
                    ]}
                  >
                    Previous Month
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setSelectedMonthOffset(0)}
                  style={[
                    styles.monthBtn,
                    selectedMonthOffset === 0 && { backgroundColor: '#006a61', borderColor: '#006a61' },
                  ]}
                >
                  <Text
                    style={[
                      styles.monthBtnText,
                      { color: selectedMonthOffset === 0 ? '#FFFFFF' : colors.textSecondary },
                    ]}
                  >
                    Current Month ({data?.periodLabel || 'Active'})
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Monthly Sub-Tabs */}
              <View style={styles.viewTabs}>
                <TouchableOpacity
                  onPress={() => setMonthlyTab('incidents')}
                  style={[
                    styles.viewTab,
                    monthlyTab === 'incidents' && { backgroundColor: '#e6f3f1', borderColor: '#006a61' },
                  ]}
                >
                  <Clock size={13} color={monthlyTab === 'incidents' ? '#006a61' : colors.textSecondary} />
                  <Text
                    style={[
                      styles.viewTabText,
                      { color: monthlyTab === 'incidents' ? '#006a61' : colors.textSecondary },
                      monthlyTab === 'incidents' && { fontWeight: '700' },
                    ]}
                  >
                    Punch Log ({data?.incidents.length || 0})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setMonthlyTab('summary')}
                  style={[
                    styles.viewTab,
                    monthlyTab === 'summary' && { backgroundColor: '#e6f3f1', borderColor: '#006a61' },
                  ]}
                >
                  <Users size={13} color={monthlyTab === 'summary' ? '#006a61' : colors.textSecondary} />
                  <Text
                    style={[
                      styles.viewTabText,
                      { color: monthlyTab === 'summary' ? '#006a61' : colors.textSecondary },
                      monthlyTab === 'summary' && { fontWeight: '700' },
                    ]}
                  >
                    Staff Summary ({data?.employeeSummaries.length || 0})
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* DatePicker Dropdown / Selector when requested */}
        {showDatePicker && (
          <View style={[styles.datePickerWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ fontWeight: '700', color: colors.text, fontSize: 13 }}>Pick Specific Attendance Date</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <X size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <DatePicker
              value={selectedDate}
              onChange={(d: Date) => {
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                setSelectedDate(`${y}-${m}-${day}`);
                setShowDatePicker(false);
              }}
            />
          </View>
        )}

        {/* 4 Metric Summary Cards */}
        <View style={styles.metricsGrid}>
          <Card style={styles.metricCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={styles.metricLabel}>
                {viewMode === 'daily' ? 'Daily Late Arrivals' : 'Total Late Punches'}
              </Text>
              <View style={[styles.metricIconWrap, { backgroundColor: '#FEF3C7' }]}>
                <Clock size={16} color="#D97706" />
              </View>
            </View>
            <Text style={[styles.metricValue, { color: '#B45309' }]}>
              {summary.totalLatePunches}
            </Text>
            <Text style={styles.metricSub}>
              {viewMode === 'daily'
                ? `Logged on ${formattedSelectedDate}`
                : `Recorded in ${data?.periodLabel || 'period'}`}
            </Text>
          </Card>

          <Card style={styles.metricCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={styles.metricLabel}>
                {viewMode === 'daily' ? 'Grace Covered (≤3)' : 'Grace Allowed (≤3)'}
              </Text>
              <View style={[styles.metricIconWrap, { backgroundColor: '#DCFCE7' }]}>
                <ShieldCheck size={16} color="#15803D" />
              </View>
            </View>
            <Text style={[styles.metricValue, { color: '#15803D' }]}>
              {summary.withinGraceCount}
            </Text>
            <Text style={styles.metricSub}>0 LOP (No salary deduction)</Text>
          </Card>

          <Card style={styles.metricCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={styles.metricLabel}>
                {viewMode === 'daily' ? '0.5 LOP Penalties' : 'Total LOP Penalties'}
              </Text>
              <View style={[styles.metricIconWrap, { backgroundColor: '#FEE2E2' }]}>
                <AlertTriangle size={16} color="#DC2626" />
              </View>
            </View>
            <Text style={[styles.metricValue, { color: '#B91C1C' }]}>
              {summary.lopPenaltiesCount}
            </Text>
            <Text style={styles.metricSub}>
              {summary.totalLopDaysDeducted.toFixed(1)} days LOP salary penalty
            </Text>
          </Card>

          <Card style={styles.metricCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={styles.metricLabel}>
                {viewMode === 'daily' ? 'Total Delay Today' : 'Staff Members'}
              </Text>
              <View style={[styles.metricIconWrap, { backgroundColor: '#DBEAFE' }]}>
                {viewMode === 'daily' ? (
                  <Clock size={16} color="#2563EB" />
                ) : (
                  <Users size={16} color="#2563EB" />
                )}
              </View>
            </View>
            <Text style={[styles.metricValue, { color: '#1D4ED8' }]}>
              {viewMode === 'daily'
                ? formatMinutesToHours(summary.totalLateMinutes)
                : summary.uniqueStaffCount}
            </Text>
            <Text style={styles.metricSub}>
              {viewMode === 'daily'
                ? `Cumulative late minutes`
                : `With late punch marks`}
            </Text>
          </Card>
        </View>

        {/* Search & Export Toolbar */}
        <View style={styles.searchExportRow}>
          <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Search size={16} color={colors.textSecondary} />
            <TextInput
              placeholder="Search by staff name, code, department, shift..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={[styles.searchInput, { color: colors.text }]}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
                <X size={14} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          <Button
            title={exporting ? 'Exporting...' : viewMode === 'daily' ? 'Export Daily Excel' : 'Export Monthly Excel'}
            icon={<FileSpreadsheet size={14} color="#FFF" />}
            onPress={handleExport}
            loading={exporting}
            size="sm"
            style={{ backgroundColor: '#006a61' }}
          />
        </View>

        {/* Content Table */}
        {loading ? (
          <View style={{ padding: 48, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#006a61" />
            <Text style={{ marginTop: 12, color: colors.textSecondary, fontSize: 14 }}>
              Loading {viewMode === 'daily' ? 'daily' : 'monthly'} late arrival records...
            </Text>
          </View>
        ) : viewMode === 'daily' || monthlyTab === 'incidents' ? (
          /* Incident Table (Daily view or Monthly Punch Log) */
          <View style={[styles.tableContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* Table Header */}
            <View style={[styles.tableHeader, { backgroundColor: '#F8FAFC', borderBottomColor: colors.border }]}>
              {viewMode === 'monthly' && <Text style={[styles.th, { width: 95 }]}>DATE</Text>}
              <Text style={[styles.th, { flex: 1.6, minWidth: 160 }]}>STAFF MEMBER</Text>
              <Text style={[styles.th, { flex: 1.1, minWidth: 120 }]}>DEPARTMENT</Text>
              <Text style={[styles.th, { flex: 1.2, minWidth: 130 }]}>ASSIGNED SHIFT</Text>
              <Text style={[styles.th, { width: 90 }]}>PUNCH IN</Text>
              <Text style={[styles.th, { width: 85 }]}>LATE BY</Text>
              <Text style={[styles.th, { width: 110 }]}>MONTH OCCURRENCE</Text>
              <Text style={[styles.th, { width: 175 }]}>HOSPITAL POLICY STATUS</Text>
            </View>

            {filteredIncidents.length === 0 ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ShieldCheck size={42} color="#059669" />
                <Text style={{ marginTop: 10, fontWeight: '700', fontSize: 16, color: colors.text }}>
                  {viewMode === 'daily' ? `No Late Arrivals on ${formattedSelectedDate}` : 'No Late Punches Found'}
                </Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4, textAlign: 'center', maxWidth: 450 }}>
                  {viewMode === 'daily'
                    ? `All scheduled staff members checked in on time for this day. Punctuality standards fully observed.`
                    : 'No late attendance incidents recorded for this organization during the selected month.'}
                </Text>
              </View>
            ) : (
              filteredIncidents.map((row, idx) => (
                <View
                  key={row.id || `${row.employeeId}_${row.date}_${idx}`}
                  style={[
                    styles.tableRow,
                    { borderBottomColor: colors.border + '30' },
                    idx % 2 === 1 && { backgroundColor: '#FAFAFA' },
                  ]}
                >
                  {viewMode === 'monthly' && (
                    <View style={{ width: 95 }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text }}>{row.date}</Text>
                    </View>
                  )}

                  <View style={{ flex: 1.6, minWidth: 160, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Avatar name={row.employeeName} url={row.avatarUrl || undefined} size={32} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }} numberOfLines={1}>
                        {row.employeeName}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.textSecondary }} numberOfLines={1}>
                        {row.employeeCode} • {row.designation}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flex: 1.1, minWidth: 120 }}>
                    <Text style={{ fontSize: 12, color: colors.text }} numberOfLines={1}>
                      {row.department}
                    </Text>
                  </View>

                  <View style={{ flex: 1.2, minWidth: 130 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }} numberOfLines={1}>
                      {row.shiftName}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#64748B' }}>
                      Start: {row.shiftStart}
                    </Text>
                  </View>

                  <View style={{ width: 90 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#B45309' }}>
                      {row.actualPunchIn}
                    </Text>
                  </View>

                  <View style={{ width: 85 }}>
                    <Badge label={`+${row.lateMinutes}m`} variant="warning" />
                  </View>

                  <View style={{ width: 110 }}>
                    <View style={styles.countPill}>
                      <Text style={styles.countPillText}>
                        {row.monthOccurrence === 1
                          ? '1st time'
                          : row.monthOccurrence === 2
                          ? '2nd time'
                          : row.monthOccurrence === 3
                          ? '3rd time'
                          : `${row.monthOccurrence}th time`}
                      </Text>
                    </View>
                  </View>

                  <View style={{ width: 175 }}>
                    {row.isGrace ? (
                      <View style={[styles.policyBadge, { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' }]}>
                        <ShieldCheck size={12} color="#15803D" />
                        <Text style={[styles.policyBadgeText, { color: '#15803D' }]}>
                          Grace ({row.monthOccurrence}/3 Used)
                        </Text>
                      </View>
                    ) : (
                      <View style={[styles.policyBadge, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]}>
                        <AlertTriangle size={12} color="#B91C1C" />
                        <Text style={[styles.policyBadgeText, { color: '#B91C1C' }]}>
                          0.5 LOP Penalty ({row.monthOccurrence}th)
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>
        ) : (
          /* Staff Monthly Summary Table */
          <View style={[styles.tableContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* Table Header */}
            <View style={[styles.tableHeader, { backgroundColor: '#F8FAFC', borderBottomColor: colors.border }]}>
              <Text style={[styles.th, { flex: 1.6, minWidth: 160 }]}>STAFF MEMBER</Text>
              <Text style={[styles.th, { flex: 1.2, minWidth: 130 }]}>DEPARTMENT</Text>
              <Text style={[styles.th, { width: 100 }]}>TOTAL LATE</Text>
              <Text style={[styles.th, { width: 110 }]}>GRACE USED (≤3)</Text>
              <Text style={[styles.th, { width: 110 }]}>PENALTY DAYS (&gt;3)</Text>
              <Text style={[styles.th, { width: 130 }]}>SALARY LOP IMPACT</Text>
              <Text style={[styles.th, { width: 110 }]}>TOTAL DELAY</Text>
            </View>

            {filteredSummaries.length === 0 ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ShieldCheck size={42} color="#059669" />
                <Text style={{ marginTop: 10, fontWeight: '700', fontSize: 16, color: colors.text }}>
                  No Late Staff Records
                </Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
                  No employees accrued late punches during this calendar month.
                </Text>
              </View>
            ) : (
              filteredSummaries.map((row, idx) => (
                <View
                  key={row.employeeId || idx}
                  style={[
                    styles.tableRow,
                    { borderBottomColor: colors.border + '30' },
                    idx % 2 === 1 && { backgroundColor: '#FAFAFA' },
                  ]}
                >
                  <View style={{ flex: 1.6, minWidth: 160 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
                      {row.employeeName}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                      {row.employeeCode} • {row.designation}
                    </Text>
                  </View>

                  <View style={{ flex: 1.2, minWidth: 130 }}>
                    <Text style={{ fontSize: 13, color: colors.text }}>{row.department}</Text>
                  </View>

                  <View style={{ width: 100 }}>
                    <Badge label={`${row.totalLateDays} Days`} variant={row.totalLateDays > 3 ? 'danger' : 'warning'} />
                  </View>

                  <View style={{ width: 110 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#15803D' }}>
                      {row.graceUsedDays} / 3 Days
                    </Text>
                  </View>

                  <View style={{ width: 110 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: row.totalLateDays > 3 ? '#B91C1C' : colors.textSecondary }}>
                      {Math.max(0, row.totalLateDays - 3)} Days
                    </Text>
                  </View>

                  <View style={{ width: 130 }}>
                    {row.lopPenaltyDays > 0 ? (
                      <View style={[styles.policyBadge, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]}>
                        <AlertTriangle size={12} color="#B91C1C" />
                        <Text style={[styles.policyBadgeText, { color: '#B91C1C' }]}>
                          -{row.lopPenaltyDays} Day LOP
                        </Text>
                      </View>
                    ) : (
                      <View style={[styles.policyBadge, { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' }]}>
                        <ShieldCheck size={12} color="#15803D" />
                        <Text style={[styles.policyBadgeText, { color: '#15803D' }]}>
                          0 LOP (Grace)
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={{ width: 110 }}>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                      {formatMinutesToHours(row.totalLateMinutes)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  scrollContent: {
    padding: 18,
    gap: 16,
  },
  orgBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  orgBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  controlBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 12,
  },
  modeSwitcherWrap: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: '#F1F5F9',
    padding: 3,
    borderRadius: 8,
  },
  modeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  modeBtnText: {
    fontSize: 12,
    fontWeight: '500',
  },
  dailyNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  navArrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
  },
  dateDisplayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
  },
  dateDisplayText: {
    fontSize: 13,
    fontWeight: '700',
  },
  todayPill: {
    backgroundColor: '#006a61',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
  },
  todayPillText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },
  jumpTodayBtn: {
    paddingHorizontal: 10,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jumpTodayText: {
    fontSize: 11,
    fontWeight: '700',
  },
  datePickerWrap: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  monthPills: {
    flexDirection: 'row',
    gap: 8,
  },
  monthBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  monthBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  viewTabs: {
    flexDirection: 'row',
    gap: 8,
  },
  viewTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  viewTabText: {
    fontSize: 12,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    minWidth: 180,
    padding: 14,
    borderRadius: 10,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  metricIconWrap: {
    padding: 6,
    borderRadius: 8,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 8,
  },
  metricSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  searchExportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  tableContainer: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  th: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  countPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  countPillText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  policyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  policyBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
