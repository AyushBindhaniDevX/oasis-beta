import { Avatar } from '@/components/ui/Avatar';
import {
  CraftButton,
  CraftCard,
  Typography,
  T,
  S,
} from '@/components/ui/CraftKit';
import { LoadingState } from '@/components/ui/States';
import { PageHeader, SectionLabel } from '@/components/ui/kit';
import { FONT, R } from '@/constants/ui';
import { useTenant } from '@/context/TenantContext';
import { useAuth } from '@/hooks/useAuth';
import { downloadAppointmentLetterPdf } from '@/lib/services/appointmentLetters';
import { getEmployeeByProfileId } from '@/lib/services/employee';
import { updateUserProfileData } from '@/lib/services/organization';
import type { Employee } from '@/types';
import { formatDate } from '@/utils/format';
import {
  Building,
  CheckCircle2, Download,
  Edit2,
  FileText,
  Mail,
  MapPin,
  Phone,
  User,
  X,
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const { profile, refreshProfile } = useAuth();
  const { organization } = useTenant();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const activeOrgId = organization?.id || profile?.organization_id;

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [downloadingLetter, setDownloadingLetter] = useState(false);
  const [downloadFeedback, setDownloadFeedback] = useState<string | null>(null);

  const handleDownload = async () => {
    if (!employee) return;
    setDownloadingLetter(true);
    setDownloadFeedback(null);
    try {
      await downloadAppointmentLetterPdf({ employee, organization });
      setDownloadFeedback('Letter of appointment PDF generated.');
      setTimeout(() => setDownloadFeedback(null), 4000);
    } catch (e: any) {
      setDownloadFeedback(e.message || 'Failed to download.');
      setTimeout(() => setDownloadFeedback(null), 4000);
    } finally {
      setDownloadingLetter(false);
    }
  };

  useEffect(() => {
    (async () => {
      if (!profile) return;
      setLoading(true);
      const emp = await getEmployeeByProfileId(profile.id, activeOrgId);
      setEmployee(emp);
      setLoading(false);
    })();
  }, [profile, activeOrgId]);

  const openEdit = () => {
    setEditName(profile?.full_name || '');
    setEditPhone(profile?.phone || '');
    setSaveSuccess(false);
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      await updateUserProfileData(profile.id, {
        full_name: editName.trim() || profile.full_name,
        phone: editPhone.trim() || undefined,
      });
      await refreshProfile();
      setSaveSuccess(true);
      setTimeout(() => {
        setEditOpen(false);
        setSaveSuccess(false);
      }, 1400);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState />;

  const empCode = employee?.employee_code || '—';
  const role = employee?.designation || profile?.role || 'Employee';
  const dept = employee?.department?.name || '—';
  const location = employee?.workplace?.name || '—';
  const joinDate = employee?.joining_date ? formatDate(employee.joining_date) : '—';

  const InfoRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
      <View style={{ width: 32, height: 32, borderRadius: R.md, backgroundColor: T.surface, alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: FONT, fontSize: 9, fontWeight: '600', color: T.steel, letterSpacing: 0.6 }}>
          {label.toUpperCase()}
        </Text>
        <Text style={{ fontFamily: FONT, fontSize: 13, fontWeight: '500', color: T.ink, marginTop: 2 }}>{value}</Text>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: T.surfaceSoft }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Constant PageHeader ── */}
        <PageHeader
          title="Employee Profile"
          subtitle="Personal and professional employment records"
          topInset={insets.top}
          right={
            <TouchableOpacity onPress={openEdit} style={styles.editBtn} activeOpacity={0.8}>
              <Edit2 size={12} color={T.onPrimary} />
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          }
        />

        <View style={[styles.body, isDesktop && styles.bodyDesktop]}>
          {/* Avatar hero */}
          <Animated.View entering={FadeInDown.duration(280)}>
            <CraftCard variant="base" style={styles.heroCard}>
              <View style={{ alignItems: 'center', paddingTop: 4 }}>
                <Avatar name={profile?.full_name || ''} url={profile?.avatar_url} size={80} />
                <Text style={styles.heroName}>{profile?.full_name}</Text>
                <Text style={styles.heroRole}>{role}</Text>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                  {empCode !== '—' && (
                    <View style={styles.pill}>
                      <Text style={styles.pillText}>ID {empCode}</Text>
                    </View>
                  )}
                  <View style={[styles.pill, { backgroundColor: T.mint }]}>
                    <Text style={[styles.pillText, { color: T.mintDeep }]}>Active</Text>
                  </View>
                </View>
              </View>
            </CraftCard>
          </Animated.View>

          <View style={isDesktop ? styles.gridDesktop : { gap: 16 }}>
            {/* Contact */}
            <Animated.View entering={FadeInDown.delay(60).duration(280)} style={{ flex: 1 }}>
              <SectionLabel>Contact</SectionLabel>
              <CraftCard variant="base" style={styles.card}>
                <InfoRow icon={<Mail size={14} color={T.inkFaint} />} label="Email" value={profile?.email || '—'} />
                <View style={styles.sep} />
                <InfoRow icon={<Phone size={14} color={T.inkFaint} />} label="Phone" value={profile?.phone || '—'} />
                <View style={styles.sep} />
                <InfoRow icon={<MapPin size={14} color={T.inkFaint} />} label="Workplace" value={location} />
              </CraftCard>
            </Animated.View>

            {/* Employment */}
            <Animated.View entering={FadeInDown.delay(100).duration(280)} style={{ flex: 1 }}>
              <SectionLabel>Employment</SectionLabel>
              <CraftCard variant="base" style={styles.card}>
                <InfoRow icon={<Building size={14} color={T.inkFaint} />} label="Department" value={dept} />
                <View style={styles.sep} />
                <InfoRow icon={<User size={14} color={T.inkFaint} />} label="Designation" value={role} />
                <View style={styles.sep} />
                <InfoRow icon={<FileText size={14} color={T.inkFaint} />} label="Join date" value={joinDate} />
                <View style={styles.sep} />
                <View style={{ paddingVertical: 10 }}>
                  <Text style={{ fontFamily: FONT, fontSize: 9, fontWeight: '600', color: T.inkFaint, letterSpacing: 0.6 }}>
                    APPOINTMENT LETTER
                  </Text>
                  <CraftButton
                    title="Download PDF"
                    variant="secondary"
                    size="sm"
                    loading={downloadingLetter}
                    icon={<Download size={12} color={T.ink} />}
                    onPress={handleDownload}
                    style={{ marginTop: S.xs, alignSelf: 'flex-start' }}
                  />
                  {downloadFeedback && (
                    <Text style={{ fontFamily: FONT, fontSize: 11, color: T.inkFaint, marginTop: 4 }}>
                      {downloadFeedback}
                    </Text>
                  )}
                </View>
              </CraftCard>
            </Animated.View>
          </View>
        </View>
      </ScrollView>

      {/* Edit modal — Notion style */}
      {editOpen && (
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setEditOpen(false)} />
          <View style={styles.modalSheet}>
            {saveSuccess ? (
              <View style={{ alignItems: 'center', padding: 20, gap: 10 }}>
                <CheckCircle2 size={32} color={T.success} />
                <Text style={{ fontFamily: FONT, fontSize: 15, fontWeight: '600', color: T.ink }}>
                  Profile updated
                </Text>
              </View>
            ) : (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontFamily: FONT, fontSize: 16, fontWeight: '600', color: T.ink }}>
                    Edit profile
                  </Text>
                  <TouchableOpacity onPress={() => setEditOpen(false)}>
                    <X size={16} color={T.inkFaint} />
                  </TouchableOpacity>
                </View>
                <View style={{ gap: 10, marginTop: 14 }}>
                  <View>
                    <Text style={styles.inputLabel}>Full name</Text>
                    <TextInput value={editName} onChangeText={setEditName} style={styles.input} placeholderTextColor={T.inkMuted} />
                  </View>
                  <View>
                    <Text style={styles.inputLabel}>Phone</Text>
                    <TextInput value={editPhone} onChangeText={setEditPhone} style={styles.input} placeholderTextColor={T.inkMuted} keyboardType="phone-pad" />
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <CraftButton title="Cancel" onPress={() => setEditOpen(false)} variant="secondary" style={{ flex: 1 }} />
                    <CraftButton title="Save" onPress={handleSave} loading={saving} style={{ flex: 1 }} />
                  </View>
                </View>
              </>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 16 },
  bodyDesktop: { maxWidth: 1000, alignSelf: 'center', width: '100%', padding: 32 },

  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: T.primary, borderRadius: R.md,
  },
  editBtnText: { fontFamily: FONT, fontSize: 12, fontWeight: '500', color: T.onPrimary },

  heroCard: {
    backgroundColor: T.canvas, borderRadius: R.lg,
    borderWidth: 1, borderColor: T.hairline, padding: 20, marginBottom: 16,
  },
  heroName: { fontFamily: FONT, fontSize: 22, fontWeight: '600', color: T.ink, letterSpacing: -0.6, marginTop: 12 },
  heroRole: { fontFamily: FONT, fontSize: 13, color: T.steel, marginTop: 2 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.sm, backgroundColor: T.surface },
  pillText: { fontFamily: FONT, fontSize: 10, fontWeight: '600', color: T.charcoal },

  gridDesktop: { flexDirection: 'row', gap: 16 },
  card: {
    backgroundColor: T.canvas, borderRadius: R.lg,
    borderWidth: 1, borderColor: T.hairline, padding: 14,
  },
  sep: { height: 1, backgroundColor: T.hairlineSoft },

  modalOverlay: {
    ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center', zIndex: 1000,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill, backgroundColor: 'rgba(10,21,48,0.55)',
  },
  modalSheet: {
    width: '92%', maxWidth: 400, backgroundColor: T.canvas,
    borderRadius: R.lg, padding: 20, borderWidth: 1, borderColor: T.hairline,
  },
  inputLabel: {
    fontFamily: FONT, fontSize: 10, fontWeight: '600', color: T.steel,
    letterSpacing: 0.6, marginBottom: 4,
  },
  input: {
    fontFamily: FONT, fontSize: 13, color: T.ink,
    backgroundColor: T.surface, borderRadius: R.md,
    borderWidth: 1, borderColor: T.hairline,
    paddingHorizontal: 12, height: 40,
  },
});