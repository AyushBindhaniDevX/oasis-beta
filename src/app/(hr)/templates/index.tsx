import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { SidebarLayout } from '@/components/layout/Sidebar';
import { useTheme } from '@/hooks/use-theme';
import { useTenant } from '@/context/TenantContext';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/States';
import {
  getTemplates,
  getTemplate,
  saveTemplate,
  resetTemplate,
  renderTemplateString,
  TEMPLATE_VARIABLES,
  DocumentTemplate,
} from '@/lib/services/templates';
import { exportOrPrintPdf } from '@/utils/pdf';
import {
  FileText,
  Mail,
  Save,
  RotateCcw,
  Eye,
  Edit3,
  Copy,
  Plus,
  Trash2,
  CheckCircle2,
  Sparkles,
  Printer,
  ChevronRight,
  Info,
  Building2,
  Check,
} from 'lucide-react-native';

export default function TemplatesScreen() {
  const colors = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const { organization, companyName, allOrganizations } = useTenant();
  const { profile } = useAuth();

  // Multi-Organization & Hospital Unit Selector State
  const initialOrgId = organization?.id || profile?.organization_id || 'shanti-memorial-hospital';
  const [selectedOrgId, setSelectedOrgId] = useState<string>(initialOrgId);

  // Compute available organizations and units (excluding demo/mock orgs like subedge)
  const availableOrgs = useMemo(() => {
    const list: Array<{ id: string; name: string; type?: string }> = [];
    const seen = new Set<string>();

    const addOrg = (id: string, name: string, type?: string) => {
      if (!id || !name) return;
      const key = id.toLowerCase().trim();
      // Block dummy mock 'subedge' from appearing for hospital tenants
      if (key === 'subedge' || key === 'subedge_org' || name.toLowerCase().includes('subedge')) return;
      if (!seen.has(key)) {
        seen.add(key);
        list.push({ id, name, type });
      }
    };

    // 1. Current active organization
    if (organization?.id && organization.name) {
      addOrg(organization.id, organization.name, 'Primary Hospital');
    }

    // 2. Child units / organizations from allOrganizations
    if (allOrganizations && allOrganizations.length > 0) {
      allOrganizations.forEach((o) => {
        if (o.id && o.name) {
          addOrg(o.id, o.name, o.parent_organization_id ? 'Unit' : 'Organization');
        }
      });
    }

    // 3. For Shanti Memorial Hospital, ensure all 3 verified hospital units are present
    const isSMHGroup =
      organization?.id === 'shanti-memorial-hospital' ||
      organization?.id === 'smh' ||
      profile?.organization_id === 'shanti-memorial-hospital' ||
      list.some((o) => o.name.toLowerCase().includes('shanti') || o.name.toLowerCase().includes('memorial'));

    if (isSMHGroup || list.length === 0) {
      addOrg('shanti-memorial-hospital', 'Shanti Memorial Hospital', 'Main Hospital');
      addOrg('gopal-trust', 'Gopal Trust', 'Healthcare Unit');
      addOrg('chikitsa', 'Chikitsa', 'Hospital Unit');
    }

    return list;
  }, [organization, allOrganizations, profile?.organization_id]);

  const selectedOrg = useMemo(() => {
    const match = availableOrgs.find((o) => o.id === selectedOrgId);
    if (match) return match;
    if (selectedOrgId === 'gopal-trust') return { id: 'gopal-trust', name: 'Gopal Trust' };
    if (selectedOrgId === 'chikitsa') return { id: 'chikitsa', name: 'Chikitsa' };
    if (selectedOrgId === 'shanti-memorial-hospital' || selectedOrgId === 'smh') {
      return { id: 'shanti-memorial-hospital', name: 'Shanti Memorial Hospital' };
    }
    return {
      id: selectedOrgId,
      name: organization?.name || companyName || 'Shanti Memorial Hospital',
    };
  }, [availableOrgs, selectedOrgId, organization?.name, companyName]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [activeTab, setActiveTab] = useState<'document' | 'email'>('document');
  const [selectedKey, setSelectedKey] = useState<string>('appointment_letter');
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [feedback, setFeedback] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [salutation, setSalutation] = useState('');
  const [body, setBody] = useState('');
  const [clauses, setClauses] = useState<string[]>([]);
  const [signatoryName, setSignatoryName] = useState('');
  const [signatoryTitle, setSignatoryTitle] = useState('');
  const [newClause, setNewClause] = useState('');

  const loadAll = async (targetOrgId: string, targetOrgName: string) => {
    try {
      setLoading(true);
      const data = await getTemplates(targetOrgId, targetOrgName);
      setTemplates(data);

      // Select matching template or first in active tab
      const current = data.find((t) => t.key === selectedKey);
      if (!current || current.type !== activeTab) {
        const firstInTab = data.find((t) => t.type === activeTab);
        if (firstInTab) {
          selectTemplate(firstInTab);
        }
      } else {
        selectTemplate(current);
      }
    } catch (e) {
      console.error('Failed to load templates:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll(selectedOrgId, selectedOrg.name);
  }, [selectedOrgId]);

  const selectTemplate = (tpl: DocumentTemplate) => {
    setSelectedKey(tpl.key);
    setName(tpl.name || '');
    setSubject(tpl.subject || '');
    setTitle(tpl.title || '');
    setSubtitle(tpl.subtitle || '');
    setSalutation(tpl.salutation || '');
    setBody(tpl.body || '');
    setClauses(tpl.clauses ? [...tpl.clauses] : []);
    setSignatoryName(tpl.signatory_name || '');
    setSignatoryTitle(tpl.signatory_title || '');
    setNewClause('');
  };

  const handleTabChange = (tab: 'document' | 'email') => {
    setActiveTab(tab);
    const firstInTab = templates.find((t) => t.type === tab);
    if (firstInTab) {
      selectTemplate(firstInTab);
    }
  };

  const currentTemplate = useMemo(() => {
    return templates.find((t) => t.key === selectedKey);
  }, [templates, selectedKey]);

  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => t.type === activeTab);
  }, [templates, activeTab]);

  const customTemplatesCount = useMemo(() => {
    return templates.filter((t) => t.is_custom).length;
  }, [templates]);

  const handleInsertVariable = (varKey: string) => {
    setBody((prev) => `${prev} ${varKey} `);
    showNotice(`Inserted ${varKey}`);
  };

  const handleAddClause = () => {
    if (!newClause.trim()) return;
    setClauses((prev) => [...prev, newClause.trim()]);
    setNewClause('');
  };

  const handleRemoveClause = (index: number) => {
    setClauses((prev) => prev.filter((_, i) => i !== index));
  };

  const showNotice = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleSave = async () => {
    if (!currentTemplate) return;
    setSaving(true);
    try {
      const updated: DocumentTemplate = {
        ...currentTemplate,
        id: `${selectedOrgId}_${currentTemplate.key}`,
        organization_id: selectedOrgId,
        name,
        subject: activeTab === 'email' ? subject : undefined,
        title: activeTab === 'document' ? title : undefined,
        subtitle: activeTab === 'document' ? subtitle : undefined,
        salutation,
        body,
        clauses: activeTab === 'document' ? clauses : undefined,
        signatory_name: signatoryName,
        signatory_title: signatoryTitle,
        updated_at: new Date().toISOString(),
        updated_by: profile?.full_name || 'Admin',
        is_custom: true,
      };

      await saveTemplate(updated);
      setTemplates((prev) => prev.map((t) => (t.key === updated.key ? updated : t)));
      showNotice(`Template saved specifically for ${selectedOrg.name}!`);
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Could not save template');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!currentTemplate) return;
    Alert.alert(
      'Reset Template for Organization',
      `Are you sure you want to reset "${currentTemplate.name}" to the default format for ${selectedOrg.name}? Custom modifications will be discarded.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset to Org Default',
          style: 'destructive',
          onPress: async () => {
            try {
              const def = await resetTemplate(selectedOrgId, currentTemplate.key, selectedOrg.name);
              setTemplates((prev) => prev.map((t) => (t.key === def.key ? def : t)));
              selectTemplate(def);
              showNotice(`Reset template to default format for ${selectedOrg.name}.`);
            } catch (err: any) {
              Alert.alert('Reset Failed', err.message);
            }
          },
        },
      ]
    );
  };

  // Sample data dictionary for Live Preview and PDF Export
  const isSMH = selectedOrgId === 'shanti-memorial-hospital' || selectedOrgId === 'smh';
  const isGopal = selectedOrgId === 'gopal-trust';
  const isChikitsa = selectedOrgId === 'chikitsa';

  const sampleData: Record<string, string> = {
    employee_name: isSMH
      ? 'Dr. Priya Sharma'
      : isGopal
      ? 'Sunita Behera'
      : isChikitsa
      ? 'Rajesh Mohanty'
      : 'Alex Morgan',
    employee_code: isSMH
      ? 'SMH-1021'
      : isGopal
      ? 'GT-014'
      : isChikitsa
      ? 'CHK-045'
      : 'EMP-1021',
    designation: isSMH
      ? 'Senior Consultant Physician'
      : isGopal
      ? 'Healthcare Coordinator'
      : isChikitsa
      ? 'Staff Nurse / Clinical Care'
      : 'Senior Operations Lead',
    department: isSMH
      ? 'Internal Medicine & Critical Care'
      : isGopal
      ? 'Patient Care & Trust Services'
      : isChikitsa
      ? 'Nursing & Emergency Care'
      : 'Operations & Facilities',
    unit: isSMH
      ? 'Central Hospital Campus'
      : isGopal
      ? 'Gopal Trust Healthcare Unit'
      : isChikitsa
      ? 'Chikitsa Multi-Specialty Unit'
      : 'Headquarters Campus',
    organization_name: selectedOrg.name,
    joining_date: '15 Jan 2026',
    relieving_date: '31 Oct 2026',
    effective_date: '01 Nov 2026',
    basic_salary: '₹25,000',
    gross_salary: '₹50,000',
    annual_salary: '₹6,00,000',
    net_salary: '₹47,200',
    ref_number: isSMH
      ? 'SMH/HR/APT/2026/1021'
      : isGopal
      ? 'GT/HR/APT/2026/014'
      : isChikitsa
      ? 'CSMH/HR/APT/2026/045'
      : 'HR/APT/2026/EMP-1021',
    signatory_name: signatoryName || (isSMH ? 'Medical Superintendent' : isGopal ? 'Gopal Trust Administration' : isChikitsa ? 'Chikitsa Administration' : 'Authorized Signatory'),
    signatory_title: signatoryTitle || (isSMH ? 'Office of Medical Administration & HR' : isGopal ? 'Trust Administrator / HR Lead' : isChikitsa ? 'Medical Administrator / HR Lead' : 'Head of Human Resources'),
    portal_url: 'https://workforce.company.com',
    user_email: isSMH
      ? 'priya.sharma@shantihospital.com'
      : isGopal
      ? 'sunita.behera@gopaltrust.org'
      : isChikitsa
      ? 'rajesh.mohanty@chikitsa.org'
      : 'alex.morgan@company.com',
    temporary_password: 'Password@123',
    month: 'October',
    year: '2026',
    cycle_name: 'Annual Performance Appraisal 2026',
    self_review_deadline: '15 Nov 2026',
    manager_review_deadline: '30 Nov 2026',
    status: 'Approved',
    start_date: '01 Nov 2026',
    end_date: '05 Nov 2026',
    days: '5',
    remarks: 'Approved as per organization leave policy quota',
    remaining_balance: '14',
    date: new Date().toLocaleDateString('en-GB'),
  };

  const renderedSubject = renderTemplateString(subject, sampleData);
  const renderedTitle = renderTemplateString(title, sampleData);
  const renderedSubtitle = renderTemplateString(subtitle, sampleData);
  const renderedSalutation = renderTemplateString(salutation, sampleData);
  const renderedBody = renderTemplateString(body, sampleData);
  const renderedClauses = clauses.map((c) => renderTemplateString(c, sampleData));

  const handleTestPrintPdf = async () => {
    if (activeTab !== 'document') return;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${renderedTitle}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #0F172A; line-height: 1.6; }
          .header { border-bottom: 2px solid #006a61; padding-bottom: 16px; margin-bottom: 24px; }
          .org-name { font-size: 22px; font-weight: 800; color: #006a61; }
          .sub { font-size: 13px; color: #64748B; }
          .title { font-size: 18px; font-weight: 800; text-align: center; margin: 24px 0; text-decoration: underline; }
          .salutation { font-weight: 700; margin-bottom: 12px; }
          .body { font-size: 14px; margin-bottom: 16px; white-space: pre-wrap; }
          .clause { font-size: 13px; margin-bottom: 8px; color: #334155; }
          .sign-grid { margin-top: 48px; display: flex; justify-content: space-between; }
          .sign-box { border-top: 1px solid #94A3B8; padding-top: 8px; width: 220px; font-size: 13px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="org-name">${sampleData.organization_name}</div>
          <div class="sub">${sampleData.unit} · ${renderedSubtitle}</div>
        </div>
        <div class="title">${renderedTitle}</div>
        <div class="salutation">${renderedSalutation}</div>
        <div class="body">${renderedBody}</div>
        ${renderedClauses.map((c) => `<div class="clause">${c}</div>`).join('')}
        <div class="sign-grid">
          <div class="sign-box">
            <strong>${sampleData.employee_name}</strong><br/>
            Employee Acceptance
          </div>
          <div class="sign-box" style="text-align: right;">
            <strong>${signatoryName || 'Authorized Signatory'}</strong><br/>
            ${signatoryTitle || 'Human Resources'}
          </div>
        </div>
      </body>
      </html>
    `;
    await exportOrPrintPdf(html, `${selectedKey}_${selectedOrgId}.pdf`);
  };

  if (loading) return <LoadingState />;

  return (
    <SidebarLayout>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Top Header */}
        <View style={[styles.topBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text style={[styles.pageTitle, { color: colors.text }]}>Document & Email Templates</Text>
              <Badge label="ORG SPECIFIC" variant="accentLight" />
            </View>
            <Text style={[styles.pageSubtitle, { color: colors.textSecondary }]}>
              Customize official letters, clauses, and email notifications linked specifically to your organization.
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {feedback ? (
              <View style={styles.feedbackPill}>
                <CheckCircle2 size={14} color="#059669" />
                <Text style={styles.feedbackText}>{feedback}</Text>
              </View>
            ) : null}

            <Button
              title="Reset Org Default"
              icon={<RotateCcw size={14} color={colors.text} />}
              onPress={handleReset}
              variant="outline"
              size="sm"
            />
            <Button
              title={saving ? 'Saving...' : 'Save for Org'}
              icon={<Save size={14} color="#FFF" />}
              onPress={handleSave}
              disabled={saving}
              size="sm"
              style={{ backgroundColor: colors.primary }}
            />
          </View>
        </View>

        {/* Target Organization Selector Bar */}
        <View style={[styles.orgSelectorBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <View style={styles.orgSelectorHeader}>
            <Building2 size={16} color={colors.primary} />
            <Text style={[styles.orgSelectorLabel, { color: colors.text }]}>Target Organization:</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.orgPillsContainer}>
            {availableOrgs.map((org) => {
              const isSelected = selectedOrgId === org.id;
              return (
                <TouchableOpacity
                  key={org.id}
                  onPress={() => setSelectedOrgId(org.id)}
                  style={[
                    styles.orgPill,
                    {
                      borderColor: isSelected ? colors.primary : colors.border,
                      backgroundColor: isSelected ? colors.primary + '15' : colors.surface,
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.orgPillText,
                      {
                        color: isSelected ? colors.primary : colors.textSecondary,
                        fontWeight: isSelected ? '700' : '500',
                      },
                    ]}
                  >
                    {org.name}
                  </Text>
                  {isSelected && <Check size={14} color={colors.primary} strokeWidth={2.5} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={[styles.customCountText, { color: colors.textSecondary }]}>
            {customTemplatesCount} customized for {selectedOrg.name}
          </Text>
        </View>

        {/* Main Content Layout */}
        <View style={[styles.mainLayout, isDesktop && styles.mainLayoutDesktop]}>
          {/* Left Column: Template Selector & Category */}
          <View style={[styles.leftNav, isDesktop && styles.leftNavDesktop, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* Category Toggle */}
            <View style={styles.categoryToggle}>
              <TouchableOpacity
                onPress={() => handleTabChange('document')}
                style={[
                  styles.catBtn,
                  activeTab === 'document' && { backgroundColor: colors.primary },
                ]}
              >
                <FileText size={16} color={activeTab === 'document' ? '#FFF' : colors.textSecondary} />
                <Text
                  style={[
                    styles.catBtnText,
                    { color: activeTab === 'document' ? '#FFF' : colors.textSecondary },
                  ]}
                >
                  Letters
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleTabChange('email')}
                style={[
                  styles.catBtn,
                  activeTab === 'email' && { backgroundColor: colors.primary },
                ]}
              >
                <Mail size={16} color={activeTab === 'email' ? '#FFF' : colors.textSecondary} />
                <Text
                  style={[
                    styles.catBtnText,
                    { color: activeTab === 'email' ? '#FFF' : colors.textSecondary },
                  ]}
                >
                  Emails
                </Text>
              </TouchableOpacity>
            </View>

            {/* Template List */}
            <ScrollView style={{ flex: 1, marginTop: 12 }}>
              <View style={{ gap: 8 }}>
                {filteredTemplates.map((tpl) => {
                  const isSelected = tpl.key === selectedKey;
                  return (
                    <TouchableOpacity
                      key={tpl.key}
                      onPress={() => selectTemplate(tpl)}
                      style={[
                        styles.tplItem,
                        { borderColor: isSelected ? colors.primary : colors.border },
                        isSelected && { backgroundColor: colors.primary + '10' },
                      ]}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text
                          style={[
                            styles.tplItemName,
                            { color: isSelected ? colors.primary : colors.text, fontWeight: isSelected ? '700' : '600' },
                          ]}
                          numberOfLines={1}
                        >
                          {tpl.name}
                        </Text>
                        <ChevronRight size={14} color={isSelected ? colors.primary : colors.textSecondary} />
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        {tpl.is_custom ? (
                          <View style={[styles.customBadge, { backgroundColor: '#DCFCE7' }]}>
                            <Sparkles size={10} color="#15803D" />
                            <Text style={[styles.customBadgeText, { color: '#15803D' }]}>Customized</Text>
                          </View>
                        ) : (
                          <View style={[styles.customBadge, { backgroundColor: '#F1F5F9' }]}>
                            <Text style={[styles.customBadgeText, { color: '#64748B' }]}>Org Default</Text>
                          </View>
                        )}
                      </View>

                      <Text style={[styles.tplItemDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                        {tpl.description}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>

          {/* Right Column: Editor & Preview */}
          <View style={[styles.rightContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* Action Bar / Mode Switcher */}
            <View style={[styles.editorHeader, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={[styles.editorTitle, { color: colors.text }]}>{name}</Text>
                  {currentTemplate?.is_custom && (
                    <Badge label={`Customized for ${selectedOrg.name}`} variant="success" />
                  )}
                </View>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                  Linked to: <Text style={{ fontWeight: '700', color: colors.primary }}>{selectedOrg.name}</Text> ({selectedOrgId}) • {customTemplatesCount} customized templates
                </Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {activeTab === 'document' && (
                  <Button
                    title="Export Sample PDF"
                    icon={<Printer size={14} color={colors.text} />}
                    onPress={handleTestPrintPdf}
                    variant="outline"
                    size="sm"
                  />
                )}

                <View style={[styles.modeToggle, { backgroundColor: colors.background }]}>
                  <TouchableOpacity
                    onPress={() => setMode('edit')}
                    style={[styles.modeBtn, mode === 'edit' && { backgroundColor: colors.surface }]}
                  >
                    <Edit3 size={14} color={mode === 'edit' ? colors.primary : colors.textSecondary} />
                    <Text style={[styles.modeBtnText, { color: mode === 'edit' ? colors.primary : colors.textSecondary }]}>
                      Edit Format
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setMode('preview')}
                    style={[styles.modeBtn, mode === 'preview' && { backgroundColor: colors.surface }]}
                  >
                    <Eye size={14} color={mode === 'preview' ? colors.primary : colors.textSecondary} />
                    <Text style={[styles.modeBtnText, { color: mode === 'preview' ? colors.primary : colors.textSecondary }]}>
                      Live Preview
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Variable Tags Palette Toolbar */}
            <View style={[styles.variableBar, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Sparkles size={14} color={colors.primary} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary }}>
                  CLICK TO INSERT DYNAMIC VARIABLES:
                </Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {TEMPLATE_VARIABLES.map((v) => (
                  <TouchableOpacity
                    key={v.key}
                    onPress={() => handleInsertVariable(v.key)}
                    style={[styles.varChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  >
                    <Text style={[styles.varChipText, { color: colors.text }]}>{v.key}</Text>
                    <Text style={styles.varChipSub}>{v.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Mode Content */}
            <ScrollView style={{ flex: 1, padding: 20 }}>
              {mode === 'edit' ? (
                <View style={{ gap: 16 }}>
                  {/* Title & Subject */}
                  {activeTab === 'email' ? (
                    <View style={styles.formGroup}>
                      <Text style={[styles.formLabel, { color: colors.text }]}>Email Subject Line *</Text>
                      <TextInput
                        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                        value={subject}
                        onChangeText={setSubject}
                        placeholder="e.g. Welcome to {{organization_name}}"
                        placeholderTextColor={colors.textSecondary}
                      />
                    </View>
                  ) : (
                    <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 12 }}>
                      <View style={[styles.formGroup, { flex: 1 }]}>
                        <Text style={[styles.formLabel, { color: colors.text }]}>Document Header Title *</Text>
                        <TextInput
                          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                          value={title}
                          onChangeText={setTitle}
                          placeholder="e.g. LETTER OF APPOINTMENT"
                          placeholderTextColor={colors.textSecondary}
                        />
                      </View>
                      <View style={[styles.formGroup, { flex: 1 }]}>
                        <Text style={[styles.formLabel, { color: colors.text }]}>Document Subtitle</Text>
                        <TextInput
                          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                          value={subtitle}
                          onChangeText={setSubtitle}
                          placeholder="e.g. Workforce & Talent Acquisition"
                          placeholderTextColor={colors.textSecondary}
                        />
                      </View>
                    </View>
                  )}

                  {/* Salutation */}
                  <View style={styles.formGroup}>
                    <Text style={[styles.formLabel, { color: colors.text }]}>Opening Salutation</Text>
                    <TextInput
                      style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                      value={salutation}
                      onChangeText={setSalutation}
                      placeholder="e.g. Dear {{employee_name}},"
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>

                  {/* Body Content */}
                  <View style={styles.formGroup}>
                    <Text style={[styles.formLabel, { color: colors.text }]}>Main Body Text / Introductory Clauses</Text>
                    <TextInput
                      style={[
                        styles.input,
                        styles.textArea,
                        { color: colors.text, borderColor: colors.border, backgroundColor: colors.background },
                      ]}
                      value={body}
                      onChangeText={setBody}
                      multiline
                      numberOfLines={6}
                      placeholder="Enter body content here..."
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>

                  {/* Document Clauses Section */}
                  {activeTab === 'document' && (
                    <View style={styles.formGroup}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <Text style={[styles.formLabel, { color: colors.text, marginBottom: 0 }]}>
                          Terms & Conditions Clauses ({clauses.length})
                        </Text>
                      </View>

                      {clauses.map((clause, idx) => (
                        <View key={idx} style={[styles.clauseRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
                          <TextInput
                            style={[styles.clauseInput, { color: colors.text }]}
                            value={clause}
                            onChangeText={(text) => {
                              const updated = [...clauses];
                              updated[idx] = text;
                              setClauses(updated);
                            }}
                            multiline
                          />
                          <TouchableOpacity onPress={() => handleRemoveClause(idx)} style={styles.deleteClauseBtn}>
                            <Trash2 size={16} color="#DC2626" />
                          </TouchableOpacity>
                        </View>
                      ))}

                      {/* Add Clause Input */}
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                        <TextInput
                          style={[styles.input, { flex: 1, color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                          placeholder="Add new clause (e.g. 7. Statutory Compliances...)"
                          placeholderTextColor={colors.textSecondary}
                          value={newClause}
                          onChangeText={setNewClause}
                        />
                        <Button
                          title="+ Add Clause"
                          onPress={handleAddClause}
                          size="sm"
                          style={{ backgroundColor: colors.primary }}
                        />
                      </View>
                    </View>
                  )}

                  {/* Signatory Settings */}
                  <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 12, marginTop: 10 }}>
                    <View style={[styles.formGroup, { flex: 1 }]}>
                      <Text style={[styles.formLabel, { color: colors.text }]}>Default Signatory Name</Text>
                      <TextInput
                        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                        value={signatoryName}
                        onChangeText={setSignatoryName}
                        placeholder="e.g. Authorized Signatory"
                        placeholderTextColor={colors.textSecondary}
                      />
                    </View>
                    <View style={[styles.formGroup, { flex: 1 }]}>
                      <Text style={[styles.formLabel, { color: colors.text }]}>Signatory Title</Text>
                      <TextInput
                        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                        value={signatoryTitle}
                        onChangeText={setSignatoryTitle}
                        placeholder="e.g. Head of Human Resources"
                        placeholderTextColor={colors.textSecondary}
                      />
                    </View>
                  </View>
                </View>
              ) : (
                /* LIVE PREVIEW CONTAINER */
                <View style={[styles.previewPaper, { backgroundColor: '#FFF', borderColor: '#CBD5E1' }]}>
                  {activeTab === 'email' ? (
                    <View style={styles.emailPreviewBox}>
                      <View style={styles.emailHeaderBar}>
                        <Text style={styles.emailSubjectText}>Subject: {renderedSubject}</Text>
                        <Badge label="TRANSACTIONAL EMAIL" variant="neutral" />
                      </View>
                      <View style={{ padding: 24, gap: 14 }}>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: '#0F172A' }}>{renderedSalutation}</Text>
                        <Text style={{ fontSize: 14, color: '#334155', lineHeight: 22 }}>
                          {renderedBody}
                        </Text>
                        <View style={{ borderTopWidth: 1, borderColor: '#E2E8F0', paddingTop: 16, marginTop: 12 }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>
                            {sampleData.organization_name} — People Operations
                          </Text>
                          <Text style={{ fontSize: 11, color: '#64748B' }}>
                            This is an automated system email. Please do not reply directly to this notice.
                          </Text>
                        </View>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.docPreviewBox}>
                      {/* Document Letterhead */}
                      <View style={styles.docHeader}>
                        <View>
                          <Text style={styles.docOrgName}>{sampleData.organization_name}</Text>
                          <Text style={styles.docOrgUnit}>{sampleData.unit} · {renderedSubtitle}</Text>
                        </View>
                        <Badge label="OFFICIAL DOCUMENT" variant="success" />
                      </View>

                      <View style={styles.docMeta}>
                        <Text style={styles.docMetaText}>Ref: {sampleData.ref_number}</Text>
                        <Text style={styles.docMetaText}>Date: {sampleData.date}</Text>
                      </View>

                      <Text style={styles.docTitle}>{renderedTitle}</Text>

                      <Text style={styles.docSalutation}>{renderedSalutation}</Text>
                      <Text style={styles.docBody}>{renderedBody}</Text>

                      {renderedClauses.length > 0 && (
                        <View style={{ gap: 8, marginVertical: 12 }}>
                          {renderedClauses.map((c, i) => (
                            <Text key={i} style={styles.docClauseText}>
                              {c}
                            </Text>
                          ))}
                        </View>
                      )}

                      {/* Signatory Footers */}
                      <View style={styles.docSignatureRow}>
                        <View style={styles.docSignBox}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>{sampleData.employee_name}</Text>
                          <Text style={{ fontSize: 11, color: '#64748B' }}>Employee Acceptance & Signature</Text>
                        </View>
                        <View style={[styles.docSignBox, { alignItems: 'flex-end' }]}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>{signatoryName || 'Authorized Signatory'}</Text>
                          <Text style={{ fontSize: 11, color: '#64748B' }}>{signatoryTitle || 'Human Resources Director'}</Text>
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </View>
    </SidebarLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    flexWrap: 'wrap',
    gap: 12,
  },
  pageTitle: { fontSize: 20, fontWeight: '800' },
  pageSubtitle: { fontSize: 12, marginTop: 2 },
  orgSelectorBar: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  orgSelectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  orgSelectorLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  orgPillsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orgPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  orgPillText: {
    fontSize: 13,
  },
  customCountText: {
    fontSize: 12,
    marginLeft: 'auto',
  },
  orgNameBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  orgNameText: {
    fontSize: 12,
    fontWeight: '700',
  },
  feedbackPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  feedbackText: { fontSize: 12, color: '#166534', fontWeight: '700' },
  mainLayout: { flex: 1, flexDirection: 'column' },
  mainLayoutDesktop: { flexDirection: 'row' },
  leftNav: { width: '100%', borderRightWidth: 1, padding: 16 },
  leftNavDesktop: { width: 320 },
  categoryToggle: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 3,
    gap: 4,
  },
  catBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 6,
  },
  catBtnText: { fontSize: 13, fontWeight: '700' },
  tplItem: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#FFF',
  },
  tplItemName: { fontSize: 13, flex: 1 },
  tplItemDesc: { fontSize: 11, marginTop: 4, lineHeight: 15 },
  customBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  customBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  rightContent: { flex: 1, flexDirection: 'column' },
  editorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    flexWrap: 'wrap',
    gap: 12,
  },
  editorTitle: { fontSize: 16, fontWeight: '700' },
  modeToggle: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  modeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  modeBtnText: { fontSize: 12, fontWeight: '600' },
  variableBar: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  varChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
  },
  varChipText: { fontSize: 11, fontWeight: '700', fontFamily: 'monospace' },
  varChipSub: { fontSize: 9, color: '#64748B', marginTop: 1 },
  formGroup: { gap: 6 },
  formLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  input: {
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  textArea: {
    height: 120,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  clauseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
    gap: 8,
  },
  clauseInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 4,
  },
  deleteClauseBtn: {
    padding: 6,
  },
  previewPaper: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 40,
  },
  emailPreviewBox: { flex: 1 },
  emailHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  emailSubjectText: { fontSize: 14, fontWeight: '700', color: '#0F172A', flex: 1, marginRight: 10 },
  docPreviewBox: { padding: 36, gap: 14 },
  docHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 2,
    borderColor: '#006a61',
    paddingBottom: 16,
  },
  docOrgName: { fontSize: 20, fontWeight: '800', color: '#006a61' },
  docOrgUnit: { fontSize: 12, color: '#64748B', marginTop: 2 },
  docMeta: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 6 },
  docMetaText: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  docTitle: { fontSize: 16, fontWeight: '800', textAlign: 'center', textDecorationLine: 'underline', marginVertical: 12 },
  docSalutation: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  docBody: { fontSize: 13, color: '#334155', lineHeight: 22 },
  docClauseText: { fontSize: 12, color: '#334155', lineHeight: 18 },
  docSignatureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 40,
    paddingTop: 16,
  },
  docSignBox: { width: 220, borderTopWidth: 1, borderColor: '#CBD5E1', paddingTop: 8 },
});
