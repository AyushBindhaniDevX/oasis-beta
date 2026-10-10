import { db } from '@/lib/firebase';
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
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import type { Notification, Announcement, Employee, Profile } from '@/types';
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

const isExpoGo = Constants?.executionEnvironment === ExecutionEnvironment.StoreClient;
let ExpoNotifications: typeof import('expo-notifications') | null = null;

if (Platform.OS !== 'web' && !isExpoGo) {
  try {
    ExpoNotifications = require('expo-notifications');
    ExpoNotifications?.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (e) {}
}

export async function requestNotificationPermissions() {
  if (Platform.OS === 'web' || !ExpoNotifications) return true;
  try {
    const { status: existingStatus } = await ExpoNotifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await ExpoNotifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  } catch (e) {
    return false;
  }
}

export async function sendClockInNotification(startTime: string) {
  if ((Platform.OS !== 'android' && Platform.OS !== 'ios') || !ExpoNotifications) return;
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return;

    await cancelClockInNotification();

    await ExpoNotifications.scheduleNotificationAsync({
      content: {
        title: 'Clocked In',
        body: `You are currently clocked in. Started at ${startTime}. Don't forget to clock out when you leave!`,
        data: { type: 'clock_in' },
        sound: true,
      },
      trigger: null,
    });
  } catch (e) {
    console.warn('Expo scheduleNotification suppressed warning:', e);
  }
}

export async function cancelClockInNotification() {
  if ((Platform.OS === 'android' || Platform.OS === 'ios') && ExpoNotifications) {
    try {
      await ExpoNotifications.dismissAllNotificationsAsync();
      await ExpoNotifications.cancelAllScheduledNotificationsAsync();
    } catch (e) {
      console.warn('cancelClockInNotification warning:', e);
    }
  }
}

export async function getUserNotifications(profileId: string): Promise<Notification[]> {
  if (!profileId) return [];

  try {
    const q = query(
      collection(db, 'notifications'),
      where('profile_id', '==', profileId)
    );
    const snap = await getDocs(q);
    const notifs: Notification[] = [];
    snap.forEach((d) => notifs.push({ id: d.id, ...d.data() } as Notification));
    notifs.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    return notifs.slice(0, 50);
  } catch (err) {
    console.error('getUserNotifications error:', err);
    return [];
  }
}

