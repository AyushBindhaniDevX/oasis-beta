import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import type { Attendance, Employee, Profile, Department, WorkShift, LeaveRequest } from '@/types';
import { exportExcel } from '@/utils/excel';

export type ExceptionType = 'late' | 'absent';

export interface AttendanceIncidentRecord {
  id: string;
  type: ExceptionType; // 'late' or 'absent'
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  avatarUrl?: string | null;
  department: string;
  designation: string;
  date: string;
  shiftName: string;
  shiftStart: string;
  actualPunchIn: string; // "09:25 AM" or "No Clock-In"
  lateMinutes: number; // minutes delay for late, 0 for absent
  monthOccurrence: number; // 1st, 2nd, 3rd occurrence
  isGrace: boolean; // true for late occurrences <= 3
  lopDays: number; // 0, 0.5 (late > 3), or 1.0 (absent)
  statusBadge: string;
}

// Backward compatibility alias
export type LateIncidentRecord = AttendanceIncidentRecord;

export interface EmployeeAttendanceSummary {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  avatarUrl?: string | null;
  department: string;
  designation: string;
  totalLateDays: number;
  totalAbsentDays: number;
  graceUsedDays: number;
  lopPenaltyDays: number; // 0.5 * late penalties + 1.0 * absent
  totalLateMinutes: number;
  lateDates: string[];
  absentDates: string[];
}

// Backward compatibility alias
export type EmployeeLateSummary = EmployeeAttendanceSummary;

export interface LateComersOverviewData {
  mode: 'daily' | 'monthly';
  targetDate?: string;
  periodLabel: string;
  summary: {
    totalExceptions: number;
    totalLatePunches: number;
    totalAbsences: number;
    uniqueStaffCount: number;
    withinGraceCount: number;
    lopPenaltiesCount: number;
    totalLopDaysDeducted: number;
    totalLateMinutes: number;
  };
  incidents: AttendanceIncidentRecord[];
  employeeSummaries: EmployeeAttendanceSummary[];
}

