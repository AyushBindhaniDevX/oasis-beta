import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import type { Attendance, Employee, Profile, Department, WorkShift } from '@/types';
import { exportExcel } from '@/utils/excel';

export interface LateIncidentRecord {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  avatarUrl?: string | null;
  department: string;
  designation: string;
  date: string;
  shiftName: string;
  shiftStart: string;
  actualPunchIn: string;
  lateMinutes: number;
  monthOccurrence: number; // 1st, 2nd, 3rd, 4th...
  isGrace: boolean;
  lopDays: number; // 0 or 0.5
  statusBadge: string;
}

export interface EmployeeLateSummary {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  designation: string;
  totalLateDays: number;
  graceUsedDays: number;
  lopPenaltyDays: number;
  totalLateMinutes: number;
  lateDates: string[];
}

export interface LateComersOverviewData {
  mode: 'daily' | 'monthly';
  targetDate?: string;
  periodLabel: string;
  summary: {
    totalLatePunches: number;
    uniqueStaffCount: number;
    withinGraceCount: number;
    lopPenaltiesCount: number;
    totalLopDaysDeducted: number;
    totalLateMinutes: number;
  };
  incidents: LateIncidentRecord[];
  employeeSummaries: EmployeeLateSummary[];
}

export interface GetLateComersOverviewOptions {
  mode?: 'daily' | 'monthly';
  date?: string; // "YYYY-MM-DD" for daily mode
  month?: number; // 1 - 12
  year?: number;
  search?: string;
}

/**
 * Robust parser for clock-in time and shift start times.
 * Handles ISO timestamps, local date strings, "HH:MM", "HH:MM:SS", and "HH:MM AM/PM".
 */
export function parseTimeString(timeStr?: string | null): { hours: number; minutes: number; formatted: string } | null {
  if (!timeStr) return null;

  // If it's an ISO timestamp or date string (e.g. 2026-10-31T09:25:00.000Z)
  if (timeStr.includes('T') || (timeStr.includes('-') && timeStr.includes(':'))) {
    const d = new Date(timeStr);
    if (!isNaN(d.getTime())) {
      const hours = d.getHours();
      const minutes = d.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const dispHours = hours % 12 || 12;
      const formatted = `${String(dispHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${ampm}`;
      return { hours, minutes, formatted };
    }
  }

  // If it's "HH:MM" or "HH:MM:SS" or "HH:MM AM/PM"
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const meridian = match[4]?.toUpperCase();
    if (meridian === 'PM' && hours < 12) hours += 12;
    if (meridian === 'AM' && hours === 12) hours = 0;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const dispHours = hours % 12 || 12;
    const formatted = `${String(dispHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${ampm}`;
    return { hours, minutes, formatted };
  }

  return null;
}

/**
 * Checks if an employee or attendance record matches the targeted organization
 */
function isOrgMatch(emp: Employee | undefined, att: Attendance, orgId?: string): boolean {
  if (!orgId || orgId === 'all') return true;

  // Direct attendance check
  const attOrg = (att as any).organization_id;
  if (attOrg) {
    if (attOrg === orgId) return true;
    if (orgId === 'shanti-memorial-hospital' && attOrg === 'smh') return true;
    if (orgId === 'smh' && attOrg === 'shanti-memorial-hospital') return true;
    if (orgId === 'subedge_org' && attOrg === 'subedge') return true;
  }

  if (!emp) return false;

  return (
    emp.organization_id === orgId ||
    emp.profile?.organization_id === orgId ||
    emp.workplace?.organization_id === orgId ||
    emp.department?.organization_id === orgId ||
    (orgId === 'shanti-memorial-hospital' && (emp.organization_id === 'smh' || emp.profile?.organization_id === 'smh')) ||
    (orgId === 'smh' && (emp.organization_id === 'shanti-memorial-hospital' || emp.profile?.organization_id === 'shanti-memorial-hospital')) ||
    (orgId === 'subedge_org' && (emp.organization_id === 'subedge' || emp.profile?.organization_id === 'subedge'))
  );
}

