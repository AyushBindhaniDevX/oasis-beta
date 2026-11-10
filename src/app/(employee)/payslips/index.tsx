import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  CraftButton,
  CraftCard,
  CraftHeader,
  Typography,
  T,
  S,
} from '@/components/ui/CraftKit';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/context/TenantContext';
import { useTheme } from '@/hooks/use-theme';
import { BorderRadius, NotionColors, BrandShadow, Shadows } from '@/constants/theme';
import { Badge } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/States';
import { getPayslips } from '@/lib/services/payroll';
import { getEmployeeByProfileId } from '@/lib/services/employee';
import { getOrganization } from '@/lib/services/organization';
import { formatCurrency, formatDate } from '@/utils/format';
import { downloadOrPrintPayslip } from '@/utils/payslip-pdf';
import { MONTHS } from '@/constants/config';
import type { Payslip, Employee, Organization } from '@/types';
import {
  Download,
  FileText,
  Printer,
  ChevronRight,
  TrendingUp,
  Banknote,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
} from 'lucide-react-native';
import Animated, {
  FadeInDown,
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';

export default function PayslipsScreen() {
  const colors = useTheme();
  const { profile } = useAuth();
  const { organization: tenantOrg, employee: tenantEmp } = useTenant();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const topPadding = Math.max(insets.top, Platform.OS === 'ios' ? 44 : 20);

  const activeOrgId = tenantOrg?.id || tenantEmp?.organization_id || profile?.organization_id;

  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!profile) return;
      try {
        const emp = tenantEmp || (await getEmployeeByProfileId(profile.id, activeOrgId));
        setEmployee(emp);
        if (emp) {
          const [data, orgData] = await Promise.all([
            getPayslips(emp.id),
            activeOrgId ? getOrganization(activeOrgId) : null,
          ]);
          setPayslips(data);
          setOrganization(orgData || tenantOrg);
        }
      } catch (err) {
        console.error('Error loading payslips:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [profile, activeOrgId, tenantEmp, tenantOrg]);

  const handleDownload = async (ps: Payslip) => {
    setDownloadingId(ps.id);
    try {
      await downloadOrPrintPayslip(ps, employee, organization);
    } catch (err) {
      console.error('PDF download error:', err);
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) return <LoadingState />;

  const latest = payslips.length > 0 ? payslips[0] : null;
  const monthName = latest ? MONTHS[latest.period_month - 1] : 'Current Period';
  const yearStr = latest ? latest.period_year : new Date().getFullYear();
  const grossEarnings = latest?.payroll?.gross_salary || 0;
  const deductions = latest?.payroll
    ? latest.payroll.gross_salary - latest.payroll.net_salary
    : 0;
  const netPay = latest?.payroll?.net_salary || 0;

  // ─────────────────────────────────────────────────────────────────────────────
  // MOBILE LAYOUT
  // ─────────────────────────────────────────────────────────────────────────────
  if (!isDesktop) {
    return (
      <View style={{ flex: 1, backgroundColor: T.canvas }}>
        <StatusBar barStyle="dark-content" />
        <CraftHeader
          title="Salary & Payslips"
          subtitle={`Current cycle: ${monthName} ${yearStr}`}
          right={
            latest ? (
              <CraftButton
                title="Download"
                variant="secondary"
                size="sm"
                icon={<Download size={13} color={T.ink} />}
                loading={downloadingId === latest.id}
                onPress={() => handleDownload(latest)}
              />
            ) : undefined
          }
        />

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 100 }}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Latest Salary Card ── */}
          <CraftCard variant="pastel" pastelTint={T.periwinkleSoft} style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={[Typography.eyebrow, { color: T.periwinkleDeep }]}>OFFICIAL STATEMENT • {monthName.toUpperCase()} {yearStr}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#D8F3E5', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                <CheckCircle2 size={12} color={T.forest} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: T.forest }}>Disbursed</Text>
              </View>
            </View>

            <View style={{ marginVertical: 6 }}>
              <Text style={{ fontSize: 12, color: T.inkMuted }}>Net Take Home</Text>
              <Text style={[Typography.displayLg, { color: T.ink, marginTop: 2 }]}>{formatCurrency(netPay)}</Text>
            </View>

            <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)', paddingTop: 10, justifyContent: 'space-between' }}>
              <View>
                <Text style={{ fontSize: 11, color: T.inkMuted }}>Gross</Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: T.ink, marginTop: 2 }}>{formatCurrency(grossEarnings)}</Text>
              </View>
              <View style={{ width: 1, backgroundColor: 'rgba(0,0,0,0.06)' }} />
              <View>
                <Text style={{ fontSize: 11, color: T.inkMuted }}>Deductions</Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#DC2626', marginTop: 2 }}>-{formatCurrency(deductions)}</Text>
              </View>
              <View style={{ width: 1, backgroundColor: 'rgba(0,0,0,0.06)' }} />
              <View>
                <Text style={{ fontSize: 11, color: T.inkMuted }}>Basic Pay</Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: T.ink, marginTop: 2 }}>{formatCurrency(latest?.payroll?.basic_salary || 0)}</Text>
              </View>
            </View>
          </CraftCard>

        {/* ── Download Latest Button ─────────────────────────────────────── */}
        {latest && (
          <Animated.View entering={FadeInDown.delay(80).duration(350).springify()}>
            <TouchableOpacity
              style={mStyles.downloadLatestBtn}
              onPress={() => handleDownload(latest)}
              activeOpacity={0.85}
              disabled={downloadingId === latest.id}
            >
              {downloadingId === latest.id ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Download size={18} color="#FFF" />
                  <Text style={mStyles.downloadLatestText}>Download {monthName} Payslip</Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── Earnings Breakdown Card ───────────────────────────────────── */}
        {latest && (
          <Animated.View entering={FadeInDown.delay(140).duration(350).springify()}>
            <View style={mStyles.card}>
              <View style={mStyles.cardHead}>
                <View style={mStyles.cardIconWrap}>
                  <TrendingUp size={16} color="#0D7377" />
                </View>
                <Text style={mStyles.cardTitle}>Earnings Breakdown</Text>
                <Badge label="PAID" variant="successLight" />
              </View>

              {/* Breakdown rows */}
              <View style={{ gap: 0 }}>
                <View style={mStyles.bRow}>
                  <Text style={mStyles.bLabel}>Basic Salary</Text>
                  <Text style={mStyles.bValue}>{formatCurrency(latest.payroll?.basic_salary || 0)}</Text>
                </View>

                {latest.payroll?.allowances &&
                  Object.entries(latest.payroll.allowances).map(([key, val]) => (
                    <View key={key} style={mStyles.bRow}>
                      <Text style={mStyles.bLabel}>{key.replace(/_/g, ' ')}</Text>
                      <Text style={[mStyles.bValue, { color: '#0D7377' }]}>+{formatCurrency(val)}</Text>
                    </View>
                  ))}

                {/* Gross total */}
                <View style={[mStyles.bRow, mStyles.bRowTotal]}>
                  <Text style={mStyles.bTotalLabel}>Gross Earnings</Text>
                  <Text style={mStyles.bTotalValue}>{formatCurrency(grossEarnings)}</Text>
                </View>

                {latest.payroll?.deductions && Object.keys(latest.payroll.deductions).length > 0 && (
                  <>
                    <View style={mStyles.sectionDivider}>
                      <Text style={mStyles.sectionDividerText}>DEDUCTIONS & TAXES</Text>
                    </View>
                    {Object.entries(latest.payroll.deductions).map(([key, val]) => (
                      <View key={key} style={mStyles.bRow}>
                        <Text style={mStyles.bLabel}>{key.replace(/_/g, ' ')}</Text>
                        <Text style={[mStyles.bValue, { color: '#EF4444' }]}>-{formatCurrency(val)}</Text>
                      </View>
                    ))}
                  </>
                )}

                {/* Net pay total */}
                <View style={[mStyles.bRow, mStyles.bRowNet]}>
                  <Text style={mStyles.netLabel}>Net Take Home</Text>
                  <Text style={mStyles.netValue}>{formatCurrency(netPay)}</Text>
                </View>
              </View>
            </View>
          </Animated.View>
        )}

        {/* ── Payslip History Feed ──────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(200).duration(350).springify()}>
          <Text style={mStyles.sectionTitle}>Payslip History</Text>

          {payslips.length === 0 ? (
            <View style={mStyles.emptyState}>
              <FileText size={36} color="#CBD5E1" />
              <Text style={mStyles.emptyText}>No payroll statements yet.</Text>
            </View>
          ) : (
            <View style={{ gap: 10, paddingHorizontal: 16 }}>
              {payslips.map((ps, idx) => (
                <Animated.View
                  key={ps.id}
                  entering={FadeInDown.delay(200 + idx * 60).duration(350).springify()}
                >
                  <View style={mStyles.payslipCard}>
                    {/* Left color bar */}
                    <View style={mStyles.payslipColorBar} />

                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View>
                          <Text style={mStyles.payslipMonth}>{MONTHS[ps.period_month - 1]} {ps.period_year}</Text>
                          <Text style={mStyles.payslipRef}>
                            {ps.payslip_number || `PS-${ps.id.slice(0, 8).toUpperCase()}`}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={mStyles.payslipAmount}>
                            {ps.payroll ? formatCurrency(ps.payroll.net_salary) : '—'}
                          </Text>
                          <Badge label="PAID" variant="successLight" />
                        </View>
                      </View>

                      {/* Actions */}
                      <View style={mStyles.payslipActions}>
                        <TouchableOpacity
                          style={mStyles.payslipDownloadBtn}
                          onPress={() => handleDownload(ps)}
                          disabled={downloadingId === ps.id}
                          activeOpacity={0.75}
                        >
                          {downloadingId === ps.id ? (
                            <ActivityIndicator size="small" color="#0D7377" />
                          ) : (
                            <>
                              <Download size={13} color="#0D7377" />
                              <Text style={mStyles.payslipDownloadText}>PDF</Text>
                            </>
                          )}
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={mStyles.payslipViewBtn}
                          onPress={() => router.push(`/(employee)/payslips/${ps.id}` as never)}
                          activeOpacity={0.75}
                        >
                          <Text style={mStyles.payslipViewText}>View Details</Text>
                          <ChevronRight size={13} color="#64748B" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </Animated.View>
              ))}
            </View>
          )}
        </Animated.View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DESKTOP LAYOUT
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: T.canvas }}>
      <CraftHeader
        title="Payroll & Compensation"
        subtitle={`Current Pay Cycle: ${monthName} ${yearStr}`}
        right={
          latest ? (
            <CraftButton
              title="Download Latest"
              variant="primary"
              icon={<Download size={16} color="#FFF" />}
              loading={downloadingId === latest.id}
              onPress={() => handleDownload(latest)}
            />
          ) : undefined
        }
      />
      <ScrollView
        style={[styles.container, { backgroundColor: T.canvas }]}
        contentContainerStyle={[styles.content, styles.contentDesktop]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.dashboardGrid}>
        {/* Main Column */}
        <View style={styles.mainCol}>
          {/* Summary Card */}
          <Animated.View entering={FadeInDown.delay(80).duration(350).springify()}>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: '#e2e8f0' }]}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>
                    {monthName} {yearStr} Earnings
                  </Text>
                  <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
                    Disbursed directly to primary bank account
                  </Text>
                </View>
                <Badge label="VERIFIED & PAID" variant="successLight" />
              </View>

              {/* 3 Metric Pills */}
              <View style={styles.summaryGrid}>
                <View style={[styles.summaryBox, { backgroundColor: '#f8faff', borderColor: '#e2e8f0' }]}>
                  <Text style={styles.summaryLabel}>Gross Salary</Text>
                  <Text style={[styles.summaryValue, { color: colors.text }]}>
                    {formatCurrency(grossEarnings)}
                  </Text>
                </View>
                <View style={[styles.summaryBox, { backgroundColor: '#fff5f5', borderColor: '#ffdad6' }]}>
                  <Text style={[styles.summaryLabel, { color: colors.danger }]}>Total Deductions</Text>
                  <Text style={[styles.summaryValue, { color: colors.danger }]}>
                    -{formatCurrency(deductions)}
                  </Text>
                </View>
                <View style={[styles.summaryBox, { backgroundColor: '#edf8f6', borderColor: '#c4ece7' }]}>
                  <Text style={[styles.summaryLabel, { color: '#006a61' }]}>Net Take Home</Text>
                  <Text style={[styles.summaryValue, { color: '#006a61' }]}>
                    {formatCurrency(netPay)}
                  </Text>
                </View>
              </View>

              {/* Breakdown Section */}
              <View style={styles.breakdownSection}>
                <Text style={[styles.breakdownTitle, { color: colors.text }]}>Itemized Breakdown</Text>
                <View style={styles.breakdownRow}>
                  <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>Basic Salary</Text>
                  <Text style={[styles.breakdownValue, { color: colors.text }]}>
                    {formatCurrency(latest?.payroll?.basic_salary || 0)}
                  </Text>
                </View>

                {latest?.payroll?.allowances &&
                  Object.entries(latest.payroll.allowances).map(([key, val]) => (
                    <View key={key} style={styles.breakdownRow}>
                      <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>
                        {key.replace(/_/g, ' ').toUpperCase()}
                      </Text>
                      <Text style={[styles.breakdownValue, { color: '#006a61' }]}>
                        +{formatCurrency(val)}
                      </Text>
                    </View>
                  ))}

                {latest?.payroll?.deductions && Object.keys(latest.payroll.deductions).length > 0 && (
                  <>
                    <View style={styles.divider} />
                    <Text style={[styles.deductionHeader, { color: colors.danger }]}>DEDUCTIONS & TAXES</Text>
                    {Object.entries(latest.payroll.deductions).map(([key, val]) => (
                      <View key={key} style={styles.breakdownRow}>
                        <Text style={[styles.breakdownLabel, { color: colors.textSecondary }]}>
                          {key.replace(/_/g, ' ').toUpperCase()}
                        </Text>
                        <Text style={[styles.breakdownValue, { color: colors.danger }]}>
                          -{formatCurrency(val)}
                        </Text>
                      </View>
                    ))}
                  </>
                )}
              </View>
            </View>
          </Animated.View>

          {/* Statement History */}
          <Animated.View entering={FadeInDown.delay(160).duration(350).springify()}>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: '#e2e8f0' }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Payslip History</Text>
                <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
                  Download official PDF statements for all pay periods
                </Text>
              </View>

              {payslips.length === 0 ? (
                <View style={styles.emptyCard}>
                  <FileText size={32} color={colors.textSecondary} />
                  <Text style={{ color: colors.textSecondary, marginTop: 8, fontSize: 13 }}>
                    No payroll statements generated yet.
                  </Text>
                </View>
              ) : (
                <View style={styles.table}>
                  {payslips.map((ps, i) => (
                    <View
                      key={ps.id}
                      style={[
                        styles.tableRow,
                        i !== payslips.length - 1 && {
                          borderBottomColor: '#f1f5f9',
                          borderBottomWidth: 1,
                        },
                      ]}
                    >
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={[styles.rowPeriod, { color: colors.text }]}>
                          {MONTHS[ps.period_month - 1]} {ps.period_year}
                        </Text>
                        <Text style={[styles.rowRef, { color: colors.textSecondary }]}>
                          {ps.payslip_number || `PS-${ps.id.slice(0, 8).toUpperCase()}`}
                        </Text>
                      </View>

                      <View style={{ alignItems: 'flex-end', gap: 6 }}>
                        <Text style={[styles.rowAmount, { color: colors.text }]}>
                          {ps.payroll ? formatCurrency(ps.payroll.net_salary) : '—'}
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                          <TouchableOpacity
                            style={styles.pdfDownloadBtn}
                            onPress={() => handleDownload(ps)}
                            disabled={downloadingId === ps.id}
                            activeOpacity={0.7}
                          >
                            {downloadingId === ps.id ? (
                              <ActivityIndicator size="small" color="#006a61" />
                            ) : (
                              <>
                                <Download size={13} color="#006a61" />
                                <Text style={styles.pdfDownloadText}>PDF</Text>
                              </>
                            )}
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.pdfDownloadBtn, { borderColor: '#e2e8f0' }]}
                            onPress={() => router.push(`/(employee)/payslips/${ps.id}` as never)}
                          >
                            <Text style={[styles.pdfDownloadText, { color: colors.textSecondary }]}>
                              View Details
                            </Text>
                            <ChevronRight size={13} color={colors.textSecondary} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </Animated.View>
        </View>
      </View>
    </ScrollView>
  </View>
);
}

// ─── MOBILE STYLES ─────────────────────────────────────────────────────────────
const mStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F1F5F9' },
  content: { paddingBottom: 90 },

  // Standard Header
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    paddingHorizontal: 20,
    letterSpacing: -0.5,
  },

  // Hero Banner
  heroBanner: {
    backgroundColor: '#004D47',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    ...Platform.select({
      web: {
        backgroundImage: 'linear-gradient(135deg, #006a61 0%, #004D47 50%, #003D38 100%)',
        boxShadow: '0 8px 32px rgba(0, 77, 71, 0.3)',
      },
      default: {
        shadowColor: '#004D47',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 12,
      },
    }),
  },
  heroLabel: {
    fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1.2, textTransform: 'uppercase',
  },
  heroPeriod: {
    fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.75)',
    marginTop: 4,
  },
  salaryDisplay: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  salaryLabel: {
    fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.65)',
    letterSpacing: 0.5,
  },
  salaryAmount: {
    fontSize: 38, fontWeight: '900', color: '#FFFFFF',
    letterSpacing: -1.5, marginTop: 4, marginBottom: 8,
  },
  salaryStatusRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
  },
  salaryStatusText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },

  // Metric chips in banner
  metricRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  metricChip: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 6 },
  metricDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 4 },
  metricChipLabel: { fontSize: 9, color: 'rgba(255,255,255,0.6)', fontWeight: '700', textTransform: 'uppercase' },
  metricChipValue: { fontSize: 12, color: '#FFFFFF', fontWeight: '800', marginTop: 1 },

  // Download button
  downloadLatestBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 20, marginTop: -12, marginBottom: 16,
    backgroundColor: '#006a61',
    paddingVertical: 14, borderRadius: 16,
    ...Platform.select({
      web: { boxShadow: '0 4px 12px rgba(0, 106, 97, 0.25)' },
      default: {
        shadowColor: '#006a61',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 5,
      },
    }),
  },
  downloadLatestText: { fontSize: 14, fontWeight: '800', color: '#FFF' },

  // Breakdown card
  card: {
    marginHorizontal: 20, marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  cardHead: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#F8FAFC',
  },
  cardIconWrap: {
    width: 32, height: 32, borderRadius: 9,
    backgroundColor: '#E6F4F4',
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: '#0F172A' },

  // Breakdown rows
  bRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: '#F8FAFC',
  },
  bLabel: { fontSize: 13, color: '#475569', fontWeight: '500', textTransform: 'capitalize' },
  bValue: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  bRowTotal: {
    backgroundColor: '#F8FAFC',
    borderBottomColor: '#E2E8F0',
  },
  bTotalLabel: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  bTotalValue: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  sectionDivider: {
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: '#FEF2F2',
    borderBottomWidth: 1, borderBottomColor: '#FECACA',
  },
  sectionDividerText: {
    fontSize: 10, fontWeight: '900', color: '#EF4444',
    letterSpacing: 1, textTransform: 'uppercase',
  },
  bRowNet: {
    backgroundColor: '#E6F4F4',
    borderBottomWidth: 0,
    paddingVertical: 14,
  },
  netLabel: { fontSize: 14, fontWeight: '900', color: '#0D7377' },
  netValue: { fontSize: 18, fontWeight: '900', color: '#0D7377' },

  // Section title
  sectionTitle: {
    fontSize: 16, fontWeight: '800', color: '#0F172A',
    paddingHorizontal: 16, marginBottom: 10, letterSpacing: -0.2,
  },

  // Payslip history cards
  payslipCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16,
    borderWidth: 1, borderColor: '#E2E8F0',
    flexDirection: 'row', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  payslipColorBar: {
    width: 4, backgroundColor: '#0D7377',
  },
  payslipMonth: { fontSize: 14, fontWeight: '800', color: '#0F172A', padding: 14, paddingBottom: 2 },
  payslipRef: { fontSize: 11, color: '#94A3B8', paddingHorizontal: 14, paddingBottom: 4, fontFamily: 'monospace' },
  payslipAmount: { fontSize: 16, fontWeight: '900', color: '#0F172A', padding: 14, paddingBottom: 4, paddingLeft: 0 },
  payslipActions: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 14, paddingBottom: 12, paddingTop: 4,
  },
  payslipDownloadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8, borderWidth: 1.5, borderColor: '#0D7377',
  },
  payslipDownloadText: { fontSize: 11, fontWeight: '800', color: '#0D7377' },
  payslipViewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8, borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  payslipViewText: { fontSize: 11, fontWeight: '700', color: '#64748B' },

  // Bank card
  bankRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingBottom: 10,
  },
  bankText: { fontSize: 13, fontWeight: '600', color: '#334155' },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { fontSize: 14, color: '#94A3B8', fontWeight: '600' },
});

