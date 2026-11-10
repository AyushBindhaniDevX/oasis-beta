import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  useWindowDimensions,
  TextInput,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/context/TenantContext';
import { useTheme } from '@/hooks/use-theme';
import { BorderRadius, NotionColors, Shadows } from '@/constants/theme';
import {
  CraftButton,
  CraftCard,
  Typography,
  T,
  S,
} from '@/components/ui/CraftKit';
import { Select } from '@/components/ui/Select';
import { DatePicker } from '@/components/ui/DatePicker';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/States';
import { getLeaveTypes, applyLeave } from '@/lib/services/leave';
import { getEmployeeByProfileId } from '@/lib/services/employee';
import { getWorkingDaysCount } from '@/lib/services/holidays';
import { getDaysBetween, formatDate } from '@/utils/format';
import type { LeaveType, Holiday } from '@/types';
import {
  Calendar,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  Plane,
  BriefcaseMedical,
  Coffee,
  Clock,
  Heart,
  Umbrella,
  Sunset,
  Sparkles,
  PartyPopper,
} from 'lucide-react-native';

const ICON_COLOR = NotionColors.primary;
const ICON_SIZE = 18;

function getLeaveIcon(name: string) {
  const n = name.toLowerCase();
  if (n.includes('annual') || n.includes('vacation') || n.includes('earned'))
    return <Plane size={ICON_SIZE} color={ICON_COLOR} />;
  if (n.includes('sick') || n.includes('medical'))
    return <BriefcaseMedical size={ICON_SIZE} color={ICON_COLOR} />;
  if (n.includes('casual') || n.includes('personal'))
    return <Coffee size={ICON_SIZE} color={ICON_COLOR} />;
  if (n.includes('maternity') || n.includes('paternity') || n.includes('parental'))
    return <Heart size={ICON_SIZE} color={ICON_COLOR} />;
  if (n.includes('compensat') || n.includes('comp off') || n.includes('on-call'))
    return <Clock size={ICON_SIZE} color={ICON_COLOR} />;
  if (n.includes('emergency') || n.includes('cme') || n.includes('academic'))
    return <Umbrella size={ICON_SIZE} color={ICON_COLOR} />;
  if (n.includes('unpaid') || n.includes('lwp'))
    return <Sunset size={ICON_SIZE} color={ICON_COLOR} />;
  return <Calendar size={ICON_SIZE} color={ICON_COLOR} />;
}

const stripEmoji = (str: string) =>
  str.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F]/gu, '').trim();

