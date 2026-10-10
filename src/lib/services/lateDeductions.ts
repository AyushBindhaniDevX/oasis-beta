import { db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, query, where, setDoc, updateDoc } from 'firebase/firestore';
import { LateAttendanceDeduction, Attendance, Organization } from '@/types';
import { getOrgAttendance } from './attendance';

export async function detectLateAttendance(orgId: string, month: number, year: number): Promise<void> {
  const orgSnap = await getDoc(doc(db, 'organizations', orgId));
  const orgData = orgSnap.exists() ? orgSnap.data() as Organization : null;
  const settings = orgData?.settings || {};
  
  // Default values
  const lateThresholdMinutes = Number(settings.lateThresholdMinutes) || 15;
  const consecutiveDaysLimit = Number(settings.consecutiveLateDays) || 3;
  const deductionAmount = Number(settings.lateDeductionAmount) || 500;
  
  // Fetch attendance for the month
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  const allAttRecords: Attendance[] = [];
  
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const records = await getOrgAttendance(dateStr, orgId);
    allAttRecords.push(...records);
  }
  
  // Group by employee
  const byEmployee: Record<string, Attendance[]> = {};
  for (const r of allAttRecords) {
    if (r.employee_id && (r.status === 'late' || r.status === 'present')) {
      if (!byEmployee[r.employee_id]) byEmployee[r.employee_id] = [];
      byEmployee[r.employee_id].push(r);
    }
  }

  // Find consecutive lates
  for (const empId of Object.keys(byEmployee)) {
    const empRecords = byEmployee[empId].sort((a, b) => a.date.localeCompare(b.date));
    let consecutiveCount = 0;
    const lateDates: string[] = [];
    
    for (const r of empRecords) {
      if (r.status === 'late') {
        consecutiveCount++;
        lateDates.push(r.date);
        
        if (consecutiveCount >= consecutiveDaysLimit) {
          // Trigger a deduction request
          await createLateDeductionRequest(orgId, empId, `${month}_${year}`, consecutiveCount, [...lateDates], deductionAmount);
          consecutiveCount = 0;
          lateDates.length = 0; // reset
        }
      } else if (r.status === 'present') {
        // Reset if they were on time
        consecutiveCount = 0;
        lateDates.length = 0;
      }
    }
  }
}

async function createLateDeductionRequest(orgId: string, employeeId: string, periodId: string, days: number, dates: string[], amount: number) {
  // Check if it already exists for these dates
  const dedId = `${employeeId}_${periodId}_${dates[dates.length - 1]}`;
  const existSnap = await getDoc(doc(db, 'late_deductions', dedId));
  
  if (existSnap.exists()) return;
  
  const payload: LateAttendanceDeduction = {
    id: dedId,
    organization_id: orgId,
    employee_id: employeeId,
    payroll_period_id: periodId,
    consecutive_days: days,
    late_dates: dates,
    amount: amount,
    status: 'pending',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  await setDoc(doc(db, 'late_deductions', dedId), payload);
}

export async function approveLateDeduction(dedId: string, approverId: string) {
  const docRef = doc(db, 'late_deductions', dedId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) throw new Error('Deduction not found');
  
  await updateDoc(docRef, {
    status: 'approved',
    updated_at: new Date().toISOString()
  });
  
  // In a real flow, this would automatically be added to the custom payroll items
  // during payroll calculation.
}
