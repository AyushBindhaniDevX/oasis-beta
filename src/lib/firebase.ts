import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  Auth,
  inMemoryPersistence,
} from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// 1. Initialize or retrieve the Firebase App instance
export const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// 2. Initialize Auth with persistent session storage
let authInstance: Auth;
try {
  if (Platform.OS === 'web') {
    authInstance = getAuth(app);
  } else {
    // React Native persistence using AsyncStorage
    const getRNPersistence = (require('firebase/auth') as any).getReactNativePersistence;
    if (typeof getRNPersistence === 'function') {
      authInstance = initializeAuth(app, {
        persistence: getRNPersistence(AsyncStorage),
      });
    } else {
      authInstance = getAuth(app);
    }
  }
} catch (e) {
  // If already initialized during Fast Refresh / HMR
  authInstance = getAuth(app);
}

export const auth: Auth = authInstance;

// 3. Cloud Firestore database instance
export const db: Firestore = getFirestore(app);

// 4. Cloud Storage instance
export const storage: FirebaseStorage = getStorage(app);

// 5. Secondary App for admin user creation without logging out current user
export const secondaryApp: FirebaseApp = getApps().find(a => a.name === 'SecondaryApp') || initializeApp(firebaseConfig, 'SecondaryApp');

let secAuth: Auth;
try {
  secAuth = initializeAuth(secondaryApp, {
    persistence: inMemoryPersistence,
  });
} catch (e) {
  secAuth = getAuth(secondaryApp);
}
export const secondaryAuth: Auth = secAuth;

/**
 * Recursively removes undefined fields from an object or array before passing to Firestore.
 * Firestore rejects any document containing `undefined` with:
 * "Unsupported field value: undefined"
 */
export function sanitizeFirestoreData<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => sanitizeFirestoreData(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
    // Preserve Date, Firestore FieldValue / Timestamp or other special class instances
    if (
      obj instanceof Date ||
      (obj as any)._methodName ||
      typeof (obj as any).toMillis === 'function' ||
      (obj as any).constructor?.name === 'FieldValue'
    ) {
      return obj;
    }
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = sanitizeFirestoreData(value);
      }
    }
    return cleaned as T;
  }
  return obj;
}

