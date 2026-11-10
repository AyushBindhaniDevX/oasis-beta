import { db, sanitizeFirestoreData } from '@/lib/firebase';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
} from 'firebase/firestore';
import { Platform } from 'react-native';
import type { Profile, AuditLog } from '@/types';

export interface UserActivityPayload {
  userId?: string | null;
  organizationId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string | null;
  description?: string;
  metadata?: Record<string, unknown>;
  actorName?: string;
  actorEmail?: string;
  actorRole?: string;
}

export async function trackUserActivity(payload: UserActivityPayload): Promise<void> {
  try {
    const now = new Date().toISOString();
    let orgId = payload.organizationId || null;

    if (!orgId && payload.userId) {
      const profSnap = await getDoc(doc(db, 'profiles', payload.userId));
      if (profSnap.exists()) {
        const prof = profSnap.data() as Profile;
        orgId = prof.organization_id;
        payload.actorName = payload.actorName || prof.full_name;
        payload.actorEmail = payload.actorEmail || prof.email;
        payload.actorRole = payload.actorRole || prof.role;
      }
    }

    if (!orgId) {
      orgId = '00000000-0000-0000-0000-000000000001';
    }

    const logId = `act-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const logEntry: AuditLog = {
      id: logId,
      organization_id: orgId,
      user_id: payload.userId || null,
      action: payload.action,
      entity_type: payload.entityType || 'user_activity',
      entity_id: payload.entityId || payload.userId || null,
      metadata: {
        description: payload.description || payload.action,
        platform: Platform.OS,
        timestamp_ms: Date.now(),
        ...(payload.metadata || {}),
      },
      user: {
        full_name: payload.actorName || 'User',
        email: payload.actorEmail || '',
        role: (payload.actorRole as any) || 'employee',
      },
      created_at: now,
    };

    await setDoc(doc(db, 'audit_logs', logId), sanitizeFirestoreData(logEntry));

    // Update profile last_active timestamp
    if (payload.userId) {
      try {
        await updateDoc(doc(db, 'profiles', payload.userId), {
          last_active: now,
          updated_at: now,
        });
      } catch {}
    }
  } catch (err) {
    console.warn('Track user activity error (non-fatal):', err);
  }
}

export async function logUserLogin(
  profile: Profile,
  ipAddress?: string | null,
  sessionId?: string | null
): Promise<void> {
  try {
    const now = new Date().toISOString();
    const effectiveSessionId = sessionId || `sess_${Math.random().toString(36).substring(2, 15)}`;

    try {
      await updateDoc(doc(db, 'profiles', profile.id), {
        last_login_ip: ipAddress || null,
        session_id: effectiveSessionId,
        last_active: now,
        updated_at: now,
      });
    } catch {}

    await trackUserActivity({
      userId: profile.id,
      organizationId: profile.organization_id,
      action: 'USER_SIGN_IN',
      entityType: 'auth',
      entityId: profile.id,
      description: `User ${profile.full_name} (${profile.email}) signed in`,
      actorName: profile.full_name,
      actorEmail: profile.email,
      actorRole: profile.role,
      metadata: {
        login_method: 'password',
        ip_address: ipAddress || 'unknown',
        session_id: effectiveSessionId,
        platform: Platform.OS,
      },
    });
  } catch (err) {
    console.warn('Log user login notice:', err);
  }
}

export async function logUserLogout(profile?: Profile | null): Promise<void> {
  if (!profile) return;
  try {
    await trackUserActivity({
      userId: profile.id,
      organizationId: profile.organization_id,
      action: 'USER_SIGN_OUT',
      entityType: 'auth',
      entityId: profile.id,
      description: `User ${profile.full_name} (${profile.email}) signed out`,
      actorName: profile.full_name,
      actorEmail: profile.email,
      actorRole: profile.role,
      metadata: {
        platform: Platform.OS,
      },
    });
  } catch (err) {
    console.warn('Log user logout notice:', err);
  }
}

export async function getUserActivities(
  organizationId?: string,
  userId?: string,
  limitCount = 50
): Promise<AuditLog[]> {
  try {
    const snap = await getDocs(collection(db, 'audit_logs'));
    const logs: AuditLog[] = [];
    snap.forEach((d) => {
      const l = { id: d.id, ...d.data() } as AuditLog;
      if (organizationId && l.organization_id && l.organization_id !== organizationId) {
        return;
      }
      if (userId && l.user_id !== userId) {
        return;
      }
      logs.push(l);
    });

    logs.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    return logs.slice(0, limitCount);
  } catch (err) {
    console.error('Failed to get user activities:', err);
    return [];
  }
}
