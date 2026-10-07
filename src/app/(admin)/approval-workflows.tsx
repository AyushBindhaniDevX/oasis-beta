import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, useWindowDimensions } from 'react-native';
import { ADMIN_NAV } from '@/constants/navigation';
import { SidebarLayout } from '@/components/layout/Sidebar';
import { useTheme } from '@/hooks/use-theme';
import { LoadingState } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useTenant } from '@/context/TenantContext';
import { useAuth } from '@/hooks/useAuth';
import { getOrganization, updateOrganization } from '@/lib/services/organization';
import { CheckCircle2, ShieldCheck, Save, GitMerge } from 'lucide-react-native';

export default function ApprovalWorkflowsScreen() {
  const colors = useTheme();
  const { profile } = useAuth();
  const { organization: tenantOrg } = useTenant();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  
  const modules = ['Leave', 'Attendance', 'Payroll', 'Expense', 'Other Requests'];
  
  const defaultWorkflows = modules.reduce((acc, mod) => {
    acc[mod] = {
      enabled: false,
      levels: 2,
      l1: 'Reporting Manager',
      l2: 'HR',
      l3: 'Admin',
    };
    return acc;
  }, {} as any);

  const [workflows, setWorkflows] = useState<any>(defaultWorkflows);

  useEffect(() => {
    (async () => {
      if (!profile?.organization_id) return;
      try {
        const data = await getOrganization(profile.organization_id);
        if (data && data.settings && (data.settings as any).approval_workflows) {
          setWorkflows({ ...defaultWorkflows, ...(data.settings as any).approval_workflows });
        }
      } catch (err) {
        console.error('Error fetching org settings:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [profile]);

  const handleSave = async () => {
    if (!profile?.organization_id) return;
    setSaving(true);
    setSaved(false);
    try {
      const data = await getOrganization(profile.organization_id);
      await updateOrganization(profile.organization_id, {
        settings: {
          ...((data?.settings as any) || {}),
          approval_workflows: workflows,
        }
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const updateWorkflow = (mod: string, key: string, value: any) => {
    setWorkflows((prev: any) => ({
      ...prev,
      [mod]: {
        ...prev[mod],
        [key]: value
      }
    }));
  };

  if (loading) return <LoadingState />;

  return (
    <SidebarLayout items={ADMIN_NAV}>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Approval Workflows</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Configure L1, L2, L3 approval hierarchies for different system modules.
          </Text>
        </View>

        {saved && (
          <View style={[styles.alertBox, { backgroundColor: '#edf8f6', borderColor: '#c4ece7' }]}>
            <CheckCircle2 size={18} color="#006a61" />
            <Text style={{ color: '#006a61', fontWeight: '700', fontSize: 14 }}>
              Approval workflows saved successfully!
            </Text>
          </View>
        )}

        <View style={{ gap: 20 }}>
          {modules.map((mod) => (
            <View key={mod} style={[styles.card, { backgroundColor: colors.surface, borderColor: '#e2e8f0' }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconWrap, { backgroundColor: '#f0f9ff' }]}>
                  <GitMerge size={18} color="#0284c7" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{mod} Module</Text>
                  <Text style={[styles.cardSub, { color: colors.textSecondary }]}>Manage approval hierarchy for {mod.toLowerCase()}</Text>
                </View>
                <Switch
                  value={workflows[mod].enabled}
                  onValueChange={(val) => updateWorkflow(mod, 'enabled', val)}
                  trackColor={{ true: colors.primary }}
                />
              </View>
              
              {workflows[mod].enabled && (
                <View style={{ gap: 14 }}>
                  <Select
                    label="Number of Approval Levels"
                    options={[
                      { label: '1 Level', value: '1' },
                      { label: '2 Levels', value: '2' },
                      { label: '3 Levels', value: '3' },
                    ]}
                    value={String(workflows[mod].levels)}
                    onValueChange={(val) => updateWorkflow(mod, 'levels', parseInt(val))}
                  />
                  
                  {workflows[mod].levels >= 1 && (
                    <Select
                      label="Level 1 Approver"
                      options={[
                        { label: 'Reporting Manager', value: 'Reporting Manager' },
                        { label: 'Department Manager', value: 'Department Manager' },
                        { label: 'HR', value: 'HR' },
                        { label: 'Admin', value: 'Admin' },
                      ]}
                      value={workflows[mod].l1}
                      onValueChange={(val) => updateWorkflow(mod, 'l1', val)}
                    />
                  )}
                  {workflows[mod].levels >= 2 && (
                    <Select
                      label="Level 2 Approver"
                      options={[
                        { label: 'Reporting Manager', value: 'Reporting Manager' },
                        { label: 'Department Manager', value: 'Department Manager' },
                        { label: 'HR', value: 'HR' },
                        { label: 'Admin', value: 'Admin' },
                      ]}
                      value={workflows[mod].l2}
                      onValueChange={(val) => updateWorkflow(mod, 'l2', val)}
                    />
                  )}
                  {workflows[mod].levels >= 3 && (
                    <Select
                      label="Level 3 Approver"
                      options={[
                        { label: 'Reporting Manager', value: 'Reporting Manager' },
                        { label: 'Department Manager', value: 'Department Manager' },
                        { label: 'HR', value: 'HR' },
                        { label: 'Admin', value: 'Admin' },
                      ]}
                      value={workflows[mod].l3}
                      onValueChange={(val) => updateWorkflow(mod, 'l3', val)}
                    />
                  )}
                </View>
              )}
            </View>
          ))}
        </View>

        <Button
          title="Save Approval Workflows"
          icon={<Save size={16} color="#FFF" />}
          onPress={handleSave}
          loading={saving}
          style={{ backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 14 }}
        />
      </ScrollView>
    </SidebarLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 24, paddingBottom: 60 },
  contentDesktop: { maxWidth: 900, alignSelf: 'center', width: '100%', padding: 36, gap: 28 },
  header: { gap: 4 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, lineHeight: 20 },
  alertBox: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 10, borderWidth: 1 },
  card: { padding: 24, borderRadius: 16, borderWidth: 1, gap: 18 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardSub: { fontSize: 12, marginTop: 1 },
});