export async function createNotification(
  profileIdOrObj: string | { profile_id: string; title: string; message: string; type: string; action_url?: string | null },
  typeParam?: string,
  titleParam?: string,
  messageParam?: string,
  actionUrlParam?: string | null
): Promise<void> {
  let profile_id = '';
  let title = '';
  let message = '';
  let type = 'general';
  let action_url: string | null = null;

  if (typeof profileIdOrObj === 'object') {
    profile_id = profileIdOrObj.profile_id;
    title = profileIdOrObj.title;
    message = profileIdOrObj.message;
    type = profileIdOrObj.type;
    action_url = profileIdOrObj.action_url || null;
  } else {
    profile_id = profileIdOrObj;
    type = typeParam || 'general';
    title = titleParam || '';
    message = messageParam || '';
    actionUrlParam = actionUrlParam || null;
  }

  if (!profile_id) return;

  const notifId = `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const notifObj: Notification = {
    id: notifId,
    profile_id,
    title,
    message,
    type,
    is_read: false,
    action_url,
    created_at: new Date().toISOString(),
  };

  await setDoc(doc(db, 'notifications', notifId), notifObj);

  if (Platform.OS !== 'web' && ExpoNotifications) {
    try {
      await ExpoNotifications.scheduleNotificationAsync({
        content: {
          title,
          body: message,
          data: { url: action_url, type },
          sound: true,
        },
        trigger: null,
      });
    } catch (e) {}
  }
}

export async function markNotificationAsRead(id: string): Promise<boolean> {
  try {
    await updateDoc(doc(db, 'notifications', id), { is_read: true });
    return true;
  } catch {
    return false;
  }
}

export async function markAllNotificationsAsRead(profileId: string): Promise<boolean> {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('profile_id', '==', profileId),
      where('is_read', '==', false)
    );
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      await updateDoc(doc(db, 'notifications', d.id), { is_read: true });
    }
    return true;
  } catch {
    return false;
  }
}

export function subscribeToUserNotifications(
  profileId: string,
  onUpdate: (notifications: Notification[]) => void
): () => void {
  if (!profileId) {
    onUpdate([]);
    return () => {};
  }

  const q = query(
    collection(db, 'notifications'),
    where('profile_id', '==', profileId)
  );

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const notifs: Notification[] = [];
      snapshot.forEach((d) => notifs.push({ id: d.id, ...d.data() } as Notification));
      notifs.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
      onUpdate(notifs.slice(0, 50));
    },
    (err) => {
      if ((err as any)?.code !== 'permission-denied') { console.warn('subscribeToUserNotifications error:', err); }
    }
  );

  return unsubscribe;
}

// ----------------------------------------------------
// Announcements & Birthday Notifications
// ----------------------------------------------------

export async function publishAnnouncement(payload: Partial<Announcement>): Promise<void> {
  const annId = `ann-${Date.now()}`;
  const now = new Date().toISOString();
  
  const ann: Announcement = {
    id: annId,
    organization_id: payload.organization_id!,
    title: payload.title!,
    message: payload.message!,
    target_audience: payload.target_audience || 'all',
    target_department_id: payload.target_department_id || null,
    target_branch_id: payload.target_branch_id || null,
    published_by: payload.published_by!,
    published_at: payload.published_at || now,
    expiry_date: payload.expiry_date || null,
    priority: payload.priority || 'normal',
    created_at: now,
  };
  
  await setDoc(doc(db, 'announcements', annId), ann);
  
  // Find target employees to notify
  let qry = query(collection(db, 'employees'), where('organization_id', '==', ann.organization_id));
  if (ann.target_audience === 'department' && ann.target_department_id) {
    qry = query(collection(db, 'employees'), where('organization_id', '==', ann.organization_id), where('department_id', '==', ann.target_department_id));
  } else if (ann.target_audience === 'branch' && ann.target_branch_id) {
    qry = query(collection(db, 'employees'), where('organization_id', '==', ann.organization_id), where('workplace_id', '==', ann.target_branch_id));
  }
  
  const empSnap = await getDocs(qry);
  const notifyPromises: Promise<void>[] = [];
  empSnap.forEach(d => {
    const emp = d.data() as Employee;
    if (emp.profile_id) {
      notifyPromises.push(createNotification({
        profile_id: emp.profile_id,
        title: `📢 ${ann.title}`,
        message: ann.message,
        type: 'announcement'
      }));
    }
  });
  
  await Promise.allSettled(notifyPromises);
}

export async function checkAndSendBirthdayNotifications(organizationId: string): Promise<void> {
  const today = new Date();
  // Using mm-dd format for birthday matching
  const currentMonthDay = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  const qry = query(collection(db, 'employees'), where('organization_id', '==', organizationId), where('employment_status', '==', 'active'));
  const empSnap = await getDocs(qry);
  
  const notifyPromises: Promise<void>[] = [];
  const currentYear = today.getFullYear();
  
  for (const d of empSnap.docs) {
    const emp = d.data() as Employee;
    if (emp.date_of_birth) {
      // Assuming DOB format is YYYY-MM-DD
      const dobParts = emp.date_of_birth.split('-');
      if (dobParts.length === 3) {
        const empMonthDay = `${dobParts[1]}-${dobParts[2]}`;
        
        if (empMonthDay === currentMonthDay) {
          // Check if notification already sent this year
          const bdayNotifId = `bday-${emp.id}-${currentYear}`;
          const bdayCheck = await getDoc(doc(db, 'audit_logs', bdayNotifId)); // Or a specific birthday table
          if (!bdayCheck.exists()) {
            
            // Log it so we don't send it again this year
            await setDoc(doc(db, 'audit_logs', bdayNotifId), {
              organization_id: organizationId,
              user_id: emp.profile_id,
              action: 'BIRTHDAY_NOTIFICATION_SENT',
              entity_type: 'employee',
              entity_id: emp.id,
              metadata: { year: currentYear },
              created_at: new Date().toISOString()
            });

            // Retrieve employee profile for name
            const profSnap = await getDoc(doc(db, 'profiles', emp.profile_id));
            const empName = profSnap.exists() ? (profSnap.data() as Profile).full_name : 'Staff Member';
            
            // Notify the employee
            notifyPromises.push(createNotification({
              profile_id: emp.profile_id,
              title: '🎉 Happy Birthday!',
              message: `Wishing you a wonderful year ahead from everyone at the company!`,
              type: 'general'
            }));

            // Notify everyone else in the company about their birthday (Optional/Configurable)
            const allQry = query(collection(db, 'employees'), where('organization_id', '==', organizationId));
            const allEmpSnap = await getDocs(allQry);
            allEmpSnap.forEach(allD => {
              const otherEmp = allD.data() as Employee;
              if (otherEmp.profile_id && otherEmp.id !== emp.id) {
                notifyPromises.push(createNotification({
                  profile_id: otherEmp.profile_id,
                  title: '🎂 Birthday Alert!',
                  message: `Today is ${empName}'s birthday! Wish them a happy birthday!`,
                  type: 'general'
                }));
              }
            });
          }
        }
      }
    }
  }
  
  await Promise.allSettled(notifyPromises);
}

