import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  RefreshControl,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { ADMIN_NAV } from '@/constants/navigation';
import { SidebarLayout } from '@/components/layout/Sidebar';
import { useTheme } from '@/hooks/use-theme';
import { LoadingState } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { useTenant } from '@/context/TenantContext';
import {
  getAutomationRules,
  toggleAutomationRule,
} from '@/lib/services/automations';
import {
  getEmailDeliveryLogs,
  sendResendEmail,
  sendWelcomeEmail,
  sendLeaveStatusEmail,
  sendTicketStatusEmail,
  sendOfferLetterEmail,
  EmailLog,
} from '@/lib/services/resend';
import { AutomationRule } from '@/types/database';
import {
  Workflow,
  Mail,
  Zap,
  CheckCircle2,
  Clock,
  Play,
  Send,
  Sparkles,
  Plus,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  FileText,
} from 'lucide-react-native';

export default function AutomationsScreen() {
  const colors = useTheme();
  const { organization: tenantOrg } = useTenant();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Test Dispatch state
  const [testEmail, setTestEmail] = useState('demo@subedge.com');
  const [sendingTest, setSendingTest] = useState(false);
  const [testSuccess, setTestSuccess] = useState<string | null>(null);

  // Add Rule Modal State
  const [addRuleModal, setAddRuleModal] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [ruleTrigger, setRuleTrigger] = useState('on_employee_created');
  const [ruleSubject, setRuleSubject] = useState('');
  const [ruleRecipient, setRuleRecipient] = useState<'employee' | 'manager' | 'admin'>('employee');

  const loadData = async () => {
    try {
      const r = await getAutomationRules();
      setRules(r);
      setEmailLogs(getEmailDeliveryLogs());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggle = async (ruleId: string, current: boolean) => {
    await toggleAutomationRule(ruleId, !current);
    loadData();
  };

  const handleSendTestEmail = async (type: 'general' | 'onboarding' | 'leave' | 'ticket' | 'offer') => {
    if (!testEmail.trim()) return;
    setSendingTest(true);
    setTestSuccess(null);
    try {
      const orgId = tenantOrg?.id;
      const orgName = tenantOrg?.name || 'Oasis HRMS';

      if (type === 'onboarding') {
        await sendWelcomeEmail(testEmail, 'Rajesh Mohanty', 'EMP-9021', 'Senior Operations Lead', {
          organizationId: orgId,
          organizationName: orgName,
          department: 'Operations & Engineering',
          workplace: 'Headquarters Campus',
          designation: 'Senior Operations Lead',
          temporaryPassword: 'TempPassword@2026',
        });
        setTestSuccess(`Dynamic onboarding welcome email dispatched to ${testEmail}!`);
      } else if (type === 'leave') {
        await sendLeaveStatusEmail(testEmail, 'Rajesh Mohanty', 'approved', 'Casual Leave (CL)', 'Aug 25 - Aug 28, 2026', 'Operations Head', {
          organizationId: orgId,
          organizationName: orgName,
          remainingDays: 14,
        });
        setTestSuccess(`Leave status notification dispatched to ${testEmail}!`);
      } else if (type === 'ticket') {
        await sendTicketStatusEmail(testEmail, 'TKT-8842', 'Enterprise ERP System Terminal Connection', 'Configured terminal client and verified biometric login.', {
          organizationId: orgId,
          organizationName: orgName,
          category: 'IT Infrastructure',
        });
        setTestSuccess(`Ticket resolution email dispatched to ${testEmail}!`);
      } else if (type === 'offer') {
        await sendOfferLetterEmail(testEmail, 'Rajesh Mohanty', 'Senior Operations Lead', 2400000, 'Sept 1, 2026', {
          organizationId: orgId,
          organizationName: orgName,
          department: 'Operations & Engineering',
          location: 'Headquarters Campus',
        });
        setTestSuccess(`Official Offer Letter email dispatched to ${testEmail}!`);
      } else {
        await sendResendEmail({
          to: testEmail,
          subject: `Resend Gateway Test — ${orgName}`,
          htmlContent: `<div style="font-family: sans-serif; padding: 20px; background: #F8FAFC;">
            <h2>Oasis Notification Gateway Active</h2>
            <p>This email confirms that the transactional notification pipeline for <strong>${orgName}</strong> is fully operational and synchronized.</p>
          </div>`,
          category: 'general',
          organizationId: orgId,
        });
        setTestSuccess(`Gateway diagnostic ping sent to ${testEmail}!`);
      }
      loadData();
      setTimeout(() => setTestSuccess(null), 4000);
    } finally {
      setSendingTest(false);
    }
  };

  const handleCreateRule = () => {
    if (!ruleName.trim() || !ruleSubject.trim()) return;
    const newRule: AutomationRule = {
      id: `rule_${Date.now()}`,
      organization_id: 'subedge_org',
      name: ruleName.trim(),
      trigger: ruleTrigger as any,
      action_type: 'send_resend_email',
      is_active: true,
      target_recipient: ruleRecipient,
      template_subject: ruleSubject.trim(),
      executions_count: 0,
      last_executed_at: null,
    };

    setRules((prev) => [newRule, ...prev]);
    setAddRuleModal(false);
    setRuleName('');
    setRuleSubject('');
  };

  if (loading) return <LoadingState />;

  const totalExecutions = rules.reduce((s, r) => s + (r.executions_count || 0), 0);

  return (
    <SidebarLayout items={ADMIN_NAV}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.topBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text }]}>Workflow Automations & Resend Engine</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Event-Driven Workflows, Automated Email Triggers & System Health
            </Text>
          </View>
          <Button
            title="+ New Workflow Rule"
            onPress={() => setAddRuleModal(true)}
            style={{ backgroundColor: '#0D7377', borderRadius: 8 }}
            size="sm"
          />
        </View>

        <ScrollView
          style={{ flex: 1, padding: isDesktop ? 28 : 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Active Automation Rules</Text>
              <Text style={styles.statNumber}>{rules.filter((r) => r.is_active).length} / {rules.length}</Text>
              <Text style={styles.statSub}>100% Operational</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Total Trigger Executions</Text>
              <Text style={[styles.statNumber, { color: '#0D7377' }]}>{totalExecutions}</Text>
              <Text style={styles.statSub}>Auto-dispatched</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Resend Gateway Status</Text>
              <Text style={[styles.statNumber, { color: '#10B981' }]}>Connected</Text>
              <Text style={styles.statSub}>Oasis HRMS Resend API</Text>
            </View>
          </View>

          {/* Test Dispatch Bar */}
          <View style={styles.testBar}>
            <View style={{ flex: 1, minWidth: 260 }}>
              <Text style={styles.testTitle}>Trigger Instant Resend Dispatch Test</Text>
              <Text style={styles.testSub}>Verify transactional email delivery and template styling</Text>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 10 }}>
                <TextInput
                  style={styles.testInput}
                  value={testEmail}
                  onChangeText={setTestEmail}
                  placeholder="recipient@subedge.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <TouchableOpacity
                onPress={() => handleSendTestEmail('onboarding')}
                style={styles.quickTestBtn}
                disabled={sendingTest}
              >
                <Sparkles size={14} color="#0D7377" />
                <Text style={styles.quickTestText}>Welcome Email</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleSendTestEmail('leave')}
                style={styles.quickTestBtn}
                disabled={sendingTest}
              >
                <CheckCircle2 size={14} color="#059669" />
                <Text style={styles.quickTestText}>Leave Status</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleSendTestEmail('offer')}
                style={styles.quickTestBtn}
                disabled={sendingTest}
              >
                <FileText size={14} color="#7C3AED" />
                <Text style={styles.quickTestText}>Offer Letter</Text>
              </TouchableOpacity>
            </View>
          </View>

          {testSuccess && (
            <View style={styles.successBanner}>
              <CheckCircle2 size={16} color="#059669" />
              <Text style={styles.successBannerText}>{testSuccess}</Text>
            </View>
          )}

          {/* Automation Rules List */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={styles.sectionTitle}>Event-Driven Workflow Rules ({rules.length})</Text>
          </View>

          <View style={{ gap: 14, marginBottom: 28 }}>
            {rules.map((rule) => (
              <View key={rule.id} style={styles.ruleCard}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
                  <View style={styles.iconCircle}>
                    <Workflow size={22} color="#0D7377" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ruleName}>{rule.name}</Text>
                    <Text style={styles.ruleSub}>
                      Trigger: <Text style={{ fontWeight: '700', color: '#0D7377' }}>{rule.trigger}</Text> · Action: {rule.action_type.replace(/_/g, ' ')}
                    </Text>
                    <Text style={styles.ruleTemplate}>Subject: "{rule.template_subject}"</Text>
                    {rule.last_executed_at && (
                      <Text style={styles.lastExecText}>
                        Last Executed: {new Date(rule.last_executed_at).toLocaleString()}
                      </Text>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <Switch
                      value={rule.is_active}
                      onValueChange={() => handleToggle(rule.id, rule.is_active)}
                      trackColor={{ true: '#0D7377', false: '#CBD5E1' }}
                    />
                    <Text style={styles.execCount}>{rule.executions_count || 0} Executions</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

          {/* Recent Delivery Logs */}
          <Text style={styles.sectionTitle}>Recent Resend Notification Logs ({emailLogs.length})</Text>
          <View style={{ gap: 8 }}>
            {emailLogs.map((log) => (
              <View key={log.id} style={styles.logCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Mail size={16} color="#0D7377" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.logSubject}>{log.subject}</Text>
                    <Text style={styles.logTo}>To: {log.to} · Category: {log.category} · {new Date(log.timestamp).toLocaleTimeString()}</Text>
                  </View>
                  <View style={styles.deliveredTag}>
                    <CheckCircle2 size={12} color="#059669" />
                    <Text style={styles.deliveredText}>{log.status.toUpperCase()}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Modal: Create New Workflow Rule */}
        <Modal visible={addRuleModal} onClose={() => setAddRuleModal(false)} title="Create Workflow Automation Rule">
          <View style={{ gap: 14 }}>
            <Input
              label="Rule Name *"
              placeholder="e.g. Employee Birthday Congratulatory Email"
              value={ruleName}
              onChangeText={setRuleName}
            />

            <Select
              label="Event Trigger *"
              options={[
                { label: 'On Employee Profile Created (on_employee_created)', value: 'on_employee_created' },
                { label: 'On Leave Request Approved (on_leave_approved)', value: 'on_leave_approved' },
                { label: 'On Support Ticket Resolved (on_ticket_resolved)', value: 'on_ticket_resolved' },
                { label: 'On Appraisal Submitted (on_appraisal_submitted)', value: 'on_appraisal_submitted' },
                { label: 'On Offer Letter Generated (on_offer_generated)', value: 'on_offer_generated' },
              ]}
              value={ruleTrigger}
              onValueChange={setRuleTrigger}
            />

            <Input
              label="Email Subject Template *"
              placeholder="e.g. Important Notification Regarding Your Account"
              value={ruleSubject}
              onChangeText={setRuleSubject}
            />

            <Select
              label="Target Recipient *"
              options={[
                { label: 'Employee Profile Owner', value: 'employee' },
                { label: 'Reporting Manager / HR Approver', value: 'manager' },
                { label: 'System Administrator', value: 'admin' },
              ]}
              value={ruleRecipient}
              onValueChange={(val) => setRuleRecipient(val as any)}
            />

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
              <Button
                title="Cancel"
                onPress={() => setAddRuleModal(false)}
                variant="outline"
                style={{ flex: 1, borderRadius: 8 }}
              />
              <Button
                title="Save Rule"
                onPress={handleCreateRule}
                style={{ flex: 1, backgroundColor: '#0D7377', borderRadius: 8 }}
              />
            </View>
          </View>
        </Modal>
      </View>
    </SidebarLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
  },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 16, flexWrap: 'wrap' },
  statCard: {
    flex: 1,
    minWidth: 160,
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statLabel: { fontSize: 11, color: '#64748B', fontWeight: '700' },
  statNumber: { fontSize: 22, fontWeight: '800', marginVertical: 4 },
  statSub: { fontSize: 11, color: '#94A3B8' },
  testBar: {
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 16,
  },
  testTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  testSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  testInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#1A1A2E',
    minWidth: 220,
    backgroundColor: '#F8FAFC',
  },
  quickTestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0F7F7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CCECEC',
  },
  quickTestText: { fontSize: 12, fontWeight: '700', color: '#0D7377' },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  successBannerText: { fontSize: 13, color: '#065F46', fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#1A1A2E', marginBottom: 12 },
  ruleCard: {
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#F0F7F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruleName: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  ruleSub: { fontSize: 12, color: '#475569', marginTop: 3 },
  ruleTemplate: { fontSize: 12, color: '#64748B', fontStyle: 'italic', marginTop: 2 },
  lastExecText: { fontSize: 11, color: '#94A3B8', marginTop: 4 },
  execCount: { fontSize: 11, color: '#0D7377', fontWeight: '700' },
  logCard: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  logSubject: { fontSize: 13, fontWeight: '600', color: '#1A1A2E' },
  logTo: { fontSize: 11, color: '#64748B', marginTop: 2 },
  deliveredTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  deliveredText: { fontSize: 10, fontWeight: '700', color: '#059669' },
});
