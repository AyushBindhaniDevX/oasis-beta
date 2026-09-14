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
import type { Notification } from '@/types';
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