export default function ApplyLeaveScreen() {
  const colors = useTheme();
  const { profile } = useAuth();
  const { organization, employee: tenantEmp } = useTenant();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const activeOrgId = organization?.id || tenantEmp?.organization_id || profile?.organization_id;

  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [leaveTypeId, setLeaveTypeId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [reason, setReason] = useState('');
  const [isHalfDay, setIsHalfDay] = useState(false);

  // Dynamic Holiday & Working Days Calculation
  const [workingDays, setWorkingDays] = useState(0);
  const [holidayDays, setHolidayDays] = useState(0);
  const [holidaysInRange, setHolidaysInRange] = useState<Holiday[]>([]);

  useEffect(() => {
    (async () => {
      if (!profile) return;
      const orgId = activeOrgId;
      const [types, emp] = await Promise.all([
        getLeaveTypes(orgId),
        getEmployeeByProfileId(profile.id, orgId),
      ]);
      setLeaveTypes(types);
      if (types.length > 0) {
        setLeaveTypeId((prev) => (prev && types.some((t) => t.id === prev) ? prev : types[0].id));
      }
      const effectiveEmp = tenantEmp || emp;
      if (effectiveEmp) setEmployeeId(effectiveEmp.id);
      setLoading(false);
    })();
  }, [profile, activeOrgId, tenantEmp]);

  useEffect(() => {
    if (startDate && endDate && startDate <= endDate) {
      const sStr = startDate.toISOString().split('T')[0];
      const eStr = endDate.toISOString().split('T')[0];
      const orgId = profile?.organization_id;

      getWorkingDaysCount(sStr, eStr, orgId, isHalfDay)
        .then((res) => {
          setWorkingDays(res.workingDays);
          setHolidayDays(res.holidayDays);
          setHolidaysInRange(res.holidaysInRange);
        })
        .catch(() => {
          setWorkingDays(isHalfDay ? 0.5 : getDaysBetween(sStr, eStr));
        });
    } else {
      setWorkingDays(0);
      setHolidayDays(0);
      setHolidaysInRange([]);
    }
  }, [startDate, endDate, isHalfDay, profile]);

  const days = workingDays;

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!leaveTypeId) errs.leaveType = 'Please select a leave type';
    if (!startDate) errs.startDate = 'Start date is required';
    if (!endDate) errs.endDate = 'End date is required';
    if (startDate && endDate && endDate < startDate)
      errs.endDate = 'End date must be on or after start date';
    if (!reason.trim()) errs.reason = 'Please provide a reason for your leave';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setError('');
    setSubmitting(true);
    try {
      let resolvedEmpId = employeeId;
      if (!resolvedEmpId && profile?.id) {
        const emp = await getEmployeeByProfileId(profile.id, activeOrgId);
        if (emp?.id) {
          resolvedEmpId = emp.id;
          setEmployeeId(emp.id);
        }
      }

      await applyLeave({
        employee_id: resolvedEmpId,
        leave_type_id: leaveTypeId!,
        start_date: startDate!.toISOString().split('T')[0],
        end_date: endDate!.toISOString().split('T')[0],
        days,
        is_half_day: isHalfDay,
        reason: reason.trim(),
        organization_id: activeOrgId,
      });
      setSubmitted(true);
      setTimeout(() => {
        if (router.canGoBack()) router.back();
        else router.replace('/(employee)/leave' as never);
      }, 2000);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to submit leave request. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingState />;

  if (submitted) {
    return (
      <View style={[styles.successScreen, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.successCard,
            { backgroundColor: colors.surface, borderColor: '#e2e8f0' },
          ]}
        >
          <CheckCircle2 size={56} color="#006a61" />
          <Text style={[styles.successTitle, { color: colors.text }]}>
            Request Submitted!
          </Text>
          <Text style={[styles.successSub, { color: colors.textSecondary }]}>
            {days} day{days !== 1 ? 's' : ''} of leave pending approval from your manager.
          </Text>
        </View>
      </View>
    );
  }

  // Build options with icons
  const leaveOptions = leaveTypes.map((t) => ({
    label: stripEmoji(t.name),
    value: t.id,
    icon: getLeaveIcon(t.name),
  }));

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        isDesktop && styles.contentDesktop,
      ]}
      keyboardShouldPersistTaps="handled"
      bounces={false}
      showsVerticalScrollIndicator={false}
    >
      {/* Back */}
      <TouchableOpacity
        onPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/(employee)/leave' as never);
        }}
        style={styles.backBtn}
      >
        <ChevronLeft size={18} color={colors.textSecondary} />
        <Text style={[styles.backText, { color: colors.textSecondary }]}>
          Leave Management
        </Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <View style={styles.headerTextWrap}>
          <Text style={[styles.title, { color: colors.text }]}>Apply for Leave</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Fill in the details below to submit your request.
          </Text>
        </View>
        <View style={styles.headerAnimWrap}>
          <LottieView
            source={require('../../../../assets/lottie/wired-outline-1725-person-exit-hover-pinch.json')}
            autoPlay
            loop
            style={{ width: 64, height: 64 }}
          />
        </View>
      </View>

      <View
        style={[
          styles.formCard,
          { backgroundColor: colors.surface, borderColor: '#e2e8f0' },
        ]}
      >
        {/* Global Error */}
        {error ? (
          <View
            style={[
              styles.alertBox,
              { backgroundColor: colors.dangerLight, borderColor: colors.danger + '40' },
            ]}
          >
            <AlertCircle size={16} color={colors.danger} />
            <Text style={{ color: colors.danger, flex: 1, fontSize: 14 }}>{error}</Text>
          </View>
        ) : null}

        {/* Leave Type */}
        <Select
          label="Leave Type"
          placeholder="Choose a leave type..."
          options={leaveOptions}
          value={leaveTypeId}
          onValueChange={(v) => {
            setLeaveTypeId(v);
            setFieldErrors((prev) => ({ ...prev, leaveType: '' }));
          }}
          error={fieldErrors.leaveType}
        />

        {/* Dates */}
        <View style={isDesktop ? styles.dateRow : styles.dateStack}>
          <View style={isDesktop ? { flex: 1 } : {}}>
            <DatePicker
              label="Start Date"
              value={startDate}
              onChange={(d) => {
                setStartDate(d);
                setFieldErrors((prev) => ({ ...prev, startDate: '' }));
              }}
              error={fieldErrors.startDate}
              required
            />
          </View>
          <View style={isDesktop ? { flex: 1 } : {}}>
            <DatePicker
              label="End Date"
              value={endDate}
              minDate={startDate || undefined}
              onChange={(d) => {
                setEndDate(d);
                setFieldErrors((prev) => ({ ...prev, endDate: '' }));
              }}
              error={fieldErrors.endDate}
              required
            />
          </View>
        </View>

        {/* Half Day toggle */}
        <View
          style={[
            styles.switchRow,
            { borderColor: colors.border, backgroundColor: colors.backgroundElement || '#F8FAFC' },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>
              Half Day
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
              Applies for only half a working day
            </Text>
          </View>
          <Switch
            value={isHalfDay}
            onValueChange={setIsHalfDay}
            trackColor={{ true: colors.primary, false: '#CBD5E1' }}
            thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
            ios_backgroundColor="#CBD5E1"
          />
        </View>

        {/* Duration summary */}
        {days > 0 ? (
          <View style={{ gap: 8 }}>
            <View
              style={[
                styles.daysSummary,
                { backgroundColor: '#edf8f6', borderColor: '#c4ece7' },
              ]}
            >
              <Calendar size={16} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14 }}>
                {`${days} working day${days !== 1 ? 's' : ''} to be deducted${startDate && endDate ? `  ·  ${formatDate(startDate)} to ${formatDate(endDate)}` : ''}`}
              </Text>
            </View>

            {holidayDays > 0 ? (
              <View
                style={[
                  styles.daysSummary,
                  { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' },
                ]}
              >
                <PartyPopper size={16} color="#D97706" />
                <Text style={{ color: '#92400E', fontWeight: '600', fontSize: 13, flex: 1 }}>
                  {`Includes ${holidayDays} public holiday (${holidaysInRange.map((h) => h.name).join(', ')}) — automatically excluded from your leave quota!`}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Reason — plain TextInput for cross-platform reliability */}
        <View>
          <Text
            style={[
              styles.reasonLabel,
              { color: fieldErrors.reason ? colors.danger : colors.textSecondary },
            ]}
          >
            Reason
          </Text>
          <View
            style={[
              styles.reasonBox,
              {
                borderColor: fieldErrors.reason
                  ? colors.danger
                  : colors.border,
                backgroundColor: colors.surface,
              },
            ]}
          >
            <TextInput
              placeholder="Briefly describe the reason for your leave..."
              placeholderTextColor={colors.textSecondary}
              value={reason}
              onChangeText={(v) => {
                setReason(v);
                setFieldErrors((prev) => ({ ...prev, reason: '' }));
              }}
              multiline
              textAlignVertical="top"
              style={[styles.reasonInput, { color: colors.text }]}
            />
          </View>
          {fieldErrors.reason ? (
            <Text style={[styles.fieldError, { color: colors.danger }]}>
              {fieldErrors.reason}
            </Text>
          ) : null}
        </View>

        {/* Actions */}
        <View style={styles.formActions}>
          <CraftButton
            title="Cancel"
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/(employee)/leave' as never);
            }}
            variant="secondary"
            style={{ flex: 1 }}
          />
          <CraftButton
            title="Submit Request"
            onPress={handleSubmit}
            loading={submitting}
            variant="primary"
            style={{ flex: 2 }}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, gap: 24, paddingBottom: 110 },
  contentDesktop: {
    maxWidth: 720,
    alignSelf: 'center',
    width: '100%',
    padding: 40,
    gap: 32,
  },

  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  backText: { fontSize: 14, fontWeight: '500' },

  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerTextWrap: { flex: 1, gap: 4 },
  headerAnimWrap: {
    width: 64, height: 64,
    backgroundColor: '#F0F7F7',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 16,
  },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 15 },

  formCard: {
    padding: 28,
    borderRadius: 12,
    borderWidth: 1,
    gap: 20,
  },
  alertBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
  },

  dateRow: { flexDirection: 'row', gap: 16 },
  dateStack: { gap: 0 },

  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  daysSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
  fieldError: { fontSize: 12, marginTop: 4 },

  reasonLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  reasonBox: {
    borderWidth: 1,
    borderRadius: 8,
    minHeight: 110,
    padding: 12,
  },
  reasonInput: {
    fontSize: 15,
    flex: 1,
    minHeight: 90,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
  },

  formActions: { flexDirection: 'row', gap: 12, marginTop: 8 },

  successScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  successCard: {
    padding: 40,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    gap: 16,
    maxWidth: 460,
    width: '100%',
  },
  successTitle: { fontSize: 24, fontWeight: '700', textAlign: 'center' },
  successSub: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
});
