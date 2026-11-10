/**
 * Mobile API & Data Aggregator Layer
 *
 * Implements high-speed aggregated data fetching with stale-while-revalidate caching
 * for mobile and web clients. Eliminates multi-hop Firestore latency by batching
 * parallel queries and returning instant cached state.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  limit,
} from 'firebase/firestore';
import type { Employee, Attendance, Workplace, LeaveBalance, WorkShift } from '@/types/database';

export interface MobileDashboardBundle {
  employee: Employee | null;
  workplace: Workplace | null;
  todayAttendance: Attendance | null;
  monthRecords: Attendance[];
  monthlyStats: {
    percent: number;
    hours: number;
    daysPresent: number;
    daysLate: number;
  };
  leaveBalanceTotal: number;
  defaultShift: WorkShift | null;
  cachedAt: number;
}

const CACHE_KEY_PREFIX = '@oasis_mobile_cache_';
const MEMORY_CACHE = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes fresh cache

/**
 * High-Speed Aggregated Dashboard Bundle
 * Returns cached data immediately if available, then updates in the background.
 */
export async function fetchMobileDashboardBundle(
  profileId: string,
  orgId?: string | null,
  options: { forceFresh?: boolean } = {}
): Promise<{ bundle: MobileDashboardBundle; fromCache: boolean }> {
  const cacheKey = `${CACHE_KEY_PREFIX}dashboard_${profileId}_${orgId || 'default'}`;

  // 1. Instant In-Memory Cache Check
  if (!options.forceFresh && MEMORY_CACHE.has(cacheKey)) {
    const mem = MEMORY_CACHE.get(cacheKey)!;
    if (Date.now() - mem.timestamp < CACHE_TTL_MS) {
      // Trigger background refresh silently if older than 30s
      if (Date.now() - mem.timestamp > 30000) {
        refreshDashboardBundleInBackground(profileId, orgId, cacheKey);
      }
      return { bundle: mem.data, fromCache: true };
    }
  }

  // 2. Persistent AsyncStorage Cache Check
  if (!options.forceFresh) {
    try {
      const persisted = await AsyncStorage.getItem(cacheKey);
      if (persisted) {
        const parsed = JSON.parse(persisted) as MobileDashboardBundle;
        MEMORY_CACHE.set(cacheKey, { data: parsed, timestamp: parsed.cachedAt || Date.now() });

        // Background revalidation
        refreshDashboardBundleInBackground(profileId, orgId, cacheKey);
        return { bundle: parsed, fromCache: true };
      }
    } catch {
      // Fall through to live network fetch
    }
  }

  // 3. Network Fetch: Coordinated Parallel Queries
  const liveBundle = await executeLiveDashboardFetch(profileId, orgId);

  // Store in cache
  MEMORY_CACHE.set(cacheKey, { data: liveBundle, timestamp: Date.now() });
  try {
    await AsyncStorage.setItem(cacheKey, JSON.stringify(liveBundle));
  } catch {}

  return { bundle: liveBundle, fromCache: false };
}

/**
 * Background bundle revalidation (Stale-While-Revalidate)
 */
async function refreshDashboardBundleInBackground(
  profileId: string,
  orgId?: string | null,
  cacheKey?: string
) {
  try {
    const freshBundle = await executeLiveDashboardFetch(profileId, orgId);
    if (cacheKey) {
      MEMORY_CACHE.set(cacheKey, { data: freshBundle, timestamp: Date.now() });
      await AsyncStorage.setItem(cacheKey, JSON.stringify(freshBundle));
    }
  } catch (err) {
    console.warn('Background dashboard refresh failed:', err);
  }
}

/**
 * Executes parallelized Firestore queries in a single consolidated operation
 */
