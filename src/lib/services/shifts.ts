/**
 * Shifts & Roster Scheduling Service (Cloud Firestore)
 * Oasis HRMS Multi-Tenant Platform
 */

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
} from 'firebase/firestore';
import { WorkShift, EmployeeShift } from '@/types/database';

export const DEFAULT_SHIFTS: Omit<WorkShift, 'id' | 'created_at'>[] = [];

export async function getShifts(organizationId?: string): Promise<WorkShift[]> {
  try {
    const snap = await getDocs(collection(db, 'shifts'));
    const shifts: WorkShift[] = [];
    snap.forEach((d) => {
      const s = { id: d.id, ...d.data() } as WorkShift;
      if (!organizationId || s.organization_id === organizationId || (organizationId === 'shanti-memorial-hospital' && s.organization_id === 'smh')) {
        shifts.push(s);
      }
    });

    shifts.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return shifts;
  } catch (err) {
    console.error('Error querying shifts:', err);
    return [];
  }
}

export async function createShift(shift: Omit<WorkShift, 'id' | 'created_at'>): Promise<WorkShift> {
  const shiftId = `shift-${Date.now()}`;
  const now = new Date().toISOString();
  const newShift: WorkShift = {
    id: shiftId,
    ...shift,
    created_at: now,
  };

  await setDoc(doc(db, 'shifts', shiftId), newShift);
  return newShift;
}

export async function updateShift(id: string, updates: Partial<WorkShift>): Promise<void> {
  await updateDoc(doc(db, 'shifts', id), updates);
}

export async function deleteShift(id: string): Promise<void> {
  await deleteDoc(doc(db, 'shifts', id));
}

export async function getRoster(
  startDate: string,
  endDate: string,
  organizationId?: string
): Promise<EmployeeShift[]> {
  try {
    const [rosterSnap, shiftsSnap] = await Promise.all([
      getDocs(collection(db, 'employee_shifts')),
      getDocs(collection(db, 'shifts')),
    ]);

    const shiftMap = new Map<string, WorkShift>();
    shiftsSnap.forEach((d) => shiftMap.set(d.id, { id: d.id, ...d.data() } as WorkShift));

    const roster: EmployeeShift[] = [];
    rosterSnap.forEach((d) => {
      const entry = { id: d.id, ...d.data() } as EmployeeShift;
      if (entry.date >= startDate && entry.date <= endDate) {
        if (!organizationId || !entry.organization_id || entry.organization_id === organizationId) {
          entry.shift = entry.shift_id && entry.shift_id !== 'OFF' ? shiftMap.get(entry.shift_id) : undefined;
          roster.push(entry);
        }
      }
    });

    return roster;
  } catch (e) {
    console.error('Error fetching roster:', e);
    return [];
  }
}

export async function getEmployeeShiftForDate(employeeId: string, date: string): Promise<WorkShift | null> {
  try {
    const id = `${employeeId}_${date}`;
    const snap = await getDoc(doc(db, 'employee_shifts', id));
    
    let targetShiftId: string | null = null;
    if (snap.exists()) {
      const empShift = snap.data() as EmployeeShift;
      if (!empShift.shift_id || empShift.shift_id === 'OFF') {
        return null; // Explicitly OFF on this date
      }
      targetShiftId = empShift.shift_id;
    } else {
      // No date override: fallback to employee default shift
      const empSnap = await getDoc(doc(db, 'employees', employeeId));
      if (empSnap.exists()) {
        const defaultShiftId = empSnap.data()?.default_shift_id;
        if (defaultShiftId && defaultShiftId !== 'OFF') {
          targetShiftId = defaultShiftId;
        }
      }
    }

    if (!targetShiftId) return null;

    const shiftSnap = await getDoc(doc(db, 'shifts', targetShiftId));
    if (!shiftSnap.exists()) return null;

    return { id: shiftSnap.id, ...shiftSnap.data() } as WorkShift;
  } catch (e) {
    console.error('Error fetching shift:', e);
    return null;
  }
}

export async function assignEmployeeShift(
  employeeId: string,
  date: string,
  shiftId: string | null,
  organizationId?: string
): Promise<void> {
  const now = new Date().toISOString();
  const id = `${employeeId}_${date}`;

  try {
    if (!shiftId) {
      // Clearing override reverts back to default shift
      await deleteDoc(doc(db, 'employee_shifts', id));
      return;
    }

    const payload: EmployeeShift = {
      id,
      employee_id: employeeId,
      date,
      shift_id: shiftId,
      organization_id: organizationId || '00000000-0000-0000-0000-000000000001',
      created_at: now,
    };

    await setDoc(doc(db, 'employee_shifts', id), payload);
  } catch (err) {
    console.error('Error assigning employee shift:', err);
  }
}
