import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions, Alert } from 'react-native';
import { ADMIN_NAV } from '@/constants/navigation';
import { SidebarLayout } from '@/components/layout/Sidebar';
import { useTheme } from '@/hooks/use-theme';
import { Button } from '@/components/ui/Button';
import { Download, Upload, FileText, FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react-native';
import { Input } from '@/components/ui/Input';

export default function DataManagementScreen() {
  const colors = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  
  const reports = [
    { id: 'employee', name: 'Employee Directory', desc: 'Basic details of all employees' },
    { id: 'onboarding', name: 'Onboarding Report', desc: 'Employee ID, Designation, DOJ, Onboarding status, etc.' },
    { id: 'attendance', name: 'Attendance Report', desc: 'Monthly attendance summary' },
    { id: 'late_attendance', name: 'Late Attendance Report', desc: 'Employees marked late' },
    { id: 'leave', name: 'Leave Report', desc: 'Leave balances and history' },
    { id: 'payroll', name: 'Payroll Report', desc: 'Monthly payroll processing details' },
    { id: 'salary', name: 'Salary Register', desc: 'Salary breakdown for all employees' },
    { id: 'pf', name: 'PF / EPF Report', desc: 'Provident fund contribution summary' },
  ];

  const handleDownloadTemplate = () => {
    // Generate a CSV template
    const headers = 'Employee Code,Full Name,Email,Phone,Department,Designation,Date of Joining(DD/MM/YYYY),Basic Salary\nEMP001,John Doe,john@example.com,9876543210,Engineering,Software Engineer,01/01/2026,50000';
    const blob = new Blob([headers], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Oasis_HRMS_Employee_Import_Template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSimulateImport = () => {
    setImporting(true);
    setImportResult(null);
    setTimeout(() => {
      setImporting(false);
      setImportResult({
        total: 10,
        success: 8,
        failed: 1,
        skipped: 1,
        duplicates: 1,
        errors: [{ row: 3, error: 'Invalid Date of Joining format' }]
      });
    }, 2000);
  };

  const handleExport = (reportId: string) => {
    // Simulate generic export
    const content = `Report: ${reportId}\nGenerated At: ${new Date().toISOString()}`;
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Oasis_${reportId}_Report.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
                  <Text style={[styles.cardTitle, { color: colors.text }]}>1. Download Template</Text>
                  <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
                    Download the sample Excel/CSV template with required columns and data formats.
                  </Text>
                </View>
              </View>
              <Button
                title="Download Sample Template"
                icon={<Download size={16} color="#000" />}
                onPress={handleDownloadTemplate}
                variant="outline"
                style={{ alignSelf: 'flex-start' }}
              />
            </View>

            <View style={[styles.fullCard, { backgroundColor: colors.surface, borderColor: '#e2e8f0' }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconWrap, { backgroundColor: '#fff7ed' }]}>
                  <Upload size={20} color="#ea580c" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>2. Upload & Validate</Text>
                  <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
                    Upload your filled template to validate and import records into the database.
                  </Text>
                </View>
              </View>
              
              <View style={{ borderWidth: 2, borderStyle: 'dashed', borderColor: '#cbd5e1', padding: 40, borderRadius: 12, alignItems: 'center' }}>
                <Upload size={32} color="#94a3b8" />
                <Text style={{ marginTop: 12, fontSize: 16, fontWeight: '600' }}>Click or drag file to this area to upload</Text>
                <Text style={{ marginTop: 4, fontSize: 12, color: '#64748b' }}>Support for a single or bulk upload. Strictly prohibit from uploading company data or other band files</Text>
              </View>

              <Button
                title="Simulate Import"
                onPress={handleSimulateImport}
                loading={importing}
                style={{ backgroundColor: colors.primary, marginTop: 12 }}
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
