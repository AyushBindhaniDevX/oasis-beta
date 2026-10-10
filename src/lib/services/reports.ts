import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { exportExcel, exportTxt } from '@/utils/excel';
import { Employee, Department, Attendance, LeaveRequest, Payroll, LeaveType } from '@/types';

export async function generateReport(orgId: string, reportId: string) {
  if (reportId === 'employee') {
    const qry = query(collection(db, 'employees'), where('organization_id', '==', orgId));
    const snap = await getDocs(qry);
    const rows = [];
    
    // need profiles and departments to get names
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
        emp.employee_code,
        prof?.full_name || '',
        prof?.email || '',
        prof?.phone || '',
        dept?.name || '',
        emp.designation || '',
        emp.joining_date || '',
        emp.date_of_birth || '',
        emp.basic_salary || 0,
        emp.employment_status,
        emp.tax_config?.pf_number || '',
        emp.tax_config?.uan_number || '',
        emp.tax_config?.esi_number || ''
      ]);
    });

    const headers = [
      'Employee Code', 'Full Name', 'Email', 'Phone', 'Department', 'Designation',
      'Date of Joining', 'Date of Birth', 'Basic Salary', 'Status',
      'PF Number', 'UAN Number', 'ESI Number'
    ];

    await exportExcel('Employee_Directory_Report', [{ name: 'Employees', headers, rows }]);
  } else if (reportId === 'attendance') {
    const qry = query(collection(db, 'attendance')); // ideally filter by date range
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
          lr.status,
          lr.reason || ''
        ]);
      }
    });

    const headers = ['Employee Code', 'Leave Type', 'Start Date', 'End Date', 'Days', 'Half Day', 'Status', 'Reason'];
    await exportExcel('Leave_Report', [{ name: 'Leaves', headers, rows }]);
  } else if (reportId === 'payroll') {
    const rows: any[][] = [];
    const headers = ['Employee Code', 'Basic Salary', 'Gross Salary', 'Net Salary', 'LOP Days', 'Status', 'Created At'];
    
    // Very simple implementation, fetching all payroll entries (in reality, filter by period)
    const snap = await getDocs(collection(db, 'payroll_entries'));
    
    const emps = await getDocs(query(collection(db, 'employees'), where('organization_id', '==', orgId)));
    const empMap = new Map();
    emps.forEach(d => empMap.set(d.id, d.data()));
    
    snap.forEach((d) => {
      const p = d.data() as Payroll;
      const emp = empMap.get(p.employee_id);
      if (emp) {
        rows.push([
          emp.employee_code,
          p.basic_salary,
          p.gross_salary,
          p.net_salary,
          p.lop_days,
          p.status,
          p.created_at
        ]);
      }
    });
    
    await exportExcel('Payroll_Report', [{ name: 'Payroll', headers, rows }]);
  } else {
    // Generic fallback for others
    await exportExcel(`Oasis_${reportId}_Report`, [{
      name: 'Report',
      headers: ['Message', 'Timestamp'],
      rows: [[`Real Data Not Implemented For ${reportId} yet. Check logs.`, new Date().toISOString()]]
    }]);
  }
}
