import { FaceVerificationModal } from '@/components/attendance/FaceVerificationModal';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { NotionColors } from '@/constants/theme';
import { FONT, R } from '@/constants/ui';
import { useAuth } from '@/hooks/useAuth';
import { useBiometrics } from '@/hooks/useBiometrics';
import { auth } from '@/lib/firebase';
import { enrollEmployeeFace } from '@/lib/services/biometrics';
import { trackUserActivity } from '@/lib/services/userActivity';
import { updatePassword } from 'firebase/auth';
import {
  AlertCircle, CheckCircle2,
  Fingerprint,
  Lock,
  ScanFace, ShieldCheck, UserCheck,
  X,
} from 'lucide-react-native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const { profile, signOut, refreshProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const {
    hasHardware, biometricType, isEnabled: isBiometricEnabled,
    registerBiometrics, disableBiometrics, isLoading: isBiometricsLoading,
  } = useBiometrics();

  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  const [bioModalOpen, setBioModalOpen] = useState(false);
  const [bioPassword, setBioPassword] = useState('');
  const [bioError, setBioError] = useState('');
  const [bioLoading, setBioLoading] = useState(false);

  const [faceEnrollModalOpen, setFaceEnrollModalOpen] = useState(false);

  const handleChangePassword = async () => {
    if (!newPw || newPw.length < 6) return setPwError('Min 6 characters.');
    if (newPw !== confirmPw) return setPwError('Passwords do not match.');
    setPwError('');
    setSavingPw(true);
    try {
      if (!auth.currentUser) throw new Error('No authenticated session.');
      await updatePassword(auth.currentUser, newPw.trim());
      if (profile?.id) {
        await trackUserActivity({
          userId: profile.id,
          organizationId: profile.organization_id,
          action: 'USER_PASSWORD_CHANGE',
          entityType: 'auth',
          entityId: profile.id,
          description: 'User updated personal password',
        });
      }
      setPwSuccess(true);
      setTimeout(() => setPwModalOpen(false), 1200);
    } catch (err: any) {
      setPwError(err?.message || 'Failed to update password');
    } finally {
      setSavingPw(false);
    }
  };

  const handleConfirmEnableBiometrics = async () => {
    if (!bioPassword) return setBioError('Password required.');
    setBioError('');
    setBioLoading(true);
    try {
      const result = await registerBiometrics(profile?.email || '', bioPassword);
      if (result.success) setBioModalOpen(false);
      else setBioError(result.error || 'Failed to enable.');
    } catch (err: any) {
      setBioError(err?.message || 'Failed to enable.');
    } finally {
      setBioLoading(false);
    }
  };

  const SettingRow = ({
    icon, title, subtitle, action,
  }: { icon: React.ReactNode; title: string; subtitle: string; action: React.ReactNode }) => (
    <View style={styles.row}>
      <View style={styles.iconWrap}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{subtitle}</Text>
      </View>
      {action}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: NotionColors.surfaceSoft }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          title="Account Settings"
          subtitle="Security, biometrics & account preferences"
          variant="light"
        />

        <View style={[styles.body, isDesktop && styles.bodyDesktop]}>
          <Text style={styles.sectionHeading}>Authentication</Text>
          <Card variant="outlined" style={styles.card}>
            <SettingRow
              icon={
                biometricType === 'Face ID'
                  ? <ScanFace size={14} color={NotionColors.steel} />
                  : <Fingerprint size={14} color={NotionColors.steel} />
              }
              title={`${biometricType || 'Biometric'} login`}
              subtitle={hasHardware ? '1-tap quick authentication' : 'Hardware not available'}
              action={
                isBiometricsLoading ? (
                  <ActivityIndicator size="small" color={NotionColors.ink} />
                ) : hasHardware ? (
                  <Switch
                    value={isBiometricEnabled}
                    onValueChange={(v) => (v ? setBioModalOpen(true) : disableBiometrics())}
                    trackColor={{ false: NotionColors.hairline, true: NotionColors.primary }}
                    thumbColor="#fff"
                  />
                ) : (
                  <Text style={styles.muted}>Unavailable</Text>
                )
              }
            />
            <View style={styles.sep} />
            <SettingRow
              icon={<UserCheck size={14} color={NotionColors.steel} />}
              title="Attendance Face ID"
              subtitle={profile?.biometric_enrolled || profile?.avatar_url ? 'Template registered' : 'Not enrolled'}
              action={
                <TouchableOpacity onPress={() => setFaceEnrollModalOpen(true)} style={styles.smallBtn}>
                  <Text style={styles.smallBtnText}>
                    {profile?.biometric_enrolled || profile?.avatar_url ? 'Update' : 'Enroll'}
                  </Text>
                </TouchableOpacity>
              }
            />
            <View style={styles.sep} />
            <SettingRow
              icon={<Lock size={14} color={NotionColors.steel} />}
              title="Password"
              subtitle="Change login credentials"
              action={
                <TouchableOpacity onPress={() => setPwModalOpen(true)} style={styles.smallBtn}>
                  <Text style={styles.smallBtnText}>Change</Text>
                </TouchableOpacity>
              }
            />
          </Card>

          <Text style={styles.sectionHeading}>Security</Text>
          <Card variant="outlined" style={styles.card}>
            <SettingRow
              icon={<ShieldCheck size={14} color={NotionColors.steel} />}
              title="Session security"
              subtitle={`AES-256 · IP ${profile?.last_login_ip || '—'}`}
              action={
                <View style={[styles.statusChip, { backgroundColor: NotionColors.cardTintMint }]}>
                  <Text style={[styles.statusChipText, { color: NotionColors.semanticSuccess }]}>Protected</Text>
                </View>
              }
            />
          </Card>

          <Button
            title="Sign out of account"
            variant="danger"
            onPress={signOut}
            style={{ marginTop: 16 }}
            fullWidth
          />
        </View>
      </ScrollView>

      {/* Password modal */}
      {pwModalOpen && (
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setPwModalOpen(false)} />
          <View style={styles.modalSheet}>
            {pwSuccess ? (
              <View style={{ alignItems: 'center', padding: 20 }}>
                <CheckCircle2 size={32} color={NotionColors.semanticSuccess} />
                <Text style={{ fontFamily: FONT, fontSize: 15, fontWeight: '600', color: NotionColors.ink, marginTop: 8 }}>
                  Password updated
                </Text>
              </View>
            ) : (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={styles.modalTitle}>Change password</Text>
                  <TouchableOpacity onPress={() => setPwModalOpen(false)}>
                    <X size={16} color={NotionColors.steel} />
                  </TouchableOpacity>
                </View>
                {pwError ? (
                  <View style={[styles.banner, { backgroundColor: NotionColors.cardTintRose, marginTop: 10 }]}>
                    <AlertCircle size={11} color={NotionColors.semanticError} />
                    <Text style={[styles.bannerText, { color: NotionColors.semanticError }]}>{pwError}</Text>
                  </View>
                ) : null}
                <View style={{ gap: 10, marginTop: 14 }}>
                  <TextInput secureTextEntry value={newPw} onChangeText={setNewPw} placeholder="New password" placeholderTextColor={NotionColors.muted} style={styles.input} />
                  <TextInput secureTextEntry value={confirmPw} onChangeText={setConfirmPw} placeholder="Confirm new password" placeholderTextColor={NotionColors.muted} style={styles.input} />
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                    <Button title="Cancel" onPress={() => setPwModalOpen(false)} variant="secondary" style={{ flex: 1 }} />
                    <Button title="Update" onPress={handleChangePassword} loading={savingPw} style={{ flex: 1 }} />
                  </View>
                </View>
              </>
            )}
          </View>
        </View>
      )}

      {/* Biometrics modal */}
      {bioModalOpen && (
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setBioModalOpen(false)} />
          <View style={styles.modalSheet}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={styles.modalTitle}>Enable {biometricType || 'biometric'} login</Text>
              <TouchableOpacity onPress={() => setBioModalOpen(false)}>
                <X size={16} color={NotionColors.steel} />
              </TouchableOpacity>
            </View>
            <Text style={{ fontFamily: FONT, fontSize: 12, color: NotionColors.steel, marginTop: 6 }}>
              Verify your password to authorize 1-tap login on this device.
            </Text>
            {bioError ? (
              <View style={[styles.banner, { backgroundColor: NotionColors.cardTintRose, marginTop: 10 }]}>
                <AlertCircle size={11} color={NotionColors.semanticError} />
                <Text style={[styles.bannerText, { color: NotionColors.semanticError }]}>{bioError}</Text>
              </View>
            ) : null}
            <View style={{ gap: 10, marginTop: 12 }}>
              <TextInput
                secureTextEntry value={bioPassword} onChangeText={setBioPassword}
                placeholder="Account password" placeholderTextColor={NotionColors.muted} style={styles.input}
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button title="Cancel" onPress={() => setBioModalOpen(false)} variant="secondary" style={{ flex: 1 }} />
                <Button title="Verify" onPress={handleConfirmEnableBiometrics} loading={bioLoading} style={{ flex: 1 }} />
              </View>
            </View>
          </View>
        </View>
      )}

      <FaceVerificationModal
        visible={faceEnrollModalOpen}
        onClose={() => setFaceEnrollModalOpen(false)}
        onVerified={async (faceSnapshot) => {
          if (faceSnapshot && profile?.id) {
            await enrollEmployeeFace(profile.id, faceSnapshot);
            if (refreshProfile) await refreshProfile();
          }
          setFaceEnrollModalOpen(false);
        }}
        employeeName={profile?.full_name || 'Employee'}
        officeName="Workplace"
        isClockingIn={false}
        enrolledFaceUrl={profile?.avatar_url}
        profileId={profile?.id}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 16 },
  bodyDesktop: { maxWidth: 800, alignSelf: 'center', width: '100%', padding: 32 },

  sectionHeading: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '700',
    color: NotionColors.steel,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },

  card: {
    backgroundColor: NotionColors.canvas, borderRadius: R.lg,
    borderWidth: 1, borderColor: NotionColors.hairline,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  iconWrap: {
    width: 32, height: 32, borderRadius: R.md,
    backgroundColor: NotionColors.surface, alignItems: 'center', justifyContent: 'center',
  },
  rowTitle: { fontFamily: FONT, fontSize: 13, fontWeight: '500', color: NotionColors.ink },
  rowSub: { fontFamily: FONT, fontSize: 11, color: NotionColors.steel, marginTop: 1 },
  sep: { height: 1, backgroundColor: NotionColors.hairlineSoft, marginLeft: 14 },

  smallBtn: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: R.sm, backgroundColor: NotionColors.surface,
    borderWidth: 1, borderColor: NotionColors.hairline,
  },
  smallBtnText: { fontFamily: FONT, fontSize: 11, fontWeight: '500', color: NotionColors.ink },
  muted: { fontFamily: FONT, fontSize: 11, color: NotionColors.muted },

  statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.sm },
  statusChipText: { fontFamily: FONT, fontSize: 10, fontWeight: '600' },

  signOutBtn: {
    paddingVertical: 14, borderRadius: R.md,
    backgroundColor: NotionColors.cardTintRose, alignItems: 'center', justifyContent: 'center',
    marginTop: 16,
  },
  signOutText: { fontFamily: FONT, fontSize: 13, fontWeight: '600', color: NotionColors.semanticError },

  modalOverlay: {
    ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center', zIndex: 1000,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill, backgroundColor: 'rgba(10,21,48,0.55)',
  },
  modalSheet: {
    width: '92%', maxWidth: 400, backgroundColor: NotionColors.canvas,
    borderRadius: R.lg, padding: 20, borderWidth: 1, borderColor: NotionColors.hairline,
  },
  modalTitle: { fontFamily: FONT, fontSize: 15, fontWeight: '600', color: NotionColors.ink },
  input: {
    fontFamily: FONT, fontSize: 13, color: NotionColors.ink,
    backgroundColor: NotionColors.surface, borderRadius: R.md,
    borderWidth: 1, borderColor: NotionColors.hairline,
    paddingHorizontal: 12, height: 40,
  },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    padding: 8, borderRadius: R.md,
  },
  bannerText: { fontFamily: FONT, fontSize: 11, fontWeight: '500', flex: 1 },
});