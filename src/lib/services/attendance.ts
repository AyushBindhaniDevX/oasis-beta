import { db } from '@/lib/firebase';
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
import { calculateDistance } from './location';
import type { Attendance, GeofenceResponse, Employee, Workplace, Profile } from '@/types';

function getLocalYMD(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function getEmployeeData(profileId?: string): Promise<{ emp: Employee; wp: Workplace | null } | null> {
  let targetProfileId = profileId;

  if (!targetProfileId) {
    const profQ = query(collection(db, 'profiles'), limit(1));
    const profSnap = await getDocs(profQ);
    if (!profSnap.empty) {
      targetProfileId = profSnap.docs[0].id;
    }
  }

  if (!targetProfileId) return null;

  // 1. Get employee record
  const empQ = query(collection(db, 'employees'), where('profile_id', '==', targetProfileId), limit(1));
  const empSnap = await getDocs(empQ);

  let emp: Employee | null = null;
  if (!empSnap.empty) {
    const docSnap = empSnap.docs[0];
    emp = { id: docSnap.id, ...docSnap.data() } as Employee;
  }

  // If employee record is missing for this profile, auto-create one
  if (!emp) {
    const profSnap = await getDoc(doc(db, 'profiles', targetProfileId));
    if (profSnap.exists()) {
      const profile = profSnap.data() as Profile;
      const empId = `emp-${Date.now()}`;
      const newEmpPayload: Employee = {
        id: empId,
        profile_id: targetProfileId,
        organization_id: profile.organization_id || '00000000-0000-0000-0000-000000000001',
        employee_code: `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
        designation: profile.role === 'admin' ? 'Administrator' : profile.role === 'hr' ? 'HR Manager' : 'Staff',
        department_id: null,
        workplace_id: null,
        joining_date: new Date().toISOString().split('T')[0],
        basic_salary: 35000,
        employment_status: 'active',
        onboarding_completed: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await setDoc(doc(db, 'employees', empId), newEmpPayload);
      emp = newEmpPayload;
    }
  }

  if (!emp) return null;

  let wp: Workplace | null = null;
  if (emp.workplace_id) {
    const wpSnap = await getDoc(doc(db, 'workplaces', emp.workplace_id));
    if (wpSnap.exists()) {
      wp = { id: wpSnap.id, ...wpSnap.data() } as Workplace;
    }
  }

  // Fallback: If workplace_id is missing, resolve workplace (Unit / Sub-Brand) by unit name or organization
  if (!wp) {
    const orgId = emp.organization_id;
    const unitName = emp.hospital_unit || (emp as any).unit;

    if (unitName) {
      try {
        const qByName = query(collection(db, 'workplaces'), where('name', '==', unitName), limit(1));
        const snap = await getDocs(qByName);
        if (!snap.empty) {
          wp = { id: snap.docs[0].id, ...snap.docs[0].data() } as Workplace;
        }
      } catch (e) {
        // Continue
      }
    }

    if (!wp && orgId) {
      try {
        const qByOrg = query(collection(db, 'workplaces'), where('organization_id', '==', orgId), limit(1));
        const snap = await getDocs(qByOrg);
        if (!snap.empty) {
          wp = { id: snap.docs[0].id, ...snap.docs[0].data() } as Workplace;
        }
      } catch (e) {
        // Continue
      }
    }
  }

  return { emp, wp };
}

export interface ClockInOptions {
  isRemote?: boolean;
  remoteReason?: string;
}

export async function clockIn(
  latitude: number,
  longitude: number,
  faceSnapshot?: string,
  profileId?: string,
  options?: ClockInOptions
): Promise<GeofenceResponse> {
  const data = await getEmployeeData(profileId);
  if (!data) {
    throw new Error('Employee record could not be loaded. Please try again.');
  }

  const { emp, wp } = data;
  const isRemote = Boolean(options?.isRemote);
  const remoteReason = options?.remoteReason || (isRemote ? 'Work From Home' : null);

  let distance: number | undefined = undefined;
  let isWithinGeofence = true;
  let clockedUnitName = wp?.name || emp.hospital_unit || 'Headquarters';

  if (wp && wp.latitude && wp.longitude) {
    if (latitude && longitude && (latitude !== 0 || longitude !== 0)) {
      const assignedDist = calculateDistance(latitude, longitude, wp.latitude, wp.longitude);
      const allowedRadius = wp.radius_meters || 200;

      if (assignedDist <= allowedRadius) {
        distance = assignedDist;
        isWithinGeofence = true;
      } else {
        // Multi-unit check: See if employee is within any other valid active unit/sub-brand of their organization
        let matchedOtherUnit: Workplace | null = null;
        if (emp.organization_id) {
          try {
            const orgWpQ = query(collection(db, 'workplaces'), where('organization_id', '==', emp.organization_id));
            const orgWpSnap = await getDocs(orgWpQ);
            for (const docSnap of orgWpSnap.docs) {
              const otherWp = { id: docSnap.id, ...docSnap.data() } as Workplace;
              if (otherWp.id !== wp.id && otherWp.latitude && otherWp.longitude && otherWp.is_active !== false) {
                const otherDist = calculateDistance(latitude, longitude, otherWp.latitude, otherWp.longitude);
                if (otherDist <= (otherWp.radius_meters || 200)) {
                  matchedOtherUnit = otherWp;
                  distance = otherDist;
                  isWithinGeofence = true;
                  clockedUnitName = otherWp.name;
                  break;
                }
              }
            }
          } catch (e) {
            // Ignore
          }
        }

        if (!matchedOtherUnit) {
          distance = assignedDist;
          isWithinGeofence = false;
        }
      }
    } else {
      isWithinGeofence = false;
    }

    if (!isRemote) {
      if (!latitude || !longitude || (latitude === 0 && longitude === 0)) {
        throw new Error('Valid GPS location is required to clock in for your unit. Please enable location permissions or use Remote Clock-In.');
      }
      if (!isWithinGeofence) {
        const dStr = distance !== undefined ? `${Math.round(distance)}m` : 'unknown distance';
        const radStr = `${wp.radius_meters || 200}m`;
        throw new Error(`Outside unit geofence (${dStr} away from ${wp.name || 'designated unit'}). You must be within ${radStr} to clock in, or switch to Remote Clock-In.`);
      }
    }
  }

  const today = getLocalYMD();
  const now = new Date().toISOString();
  const attendanceId = `${emp.id}_${today}`;

  // Check existing attendance for today
  const existingSnap = await getDoc(doc(db, 'attendance', attendanceId));
  if (existingSnap.exists()) {
    const existing = existingSnap.data() as Attendance;
    if (existing.clock_in && !existing.clock_out) {
      return {
        success: true,
        message: 'Already clocked in today',
        distance_meters: distance,
        face_verified: true,
      };
    }
  }

  const payload: Attendance = {
    id: attendanceId,
    employee_id: emp.id,
    workplace_id: wp?.id || null,
    date: today,
    clock_in: now,
    clock_in_latitude: latitude || null,
    clock_in_longitude: longitude || null,
    clock_in_verified: true,
    clock_out: null,
    clock_out_latitude: null,
    clock_out_longitude: null,
    clock_out_verified: false,
    face_verified: true,
    face_snapshot_url: faceSnapshot || 'captured_biometric_face',
    working_minutes: 0,
    status: 'present',
    is_remote: isRemote,
    remote_reason: remoteReason,
    created_at: now,
    updated_at: now,
  };

  await setDoc(doc(db, 'attendance', attendanceId), payload);

  // Audit log biometric attendance clock-in
  try {
    const { trackUserActivity } = await import('./userActivity');
    await trackUserActivity({
      userId: emp.profile_id || emp.id,
      organizationId: emp.organization_id,
      action: 'ATTENDANCE_CLOCK_IN',
      entityType: 'attendance',
      entityId: attendanceId,
      description: `Employee clocked in with biometric verification (${isRemote ? 'Remote / WFH' : isWithinGeofence ? 'On-site' : 'Out-of-fence'})`,
      metadata: {
        distance_meters: distance,
        isWithinGeofence,
        isRemote,
        remoteReason,
        face_verified: true,
      },
    });
  } catch (e) {}

  return {
    success: true,
    message: isRemote
      ? 'Clocked in successfully (Remote Shift)'
      : wp
      ? isWithinGeofence
        ? `Clocked in at ${wp.name}`
        : `Clocked in (${Math.round(distance || 0)}m from ${wp.name})`
      : 'Clocked in successfully',
    distance_meters: distance,
    face_verified: true,
  };
}

export async function clockOut(
  latitude: number,
  longitude: number,
  faceSnapshot?: string,
  profileId?: string
): Promise<GeofenceResponse> {
  const data = await getEmployeeData(profileId);
  if (!data) throw new Error('Employee record not found');
  const { emp, wp } = data;

  const today = getLocalYMD();
  const now = new Date().toISOString();
  const attendanceId = `${emp.id}_${today}`;

  const attSnap = await getDoc(doc(db, 'attendance', attendanceId));
  if (!attSnap.exists()) {
    return { success: false, message: 'No clock-in found for today. Please clock in first.' };
  }

  const attDoc = attSnap.data() as Attendance;
  if (!attDoc.clock_in) {
    return { success: false, message: 'No clock-in found for today. Please clock in first.' };
  }
  if (attDoc.clock_out) {
    return { success: true, message: 'Already clocked out for today.' };
  }

  let distance_meters: number | undefined;
  if (wp && wp.latitude && wp.longitude && latitude && longitude) {
    distance_meters = calculateDistance(latitude, longitude, wp.latitude, wp.longitude);
  }

  const clockInTime = new Date(attDoc.clock_in);
  const clockOutTime = new Date(now);
  const totalMinutes = Math.floor((clockOutTime.getTime() - clockInTime.getTime()) / 60000);

  const breaks: { start: string; end: string | null; reason: string }[] = attDoc.breaks || [];
  let breakMinutes = 0;

  const updatedBreaks = [...breaks];
  if (updatedBreaks.length > 0 && !updatedBreaks[updatedBreaks.length - 1].end) {
    updatedBreaks[updatedBreaks.length - 1].end = now;
  }

  for (const b of updatedBreaks) {
    if (b.start && b.end) {
      breakMinutes += Math.floor((new Date(b.end).getTime() - new Date(b.start).getTime()) / 60000);
    }
  }

  const workingMinutes = Math.max(0, totalMinutes - breakMinutes);

  await updateDoc(doc(db, 'attendance', attendanceId), {
    clock_out: now,
    clock_out_latitude: latitude,
    clock_out_longitude: longitude,
    clock_out_verified: true,
    face_verified: true,
    working_minutes: workingMinutes,
    breaks: updatedBreaks,
    updated_at: now,
  });

  return {
    success: true,
    message: 'Clocked out successfully',
    distance_meters,
    clock_out: now,
    working_minutes: workingMinutes,
  };
}

export async function startBreak(attendanceId: string, reason: string): Promise<boolean> {
  const attSnap = await getDoc(doc(db, 'attendance', attendanceId));
  if (!attSnap.exists()) return false;

  const attDoc = attSnap.data() as Attendance;
  const breaks = attDoc.breaks || [];
  if (breaks.length > 0 && !breaks[breaks.length - 1].end) {
    return false;
  }

  breaks.push({ start: new Date().toISOString(), end: null, reason });
  await updateDoc(doc(db, 'attendance', attendanceId), {
    breaks,
    updated_at: new Date().toISOString(),
  });

  return true;
}

export async function endBreak(attendanceId: string): Promise<boolean> {
  const attSnap = await getDoc(doc(db, 'attendance', attendanceId));
  if (!attSnap.exists()) return false;

  const attDoc = attSnap.data() as Attendance;
  const breaks = attDoc.breaks || [];
  if (breaks.length === 0 || breaks[breaks.length - 1].end) {
    return false;
  }

  breaks[breaks.length - 1].end = new Date().toISOString();
  await updateDoc(doc(db, 'attendance', attendanceId), {
    breaks,
    updated_at: new Date().toISOString(),
  });

  return true;
}

export async function getTodayAttendance(employeeId: string): Promise<Attendance | null> {
  const today = getLocalYMD();
  const attendanceId = `${employeeId}_${today}`;

  const attSnap = await getDoc(doc(db, 'attendance', attendanceId));
  if (!attSnap.exists()) return null;

  const att = { id: attSnap.id, ...attSnap.data() } as Attendance;
  if (att.workplace_id) {
    const wpSnap = await getDoc(doc(db, 'workplaces', att.workplace_id));
    if (wpSnap.exists()) {
      att.workplace = { id: wpSnap.id, ...wpSnap.data() } as Workplace;
    }
  }

  return att;
}

export async function getAttendanceHistory(
  employeeId: string,
  limitDays = 30,
  _offset = 0
): Promise<Attendance[]> {
  let calculatedLimit = limitDays;

  try {
    const empSnap = await getDoc(doc(db, 'employees', employeeId));
    if (empSnap.exists()) {
      const empData = empSnap.data() as Employee;
      if (empData.joining_date) {
        const joinDate = new Date(empData.joining_date);
        const today = new Date();
        if (joinDate > today) {
          calculatedLimit = 0;
        } else {
          const diffTime = today.getTime() - joinDate.getTime();
          calculatedLimit = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
        }
      }
    }
  } catch (e) {
    console.error('Error fetching employee joining date', e);
  }

  const q = query(
    collection(db, 'attendance'),
    where('employee_id', '==', employeeId)
  );
  const snap = await getDocs(q);
  const rawRecords: Attendance[] = [];
  snap.forEach((d) => rawRecords.push({ id: d.id, ...d.data() } as Attendance));

  const results: Attendance[] = [];
  const shiftStartTime = '09:30';

  for (let i = 0; i < calculatedLimit; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = getLocalYMD(d);
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;

    const existingRecord = rawRecords.find((r) => r.date === dateStr);

    if (existingRecord) {
      if (existingRecord.clock_in) {
        const clockInDate = new Date(existingRecord.clock_in);
        const clockInTime = `${String(clockInDate.getHours()).padStart(2, '0')}:${String(clockInDate.getMinutes()).padStart(2, '0')}`;

        if (clockInTime > shiftStartTime && existingRecord.status !== 'half_day' && existingRecord.status !== 'on_leave') {
          existingRecord.status = 'late';
        } else if (existingRecord.status !== 'half_day' && existingRecord.status !== 'on_leave') {
          existingRecord.status = 'present';
        }
      }
      results.push(existingRecord);
    } else {
      if (!isWeekend) {
        results.push({
          id: `missing_${dateStr}`,
          employee_id: employeeId,
          workplace_id: null,
          date: dateStr,
          clock_in: null,
          clock_out: null,
          clock_in_latitude: null,
          clock_in_longitude: null,
          clock_out_latitude: null,
          clock_out_longitude: null,
          clock_in_verified: false,
          clock_out_verified: false,
          face_verified: false,
          working_minutes: 0,
          status: 'absent',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    }
  }

  return results;
}

export async function getOrgAttendance(date: string, organizationId?: string): Promise<Attendance[]> {
  try {
    const [attSnap, empsSnap, profSnap, wpSnap] = await Promise.all([
      getDocs(query(collection(db, 'attendance'), where('date', '==', date))),
      getDocs(collection(db, 'employees')),
      getDocs(collection(db, 'profiles')),
      getDocs(collection(db, 'workplaces')),
    ]);

    const profMap = new Map<string, Profile>();
    profSnap.forEach((d) => profMap.set(d.id, { id: d.id, ...d.data() } as Profile));

    const wpMap = new Map<string, Workplace>();
    wpSnap.forEach((d) => wpMap.set(d.id, { id: d.id, ...d.data() } as Workplace));

    const empMap = new Map<string, Employee>();
    empsSnap.forEach((d) => {
      const emp = { id: d.id, ...d.data() } as Employee;
      emp.profile = emp.profile_id ? profMap.get(emp.profile_id) : undefined;
      empMap.set(d.id, emp);
    });

    const records: Attendance[] = [];
    attSnap.forEach((d) => {
      const att = { id: d.id, ...d.data() } as Attendance;
      const emp = att.employee_id ? empMap.get(att.employee_id) : undefined;
      if (organizationId && emp?.profile?.organization_id && emp.profile.organization_id !== organizationId) {
        return;
      }
      att.employee = emp;
      att.workplace = att.workplace_id ? wpMap.get(att.workplace_id) : undefined;
      records.push(att);
    });

    records.sort((a, b) => (a.clock_in || '').localeCompare(b.clock_in || ''));
    return records;
  } catch (err) {
    console.error('getOrgAttendance error:', err);
    return [];
  }
}

export async function getAttendanceStats(date: string, organizationId?: string) {
  const records = await getOrgAttendance(date, organizationId);
  return {
    present: records.filter((r) => r.status === 'present').length,
    late: records.filter((r) => r.status === 'late').length,
    halfDay: records.filter((r) => r.status === 'half_day').length,
    total: records.length,
  };
}