// ─── DESKTOP STYLES (unchanged) ───────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { gap: 24, paddingBottom: 64 },
  contentDesktop: { maxWidth: 1200, alignSelf: 'center', width: '100%', paddingHorizontal: 36, paddingTop: 36, gap: 28 },

  heroBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 24, paddingTop: 32,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
    flexWrap: 'wrap', gap: 14,
  },
  heroSubHeader: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  heroTitle: { color: '#FFF', fontSize: 22, fontWeight: '800', marginTop: 4, letterSpacing: -0.4 },
  heroDate: { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 4 },
  heroDownloadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#006a61', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
  },
  heroDownloadText: { color: '#FFF', fontWeight: '700', fontSize: 13 },

  dashboardGrid: { flexDirection: 'row', gap: 28, alignItems: 'flex-start' },
  mainCol: { flex: 1, gap: 24 },

  card: { borderRadius: 16, borderWidth: 1, padding: 20, gap: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  cardSub: { fontSize: 12, marginTop: 2 },
  iconWrap: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },

  summaryGrid: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  summaryBox: { flex: 1, minWidth: 120, padding: 14, borderRadius: 10, borderWidth: 1, gap: 4 },
  summaryLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', color: '#64748b' },
  summaryValue: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },

  breakdownSection: { borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 14, gap: 10 },
  breakdownTitle: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  breakdownLabel: { fontSize: 13, fontWeight: '500' },
  breakdownValue: { fontSize: 13, fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 4 },
  deductionHeader: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginTop: 4 },

  table: { gap: 0 },
  tableRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14 },
  rowPeriod: { fontSize: 14, fontWeight: '700' },
  rowRef: { fontSize: 11, fontFamily: 'monospace', marginTop: 2 },
  rowAmount: { fontSize: 15, fontWeight: '800' },
  pdfDownloadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6, borderWidth: 1, borderColor: '#006a61',
  },
  pdfDownloadText: { fontSize: 11, fontWeight: '700', color: '#006a61' },
  emptyCard: { padding: 32, alignItems: 'center' },
  bankBox: { padding: 14, borderRadius: 10, borderWidth: 1 },
});
