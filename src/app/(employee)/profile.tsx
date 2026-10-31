import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, useWindowDimensions, Platform, StatusBar, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/context/TenantContext';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/States';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { getEmployeeByProfileId } from '@/lib/services/employee';
import { formatDate } from '@/utils/format';
import type { Employee } from '@/types';
import { updateUserProfileData } from '@/lib/services/organization';
import { downloadAppointmentLetterPdf } from '@/lib/services/appointmentLetters';
import { Edit2, Mail, Phone, MapPin, Building, User, FileText, Upload, CheckCircle2, Download } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function ProfileScreen() {
  const colors = useTheme();
  const { profile, refreshProfile } = useAuth();
  const { organization } = useTenant();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const topPadding = Math.max(insets.top, Platform.OS === 'ios' ? 44 : 20);

  const activeOrgId = organization?.id || profile?.organization_id;

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  // Appointment Letter Download State
  const [downloadingLetter, setDownloadingLetter] = useState(false);
  const [downloadFeedback, setDownloadFeedback] = useState<string | null>(null);

  const handleDownloadAppointmentLetter = async () => {
    if (!employee) return;
    setDownloadingLetter(true);
    setDownloadFeedback(null);
    try {
      await downloadAppointmentLetterPdf({
        employee,
        organization,
      });
      setDownloadFeedback('Letter of appointment PDF generated!');
      setTimeout(() => setDownloadFeedback(null), 4000);
    } catch (e: any) {
      setDownloadFeedback(e.message || 'Failed to download appointment letter PDF.');
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
      }, 1500);
    } catch (err) {
      console.error('Save profile error:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState />;

  const empCode = employee?.employee_code || 'N/A';
  const role = employee?.designation || profile?.role || 'Employee';
  const dept = employee?.department?.name || 'N/A';
  const location = employee?.workplace?.name || 'N/A';
  const joinDate = employee?.joining_date ? formatDate(employee.joining_date) : 'N/A';

  // ─────────────────────────────────────────────────────────────────────────────
  // MOBILE LAYOUT
  // ─────────────────────────────────────────────────────────────────────────────
  if (!isDesktop) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.primaryDark }}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          {/* Top bounce underlay matching header card */}
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 350, backgroundColor: colors.primaryDark }} />

          {/* Edit Modal */}
          <Modal visible={editOpen} onClose={() => setEditOpen(false)} title="Edit Profile">
            {saveSuccess ? (
              <View style={{ alignItems: 'center', padding: 24, gap: 12 }}>
                <CheckCircle2 size={40} color={colors.primary} />
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16 }}>Profile Updated!</Text>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                <Input
                  label="Full Name"
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Your full name"
                />
                <Input
                  label="Phone Number"
                  value={editPhone}
                  onChangeText={setEditPhone}
                  placeholder="+1 (555) 000-0000"
                  keyboardType="phone-pad"
                />
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                  <Button title="Cancel" onPress={() => setEditOpen(false)} variant="outline" style={{ flex: 1, borderRadius: 12 }} />
                  <Button title="Save" onPress={handleSave} loading={saving} style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 12 }} />
                </View>
              </View>
            )}
          </Modal>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 100 }}
            contentInsetAdjustmentBehavior="never"
            automaticallyAdjustContentInsets={false}
            showsVerticalScrollIndicator={false}
          >
            {/* ── Mobile Gradient Profile Hero ── */}
            <View style={[mProfStyles.heroGradient, { paddingTop: topPadding + 10, backgroundColor: colors.primaryDark }]}>
            <Animated.View entering={FadeInDown.springify().damping(15)} style={mProfStyles.avatarWrap}>
              <Avatar name={profile?.full_name || ''} url={profile?.avatar_url} size={90} />
              <TouchableOpacity style={[mProfStyles.editAvatarBtn, { backgroundColor: colors.primary }]} onPress={openEdit}>
                <Edit2 size={14} color="#FFF" />
              </TouchableOpacity>
            </Animated.View>

            <Text style={mProfStyles.heroName}>{profile?.full_name}</Text>
            <Text style={mProfStyles.heroRole}>{role}</Text>

            <View style={mProfStyles.heroBadgesRow}>
              {empCode !== 'N/A' && (
                <View style={mProfStyles.heroPill}>
                  <Text style={mProfStyles.heroPillText}>ID: {empCode}</Text>
                </View>
              )}
              <View style={[mProfStyles.heroPill, { backgroundColor: 'rgba(110, 231, 183, 0.2)' }]}>
                <Text style={[mProfStyles.heroPillText, { color: '#6EE7B7' }]}>Active Member</Text>
              </View>
            </View>
          </View>

          {/* ── Contact Details Card ── */}
          <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
            <View style={mProfStyles.infoCard}>
              <Text style={mProfStyles.cardTitle}>Contact Details</Text>

              <View style={mProfStyles.infoRow}>
                <View style={mProfStyles.infoIconWrap}>
                  <Mail size={16} color="#006a61" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={mProfStyles.infoLabel}>EMAIL ADDRESS</Text>
                  <Text style={mProfStyles.infoValue}>{profile?.email || 'Not set'}</Text>
                </View>
              </View>

              <View style={mProfStyles.infoRow}>
                <View style={mProfStyles.infoIconWrap}>
                  <Phone size={16} color="#006a61" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={mProfStyles.infoLabel}>PHONE NUMBER</Text>
                  <Text style={mProfStyles.infoValue}>{profile?.phone || 'Not set'}</Text>
                </View>
              </View>

              <View style={mProfStyles.infoRow}>
                <View style={mProfStyles.infoIconWrap}>
                  <MapPin size={16} color="#006a61" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={mProfStyles.infoLabel}>WORKPLACE</Text>
                  <Text style={mProfStyles.infoValue}>{location}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* ── Employment & Organization Card ── */}
          <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
            <View style={mProfStyles.infoCard}>
              <Text style={mProfStyles.cardTitle}>Employment Details</Text>

              <View style={mProfStyles.infoRow}>
                <View style={[mProfStyles.infoIconWrap, { backgroundColor: '#EEEBFF' }]}>
                  <Building size={16} color="#4F46E5" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={mProfStyles.infoLabel}>DEPARTMENT</Text>
                  <Text style={mProfStyles.infoValue}>{dept}</Text>
                </View>
              </View>

              <View style={mProfStyles.infoRow}>
                <View style={[mProfStyles.infoIconWrap, { backgroundColor: '#E0F2FE' }]}>
                  <User size={16} color="#0369A1" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={mProfStyles.infoLabel}>DESIGNATION</Text>
                  <Text style={mProfStyles.infoValue}>{role}</Text>
                </View>
              </View>

              <View style={mProfStyles.infoRow}>
                <View style={[mProfStyles.infoIconWrap, { backgroundColor: '#FEF3C7' }]}>
                  <FileText size={16} color="#B45309" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={mProfStyles.infoLabel}>JOIN DATE</Text>
                  <Text style={mProfStyles.infoValue}>{joinDate}</Text>
                </View>
              </View>

              <View style={[mProfStyles.infoRow, { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12, marginTop: 4 }]}>
                <View style={[mProfStyles.infoIconWrap, { backgroundColor: '#F0F9F8' }]}>
                  <Download size={16} color="#0D7377" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={mProfStyles.infoLabel}>APPOINTMENT LETTER</Text>
                  <TouchableOpacity
                    onPress={handleDownloadAppointmentLetter}
                    disabled={downloadingLetter}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}
                    activeOpacity={0.7}
                  >
                    {downloadingLetter ? (
                      <ActivityIndicator size="small" color="#0D7377" />
                    ) : (
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#0D7377' }}>
                        Download Official PDF →
                      </Text>
                    )}
                  </TouchableOpacity>
                  {downloadFeedback && (
                    <Text style={{ fontSize: 11, color: '#0D7377', fontWeight: '600', marginTop: 4 }}>
                      {downloadFeedback}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          </View>

          {/* ── Edit Button Action ── */}
          <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
            <TouchableOpacity
              style={[mProfStyles.editActionBtn, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
              onPress={openEdit}
              activeOpacity={0.85}
            >
              <Edit2 size={16} color="#FFFFFF" />
              <Text style={mProfStyles.editActionBtnText}>Edit Contact Info</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </View>
  );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DESKTOP LAYOUT (unchanged)
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, styles.contentDesktop]}
    >
      {/* Edit Modal */}
      <Modal visible={editOpen} onClose={() => setEditOpen(false)} title="Edit Profile">
        {saveSuccess ? (
          <View style={{ alignItems: 'center', padding: 24, gap: 12 }}>
            <CheckCircle2 size={40} color="#006a61" />
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16 }}>Profile Updated!</Text>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            <Input
              label="Full Name"
              value={editName}
              onChangeText={setEditName}
              placeholder="Your full name"
            />
            <Input
              label="Phone Number"
              value={editPhone}
              onChangeText={setEditPhone}
              placeholder="+1 (555) 000-0000"
              keyboardType="phone-pad"
            />
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <Button title="Cancel" onPress={() => setEditOpen(false)} variant="outline" style={{ flex: 1, borderRadius: 8 }} />
              <Button title="Save Changes" onPress={handleSave} loading={saving} style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 8 }} />
            </View>
          </View>
        )}
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]}>My Profile</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Manage your personal and professional information.</Text>
        </View>
        <TouchableOpacity style={[styles.editBtn, { backgroundColor: colors.primary }]} onPress={openEdit}>
          <Edit2 size={14} color="#FFF" />
          <Text style={styles.editBtnText}>Edit Profile</Text>
        </TouchableOpacity>
      </View>

      {/* Banner Card */}
      <View style={[styles.bannerCard, { backgroundColor: colors.surface, borderColor: '#e2e8f0' }]}>
        <View style={styles.bannerTop} />
        <View style={styles.bannerBottom}>
          <View style={styles.avatarWrapper}>
            <Avatar name={profile?.full_name || ''} url={profile?.avatar_url} size={88} />
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.name, { color: colors.text }]}>{profile?.full_name}</Text>
            <View style={styles.badgesRow}>
              <Text style={[styles.roleText, { color: colors.textSecondary }]}>{role}  •</Text>
              {empCode !== 'N/A' && <Badge label={empCode} variant="accentLight" />}
              <Badge label="Active" variant="successLight" />
            </View>
          </View>
        </View>
      </View>

      {/* Grid Layout */}
      <View style={isDesktop ? styles.gridDesktop : styles.gridMobile}>

        {/* Left Column */}
        <View style={isDesktop ? styles.colLeft : styles.gridMobile}>

          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: '#e2e8f0' }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Contact Details</Text>

            <View style={styles.infoRow}>
              <Mail size={18} color={colors.textSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>EMAIL ADDRESS</Text>
                <Text style={[styles.infoValue, { color: colors.textSecondary }]}>{profile?.email || 'Not set'}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Phone size={18} color={colors.textSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>PHONE NUMBER</Text>
                <Text style={[styles.infoValue, { color: colors.textSecondary }]}>{profile?.phone || 'Not set'}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <MapPin size={18} color={colors.textSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>OFFICE LOCATION</Text>
                <Text style={[styles.infoValue, { color: colors.textSecondary }]}>{location}</Text>
              </View>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: '#e2e8f0' }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Organization</Text>

            <View style={styles.infoRow}>
              <Building size={18} color={colors.textSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>DEPARTMENT</Text>
                <Text style={[styles.infoValue, { color: colors.textSecondary }]}>{dept}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <User size={18} color={colors.textSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>EMPLOYEE CODE</Text>
                <Text style={[styles.infoValue, { color: colors.textSecondary }]}>{empCode}</Text>
              </View>
            </View>
          </View>

        </View>

        {/* Right Column */}
        <View style={isDesktop ? styles.colRight : styles.gridMobile}>

          <View style={{ flexDirection: 'row', gap: 16 }}>
            <View style={[styles.card, { flex: 1, backgroundColor: colors.surface, borderColor: '#e2e8f0' }]}>
              <Text style={styles.infoLabel}>HIRE DATE</Text>
              <Text style={[styles.infoValueLg, { color: colors.text }]}>{joinDate}</Text>
            </View>
            <View style={[styles.card, { flex: 1, backgroundColor: colors.surface, borderColor: '#e2e8f0' }]}>
              <Text style={styles.infoLabel}>EMPLOYMENT STATUS</Text>
              <View style={{ marginTop: 8 }}>
                <Badge label={employee?.employment_status || 'Active'} variant="successLight" />
              </View>
            </View>
          </View>

          {/* Letter of Appointment Card - Strictly for Admin and HR */}
          {(profile?.role === 'admin' || profile?.role === 'hr') && (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: '#e2e8f0' }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#F0F9F8', alignItems: 'center', justifyContent: 'center' }}>
                    <FileText size={20} color="#0D7377" />
                  </View>
                  <View>
                    <Text style={[styles.cardTitle, { color: colors.text, marginBottom: 2 }]}>Letter of Appointment</Text>
                    <Text style={{ fontSize: 13, color: colors.textSecondary }}>Official appointment terms & compensation document</Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={handleDownloadAppointmentLetter}
                  disabled={downloadingLetter}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    backgroundColor: '#0D7377',
                    borderRadius: 8,
                  }}
                  activeOpacity={0.8}
                >
                  {downloadingLetter ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Download size={15} color="#FFFFFF" />
                      <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>Download PDF</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {downloadFeedback && (
                <Text style={{ fontSize: 12, color: '#0D7377', fontWeight: '600' }}>{downloadFeedback}</Text>
              )}
            </View>
          )}

          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: '#e2e8f0' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={[styles.cardTitle, { color: colors.text, marginBottom: 0 }]}>Personal Documents</Text>
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Upload size={14} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>Upload</Text>
              </TouchableOpacity>
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center', paddingVertical: 24 }}>
              No documents uploaded yet.{'\n'}Tap Upload to add your documents.
            </Text>
          </View>

        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, gap: 28, paddingBottom: 60 },
  contentDesktop: { maxWidth: 1200, alignSelf: 'center', width: '100%', padding: 40, gap: 36 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 },
  title: { fontSize: 32, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { fontSize: 15, marginTop: 4 },

  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  editBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },

  bannerCard: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  bannerTop: { height: 100, backgroundColor: '#eaf1ff' },
  bannerBottom: { padding: 20, paddingTop: 8, flexDirection: 'row', alignItems: 'flex-end', gap: 20 },
  avatarWrapper: { marginTop: -56, borderRadius: 48, borderWidth: 4, borderColor: '#ffffff', backgroundColor: '#ffffff' },
  profileInfo: { paddingBottom: 4 },
  name: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3, marginBottom: 6 },
  badgesRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  roleText: { fontSize: 14, fontWeight: '500' },

  gridDesktop: { flexDirection: 'row', gap: 24 },
  gridMobile: { gap: 20 },
  colLeft: { flex: 4, gap: 20 },
  colRight: { flex: 5, gap: 20 },

  card: { padding: 24, borderRadius: 12, borderWidth: 1, gap: 16 },
  cardTitle: { fontSize: 17, fontWeight: '600', letterSpacing: -0.2 },

  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  infoLabel: { fontSize: 10, fontWeight: '700', color: '#64748b', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4 },
  infoValue: { fontSize: 14, lineHeight: 20 },
  infoValueLg: { fontSize: 16, fontWeight: '600', marginTop: 8 },
});

// ─── MOBILE PROFILE STYLES ──────────────────────────────────────────────────
const mProfStyles = StyleSheet.create({
  heroGradient: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 28,
    paddingBottom: 28,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    alignItems: 'center',
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
  avatarWrap: {
    position: 'relative',
    marginBottom: 12,
  },
  editAvatarBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  heroRole: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.75)',
    fontWeight: '600',
    marginBottom: 12,
  },
  heroBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  heroPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Info Card
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 16,
    ...Platform.select({
      web: { boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
      },
    }),
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EDF8F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },

  // Action Button
  editActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 16,
    ...Platform.select({
      web: { boxShadow: '0 4px 12px rgba(0, 106, 97, 0.25)' },
      default: {
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 4,
      },
    }),
  },
  editActionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
