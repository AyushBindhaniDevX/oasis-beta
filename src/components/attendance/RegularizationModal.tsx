import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { X, CalendarClock, AlertCircle, CheckCircle2, Trash2, History } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';
import { DatePicker } from '@/components/ui/DatePicker';
import { Badge } from '@/components/ui/Badge';
import {
  getMyRegularizations,
  submitRegularization,
  cancelRegularization,
} from '@/lib/services/regularization';
import type { AttendanceRegularization, AttendanceStatus } from '@/types';

interface RegularizationModalProps {
  visible: boolean;
  onClose: () => void;
  employeeId: string;
  /** Optional day to prefill (e.g. tapping a specific attendance row). */
  defaultDate?: string | null;
  /** Called after a request is submitted (so the parent can refresh). */
  onSubmitted?: () => void;
}

type StatusChoice = 'keep' | AttendanceStatus;

const STATUS_CHOICES: { value: StatusChoice; label: string }[] = [
  { value: 'keep', label: 'No change' },
  { value: 'present', label: 'Present' },
  { value: 'late', label: 'Late' },
  { value: 'half_day', label: 'Half Day' },
];

/** Build an ISO timestamp from a calendar day + "HH:MM" (24h). Returns null if blank/invalid. */
function buildIso(day: Date, hhmm: string): string | null | 'invalid' {
  const t = hhmm.trim();
  if (!t) return null;
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return 'invalid';
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return 'invalid';
  const d = new Date(day);
  d.setHours(h, min, 0, 0);
  return d.toISOString();
}

function statusVariant(s: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (s === 'approved') return 'success';
  if (s === 'pending') return 'warning';
  if (s === 'rejected' || s === 'cancelled') return 'danger';
  return 'neutral';
}

