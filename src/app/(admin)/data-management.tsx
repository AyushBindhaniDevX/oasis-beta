import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions, Alert } from 'react-native';
import { ADMIN_NAV } from '@/constants/navigation';
import { SidebarLayout } from '@/components/layout/Sidebar';
import { useTheme } from '@/hooks/use-theme';
import { Button } from '@/components/ui/Button';
import { Download, Upload, FileText, FileSpreadsheet, CheckCircle2, AlertCircle, Users } from 'lucide-react-native';
import { Select } from '@/components/ui/Select';
import { useTenant } from '@/context/TenantContext';
import { useAuth } from '@/hooks/useAuth';
import { IMPORT_MODULES, downloadTemplate, processImport } from '@/lib/services/importExport';
import { generateReport } from '@/lib/services/reports';
import { importExcelObjects } from '@/utils/excel';
import { seedHospitalInitialMasterData } from '@/lib/services/hospitalMasterData';

export default function DataManagementScreen() {
  const colors = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const { organization } = useTenant();
  const { profile } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [selectedModule, setSelectedModule] = useState<string>('employees');
  const [seeding, setSeeding] = useState(false);

  const handleSeedHospitalData = async () => {
    try {
      const orgId = organization?.id || profile?.organization_id;
      if (!orgId) throw new Error('Organization not found');
      setSeeding(true);
      const res = await seedHospitalInitialMasterData(orgId);
      Alert.alert(
        'Hospital Master Staff Initialized',
        `Processed: ${res.totalProcessed} records\nInserted: ${res.insertedCount} new staff profiles\nSkipped: ${res.skippedCount} (already existing in database)`
      );
    } catch (e: any) {
      Alert.alert('Initialization Failed', e.message || 'Failed to seed hospital master records');
    } finally {
      setSeeding(false);
    }
  };
  
  const reports = [
    { id: 'employee', name: 'Employee Master Directory', desc: 'Complete master details of all hospital employees' },
    { id: 'pf_sheet', name: 'SMH PF Salary Sheet', desc: 'Hospital payroll muster for PF covered employees (Image 1 structure)' },
    { id: 'non_pf_sheet', name: 'SMH Non-PF Salary Sheet', desc: 'Hospital payroll muster for Non-PF / Consultant staff (Image 2 structure)' },
    { id: 'epfo_ecr', name: 'EPFO ECR Text File (.txt)', desc: 'Official EPFO Electronic Challan cum Return file with #~# delimiter' },
    { id: 'esic_challan', name: 'ESIC Monthly Return (.xlsx)', desc: 'Official ESIC contribution upload spreadsheet (0.75% EE + 3.25% ER)' },
    { id: 'gratuity_statement', name: 'Gratuity Statutory Register', desc: 'Compliance audit register under Payment of Gratuity Act, 1972' },
    { id: 'consolidated_appraisal', name: 'Consolidated Appraisal Report', desc: 'Master report viewing performance appraisal of all staff at one time' },
    { id: 'late_attendance', name: 'Late Coming Master Report', desc: 'Individual and consolidated late arrival and punch penalty report' },
    { id: 'leave', name: 'Leave Register (4-Tier Status)', desc: 'Leave requests, 4-tier approval progress, and locked status' },
    { id: 'attendance', name: 'Daily Attendance Report', desc: 'Clock-in, clock-out and shift adherence logs' },
  ];

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
      await generateReport(orgId, reportId);
    } catch (e: any) {
      Alert.alert('Export Failed', e.message || 'Failed to generate report');
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
          <View style={styles.grid}>
            {reports.map((report) => (
              <View key={report.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: '#e2e8f0' }]}>
                <View style={[styles.iconWrap, { backgroundColor: '#f0f9ff' }]}>
                  <FileText size={20} color="#0284c7" />
                </View>
                <View style={{ marginTop: 12, flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{report.name}</Text>
                  <Text style={[styles.cardSub, { color: colors.textSecondary }]}>{report.desc}</Text>
                </View>
                <Button
                  title="Export CSV"
                  icon={<Download size={14} color="#FFF" />}
                  onPress={() => handleExport(report.id)}
                  style={{ marginTop: 16, backgroundColor: colors.primary }}
                  size="sm"
                />
              </View>
            ))}
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

            <View style={[styles.fullCard, { backgroundColor: colors.surface, borderColor: '#e2e8f0' }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconWrap, { backgroundColor: '#f0fdfa' }]}>
                  <Users size={20} color="#0d7377" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>3. Fast Initialization: Hospital Baseline Staff (Requirement 13)</Text>
                  <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
                    Seed initial baseline employee records for Shanti Memorial Hospital and Chikitsa Unit (SMH-1502 Abhiram Hatua, SMH-023 Ajay Swain, SMH-1021 Abhijit Chakrabarty, etc.) with pre-configured hospital departments, PF/Non-PF eligibility, and overtime flags.
                  </Text>
                </View>
              </View>
              
              <Button
                title="Seed Hospital Baseline Staff"
                onPress={handleSeedHospitalData}
                loading={seeding}
                style={{ backgroundColor: '#0d7377', marginTop: 8 }}
              />
            </View>
          </View>
        )}
      </ScrollView>
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
});
