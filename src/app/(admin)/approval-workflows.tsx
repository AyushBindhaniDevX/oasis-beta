import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, useWindowDimensions, Platform } from 'react-native';
import Svg, { Path, SvgXml } from 'react-native-svg';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { InteractiveTile } from '@/components/ui/InteractiveTile';
import {
  STOCK_7_SVG,
  STOCK_8_SVG,
  STOCK_9_SVG,
  STOCK_11_SVG,
  PRODUCTIVE_3_SVG,
} from '@/constants/workManagementSvgs';
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
import { CheckCircle2, ShieldCheck, Save, GitMerge, Building2, Sparkles, Sliders, Layers } from 'lucide-react-native';

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

export default function ApprovalWorkflowsScreen() {
  const colors = useTheme();
  const { profile } = useAuth();
  const { organization: tenantOrg, allOrganizations, switchOrganization, refreshTenant } = useTenant();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<string>(tenantOrg?.id || 'shanti-memorial-hospital');
  
  const modules = ['Leave', 'Attendance', 'Payroll', 'Expense', 'Asset Requisitions', 'Training & LMS', 'Other Requests'];
  
  const defaultWorkflows = modules.reduce((acc, mod) => {
    acc[mod] = {
      enabled: mod === 'Leave' || mod === 'Attendance' || mod === 'Expense' || mod === 'Asset Requisitions',
      levels: 2,
      l1: 'Reporting Manager / Supervisor',
      l2: 'Department Manager / HOD',
      l3: 'Operations Head / Vice President',
      l4: 'Managing Director / HR Head',
    };
    return acc;
  }, {} as any);

  const [workflows, setWorkflows] = useState<any>(defaultWorkflows);

  // Sync selectedOrgId when tenantOrg loads
  useEffect(() => {
    if (tenantOrg?.id && !selectedOrgId) {
      setSelectedOrgId(tenantOrg.id);
    }
  }, [tenantOrg?.id]);

  const loadWorkflowsForOrg = async (orgId: string) => {
    if (!orgId) return;
    setSelectedOrgId(orgId);
    setLoading(true);
    setSaved(false);
    try {
      const data = await getOrganization(orgId);
      if (data && data.settings && (data.settings as any).approval_workflows) {
        setWorkflows({ ...defaultWorkflows, ...(data.settings as any).approval_workflows });
      } else {
        const customDefault = modules.reduce((acc, mod) => {
          acc[mod] = {
            enabled: true,
            levels: 2,
            l1: 'Reporting Manager / Supervisor',
            l2: 'Department Manager / HOD',
            l3: 'Operations Head / Vice President',
            l4: 'Managing Director / HR Head',
          };
          return acc;
        }, {} as any);
        setWorkflows(customDefault);
      }
    } catch (err) {
      console.error('Error fetching org settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const targetOrgId = selectedOrgId || tenantOrg?.id || profile?.organization_id;
    if (targetOrgId) {
      loadWorkflowsForOrg(targetOrgId);
    } else {
      setLoading(false);
    }
  }, [selectedOrgId]);

  const applyPreset = (preset: '4-tier' | 'corporate' | 'enterprise') => {
    if (preset === '4-tier') {
      setWorkflows({
        Leave: {
          enabled: true,
          levels: 4,
          l1: 'Reporting Officer / Supervisor',
          l2: 'Immediate Head of Department (HOD)',
          l3: 'Operations Head / Vice President',
          l4: 'Managing Director / HR Head (Final Approval)',
        },
        Attendance: {
          enabled: true,
          levels: 2,
          l1: 'Shift Supervisor',
          l2: 'Immediate Head of Department (HOD)',
          l3: 'Operations Head',
          l4: 'HR Administration',
        },
        Expense: {
          enabled: true,
          levels: 3,
          l1: 'Department Supervisor',
          l2: 'Finance & Accounts Officer',
          l3: 'Operations Head / Managing Director',
          l4: 'HR Administration',
        },
        Payroll: {
          enabled: true,
          levels: 2,
          l1: 'Payroll & Accounts Lead',
          l2: 'Finance Director / Managing Director',
          l3: 'Administration',
          l4: 'HR Admin',
        },
        'Other Requests': {
          enabled: true,
          levels: 2,
          l1: 'Department In-charge',
          l2: 'Operations & HR Head',
          l3: 'Unit Head',
          l4: 'Admin',
        },
      });
    } else if (preset === 'corporate') {
      setWorkflows({
        Leave: {
          enabled: true,
          levels: 2,
          l1: 'Reporting Manager / Team Lead',
          l2: 'Department Head / HR (Final Approval)',
          l3: 'Operations Head',
          l4: 'HR Administration',
        },
        Attendance: {
          enabled: true,
          levels: 1,
          l1: 'Direct Reporting Manager',
          l2: 'Department Head',
          l3: 'Operations Head',
          l4: 'HR Admin',
        },
        Expense: {
          enabled: true,
          levels: 2,
          l1: 'Reporting Manager',
          l2: 'Finance & Accounts Head',
          l3: 'VP Operations',
          l4: 'HR Admin',
        },
        Payroll: {
          enabled: true,
          levels: 2,
          l1: 'Payroll Specialist',
          l2: 'Finance Controller',
          l3: 'Administration',
          l4: 'HR Admin',
        },
        'Other Requests': {
          enabled: true,
          levels: 1,
          l1: 'Direct Reporting Manager',
          l2: 'People Operations',
          l3: 'Operations Head',
          l4: 'Admin',
        },
      });
    } else {
      // 3-tier enterprise
      setWorkflows({
        Leave: {
          enabled: true,
          levels: 3,
          l1: 'Team Lead / Supervisor',
          l2: 'Department Manager / HOD',
          l3: 'Operations Head / HR Director (Final Approval)',
          l4: 'HR Administration',
        },
        Attendance: {
          enabled: true,
          levels: 2,
          l1: 'Team Lead / Supervisor',
          l2: 'Department Manager / HOD',
          l3: 'HR Operations',
          l4: 'HR Administration',
        },
        Expense: {
          enabled: true,
          levels: 3,
          l1: 'Reporting Manager',
          l2: 'Department Head',
          l3: 'Chief Financial Officer (CFO)',
          l4: 'HR Administration',
        },
        Payroll: {
          enabled: true,
          levels: 2,
          l1: 'Payroll Lead',
          l2: 'Finance Controller / Admin',
          l3: 'VP Operations',
          l4: 'HR Admin',
        },
        'Other Requests': {
          enabled: true,
          levels: 2,
          l1: 'Reporting Manager',
          l2: 'Operations Lead',
          l3: 'Director',
          l4: 'Admin',
        },
      });
    }
  };

  const handleSave = async () => {
    const targetOrgId = selectedOrgId || tenantOrg?.id || profile?.organization_id;
    if (!targetOrgId) return;
    setSaving(true);
    setSaved(false);
    try {
      const data = await getOrganization(targetOrgId);
      await updateOrganization(targetOrgId, {
        settings: {
          ...((data?.settings as any) || {}),
          approval_workflows: workflows,
        }
      });
      if (refreshTenant) await refreshTenant();
      setSaved(true);
      setTimeout(() => setSaved(false), 5000);
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

  const APPROVER_OPTIONS = [
    { label: 'Reporting Manager / Supervisor (Tier 1)', value: 'Reporting Manager / Supervisor' },
    { label: 'Department Manager / Immediate HOD (Tier 2)', value: 'Department Manager / HOD' },
    { label: 'Operations Head / Vice President (Tier 3)', value: 'Operations Head / Vice President' },
    { label: 'Managing Director / HR Head (Tier 4)', value: 'Managing Director / HR Head' },
    { label: 'Super Admin', value: 'Admin' },
  ];

  const kpiCardWidth = isDesktop
    ? undefined
    : Platform.OS === 'web'
    ? 'calc(50% - 6px)'
    : Math.floor((width - 40 - 18) / 2);

  return (
    <SidebarLayout items={ADMIN_NAV}>
      <ScrollView
        style={[styles.container, { backgroundColor: '#FAF9FD' }]}
        contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Row with STOCK 11 SVG */}
        <Animated.View entering={FadeInDown.duration(280)} style={styles.headerRow}>
          <View style={{ flex: 1, minWidth: 260 }}>
            <View style={styles.headerBadge}>
              <GitMerge size={14} color="#7C3AED" />
              <Text style={styles.headerBadgeText}>Governance & Approvals</Text>
            </View>
            <Text style={[styles.title, { color: '#0F172A' }]}>Approval Workflows</Text>
            <Text style={[styles.subtitle, { color: '#64748B' }]}>
              Configure 1 to 4-tier approval hierarchies linked strictly to each organization's customization settings.
            </Text>
          </View>

          <View style={{ opacity: 0.95 }}>
            <SvgXml xml={PRODUCTIVE_3_SVG} width={isDesktop ? 130 : 90} height={isDesktop ? 90 : 65} />
          </View>
        </Animated.View>

        {/* Organization Governance Switcher & Scope Strip */}
        <Animated.View entering={FadeInDown.delay(30).duration(280)} style={styles.orgSelectorCard}>
          <View style={styles.orgSelectorHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Building2 size={18} color="#7C3AED" />
              <Text style={styles.orgSelectorTitle}>Target Organization Scope:</Text>
            </View>
            <View style={styles.linkedBadge}>
              <ShieldCheck size={12} color="#059669" />
              <Text style={styles.linkedBadgeText}>Linked & Isolated by Organization</Text>
            </View>
          </View>

          {/* Org Selector Pills */}
          <View style={styles.orgPillsRow}>
            {(allOrganizations && allOrganizations.length > 0 ? allOrganizations : [tenantOrg].filter(Boolean)).map((org: any) => {
              const isSelected = selectedOrgId === org.id;
              return (
                <TouchableOpacity
                  key={org.id}
                  style={[
                    styles.orgPillBtn,
                    isSelected && styles.orgPillBtnActive,
                  ]}
                  onPress={() => loadWorkflowsForOrg(org.id)}
                  activeOpacity={0.8}
                >
                  <Building2 size={13} color={isSelected ? '#7C3AED' : '#64748B'} />
                  <Text style={[styles.orgPillBtnText, isSelected && styles.orgPillBtnTextActive]}>
                    {org.name}
                  </Text>
                  {isSelected && (
                    <View style={styles.activeCheckDot} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Quick Industry Presets */}
          <View style={styles.presetSection}>
            <Text style={styles.presetHeader}>Quick Industry Presets:</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <TouchableOpacity
                style={[styles.presetChip, { borderColor: '#E9D5FF', backgroundColor: '#FAF5FF' }]}
                onPress={() => applyPreset('4-tier')}
                activeOpacity={0.75}
              >
                <Text style={[styles.presetChipText, { color: '#6B21A8' }]}>🏛️ Enterprise Multi-Tier (4 Levels)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.presetChip, { borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' }]}
                onPress={() => applyPreset('corporate')}
                activeOpacity={0.75}
              >
                <Text style={[styles.presetChipText, { color: '#1E40AF' }]}>🏢 Corporate / Tech (2 Levels)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.presetChip, { borderColor: '#BBF7D0', backgroundColor: '#F0FDF4' }]}
                onPress={() => applyPreset('enterprise')}
                activeOpacity={0.75}
              >
                <Text style={[styles.presetChipText, { color: '#166534' }]}>⚡ Standard Escalation (3 Levels)</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>

        {/* 4 Pastel KPI Metric Cards with InteractiveTile */}
        <Animated.View entering={FadeInDown.delay(50).duration(280)} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 4 }}>
          {/* Card 1: Active Workflows */}
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
                <SvgXml xml={PRODUCTIVE_3_SVG} width={34} height={25} />
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.metricValueText, { color: '#1E1B4B' }]}>5</Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#10B981', marginTop: 1 }}>Modules</Text>
              </View>
            </View>
            <Text style={styles.metricLabelText}>Active Policies</Text>
            <View style={styles.waveContainer}>
              <MetricWave color="#8B5CF6" width={isDesktop ? 150 : 80} height={24} />
            </View>
          </InteractiveTile>

          {/* Card 2: Leave Approvals */}
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
                <SvgXml xml={STOCK_8_SVG} width={34} height={25} />
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.metricValueText, { color: '#064E3B' }]}>
                  {workflows['Leave']?.levels || 4}-Tier
                </Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#10B981', marginTop: 1 }}>
                  {workflows['Leave']?.levels === 4 ? 'Executive 4-Tier' : `${workflows['Leave']?.levels || 4} Sequential Tiers`}
                </Text>
              </View>
            </View>
            <Text style={styles.metricLabelText}>Leave Escalation</Text>
            <View style={styles.waveContainer}>
              <MetricWave color="#10B981" width={isDesktop ? 150 : 80} height={24} />
            </View>
          </InteractiveTile>

          {/* Card 3: Attendance Override */}
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
                <SvgXml xml={STOCK_7_SVG} width={34} height={25} />
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.metricValueText, { color: '#7C2D12' }]}>
                  {workflows['Attendance']?.levels || 2}-Tier
                </Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#EA580C', marginTop: 1 }}>
                  {workflows['Attendance']?.levels === 1 ? 'Direct Sign-off' : 'Manager Escalation'}
                </Text>
              </View>
            </View>
            <Text style={styles.metricLabelText}>Attendance Verification</Text>
            <View style={styles.waveContainer}>
              <MetricWave color="#F97316" width={isDesktop ? 150 : 80} height={24} />
            </View>
          </InteractiveTile>

          {/* Card 4: Finance & Payroll */}
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
                <SvgXml xml={STOCK_9_SVG} width={34} height={25} />
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.metricValueText, { color: '#1E3A8A' }]}>
                  {workflows['Expense']?.levels || 2}-Tier
                </Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#2563EB', marginTop: 1 }}>
                  Expense Audit
                </Text>
              </View>
            </View>
            <Text style={styles.metricLabelText}>Payroll & Expenses</Text>
            <View style={styles.waveContainer}>
              <MetricWave color="#3B82F6" width={isDesktop ? 150 : 80} height={24} />
            </View>
          </InteractiveTile>
        </Animated.View>

        {saved && (
          <View style={[styles.alertBox, { backgroundColor: '#EDFAF2', borderColor: '#CEF2DE' }]}>
            <CheckCircle2 size={18} color="#059669" />
            <Text style={{ color: '#065F46', fontWeight: '700', fontSize: 14 }}>
              Approval workflows saved & linked to {allOrganizations.find(o => o.id === selectedOrgId)?.name || tenantOrg?.name || 'organization'} successfully!
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
                  <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
                    {workflows[mod]?.enabled
                      ? `${workflows[mod]?.levels || 2}-Tier Approval Hierarchy (${workflows[mod]?.levels === 1 ? '1 Sign-off' : `${workflows[mod]?.levels || 2} Sequential Sign-offs`})`
                      : `Approval workflow disabled for ${mod.toLowerCase()}`}
                  </Text>
                </View>
                <Switch
                  value={workflows[mod]?.enabled}
                  onValueChange={(val) => updateWorkflow(mod, 'enabled', val)}
                  trackColor={{ true: colors.primary }}
                />
              </View>
              
              {workflows[mod]?.enabled && (
                <View style={{ gap: 14 }}>
                  <Select
                    label="Number of Approval Levels"
                    options={[
                      { label: '1 Level (Single-Tier: 1-Step Direct Approval)', value: '1' },
                      { label: '2 Levels (Two-Tier: Supervisor -> Head of Department / HR)', value: '2' },
                      { label: '3 Levels (Three-Tier: Supervisor -> HOD -> Operations Head / HR)', value: '3' },
                      { label: '4 Levels (Four-Tier: Supervisor -> HOD -> Operations Head -> Managing Director)', value: '4' },
                    ]}
                    value={String(workflows[mod].levels || 2)}
                    onValueChange={(val) => updateWorkflow(mod, 'levels', parseInt(val))}
                  />

                  {/* Live Approval Pipeline Preview */}
                  <View style={styles.workflowLiveStepper}>
                    <Text style={styles.stepperPreviewHeader}>
                      Live Pipeline Preview ({workflows[mod].levels || 2} Stages):
                    </Text>
                    <View style={styles.stepperFlowRow}>
                      {Array.from({ length: workflows[mod].levels || 2 }).map((_, stageIdx) => {
                        const stageNum = stageIdx + 1;
                        const approverVal =
                          stageNum === 1
                            ? workflows[mod].l1 || 'Reporting Manager'
                            : stageNum === 2
                            ? workflows[mod].l2 || 'Department HOD'
                            : stageNum === 3
                            ? workflows[mod].l3 || 'Operations Head'
                            : workflows[mod].l4 || 'Managing Director / HR';
                        const isLast = stageNum === (workflows[mod].levels || 2);
                        return (
                          <React.Fragment key={stageNum}>
                            <View style={styles.stagePreviewChip}>
                              <View
                                style={[
                                  styles.stageBadgeCircle,
                                  {
                                    backgroundColor:
                                      stageNum === 1
                                        ? '#7C3AED'
                                        : stageNum === 2
                                        ? '#2563EB'
                                        : stageNum === 3
                                        ? '#0D9488'
                                        : '#059669',
                                  },
                                ]}
                              >
                                <Text style={styles.stageBadgeText}>L{stageNum}</Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.stagePreviewNum}>
                                  Stage {stageNum}
                                  {isLast ? ' (Final)' : ''}
                                </Text>
                                <Text style={styles.stagePreviewRole} numberOfLines={1}>
                                  {approverVal}
                                </Text>
                              </View>
                            </View>
                            {!isLast && (
                              <View style={styles.stageArrowWrap}>
                                <Text style={styles.stageArrowText}>→</Text>
                              </View>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </View>
                  </View>
                  
                  {workflows[mod].levels >= 1 && (
                    <Select
                      label="Level 1 Approver"
                      options={APPROVER_OPTIONS}
                      value={workflows[mod].l1 || 'Reporting Manager / Supervisor'}
                      onValueChange={(val) => updateWorkflow(mod, 'l1', val)}
                    />
                  )}
                  {workflows[mod].levels >= 2 && (
                    <Select
                      label="Level 2 Approver"
                      options={APPROVER_OPTIONS}
                      value={workflows[mod].l2 || 'Department Manager / HOD'}
                      onValueChange={(val) => updateWorkflow(mod, 'l2', val)}
                    />
                  )}
                  {workflows[mod].levels >= 3 && (
                    <Select
                      label="Level 3 Approver"
                      options={APPROVER_OPTIONS}
                      value={workflows[mod].l3 || 'Operations Head / Vice President'}
                      onValueChange={(val) => updateWorkflow(mod, 'l3', val)}
                    />
                  )}
                  {workflows[mod].levels >= 4 && (
                    <Select
                      label="Level 4 Approver (Final Authority)"
                      options={APPROVER_OPTIONS}
                      value={workflows[mod].l4 || 'Managing Director / HR Head'}
                      onValueChange={(val) => updateWorkflow(mod, 'l4', val)}
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
  orgSelectorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    gap: 14,
    ...Platform.select({
      web: { boxShadow: '0 2px 10px -2px rgba(0, 0, 0, 0.04)' },
      default: { elevation: 1 },
    }),
  },
  orgSelectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  orgSelectorTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  linkedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  linkedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
  },
  orgPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  orgPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  orgPillBtnActive: {
    backgroundColor: '#F5F3FF',
    borderColor: '#7C3AED',
  },
  orgPillBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#475569',
  },
  orgPillBtnTextActive: {
    color: '#7C3AED',
    fontWeight: '700',
  },
  activeCheckDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#7C3AED',
    marginLeft: 2,
  },
  presetSection: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
    gap: 8,
  },
  presetHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  presetChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  presetChipText: {
    fontSize: 11.5,
    fontWeight: '700',
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
  subtitle: { fontSize: 13, lineHeight: 19, marginTop: 4 },

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

  alertBox: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
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

  workflowLiveStepper: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
    marginTop: 4,
  },
  stepperPreviewHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stepperFlowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  stagePreviewChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    minWidth: 130,
  },
  stageBadgeCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  stagePreviewNum: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  stagePreviewRole: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  stageArrowWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  stageArrowText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#94A3B8',
  },
});