export function RegularizationModal({
  visible,
  onClose,
  employeeId,
  defaultDate,
  onSubmitted,
}: RegularizationModalProps) {
  const colors = useTheme();
  const insets = useSafeAreaInsets();

  const [requests, setRequests] = useState<AttendanceRegularization[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const [date, setDate] = useState<Date | null>(defaultDate ? new Date(defaultDate) : new Date());
  const [clockIn, setClockIn] = useState('');
  const [clockOut, setClockOut] = useState('');
  const [status, setStatus] = useState<StatusChoice>('keep');
  const [reason, setReason] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadList = useCallback(async () => {
    if (!employeeId) return;
    setLoadingList(true);
    try {
      const data = await getMyRegularizations(employeeId);
      setRequests(data);
    } finally {
      setLoadingList(false);
    }
  }, [employeeId]);

  useEffect(() => {
    if (visible) {
      setError('');
      setSuccess('');
      setDate(defaultDate ? new Date(defaultDate) : new Date());
      loadList();
    }
  }, [visible, defaultDate, loadList]);

  const resetForm = () => {
    setClockIn('');
    setClockOut('');
    setStatus('keep');
    setReason('');
  };

  const handleSubmit = async () => {
    setError('');
    setSuccess('');

    if (!date) {
      setError('Please select the date to regularize.');
      return;
    }
    if (!reason.trim()) {
      setError('Please provide a reason for this regularization.');
      return;
    }

    const inIso = buildIso(date, clockIn);
    const outIso = buildIso(date, clockOut);
    if (inIso === 'invalid' || outIso === 'invalid') {
      setError('Please enter times as HH:MM in 24-hour format (e.g. 09:30).');
      return;
    }

    const requestedStatus = status === 'keep' ? null : status;
    if (!inIso && !outIso && !requestedStatus) {
      setError('Add a corrected clock-in, clock-out, or status so there is something to change.');
      return;
    }

    setSubmitting(true);
    try {
      await submitRegularization({
        employee_id: employeeId,
        date: date.toISOString().split('T')[0],
        requested_clock_in: inIso as string | null,
        requested_clock_out: outIso as string | null,
        requested_status: requestedStatus,
        reason: reason.trim(),
      });
      setSuccess('Your regularization request was submitted for approval.');
      resetForm();
      await loadList();
      onSubmitted?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not submit your request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await cancelRegularization(id);
      await loadList();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not cancel this request.');
    }
  };

  const fmtDate = (s: string) => {
    try {
      return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return s;
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, 16) }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View style={[styles.headerIcon, { backgroundColor: colors.primaryLight }]}>
                <CalendarClock size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: colors.text }]}>Regularize Attendance</Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  Request a correction for a missed or wrong punch
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={8}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ maxHeight: 520 }}
            contentContainerStyle={{ padding: 18, gap: 16, paddingBottom: Math.max(insets.bottom, 16) + 24 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Alerts */}
            {error ? (
              <View style={[styles.alert, { backgroundColor: colors.dangerLight, borderColor: colors.danger + '40' }]}>
                <AlertCircle size={16} color={colors.danger} />
                <Text style={{ color: colors.danger, flex: 1, fontSize: 13 }}>{error}</Text>
              </View>
            ) : null}
            {success ? (
              <View style={[styles.alert, { backgroundColor: colors.primaryLight, borderColor: colors.primary + '40' }]}>
                <CheckCircle2 size={16} color={colors.primary} />
                <Text style={{ color: colors.primary, flex: 1, fontSize: 13 }}>{success}</Text>
              </View>
            ) : null}

            {/* Monthly Policy Tracker (Hospital 5-times per month rule) */}
            {(() => {
              const monthKey = date ? date.toISOString().slice(0, 7) : new Date().toISOString().slice(0, 7);
              const usedThisMonth = requests.filter(
                (r) => (r.date || r.created_at || '').slice(0, 7) === monthKey && r.status !== 'cancelled'
              ).length;
              const remaining = Math.max(0, 5 - usedThisMonth);
              const isBlocked = usedThisMonth >= 5;

              return (
                <View
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    borderWidth: 1,
                    backgroundColor: isBlocked ? '#FEF2F2' : '#F0FDFA',
                    borderColor: isBlocked ? '#FCA5A5' : '#99F6E4',
                    gap: 3,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: isBlocked ? '#DC2626' : '#0F766E' }}>
                      Monthly Quota: {usedThisMonth} / 5 Used
                    </Text>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: isBlocked ? '#B91C1C' : '#0D9488' }}>
                      {remaining} remaining for {monthKey}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {isBlocked && <AlertCircle size={14} color="#991B1B" />}
                    <Text style={{ fontSize: 11, color: isBlocked ? '#991B1B' : '#115E59', flex: 1 }}>
                      {isBlocked
                        ? 'Maximum 5 regularizations per month policy reached. Contact HR for administrative assistance.'
                        : 'Hospital Policy: Employees may regularize missed punches a maximum of 5 times per month.'}
                    </Text>
                  </View>
                </View>
              );
            })()}

            {/* Date */}
            <DatePicker label="Date to Regularize" value={date} onChange={setDate} />

            {/* Times */}
            <View style={styles.timeRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Corrected Clock In</Text>
                <TextInput
                  placeholder="09:30"
                  placeholderTextColor={colors.textSecondary}
                  value={clockIn}
                  onChangeText={setClockIn}
                  keyboardType="numbers-and-punctuation"
                  style={[styles.input, { borderColor: colors.border, color: colors.text }]}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Corrected Clock Out</Text>
                <TextInput
                  placeholder="18:30"
                  placeholderTextColor={colors.textSecondary}
                  value={clockOut}
                  onChangeText={setClockOut}
                  keyboardType="numbers-and-punctuation"
                  style={[styles.input, { borderColor: colors.border, color: colors.text }]}
                />
              </View>
            </View>
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              Use 24-hour HH:MM. Leave a field blank to keep the existing time.
            </Text>

            {/* Status */}
            <View>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Corrected Status</Text>
              <View style={styles.pillRow}>
                {STATUS_CHOICES.map((c) => {
                  const active = status === c.value;
                  return (
                    <TouchableOpacity
                      key={c.value}
                      onPress={() => setStatus(c.value)}
                      style={[
                        styles.pill,
                        { borderColor: colors.border },
                        active && { backgroundColor: colors.primary, borderColor: colors.primary },
                      ]}
                    >
                      <Text style={[styles.pillText, { color: active ? '#FFFFFF' : colors.textSecondary }]}>
                        {c.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Reason */}
            <View>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Reason</Text>
              <View style={[styles.reasonBox, { borderColor: colors.border }]}>
                <TextInput
                  placeholder="Explain why this correction is needed..."
                  placeholderTextColor={colors.textSecondary}
                  value={reason}
                  onChangeText={setReason}
                  multiline
                  textAlignVertical="top"
                  style={[styles.reasonInput, { color: colors.text }]}
                />
              </View>
            </View>

            {/* Submit */}
            {(() => {
              const monthKey = date ? date.toISOString().slice(0, 7) : new Date().toISOString().slice(0, 7);
              const usedThisMonth = requests.filter(
                (r) => (r.date || r.created_at || '').slice(0, 7) === monthKey && r.status !== 'cancelled'
              ).length;
              const isBlocked = usedThisMonth >= 5;

              return (
                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={submitting || isBlocked}
                  activeOpacity={0.85}
                  style={[
                    styles.submitBtn,
                    { backgroundColor: isBlocked ? colors.border : colors.primary },
                    (submitting || isBlocked) && { opacity: 0.7 },
                  ]}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={[styles.submitText, isBlocked && { color: colors.textSecondary }]}>
                      {isBlocked ? 'Limit Reached (5/5 this month)' : 'Submit Request'}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })()}

            {/* My requests */}
            <View style={{ marginTop: 4, gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <History size={15} color={colors.textSecondary} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>My Requests</Text>
              </View>

              {loadingList ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 12 }} />
              ) : requests.length === 0 ? (
                <Text style={{ color: colors.textSecondary, fontSize: 13, paddingVertical: 8 }}>
                  You have no regularization requests yet.
                </Text>
              ) : (
                requests.map((r) => (
                  <View key={r.id} style={[styles.reqRow, { borderColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.reqDate, { color: colors.text }]}>{fmtDate(r.date)}</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 12 }} numberOfLines={1}>
                        {r.reason}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      <Badge label={r.status.toUpperCase()} variant={statusVariant(r.status)} />
                      {r.status === 'pending' ? (
                        <TouchableOpacity
                          onPress={() => handleCancel(r.id)}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
                          hitSlop={6}
                        >
                          <Trash2 size={12} color={colors.danger} />
                          <Text style={{ color: colors.danger, fontSize: 11, fontWeight: '600' }}>Cancel</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? { maxHeight: '90vh' as any } : {}),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    borderBottomWidth: 1,
  },
  headerIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '800' },
  subtitle: { fontSize: 12, marginTop: 1 },
  closeBtn: { padding: 4 },

  alert: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, borderWidth: 1 },

  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 6 },
  timeRow: { flexDirection: 'row', gap: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  hint: { fontSize: 11, marginTop: -8 },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  pillText: { fontSize: 12, fontWeight: '700' },

  reasonBox: { borderWidth: 1, borderRadius: 10, minHeight: 88, padding: 10 },
  reasonInput: {
    fontSize: 15,
    minHeight: 68,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },

  submitBtn: { borderRadius: 12, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },

  sectionTitle: { fontSize: 14, fontWeight: '800' },
  reqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderRadius: 12,
  },
  reqDate: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
});