/**
 * Hospital policy for Shanti Memorial Hospital & Standard Multi-Tenant HRMS:
 * - 1st to 3rd late coming in a month: Covered under Grace Period (0 LOP)
 * - 4th late coming onwards in a month: 0.5 Day Loss of Pay (LOP) penalty per occurrence
 *
 * Supports both:
 * - Daily View (mode: 'daily', date: 'YYYY-MM-DD'): Shows late arrivals on that specific day with cumulative monthly occurrence context
 * - Monthly View (mode: 'monthly', month, year): Shows all late occurrences and staff summaries across the entire month
 */
export async function getLateComersOverview(
  orgId?: string,
  options?: GetLateComersOverviewOptions
): Promise<LateComersOverviewData> {
  const mode = options?.mode || (options?.date ? 'daily' : 'monthly');

  // Determine target date and target month
  const now = new Date();
  let targetDateStr = options?.date;
  let targetYear = options?.year || now.getFullYear();
  let targetMonth = options?.month || now.getMonth() + 1;

  if (targetDateStr) {
    const parts = targetDateStr.split('-');
    if (parts.length >= 2) {
      targetYear = parseInt(parts[0], 10);
      targetMonth = parseInt(parts[1], 10);
    }
  } else if (mode === 'daily') {
    // Default daily mode to today's date
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    targetDateStr = `${y}-${m}-${d}`;
    targetYear = y;
    targetMonth = now.getMonth() + 1;
  }

  const monthPrefix = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  let periodLabel = `${monthNames[targetMonth - 1]} ${targetYear}`;
  if (mode === 'daily' && targetDateStr) {
    try {
      const parsedDate = new Date(`${targetDateStr}T00:00:00`);
      periodLabel = parsedDate.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      periodLabel = targetDateStr;
    }
  }

  try {
    const [attSnap, empsSnap, profsSnap, deptsSnap, shiftsSnap, empShiftsSnap] = await Promise.all([
      getDocs(collection(db, 'attendance')),
      getDocs(collection(db, 'employees')),
      getDocs(collection(db, 'profiles')),
      getDocs(collection(db, 'departments')),
      getDocs(collection(db, 'shifts')).catch(() => getDocs(collection(db, 'work_shifts'))),
      getDocs(collection(db, 'employee_shifts')).catch(() => ({ docs: [] } as any)),
    ]);

    const profMap = new Map<string, Profile>();
    profsSnap.forEach((d) => profMap.set(d.id, { id: d.id, ...d.data() } as Profile));

    const deptMap = new Map<string, Department>();
    deptsSnap.forEach((d) => deptMap.set(d.id, { id: d.id, ...d.data() } as Department));

    const shiftMap = new Map<string, WorkShift>();
    shiftsSnap.forEach((d) => shiftMap.set(d.id, { id: d.id, ...d.data() } as WorkShift));

    // Employee shift overrides by `${employeeId}_${date}`
    const empShiftScheduleMap = new Map<string, string>();
    empShiftsSnap.forEach((d: any) => {
      const data = d.data();
      if (data?.employee_id && data?.date && data?.shift_id) {
        empShiftScheduleMap.set(`${data.employee_id}_${data.date}`, data.shift_id);
      }
    });

    const empMap = new Map<string, Employee>();
    empsSnap.forEach((d) => {
      const emp = { id: d.id, ...d.data() } as Employee;
      emp.profile = emp.profile_id ? profMap.get(emp.profile_id) : undefined;
      emp.department = emp.department_id ? deptMap.get(emp.department_id) : undefined;
      empMap.set(d.id, emp);
      // Also map by profile_id for resilient lookup if attendance references profile id
      if (emp.profile_id) {
        empMap.set(emp.profile_id, emp);
      }
    });

    // Filter attendance for the target month & organization
    const rawLateRecords: Array<{
      att: Attendance;
      emp: Employee;
      shift: WorkShift | null;
      shiftStartTimeStr: string;
      punchInTimeStr: string;
      lateMinutes: number;
    }> = [];

    attSnap.forEach((d) => {
      const att = { id: d.id, ...d.data() } as Attendance;
      const emp = empMap.get(att.employee_id);

      if (!isOrgMatch(emp, att, orgId)) {
        return;
      }

      // Check if matches targeted month (we need all month records to compute monthly cumulative occurrences)
      if (att.date && !att.date.startsWith(monthPrefix)) {
        return;
      }

      // Find applicable shift
      const scheduleShiftId = emp ? empShiftScheduleMap.get(`${emp.id}_${att.date}`) : null;
      const targetShiftId = scheduleShiftId || (att as any).shift_id || emp?.default_shift_id;
      const shift = targetShiftId ? shiftMap.get(targetShiftId) || null : null;

      const shiftStartStr = shift?.start_time || '09:00';
      const parsedShiftStart = parseTimeString(shiftStartStr) || { hours: 9, minutes: 0, formatted: '09:00 AM' };
      const shiftStartMinutes = parsedShiftStart.hours * 60 + parsedShiftStart.minutes;

      // Parse actual clock in
      let punchInTimeStr = '09:15 AM';
      let punchInMinutes = shiftStartMinutes + 15;
      let hasClockIn = false;

      if (att.clock_in) {
        const parsedPunch = parseTimeString(att.clock_in);
        if (parsedPunch) {
          punchInTimeStr = parsedPunch.formatted;
          punchInMinutes = parsedPunch.hours * 60 + parsedPunch.minutes;
          hasClockIn = true;
        }
      }

      // Determine if late
      // Standard grace: 15 minutes after shift start time
      const delayMinutes = hasClockIn ? punchInMinutes - shiftStartMinutes : 0;
      let isLate = att.status === 'late';

      if (!isLate && hasClockIn) {
        // If punch was after shift start + 15 mins grace
        if (delayMinutes > 15) {
          isLate = true;
        }
      }

      if (isLate && emp) {
        const effectiveLateMinutes = Math.max(delayMinutes > 0 ? delayMinutes : 15, 10);
        rawLateRecords.push({
          att,
          emp,
          shift,
          shiftStartTimeStr: parsedShiftStart.formatted,
          punchInTimeStr,
          lateMinutes: effectiveLateMinutes,
        });
      }
    });

    // Sort by date ascending to accurately calculate cumulative monthly occurrence per employee
    rawLateRecords.sort((a, b) => (a.att.date || '').localeCompare(b.att.date || ''));

    const employeeOccurrenceTracker = new Map<string, number>();
    const employeeSummaryTracker = new Map<string, EmployeeLateSummary>();

    const allIncidents: LateIncidentRecord[] = [];

    for (const item of rawLateRecords) {
      const { att, emp, shift, shiftStartTimeStr, punchInTimeStr, lateMinutes } = item;

      const currentCount = (employeeOccurrenceTracker.get(emp.id) || 0) + 1;
      employeeOccurrenceTracker.set(emp.id, currentCount);

      const isGrace = currentCount <= 3;
      const lopDays = isGrace ? 0 : 0.5;

      const statusBadge = isGrace
        ? `Grace Allowed (${currentCount}/3)`
        : `0.5 Day LOP Penalty (${currentCount}th)`;

      allIncidents.push({
        id: att.id,
        employeeId: emp.id,
        employeeCode: emp.employee_code || 'EMP-000',
        employeeName: emp.profile?.full_name || 'Staff Member',
        avatarUrl: emp.profile?.avatar_url || null,
        department: emp.department?.name || 'General Operations',
        designation: emp.designation || 'Staff',
        date: att.date,
        shiftName: shift?.name || 'General Day Shift',
        shiftStart: shiftStartTimeStr,
        actualPunchIn: punchInTimeStr,
        lateMinutes,
        monthOccurrence: currentCount,
        isGrace,
        lopDays,
        statusBadge,
      });

      // Update consolidated employee monthly summary
      const existingSummary = employeeSummaryTracker.get(emp.id) || {
        employeeId: emp.id,
        employeeCode: emp.employee_code || 'EMP-000',
        employeeName: emp.profile?.full_name || 'Staff Member',
        department: emp.department?.name || 'General Operations',
        designation: emp.designation || 'Staff',
        totalLateDays: 0,
        graceUsedDays: 0,
        lopPenaltyDays: 0,
        totalLateMinutes: 0,
        lateDates: [],
      };

      existingSummary.totalLateDays += 1;
      if (isGrace) {
        existingSummary.graceUsedDays += 1;
      } else {
        existingSummary.lopPenaltyDays += 0.5;
      }
      existingSummary.totalLateMinutes += lateMinutes;
      existingSummary.lateDates.push(att.date);

      employeeSummaryTracker.set(emp.id, existingSummary);
    }

    // Filter incidents based on mode
    let targetIncidents: LateIncidentRecord[] = [];
    if (mode === 'daily' && targetDateStr) {
      targetIncidents = allIncidents.filter((inc) => inc.date === targetDateStr);
    } else {
      targetIncidents = [...allIncidents];
    }

    // Incidents reverse-chronological by date/punch for display
    targetIncidents.sort((a, b) => b.date.localeCompare(a.date));

    const employeeSummaries = Array.from(employeeSummaryTracker.values());
    employeeSummaries.sort((a, b) => b.totalLateDays - a.totalLateDays);

    // Calculate aggregated metrics
    const totalLatePunches = targetIncidents.length;
    const uniqueStaffIds = new Set(targetIncidents.map((i) => i.employeeId));
    const uniqueStaffCount = uniqueStaffIds.size;
    const withinGraceCount = targetIncidents.filter((i) => i.isGrace).length;
    const lopPenaltiesCount = targetIncidents.filter((i) => !i.isGrace).length;
    const totalLopDaysDeducted = lopPenaltiesCount * 0.5;
    const totalLateMinutes = targetIncidents.reduce((acc, i) => acc + i.lateMinutes, 0);

    return {
      mode,
      targetDate: targetDateStr,
      periodLabel,
      summary: {
        totalLatePunches,
        uniqueStaffCount,
        withinGraceCount,
        lopPenaltiesCount,
        totalLopDaysDeducted,
        totalLateMinutes,
      },
      incidents: targetIncidents,
      employeeSummaries,
    };
  } catch (err) {
    console.error('getLateComersOverview error:', err);
    return {
      mode,
      targetDate: targetDateStr,
      periodLabel,
      summary: {
        totalLatePunches: 0,
        uniqueStaffCount: 0,
        withinGraceCount: 0,
        lopPenaltiesCount: 0,
        totalLopDaysDeducted: 0,
        totalLateMinutes: 0,
      },
      incidents: [],
      employeeSummaries: [],
    };
  }
}

