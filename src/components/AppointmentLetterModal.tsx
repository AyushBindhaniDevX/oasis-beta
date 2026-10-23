import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import {
  resendAppointmentLetterEmail,
  downloadAppointmentLetterPdf,
  StoredAppointmentLetter,
  getAppointmentLetterByEmployeeId,
} from '@/lib/services/appointmentLetters';
import { formatCurrency, formatDate } from '@/utils/format';
import type { Employee, Profile, Organization } from '@/types';
import {
  Mail,
  Download,
  FileText,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Building,
  User,
  ShieldCheck,
  Send,
  Calendar,
  Hash,
  Clock,
  ChevronUp,
  ChevronDown,
} from 'lucide-react-native';

interface AppointmentLetterModalProps {
  visible: boolean;
  onClose: () => void;
  employee: Employee | null;
  profile?: Profile | null;
  organization?: Organization | null;
  onSuccess?: (msg: string) => void;
}

export function AppointmentLetterModal({
  visible,
  onClose,
  employee,
  profile,
  organization,
  onSuccess,
}: AppointmentLetterModalProps) {
  const colors = useTheme();

  // Resolved employee & profile info
  const empProfile = employee?.profile || profile;
  const empName = empProfile?.full_name || 'Staff Member';
  const defaultEmail = empProfile?.email || (employee as any)?.email || '';
  const empCode = employee?.employee_code || 'SMH-000';
  const designation = employee?.designation || (empProfile?.role === 'admin' ? 'Administrator' : empProfile?.role === 'hr' ? 'HR Manager' : 'Staff');
  const departmentName = employee?.department?.name || 'General Operations';
  const orgName = organization?.name || 'Shanti Memorial Hospital';
  const isSMH = !organization || organization.id === 'smh' || organization.id === 'shanti-memorial-hospital' || orgName.toLowerCase().includes('shanti');
  const unit = employee?.hospital_unit || (isSMH ? 'Shanti Memorial Hospital & Chikitsa Unit' : `${orgName} Campus`);
  const currentYear = new Date().getFullYear();
  const refPrefix = isSMH ? 'SMH' : orgName.replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase() || 'HR';
  const refNo = `${refPrefix}/HR/APT/${currentYear}/${empCode}`;

  // Form & UI States
  const [recipientEmail, setRecipientEmail] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [storedRecord, setStoredRecord] = useState<StoredAppointmentLetter | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Initialize email & fetch record on open
  useEffect(() => {
    if (visible) {
      setRecipientEmail(defaultEmail);
      setFeedback(null);
      setShowPreview(false);
      if (employee?.id) {
        getAppointmentLetterByEmployeeId(employee.id).then((rec) => {
          if (rec) setStoredRecord(rec);
        });
      }
    }
  }, [visible, defaultEmail, employee?.id]);

  // Gross & Salary Breakdown
  const grossMonthly = employee?.basic_salary
    ? (employee.basic_salary > 20000 ? employee.basic_salary : employee.basic_salary * 2)
    : 25000;
  const basic = Math.round(grossMonthly * 0.50);
  const hra = Math.round(grossMonthly * 0.20);
  const conveyance = employee?.conveyance_allowance ?? 1200;
  const washing = employee?.washing_allowance ?? 500;
  const customItems: Array<{ name: string; value: number }> = ((employee?.tax_config as any)?.custom_items || [])
    .filter((ci: any) => ci.type === 'earning')
    .map((ci: any) => ({
      name: ci.name,
      value: ci.amount_type === 'percentage' ? Math.round((basic * Number(ci.value)) / 100) : Number(ci.value),
    }));
  const customEarningsTotal = customItems.reduce((acc, ci) => acc + ci.value, 0);
  const specialAllowance = employee?.special_allowance ?? Math.max(0, grossMonthly - (basic + hra + conveyance + washing + customEarningsTotal));
  const effectiveGross = basic + hra + conveyance + washing + specialAllowance + customEarningsTotal;
  const isPf = employee?.is_pf_eligible !== false;
  const isEsic = effectiveGross <= 21000;

  // Synthesize full employee object if only profile was provided
  const effectiveEmployee: Employee = employee || ({
    id: `emp-proxy-${empProfile?.id || Date.now()}`,
    profile_id: empProfile?.id || '',
    organization_id: empProfile?.organization_id || organization?.id || '',
    employee_code: empCode,
    designation,
    basic_salary: 25000,
    employment_status: 'active',
    joining_date: new Date().toISOString().split('T')[0],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    onboarding_completed: true,
    profile: empProfile || undefined,
  } as Employee);

  // 1. Resend via Email
  const handleResendEmail = async () => {
    const target = recipientEmail.trim();
    if (!target) {
      setFeedback({ type: 'error', message: 'Please enter a valid recipient email address.' });
      return;
    }

    setSendingEmail(true);
    setFeedback(null);
    try {
      await resendAppointmentLetterEmail({
        employee: effectiveEmployee,
        targetEmail: target,
        organization,
      });

      const successMsg = `Letter of Appointment was successfully sent to ${target}!`;
      setFeedback({ type: 'success', message: successMsg });
      if (onSuccess) onSuccess(successMsg);

      // Refresh stored record
      if (employee?.id) {
        const updated = await getAppointmentLetterByEmployeeId(employee.id);
        if (updated) setStoredRecord(updated);
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to dispatch appointment letter email. Please try again.',
      });
    } finally {
      setSendingEmail(false);
    }
  };

  // 2. Download / Export PDF
  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    setFeedback(null);
    try {
      await downloadAppointmentLetterPdf({
        employee: effectiveEmployee,
        organization,
        refNumber: storedRecord?.ref_number || refNo,
      });

      const successMsg = 'Appointment letter PDF generated and ready for print/download.';
      setFeedback({ type: 'success', message: successMsg });
      if (onSuccess) onSuccess(successMsg);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to generate PDF. Please try again.',
      });
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <Modal visible={visible} onClose={onClose} title="Letter of Appointment" maxWidth={660}>
      <View style={{ gap: 16 }}>
        {/* Header Summary */}
        <View style={[styles.headerBanner, { backgroundColor: '#F0F9F8', borderColor: '#0D737730' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[styles.iconWrap, { backgroundColor: '#0D7377' }]}>
                <FileText size={20} color="#FFFFFF" />
              </View>
              <View>
                <Text style={[styles.bannerTitle, { color: '#0F172A' }]}>{empName}</Text>
                <Text style={{ fontSize: 13, color: '#64748B' }}>
                  {designation} · {empCode}
                </Text>
              </View>
            </View>
            <Badge
              label={storedRecord?.email_sent ? 'Sent via Email' : 'Appointment Ready'}
              variant={storedRecord?.email_sent ? 'success' : 'neutral'}
            />
          </View>

          {/* Quick Meta Details */}
          <View style={styles.metaGrid}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>REFERENCE NUMBER</Text>
              <Text style={styles.metaValue}>{storedRecord?.ref_number || refNo}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>DEPARTMENT</Text>
              <Text style={styles.metaValue}>{departmentName}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>HOSPITAL / UNIT</Text>
              <Text style={styles.metaValue}>{unit}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>GROSS MONTHLY</Text>
              <Text style={[styles.metaValue, { color: '#0D7377', fontWeight: '800' }]}>
                {formatCurrency(effectiveGross)}
              </Text>
            </View>
          </View>
        </View>

        {/* Feedback Alert */}
        {feedback && (
          <View
            style={[
              styles.feedbackBanner,
              feedback.type === 'success'
                ? { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }
                : { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
            ]}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 size={18} color="#166534" />
            ) : (
              <AlertCircle size={18} color="#991B1B" />
            )}
            <Text
              style={[
                styles.feedbackText,
                { color: feedback.type === 'success' ? '#166534' : '#991B1B' },
              ]}
            >
              {feedback.message}
            </Text>
          </View>
        )}

        {/* ── ACTION CARD 1: RESEND VIA EMAIL ────────────────────────── */}
        <View style={[styles.actionCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <View style={[styles.actionIconWrap, { backgroundColor: '#EEF2FF' }]}>
              <Mail size={18} color="#4F46E5" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardHeading, { color: colors.text }]}>Resend in Email Format</Text>
              <Text style={styles.cardSubheading}>
                Dispatches the official appointment letter with salary Annexure A, terms & conditions to the employee.
              </Text>
            </View>
          </View>

          <View style={{ gap: 8, marginTop: 4 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>
              Recipient Email Address:
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TextInput
                value={recipientEmail}
                onChangeText={setRecipientEmail}
                placeholder="employee@hospital.com"
                placeholderTextColor="#94A3B8"
                style={[
                  styles.emailInput,
                  {
                    borderColor: colors.border,
                    color: colors.text,
                    backgroundColor: colors.background,
                  },
                ]}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={handleResendEmail}
                disabled={sendingEmail}
                style={[
                  styles.primaryActionBtn,
                  { backgroundColor: '#4F46E5', opacity: sendingEmail ? 0.7 : 1 },
                ]}
                activeOpacity={0.8}
              >
                {sendingEmail ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Send size={15} color="#FFFFFF" />
                    <Text style={styles.primaryActionBtnText}>Send Email</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {storedRecord?.last_emailed_at && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
              <Clock size={12} color="#64748B" />
              <Text style={{ fontSize: 11, color: '#64748B' }}>
                Last emailed: {formatDate(storedRecord.last_emailed_at)} ({storedRecord.resend_count || 1} time
                {(storedRecord.resend_count || 1) > 1 ? 's' : ''})
              </Text>
            </View>
          )}
        </View>

        {/* ── ACTION CARD 2: DOWNLOAD / EXPORT PDF ────────────────────── */}
        <View style={[styles.actionCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View style={[styles.actionIconWrap, { backgroundColor: '#F0FDF4' }]}>
                <Download size={18} color="#0D7377" />
              </View>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={[styles.cardHeading, { color: colors.text }]}>Export in PDF Format</Text>
                <Text style={styles.cardSubheading}>
                  Generate, print, or share the formal signed Letter of Appointment document.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleDownloadPdf}
              disabled={downloadingPdf}
              style={[
                styles.primaryActionBtn,
                { backgroundColor: '#0D7377', opacity: downloadingPdf ? 0.7 : 1 },
              ]}
              activeOpacity={0.8}
            >
              {downloadingPdf ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Download size={15} color="#FFFFFF" />
                  <Text style={styles.primaryActionBtnText}>Download PDF</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ── ACTION CARD 3: PREVIEW DOCUMENT ────────────────────────── */}
        <View style={[styles.actionCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
            onPress={() => setShowPreview(!showPreview)}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[styles.actionIconWrap, { backgroundColor: '#FEF3C7' }]}>
                {showPreview ? <EyeOff size={18} color="#D97706" /> : <Eye size={18} color="#D97706" />}
              </View>
              <View>
                <Text style={[styles.cardHeading, { color: colors.text }]}>
                  {showPreview ? 'Hide Document Preview' : 'Preview Appointment Letter'}
                </Text>
                <Text style={styles.cardSubheading}>
                  Review the appointment terms, compensation annexure, and hospital clauses.
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#D97706' }}>
                {showPreview ? 'Collapse' : 'View'}
              </Text>
              {showPreview ? (
                <ChevronUp size={14} color="#D97706" />
              ) : (
                <ChevronDown size={14} color="#D97706" />
              )}
            </View>
          </TouchableOpacity>

          {showPreview ? (
            <View style={[styles.previewBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
              {/* Hospital Header */}
              <View style={styles.previewHeader}>
                <View>
                  <Text style={[styles.prevHospitalName, { color: '#0D7377' }]}>{orgName}</Text>
                  <Text style={styles.prevHospitalUnit}>{unit}</Text>
                  <Text style={styles.prevHospitalSubtitle}>Multi-Super Specialty Healthcare Center · NABH Accredited</Text>
                </View>
                <Badge label="OFFICIAL APPOINTMENT" variant="success" />
              </View>

              <View style={styles.prevRefMeta}>
                <Text style={styles.prevMetaText}>Ref: {storedRecord?.ref_number || refNo}</Text>
                <Text style={styles.prevMetaText}>Issue Date: {formatDate(new Date().toISOString())}</Text>
              </View>

              {/* Salutation */}
              <View style={{ marginVertical: 10 }}>
                <Text style={[styles.prevText, { fontWeight: '700' }]}>To,</Text>
                <Text style={[styles.prevText, { fontWeight: '800', color: '#0F172A' }]}>{empName}</Text>
                <Text style={styles.prevText}>Employee Code: {empCode}</Text>
                <Text style={styles.prevText}>Designation: {designation}</Text>
                <Text style={styles.prevText}>Department: {departmentName}</Text>
              </View>

              <Text style={styles.prevTitle}>Formal Letter of Appointment</Text>

              <Text style={styles.prevText}>
                Dear {empName}, we are pleased to confirm your appointment as {designation} in the {departmentName} department at {unit}, subject to standard terms and operational policies.
              </Text>

              {/* Annexure A Table */}
              <Text style={[styles.prevSectionHeader, { color: '#0D7377' }]}>
                Annexure A: Monthly Compensation Structure
              </Text>

              <View style={[styles.tableContainer, { borderColor: colors.border }]}>
                <View style={[styles.tableRow, styles.tableHeaderRow]}>
                  <Text style={[styles.tableCell, { flex: 2, fontWeight: '700' }]}>Component</Text>
                  <Text style={[styles.tableCell, { flex: 1, textAlign: 'right', fontWeight: '700' }]}>Monthly</Text>
                  <Text style={[styles.tableCell, { flex: 1, textAlign: 'right', fontWeight: '700' }]}>Annual</Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={[styles.tableCell, { flex: 2 }]}>Basic Salary (50%)</Text>
                  <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>{formatCurrency(basic)}</Text>
                  <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>{formatCurrency(basic * 12)}</Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={[styles.tableCell, { flex: 2 }]}>HRA (20%)</Text>
                  <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>{formatCurrency(hra)}</Text>
                  <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>{formatCurrency(hra * 12)}</Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={[styles.tableCell, { flex: 2 }]}>Conveyance Allowance</Text>
                  <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>{formatCurrency(conveyance)}</Text>
                  <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>{formatCurrency(conveyance * 12)}</Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={[styles.tableCell, { flex: 2 }]}>Washing Allowance</Text>
                  <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>{formatCurrency(washing)}</Text>
                  <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>{formatCurrency(washing * 12)}</Text>
                </View>
                {customItems.map((ci, idx) => (
                  <View key={`ci-${idx}`} style={styles.tableRow}>
                    <Text style={[styles.tableCell, { flex: 2 }]}>{ci.name}</Text>
                    <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>{formatCurrency(ci.value)}</Text>
                    <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>{formatCurrency(ci.value * 12)}</Text>
                  </View>
                ))}
                <View style={styles.tableRow}>
                  <Text style={[styles.tableCell, { flex: 2 }]}>Special Allowance</Text>
                  <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>{formatCurrency(specialAllowance)}</Text>
                  <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>{formatCurrency(specialAllowance * 12)}</Text>
                </View>
                <View style={[styles.tableRow, { backgroundColor: '#F8FAFC' }]}>
                  <Text style={[styles.tableCell, { flex: 2, fontWeight: '800', color: '#0D7377' }]}>Gross Total</Text>
                  <Text style={[styles.tableCell, { flex: 1, textAlign: 'right', fontWeight: '800', color: '#0D7377' }]}>
                    {formatCurrency(effectiveGross)}
                  </Text>
                  <Text style={[styles.tableCell, { flex: 1, textAlign: 'right', fontWeight: '800', color: '#0D7377' }]}>
                    {formatCurrency(effectiveGross * 12)}
                  </Text>
                </View>
              </View>

              <Text style={{ fontSize: 11.5, color: '#64748B', marginTop: 8 }}>
                Statutory Coverage: {isPf ? 'EPF Enrolled.' : 'Non-PF category.'} {isEsic ? 'Covered under ESIC.' : 'ESIC exempt.'}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Footer Actions */}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 }}>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.closeBtn, { borderColor: colors.border }]}
            activeOpacity={0.7}
          >
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  headerBanner: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#0D737720',
  },
  metaItem: {
    flex: 1,
    minWidth: 120,
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  feedbackText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  actionCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeading: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  cardSubheading: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  emailInput: {
    flex: 1,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  previewBox: {
    marginTop: 14,
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 2,
    borderBottomColor: '#0D7377',
    paddingBottom: 10,
    marginBottom: 10,
  },
  prevHospitalName: {
    fontSize: 16,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  prevHospitalUnit: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
    marginTop: 1,
  },
  prevHospitalSubtitle: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  prevRefMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 8,
  },
  prevMetaText: {
    fontSize: 11,
    color: '#64748B',
  },
  prevTitle: {
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'uppercase',
    textDecorationLine: 'underline',
    marginVertical: 8,
    color: '#0F172A',
  },
  prevText: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 18,
  },
  prevSectionHeader: {
    fontSize: 12.5,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
  },
  tableContainer: {
    borderWidth: 1,
    borderRadius: 6,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tableHeaderRow: {
    backgroundColor: '#F1F5F9',
  },
  tableCell: {
    fontSize: 11.5,
    color: '#1E293B',
  },
  closeBtn: {
    paddingVertical: 9,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
  },
});
