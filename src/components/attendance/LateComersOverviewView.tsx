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
  X,
  FileSpreadsheet,
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

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<LateComersOverviewData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeView, setActiveView] = useState<'incidents' | 'summary'>('incidents');
  const [selectedMonthOffset, setSelectedMonthOffset] = useState<number>(0); // 0 = current, -1 = last month
  const [exporting, setExporting] = useState(false);

  const targetDate = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + selectedMonthOffset);
    return { month: d.getMonth() + 1, year: d.getFullYear() };
  }, [selectedMonthOffset]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getLateComersOverview(organizationId, {
        month: targetDate.month,
        year: targetDate.year,
      });
      setData(res);
    } catch (err) {
      console.error('Failed to load late comers overview:', err);
    } finally {
      setLoading(false);
    }
  }, [organizationId, targetDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredIncidents = useMemo(() => {
    if (!data?.incidents) return [];
    if (!searchQuery.trim()) return data.incidents;
    const q = searchQuery.toLowerCase();
    return data.incidents.filter(
      (i) =>
        i.employeeName.toLowerCase().includes(q) ||
        i.employeeCode.toLowerCase().includes(q) ||
        i.department.toLowerCase().includes(q) ||
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
      await exportLateComersToExcel(data, activeView);
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Clock size={20} color="#006a61" />
            <Text style={[styles.title, { color: colors.text }]}>
              Late Comers Live Overview
            </Text>
            <Badge label="LIVE MONITOR" variant="accentLight" />
          </View>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Real-time punch inspection, 3-time monthly grace tracker, and 0.5 LOP penalty impact.
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
        {/* Month Selector & Controls */}
        <View style={[styles.controlBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Month buttons */}
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

          {/* View Mode Switcher */}
          <View style={styles.viewTabs}>
            <TouchableOpacity
              onPress={() => setActiveView('incidents')}
              style={[
                styles.viewTab,
                activeView === 'incidents' && { backgroundColor: '#e6f3f1', borderColor: '#006a61' },
              ]}
            >
              <Clock size={14} color={activeView === 'incidents' ? '#006a61' : colors.textSecondary} />
              <Text
                style={[
                  styles.viewTabText,
                  { color: activeView === 'incidents' ? '#006a61' : colors.textSecondary },
                  activeView === 'incidents' && { fontWeight: '700' },
                ]}
              >
                Punch Log ({data?.incidents.length || 0})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveView('summary')}
              style={[
                styles.viewTab,
                activeView === 'summary' && { backgroundColor: '#e6f3f1', borderColor: '#006a61' },
              ]}
            >
              <Users size={14} color={activeView === 'summary' ? '#006a61' : colors.textSecondary} />
              <Text
                style={[
                  styles.viewTabText,
                  { color: activeView === 'summary' ? '#006a61' : colors.textSecondary },
                  activeView === 'summary' && { fontWeight: '700' },
                ]}
              >
                Staff Summary ({data?.employeeSummaries.length || 0})
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 4 Metric Summary Cards */}
        <View style={styles.metricsGrid}>
          <Card style={styles.metricCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={styles.metricLabel}>Total Late Punches</Text>
              <View style={[styles.metricIconWrap, { backgroundColor: '#FEF3C7' }]}>
                <Clock size={16} color="#D97706" />
              </View>
            </View>
            <Text style={[styles.metricValue, { color: '#B45309' }]}>
              {summary.totalLatePunches}
            </Text>
            <Text style={styles.metricSub}>Recorded in {data?.periodLabel || 'period'}</Text>
          </Card>

          <Card style={styles.metricCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={styles.metricLabel}>Staff Members</Text>
              <View style={[styles.metricIconWrap, { backgroundColor: '#DBEAFE' }]}>
                <Users size={16} color="#2563EB" />
              </View>
            </View>
            <Text style={[styles.metricValue, { color: '#1D4ED8' }]}>
              {summary.uniqueStaffCount}
            </Text>
            <Text style={styles.metricSub}>With late punch marks</Text>
          </Card>

          <Card style={styles.metricCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={styles.metricLabel}>Grace Allowed (≤3)</Text>
              <View style={[styles.metricIconWrap, { backgroundColor: '#DCFCE7' }]}>
                <ShieldCheck size={16} color="#15803D" />
              </View>
            </View>
            <Text style={[styles.metricValue, { color: '#15803D' }]}>
              {summary.withinGraceCount}
            </Text>
            <Text style={styles.metricSub}>No salary deduction applied</Text>
          </Card>

          <Card style={styles.metricCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={styles.metricLabel}>0.5 LOP Penalties</Text>
              <View style={[styles.metricIconWrap, { backgroundColor: '#FEE2E2' }]}>
                <AlertTriangle size={16} color="#DC2626" />
              </View>
            </View>
            <Text style={[styles.metricValue, { color: '#B91C1C' }]}>
              {summary.lopPenaltiesCount}
            </Text>
            <Text style={styles.metricSub}>
              {summary.totalLopDaysDeducted.toFixed(1)} days deducted total
            </Text>
          </Card>
        </View>

        {/* Search & Export Toolbar */}
        <View style={styles.searchExportRow}>
          <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Search size={16} color={colors.textSecondary} />
            <TextInput
              placeholder="Filter by employee name, code, or department..."
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
            title={exporting ? 'Exporting...' : 'Export Excel'}
            icon={<FileSpreadsheet size={14} color="#FFF" />}
            onPress={handleExport}
            loading={exporting}
            size="sm"
            style={{ backgroundColor: '#006a61' }}
          />
        </View>

        {/* Table Content */}
        {loading ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#006a61" />
            <Text style={{ marginTop: 12, color: colors.textSecondary, fontSize: 14 }}>
              Loading late comers records...
            </Text>
          </View>
        ) : activeView === 'incidents' ? (
          <View style={[styles.tableContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* Table Header */}
            <View style={[styles.tableHeader, { backgroundColor: '#F8FAFC', borderBottomColor: colors.border }]}>
              <Text style={[styles.th, { width: 100 }]}>DATE</Text>
              <Text style={[styles.th, { flex: 1.5, minWidth: 160 }]}>STAFF MEMBER</Text>
              <Text style={[styles.th, { flex: 1, minWidth: 130 }]}>DEPARTMENT</Text>
              <Text style={[styles.th, { width: 90 }]}>SHIFT START</Text>
              <Text style={[styles.th, { width: 90 }]}>PUNCH IN</Text>
              <Text style={[styles.th, { width: 90 }]}>LATE BY</Text>
              <Text style={[styles.th, { width: 170 }]}>HOSPITAL POLICY STATUS</Text>
            </View>

            {filteredIncidents.length === 0 ? (
              <View style={{ padding: 32, alignItems: 'center' }}>
                <ShieldCheck size={36} color="#006a61" />
                <Text style={{ marginTop: 8, fontWeight: '600', color: colors.text }}>
                  No Late Punches Found
                </Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                  All employees punched in on time for this period.
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
                  <View style={{ width: 100 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{row.date}</Text>
                  </View>

                  <View style={{ flex: 1.5, minWidth: 160 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
                      {row.employeeName}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                      {row.employeeCode} • {row.designation}
                    </Text>
                  </View>

                  <View style={{ flex: 1, minWidth: 130 }}>
                    <Text style={{ fontSize: 13, color: colors.text }}>{row.department}</Text>
                  </View>

                  <View style={{ width: 90 }}>
                    <Text style={{ fontSize: 13, color: colors.textSecondary }}>{row.shiftStart}</Text>
                  </View>

                  <View style={{ width: 90 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#B45309' }}>
                      {row.actualPunchIn}
                    </Text>
                  </View>

                  <View style={{ width: 90 }}>
                    <Badge label={`+${row.lateMinutes}m`} variant="warning" />
                  </View>

                  <View style={{ width: 170 }}>
                    {row.isGrace ? (
                      <View style={[styles.policyBadge, { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' }]}>
                        <ShieldCheck size={12} color="#15803D" />
                        <Text style={[styles.policyBadgeText, { color: '#15803D' }]}>
                          Grace ({row.monthOccurrence}/3)
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
          /* Staff Summary View */
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
              <View style={{ padding: 32, alignItems: 'center' }}>
                <ShieldCheck size={36} color="#006a61" />
                <Text style={{ marginTop: 8, fontWeight: '600', color: colors.text }}>
                  No Late Staff Records Found
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
                      {Math.floor(row.totalLateMinutes / 60)}h {row.totalLateMinutes % 60}m
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
  controlBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
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