/**
 * Export late comers overview data to Excel
 */
export async function exportLateComersToExcel(
  data: LateComersOverviewData,
  mode: 'daily' | 'incidents' | 'summary' = 'incidents'
): Promise<void> {
  const isDaily = mode === 'daily' || data.mode === 'daily';

  if (isDaily || mode === 'incidents') {
    const headers = [
      'Sl. No',
      'Employee Code',
      'Employee Name',
      'Department',
      'Designation',
      'Date',
      'Shift Name',
      'Scheduled Start',
      'Actual Punch In',
      'Late Delay (Mins)',
      'Monthly Occurrence',
      'Hospital Policy Status',
      'LOP Penalty (Days)',
    ];

    const rows = data.incidents.map((inc, idx) => [
      idx + 1,
      inc.employeeCode,
      inc.employeeName,
      inc.department,
      inc.designation,
      inc.date,
      inc.shiftName,
      inc.shiftStart,
      inc.actualPunchIn,
      inc.lateMinutes,
      `${inc.monthOccurrence} occurrence`,
      inc.statusBadge,
      inc.lopDays,
    ]);

    const titlePrefix = isDaily ? `Daily_Late_Comers_${data.targetDate || 'Report'}` : `Late_Punches_Log_${data.periodLabel.replace(/\s+/g, '_')}`;

    await exportExcel(titlePrefix, [
      { name: isDaily ? 'Daily Late Comers' : 'Late Incidents', headers, rows },
    ]);
  } else {
    const headers = [
      'Sl. No',
      'Employee Code',
      'Employee Name',
      'Department',
      'Designation',
      'Total Late Days',
      'Grace Used (<=3)',
      'Penalty Days (>3)',
      'Total LOP Deducted',
      'Total Late Minutes',
      'Incident Dates',
    ];

    const rows = data.employeeSummaries.map((emp, idx) => [
      idx + 1,
      emp.employeeCode,
      emp.employeeName,
      emp.department,
      emp.designation,
      emp.totalLateDays,
      emp.graceUsedDays,
      Math.max(0, emp.totalLateDays - 3),
      emp.lopPenaltyDays,
      emp.totalLateMinutes,
      emp.lateDates.join(', '),
    ]);

    await exportExcel(`Staff_Late_Summary_${data.periodLabel.replace(/\s+/g, '_')}`, [
      { name: 'Staff Late Summary', headers, rows },
    ]);
  }
}
