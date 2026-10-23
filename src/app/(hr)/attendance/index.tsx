import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/context/TenantContext';
import { useTheme } from '@/hooks/use-theme';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { DatePicker } from '@/components/ui/DatePicker';
import { LoadingState } from '@/components/ui/States';
import { SidebarLayout } from '@/components/layout/Sidebar';
import { getOrgAttendance } from '@/lib/services/attendance';
import {
  getOrgRegularizations,
  reviewRegularization,
} from '@/lib/services/regularization';
import { formatTime, formatMinutes } from '@/utils/format';
import type { Attendance, AttendanceRegularization } from '@/types';
import {
  CalendarClock,
  Clock,
  CheckCircle2,
  XCircle,
  Globe,
  AlertCircle,
  RefreshCw,
} from 'lucide-react-native';
import { LateComersOverviewView } from '@/components/attendance/LateComersOverviewView';

export default function HRAttendanceScreen() {
  const colors = useTheme();
  const { profile } = useAuth();
  const { organization: tenantOrg } = useTenant();

  const [activeTab, setActiveTab] = useState<'logs' | 'regularizations' | 'late_overview'>('logs');

  // Daily Logs state
  const [date, setDate] = useState<Date>(new Date());
  const [records, setRecords] = useState<Attendance[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  // Regularization state
  const [regularizations, setRegularizations] = useState<AttendanceRegularization[]>([]);
  const [loadingRegs, setLoadingRegs] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const orgId = tenantOrg?.id || profile?.organization_id;

  const loadLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const data = await getOrgAttendance(date.toISOString().split('T')[0], orgId);
      setRecords(data);
    } catch (e) {
      console.error('HR logs error:', e);
    } finally {
      setLoadingLogs(false);
    }
  }, [date, orgId]);

  const loadRegularizations = useCallback(async () => {
    setLoadingRegs(true);
    setActionError('');
    try {
      const data = await getOrgRegularizations(orgId);
      setRegularizations(data);
    } catch (e) {
      console.error('HR regularizations load error:', e);
    } finally {
      setLoadingRegs(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (activeTab === 'logs') {
      loadLogs();
    } else {
      loadRegularizations();
    }
  }, [activeTab, loadLogs, loadRegularizations]);

  const handleReview = async (id: string, action: 'approved' | 'rejected') => {
    setActionLoadingId(id);
    setActionError('');
    try {
      await reviewRegularization(
        id,
        action === 'approved' ? 'approve' : 'reject',
        profile?.full_name || profile?.email || 'HR Administrator',
        action === 'approved' ? 'Approved by HR' : 'Rejected by HR'
      );
      await loadRegularizations();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Review action failed.';
      setActionError(msg);
      if (Platform.OS !== 'web') {
        Alert.alert('Error', msg);
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const statusVariant = (s: string) => {
    const map: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
      present: 'success',
      late: 'warning',
      half_day: 'warning',
      absent: 'danger',
    };
    return map[s] || 'neutral';
  };

  const regStatusVariant = (s: string) => {
    if (s === 'approved') return 'success';
    if (s === 'pending') return 'warning';
    if (s === 'rejected' || s === 'cancelled') return 'danger';
    return 'neutral';
  };

  const pendingCount = regularizations.filter((r) => r.status === 'pending').length;

  return (
    <SidebarLayout>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Top Header */}
        <View style={[styles.topBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>Attendance & Shifts</Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
              Monitor daily punches, office geofence compliance, and employee regularization requests.
            </Text>
          </View>

          {/* Tab Switcher */}
          <View style={styles.tabRow}>
            <TouchableOpacity
              onPress={() => setActiveTab('logs')}
              style={[
                styles.tabBtn,
                activeTab === 'logs' && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  { color: activeTab === 'logs' ? '#FFFFFF' : colors.textSecondary },
                ]}
              >
                Daily Logs
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab('regularizations')}
              style={[
                styles.tabBtn,
                activeTab === 'regularizations' && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text
                  style={[
                    styles.tabBtnText,
                    { color: activeTab === 'regularizations' ? '#FFFFFF' : colors.textSecondary },
                  ]}
                >
                  Regularizations
                </Text>
                {pendingCount > 0 && (
                  <View
                    style={[
                      styles.countBadge,
                      { backgroundColor: activeTab === 'regularizations' ? '#FFFFFF' : '#EF4444' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.countBadgeText,
                        { color: activeTab === 'regularizations' ? colors.primary : '#FFFFFF' },
                      ]}
                    >
                      {pendingCount}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab('late_overview')}
              style={[
                styles.tabBtn,
                activeTab === 'late_overview' && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  { color: activeTab === 'late_overview' ? '#FFFFFF' : colors.textSecondary },
                ]}
              >
                Late Comers Overview
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {actionError ? (
          <View style={[styles.errorBox, { backgroundColor: colors.dangerLight }]}>
            <AlertCircle size={16} color={colors.danger} />
            <Text style={{ color: colors.danger, fontSize: 13, flex: 1 }}>{actionError}</Text>
          </View>
        ) : null}

        {activeTab === 'late_overview' ? (
          <LateComersOverviewView organizationId={orgId} />
        ) : activeTab === 'logs' ? (
          <>
            <View style={{ padding: 16 }}>
              <DatePicker label="Select Attendance Date" value={date} onChange={setDate} />
            </View>

            {loadingLogs ? (
              <LoadingState />
            ) : (
              <FlatList
                data={records}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 8 }}
                ListEmptyComponent={
                  <View style={styles.emptyWrap}>
                    <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
                      No attendance records found for this date.
                    </Text>
                  </View>
                }
                renderItem={({ item }) => {
                  const emp = item.employee as any;
                  return (
                    <Card style={styles.row}>
                      <Avatar name={emp?.profile?.full_name || ''} size={38} />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[{ color: colors.text, fontWeight: '700', fontSize: 14 }]}>
                            {emp?.profile?.full_name || 'Employee'}
                          </Text>
                          {item.is_remote && (
                            <View style={styles.remotePill}>
                              <Globe size={10} color="#0284C7" />
                              <Text style={styles.remotePillText}>Remote</Text>
                            </View>
                          )}
                        </View>
                        <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                          {item.clock_in ? formatTime(item.clock_in) : '--'} —{' '}
                          {item.clock_out ? formatTime(item.clock_out) : '--'}
                          {' · '}
                          {formatMinutes(item.working_minutes)} worked
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <Badge label={item.status} variant={statusVariant(item.status)} />
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                          {item.clock_in_verified ? (
                            <CheckCircle2 size={12} color={colors.success} />
                          ) : (
                            <XCircle size={12} color={colors.danger} />
                          )}
                          <Text
                            style={{
                              color: item.clock_in_verified ? colors.success : colors.danger,
                              fontSize: 11,
                              fontWeight: '600',
                            }}
                          >
                            {item.clock_in_verified ? 'Verified' : 'Unverified'}
                          </Text>
                        </View>
                      </View>
                    </Card>
                  );
                }}
              />
            )}
          </>
        ) : (
          /* Regularization Requests Queue */
          <View style={{ flex: 1, padding: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
                Attendance Regularization Requests ({regularizations.length})
              </Text>
              <TouchableOpacity onPress={loadRegularizations} style={styles.refreshBtn}>
                <RefreshCw size={14} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>Refresh</Text>
              </TouchableOpacity>
            </View>

            {loadingRegs ? (
              <LoadingState />
            ) : (
              <FlatList
                data={regularizations}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingBottom: 40, gap: 12 }}
                ListEmptyComponent={
                  <View style={styles.emptyWrap}>
                    <CalendarClock size={36} color="#94A3B8" />
                    <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 8 }}>
                      No regularization requests pending.
                    </Text>
                  </View>
                }
                renderItem={({ item }) => {
                  const emp = item.employee as any;
                  const isPending = item.status === 'pending';
                  const isBusy = actionLoadingId === item.id;

                  return (
                    <Card style={[styles.regCard, { borderColor: colors.border }]}>
                      <View style={styles.regHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <Avatar name={emp?.profile?.full_name || ''} size={36} />
                          <View>
                            <Text style={{ fontWeight: '700', fontSize: 14, color: colors.text }}>
                              {emp?.profile?.full_name || 'Employee'}
                            </Text>
                            <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                              Date: <Text style={{ fontWeight: '700', color: colors.text }}>{item.date}</Text>
                            </Text>
                          </View>
                        </View>
                        <Badge label={String(item.status || 'pending').toUpperCase()} variant={regStatusVariant(item.status)} />
                      </View>

                      {/* Reason & requested corrections */}
                      <View style={[styles.regBody, { backgroundColor: colors.surface }]}>
                        <Text style={{ fontSize: 13, color: colors.text, fontWeight: '500' }}>
                          Reason: <Text style={{ fontWeight: '400', color: colors.textSecondary }}>"{item.reason}"</Text>
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap', marginTop: 4 }}>
                          {item.requested_clock_in && (
                            <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                              Clock In: <Text style={{ fontWeight: '700', color: colors.text }}>{formatTime(item.requested_clock_in)}</Text>
                            </Text>
                          )}
                          {item.requested_clock_out && (
                            <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                              Clock Out: <Text style={{ fontWeight: '700', color: colors.text }}>{formatTime(item.requested_clock_out)}</Text>
                            </Text>
                          )}
                          {item.requested_status && (
                            <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                              Status: <Text style={{ fontWeight: '700', color: colors.text }}>{item.requested_status}</Text>
                            </Text>
                          )}
                        </View>
                      </View>

                      {/* Review details if not pending */}
                      {!isPending && item.reviewed_by && (
                        <Text style={{ fontSize: 11, color: colors.textSecondary, fontStyle: 'italic', marginTop: 4 }}>
                          Reviewed by {item.reviewed_by} on {item.reviewed_at ? new Date(item.reviewed_at).toLocaleDateString() : ''}
                        </Text>
                      )}

                      {/* Action buttons for pending requests */}
                      {isPending && (
                        <View style={styles.regActions}>
                          <TouchableOpacity
                            style={[styles.regActionBtn, { backgroundColor: '#059669' }, isBusy && { opacity: 0.6 }]}
                            onPress={() => handleReview(item.id, 'approved')}
                            disabled={isBusy}
                          >
                            <CheckCircle2 size={14} color="#FFF" />
                            <Text style={styles.regActionBtnText}>
                              {isBusy ? 'Processing...' : 'Approve'}
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.regActionBtn, { backgroundColor: '#DC2626' }, isBusy && { opacity: 0.6 }]}
                            onPress={() => handleReview(item.id, 'rejected')}
                            disabled={isBusy}
                          >
                            <XCircle size={14} color="#FFF" />
                            <Text style={styles.regActionBtnText}>
                              {isBusy ? 'Processing...' : 'Reject'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </Card>
                  );
                }}
              />
            )}
          </View>
        )}
      </View>
    </SidebarLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    padding: 18,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  title: { fontSize: 20, fontWeight: '800' },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  errorBox: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  remotePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  remotePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284C7',
  },
  emptyWrap: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#EDF8F6',
  },
  regCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  regHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  regBody: {
    padding: 10,
    borderRadius: 8,
    gap: 4,
  },
  regActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 6,
  },
  regActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  regActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
