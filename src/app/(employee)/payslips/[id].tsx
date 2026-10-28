import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/States';
import { getPayslipDetail } from '@/lib/services/payroll';
import { getEmployeeByProfileId } from '@/lib/services/employee';
import { getOrganization } from '@/lib/services/organization';
import { formatCurrency, formatDate } from '@/utils/format';
import { downloadOrPrintPayslip } from '@/utils/payslip-pdf';
import { MONTHS } from '@/constants/config';
import type { Payslip, Employee, Organization } from '@/types';
import {
  Download,
  Printer,
  ChevronLeft,
  FileText,
  Landmark,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react-native';

export default function PayslipDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useTheme();
  const { profile } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [payslip, setPayslip] = useState<Payslip | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    (async () => {
      if (!id) return;
      try {
        const [data, empData, orgData] = await Promise.all([
          getPayslipDetail(id),
          profile ? getEmployeeByProfileId(profile.id) : null,
          profile?.organization_id ? getOrganization(profile.organization_id) : null,
        ]);
        setPayslip(data);
        setEmployee(empData);
        setOrganization(orgData);
      } catch (err) {
        console.error('Error fetching payslip:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, profile]);

  const handleDownloadPdf = async () => {
    if (!payslip) return;
    setDownloading(true);
    try {
      await downloadOrPrintPayslip(payslip, employee, organization);
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <LoadingState />;
  if (!payslip || !payslip.payroll) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.textSecondary }}>Payslip statement not found</Text>
        <Button title="Go Back" onPress={() => router.back()} style={{ marginTop: 12 }} />
      </View>
    );
  }

  const p = payslip.payroll;
  const monthName = (MONTHS[payslip.period_month - 1] || 'Month').toUpperCase();
  const year = payslip.period_year;

  const empName = (employee?.profile?.full_name || (p.employee as any)?.profile?.full_name || 'Staff Member').toUpperCase();
  const empCode = employee?.employee_code || (p.employee as any)?.employee_code || payslip.payslip_number || 'SMH1352';
  const empType = ((p as any)?.employment_type || employee?.employment_type || ((p as any)?.is_pf_eligible ? 'CONFIRMED' : 'CONTRACTUAL')).toUpperCase();

  let slipDate = '05/10/2026';
  try {
    const rawDate = payslip.created_at || (p as any)?.created_at || new Date().toISOString();
    const d = new Date(rawDate);
    if (!isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      slipDate = `${dd}/${mm}/${yyyy}`;
    }
  } catch {}

  const payableDays = (p as any)?.payable_days ?? 30;
  const holidayDays = (p as any)?.holiday_days ?? 0;
  const clDays = (p as any)?.cl_days ?? 0;
  const slDays = (p as any)?.sl_days ?? 0;
  const plDays = (p as any)?.pl_days ?? 0;
  const offDays = (p as any)?.off_days ?? 4;
  const lwpDays = (p as any)?.lwp_days ?? (p as any)?.lop_days ?? Math.max(0, payableDays - ((p as any)?.paid_days ?? payableDays));
  const paidDays = (p as any)?.paid_days ?? Math.max(0, payableDays - lwpDays);
  const offerSalary = Math.round((p as any)?.salary_details ?? employee?.basic_salary ?? p.basic_salary ?? 37400);

  const basic = Math.round((p as any)?.basic ?? p.basic_salary ?? Math.round(offerSalary * 0.5));
  const hra = Math.round((p as any)?.hra ?? p.allowances?.['HRA'] ?? Math.round(offerSalary * 0.2));
  const conv = Math.round((p as any)?.conveyance ?? p.allowances?.['Conveyance Allowance'] ?? 2000);
  const wash = Math.round((p as any)?.washing ?? p.allowances?.['Washing Allowance'] ?? 1000);
  const special = Math.round((p as any)?.special_allowance ?? p.allowances?.['Special Allowance'] ?? 0);
  const gross = Math.round((p as any)?.gross_salary ?? p.gross_salary ?? (basic + hra + conv + wash + special));

  const pf = Math.round((p as any)?.pf ?? p.deductions?.['PF'] ?? p.deductions?.['EPF'] ?? 0);
  const pt = Math.round((p as any)?.deductions?.['Professional Tax'] ?? 0);
  const esi = Math.round((p as any)?.esi ?? p.deductions?.['ESIC'] ?? 0);
  const tds = Math.round((p as any)?.tds ?? p.deductions?.['TDS'] ?? 0);
  const lateComing = Math.round((p as any)?.late_coming ?? 0);
  const otherDed = Math.round((p as any)?.ot_ded ?? p.deductions?.['Miscellaneous Deductions'] ?? 0);
  const totalDed = Math.round((p as any)?.total_deductions ?? (p as any)?.gross_deductions ?? (pf + pt + esi + tds + otherDed));

  const totalSalary = Math.round((p as any)?.total_salary ?? Math.max(0, gross - totalDed));
  const otAmount = Math.round((p as any)?.ot_amount ?? p.allowances?.['Overtime Pay'] ?? 0);
  const otherAllow = Math.round((p as any)?.other_allowances ?? p.allowances?.['Other Allowances'] ?? 0);
  const netSalary = Math.round((p as any)?.net_salary ?? p.net_salary ?? Math.max(0, totalSalary + otAmount + otherAllow));

  const orgName = (organization?.name || (p as any)?.hospital_unit || 'COMPANY NAME').toUpperCase();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top App Bar */}
      <View style={[styles.topBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(employee)/payslips' as never))}
          style={styles.backBtn}
        >
          <ChevronLeft size={20} color={colors.text} />
          <Text style={[styles.backText, { color: colors.text }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.pageTitle, { color: colors.text }]}>Salary Slip - {monthName} {year}</Text>
        <TouchableOpacity
          onPress={handleDownloadPdf}
          style={[styles.downloadHeaderBtn, { backgroundColor: colors.primary }]}
          disabled={downloading}
        >
          {downloading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Download size={14} color="#FFF" />
              <Text style={styles.downloadHeaderText}>Export PDF Slip</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}>
        {/* Exact Hospital Payslip Document Container */}
        <View style={styles.documentSlip}>
          {/* Header */}
          <View style={styles.slipHeader}>
            <Text style={styles.hospitalTitle}>{orgName}</Text>
            <Text style={styles.payslipPeriodTitle}>PAYSLIP {monthName} {year}</Text>
          </View>

          {/* Info Grid (3 Columns) */}
          <View style={styles.metaSection}>
            <View style={styles.metaRow3}>
              <View style={styles.metaCol}>
                <Text style={styles.metaText}><Text style={styles.metaLabel}>Employee Name</Text> : {empName}</Text>
                <Text style={styles.metaText}><Text style={styles.metaLabel}>Employee Code</Text> : {empCode}</Text>
                <Text style={styles.metaText}><Text style={styles.metaLabel}>Date</Text> : {slipDate}</Text>
                <Text style={styles.metaText}><Text style={styles.metaLabel}>Employee Type</Text> : {empType}</Text>
              </View>

              <View style={styles.metaCol}>
                <Text style={styles.metaText}><Text style={styles.metaLabel}>Payable Days</Text> : {payableDays.toFixed(2)}</Text>
                <Text style={styles.metaText}><Text style={styles.metaLabel}>Paid Holiday</Text> : {holidayDays.toFixed(2)}</Text>
                <Text style={styles.metaText}>
                  <Text style={styles.metaLabel}>CL</Text> : {clDays.toFixed(2)}    <Text style={styles.metaLabel}>SL</Text> : {slDays.toFixed(2)}
                </Text>
                <Text style={styles.metaText}><Text style={styles.metaLabel}>Offer Salary</Text> : {offerSalary}</Text>
              </View>

              <View style={styles.metaCol}>
                <Text style={styles.metaText}><Text style={styles.metaLabel}>Week Off</Text> : {offDays.toFixed(2)}</Text>
                <Text style={styles.metaText}><Text style={styles.metaLabel}>PL</Text> : {plDays.toFixed(2)}</Text>
                <Text style={styles.metaText}><Text style={styles.metaLabel}>LWP</Text> : {lwpDays.toFixed(2)}</Text>
                <Text style={styles.metaText}><Text style={styles.metaLabel}>Paid Days</Text> : {paidDays}</Text>
              </View>
            </View>
          </View>

          {/* EARNINGS Table */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: -1 }}>
            <View style={styles.slipTable}>
              {/* Header row */}
              <View style={styles.tableRowHeader}>
                <View style={[styles.tableCell, styles.cellSideHeader]}><Text style={styles.headerCellText}>EARNINGS</Text></View>
                <View style={[styles.tableCell, styles.cellCol]}><Text style={styles.headerCellText}>Basic</Text></View>
                <View style={[styles.tableCell, styles.cellCol]}><Text style={styles.headerCellText}>HRA</Text></View>
                <View style={[styles.tableCell, styles.cellCol]}><Text style={styles.headerCellText}>Conv Allow</Text></View>
                <View style={[styles.tableCell, styles.cellCol]}><Text style={styles.headerCellText}>Washing Allow</Text></View>
                <View style={[styles.tableCell, styles.cellCol]}><Text style={styles.headerCellText}>Special Allow</Text></View>
                <View style={[styles.tableCell, styles.cellCol]}><Text style={styles.headerCellText}></Text></View>
                <View style={[styles.tableCell, styles.cellColEnd]}><Text style={styles.headerCellText}>Total Earning</Text></View>
              </View>
              {/* Data row */}
              <View style={styles.tableRowData}>
                <View style={[styles.tableCell, styles.cellSideHeader]}><Text style={styles.headerCellText}></Text></View>
                <View style={[styles.tableCell, styles.cellCol]}><Text style={styles.dataCellText}>{basic}</Text></View>
                <View style={[styles.tableCell, styles.cellCol]}><Text style={styles.dataCellText}>{hra.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text></View>
                <View style={[styles.tableCell, styles.cellCol]}><Text style={styles.dataCellText}>{conv.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text></View>
                <View style={[styles.tableCell, styles.cellCol]}><Text style={styles.dataCellText}>{wash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text></View>
                <View style={[styles.tableCell, styles.cellCol]}><Text style={styles.dataCellText}>{special.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text></View>
                <View style={[styles.tableCell, styles.cellCol]}><Text style={styles.dataCellText}></Text></View>
                <View style={[styles.tableCell, styles.cellColEnd]}><Text style={[styles.dataCellText, { fontWeight: '800' }]}>{gross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text></View>
              </View>
            </View>
          </ScrollView>

          {/* DEDUCTION Table */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            <View style={styles.slipTable}>
              {/* Header row */}
              <View style={styles.tableRowHeader}>
                <View style={[styles.tableCell, styles.cellSideHeader]}><Text style={styles.headerCellText}>DEDUCTION</Text></View>
                <View style={[styles.tableCell, styles.cellCol]}><Text style={styles.headerCellText}>Provident Fund</Text></View>
                <View style={[styles.tableCell, styles.cellCol]}><Text style={styles.headerCellText}>ProfessionlTax</Text></View>
                <View style={[styles.tableCell, styles.cellCol]}><Text style={styles.headerCellText}>ESIC</Text></View>
                <View style={[styles.tableCell, styles.cellCol]}><Text style={styles.headerCellText}>TDS</Text></View>
                <View style={[styles.tableCell, styles.cellCol]}><Text style={styles.headerCellText}>Late Coming</Text></View>
                <View style={[styles.tableCell, styles.cellCol]}><Text style={styles.headerCellText}>Other Deduction</Text></View>
                <View style={[styles.tableCell, styles.cellColEnd]}><Text style={styles.headerCellText}>Total Deduction</Text></View>
              </View>
              {/* Data row */}
              <View style={styles.tableRowData}>
                <View style={[styles.tableCell, styles.cellSideHeader]}><Text style={styles.headerCellText}></Text></View>
                <View style={[styles.tableCell, styles.cellCol]}><Text style={styles.dataCellText}>{pf.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text></View>
                <View style={[styles.tableCell, styles.cellCol]}><Text style={styles.dataCellText}>{pt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text></View>
                <View style={[styles.tableCell, styles.cellCol]}><Text style={styles.dataCellText}>{esi.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text></View>
                <View style={[styles.tableCell, styles.cellCol]}><Text style={styles.dataCellText}>{tds.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text></View>
                <View style={[styles.tableCell, styles.cellCol]}><Text style={styles.dataCellText}>{lateComing > 0 ? lateComing.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : ''}</Text></View>
                <View style={[styles.tableCell, styles.cellCol]}><Text style={styles.dataCellText}>{otherDed.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text></View>
                <View style={[styles.tableCell, styles.cellColEnd]}><Text style={[styles.dataCellText, { fontWeight: '800' }]}>{totalDed.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text></View>
              </View>
            </View>
          </ScrollView>

          {/* Footer Row */}
          <View style={styles.slipFooter}>
            <Text style={styles.disclaimerText}>
              This is a computer generated document and does not require signature.
            </Text>

            <View style={styles.summaryList}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Salary</Text>
                <Text style={styles.summaryVal}>: {totalSalary}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Overtime</Text>
                <Text style={styles.summaryVal}>: {otAmount.toFixed(2)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Other Allowance</Text>
                <Text style={styles.summaryVal}>: {otherAllow.toFixed(2)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { fontWeight: '800' }]}>Net Pay</Text>
                <Text style={[styles.summaryVal, { fontWeight: '800' }]}>: {netSalary}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Action Button */}
        <View style={{ marginTop: 14 }}>
          <Button
            title="Download / Print PDF Payslip"
            icon={<Download size={16} color="#FFF" />}
            onPress={handleDownloadPdf}
            loading={downloading}
            style={{ backgroundColor: '#0D7377', borderRadius: 8 }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { fontSize: 14, fontWeight: '600' },
  pageTitle: { fontSize: 15, fontWeight: '700' },
  downloadHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  downloadHeaderText: { color: '#FFF', fontWeight: '700', fontSize: 12 },

  content: { padding: 16, gap: 16, paddingBottom: 40 },
  contentDesktop: { maxWidth: 860, alignSelf: 'center', width: '100%', padding: 24 },

  /* Exact Paper Document Styling */
  documentSlip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#1e293b',
    borderRadius: 4,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  slipHeader: {
    alignItems: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: '#1e293b',
    paddingBottom: 8,
    marginBottom: 10,
  },
  hospitalTitle: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: '#0f172a',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  payslipPeriodTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#1e293b',
    marginTop: 3,
  },

  /* 3-Column Metadata */
  metaSection: {
    borderBottomWidth: 1.5,
    borderBottomColor: '#1e293b',
    paddingBottom: 10,
    marginBottom: 12,
  },
  metaRow3: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaCol: {
    flex: 1,
    minWidth: 170,
    gap: 3,
  },
  metaText: {
    fontSize: 11,
    color: '#0f172a',
    fontWeight: '500',
  },
  metaLabel: {
    fontWeight: '700',
    color: '#0f172a',
  },

  /* Grid Tables */
  slipTable: {
    borderWidth: 1,
    borderColor: '#1e293b',
    minWidth: 700,
    backgroundColor: '#FFF',
  },
  tableRowHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: '#f8fafc',
  },
  tableRowData: {
    flexDirection: 'row',
  },
  tableCell: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightColor: '#1e293b',
    justifyContent: 'center',
  },
  cellSideHeader: {
    width: 95,
    backgroundColor: '#f1f5f9',
    alignItems: 'flex-start',
  },
  cellCol: {
    width: 86,
    alignItems: 'flex-end',
  },
  cellColEnd: {
    width: 105,
    alignItems: 'flex-end',
    borderRightWidth: 0,
  },
  headerCellText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#0f172a',
  },
  dataCellText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0f172a',
  },

  /* Footer & Summary */
  slipFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: 10,
    flexWrap: 'wrap',
    gap: 12,
  },
  disclaimerText: {
    fontSize: 10.5,
    fontStyle: 'italic',
    color: '#475569',
    flex: 1,
    minWidth: 200,
    marginTop: 4,
  },
  summaryList: {
    width: 200,
    gap: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#1e293b',
  },
  summaryVal: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0f172a',
  },
});

