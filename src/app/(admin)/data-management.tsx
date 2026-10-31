import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions, Alert, TextInput, Modal as RNModal } from 'react-native';
import { ADMIN_NAV } from '@/constants/navigation';
import { SidebarLayout } from '@/components/layout/Sidebar';
import { useTheme } from '@/hooks/use-theme';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Download, Upload, FileText, FileSpreadsheet, CheckCircle2, AlertCircle, Search, X, Eye, Clock } from 'lucide-react-native';
import { Select } from '@/components/ui/Select';
import { useTenant } from '@/context/TenantContext';
import { useAuth } from '@/hooks/useAuth';
import { IMPORT_MODULES, downloadTemplate, processImport } from '@/lib/services/importExport';
import { generateReport } from '@/lib/services/reports';
import { importExcelObjects } from '@/utils/excel';
import { LateComersOverviewView } from '@/components/attendance/LateComersOverviewView';

export default function DataManagementScreen() {
  const colors = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const { organization } = useTenant();
  const { profile } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [searchQuery, setSearchQuery] = useState('');
  const [importing, setImporting] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [selectedModule, setSelectedModule] = useState<string>('employees');
  const [showLateOverview, setShowLateOverview] = useState(false);
  
  const reports = [
    { id: 'employee', name: 'Employee Directory', desc: 'Basic details of all employees', badge: 'MASTER' },
    { id: 'onboarding', name: 'Onboarding Report', desc: 'Employee ID, Designation, DOJ, Onboarding status, etc.', badge: 'HR' },
    { id: 'attendance', name: 'Attendance Report', desc: 'Monthly attendance summary', badge: 'TIME' },
    { id: 'late_attendance', name: 'Late Attendance Report', desc: 'Employees marked late', badge: 'TIME' },
    { id: 'leave', name: 'Leave Report', desc: 'Leave balances and history', badge: 'LEAVE' },
    { id: 'payroll', name: 'Payroll Report', desc: 'Monthly payroll processing details (PF & Non-PF 26-column tabs)', badge: 'PAYROLL' },
    { id: 'salary', name: 'Salary Register', desc: 'Salary breakdown for all employees (Hospital 26-column format)', badge: '26-COL' },
    { id: 'pf', name: 'PF / EPF Report', desc: 'Provident fund contribution summary (Hospital PF Salary Sheet in 26-column format)', badge: 'IMAGE 1' },
    { id: 'non_pf', name: 'Non-PF Salary Sheet', desc: 'Hospital Non-PF / Consultant Staff Salary Sheet in 26-column format', badge: 'IMAGE 2' },
    { id: 'epfo_ecr', name: 'EPFO ECR Text File (.txt)', desc: 'Official EPFO Electronic Challan cum Return file with #~# delimiter', badge: 'STATUTORY' },
    { id: 'esic_challan', name: 'ESIC Monthly Return (.xlsx)', desc: 'Official ESIC contribution upload spreadsheet (0.75% EE + 3.25% ER)', badge: 'STATUTORY' },
    { id: 'gratuity_statement', name: 'Gratuity Statutory Register', desc: 'Compliance audit register under Payment of Gratuity Act, 1972', badge: 'AUDIT' },
    { id: 'consolidated_appraisal', name: 'Consolidated Appraisal Report', desc: 'Master report viewing performance appraisal of all staff at one time', badge: 'APPRAISAL' },
  ];

  const filteredReports = useMemo(() => {
    if (!searchQuery.trim()) return reports;
    const q = searchQuery.toLowerCase();
    return reports.filter(
      (r) => r.name.toLowerCase().includes(q) || r.desc.toLowerCase().includes(q) || r.badge.toLowerCase().includes(q)
    );
  }, [reports, searchQuery]);

  const handleDownloadTemplate = async () => {
    try {
      await downloadTemplate(selectedModule);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to download template');
    }
  };

  const handleUploadAndImport = async () => {
    try {
      const sheets = await importExcelObjects();
      if (!sheets) {
        return;
      }
      const orgId = organization?.id || profile?.organization_id;
      if (!orgId) throw new Error('Organization not found');

      setImporting(true);
      setImportResult(null);

      const result = await processImport(orgId, selectedModule, sheets);
      setImportResult(result);
    } catch (e: any) {
      Alert.alert('Import Failed', e.message || 'Failed to import records');
    } finally {
      setImporting(false);
    }
  };

  const handleExport = async (reportId: string) => {
    try {
      const orgId = organization?.id || profile?.organization_id;
      if (!orgId) throw new Error('Organization not found');
      setExportingId(reportId);
      await generateReport(orgId, reportId);
    } catch (e: any) {
      Alert.alert('Export Failed', e.message || 'Failed to generate report');
    } finally {
      setExportingId(null);
    }
  };

  return (
    <SidebarLayout items={ADMIN_NAV}>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Data Management & Reports</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Import records or export comprehensive HR and Payroll reports.
          </Text>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'export' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]} 
            onPress={() => setActiveTab('export')}
          >
            <Text style={[styles.tabText, activeTab === 'export' && { color: colors.primary, fontWeight: '700' }]}>Export Reports</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'import' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]} 
            onPress={() => setActiveTab('import')}
          >
            <Text style={[styles.tabText, activeTab === 'import' && { color: colors.primary, fontWeight: '700' }]}>Import Data</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'export' && (
          <View style={{ gap: 16 }}>
            {/* Search Bar */}
            <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: '#e2e8f0' }]}>
              <Search size={16} color={colors.textSecondary} />
              <TextInput
                placeholder="Search employees, departments, reports..."
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

            {/* Late Comers Live Overview Quick Access Banner */}
            <View style={[styles.overviewBanner, { backgroundColor: '#e6f3f1', borderColor: '#b2ded8' }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Clock size={16} color="#006a61" />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#006a61' }}>
                    Late & Absent Live Overview
                  </Text>
                  <Badge label="NO DOWNLOAD NEEDED" variant="accentLight" />
                </View>
                <Text style={{ fontSize: 12, color: '#334155' }}>
                  Inspect daily punch-in times, absences, grace limits (3/month), and 0.5 / 1.0 LOP penalties directly on-screen instead of repeatedly downloading files.
                </Text>
              </View>
              <Button
                title="Open Live Overview"
                icon={<Eye size={14} color="#FFF" />}
                onPress={() => setShowLateOverview(true)}
                size="sm"
                style={{ backgroundColor: '#006a61' }}
              />
            </View>

            <View style={styles.grid}>
              {filteredReports.map((report) => (
                <View key={report.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: '#e2e8f0' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={[styles.iconWrap, { backgroundColor: '#f0f9ff' }]}>
                      <FileText size={20} color="#0284c7" />
                    </View>
                    <Badge label={report.badge} variant={report.badge.includes('IMAGE') || report.badge === '26-COL' ? 'accentLight' : 'neutral'} />
                  </View>
                  <View style={{ marginTop: 12, flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>{report.name}</Text>
                    <Text style={[styles.cardSub, { color: colors.textSecondary }]}>{report.desc}</Text>
                  </View>

                  {report.id === 'late_attendance' ? (
                    <View style={{ gap: 8, marginTop: 16 }}>
                      <Button
                        title="View Live Overview"
                        icon={<Eye size={14} color="#FFF" />}
                        onPress={() => setShowLateOverview(true)}
                        style={{ backgroundColor: '#006a61' }}
                        size="sm"
                      />
                      <Button
                        title={exportingId === report.id ? 'Generating...' : 'Export CSV'}
                        icon={<Download size={14} color={colors.text} />}
                        onPress={() => handleExport(report.id)}
                        loading={exportingId === report.id}
                        variant="outline"
                        size="sm"
                      />
                    </View>
                  ) : (
                    <Button
                      title={exportingId === report.id ? 'Generating...' : 'Export CSV'}
                      icon={<Download size={14} color="#FFF" />}
                      onPress={() => handleExport(report.id)}
                      loading={exportingId === report.id}
                      style={{ marginTop: 16, backgroundColor: colors.primary }}
                      size="sm"
                    />
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {activeTab === 'import' && (
          <View style={{ gap: 20 }}>
            <View style={[styles.fullCard, { backgroundColor: colors.surface, borderColor: '#e2e8f0' }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconWrap, { backgroundColor: '#f0fdf4' }]}>
                  <FileSpreadsheet size={20} color="#16a34a" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>1. Select Dataset & Download Template</Text>
                  <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
                    Select the data you want to import and download its specific Excel template.
                  </Text>
                </View>
              </View>
              <View style={{ gap: 16 }}>
                <Select
                  label="Select Dataset"
                  options={IMPORT_MODULES.map(m => ({ label: m.name, value: m.id }))}
                  value={selectedModule}
                  onValueChange={(v) => setSelectedModule(v)}
                />
                <Button
                  title="Download Sample Template"
                  icon={<Download size={16} color="#000" />}
                  onPress={handleDownloadTemplate}
                  variant="outline"
                  style={{ alignSelf: 'flex-start' }}
                />
              </View>
            </View>

            <View style={[styles.fullCard, { backgroundColor: colors.surface, borderColor: '#e2e8f0' }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconWrap, { backgroundColor: '#fff7ed' }]}>
                  <Upload size={20} color="#ea580c" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>2. Upload & Validate</Text>
                  <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
                    Upload your filled template to validate and import records into the database. Make sure you delete the sample records from the downloaded template before importing.
                  </Text>
                </View>
              </View>
              
              <Button
                title="Select File & Import"
                onPress={handleUploadAndImport}
                loading={importing}
                style={{ backgroundColor: colors.primary, marginTop: 12, height: 60 }}
              />
              
              {importResult && (
                <View style={{ marginTop: 20, padding: 16, backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 12 }}>Import Summary</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text>Total Rows:</Text>
                    <Text style={{ fontWeight: '600' }}>{importResult.total}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text>Successful:</Text>
                    <Text style={{ fontWeight: '600', color: '#16a34a' }}>{importResult.success}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text>Failed:</Text>
                    <Text style={{ fontWeight: '600', color: '#dc2626' }}>{importResult.failed}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text>Skipped (Duplicates):</Text>
                    <Text style={{ fontWeight: '600', color: '#eab308' }}>{importResult.duplicates}</Text>
                  </View>
                  
                  {importResult.errors.length > 0 && (
                    <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#cbd5e1' }}>
                      <Text style={{ fontWeight: '700', color: '#dc2626', marginBottom: 8 }}>Validation Errors</Text>
                      {importResult.errors.map((err: any, idx: number) => (
                        <Text key={idx} style={{ color: '#dc2626', fontSize: 13 }}>• Row {err.row}: {err.error}</Text>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Late Comers Live Interactive Overview Modal */}
      <RNModal
        visible={showLateOverview}
        animationType="slide"
        onRequestClose={() => setShowLateOverview(false)}
      >
        <LateComersOverviewView
          organizationId={organization?.id || profile?.organization_id}
          onClose={() => setShowLateOverview(false)}
          isModal
        />
      </RNModal>
    </SidebarLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 24, paddingBottom: 60 },
  contentDesktop: { maxWidth: 1000, alignSelf: 'center', width: '100%', padding: 36, gap: 28 },
  header: { gap: 4 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, lineHeight: 20 },
  tabContainer: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  tab: { paddingVertical: 12, paddingHorizontal: 20 },
  tabText: { fontSize: 15, color: '#64748b' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  card: { width: 280, padding: 20, borderRadius: 16, borderWidth: 1, flexGrow: 1 },
  fullCard: { padding: 24, borderRadius: 16, borderWidth: 1, gap: 18 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: { width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardSub: { fontSize: 12, marginTop: 4, lineHeight: 18 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    outlineStyle: 'none' as any,
  },
  overviewBanner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
});
