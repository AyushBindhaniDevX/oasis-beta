import { SidebarLayout } from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { InteractiveTile } from '@/components/ui/InteractiveTile';
import { Select } from '@/components/ui/Select';
import { LoadingState } from '@/components/ui/States';
import { TimePicker } from '@/components/ui/TimePicker';
import { ADMIN_NAV } from '@/constants/navigation';
import {
  STOCK_12_SVG,
  STOCK_6_SVG,
  STOCK_7_SVG,
  STOCK_9_SVG,
} from '@/constants/workManagementSvgs';
import { useTenant } from '@/context/TenantContext';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/useAuth';
import { useBiometrics } from '@/hooks/useBiometrics';
import { createAuditLog } from '@/lib/services/audit';
import { getOrganization, updateOrganization } from '@/lib/services/organization';
import type { Organization } from '@/types';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock,
  Coins,
  Globe,
  Radio,
  Save,
  Sparkles
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useWindowDimensions,
  View
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Svg, { Path, SvgXml } from 'react-native-svg';

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

export default function SettingsScreen() {
  const colors = useTheme();
  const { profile } = useAuth();
  const { organization: tenantOrg } = useTenant();
  const { isEnabled: biometricEnabled } = useBiometrics();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form Fields
  const [orgName, setOrgName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [workStart, setWorkStart] = useState('09:00');
  const [workEnd, setWorkEnd] = useState('18:00');
  const [defaultRadius, setDefaultRadius] = useState('150');
  const [currency, setCurrency] = useState('INR');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [leaveCycle, setLeaveCycle] = useState('calendar');
  const [autoWelcomeEmail, setAutoWelcomeEmail] = useState(true);
  const [autoApproveExpense, setAutoApproveExpense] = useState(false);
  const [expenseThreshold, setExpenseThreshold] = useState('1000');

  // PF / EPF Settings
  const [enablePf, setEnablePf] = useState(false);
  const [empContribution, setEmpContribution] = useState('12');
  const [emprContribution, setEmprContribution] = useState('8.3');

  // Late Attendance Settings
  const [enableLatePolicy, setEnableLatePolicy] = useState(false);
  const [consecutiveLateDays, setConsecutiveLateDays] = useState('3');
  const [lateDeductionAmount, setLateDeductionAmount] = useState('500');
  const [lateApprovalRequired, setLateApprovalRequired] = useState(true);

  // Notification Settings
  const [enableCompanyAnnouncements, setEnableCompanyAnnouncements] = useState(true);
  const [enableBirthdayNotifications, setEnableBirthdayNotifications] = useState(true);

  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      if (!profile?.organization_id) return;
      try {
        const data = await getOrganization(profile.organization_id);
        if (data) {
          setOrg(data);
          setOrgName(data.name || '');
          const s = (data.settings as Record<string, any>) || {};
          if (s.working_hours_start) setWorkStart(s.working_hours_start);
          if (s.working_hours_end) setWorkEnd(s.working_hours_end);
          if (s.default_radius_meters) setDefaultRadius(String(s.default_radius_meters));
          if (s.contact_email) setContactEmail(s.contact_email);
          if (s.contact_phone) setContactPhone(s.contact_phone);
          if (s.currency) setCurrency(s.currency);
          if (s.timezone) setTimezone(s.timezone);
          if (s.leave_cycle) setLeaveCycle(s.leave_cycle);
          if (typeof s.auto_welcome_email === 'boolean') setAutoWelcomeEmail(s.auto_welcome_email);
          if (typeof s.auto_approve_expense === 'boolean') setAutoApproveExpense(s.auto_approve_expense);
          if (s.expense_threshold) setExpenseThreshold(String(s.expense_threshold));

          // PF / EPF
          if (typeof s.enable_pf === 'boolean') setEnablePf(s.enable_pf);
          if (s.employee_contribution_percent) setEmpContribution(String(s.employee_contribution_percent));
          if (s.employer_contribution_percent) setEmprContribution(String(s.employer_contribution_percent));

          // Late Attendance
          if (typeof s.enable_late_policy === 'boolean') setEnableLatePolicy(s.enable_late_policy);
          if (s.consecutive_late_days) setConsecutiveLateDays(String(s.consecutive_late_days));
          if (s.late_deduction_amount) setLateDeductionAmount(String(s.late_deduction_amount));
          if (typeof s.late_approval_required === 'boolean') setLateApprovalRequired(s.late_approval_required);

          // Notifications
          if (typeof s.enable_company_announcements === 'boolean') setEnableCompanyAnnouncements(s.enable_company_announcements);
          if (typeof s.enable_birthday_notifications === 'boolean') setEnableBirthdayNotifications(s.enable_birthday_notifications);
        }
      } catch (err) {
        console.error('Error fetching org settings:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [profile]);

  const handleSave = async () => {
    if (!org) return;
    if (!orgName.trim()) {
      setError('Organization name is required');
      return;
    }
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      await updateOrganization(org.id, {
        name: orgName.trim(),
        settings: {
          ...((org.settings as Record<string, any>) || {}),
          working_hours_start: workStart,
          working_hours_end: workEnd,
          default_radius_meters: parseInt(defaultRadius, 10) || 150,
          contact_email: contactEmail.trim(),
          contact_phone: contactPhone.trim(),
          currency,
          timezone,
          leave_cycle: leaveCycle,
          auto_welcome_email: autoWelcomeEmail,
          auto_approve_expense: autoApproveExpense,
          expense_threshold: parseInt(expenseThreshold, 10) || 1000,

          enable_pf: enablePf,
          employee_contribution_percent: parseFloat(empContribution) || 12,
          employer_contribution_percent: parseFloat(emprContribution) || 8.3,

          enable_late_policy: enableLatePolicy,
          consecutive_late_days: parseInt(consecutiveLateDays, 10) || 3,
          late_deduction_amount: parseFloat(lateDeductionAmount) || 500,
          late_approval_required: lateApprovalRequired,

          enable_company_announcements: enableCompanyAnnouncements,
          enable_birthday_notifications: enableBirthdayNotifications,
        },
      });

      await createAuditLog('org_updated', 'organization', org.id, {
        updated_by: profile?.id,
        new_name: orgName,
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (err: any) {
      console.error('Error saving org settings:', err);
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState />;

  return (
    <SidebarLayout items={ADMIN_NAV}>
      <ScrollView
        style={[styles.container, { backgroundColor: '#FAF9FD' }]}
        contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Row with STOCK 6 SVG */}
        <Animated.View entering={FadeInDown.duration(280)} style={styles.headerRow}>
          <View style={{ flex: 1, minWidth: 260 }}>
            <View style={styles.headerBadge}>
              <Building2 size={14} color="#7C3AED" />
              <Text style={styles.headerBadgeText}>Organization & Policies</Text>
            </View>
            <Text style={[styles.title, { color: '#0F172A' }]}>Organization Settings</Text>
            <Text style={[styles.subtitle, { color: '#64748B' }]}>
              Configure legal entity profiles, shifts, GPS geofences, and automated compliance policies.
            </Text>
          </View>

          <View style={{ opacity: 0.95 }}>
            <SvgXml xml={STOCK_6_SVG} width={isDesktop ? 135 : 95} height={isDesktop ? 95 : 68} />
          </View>
        </Animated.View>

        {/* 4 Pastel Policy Status KPI Cards with InteractiveTile */}
        <Animated.View entering={FadeInDown.delay(50).duration(280)} style={{ marginBottom: 12 }}>
          {isDesktop ? (
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {/* Card 1: Legal Entity */}
              <InteractiveTile
                style={[
                  styles.pastelMetricCard,
                  {
                    backgroundColor: '#F3EEFE',
                    borderColor: '#E4DCFD',
                    flex: 1,
                    minWidth: 0,
                  },
                ]}
              >
                <View style={styles.cardTopRow}>
                  <View style={[styles.iconBox, { backgroundColor: '#DDD6FE' }]}>
                    <SvgXml xml={STOCK_6_SVG} width={34} height={25} />
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.metricValueText, { color: '#1E1B4B' }]} numberOfLines={1}>
                      {currency}
                    </Text>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#10B981', marginTop: 1 }}>{timezone.split('/')[1] || 'IST'}</Text>
                  </View>
                </View>
                <Text style={styles.metricLabelText}>Billing & Timezone</Text>
                <View style={styles.waveContainer}>
                  <MetricWave color="#8B5CF6" width={isDesktop ? 150 : 80} height={24} />
                </View>
              </InteractiveTile>

              {/* Card 2: Shift Hours */}
              <InteractiveTile
                style={[
                  styles.pastelMetricCard,
                  {
                    backgroundColor: '#EDFAF2',
                    borderColor: '#CEF2DE',
                    flex: 1,
                    minWidth: 0,
                  },
                ]}
              >
                <View style={styles.cardTopRow}>
                  <View style={[styles.iconBox, { backgroundColor: '#D1FAE5' }]}>
                    <SvgXml xml={STOCK_7_SVG} width={34} height={25} />
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.metricValueText, { color: '#064E3B' }]}>{workStart}</Text>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#10B981', marginTop: 1 }}>to {workEnd}</Text>
                  </View>
                </View>
                <Text style={styles.metricLabelText}>Working Hours</Text>
                <View style={styles.waveContainer}>
                  <MetricWave color="#10B981" width={isDesktop ? 150 : 80} height={24} />
                </View>
              </InteractiveTile>

              {/* Card 3: Geofence */}
              <InteractiveTile
                style={[
                  styles.pastelMetricCard,
                  {
                    backgroundColor: '#FFF4EB',
                    borderColor: '#FFE2CD',
                    flex: 1,
                    minWidth: 0,
                  },
                ]}
              >
                <View style={styles.cardTopRow}>
                  <View style={[styles.iconBox, { backgroundColor: '#FFEDD5' }]}>
                    <SvgXml xml={STOCK_12_SVG} width={34} height={25} />
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.metricValueText, { color: '#7C2D12' }]}>{defaultRadius}m</Text>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#EA580C', marginTop: 1 }}>GPS Perimeter</Text>
                  </View>
                </View>
                <Text style={styles.metricLabelText}>Geofence Radius</Text>
                <View style={styles.waveContainer}>
                  <MetricWave color="#F97316" width={isDesktop ? 150 : 80} height={24} />
                </View>
              </InteractiveTile>

              {/* Card 4: Compliance Policies */}
              <InteractiveTile
                style={[
                  styles.pastelMetricCard,
                  {
                    backgroundColor: '#EFF6FF',
                    borderColor: '#DBEAFE',
                    flex: 1,
                    minWidth: 0,
                  },
                ]}
              >
                <View style={styles.cardTopRow}>
                  <View style={[styles.iconBox, { backgroundColor: '#DBEAFE' }]}>
                    <SvgXml xml={STOCK_9_SVG} width={34} height={25} />
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.metricValueText, { color: '#1E3A8A' }]}>
                      {enablePf ? 'Active' : 'Standard'}
                    </Text>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#2563EB', marginTop: 1 }}>
                      {enablePf ? `${empContribution}% EPF` : 'No EPF'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.metricLabelText}>Deduction Engine</Text>
                <View style={styles.waveContainer}>
                  <MetricWave color="#3B82F6" width={isDesktop ? 150 : 80} height={24} />
                </View>
              </InteractiveTile>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {/* Card 1: Legal Entity */}
                <InteractiveTile
                  style={[
                    styles.pastelMetricCard,
                    {
                      backgroundColor: '#F3EEFE',
                      borderColor: '#E4DCFD',
                      flex: 1,
                      minWidth: 0,
                    },
                  ]}
                >
                  <View style={styles.cardTopRow}>
                    <View style={[styles.iconBox, { backgroundColor: '#DDD6FE' }]}>
                      <SvgXml xml={STOCK_6_SVG} width={34} height={25} />
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.metricValueText, { color: '#1E1B4B' }]} numberOfLines={1}>
                        {currency}
                      </Text>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#10B981', marginTop: 1 }}>{timezone.split('/')[1] || 'IST'}</Text>
                    </View>
                  </View>
                  <Text style={styles.metricLabelText}>Billing & Timezone</Text>
                  <View style={styles.waveContainer}>
                    <MetricWave color="#8B5CF6" width={80} height={24} />
                  </View>
                </InteractiveTile>

                {/* Card 2: Shift Hours */}
                <InteractiveTile
                  style={[
                    styles.pastelMetricCard,
                    {
                      backgroundColor: '#EDFAF2',
                      borderColor: '#CEF2DE',
                      flex: 1,
                      minWidth: 0,
                    },
                  ]}
                >
                  <View style={styles.cardTopRow}>
                    <View style={[styles.iconBox, { backgroundColor: '#D1FAE5' }]}>
                      <SvgXml xml={STOCK_7_SVG} width={34} height={25} />
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.metricValueText, { color: '#064E3B' }]}>{workStart}</Text>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#10B981', marginTop: 1 }}>to {workEnd}</Text>
                    </View>
                  </View>
                  <Text style={styles.metricLabelText}>Working Hours</Text>
                  <View style={styles.waveContainer}>
                    <MetricWave color="#10B981" width={80} height={24} />
                  </View>
                </InteractiveTile>
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                {/* Card 3: Geofence */}
                <InteractiveTile
                  style={[
                    styles.pastelMetricCard,
                    {
                      backgroundColor: '#FFF4EB',
                      borderColor: '#FFE2CD',
                      flex: 1,
                      minWidth: 0,
                    },
                  ]}
                >
                  <View style={styles.cardTopRow}>
                    <View style={[styles.iconBox, { backgroundColor: '#FFEDD5' }]}>
                      <SvgXml xml={STOCK_12_SVG} width={34} height={25} />
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.metricValueText, { color: '#7C2D12' }]}>{defaultRadius}m</Text>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#EA580C', marginTop: 1 }}>GPS Perimeter</Text>
                    </View>
                  </View>
                  <Text style={styles.metricLabelText}>Geofence Radius</Text>
                  <View style={styles.waveContainer}>
                    <MetricWave color="#F97316" width={80} height={24} />
                  </View>
                </InteractiveTile>

                {/* Card 4: Compliance Policies */}
                <InteractiveTile
                  style={[
                    styles.pastelMetricCard,
                    {
                      backgroundColor: '#EFF6FF',
                      borderColor: '#DBEAFE',
                      flex: 1,
                      minWidth: 0,
                    },
                  ]}
                >
                  <View style={styles.cardTopRow}>
                    <View style={[styles.iconBox, { backgroundColor: '#DBEAFE' }]}>
                      <SvgXml xml={STOCK_9_SVG} width={34} height={25} />
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.metricValueText, { color: '#1E3A8A' }]}>
                        {enablePf ? 'Active' : 'Standard'}
                      </Text>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#2563EB', marginTop: 1 }}>
                        {enablePf ? `${empContribution}% EPF` : 'No EPF'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.metricLabelText}>Deduction Engine</Text>
                  <View style={styles.waveContainer}>
                    <MetricWave color="#3B82F6" width={80} height={24} />
                  </View>
                </InteractiveTile>
              </View>
            </View>
          )}
        </Animated.View>

        {saved && (
          <View style={[styles.alertBox, { backgroundColor: '#EDFAF2', borderColor: '#CEF2DE' }]}>
            <CheckCircle2 size={18} color="#059669" />
            <Text style={{ color: '#065F46', fontWeight: '700', fontSize: 14 }}>
              Organization settings saved successfully!
            </Text>
          </View>
        )}

        {error ? (
          <View style={[styles.alertBox, { backgroundColor: '#FFF1F2', borderColor: '#FECDD3' }]}>
            <AlertCircle size={18} color="#DC2626" />
            <Text style={{ color: '#991B1B', fontSize: 14 }}>{error}</Text>
          </View>
        ) : null}

        {/* 1. Company Profile */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: '#e2e8f0' }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconWrap, { backgroundColor: '#edf8f6' }]}>
              <Building2 size={18} color="#006a61" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Company Profile</Text>
              <Text style={[styles.cardSub, { color: colors.textSecondary }]}>Legal identity & communication channels</Text>
            </View>
          </View>
          <View style={{ gap: 14 }}>
            <Input
              label="Organization Legal Name *"
              placeholder="e.g. Subedge Technology Pvt Ltd"
              value={orgName}
              onChangeText={setOrgName}
            />
            <Input
              label="Organization ID"
              value={org?.id || profile?.organization_id || ''}
              editable={false}
              hint="Unique system identifier for this organization workspace."
            />
            <View style={isDesktop ? styles.rowFields : { gap: 14 }}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Official HR / Contact Email"
                  placeholder="hr@subedge.com"
                  value={contactEmail}
                  onChangeText={setContactEmail}
                  keyboardType="email-address"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="Official Support Phone"
                  placeholder="+91 98765 43210"
                  value={contactPhone}
                  onChangeText={setContactPhone}
                  keyboardType="phone-pad"
                />
              </View>
            </View>
          </View>
        </View>

        {/* 2. Localization & Currency */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: '#e2e8f0' }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconWrap, { backgroundColor: '#fef3c7' }]}>
              <Globe size={18} color="#b45309" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Localization & Financial Preferences</Text>
              <Text style={[styles.cardSub, { color: colors.textSecondary }]}>Currency, timezone, and fiscal calendar cycle</Text>
            </View>
          </View>
          <View style={isDesktop ? styles.rowFields : { gap: 14 }}>
            <View style={{ flex: 1 }}>
              <Select
                label="Payroll & Financial Currency"
                options={[
                  { label: 'Indian Rupee (INR ₹)', value: 'INR' },
                  { label: 'US Dollar (USD $)', value: 'USD' },
                  { label: 'Euro (EUR €)', value: 'EUR' },
                  { label: 'British Pound (GBP £)', value: 'GBP' },
                  { label: 'UAE Dirham (AED د.إ)', value: 'AED' },
                  { label: 'Singapore Dollar (SGD S$)', value: 'SGD' },
                ]}
                value={currency}
                onValueChange={setCurrency}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Select
                label="System Timezone"
                options={[
                  { label: 'Asia/Kolkata (IST +5:30)', value: 'Asia/Kolkata' },
                  { label: 'UTC (Coordinated Universal Time)', value: 'UTC' },
                  { label: 'America/New_York (EST/EDT)', value: 'America/New_York' },
                  { label: 'America/Los_Angeles (PST/PDT)', value: 'America/Los_Angeles' },
                  { label: 'Europe/London (GMT/BST)', value: 'Europe/London' },
                  { label: 'Asia/Dubai (GST +4:00)', value: 'Asia/Dubai' },
                  { label: 'Asia/Singapore (SGT +8:00)', value: 'Asia/Singapore' },
                ]}
                value={timezone}
                onValueChange={setTimezone}
              />
            </View>
          </View>
        </View>

        {/* 3. Shift Timings & Geofencing */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: '#e2e8f0' }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconWrap, { backgroundColor: '#eeebff' }]}>
              <Clock size={18} color="#4f46e5" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Default Working Hours & Geofence</Text>
              <Text style={[styles.cardSub, { color: colors.textSecondary }]}>Used to calculate late check-ins, overtime, and valid office punch radius</Text>
            </View>
          </View>
          <View style={isDesktop ? styles.rowFields : { gap: 14 }}>
            <View style={{ flex: 1 }}>
              <TimePicker
                label="Shift Start Time"
                value={workStart}
                onChange={setWorkStart}
                format="HH:mm"
                helperText="Standard hospital morning punch window"
              />
            </View>
            <View style={{ flex: 1 }}>
              <TimePicker
                label="Shift End Time"
                value={workEnd}
                onChange={setWorkEnd}
                format="HH:mm"
                minTime={workStart}
                helperText="Late check-out & overtime baseline"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label="Geofence Radius (meters)"
                placeholder="150"
                value={defaultRadius}
                onChangeText={setDefaultRadius}
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>

        {/* 4. Automated HR Rules */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: '#e2e8f0' }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconWrap, { backgroundColor: '#e0f2fe' }]}>
              <Sparkles size={18} color="#0369a1" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Automated Operations & Triggers</Text>
              <Text style={[styles.cardSub, { color: colors.textSecondary }]}>Automatic email triggers and expense approvals</Text>
            </View>
          </View>

          <View style={{ gap: 14 }}>
            {/* Switch 1: Auto Welcome Email */}
            <View style={styles.switchRow}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={[styles.switchLabel, { color: colors.text }]}>
                  Send Automatic Resend Welcome Email
                </Text>
                <Text style={[styles.switchSub, { color: colors.textSecondary }]}>
                  Dispatches login credentials and portal access link upon account creation.
                </Text>
              </View>
              <Switch
                value={autoWelcomeEmail}
                onValueChange={setAutoWelcomeEmail}
                trackColor={{ true: colors.primary }}
              />
            </View>

            {/* Switch 2: Auto Expense Approval */}
            <View style={styles.switchRow}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={[styles.switchLabel, { color: colors.text }]}>
                  Auto-Approve Small Expense Claims
                </Text>
                <Text style={[styles.switchSub, { color: colors.textSecondary }]}>
                  Automatically approve claims below threshold without manager sign-off.
                </Text>
              </View>
              <Switch
                value={autoApproveExpense}
                onValueChange={setAutoApproveExpense}
                trackColor={{ true: colors.primary }}
              />
            </View>

            {autoApproveExpense && (
              <Input
                label="Maximum Auto-Approval Amount (₹)"
                placeholder="1000"
                value={expenseThreshold}
                onChangeText={setExpenseThreshold}
                keyboardType="numeric"
              />
            )}
          </View>
        </View>

        {/* 5. PF / EPF Configuration */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: '#e2e8f0' }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconWrap, { backgroundColor: '#f3e8ff' }]}>
              <Coins size={18} color="#7e22ce" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>PF / EPF Configuration</Text>
              <Text style={[styles.cardSub, { color: colors.textSecondary }]}>Manage employee and employer provident fund contributions</Text>
            </View>
          </View>
          <View style={{ gap: 14 }}>
            <View style={styles.switchRow}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={[styles.switchLabel, { color: colors.text }]}>Enable EPF/PF</Text>
                <Text style={[styles.switchSub, { color: colors.textSecondary }]}>Apply PF deductions in payroll calculations</Text>
              </View>
              <Switch value={enablePf} onValueChange={setEnablePf} trackColor={{ true: colors.primary }} />
            </View>
            {enablePf && (
              <View style={isDesktop ? styles.rowFields : { gap: 14 }}>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Employee Contribution %"
                    placeholder="12"
                    value={empContribution}
                    onChangeText={setEmpContribution}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Employer Contribution %"
                    placeholder="8.3"
                    value={emprContribution}
                    onChangeText={setEmprContribution}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            )}
          </View>
        </View>

        {/* 6. Late Attendance Policy */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: '#e2e8f0' }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconWrap, { backgroundColor: '#ffe4e6' }]}>
              <AlertCircle size={18} color="#e11d48" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Late Attendance Policy</Text>
              <Text style={[styles.cardSub, { color: colors.textSecondary }]}>Configure automatic salary deductions for consecutive late days</Text>
            </View>
          </View>
          <View style={{ gap: 14 }}>
            <View style={styles.switchRow}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={[styles.switchLabel, { color: colors.text }]}>Enable Policy</Text>
                <Text style={[styles.switchSub, { color: colors.textSecondary }]}>Trigger deductions automatically on late days</Text>
              </View>
              <Switch value={enableLatePolicy} onValueChange={setEnableLatePolicy} trackColor={{ true: colors.primary }} />
            </View>
            {enableLatePolicy && (
              <View style={{ gap: 14 }}>
                <View style={isDesktop ? styles.rowFields : { gap: 14 }}>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="Consecutive Late Days"
                      placeholder="3"
                      value={consecutiveLateDays}
                      onChangeText={setConsecutiveLateDays}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="Deduction Amount (₹)"
                      placeholder="500"
                      value={lateDeductionAmount}
                      onChangeText={setLateDeductionAmount}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
                <View style={styles.switchRow}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={[styles.switchLabel, { color: colors.text }]}>Approval Required</Text>
                    <Text style={[styles.switchSub, { color: colors.textSecondary }]}>HR/Admin must approve before payroll deduction</Text>
                  </View>
                  <Switch value={lateApprovalRequired} onValueChange={setLateApprovalRequired} trackColor={{ true: colors.primary }} />
                </View>
              </View>
            )}
          </View>
        </View>

        {/* 7. Notifications */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: '#e2e8f0' }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconWrap, { backgroundColor: '#fef9c3' }]}>
              <Radio size={18} color="#ca8a04" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Notifications</Text>
              <Text style={[styles.cardSub, { color: colors.textSecondary }]}>Manage company announcements and employee birthday notifications</Text>
            </View>
          </View>
          <View style={{ gap: 14 }}>
            <View style={styles.switchRow}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={[styles.switchLabel, { color: colors.text }]}>Enable Company Announcements</Text>
                <Text style={[styles.switchSub, { color: colors.textSecondary }]}>Allow HR to publish company-wide announcements</Text>
              </View>
              <Switch value={enableCompanyAnnouncements} onValueChange={setEnableCompanyAnnouncements} trackColor={{ true: colors.primary }} />
            </View>
            <View style={styles.switchRow}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={[styles.switchLabel, { color: colors.text }]}>Enable Birthday Notifications</Text>
                <Text style={[styles.switchSub, { color: colors.textSecondary }]}>Automatically send birthday wishes to employees</Text>
              </View>
              <Switch value={enableBirthdayNotifications} onValueChange={setEnableBirthdayNotifications} trackColor={{ true: colors.primary }} />
            </View>
          </View>
        </View>

        <Button
          title="Save Organization Settings"
          icon={<Save size={16} color="#FFF" />}
          onPress={handleSave}
          loading={saving}
          style={{ backgroundColor: '#7C3AED', borderRadius: 12, paddingVertical: 14 }}
        />
      </ScrollView>
    </SidebarLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 24, paddingBottom: 60 },
  contentDesktop: { maxWidth: 1000, alignSelf: 'center', width: '100%', padding: 36, gap: 28 },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    flexWrap: 'wrap',
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3EEFE',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E4DCFD',
  },
  headerBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C3AED',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, marginTop: 4, lineHeight: 19 },

  pastelMetricCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    overflow: 'hidden',
    position: 'relative',
    minHeight: 104,
    shadowColor: '#0f0f0f',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValueText: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  metricLabelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 8,
  },
  waveContainer: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    opacity: 0.65,
    pointerEvents: 'none',
  },

  alertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },

  card: {
    padding: 24,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    gap: 18,
    shadowColor: '#0f0f0f',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3EEFE' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  cardSub: { fontSize: 12, marginTop: 1, color: '#64748B' },

  rowFields: { flexDirection: 'row', gap: 16 },

  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchLabel: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  switchSub: { fontSize: 12, marginTop: 2, color: '#64748B' },
});
