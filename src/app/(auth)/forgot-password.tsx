import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { auth } from '@/lib/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useTheme } from '@/hooks/use-theme';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ShieldCheck, Mail, KeyRound, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react-native';

export default function ForgotPasswordScreen() {
  const colors = useTheme();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Send reset password email via Firebase Auth and Resend
  const handleSendResetEmail = async () => {
    if (!email) {
      setError('Please enter your work email address.');
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    setError('');
    setLoading(true);

    try {
      let sentSuccess = false;

      // 1. Send via Firebase Auth standard reset
      try {
        await sendPasswordResetEmail(auth, cleanEmail);
        sentSuccess = true;
      } catch (fbErr: any) {
        console.warn('Firebase Auth sendPasswordResetEmail notice:', fbErr?.code || fbErr?.message);
      }

      // 2. Lookup user profile/employee in Firestore to find name and organization
      let recipientName = cleanEmail.split('@')[0];
      let orgId: string | null = null;
      try {
        const { collection, query, where, getDocs, limit } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        const profQ = query(collection(db, 'profiles'), where('email', '==', cleanEmail), limit(1));
        const profSnap = await getDocs(profQ);
        if (!profSnap.empty) {
          const p = profSnap.docs[0].data();
          recipientName = p.full_name || recipientName;
          orgId = p.organization_id || null;
        } else {
          const empQ = query(collection(db, 'employees'), where('email', '==', cleanEmail), limit(1));
          const empSnap = await getDocs(empQ);
          if (!empSnap.empty) {
            const e = empSnap.docs[0].data();
            recipientName = e.name || e.full_name || recipientName;
            orgId = e.organization_id || null;
          }
        }
      } catch (lookupErr) {
        console.warn('User lookup note during password reset:', lookupErr);
      }

      // 3. Dispatch branded transactional email via Resend
      try {
        const { sendPasswordResetNotificationEmail } = await import('@/lib/services/resend');
        await sendPasswordResetNotificationEmail(cleanEmail, recipientName, undefined, {
          organizationId: orgId,
        });
        sentSuccess = true;
      } catch (resendErr) {
        console.warn('Resend password reset notice:', resendErr);
      }

      if (sentSuccess) {
        setSuccess(true);
      } else {
        throw new Error('Unable to send password reset email. Please verify your email or contact HR support.');
      }
    } catch (err: any) {
      console.error('Reset password error:', err);
      const msg = err?.message || 'Failed to send password reset email. Please verify your email address.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: '#F8FAFC' }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, justifyContent: 'center' }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.formWrapper}>
            <View style={styles.header}>
              <View style={[styles.iconContainer, { backgroundColor: colors.primary + '15' }]}>
                <Mail size={32} color={colors.primary} />
              </View>
              <Text style={styles.title}>Reset Password</Text>
              <Text style={styles.subtitle}>
                Enter your registered work email to receive a password reset link.
              </Text>
            </View>

            <View style={[styles.card, { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }]}>
              {error ? (
                <View style={styles.errorBox}>
                  <AlertCircle size={16} color="#DC2626" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {success ? (
                <View style={{ gap: 16 }}>
                  <View style={styles.successBox}>
                    <CheckCircle2 size={20} color="#059669" />
                    <Text style={styles.successText}>
                      Password reset instructions have been sent to {email}. Please check your inbox.
                    </Text>
                  </View>
                  <Button
                    title="Return to Sign In"
                    onPress={() => router.replace('/')}
                    variant="primary"
                    style={styles.submitBtn}
                  />
                </View>
              ) : (
                <View style={{ gap: 16 }}>
                  <Input
                    label="Work Email"
                    placeholder="name@company.com"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />

                  <Button
                    title="Send Reset Instructions"
                    onPress={handleSendResetEmail}
                    loading={loading}
                    variant="primary"
                    style={styles.submitBtn}
                  />
                </View>
              )}
            </View>

            <Button
              title="← Back to Sign In"
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/');
                }
              }}
              variant="ghost"
              size="sm"
              style={{ marginTop: 20, alignSelf: 'center' }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  formWrapper: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 12,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
      },
      default: {
        elevation: 2,
      },
    }),
  },
  submitBtn: {
    backgroundColor: '#0D7377',
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 4,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderColor: '#F87171',
    borderWidth: 1,
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    borderColor: '#34D399',
    borderWidth: 1,
    padding: 16,
    borderRadius: 10,
    gap: 10,
  },
  successText: {
    color: '#065F46',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
});