async function executeLiveDashboardFetch(
  profileId: string,
  orgId?: string | null
): Promise<MobileDashboardBundle> {
  const todayStr = new Date().toISOString().split('T')[0];
  const now = new Date();
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // 1. Employee query by profile_id
  let emp: Employee | null = null;
  try {
    const qEmp = query(
      collection(db, 'employees'),
      where('profile_id', '==', profileId),
      limit(1)
    );
    const snap = await getDocs(qEmp);
    if (!snap.empty) {
      emp = { id: snap.docs[0].id, ...snap.docs[0].data() } as Employee;
    }
  } catch (e) {
    console.warn('Failed to query employee by profile_id:', e);
  }

  if (!emp) {
    return {
      employee: null,
      workplace: null,
      todayAttendance: null,
      monthRecords: [],
      monthlyStats: { percent: 100, hours: 0, daysPresent: 0, daysLate: 0 },
      leaveBalanceTotal: 0,
      defaultShift: null,
      cachedAt: Date.now(),
    };
  }

  // 2. Parallel Fetch: Workplace, Today Attendance, Month Attendance, Leave Balances, Shift
  const [wpSnap, todaySnap, monthSnap, leaveSnap, shiftSnap] = await Promise.allSettled([
    // Workplace
    emp.workplace_id ? getDoc(doc(db, 'workplaces', emp.workplace_id)) : Promise.resolve(null),
    // Today's attendance
    getDoc(doc(db, 'attendance', `${emp.id}_${todayStr}`)),
    // Month's attendance
    getDocs(query(collection(db, 'attendance'), where('employee_id', '==', emp.id))),
    // Leave balances
    getDocs(query(collection(db, 'leave_balances'), where('employee_id', '==', emp.id))),
    // Shift
    emp.default_shift_id ? getDoc(doc(db, 'shifts', emp.default_shift_id)) : Promise.resolve(null),
  ]);

  // Parse Workplace
  let workplace: Workplace | null = emp.workplace || null;
  if (wpSnap.status === 'fulfilled' && wpSnap.value && wpSnap.value.exists?.()) {
    workplace = { id: wpSnap.value.id, ...wpSnap.value.data() } as Workplace;
  }

  // Parse Today's Attendance
  let todayAttendance: Attendance | null = null;
  if (todaySnap.status === 'fulfilled' && todaySnap.value && todaySnap.value.exists?.()) {
    todayAttendance = { id: todaySnap.value.id, ...todaySnap.value.data() } as Attendance;
  }

  // Parse Month Attendance & Calculate Stats
  const monthRecords: Attendance[] = [];
  if (monthSnap.status === 'fulfilled' && monthSnap.value) {
    monthSnap.value.forEach((d) => {
      monthRecords.push({ id: d.id, ...d.data() } as Attendance);
    });
  }

  const thisMonthRecords = monthRecords.filter((r) => (r.date || '').startsWith(currentYearMonth));
  const presentCount = thisMonthRecords.filter((r) => r.status === 'present').length;
  const lateCount = thisMonthRecords.filter((r) => r.status === 'late').length;
  const presentOrLate = presentCount + lateCount;
  const totalMins = thisMonthRecords.reduce((acc, r) => acc + (r.working_minutes || 0), 0);
  const hours = Math.round((totalMins / 60) * 10) / 10;

  const currentDay = Math.max(1, now.getDate());
  let workingDaysPassed = 0;
  for (let d = 1; d <= currentDay; d++) {
    const dayOfWeek = new Date(now.getFullYear(), now.getMonth(), d).getDay();
    if (dayOfWeek !== 0) workingDaysPassed++;
  }
  const denominator = Math.max(1, workingDaysPassed);
  const percent = Math.min(100, Math.round((presentOrLate / denominator) * 100));

  // Parse Leave Balances Total
  let leaveBalanceTotal = 0;
  if (leaveSnap.status === 'fulfilled' && leaveSnap.value) {
    leaveSnap.value.forEach((d) => {
      const data = d.data() as LeaveBalance;
      leaveBalanceTotal += Number(data.remaining_days || 0);
    });
  }

  // Parse Shift
  let defaultShift: WorkShift | null = null;
  if (shiftSnap.status === 'fulfilled' && shiftSnap.value && shiftSnap.value.exists?.()) {
    defaultShift = { id: shiftSnap.value.id, ...shiftSnap.value.data() } as WorkShift;
  }

  return {
    employee: { ...emp, workplace: workplace || emp.workplace },
    workplace,
    todayAttendance,
    monthRecords,
    monthlyStats: {
      percent,
      hours,
      daysPresent: presentCount,
      daysLate: lateCount,
    },
    leaveBalanceTotal,
    defaultShift,
    cachedAt: Date.now(),
  };
}

/**
 * Invalidate mobile cache after mutation (e.g. Clock In/Out, Apply Leave)
 */
export async function invalidateMobileDashboardCache(profileId: string, orgId?: string | null) {
  const cacheKey = `${CACHE_KEY_PREFIX}dashboard_${profileId}_${orgId || 'default'}`;
  MEMORY_CACHE.delete(cacheKey);
  try {
    await AsyncStorage.removeItem(cacheKey);
  } catch {}
}