export interface GetLateComersOverviewOptions {
  mode?: 'daily' | 'monthly';
  date?: string; // "YYYY-MM-DD" for daily mode
  month?: number; // 1 - 12
  year?: number;
  search?: string;
  filterType?: 'all' | 'late' | 'absent';
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
function isOrgMatch(emp: Employee | undefined, att?: Attendance | null, orgId?: string): boolean {
  if (!orgId || orgId === 'all') return true;

  if (att) {
    const attOrg = (att as any).organization_id;
    if (attOrg) {
      if (attOrg === orgId) return true;
      if (orgId === 'shanti-memorial-hospital' && attOrg === 'smh') return true;
      if (orgId === 'smh' && attOrg === 'shanti-memorial-hospital') return true;
      if (orgId === 'subedge_org' && attOrg === 'subedge') return true;
    }
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
 * Unified Late and Absent Attendance Exceptions Service:
 * - Tracks Late Punches:
 *   - 1st to 3rd late coming in a month: Covered under Grace Period (0 LOP)
 *   - 4th late coming onwards in a month: 0.5 Day Loss of Pay (LOP) penalty per occurrence
 * - Tracks Absent Staff:
 *   - Unexcused missing punch or marked absent: 1.0 Day Loss of Pay (LOP) per absence
 * - Supports both:
 *   - Daily View (mode: 'daily', date: 'YYYY-MM-DD'): Shows all Late & Absent staff on that date
 *   - Monthly View (mode: 'monthly', month, year): Shows cumulative monthly exceptions and consolidated staff summaries
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
    const [attSnap, empsSnap, profsSnap, deptsSnap, shiftsSnap, empShiftsSnap, leavesSnap] = await Promise.all([
      getDocs(collection(db, 'attendance')),
      getDocs(collection(db, 'employees')),
      getDocs(collection(db, 'profiles')),
      getDocs(collection(db, 'departments')),
      getDocs(collection(db, 'shifts')).catch(() => getDocs(collection(db, 'work_shifts'))),
      getDocs(collection(db, 'employee_shifts')).catch(() => ({ docs: [] } as any)),
      getDocs(collection(db, 'leave_requests')).catch(() => ({ docs: [] } as any)),
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

    // Approved leaves index per employee
    const approvedLeaves: Array<{ employeeId: string; startDate: string; endDate: string }> = [];
    leavesSnap.forEach((d: any) => {
      const data = d.data();
      if (data?.status === 'approved' && data?.start_date && data?.end_date) {
        approvedLeaves.push({
          employeeId: data.employee_id,
          startDate: data.start_date,
          endDate: data.end_date,
        });
      }
    });

    const isEmployeeOnApprovedLeave = (empId: string, date: string): boolean => {
      return approvedLeaves.some(
        (l) => l.employeeId === empId && date >= l.startDate && date <= l.endDate
      );
    };

    const empMap = new Map<string, Employee>();
    const activeOrgEmployees: Employee[] = [];

    empsSnap.forEach((d) => {
      const emp = { id: d.id, ...d.data() } as Employee;
      emp.profile = emp.profile_id ? profMap.get(emp.profile_id) : undefined;
      emp.department = emp.department_id ? deptMap.get(emp.department_id) : undefined;
      empMap.set(d.id, emp);
      if (emp.profile_id) {
        empMap.set(emp.profile_id, emp);
      }
      if (isOrgMatch(emp, null, orgId) && emp.employment_status !== 'terminated') {
        activeOrgEmployees.push(emp);
      }
    });

    // Group attendances for the target month by `${employeeId}_${date}`
    const attByEmpAndDate = new Map<string, Attendance>();
    const monthAttendances: Attendance[] = [];

    attSnap.forEach((d) => {
      const att = { id: d.id, ...d.data() } as Attendance;
      const emp = empMap.get(att.employee_id);

      if (!isOrgMatch(emp, att, orgId)) {
        return;
      }

      if (att.date && att.date.startsWith(monthPrefix)) {
        monthAttendances.push(att);
        if (emp) {
          attByEmpAndDate.set(`${emp.id}_${att.date}`, att);
        }
      }
    });

    // Sort month attendances by date ascending to calculate chronological monthly occurrences
    monthAttendances.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    // Track cumulative occurrences and monthly summaries per employee
    const lateOccurrenceTracker = new Map<string, number>();
    const absentOccurrenceTracker = new Map<string, number>();
    const employeeSummaryTracker = new Map<string, EmployeeAttendanceSummary>();

    const getOrCreateSummary = (emp: Employee): EmployeeAttendanceSummary => {
      let summary = employeeSummaryTracker.get(emp.id);
      if (!summary) {
        summary = {
          employeeId: emp.id,
          employeeCode: emp.employee_code || 'EMP-000',
          employeeName: emp.profile?.full_name || 'Staff Member',
          avatarUrl: emp.profile?.avatar_url || null,
          department: emp.department?.name || 'General Operations',
          designation: emp.designation || 'Staff',
          totalLateDays: 0,
          totalAbsentDays: 0,
          graceUsedDays: 0,
          lopPenaltyDays: 0,
          totalLateMinutes: 0,
          lateDates: [],
          absentDates: [],
        };
        employeeSummaryTracker.set(emp.id, summary);
      }
      return summary;
    };

    const allIncidents: AttendanceIncidentRecord[] = [];

    // 1. Process all existing month attendance records (both late and absent)
    for (const att of monthAttendances) {
      const emp = empMap.get(att.employee_id);
      if (!emp) continue;

      const scheduleShiftId = empShiftScheduleMap.get(`${emp.id}_${att.date}`);
      const targetShiftId = scheduleShiftId || (att as any).shift_id || emp?.default_shift_id;
      const shift = targetShiftId ? shiftMap.get(targetShiftId) || null : null;

      const shiftStartStr = shift?.start_time || '09:00';
      const parsedShiftStart = parseTimeString(shiftStartStr) || { hours: 9, minutes: 0, formatted: '09:00 AM' };
      const shiftStartMinutes = parsedShiftStart.hours * 60 + parsedShiftStart.minutes;

      let punchInTimeStr = 'No Clock-In';
      let punchInMinutes = 0;
      let hasClockIn = false;

      if (att.clock_in) {
        const parsedPunch = parseTimeString(att.clock_in);
        if (parsedPunch) {
          punchInTimeStr = parsedPunch.formatted;
          punchInMinutes = parsedPunch.hours * 60 + parsedPunch.minutes;
          hasClockIn = true;
        }
      }

      // Determine exception type
      const delayMinutes = hasClockIn ? punchInMinutes - shiftStartMinutes : 0;
      let isLate = att.status === 'late';
      let isAbsent = att.status === 'absent';

      if (!isLate && !isAbsent && hasClockIn) {
        if (delayMinutes > 15) {
          isLate = true;
        }
      }

      if (isLate) {
        const currentCount = (lateOccurrenceTracker.get(emp.id) || 0) + 1;
        lateOccurrenceTracker.set(emp.id, currentCount);

        const isGrace = currentCount <= 3;
        const lopDays = isGrace ? 0 : 0.5;
        const effectiveLateMinutes = Math.max(delayMinutes > 0 ? delayMinutes : 15, 10);

        const statusBadge = isGrace
          ? `Grace Allowed (${currentCount}/3)`
          : `0.5 Day LOP Penalty (${currentCount}th)`;

        allIncidents.push({
          id: att.id,
          type: 'late',
          employeeId: emp.id,
          employeeCode: emp.employee_code || 'EMP-000',
          employeeName: emp.profile?.full_name || 'Staff Member',
          avatarUrl: emp.profile?.avatar_url || null,
          department: emp.department?.name || 'General Operations',
          designation: emp.designation || 'Staff',
          date: att.date,
          shiftName: shift?.name || 'General Day Shift',
          shiftStart: parsedShiftStart.formatted,
          actualPunchIn: punchInTimeStr,
          lateMinutes: effectiveLateMinutes,
          monthOccurrence: currentCount,
          isGrace,
          lopDays,
          statusBadge,
        });

        const empSum = getOrCreateSummary(emp);
        empSum.totalLateDays += 1;
        if (isGrace) {
          empSum.graceUsedDays += 1;
        } else {
          empSum.lopPenaltyDays += 0.5;
        }
        empSum.totalLateMinutes += effectiveLateMinutes;
        empSum.lateDates.push(att.date);
      } else if (isAbsent) {
        const currentCount = (absentOccurrenceTracker.get(emp.id) || 0) + 1;
        absentOccurrenceTracker.set(emp.id, currentCount);

        allIncidents.push({
          id: att.id,
          type: 'absent',
          employeeId: emp.id,
          employeeCode: emp.employee_code || 'EMP-000',
          employeeName: emp.profile?.full_name || 'Staff Member',
          avatarUrl: emp.profile?.avatar_url || null,
          department: emp.department?.name || 'General Operations',
          designation: emp.designation || 'Staff',
          date: att.date,
          shiftName: shift?.name || 'General Day Shift',
          shiftStart: parsedShiftStart.formatted,
          actualPunchIn: 'No Clock-In (Absent)',
          lateMinutes: 0,
          monthOccurrence: currentCount,
          isGrace: false,
          lopDays: 1.0,
          statusBadge: '1.0 Day LOP Penalty',
        });

        const empSum = getOrCreateSummary(emp);
        empSum.totalAbsentDays += 1;
        empSum.lopPenaltyDays += 1.0;
        empSum.absentDates.push(att.date);
      }
    }

    // 2. For Daily View: Also identify scheduled active staff who have NO punch-in on targetDate
    if (mode === 'daily' && targetDateStr) {
      for (const emp of activeOrgEmployees) {
        const hasExisting = attByEmpAndDate.has(`${emp.id}_${targetDateStr}`);
        if (!hasExisting) {
          // Check if employee is on scheduled OFF
          const scheduleShiftId = empShiftScheduleMap.get(`${emp.id}_${targetDateStr}`);
          if (scheduleShiftId === 'OFF') continue;

          // Check if employee is on approved leave
          if (isEmployeeOnApprovedLeave(emp.id, targetDateStr)) continue;

          const targetShiftId = scheduleShiftId || emp.default_shift_id;
          const shift = targetShiftId ? shiftMap.get(targetShiftId) || null : null;
          const shiftStartStr = shift?.start_time || '09:00';
          const parsedShiftStart = parseTimeString(shiftStartStr) || { hours: 9, minutes: 0, formatted: '09:00 AM' };

          const currentCount = (absentOccurrenceTracker.get(emp.id) || 0) + 1;
          absentOccurrenceTracker.set(emp.id, currentCount);

          allIncidents.push({
            id: `missing_${emp.id}_${targetDateStr}`,
            type: 'absent',
            employeeId: emp.id,
            employeeCode: emp.employee_code || 'EMP-000',
            employeeName: emp.profile?.full_name || 'Staff Member',
            avatarUrl: emp.profile?.avatar_url || null,
            department: emp.department?.name || 'General Operations',
            designation: emp.designation || 'Staff',
            date: targetDateStr,
            shiftName: shift?.name || 'General Day Shift',
            shiftStart: parsedShiftStart.formatted,
            actualPunchIn: 'No Clock-In (Absent)',
            lateMinutes: 0,
            monthOccurrence: currentCount,
            isGrace: false,
            lopDays: 1.0,
            statusBadge: '1.0 Day LOP Penalty',
          });

          const empSum = getOrCreateSummary(emp);
          empSum.totalAbsentDays += 1;
          empSum.lopPenaltyDays += 1.0;
          empSum.absentDates.push(targetDateStr);
        }
      }
    }

    // Filter incidents based on mode & targetDate
    let targetIncidents: AttendanceIncidentRecord[] = [];
    if (mode === 'daily' && targetDateStr) {
      targetIncidents = allIncidents.filter((inc) => inc.date === targetDateStr);
    } else {
      targetIncidents = [...allIncidents];
    }

    // Sort: Late & Absent combined, reverse chronological
    targetIncidents.sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      // Sort Absences and higher LOP first
      return b.lopDays - a.lopDays;
    });

    const employeeSummaries = Array.from(employeeSummaryTracker.values());
    employeeSummaries.sort((a, b) => b.lopPenaltyDays - a.lopPenaltyDays || b.totalLateDays - a.totalLateDays);

    // Compute metrics
    const totalLatePunches = targetIncidents.filter((i) => i.type === 'late').length;
    const totalAbsences = targetIncidents.filter((i) => i.type === 'absent').length;
    const totalExceptions = targetIncidents.length;
    const uniqueStaffIds = new Set(targetIncidents.map((i) => i.employeeId));
    const uniqueStaffCount = uniqueStaffIds.size;
    const withinGraceCount = targetIncidents.filter((i) => i.isGrace).length;
    const lopPenaltiesCount = targetIncidents.filter((i) => i.lopDays > 0).length;
    const totalLopDaysDeducted = targetIncidents.reduce((acc, i) => acc + i.lopDays, 0);
    const totalLateMinutes = targetIncidents.reduce((acc, i) => acc + i.lateMinutes, 0);

    return {
      mode,
      targetDate: targetDateStr,
      periodLabel,
      summary: {
        totalExceptions,
        totalLatePunches,
        totalAbsences,
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
        totalExceptions: 0,
        totalLatePunches: 0,
        totalAbsences: 0,
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
 * Export attendance exceptions (late and absent) overview data to Excel
 */
export async function exportLateComersToExcel(
  data: LateComersOverviewData,
  mode: 'daily' | 'incidents' | 'summary' = 'incidents'
): Promise<void> {
  const isDaily = mode === 'daily' || data.mode === 'daily';

  if (isDaily || mode === 'incidents') {
    const headers = [
      'Sl. No',
      'Exception Type',
      'Employee Code',
      'Employee Name',
      'Department',
      'Designation',
      'Date',
      'Assigned Shift',
      'Scheduled Start',
      'Actual Punch In',
      'Late Delay (Mins)',
      'Month Occurrence',
      'Policy Impact Status',
      'LOP Penalty (Days)',
    ];

    const rows = data.incidents.map((inc, idx) => [
      idx + 1,
      inc.type.toUpperCase(),
      inc.employeeCode,
      inc.employeeName,
      inc.department,
      inc.designation,
      inc.date,
      inc.shiftName,
      inc.shiftStart,
      inc.actualPunchIn,
      inc.type === 'late' ? inc.lateMinutes : '-',
      `${inc.monthOccurrence} time`,
      inc.statusBadge,
      inc.lopDays,
    ]);

    const titlePrefix = isDaily
      ? `Attendance_Exceptions_Daily_${data.targetDate || 'Report'}`
      : `Attendance_Exceptions_Monthly_${data.periodLabel.replace(/\s+/g, '_')}`;

    await exportExcel(titlePrefix, [
      { name: isDaily ? 'Daily Exceptions' : 'Monthly Exceptions', headers, rows },
    ]);
  } else {
    const headers = [
      'Sl. No',
      'Employee Code',
      'Employee Name',
      'Department',
      'Designation',
      'Late Days',
      'Absent Days',
      'Grace Used (<=3)',
      'Total LOP Penalty (Days)',
      'Total Delay Minutes',
      'Late Dates',
      'Absent Dates',
    ];

    const rows = data.employeeSummaries.map((emp, idx) => [
      idx + 1,
      emp.employeeCode,
      emp.employeeName,
      emp.department,
      emp.designation,
      emp.totalLateDays,
      emp.totalAbsentDays,
      emp.graceUsedDays,
      emp.lopPenaltyDays,
      emp.totalLateMinutes,
      emp.lateDates.join(', '),
      emp.absentDates.join(', '),
    ]);

    await exportExcel(`Staff_Attendance_Exceptions_Summary_${data.periodLabel.replace(/\s+/g, '_')}`, [
      { name: 'Staff Summary', headers, rows },
    ]);
  }
}
