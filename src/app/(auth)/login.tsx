import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useWindowDimensions,
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
  ShieldCheck,
  Shield,
  Zap,
  ArrowRight,
  Users,
  TrendingUp,
  HeartPulse,
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
  const { width } = useWindowDimensions();
  const isSplitScreen = width >= 960;
  const isTablet = width >= 768 && width < 960;

  const { tenant } = useTenantBranding();
  const { user, profile, signIn, signInWithGoogle, isLoading: authLoading } = useAuth();
  // Auto-redirect if user already has an active SSO session
  useEffect(() => {
    if (user || profile) {
      const targetRoute = profile?.role === 'admin' ? '/(admin)/dashboard' : profile?.role === 'hr' ? '/(hr)/dashboard' : '/(employee)/dashboard';
      router.replace(targetRoute as never);
    }
  }, [user, profile, router]);

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
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      setError('Please provide both your work email and password.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    setError(null);
    setLoading(true);

    try {
      await signIn(trimmedEmail, trimmedPassword, tenant?.id);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid email or password.');
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

  // ── Auth Form Card Component ───────────────────────────────────────────────
  const showGoogleSignIn = true;

  const authFormCard = (
    <View style={[styles.card, !isSplitScreen && !isTablet && styles.mobileCardNative]}>
      {/* Mobile brand header inside card */}
      {!isSplitScreen && (
        <View style={styles.mobileBrandHeader}>
          <Image
            source={tenant?.logo_url ? { uri: tenant.logo_url } : SUBEDGE_LOGO}
            style={styles.mobileLogo}
            resizeMode="contain"
          />
          <View style={styles.mobilePlatformBadge}>
            <Text style={styles.mobilePlatformBadgeText}>OASIS HRMS</Text>
          </View>
        </View>
      )}

      {/* Form Title & Subtitle */}
      <View style={styles.formHeader}>
        <Text style={styles.title}>Sign in to Oasis</Text>
        <Text style={styles.subtitle}>
          Enter your organization email and password to access the portal.
        </Text>
      </View>

              {/* Enterprise SSO Hub Button */}
        <TouchableOpacity
          onPress={() => {
            const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
            const ssoBase = isLocal ? 'http://localhost:3001' : 'https://sso.subedge.com';
            const returnUrl = encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : 'https://oasis.subedge.com');
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
          <Zap size={18} color="#0D7377" />
          <Text style={styles.ssoBtnText}>Sign in with Subedge SSO</Text>
        </TouchableOpacity>

        {/* Google Sign In Button */}
      {showGoogleSignIn && (
        <>
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
                style={{ width: 20, height: 20 }}
                contentFit="contain"
              />
            )}
            <Text style={styles.googleBtnText}>
              {googleLoading ? 'Connecting to Google...' : 'Continue with Google'}
            </Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>OR WITH WORK EMAIL</Text>
            <View style={styles.divider} />
          </View>
        </>
      )}

      {/* Error alert banner */}
      {error && (
        <View style={styles.errorBox}>
          <AlertCircle color="#DC2626" size={16} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Input Fields */}
      <View style={styles.inputsGroup}>
        <View style={styles.inputWrap}>
          <Text style={styles.inputLabel}>Work Email</Text>
          <View style={styles.inputContainer}>
            <Mail color="#64748B" size={18} style={styles.inputIcon} />
            <TextInput
              style={styles.textInput}
              placeholder="name@company.com"
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
            <Text style={styles.primaryBtnText}>Sign In to Workspace</Text>
            <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.2} />
          </View>
        )}
      </TouchableOpacity>

      {/* Biometric Login */}
      {showBiometric && (
        <TouchableOpacity
          onPress={handleBiometricLogin}
          disabled={biometricLoading || busy}
          activeOpacity={0.85}
          style={styles.bioBtn}
        >
          <BiometricIcon color="#0D7377" size={19} />
          <Text style={styles.bioBtnText}>
            {biometricLoading ? 'Verifying biometrics…' : `Sign in with ${biometricType || 'Biometrics'}`}
          </Text>
        </TouchableOpacity>
      )}

      {/* Subedge Card Footer */}
      <TouchableOpacity
        style={styles.cardFooter}
        onPress={() => void Linking.openURL('https://www.subedge.com/security-info')}
        activeOpacity={0.8}
      >
        <LockKeyhole size={13} color="#94A3B8" />
        <Text style={styles.cardFooterText}>
          Subedge Security & Compliance • 256-bit AES
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.pageContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      {/* Top Header Navbar - Only visible on split screen (web/tablet landscape) */}
      {isSplitScreen && (
        <View style={[styles.topNavBar, { paddingTop: Math.max(insets.top, 16) }]}>
          <View style={styles.topNavInner}>
            <TouchableOpacity
              style={styles.topNavLeft}
              onPress={() => void Linking.openURL('https://www.subedge.com')}
              activeOpacity={0.85}
            >
              <Image
                source={tenant?.logo_url ? { uri: tenant.logo_url } : SUBEDGE_LOGO}
                style={styles.topNavLogo}
                resizeMode="contain"
              />
              <View style={styles.topNavBadge}>
                <Text style={styles.topNavBadgeText}>OASIS HRMS</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            isSplitScreen && styles.scrollContentSplit,
            { paddingBottom: insets.bottom + 40 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {isSplitScreen ? (
            <View style={styles.splitWrapper}>
              {/* ── Left Showcase Panel (Subedge Style) ── */}
              <View style={styles.leftShowcase}>
                {/* Eyebrow Chip */}
                <View style={styles.eyebrowChip}>
                  <Text style={styles.eyebrowText}>SUBEDGE WORKFORCE PLATFORM</Text>
                </View>

                {/* Hero Subtitle */}
                <Text style={styles.heroSubtitle}>
                  Oasis HRMS is engineered by Subedge to streamline automated payroll cycles, real-time geofenced attendance, biometric verification, and enterprise employee governance.
                </Text>

                {/* 2x2 Core Capabilities Cards (Styled exactly like subedge.vercel.app) */}
                <View style={styles.featureGrid}>
                  <View style={styles.featureCard}>
                    <View style={styles.featureIconBox}>
                      <Zap size={20} color="#0D7377" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.featureTitle}>Automated Payroll</Text>
                      <Text style={styles.featureDesc}>
                        Auto-tax regimes, LOP calculations, and instant payslips.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.featureCard}>
                    <View style={styles.featureIconBox}>
                      <HeartPulse size={20} color="#0D7377" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.featureTitle}>Smart Biometrics</Text>
                      <Text style={styles.featureDesc}>
                        Face scan & geofenced radius verification across campuses.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.featureCard}>
                    <View style={styles.featureIconBox}>
                      <Shield size={20} color="#0D7377" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.featureTitle}>SOC 2 Compliance</Text>
                      <Text style={styles.featureDesc}>
                        Zero-trust audit trails and role-based permissions.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.featureCard}>
                    <View style={styles.featureIconBox}>
                      <TrendingUp size={20} color="#0D7377" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.featureTitle}>Talent & Goals</Text>
                      <Text style={styles.featureDesc}>
                        KPI tracking, LMS compliance, and peer recognitions.
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* ── Right Auth Form Panel ── */}
              <View style={styles.rightFormPanel}>
                {authFormCard}
              </View>
            </View>
          ) : (
            // Mobile & Tablet
            <View style={[styles.mobileWrapper, isTablet && styles.tabletWrapper]}>
              {authFormCard}
            </View>
          )}

          {/* Subedge Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={() => void Linking.openURL('https://www.subedge.com')}
              activeOpacity={0.8}
            >
              <Text style={styles.footerText}>
                © {new Date().getFullYear()} Subedge Technology Pvt Ltd. All rights reserved.
              </Text>
            </TouchableOpacity>
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
                <Text style={styles.footerLink}>Terms of Service</Text>
              </TouchableOpacity>
              <Text style={styles.footerDot}>•</Text>
              <TouchableOpacity
                onPress={() => void Linking.openURL('https://www.subedge.com/security-info')}
                activeOpacity={0.8}
              >
                <Text style={styles.footerLink}>Security Info</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  pageContainer: {
    flex: 1,
    backgroundColor: Platform.OS === 'web' ? '#F8FAFC' : '#FFFFFF',
  },

  // Top Navbar (Matching subedge.vercel.app fixed header)
  topNavBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 14,
    paddingHorizontal: 24,
    zIndex: 20,
  },
  topNavInner: {
    maxWidth: 1280,
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topNavLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  topNavLogo: {
    width: 120,
    height: 30,
  },
  topNavBadge: {
    backgroundColor: '#F0F7F7',
    borderWidth: 1,
    borderColor: 'rgba(13, 115, 119, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  topNavBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0D7377',
    letterSpacing: 0.8,
  },
  // Scroll Container
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 36,
  },
  scrollContentSplit: {
    paddingHorizontal: 48,
    paddingTop: 48,
  },

  // Split Layout
  splitWrapper: {
    flexDirection: 'row',
    maxWidth: 1240,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 64,
  },
  leftShowcase: {
    flex: 1.15,
    paddingRight: 20,
  },
  rightFormPanel: {
    flex: 0.85,
    maxWidth: 440,
    width: '100%',
  },

  // Left Hero Elements
  eyebrowChip: {
    backgroundColor: '#F0F7F7',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(13, 115, 119, 0.15)',
  },
  eyebrowText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0D7377',
    letterSpacing: 1.2,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#64748B',
    lineHeight: 26,
    marginBottom: 32,
    maxWidth: 540,
  },

  // Feature Cards Grid
  featureGrid: {
    gap: 14,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 16,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px -2px rgba(13, 115, 119, 0.04)',
      },
      default: {
        elevation: 1,
      },
    }),
  },
  featureIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F0F7F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  featureDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 18,
  },

  // Mobile / Tablet Wrapper
  mobileWrapper: {
    width: '100%',
    maxWidth: 440,
  },
  tabletWrapper: {
    maxWidth: 480,
  },

  // Auth Card
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 30,
    ...Platform.select({
      web: {
        boxShadow: '0 18px 40px -12px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(226, 232, 240, 0.8)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 6,
      },
    }),
  },
  mobileCardNative: {
    borderWidth: 0,
    elevation: 0,
    shadowOpacity: 0,
    padding: 24,
    paddingTop: 40,
    backgroundColor: 'transparent',
  },

  mobileBrandHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  mobileLogo: {
    width: 140,
    height: 32,
    marginBottom: 8,
  },
  mobilePlatformBadge: {
    backgroundColor: '#F0F7F7',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(13, 115, 119, 0.2)',
  },
  mobilePlatformBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0D7377',
    letterSpacing: 0.6,
  },

  formHeader: {
    marginBottom: 22,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A1A2E',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 6,
    lineHeight: 20,
  },

  // Google Button
  
    ssoBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      height: 48,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: 'rgba(13, 115, 119, 0.3)',
      backgroundColor: '#F0F7F7',
      marginBottom: 10,
      ...Platform.select({
        web: {
          cursor: 'pointer',
          boxShadow: '0 1px 3px rgba(13, 115, 119, 0.08)',
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
    googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      },
      default: {
        elevation: 1,
      },
    }),
  },
  googleBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  btnDisabled: {
    opacity: 0.6,
  },

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 20,
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

  // Error Alert
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

  // Inputs
  inputsGroup: {
    gap: 16,
    marginBottom: 22,
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
    color: '#1A1A2E',
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
    height: 48,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    color: '#1A1A2E',
    borderWidth: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
  },
  eyeBtn: {
    paddingHorizontal: 6,
    height: '100%',
    justifyContent: 'center',
  },

  // Primary Action Button (Subedge Signature Teal #0D7377)
  primaryBtn: {
    backgroundColor: '#0D7377',
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        boxShadow: '0 10px 24px -6px rgba(13, 115, 119, 0.35)',
      },
      default: {
        elevation: 3,
        shadowColor: '#0D7377',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
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

  // Biometrics
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
    marginTop: 12,
  },
  bioBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A2E',
  },

  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 22,
  },
  cardFooterText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94A3B8',
  },

  // Global Bottom Footer
  footer: {
    alignItems: 'center',
    marginTop: 36,
    gap: 8,
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
