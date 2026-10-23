import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  TextInput,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Image as ExpoImage } from 'expo-image';
import {
  AlertCircle,
  Eye,
  EyeOff,
  Fingerprint,
  Lock,
  Mail,
  ScanFace,
  Zap,
  ArrowRight,
  LockKeyhole,
} from 'lucide-react-native';

import { DEFAULT_SUBEDGE_LOGO as SUBEDGE_LOGO } from '@/components/ui/SubedgeBrand';
import { useAuth } from '@/hooks/useAuth';
import { useBiometrics } from '@/hooks/useBiometrics';
import { useTenantBranding } from '@/hooks/useTenantBranding';

// Official Google 4-color SVG URL
const GOOGLE_ICON_URL = 'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { tenant } = useTenantBranding();
  const { user, profile, signIn, signInWithGoogle, isLoading: authLoading } = useAuth();

  const isAuthorized = !!user && !!profile && profile.is_active === true && ['employee', 'hr', 'admin'].includes(profile.role);

  // Auto-redirect if user has an active, verified session
  useEffect(() => {
    if (isAuthorized && profile) {
      const targetRoute =
        profile.role === 'admin'
          ? '/(admin)/dashboard'
          : profile.role === 'hr'
          ? '/(hr)/dashboard'
          : '/(employee)/dashboard';
      router.replace(targetRoute as never);
    }
  }, [isAuthorized, profile, router]);

  const {
    hasHardware,
    biometricType,
    isEnabled: isBiometricEnabled,
    authenticateWithBiometrics,
  } = useBiometrics();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);

  // Handle standard email/password login
  const handleLogin = useCallback(async () => {
    if (loading || googleLoading || authLoading) return;
    const trimmedInput = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedInput || !trimmedPassword) {
      setError('Please provide your email/phone and password.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    setError(null);
    setLoading(true);

    try {
      let finalEmail = trimmedInput;
      // If input looks like a phone number (contains numbers and optional +)
      if (/^\+?[0-9\-\s]+$/.test(trimmedInput) && trimmedInput.replace(/[^0-9]/g, '').length >= 6) {
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        const q = query(collection(db, 'profiles'), where('phone', '==', trimmedInput));
        const snap = await getDocs(q);
        if (!snap.empty) {
          finalEmail = snap.docs[0].data().email;
        } else {
          throw new Error('No account found with this phone number.');
        }
      }

      await signIn(finalEmail, trimmedPassword, tenant?.id);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid credentials.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }, [email, password, loading, googleLoading, authLoading, signIn, tenant?.id]);

  // Handle Google Sign-In
  const handleGoogleLogin = useCallback(async () => {
    if (loading || googleLoading || authLoading) return;
    setError(null);
    setGoogleLoading(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      await signInWithGoogle();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Google Sign-In failed.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setGoogleLoading(false);
    }
  }, [loading, googleLoading, authLoading, signInWithGoogle]);

  // Handle Biometric Login
  const handleBiometricLogin = useCallback(async () => {
    if (biometricLoading || authLoading) return;
    setError(null);
    setBiometricLoading(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const result = await authenticateWithBiometrics();
      if (!result?.success) {
        setError(result?.error || 'Biometric authentication failed.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Biometric authentication error.');
    } finally {
      setBiometricLoading(false);
    }
  }, [authenticateWithBiometrics, biometricLoading, authLoading]);

  const BiometricIcon = biometricType === 'Face ID' ? ScanFace : Fingerprint;
  const showBiometric = hasHardware && isBiometricEnabled;
  const busy = loading || googleLoading || authLoading;

  if (authLoading || (isAuthorized && (user || profile))) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0D7377" />
        <Text style={styles.loadingText}>
          {isAuthorized ? 'Redirecting to your workspace...' : 'Verifying session...'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.pageContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 40 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.authContainer}>
            <View style={styles.card}>
              {/* Brand Logo */}
              <View style={styles.brandHeader}>
                <Image
                  source={tenant?.logo_url ? { uri: tenant.logo_url } : SUBEDGE_LOGO}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>

              {/* Form Title & Subtitle */}
              <View style={styles.formHeader}>
                <Text style={styles.title}>Sign in</Text>
                <Text style={styles.subtitle}>
                  Enter your email or phone number to access your account.
                </Text>
              </View>

              {/* Error alert banner */}
              {error ? (
                <View style={styles.errorBox}>
                  <AlertCircle color="#DC2626" size={16} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {/* Input Fields */}
              <View style={styles.inputsGroup}>
                <View style={styles.inputWrap}>
                  <Text style={styles.inputLabel}>Work Email or Phone Number</Text>
                  <View style={styles.inputContainer}>
                    <Mail color="#64748B" size={18} style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="name@company.com or phone"
                      placeholderTextColor="#94A3B8"
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      autoComplete="email"
                    />
                  </View>
                </View>

                <View style={styles.inputWrap}>
                  <View style={styles.labelRow}>
                    <Text style={styles.inputLabel}>Password</Text>
                    <TouchableOpacity
                      onPress={() => router.push('/(auth)/forgot-password')}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.forgotLink}>Forgot password?</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.inputContainer}>
                    <Lock color="#64748B" size={18} style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="••••••••••••"
                      placeholderTextColor="#94A3B8"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      onSubmitEditing={handleLogin}
                      returnKeyType="go"
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword((s) => !s)}
                      style={styles.eyeBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      {showPassword ? (
                        <EyeOff color="#64748B" size={18} />
                      ) : (
                        <Eye color="#64748B" size={18} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Primary Sign In Button */}
              <TouchableOpacity
                onPress={handleLogin}
                disabled={busy}
                activeOpacity={0.88}
                style={[styles.primaryBtn, busy && styles.btnDisabled]}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <View style={styles.btnContentRow}>
                    <Text style={styles.primaryBtnText}>Sign In</Text>
                    <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.2} />
                  </View>
                )}
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.dividerRow}>
                <View style={styles.divider} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.divider} />
              </View>

              {/* SSO / Google Options */}
              <View style={{ gap: 10 }}>
                <TouchableOpacity
                  onPress={handleGoogleLogin}
                  disabled={busy}
                  activeOpacity={0.85}
                  style={[styles.googleBtn, busy && styles.btnDisabled]}
                >
                  {googleLoading ? (
                    <ActivityIndicator size="small" color="#1A1A2E" />
                  ) : (
                    <ExpoImage
                      source={{ uri: GOOGLE_ICON_URL }}
                      style={{ width: 18, height: 18 }}
                      contentFit="contain"
                    />
                  )}
                  <Text style={styles.googleBtnText}>
                    {googleLoading ? 'Connecting...' : 'Continue with Google'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    const isLocal =
                      typeof window !== 'undefined' &&
                      (window.location.hostname === 'localhost' ||
                        window.location.hostname === '127.0.0.1');
                    const ssoBase = isLocal ? 'http://localhost:3001' : 'https://sso.subedge.com';
                    const returnUrl = encodeURIComponent(
                      typeof window !== 'undefined' ? window.location.origin : 'https://oasis.subedge.com'
                    );
                    if (typeof window !== 'undefined') {
                      window.location.href = `${ssoBase}/?redirect_url=${returnUrl}&app=HRMS`;
                    } else {
                      void Linking.openURL(`${ssoBase}/?redirect_url=${returnUrl}&app=HRMS`);
                    }
                  }}
                  disabled={busy}
                  activeOpacity={0.85}
                  style={[styles.ssoBtn, busy && styles.btnDisabled]}
                >
                  <Zap size={16} color="#0D7377" />
                  <Text style={styles.ssoBtnText}>Sign in with Subedge SSO</Text>
                </TouchableOpacity>
              </View>

              {/* Biometric Login */}
              {showBiometric ? (
                <TouchableOpacity
                  onPress={handleBiometricLogin}
                  disabled={biometricLoading || busy}
                  activeOpacity={0.85}
                  style={styles.bioBtn}
                >
                  <BiometricIcon color="#0D7377" size={18} />
                  <Text style={styles.bioBtnText}>
                    {biometricLoading ? 'Verifying biometrics…' : `Sign in with ${biometricType || 'Biometrics'}`}
                  </Text>
                </TouchableOpacity>
              ) : null}

              {/* Security note */}
              <View style={styles.cardFooter}>
                <LockKeyhole size={12} color="#94A3B8" />
                <Text style={styles.cardFooterText}>
                  256-bit Encrypted • Zero-trust Access
                </Text>
              </View>
            </View>
          </View>

          {/* Minimalist Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              © {new Date().getFullYear()} Subedge Technology Pvt Ltd
            </Text>
            <View style={styles.footerLinksRow}>
              <TouchableOpacity
                onPress={() => void Linking.openURL('https://www.subedge.com/privacy')}
                activeOpacity={0.8}
              >
                <Text style={styles.footerLink}>Privacy Policy</Text>
              </TouchableOpacity>
              <Text style={styles.footerDot}>•</Text>
              <TouchableOpacity
                onPress={() => void Linking.openURL('https://www.subedge.com/terms')}
                activeOpacity={0.8}
              >
                <Text style={styles.footerLink}>Terms</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    minHeight: '100%',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  pageContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 48,
  },
  authContainer: {
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 32,
    ...Platform.select({
      web: {
        boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.04)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 18,
        elevation: 3,
      },
    }),
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    width: 140,
    height: 36,
  },
  formHeader: {
    marginBottom: 22,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 6,
    lineHeight: 19,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#DC2626',
    flex: 1,
  },
  inputsGroup: {
    gap: 16,
    marginBottom: 20,
  },
  inputWrap: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  forgotLink: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0D7377',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    height: 46,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    color: '#0F172A',
    borderWidth: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
  },
  eyeBtn: {
    paddingHorizontal: 6,
    height: '100%',
    justifyContent: 'center',
  },
  primaryBtn: {
    backgroundColor: '#0D7377',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        boxShadow: '0 8px 20px -4px rgba(13, 115, 119, 0.3)',
      },
      default: {
        elevation: 2,
        shadowColor: '#0D7377',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
    }),
  },
  btnContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 18,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.6,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
      },
      default: {
        elevation: 1,
      },
    }),
  },
  googleBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  ssoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(13, 115, 119, 0.25)',
    backgroundColor: '#F0F7F7',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
      default: {
        elevation: 1,
      },
    }),
  },
  ssoBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0D7377',
  },
  bioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    marginTop: 10,
  },
  bioBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
  },
  cardFooterText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94A3B8',
  },
  footer: {
    alignItems: 'center',
    marginTop: 28,
    gap: 6,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
  },
  footerLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footerLink: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0D7377',
  },
  footerDot: {
    fontSize: 12,
    color: '#CBD5E1',
  },
});
