import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { auth, db } from '@/lib/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile as firebaseUpdateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  limit,
} from 'firebase/firestore';
import { logUserLogin, logUserLogout } from '@/lib/services/userActivity';
import type { Profile, UserRole } from '@/types';
import { getSsoSession, clearSsoSession } from '@/lib/sso';

export interface AppUser {
  id: string;
  email?: string;
  fullName?: string;
  imageUrl?: string | null;
  user_metadata?: {
    full_name?: string;
    role?: string;
    organization_id?: string;
    organization_slug?: string;
    [key: string]: any;
  };
}

interface AuthState {
  user: AppUser | null;
  profile: Profile | null;
  role: UserRole | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string, fallbackOrgId?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUp: (email: string, password: string, fullName: string, role?: string, orgId?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(() => {
    if (typeof window !== 'undefined') {
      const sso = getSsoSession();
      if (sso && (sso.uid || sso.email)) {
        const userEmail = (sso.email || '').toLowerCase().trim();
        const fullName = sso.displayName || userEmail.split('@')[0] || 'User';
        const role: UserRole = (sso.role as UserRole) || 'employee';
        return {
          id: sso.uid || 'sso-user',
          email: userEmail,
          fullName,
          imageUrl: sso.photoURL || null,
          user_metadata: {
            full_name: fullName,
            role,
            organization_id: sso.organizationId || '00000000-0000-0000-0000-000000000001',
          },
        };
      }
    }
    return null;
  });

  const [profile, setProfile] = useState<Profile | null>(() => {
    if (typeof window !== 'undefined') {
      const sso = getSsoSession();
      if (sso && (sso.uid || sso.email)) {
        const userEmail = (sso.email || '').toLowerCase().trim();
        const isSMHUser = userEmail.includes('shantimemorialhospital.com') || userEmail === 'ayushbindhani001@gmail.com';
        const defaultOrgId = sso.organizationId || (isSMHUser ? 'shanti-memorial-hospital' : '00000000-0000-0000-0000-000000000001');
        const isAdminEmail = userEmail.includes('admin') || userEmail === 'ayushbindhani001@gmail.com';
        const isHrEmail = userEmail.includes('hr') || userEmail.includes('nurse');
        const role: UserRole = (sso.role as UserRole) || (isAdminEmail ? 'admin' : isHrEmail ? 'hr' : 'employee');
        const fullName = sso.displayName || (userEmail === 'ayushbindhani001@gmail.com' ? 'Ayush Bindhani' : userEmail.split('@')[0]) || 'HRMS User';
        const now = new Date().toISOString();
        return {
          id: sso.uid || 'sso-user',
          email: userEmail,
          full_name: fullName,
          phone: sso.phone || null,
          avatar_url: sso.photoURL || null,
          role,
          organization_id: defaultOrgId,
          is_active: true,
          created_at: now,
          updated_at: now,
        };
      }
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const sso = getSsoSession();
      if (sso && (sso.uid || sso.email)) return false;
    }
    return true;
  });
  const loggedInUserIdRef = useRef<string | null>(null);

  // Helper: Fetch or auto-create profile document from Firebase Auth User
  const syncProfileForAuthUser = useCallback(async (authUser: FirebaseUser): Promise<Profile | null> => {
    if (!authUser?.uid) return null;

    try {
      // 1. Check profile by auth UID in 'profiles' collection
      const profRef = doc(db, 'profiles', authUser.uid);
      const profSnap = await getDoc(profRef);

      if (profSnap.exists()) {
        const data = profSnap.data() as Profile;
        const cleanEmail = authUser.email?.toLowerCase().trim() || '';
        if (
          (cleanEmail === 'ayushbindhani001@gmail.com' || cleanEmail.includes('shantimemorialhospital.com')) &&
          data.organization_id !== 'shanti-memorial-hospital'
        ) {
          const updated = {
            ...data,
            organization_id: 'shanti-memorial-hospital',
            role: (cleanEmail === 'ayushbindhani001@gmail.com' ? 'admin' : data.role) as UserRole,
            full_name: cleanEmail === 'ayushbindhani001@gmail.com' ? 'Ayush Bindhani' : data.full_name,
            updated_at: new Date().toISOString(),
          };
          await setDoc(profRef, updated, { merge: true });
          return { ...updated, id: profSnap.id };
        }
        return { ...data, id: profSnap.id } as Profile;
      }

      // 2. Check profile by email (if pre-created during seeding or by admin)
      if (authUser.email) {
        const cleanEmail = authUser.email.toLowerCase().trim();
        const emailQuery = query(
          collection(db, 'profiles'),
          where('email', '==', cleanEmail),
          limit(1)
        );
        const emailSnap = await getDocs(emailQuery);

        if (!emailSnap.empty) {
          const existingDoc = emailSnap.docs[0];
          let existingData = existingDoc.data() as Profile;

          if (
            (cleanEmail === 'ayushbindhani001@gmail.com' || cleanEmail.includes('shantimemorialhospital.com')) &&
            existingData.organization_id !== 'shanti-memorial-hospital'
          ) {
            existingData = {
              ...existingData,
              organization_id: 'shanti-memorial-hospital',
              role: (cleanEmail === 'ayushbindhani001@gmail.com' ? 'admin' : existingData.role) as UserRole,
              full_name: cleanEmail === 'ayushbindhani001@gmail.com' ? 'Ayush Bindhani' : existingData.full_name,
            };
          }

          if (existingDoc.id !== authUser.uid) {
            const updatedProf = {
              ...existingData,
              id: authUser.uid,
              updated_at: new Date().toISOString(),
            };
            // Set under new auth UID and delete the legacy placeholder ID
            await setDoc(doc(db, 'profiles', authUser.uid), updatedProf);
            try {
              // Update references in employees collection
              const empQ = query(collection(db, 'employees'), where('profile_id', '==', existingDoc.id));
              const empSnap = await getDocs(empQ);
              for (const empDoc of empSnap.docs) {
                await updateDoc(doc(db, 'employees', empDoc.id), { profile_id: authUser.uid });
              }
              await deleteDoc(doc(db, 'profiles', existingDoc.id));
            } catch (refErr) {
              console.warn('Reference migration warning:', refErr);
            }
            return updatedProf as Profile;
          }
          return { ...existingData, id: existingDoc.id } as Profile;
        }
      }

      // 3. Auto-provision profile from auth user
      const userEmail = authUser.email || '';
      const isSMHUser = userEmail.toLowerCase().includes('shantimemorialhospital.com') || userEmail === 'ayushbindhani001@gmail.com';
      const defaultOrgId = isSMHUser ? 'shanti-memorial-hospital' : '00000000-0000-0000-0000-000000000001';
      const isAdminEmail = userEmail.includes('admin') || userEmail === 'ayushbindhani001@gmail.com';
      const isHrEmail = userEmail.includes('hr') || userEmail.includes('nurse');
      const role: UserRole = isAdminEmail ? 'admin' : isHrEmail ? 'hr' : 'employee';
      const fullName = authUser.displayName || (userEmail === 'ayushbindhani001@gmail.com' ? 'Ayush Bindhani' : userEmail.split('@')[0]) || 'HRMS User';
      const now = new Date().toISOString();

      const newProfPayload: Profile = {
        id: authUser.uid,
        email: userEmail,
        full_name: fullName,
        phone: authUser.phoneNumber || null,
        avatar_url: authUser.photoURL || null,
        role,
        organization_id: defaultOrgId,
        is_active: true,
        created_at: now,
        updated_at: now,
      };

      await setDoc(doc(db, 'profiles', authUser.uid), newProfPayload);
      return newProfPayload;
    } catch (err) {
      console.error('syncProfileForAuthUser error:', err);
      return null;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const authUser = auth.currentUser;
      if (!authUser) {
        setUser(null);
        setProfile(null);
        return;
      }
      const prof = await syncProfileForAuthUser(authUser);
      setProfile(prof);
    } catch (e) {
      console.error('refreshProfile error:', e);
    }
  }, [syncProfileForAuthUser]);

  // Listen to Firebase Auth state changes & initialize session
  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!isMounted) return;

