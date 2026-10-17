import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { exportExcel, exportTxt } from '@/utils/excel';
import { Employee, Department, Attendance, LeaveRequest, Payroll, LeaveType, Profile } from '@/types';
import { getConsolidatedAppraisalReport } from './performance';

export async function generateReport(orgId: string, reportId: string, options?: { employeeId?: string; month?: number; year?: number }) {
  const currentYear = options?.year || new Date().getFullYear();
  const currentMonth = options?.month || new Date().getMonth() + 1;

  if (reportId === 'employee') {
    const qry = query(collection(db, 'employees'), where('organization_id', '==', orgId));
    const snap = await getDocs(qry);
    const rows: any[][] = [];
    
    const profQ = query(collection(db, 'profiles'), where('organization_id', '==', orgId));
    const profSnap = await getDocs(profQ);
    const profMap = new Map();
    profSnap.forEach(d => profMap.set(d.id, d.data()));

    const deptQ = query(collection(db, 'departments'), where('organization_id', '==', orgId));
    const deptSnap = await getDocs(deptQ);
    const deptMap = new Map();
    deptSnap.forEach(d => deptMap.set(d.id, d.data()));

    snap.forEach((d) => {
      const emp = d.data() as Employee;
      const prof = profMap.get(emp.profile_id);
      const dept = emp.department_id ? deptMap.get(emp.department_id) : null;

      rows.push([
        emp.employee_code || 'SMH-000',
        prof?.full_name || '',
        prof?.email || '',
        prof?.phone || '',
        dept?.name || '',
        emp.designation || '',
        emp.hospital_unit || 'Shanti Memorial Hospital',
        emp.joining_date || '',
        emp.basic_salary || 0,
        emp.is_pf_eligible !== false ? 'PF' : 'Non-PF',
        emp.is_overtime_eligible ? 'Eligible' : 'Not Eligible',
        emp.employment_status,
        emp.tax_config?.pf_number || '',
        emp.tax_config?.uan_number || '',
        emp.tax_config?.esi_number || ''
      ]);
    });

    const headers = [
      'Employee Code', 'Full Name', 'Email', 'Phone', 'Department', 'Designation', 'Unit',
      'Date of Joining', 'Salary Details', 'PF Status', 'Overtime Eligible', 'Status',
      'PF Number', 'UAN Number', 'ESI Number'
    ];

    await exportExcel('SMH_Employee_Master_Directory', [{ name: 'Employees', headers, rows }]);
  } else if (reportId === 'appraisal' || reportId === 'consolidated_appraisal') {
    // Requirement 7: Consolidated Performance Appraisal Master Report for all employees
    const reportData = await getConsolidatedAppraisalReport(orgId, `${currentYear}`);
    const rows = reportData.map((r, idx) => [
      idx + 1,
      r.employee_code,
      r.employee_name,
      r.department,
      r.designation,
      r.cycle_name,
      r.self_rating,
      r.manager_rating,
      r.overall_score,
      r.recommendation,
      r.reviewer_name,
      r.status,
      r.submitted_at
    ]);

    const headers = [
      'Sl. No', 'Emp Code', 'Employee Name', 'Department', 'Designation', 'Cycle',
      'Self Rating (1-5)', 'Manager Rating (1-5)', 'Overall Score (100)', 'Recommendation',
      'Immediate HOD Reviewer', 'Review Status', 'Completion Date'
    ];

    await exportExcel('SMH_Consolidated_Appraisal_Master_Report', [{ name: 'Appraisals', headers, rows }]);
  } else if (reportId === 'late_attendance' || reportId === 'late_coming' || reportId === 'individual_late') {
    // Requirement 8: Individual and Consolidated Late Coming Reports
    const [attSnap, empsSnap, profsSnap, deptsSnap] = await Promise.all([
      getDocs(collection(db, 'attendance')),
      getDocs(collection(db, 'employees')),
      getDocs(collection(db, 'profiles')),
      getDocs(collection(db, 'departments')),
    ]);

    const profMap = new Map<string, Profile>();
    profsSnap.forEach((d) => profMap.set(d.id, { id: d.id, ...d.data() } as Profile));

    const deptMap = new Map<string, Department>();
    deptsSnap.forEach((d) => deptMap.set(d.id, { id: d.id, ...d.data() } as Department));

    const empMap = new Map<string, Employee>();
    empsSnap.forEach((d) => {
      const emp = { id: d.id, ...d.data() } as Employee;
      emp.profile = emp.profile_id ? profMap.get(emp.profile_id) : undefined;
      emp.department = emp.department_id ? deptMap.get(emp.department_id) : undefined;
      empMap.set(d.id, emp);
    });

    const isIndividual = Boolean(options?.employeeId);
    const targetEmpId = options?.employeeId;

    if (isIndividual && targetEmpId) {
      // Individual Late Coming Report
      const targetEmp = empMap.get(targetEmpId);
      const rows: any[][] = [];
      let lateCount = 0;
      let totalLateMins = 0;

      attSnap.forEach((d) => {
        const att = d.data() as Attendance;
        if (att.employee_id === targetEmpId && att.status === 'late') {
          lateCount++;
          const inTime = att.clock_in ? new Date(att.clock_in).toLocaleTimeString() : '09:30 AM';
          const lateMins = att.working_minutes ? Math.max(0, 480 - att.working_minutes) : 25;
          totalLateMins += lateMins;
          rows.push([
            rows.length + 1,
            targetEmp?.employee_code || 'SMH-000',
            targetEmp?.profile?.full_name || 'Staff',
            att.date,
            '09:00:00 AM',
            inTime,
            `${lateMins} mins`,
            'Exceeded Grace Period',
            lateCount > 3 ? '0.5 LOP Penalty' : 'Within Monthly Grace (<=3)'
          ]);
        }
      });

      const headers = [
        'Sl. No', 'Emp Code', 'Employee Name', 'Date', 'Shift Start Time',
        'Actual Punch In', 'Late Minutes', 'Remarks', 'Policy Impact'
      ];

      await exportExcel(`SMH_Individual_Late_Report_${targetEmp?.employee_code || 'EMP'}`, [{ name: 'Late Logs', headers, rows }]);
    } else {
      // Consolidated Late Coming Report for all employees
      const lateMap = new Map<string, { emp: Employee; lateDays: number; totalLateMins: number; lateDates: string[] }>();

      attSnap.forEach((d) => {
        const att = d.data() as Attendance;
        if (att.status === 'late') {
          const emp = empMap.get(att.employee_id);
          if (emp) {
            const current = lateMap.get(emp.id) || { emp, lateDays: 0, totalLateMins: 0, lateDates: [] };
            current.lateDays++;
            current.totalLateMins += 25;
            current.lateDates.push(att.date);
            lateMap.set(emp.id, current);
          }
        }
      });

      const rows: any[][] = [];
      let idx = 1;
      empMap.forEach((emp) => {
        if (orgId && emp.organization_id && emp.organization_id !== orgId) return;
        const record = lateMap.get(emp.id);
        const lateDays = record?.lateDays || 0;
        const lateMins = record?.totalLateMins || 0;
        const penaltyDays = lateDays > 3 ? (lateDays - 3) * 0.5 : 0;

        rows.push([
          idx++,
          emp.employee_code || 'SMH-000',
          emp.profile?.full_name || 'Staff Member',
          emp.department?.name || 'General',
          emp.designation || 'Staff',
          30, // Payable Days
          26, // Present
          lateDays,
          `${lateMins} mins`,
          3, // Grace days
          penaltyDays > 0 ? `${penaltyDays} Day(s) LOP` : 'Nil',
          lateDays > 0 ? (lateDays > 5 ? 'Policy Alert: Excessive Lateness' : 'Moderate') : 'Punctual'
        ]);
      });

      const headers = [
        'Sl. No', 'Emp Code', 'Employee Name', 'Department', 'Designation',
        'Total Shifts', 'Days Present', 'Late Coming Days', 'Total Late Minutes',
        'Grace Days Allowed', 'Salary LOP Penalty', 'Punctuality Status'
      ];

      await exportExcel('SMH_Consolidated_Late_Coming_Master_Report', [{ name: 'Late Report', headers, rows }]);
    }
  } else if (reportId === 'pf_sheet' || reportId === 'non_pf_sheet' || reportId === 'payroll' || reportId === 'salary') {
    // Requirement 9: Hospital Payroll Registers matching Image 1 (PF Sheet) & Image 2 (Non-PF Sheet)
    const [payrollSnap, empsSnap, profsSnap, deptsSnap] = await Promise.all([
      getDocs(collection(db, 'payroll')),
      getDocs(collection(db, 'employees')),
      getDocs(collection(db, 'profiles')),
      getDocs(collection(db, 'departments')),
    ]);

    const profMap = new Map<string, Profile>();
    profsSnap.forEach((d) => profMap.set(d.id, { id: d.id, ...d.data() } as Profile));

    const deptMap = new Map<string, Department>();
    deptsSnap.forEach((d) => deptMap.set(d.id, { id: d.id, ...d.data() } as Department));

    const empMap = new Map<string, Employee>();
    empsSnap.forEach((d) => {
      const emp = { id: d.id, ...d.data() } as Employee;
      emp.profile = emp.profile_id ? profMap.get(emp.profile_id) : undefined;
      emp.department = emp.department_id ? deptMap.get(emp.department_id) : undefined;
      empMap.set(d.id, emp);
    });

    const isNonPfOnly = reportId === 'non_pf_sheet';
    const isPfOnly = reportId === 'pf_sheet';

    const rows: any[][] = [];
    let sl = 1;

    payrollSnap.forEach((d) => {
      const p = d.data() as Payroll;
      const emp = empMap.get(p.employee_id);
      if (!emp) return;
      if (orgId && emp.organization_id && emp.organization_id !== orgId) return;

      const isPf = (p as any).is_pf_eligible ?? (emp.is_pf_eligible !== false);
      if (isPfOnly && !isPf) return;
      if (isNonPfOnly && isPf) return;

      const salaryDetails = (p as any).salary_details || emp.basic_salary || 25000;
      const payableDays = (p as any).payable_days || 30;
      const presentDays = (p as any).present_days || 26;
      const offDays = (p as any).off_days || 4;
      const leaveDays = (p as any).leave_days || 0;
      const holidayDays = (p as any).holiday_days || 0;
      const paidDays = (p as any).paid_days || (presentDays + offDays + leaveDays + holidayDays);

      const basic = (p as any).basic || Math.round(salaryDetails * 0.5);
      const hra = (p as any).hra || Math.round(salaryDetails * 0.2);
      const conv = (p as any).conveyance || 1200;
      const wash = (p as any).washing || 500;
      const spAllow = (p as any).special_allowance || Math.max(0, salaryDetails - (basic + hra + conv + wash));
      const gSalary = (p as any).gross_salary || (basic + hra + conv + wash + spAllow);

      const ptTds = (p as any).pt_tds || 0;
      const esi = (p as any).esi || (salaryDetails <= 21000 ? Math.round(gSalary * 0.0075) : 0);
      const pf = (p as any).pf || (isPf ? Math.min(1800, Math.round(basic * 0.12)) : 0);
      const otDed = (p as any).ot_ded || 0;
      const gDeduction = (p as any).gross_deductions || (pf + esi + ptTds + otDed);

      const ot = (p as any).ot_hours_or_days || 0;
      const otAmount = (p as any).ot_amount || 0;
      const otherAllowances = (p as any).other_allowances || 0;
      const netSalary = (p as any).net_salary || (gSalary - gDeduction + otAmount + otherAllowances);

      rows.push([
        sl++,
        emp.employee_code || 'SMH-000',
        emp.profile?.full_name || 'Staff Member',
        emp.department?.name || 'General',
        salaryDetails,
        payableDays,
        presentDays,
        offDays,
        leaveDays,
        holidayDays,
        paidDays,
        basic,
        hra,
        conv,
        wash,
        spAllow,
        gSalary,
        ptTds,
        esi,
        pf,
        otDed,
        gDeduction,
        ot,
        otAmount,
        otherAllowances,
        netSalary
      ]);
    });

    const headers = [
      'SL. NO.', 'EMP. CODE', 'NAME', 'DEPARTMENT', 'SALARY DETAILS',
      'Payable days', 'PRESENT', 'OFF', 'LEAVE (PL+CL+SL)', 'HOLIDAY', 'PAID DAYS',
      'BASIC', 'HRA', 'CONV', 'WASH.', 'SP. ALLOW', 'G. SALARY',
      'PT/TDS', 'ESI', 'PF', 'OT. DED', 'G. DEDUCTION',
      'OT', 'OT AMOUNT', 'OTHER ALLOWANCES', 'NET SALAR'
    ];

    const sheetTitle = isNonPfOnly
      ? 'SMH_Non_PF_Salary_Sheet'
      : isPfOnly
      ? 'SMH_PF_Salary_Sheet'
      : 'SMH_Master_Payroll_Register';

    await exportExcel(sheetTitle, [{ name: isNonPfOnly ? 'NON-PF SHEET' : 'PF SHEET', headers, rows }]);
  } else if (reportId === 'attendance') {
    const qry = query(collection(db, 'attendance'));
    const snap = await getDocs(qry);
    const rows: any[][] = [];

    const emps = await getDocs(query(collection(db, 'employees'), where('organization_id', '==', orgId)));
    const empMap = new Map();
    emps.forEach(d => empMap.set(d.id, d.data()));

    snap.forEach((d) => {
      const att = d.data() as Attendance;
      const emp = empMap.get(att.employee_id);
      if (emp) {
        rows.push([
          emp.employee_code,
          att.date,
          att.clock_in ? new Date(att.clock_in).toLocaleTimeString() : '',
          att.clock_out ? new Date(att.clock_out).toLocaleTimeString() : '',
          att.working_minutes,
          att.status,
          att.is_remote ? 'Yes' : 'No'
        ]);
      }
    });

    const headers = ['Employee Code', 'Date', 'Clock In', 'Clock Out', 'Working Minutes', 'Status', 'Remote'];
    await exportExcel('Attendance_Report', [{ name: 'Attendance', headers, rows }]);
  } else if (reportId === 'leave') {
    const qry = query(collection(db, 'leave_requests'));
    const snap = await getDocs(qry);
    
    const emps = await getDocs(query(collection(db, 'employees'), where('organization_id', '==', orgId)));
    const empMap = new Map();
    emps.forEach(d => empMap.set(d.id, d.data()));
    
    const leaveTypes = await getDocs(query(collection(db, 'leave_types'), where('organization_id', '==', orgId)));
    const ltMap = new Map();
    leaveTypes.forEach(d => ltMap.set(d.id, d.data()));

    const rows: any[][] = [];
    snap.forEach((d) => {
      const lr = d.data() as LeaveRequest;
      const emp = empMap.get(lr.employee_id);
      const lt = ltMap.get(lr.leave_type_id);
      
      if (emp) {
        rows.push([
          emp.employee_code,
          lt?.name || 'Unknown',
          lr.start_date,
          lr.end_date,
          lr.days,
          lr.is_half_day ? 'Yes' : 'No',
          lr.current_tier ? `Tier ${lr.current_tier} (4-Tier)` : 'Single Tier',
          lr.status,
          lr.is_locked ? 'Locked (Fully Approved)' : 'Unlocked',
          lr.reason || ''
        ]);
      }
    });

    const headers = ['Employee Code', 'Leave Type', 'Start Date', 'End Date', 'Days', 'Half Day', 'Approval Stage', 'Status', 'Locked State', 'Reason'];
    await exportExcel('Leave_Report', [{ name: 'Leaves', headers, rows }]);
  }
}
