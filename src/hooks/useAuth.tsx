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
  // Start with clean unauthenticated state until verified against database
  const [user, setUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const loggedInUserIdRef = useRef<string | null>(null);

  // Helper: Fetch, verify, and validate profile against Firestore
  // Enforces: Active accounts only, must be registered employee/HR/Admin
  const syncProfileForAuthUser = useCallback(async (authUser: FirebaseUser): Promise<Profile> => {
    if (!authUser?.uid) {
      throw new Error('ACCESS_DENIED_INVALID: Invalid authentication session.');
    }

    const cleanEmail = (authUser.email || '').toLowerCase().trim();

    // 1. Check profile by auth UID in 'profiles' collection
    const profRef = doc(db, 'profiles', authUser.uid);
    const profSnap = await getDoc(profRef);

    if (profSnap.exists()) {
      const data = profSnap.data() as Profile;

      // Strict Active Account Check
      if (data.is_active === false) {
        throw new Error('ACCESS_DENIED_DEACTIVATED: Your account has been deactivated. Please contact your HR department or administrator.');
      }

      // Strict Role Check (Must be employee, hr, or admin)
      if (!data.role || !['employee', 'hr', 'admin'].includes(data.role)) {
        throw new Error('ACCESS_DENIED_ROLE: Your account role is not authorized to access this portal.');
      }

      // Strict Organization Link Check: User MUST be linked to an active organization
      if (!data.organization_id || typeof data.organization_id !== 'string' || !data.organization_id.trim()) {
        throw new Error('ACCESS_DENIED_NO_ORG: Your account is not linked to any organization. Please contact your administrator.');
      }

      if (cleanEmail === 'ayushbindhani001@gmail.com' && data.role !== 'admin') {
        const updated = {
          ...data,
          role: 'admin' as UserRole,
          full_name: data.full_name || 'Ayush Bindhani',
          updated_at: new Date().toISOString(),
        };
        await setDoc(profRef, updated, { merge: true });
        return { ...updated, id: profSnap.id };
      }

      return { ...data, id: profSnap.id } as Profile;
    }

    // 2. Check profile by email (pre-created by HR/Admin during user provisioning)
    if (cleanEmail) {
      const emailQuery = query(
        collection(db, 'profiles'),
        where('email', '==', cleanEmail),
        limit(1)
      );
      const emailSnap = await getDocs(emailQuery);

      if (!emailSnap.empty) {
        const existingDoc = emailSnap.docs[0];
        let existingData = existingDoc.data() as Profile;

        // Strict Active Account Check
        if (existingData.is_active === false) {
          throw new Error('ACCESS_DENIED_DEACTIVATED: Your account has been deactivated. Please contact your HR department or administrator.');
        }

        // Strict Role Check
        if (!existingData.role || !['employee', 'hr', 'admin'].includes(existingData.role)) {
          throw new Error('ACCESS_DENIED_ROLE: Your account role is not authorized to access this portal.');
        }

        // Strict Organization Link Check
        if (!existingData.organization_id || typeof existingData.organization_id !== 'string' || !existingData.organization_id.trim()) {
          throw new Error('ACCESS_DENIED_NO_ORG: Your account is not linked to any organization. Please contact your administrator.');
        }

        if (cleanEmail === 'ayushbindhani001@gmail.com' && existingData.role !== 'admin') {
          existingData = {
            ...existingData,
            role: 'admin' as UserRole,
            full_name: existingData.full_name || 'Ayush Bindhani',
          };
        }

        if (existingDoc.id !== authUser.uid) {
          const updatedProf: Profile = {
            ...existingData,
            id: authUser.uid,
            is_active: true,
            updated_at: new Date().toISOString(),
          };
          await setDoc(doc(db, 'profiles', authUser.uid), updatedProf);
          try {
            const empQ = query(collection(db, 'employees'), where('profile_id', '==', existingDoc.id));
            const empSnap = await getDocs(empQ);
            for (const empDoc of empSnap.docs) {
              await updateDoc(doc(db, 'employees', empDoc.id), { profile_id: authUser.uid });
            }
            await deleteDoc(doc(db, 'profiles', existingDoc.id));
          } catch (refErr) {
            console.warn('Reference migration note:', refErr);
          }
          return updatedProf;
        }

        return { ...existingData, id: existingDoc.id } as Profile;
      }
    }

    // 3. Check employees directory if profile not yet created
    let linkedEmployee: any = null;
    if (cleanEmail) {
      try {
        const empQ = query(collection(db, 'employees'), where('email', '==', cleanEmail), limit(1));
        const empSnap = await getDocs(empQ);
        if (!empSnap.empty) {
          linkedEmployee = empSnap.docs[0].data();
        } else {
          const empWorkQ = query(collection(db, 'employees'), where('work_email', '==', cleanEmail), limit(1));
          const empWorkSnap = await getDocs(empWorkQ);
          if (!empWorkSnap.empty) {
            linkedEmployee = empWorkSnap.docs[0].data();
          }
        }
      } catch (empCheckErr) {
        console.warn('[HCM Auth Directory]: Employee check note:', empCheckErr);
      }
    }

    if (linkedEmployee) {
      // Check employee employment status
      const status = linkedEmployee.employment_status || 'active';
      if (status === 'inactive' || status === 'terminated') {
        throw new Error('ACCESS_DENIED_DEACTIVATED: Your employment record is marked as inactive or terminated. Please contact HR.');
      }

      const role: UserRole = (linkedEmployee.role as UserRole) || 'employee';
      if (!['employee', 'hr', 'admin'].includes(role)) {
        throw new Error('ACCESS_DENIED_ROLE: Your employment role is not authorized to access this portal.');
      }

      // Strict Organization Link Check: Employee MUST be linked to an organization
      const empOrgId = linkedEmployee.organization_id;
      if (!empOrgId || typeof empOrgId !== 'string' || !empOrgId.trim()) {
        throw new Error('ACCESS_DENIED_NO_ORG: Your employee record is not linked to any organization. Please contact HR to assign your organization.');
      }

      const now = new Date().toISOString();
      const newProfPayload: Profile = {
        id: authUser.uid,
        email: cleanEmail,
        full_name: linkedEmployee.name || linkedEmployee.full_name || authUser.displayName || cleanEmail.split('@')[0],
        phone: linkedEmployee.phone || authUser.phoneNumber || null,
        avatar_url: authUser.photoURL || null,
        role,
        organization_id: empOrgId,
        is_active: true,
        created_at: now,
        updated_at: now,
      };

      await setDoc(doc(db, 'profiles', authUser.uid), newProfPayload);
      return newProfPayload;
    }

    // 4. Primary Bootstrap Admin Exception
    if (cleanEmail === 'ayushbindhani001@gmail.com') {
      let adminOrgId = 'shanti-memorial-hospital';
      try {
        const orgsQ = query(collection(db, 'organizations'), limit(1));
        const orgsSnap = await getDocs(orgsQ);
        if (!orgsSnap.empty) adminOrgId = orgsSnap.docs[0].id;
      } catch {}

      const now = new Date().toISOString();
      const adminPayload: Profile = {
        id: authUser.uid,
        email: cleanEmail,
        full_name: 'Ayush Bindhani',
        phone: authUser.phoneNumber || null,
        avatar_url: authUser.photoURL || null,
        role: 'admin',
        organization_id: adminOrgId,
        is_active: true,
        created_at: now,
        updated_at: now,
      };
      await setDoc(doc(db, 'profiles', authUser.uid), adminPayload);
      return adminPayload;
    }

    // 5. User does NOT exist in profiles or employee directory -> STRICT REJECTION
    // Enforces: User must exist in system and be linked to an organization before using login in HRMS
    throw new Error('ACCESS_DENIED_UNREGISTERED: No account found for ' + (cleanEmail || 'this user') + '. You must exist in the employee directory and be linked to an organization before logging in.');
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
      if (prof && prof.is_active && ['employee', 'hr', 'admin'].includes(prof.role)) {
        setProfile(prof);
      } else {
        await firebaseSignOut(auth);
        setUser(null);
        setProfile(null);
      }
    } catch (e) {
      console.error('refreshProfile error:', e);
      await firebaseSignOut(auth);
      setUser(null);
      setProfile(null);
    }
  }, [syncProfileForAuthUser]);

  // Listen to Firebase Auth state changes & enforce active employee/HR/admin verification
  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!isMounted) return;

      if (fbUser) {
        try {
          const prof = await syncProfileForAuthUser(fbUser);

          // Double verify active account and role
          if (!prof || prof.is_active === false || !['employee', 'hr', 'admin'].includes(prof.role)) {
            throw new Error('Account inactive or unauthorized.');
          }

          const appUser: AppUser = {
            id: fbUser.uid,
            email: fbUser.email || prof.email,
            fullName: prof.full_name || fbUser.displayName || fbUser.email?.split('@')[0],
            imageUrl: prof.avatar_url || fbUser.photoURL || null,
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
        } catch (authGuardErr: any) {
          console.warn('[HCM Auth Guard]: Sign-in blocked:', authGuardErr?.message);
          await firebaseSignOut(auth);
          clearSsoSession();
          if (isMounted) {
            setUser(null);
            setProfile(null);
            loggedInUserIdRef.current = null;
            setIsLoading(false);
          }
        }
      } else {
        // Check SSO Session with strict database validation
        let ssoMatched = false;
        try {
          const sessionData = getSsoSession();
          if (sessionData && (sessionData.uid || sessionData.email)) {
            const cleanSsoEmail = (sessionData.email || '').toLowerCase().trim();
            let prof: Profile | null = null;

            if (sessionData.uid) {
              const profRef = doc(db, 'profiles', sessionData.uid);
              const profSnap = await getDoc(profRef);
              if (profSnap.exists()) {
                prof = { id: profSnap.id, ...profSnap.data() } as Profile;
              }
            }

            if (!prof && cleanSsoEmail) {
              const emailQ = query(collection(db, 'profiles'), where('email', '==', cleanSsoEmail), limit(1));
              const emailSnap = await getDocs(emailQ);
              if (!emailSnap.empty) {
                prof = { id: emailSnap.docs[0].id, ...emailSnap.docs[0].data() } as Profile;
              }
            }

            // Also check employees collection if profile doc not created yet
            if (!prof && cleanSsoEmail) {
              const empQ = query(collection(db, 'employees'), where('email', '==', cleanSsoEmail), limit(1));
              const empSnap = await getDocs(empQ);
              let empDoc = !empSnap.empty ? empSnap.docs[0] : null;
              if (!empDoc) {
                const empWorkQ = query(collection(db, 'employees'), where('work_email', '==', cleanSsoEmail), limit(1));
                const empWorkSnap = await getDocs(empWorkQ);
                if (!empWorkSnap.empty) empDoc = empWorkSnap.docs[0];
              }

              if (empDoc) {
                const empData = empDoc.data() as any;
                if (empData.employment_status !== 'inactive' && empData.employment_status !== 'terminated') {
                  const now = new Date().toISOString();
                  const targetUid = sessionData.uid || empDoc.id;
                  prof = {
                    id: targetUid,
                    email: cleanSsoEmail,
                    full_name: empData.name || empData.full_name || sessionData.displayName || cleanSsoEmail.split('@')[0],
                    phone: empData.phone || sessionData.phone || null,
                    avatar_url: sessionData.photoURL || null,
                    role: (empData.role as UserRole) || 'employee',
                    organization_id: empData.organization_id || 'shanti-memorial-hospital',
                    is_active: true,
                    created_at: now,
                    updated_at: now,
                  };
                  try {
                    await setDoc(doc(db, 'profiles', targetUid), prof, { merge: true });
                  } catch (e) {}
                }
              }
            }

            // Bootstrap admin fallback
            if (!prof && cleanSsoEmail === 'ayushbindhani001@gmail.com') {
              const now = new Date().toISOString();
              prof = {
                id: sessionData.uid || 'admin_bootstrap',
                email: cleanSsoEmail,
                full_name: 'Ayush Bindhani',
                phone: sessionData.phone || null,
                avatar_url: sessionData.photoURL || null,
                role: 'admin',
                organization_id: 'shanti-memorial-hospital',
                is_active: true,
                created_at: now,
                updated_at: now,
              };
              try {
                await setDoc(doc(db, 'profiles', prof.id), prof, { merge: true });
              } catch (e) {}
            }

            // Only accept SSO if valid active employee/HR/Admin profile exists
            if (prof && prof.is_active && ['employee', 'hr', 'admin'].includes(prof.role)) {
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

                if (!auth.currentUser) {
                  (async () => {
                    try {
                      if (sessionData.googleIdToken) {
                        const { GoogleAuthProvider, signInWithCredential } = await import('firebase/auth');
                        const cred = GoogleAuthProvider.credential(sessionData.googleIdToken);
                        await signInWithCredential(auth, cred);
                      } else if (sessionData.email && sessionData.pass) {
                        await signInWithEmailAndPassword(auth, sessionData.email, sessionData.pass);
                      }
                    } catch (bgAuthErr) {
                      console.warn('[Oasis SSO]: Background Firebase Auth sync note:', bgAuthErr);
                    }
                  })();
                }
              }
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

  // Sign In via Firebase Auth with Active Employee / Role Guard
  const handleSignIn = useCallback(
    async (email: string, password: string, _fallbackOrgId?: string) => {
      const cleanEmail = email.trim().toLowerCase();
      try {
        const credential = await signInWithEmailAndPassword(auth, cleanEmail, password);
        const fbUser = credential.user;

        if (fbUser) {
          const prof = await syncProfileForAuthUser(fbUser);
          if (!prof || prof.is_active === false || !['employee', 'hr', 'admin'].includes(prof.role)) {
            await firebaseSignOut(auth);
            setUser(null);
            setProfile(null);
            throw new Error('ACCESS_DENIED_ROLE: Your account is not authorized or active.');
          }

          const appUser: AppUser = {
            id: fbUser.uid,
            email: fbUser.email || prof.email,
            fullName: prof.full_name || fbUser.displayName || fbUser.email?.split('@')[0],
            imageUrl: prof.avatar_url || fbUser.photoURL || null,
            user_metadata: {
              full_name: prof.full_name,
              role: prof.role,
              organization_id: prof.organization_id,
            },
          };
          setProfile(prof);
          setUser(appUser);
        }
      } catch (err: any) {
        await firebaseSignOut(auth);
        setUser(null);
        setProfile(null);

        if (err?.message?.includes('ACCESS_DENIED_DEACTIVATED')) {
          throw new Error('Access Denied: Your account has been deactivated. Please contact your HR department or administrator.');
        }
        if (err?.message?.includes('ACCESS_DENIED_NO_ORG')) {
          throw new Error('Access Denied: Your account is not linked to an organization. Please contact your administrator.');
        }
        if (err?.message?.includes('ACCESS_DENIED_UNREGISTERED')) {
          throw new Error('Access Denied: Your email is not registered in the employee directory. You must exist in the system and be linked to an organization before logging in.');
        }
        if (err?.message?.includes('ACCESS_DENIED_ROLE')) {
          throw new Error('Access Denied: Your account role is not authorized to access this portal.');
        }

        let msg = err.message || 'Invalid email or password';
        if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
          msg = 'Invalid email or password. Please verify your credentials.';
        } else if (err.code === 'auth/too-many-requests') {
          msg = 'Access to this account has been temporarily disabled due to many failed login attempts. You can reset your password or try again later.';
        } else if (err.message === 'Network request failed' || err?.toString?.().includes('Network request failed')) {
          msg = 'Unable to connect to server. Please check your internet connection.';
        }
        throw new Error(msg);
      }
    },
    [syncProfileForAuthUser]
  );

  // Sign In with Google via Firebase Auth with Active Employee / Role Guard
  const handleSignInWithGoogle = useCallback(async () => {
    try {
      if (Platform.OS === 'web') {
        const { GoogleAuthProvider, signInWithPopup, signInWithRedirect } = await import('firebase/auth');
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        let credential;
        try {
          credential = await signInWithPopup(auth, provider);
        } catch (popupErr: any) {
          if (popupErr.code === 'auth/popup-blocked' || popupErr.code === 'auth/cancelled-popup-request') {
            await signInWithRedirect(auth, provider);
            return;
          }
          throw popupErr;
        }
        const fbUser = credential?.user;

        if (fbUser) {
          const prof = await syncProfileForAuthUser(fbUser);
          if (!prof || prof.is_active === false || !['employee', 'hr', 'admin'].includes(prof.role)) {
            await firebaseSignOut(auth);
            setUser(null);
            setProfile(null);
            throw new Error('ACCESS_DENIED_ROLE: Your account is not authorized or active.');
          }

          const appUser: AppUser = {
            id: fbUser.uid,
            email: fbUser.email || prof.email,
            fullName: prof.full_name || fbUser.displayName || fbUser.email?.split('@')[0],
            imageUrl: prof.avatar_url || fbUser.photoURL || null,
            user_metadata: {
              full_name: prof.full_name,
              role: prof.role,
              organization_id: prof.organization_id,
            },
          };
          setProfile(prof);
          setUser(appUser);
        }
      } else {
        let GoogleSignin: any;
        let statusCodes: any;
        try {
          const gModule = await import('@react-native-google-signin/google-signin');
          GoogleSignin = gModule.GoogleSignin;
          statusCodes = gModule.statusCodes;
        } catch {
          throw new Error('Native Google Sign-In requires a development build. Please use email and password to sign in.');
        }

        const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '970423945867-0c1537g7p1oou4eug7p91a7r77q2c0ck.apps.googleusercontent.com';

        try {
          GoogleSignin.configure({ webClientId, offlineAccess: true });
          await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
          const signInResult = await GoogleSignin.signIn();
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
            if (!prof || prof.is_active === false || !['employee', 'hr', 'admin'].includes(prof.role)) {
              await firebaseSignOut(auth);
              setUser(null);
              setProfile(null);
              throw new Error('ACCESS_DENIED_ROLE: Your account is not authorized or active.');
            }

            const appUser: AppUser = {
              id: fbUser.uid,
              email: fbUser.email || prof.email,
              fullName: prof.full_name || fbUser.displayName || fbUser.email?.split('@')[0],
              imageUrl: prof.avatar_url || fbUser.photoURL || null,
              user_metadata: {
                full_name: prof.full_name,
                role: prof.role,
                organization_id: prof.organization_id,
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
            return;
          } else if (
            nativeErr.code === statusCodes?.IN_PROGRESS ||
            nativeErr.message?.includes?.('IN_PROGRESS')
          ) {
            return;
          }
          throw nativeErr;
        }
      }
    } catch (err: any) {
      await firebaseSignOut(auth);
      setUser(null);
      setProfile(null);

      if (err?.message?.includes('ACCESS_DENIED_DEACTIVATED')) {
        throw new Error('Access Denied: Your account has been deactivated. Please contact your HR department or administrator.');
      }
      if (err?.message?.includes('ACCESS_DENIED_NO_ORG')) {
        throw new Error('Access Denied: Your account is not linked to an organization. Please contact your administrator.');
      }
      if (err?.message?.includes('ACCESS_DENIED_UNREGISTERED')) {
        throw new Error('Access Denied: Your Google account is not registered in the employee directory. You must exist in the system and be linked to an organization before logging in.');
      }
      if (err?.message?.includes('ACCESS_DENIED_ROLE')) {
        throw new Error('Access Denied: Your account role is not authorized to access this portal.');
      }
      if (err.code === 'auth/popup-closed-by-user') {
        throw new Error('Sign-in cancelled. You closed the Google sign-in window.');
      }
      throw new Error(err.message || 'Failed to sign in with Google.');
    }
  }, [syncProfileForAuthUser]);

  // Sign Up via Firebase Auth (Only allowed if email pre-exists in employee directory and linked to an org)
  const handleSignUp = useCallback(
    async (email: string, password: string, fullName: string, role: string = 'employee', orgId?: string) => {
      const cleanEmail = email.trim().toLowerCase();

      // Check if email exists in employees collection
      let linkedEmployee: any = null;
      try {
        const empQ = query(collection(db, 'employees'), where('email', '==', cleanEmail), limit(1));
        const empSnap = await getDocs(empQ);
        if (!empSnap.empty) {
          linkedEmployee = empSnap.docs[0].data();
        } else {
          const empWorkQ = query(collection(db, 'employees'), where('work_email', '==', cleanEmail), limit(1));
          const empWorkSnap = await getDocs(empWorkQ);
          if (!empWorkSnap.empty) {
            linkedEmployee = empWorkSnap.docs[0].data();
          }
        }
      } catch (e) {}

      if (!linkedEmployee && cleanEmail !== 'ayushbindhani001@gmail.com') {
        throw new Error('Access Denied: Self-registration is restricted. You must exist in the employee directory and be linked to an organization by HR first.');
      }

      if (linkedEmployee && (!linkedEmployee.organization_id || typeof linkedEmployee.organization_id !== 'string' || !linkedEmployee.organization_id.trim())) {
        throw new Error('Access Denied: Your employee record is not linked to an organization. Please contact HR.');
      }

      if (linkedEmployee && (linkedEmployee.employment_status === 'inactive' || linkedEmployee.employment_status === 'terminated')) {
        throw new Error('Access Denied: Your employee record is inactive. Please contact HR.');
      }

      try {
        const credential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        const fbUser = credential.user;

        if (fbUser) {
          await firebaseUpdateProfile(fbUser, { displayName: fullName });
          const defaultOrgId = linkedEmployee?.organization_id || orgId || 'shanti-memorial-hospital';
          const assignedRole = (linkedEmployee?.role as UserRole) || (role as UserRole) || 'employee';
          const now = new Date().toISOString();

          const newProfPayload: Profile = {
            id: fbUser.uid,
            email: cleanEmail,
            full_name: fullName,
            phone: linkedEmployee?.phone || null,
            avatar_url: null,
            role: assignedRole,
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
              role: assignedRole,
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

  const effectiveRole: UserRole | null = (profile?.role as UserRole) || null;

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role: effectiveRole,
        isLoading,
        isAuthenticated: !!user && !!profile && profile.is_active === true && ['employee', 'hr', 'admin'].includes(profile.role),
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