      if (fbUser) {
        const prof = await syncProfileForAuthUser(fbUser);
        const appUser: AppUser = {
          id: fbUser.uid,
          email: fbUser.email || undefined,
          fullName: prof?.full_name || fbUser.displayName || fbUser.email?.split('@')[0],
          imageUrl: prof?.avatar_url || fbUser.photoURL || null,
          user_metadata: {
            full_name: prof?.full_name || fbUser.displayName || undefined,
            role: prof?.role || 'employee',
            organization_id: prof?.organization_id,
          },
        };

        if (isMounted) {
          setProfile(prof);
          setUser(appUser);

          if (prof && loggedInUserIdRef.current !== prof.id) {
            loggedInUserIdRef.current = prof.id;
            try {
              let ipAddress: string | null = null;
              if (Platform.OS === 'web') {
                const ipRes = await fetch('https://api.ipify.org?format=json');
                const ipData = await ipRes.json();
                ipAddress = ipData?.ip || null;
              }
              await logUserLogin(prof, ipAddress, fbUser.uid.slice(-16));
            } catch (ipErr) {}
          }
        }
      } else {
        // Check if user has an SSO ticket or active SSO session from SSO Hub
        let ssoMatched = false;
        try {
          const sessionData = getSsoSession();
          if (sessionData && (sessionData.uid || sessionData.email)) {
            let prof: Profile | null = null;
            try {
              if (sessionData.uid) {
                const profRef = doc(db, 'profiles', sessionData.uid);
                const profSnap = await getDoc(profRef);
                if (profSnap.exists()) {
                  prof = { id: profSnap.id, ...profSnap.data() } as Profile;
                }
              }
              if (!prof && sessionData.email) {
                const emailQ = query(collection(db, 'profiles'), where('email', '==', sessionData.email.trim().toLowerCase()), limit(1));
                const emailSnap = await getDocs(emailQ);
                if (!emailSnap.empty) {
                  prof = { id: emailSnap.docs[0].id, ...emailSnap.docs[0].data() } as Profile;
                }
              }
            } catch (fsErr) {
              // Firestore permission denied or unauthenticated read - continue gracefully with ticket claims
            }

            // Fallback directly to SSO ticket claims
            if (!prof) {
              const userEmail = (sessionData.email || '').toLowerCase().trim();
              const isSMHUser = userEmail.includes('shantimemorialhospital.com') || userEmail === 'ayushbindhani001@gmail.com';
              const defaultOrgId = sessionData.organizationId || (isSMHUser ? 'shanti-memorial-hospital' : '00000000-0000-0000-0000-000000000001');
              const isAdminEmail = userEmail.includes('admin') || userEmail === 'ayushbindhani001@gmail.com';
              const isHrEmail = userEmail.includes('hr') || userEmail.includes('nurse');
              const role: UserRole = (sessionData.role as UserRole) || (isAdminEmail ? 'admin' : isHrEmail ? 'hr' : 'employee');
              const fullName = sessionData.displayName || (userEmail === 'ayushbindhani001@gmail.com' ? 'Ayush Bindhani' : userEmail.split('@')[0]) || 'HRMS User';
              const now = new Date().toISOString();

              prof = {
                id: sessionData.uid || 'sso-' + Date.now(),
                email: userEmail,
                full_name: fullName,
                phone: sessionData.phone || null,
                avatar_url: sessionData.photoURL || null,
                role,
                organization_id: defaultOrgId,
                is_active: true,
                created_at: now,
                updated_at: now,
              };
            }

            const appUser: AppUser = {
              id: prof.id,
              email: prof.email,
              fullName: prof.full_name || sessionData.displayName,
              imageUrl: prof.avatar_url,
              user_metadata: {
                full_name: prof.full_name,
                role: prof.role,
                organization_id: prof.organization_id,
              },
            };

            if (isMounted) {
              setProfile(prof);
              setUser(appUser);
              setIsLoading(false);
              ssoMatched = true;
            }
          }
        } catch (ssoErr) {
          console.warn('[Oasis SSO consumer error]:', ssoErr);
        }

        if (!ssoMatched && isMounted) {
          setUser(null);
          setProfile(null);
          loggedInUserIdRef.current = null;
        }
      }

