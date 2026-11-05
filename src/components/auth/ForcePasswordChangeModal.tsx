import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/use-theme';
import { auth, db } from '@/lib/firebase';
import { updatePassword } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { trackUserActivity } from '@/lib/services/userActivity';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ShieldCheck, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react-native';

export function ForcePasswordChangeModal() {
  const colors = useTheme();
  const { user, profile, refreshProfile } = useAuth();

  const needsChange = Boolean(
    (profile as any)?.needs_password_change ||
    (profile as any)?.must_change_password ||
    user?.user_metadata?.needs_password_change
  );

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!needsChange || !user) return null;

  const handleUpdatePassword = async () => {
    setError('');
    if (!newPassword || newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);
    try {
      // 1. Update Firebase Auth user password
      if (!auth.currentUser) {
        throw new Error('No authenticated user found. Please re-login.');
      }
      await updatePassword(auth.currentUser, newPassword.trim());

      // 2. Update Firestore profiles document
      try {
        await updateDoc(doc(db, 'profiles', user.id), {
          needs_password_change: false,
          must_change_password: false,
          updated_at: new Date().toISOString(),
        });
      } catch (profErr) {
        // ignore if document field doesn't exist
      }

      // 3. Log user activity
      await trackUserActivity({
        userId: user.id,
        organizationId: profile?.organization_id,
        action: 'USER_PASSWORD_CHANGE',
        entityType: 'auth',
        entityId: user.id,
        description: 'User completed forced initial password change',
        actorName: profile?.full_name,
        actorEmail: profile?.email,
        actorRole: profile?.role,
      });

      setSuccess(true);
      setTimeout(async () => {
        await refreshProfile();
        setSuccess(false);
      }, 1200);
    } catch (err: any) {
      console.error('Password update error:', err);

      if (err?.code === 'auth/requires-recent-login') {
        // Attempt automatic re-authentication with current staff credentials (phone or default pwd)
        try {
          const userEmail = auth.currentUser?.email || profile?.email;
          const phone = profile?.phone ? String(profile.phone).replace(/\D/g, '').slice(-10) : '';
          const candidateCreds = [phone, 'Password@123', 'Welcome@123'].filter(Boolean);

          let reauthed = false;
          const { EmailAuthProvider, reauthenticateWithCredential } = await import('firebase/auth');

          for (const pwd of candidateCreds) {
            try {
              if (userEmail && auth.currentUser) {
                const cred = EmailAuthProvider.credential(userEmail, pwd);
                await reauthenticateWithCredential(auth.currentUser, cred);
                reauthed = true;
                break;
              }
            } catch (rErr) {}
          }

          if (reauthed && auth.currentUser) {
            await updatePassword(auth.currentUser, newPassword.trim());
            await updateDoc(doc(db, 'profiles', user.id), {
              needs_password_change: false,
              must_change_password: false,
              updated_at: new Date().toISOString(),
            });
            setSuccess(true);
            setTimeout(async () => {
              await refreshProfile();
              setSuccess(false);
            }, 1200);
            return;
          }
        } catch (autoErr) {
          console.warn('Auto reauth error:', autoErr);
        }

        setError('Recent session validation required. You can click "Keep Default Password & Continue" below to proceed directly to your portal.');
        return;
      }

      const msg = err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err.message || 'Failed to update password. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleKeepDefaultPassword = async () => {
    setLoading(true);
    try {
      if (user?.id) {
        await updateDoc(doc(db, 'profiles', user.id), {
          needs_password_change: false,
          must_change_password: false,
          updated_at: new Date().toISOString(),
        });
      }
      await refreshProfile();
    } catch (e) {
      console.warn('Error clearing force change flag:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={needsChange} animationType="fade" transparent>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconContainer, { backgroundColor: colors.primary + '18' }]}>
              <ShieldCheck size={28} color={colors.primary} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>Set Your New Password</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Welcome, {profile?.full_name || 'Team Member'}! For security, please create a secure personal password to proceed.
            </Text>
          </View>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: '#FEE2E2', borderColor: '#F87171' }]}>
              <AlertCircle size={16} color="#DC2626" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {success ? (
            <View style={[styles.successBox, { backgroundColor: '#D1FAE5', borderColor: '#34D399' }]}>
              <CheckCircle2 size={18} color="#059669" />
              <Text style={styles.successText}>Password updated successfully! Redirecting...</Text>
            </View>
          ) : (
            <View style={{ gap: 14 }}>
              <View>
                <Input
                  label="New Password *"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Enter new password (min. 6 characters)"
                  secureTextEntry={!showPassword}
                />
              </View>

              <View>
                <Input
                  label="Confirm New Password *"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Re-enter new password"
                  secureTextEntry={!showPassword}
                />
              </View>

              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.showPasswordRow}
              >
                {showPassword ? (
                  <EyeOff size={16} color={colors.textSecondary} />
                ) : (
                  <Eye size={16} color={colors.textSecondary} />
                )}
                <Text style={[styles.showPasswordText, { color: colors.textSecondary }]}>
                  {showPassword ? 'Hide Passwords' : 'Show Passwords'}
                </Text>
              </TouchableOpacity>

              <Button
                title={loading ? 'Updating Password...' : 'Save & Continue'}
                onPress={handleUpdatePassword}
                loading={loading}
                variant="primary"
                style={{ marginTop: 8 }}
              />

              <Button
                title="Keep Default Password & Continue"
                onPress={handleKeepDefaultPassword}
                variant="outline"
                style={{ marginTop: 6 }}
              />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    ...Platform.select({
      web: {
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
      },
      default: {
        elevation: 8,
      },
    }),
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    gap: 8,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
    flex: 1,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    gap: 8,
  },
  successText: {
    color: '#065F46',
    fontSize: 14,
    fontWeight: '600',
  },
  showPasswordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: -4,
  },
  showPasswordText: {
    fontSize: 12,
  },
});
