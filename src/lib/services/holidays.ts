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
} from 'firebase/firestore';
import type { Holiday, HolidayType } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCAL_HOLIDAYS_STORAGE_KEY = 'oasis_custom_holidays_v1';

export const DEFAULT_HOLIDAYS = [
  { name: "New Year's Day", date_suffix: '-01-01', type: 'public' as HolidayType, description: 'Global New Year Holiday' },
  { name: 'Republic Day', date_suffix: '-01-26', type: 'public' as HolidayType, description: 'National Republic Day' },
  { name: 'Maha Shivratri', date_suffix: '-02-15', type: 'optional' as HolidayType, description: 'Cultural Festival' },
  { name: 'Holi (Festival of Colors)', date_suffix: '-03-04', type: 'public' as HolidayType, description: 'National Spring Festival' },
  { name: 'Good Friday', date_suffix: '-04-03', type: 'public' as HolidayType, description: 'Christian Holiday' },
  { name: 'Eid al-Fitr', date_suffix: '-03-21', type: 'public' as HolidayType, description: 'Islamic Festival' },
  { name: 'May Day / Labor Day', date_suffix: '-05-01', type: 'company' as HolidayType, description: 'International Workers Day' },
  { name: 'Independence Day', date_suffix: '-08-15', type: 'public' as HolidayType, description: 'National Independence Day' },
  { name: 'Raksha Bandhan', date_suffix: '-08-28', type: 'optional' as HolidayType, description: 'Cultural Celebration' },
  { name: 'Gandhi Jayanti', date_suffix: '-10-02', type: 'public' as HolidayType, description: 'National Holiday' },
  { name: 'Dussehra (Vijayadashami)', date_suffix: '-10-20', type: 'public' as HolidayType, description: 'Victory of Good over Evil' },
  { name: 'Diwali (Deepavali)', date_suffix: '-11-08', type: 'public' as HolidayType, description: 'Festival of Lights' },
  { name: 'Guru Nanak Jayanti', date_suffix: '-11-24', type: 'optional' as HolidayType, description: 'Sikh Festival' },
  { name: 'Christmas Day', date_suffix: '-12-25', type: 'public' as HolidayType, description: 'Christmas Celebration' },
];

async function getLocalCustomHolidays(): Promise<Holiday[]> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_HOLIDAYS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveLocalCustomHolidays(holidays: Holiday[]): Promise<void> {
  try {
    await AsyncStorage.setItem(LOCAL_HOLIDAYS_STORAGE_KEY, JSON.stringify(holidays));
  } catch {}
}

export async function getHolidays(organizationId?: string, year?: number): Promise<Holiday[]> {
  const currentYear = year ?? new Date().getFullYear();
  const startOfYear = `${currentYear}-01-01`;
  const endOfYear = `${currentYear}-12-31`;

  try {
    const snap = await getDocs(collection(db, 'holidays'));
    const allHolidays: Holiday[] = [];
    snap.forEach((d) => {
      const h = { id: d.id, ...d.data() } as Holiday;
      if (h.date >= startOfYear && h.date <= endOfYear) {
        if (organizationId) {
          if (h.organization_id === organizationId || (organizationId === 'shanti-memorial-hospital' && h.organization_id === 'smh')) {
            allHolidays.push(h);
          }
        } else {
          allHolidays.push(h);
        }
      }
    });

    if (allHolidays.length > 0) {
      allHolidays.sort((a, b) => a.date.localeCompare(b.date));
      return allHolidays;
    }
  } catch (err) {
    if ((err as any)?.code !== 'permission-denied') { console.warn('Error querying Firestore holidays:', err); }
  }

  return await getFallbackHolidays(organizationId, currentYear);
}