      if (isMounted) {
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [syncProfileForAuthUser]);

  // Sign In via Firebase Auth
  const handleSignIn = useCallback(
    async (email: string, password: string, _fallbackOrgId?: string) => {
      const cleanEmail = email.trim().toLowerCase();
      try {
        const credential = await signInWithEmailAndPassword(auth, cleanEmail, password);
        const fbUser = credential.user;

        if (fbUser) {
          const prof = await syncProfileForAuthUser(fbUser);
          const appUser: AppUser = {
            id: fbUser.uid,
            email: fbUser.email || undefined,
            fullName: prof?.full_name || fbUser.displayName || fbUser.email?.split('@')[0],
            imageUrl: prof?.avatar_url || fbUser.photoURL || null,
            user_metadata: {
              full_name: prof?.full_name,
              role: prof?.role,
              organization_id: prof?.organization_id,
            },
          };
          setProfile(prof);
          setUser(appUser);
        }
      } catch (err: any) {
        let msg = err.message || 'Invalid email or password';
        if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
          msg = 'Invalid email or password. Please verify your credentials.';
        } else if (err.code === 'auth/too-many-requests') {
          msg = 'Access to this account has been temporarily disabled due to many failed login attempts. You can reset your password or try again later.';
        } else if (err.message === 'Network request failed' || err?.toString?.().includes('Network request failed')) {
          msg = 'Unable to connect to Firebase. Please check your internet connection.';
        }
        throw new Error(msg);
      }
    },
    [syncProfileForAuthUser]
  );

  // Sign In with Google via Firebase Auth
  const handleSignInWithGoogle = useCallback(async () => {
    try {
      if (Platform.OS === 'web') {
        const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        const credential = await signInWithPopup(auth, provider);
        const fbUser = credential.user;

        if (fbUser) {
          const prof = await syncProfileForAuthUser(fbUser);
          const appUser: AppUser = {
            id: fbUser.uid,
            email: fbUser.email || undefined,
            fullName: prof?.full_name || fbUser.displayName || fbUser.email?.split('@')[0],
            imageUrl: prof?.avatar_url || fbUser.photoURL || null,
            user_metadata: {
              full_name: prof?.full_name || fbUser.displayName || undefined,
              role: prof?.role || 'employee',
              organization_id: prof?.organization_id,
            },
          };
          setProfile(prof);
          setUser(appUser);
        }
      } else {
        // Mobile (Android / iOS): Native Google Sign-In with Firebase credential exchange
        let GoogleSignin: any;
        let statusCodes: any;
        try {
          const gModule = await import('@react-native-google-signin/google-signin');
          GoogleSignin = gModule.GoogleSignin;
          statusCodes = gModule.statusCodes;
        } catch {
          throw new Error('Native Google Sign-In requires a development build or EAS build (it cannot run in standard Expo Go). Please run "npm run build:android" or use email/password login.');
        }

        const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
        if (!webClientId) {
          throw new Error(
            'Google Sign-In configuration missing: EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not set in your .env file. Add your Web Client ID from Firebase Console / Google Cloud Console.'
          );
        }

        try {
          GoogleSignin.configure({
            webClientId,
            offlineAccess: true,
          });

          await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
          const signInResult = await GoogleSignin.signIn();

          // Support both newer v13+ data structure and legacy shape
          const idToken = signInResult?.data?.idToken || (signInResult as any)?.idToken;
          if (!idToken) {
            throw new Error('No Google ID token was returned by Google Sign-In.');
          }

          const { GoogleAuthProvider, signInWithCredential } = await import('firebase/auth');
          const credential = GoogleAuthProvider.credential(idToken);
          const authResult = await signInWithCredential(auth, credential);
          const fbUser = authResult.user;

          if (fbUser) {
            const prof = await syncProfileForAuthUser(fbUser);
            const appUser: AppUser = {
              id: fbUser.uid,
              email: fbUser.email || undefined,
              fullName: prof?.full_name || fbUser.displayName || fbUser.email?.split('@')[0],
              imageUrl: prof?.avatar_url || fbUser.photoURL || null,
              user_metadata: {
                full_name: prof?.full_name || fbUser.displayName || undefined,
                role: prof?.role || 'employee',
                organization_id: prof?.organization_id,
              },
            };
            setProfile(prof);
            setUser(appUser);
          }
        } catch (nativeErr: any) {
          if (
            nativeErr.code === statusCodes?.SIGN_IN_CANCELLED ||
            nativeErr.code === '12501' ||
            nativeErr.message?.includes?.('SIGN_IN_CANCELLED')
          ) {
            // User cancelled Google sign-in dialog
            return;
          } else if (
            nativeErr.code === statusCodes?.IN_PROGRESS ||
            nativeErr.message?.includes?.('IN_PROGRESS')
          ) {
            return;
          } else if (nativeErr.code === statusCodes?.PLAY_SERVICES_NOT_AVAILABLE) {
            throw new Error('Google Play Services is not available or outdated on this Android device.');
          } else if (
            nativeErr.code === '10' ||
            nativeErr.message?.includes?.('DEVELOPER_ERROR') ||
            nativeErr.message?.includes?.('status code 10')
          ) {
            throw new Error(
              'Google Sign-In configuration error (DEVELOPER_ERROR 10). Ensure your SHA-1 certificate fingerprint is registered in Firebase Console (under Android App com.oasis.hrms) and that EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID matches your OAuth 2.0 Web client ID.'
            );
          }
          throw nativeErr;
        }
      }
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        throw new Error('Sign-in cancelled. You closed the Google sign-in window.');
      } else if (err.code === 'auth/cancelled-popup-request') {
        return;
      } else if (err.code === 'auth/popup-blocked') {
        throw new Error('Google Sign-In popup was blocked by your browser. Please allow popups for this site.');
      } else if (
        err.code === 'auth/operation-not-allowed' ||
        err.code === 'auth/configuration-not-found' ||
        err?.message?.includes?.('CONFIGURATION_NOT_FOUND')
      ) {
        throw new Error('Google provider is not enabled yet in Firebase Console. Go to Firebase Console > Authentication > Sign-in method > Google and toggle Enable.');
      } else if (err.code === 'auth/unauthorized-domain' || err?.message?.includes?.('unauthorized domain')) {
        throw new Error('This domain is not authorized in Firebase Console. Add your localhost / IP to Authentication > Settings > Authorized domains.');
      }
      throw new Error(err.message || 'Failed to sign in with Google.');
    }
  }, [syncProfileForAuthUser]);

  // Sign Up via Firebase Auth
  const handleSignUp = useCallback(
    async (email: string, password: string, fullName: string, role: string = 'employee', orgId?: string) => {
      const cleanEmail = email.trim().toLowerCase();
      try {
        const credential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        const fbUser = credential.user;

        if (fbUser) {
          await firebaseUpdateProfile(fbUser, { displayName: fullName });
          const defaultOrgId = orgId || '00000000-0000-0000-0000-000000000001';
          const now = new Date().toISOString();

          const newProfPayload: Profile = {
            id: fbUser.uid,
            email: cleanEmail,
            full_name: fullName,
            phone: null,
            avatar_url: null,
            role: role as UserRole,
            organization_id: defaultOrgId,
            is_active: true,
            created_at: now,
            updated_at: now,
          };

          await setDoc(doc(db, 'profiles', fbUser.uid), newProfPayload);
          setProfile(newProfPayload);

          const appUser: AppUser = {
            id: fbUser.uid,
            email: cleanEmail,
            fullName: fullName,
            imageUrl: null,
            user_metadata: {
              full_name: fullName,
              role: role,
              organization_id: defaultOrgId,
            },
          };
          setUser(appUser);
        }
      } catch (err: any) {
        let msg = err.message || 'Failed to create account';
        if (err.code === 'auth/email-already-in-use') {
          msg = 'An account with this email address already exists.';
        } else if (err.code === 'auth/weak-password') {
          msg = 'Password is too weak. Please use at least 6 characters.';
        }
        throw new Error(msg);
      }
    },
    []
  );

  // Sign Out via Firebase Auth
  const handleSignOut = useCallback(async () => {
    try {
      if (profile) {
        await logUserLogout(profile);
      }
      clearSsoSession();
      await firebaseSignOut(auth);
      setUser(null);
      setProfile(null);
      loggedInUserIdRef.current = null;
    } catch (err) {
      console.error('Sign out error:', err);
    }
  }, [profile]);

  const effectiveRole: UserRole | null = profile?.role || (user?.user_metadata?.role as UserRole) || null;

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role: effectiveRole,
        isLoading,
        isAuthenticated: !!user,
        signIn: handleSignIn,
        signInWithGoogle: handleSignInWithGoogle,
        signUp: handleSignUp,
        signOut: handleSignOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}