export async function seedDefaultHolidays(organizationId?: string, year?: number): Promise<Holiday[]> {
  const targetYear = year ?? new Date().getFullYear();
  const orgId = organizationId || '00000000-0000-0000-0000-000000000001';

  const seeded: Holiday[] = [];
  for (let i = 0; i < DEFAULT_HOLIDAYS.length; i++) {
    const h = DEFAULT_HOLIDAYS[i];
    const holId = `hol_${targetYear}_${i + 1}`;
    const holData: Holiday = {
      id: holId,
      organization_id: orgId,
      name: h.name,
      date: `${targetYear}${h.date_suffix}`,
      type: h.type,
      description: h.description,
      is_recurring: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await setDoc(doc(db, 'holidays', holId), holData);
    seeded.push(holData);
  }

  seeded.sort((a, b) => a.date.localeCompare(b.date));
  return seeded;
}

async function getFallbackHolidays(organizationId?: string, year?: number): Promise<Holiday[]> {
  const targetYear = year ?? new Date().getFullYear();
  const defaults: Holiday[] = DEFAULT_HOLIDAYS.map((h, idx) => ({
    id: `hol_${targetYear}_${idx + 1}`,
    organization_id: organizationId || '00000000-0000-0000-0000-000000000001',
    name: h.name,
    date: `${targetYear}${h.date_suffix}`,
    type: h.type,
    description: h.description,
    is_recurring: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const localCustom = await getLocalCustomHolidays();
  const localThisYear = localCustom.filter((h) => h.date.startsWith(`${targetYear}`));

  const all = [...defaults, ...localThisYear];
  all.sort((a, b) => a.date.localeCompare(b.date));
  return all;
}

export async function createHoliday(holiday: {
  organization_id?: string | null;
  name: string;
  date: string;
  type: HolidayType;
  description?: string | null;
  is_recurring?: boolean;
}): Promise<Holiday> {
  const now = new Date().toISOString();
  const holId = `hol_custom_${Date.now()}`;
  const orgId = holiday.organization_id || '00000000-0000-0000-0000-000000000001';

  const newEntry: Holiday = {
    id: holId,
    organization_id: orgId,
    name: holiday.name.trim(),
    date: holiday.date,
    type: holiday.type,
    description: holiday.description?.trim() || null,
    is_recurring: holiday.is_recurring ?? false,
    created_at: now,
    updated_at: now,
  };

  try {
    await setDoc(doc(db, 'holidays', holId), newEntry);
    return newEntry;
  } catch (err) {
    console.warn('Firestore createHoliday fallback to local storage:', err);
  }

  const current = await getLocalCustomHolidays();
  const updated = [...current, newEntry];
  await saveLocalCustomHolidays(updated);
  return newEntry;
}

export async function updateHoliday(id: string, updates: Partial<Holiday>): Promise<Holiday> {
  const now = new Date().toISOString();

  try {
    await updateDoc(doc(db, 'holidays', id), {
      ...updates,
      updated_at: now,
    });
    const snap = await getDoc(doc(db, 'holidays', id));
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as Holiday;
    }
  } catch (err) {
    console.warn('Firestore updateHoliday fallback to local:', err);
  }

  const current = await getLocalCustomHolidays();
  const idx = current.findIndex((h) => h.id === id);
  if (idx >= 0) {
    const updatedObj = { ...current[idx], ...updates, updated_at: now };
    current[idx] = updatedObj;
    await saveLocalCustomHolidays(current);
    return updatedObj;
  }

  return {
    id,
    organization_id: '',
    name: updates.name || 'Holiday',
    date: updates.date || now.split('T')[0],
    type: updates.type || 'public',
    description: updates.description || null,
    created_at: now,
    updated_at: now,
  };
}

export async function deleteHoliday(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'holidays', id));
  } catch (err) {
    console.warn('Firestore deleteHoliday error:', err);
  }

  const current = await getLocalCustomHolidays();
  const filtered = current.filter((h) => h.id !== id);
  await saveLocalCustomHolidays(filtered);
}

export async function isHoliday(
  dateStr: string,
  organizationId?: string
): Promise<{ isHoliday: boolean; holiday?: Holiday }> {
  try {
    const q = query(collection(db, 'holidays'), where('date', '==', dateStr));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const match = { id: snap.docs[0].id, ...snap.docs[0].data() } as Holiday;
      return { isHoliday: true, holiday: match };
    }
  } catch {}

  // Check local defaults
  const d = dateStr.slice(5);
  const match = DEFAULT_HOLIDAYS.find((h) => h.date_suffix === `-${d}`);
  if (match) {
    return {
      isHoliday: true,
      holiday: {
        id: `hol_temp_${dateStr}`,
        organization_id: organizationId || '',
        name: match.name,
        date: dateStr,
        type: match.type,
        description: match.description,
        created_at: new Date().toISOString(),
      },
    };
  }

  const custom = await getLocalCustomHolidays();
  const customMatch = custom.find((h) => h.date === dateStr);
  if (customMatch) {
    return { isHoliday: true, holiday: customMatch };
  }

  return { isHoliday: false };
}

export async function getHolidaysForDateRange(
  startDate: string,
  endDate: string,
  organizationId?: string
): Promise<Holiday[]> {
  try {
    const snap = await getDocs(collection(db, 'holidays'));
    const range: Holiday[] = [];
    snap.forEach((d) => {
      const h = { id: d.id, ...d.data() } as Holiday;
      if (h.date >= startDate && h.date <= endDate) {
        if (!organizationId || !h.organization_id || h.organization_id === organizationId) {
          range.push(h);
        }
      }
    });

    if (range.length > 0) {
      range.sort((a, b) => a.date.localeCompare(b.date));
      return range;
    }
  } catch {}

  const startYear = parseInt(startDate.slice(0, 4), 10);
  const endYear = parseInt(endDate.slice(0, 4), 10);
  const all: Holiday[] = [];

  for (let y = startYear; y <= endYear; y++) {
    const fallback = await getFallbackHolidays(organizationId, y);
    for (const h of fallback) {
      if (h.date >= startDate && h.date <= endDate) {
        all.push(h);
      }
    }
  }

  all.sort((a, b) => a.date.localeCompare(b.date));
  return all;
}

export async function getWorkingDaysCount(
  startDate: string,
  endDate: string,
  organizationId?: string,
  isHalfDay?: boolean
): Promise<{ totalDays: number; weekendDays: number; holidayDays: number; workingDays: number; holidaysInRange: Holiday[] }> {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    return { totalDays: 0, weekendDays: 0, holidayDays: 0, workingDays: 0, holidaysInRange: [] };
  }

  const holidaysInRange = await getHolidaysForDateRange(startDate, endDate, organizationId);
  const holidayDateSet = new Set(
    holidaysInRange.filter((h) => h.type === 'public' || h.type === 'company').map((h) => h.date)
  );

  let totalDays = 0;
  let weekendDays = 0;
  let holidayDays = 0;
  let workingDays = 0;

  const current = new Date(start);
  while (current <= end) {
    totalDays++;
    const dayOfWeek = current.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const dateStr = current.toISOString().split('T')[0];

    if (isWeekend) {
      weekendDays++;
    } else if (holidayDateSet.has(dateStr)) {
      holidayDays++;
    } else {
      workingDays += isHalfDay ? 0.5 : 1;
    }

    current.setDate(current.getDate() + 1);
  }

  return { totalDays, weekendDays, holidayDays, workingDays, holidaysInRange };
}
