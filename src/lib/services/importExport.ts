import { db } from '@/lib/firebase';
import { collection, writeBatch, doc, getDoc, getDocs, query, where, setDoc } from 'firebase/firestore';
import { exportExcel, importExcelObjects } from '@/utils/excel';
import { Employee, Department, LeaveType } from '@/types';

export const IMPORT_MODULES = [
  { id: 'employees', name: 'Employees' },
  { id: 'departments', name: 'Departments' },
  { id: 'leave_types', name: 'Leave Types' },
  { id: 'attendance', name: 'Attendance Records' }
];

export async function downloadTemplate(moduleId: string) {
  if (moduleId === 'employees') {
    const instructions = [
      ['Instructions for Employee Import'],
      [''],
      ['Column', 'Required', 'Data Type', 'Description/Valid Values'],
      ['Employee Code', 'Yes', 'Text', 'Unique identifier (e.g. EMP001)'],
      ['Full Name', 'Yes', 'Text', 'First and Last name'],
      ['Email', 'Yes', 'Text', 'Unique valid email address'],
      ['Phone', 'No', 'Text', 'Phone number'],
      ['Department', 'No', 'Text', 'Name of existing department'],
      ['Designation', 'No', 'Text', 'Job title'],
      ['Date of Joining', 'Yes', 'Date', 'Format: DD/MM/YYYY'],
      ['Date of Birth', 'No', 'Date', 'Format: DD/MM/YYYY'],
      ['Basic Salary', 'Yes', 'Number', 'Monthly basic salary in digits'],
      ['ESI Number', 'No', 'Text', '10-digit ESI Insurance Number'],
      ['UAN Number', 'No', 'Text', '12-digit PF UAN'],
      ['PF Number', 'No', 'Text', 'PF Account Number']
    ];
    const headers = [
      'Employee Code', 'Full Name', 'Email', 'Phone', 'Department', 'Designation',
      'Date of Joining', 'Date of Birth', 'Basic Salary', 'ESI Number', 'UAN Number', 'PF Number'
    ];
    const rows = [
      ['EMP001', 'John Doe', 'john@example.com', '9876543210', 'Engineering', 'Software Engineer', '01/01/2026', '15/05/1990', 50000, '1234567890', '100000000000', 'MH/BAN/12345']
    ];
    await exportExcel('Employee_Import_Template', [
      { name: 'Instructions', rows: instructions },
      { name: 'Import Data', headers, rows }
    ]);
  } else if (moduleId === 'departments') {
    const instructions = [
      ['Instructions for Department Import'],
      [''],
      ['Column', 'Required', 'Data Type', 'Description/Valid Values'],
      ['Department Name', 'Yes', 'Text', 'Name of the department'],
      ['Description', 'No', 'Text', 'Brief description']
    ];
    const headers = ['Department Name', 'Description'];
    const rows = [['Engineering', 'Software Development Team']];
    await exportExcel('Department_Import_Template', [
      { name: 'Instructions', rows: instructions },
      { name: 'Import Data', headers, rows }
    ]);
  } else if (moduleId === 'leave_types') {
    const instructions = [
      ['Instructions for Leave Types Import'],
      [''],
      ['Column', 'Required', 'Data Type', 'Description/Valid Values'],
      ['Leave Name', 'Yes', 'Text', 'Name of the leave (e.g. Sick Leave)'],
      ['Annual Days', 'Yes', 'Number', 'Total allocated days per year'],
      ['Is Paid', 'Yes', 'Boolean', 'TRUE or FALSE'],
      ['Description', 'No', 'Text', 'Brief description']
    ];
    const headers = ['Leave Name', 'Annual Days', 'Is Paid', 'Description'];
    const rows = [['Sick Leave', 12, 'TRUE', 'Medical emergencies']];
    await exportExcel('LeaveTypes_Import_Template', [
      { name: 'Instructions', rows: instructions },
      { name: 'Import Data', headers, rows }
    ]);
  } else if (moduleId === 'attendance') {
    const instructions = [
      ['Instructions for Attendance Import'],
      [''],
      ['Column', 'Required', 'Data Type', 'Description/Valid Values'],
      ['Employee Code', 'Yes', 'Text', 'Existing employee ID'],
      ['Date', 'Yes', 'Date', 'Format: YYYY-MM-DD'],
      ['Clock In', 'No', 'Time', 'Format: HH:MM:SS or ISO string'],
      ['Clock Out', 'No', 'Time', 'Format: HH:MM:SS or ISO string'],
      ['Status', 'Yes', 'Text', 'present, absent, half_day, late, on_leave']
    ];
    const headers = ['Employee Code', 'Date', 'Clock In', 'Clock Out', 'Status'];
    const rows = [['EMP001', '2026-10-01', '09:00:00', '18:00:00', 'present']];
    await exportExcel('Attendance_Import_Template', [
      { name: 'Instructions', rows: instructions },
      { name: 'Import Data', headers, rows }
    ]);
  }
}

export async function processImport(orgId: string, moduleId: string, sheets: Record<string, any[]>): Promise<any> {
  const data = sheets['Import Data'] || sheets['Sheet1'] || Object.values(sheets)[0];
  if (!data || data.length === 0) {
    throw new Error('No data found in the import file. Make sure you use the "Import Data" sheet.');
  }

  let successCount = 0;
  let failedCount = 0;
  let duplicates = 0;
  let skipped = 0;
  const errors: { row: number; error: string }[] = [];

  const batch = writeBatch(db);
  let opCount = 0;

  const commitBatch = async () => {
    if (opCount > 0) {
      await batch.commit();
      opCount = 0;
    }
  };

  if (moduleId === 'employees') {
    // Basic implementation for employees
    const deptSnap = await getDocs(query(collection(db, 'departments'), where('organization_id', '==', orgId)));
    const deptMap = new Map<string, string>();
    deptSnap.forEach(d => deptMap.set(d.data().name.toLowerCase(), d.id));

    let rowIdx = 2; // header is row 1
    for (const row of data) {
      const code = row['Employee Code'];
      const name = row['Full Name'];
      const email = row['Email'];
      
      // Skip sample row
      if (email === 'john@example.com' && code === 'EMP001' && rowIdx === 2) {
        skipped++;
        rowIdx++;
        continue;
      }

      if (!code || !name || !email) {
        errors.push({ row: rowIdx, error: 'Missing required fields (Code, Name, or Email)' });
        failedCount++;
        rowIdx++;
        continue;
      }

      try {
        const empRef = doc(collection(db, 'employees'));
        const deptId = row['Department'] ? deptMap.get(String(row['Department']).toLowerCase()) || null : null;
        
        const newEmp = {
          id: empRef.id,
          organization_id: orgId,
          profile_id: empRef.id,
          employee_code: String(code),
          department_id: deptId,
          designation: row['Designation'] ? String(row['Designation']) : null,
          joining_date: row['Date of Joining'] ? String(row['Date of Joining']) : null,
          date_of_birth: row['Date of Birth'] ? String(row['Date of Birth']) : null,
          basic_salary: Number(row['Basic Salary']) || 0,
          employment_status: 'active',
          onboarding_completed: true,
          tax_config: {
            esi_number: row['ESI Number'] ? String(row['ESI Number']) : null,
            uan_number: row['UAN Number'] ? String(row['UAN Number']) : null,
            pf_number: row['PF Number'] ? String(row['PF Number']) : null,
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        batch.set(empRef, newEmp);
        
        // Create matching profile
        const profileRef = doc(db, 'profiles', empRef.id);
        batch.set(profileRef, {
          id: empRef.id,
          organization_id: orgId,
          full_name: name,
          email: String(email).toLowerCase(),
          role: 'employee',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        opCount += 2;
        successCount++;
        
        if (opCount > 450) {
          await batch.commit();
          opCount = 0;
        }
      } catch (err: any) {
        errors.push({ row: rowIdx, error: err.message });
        failedCount++;
      }
      rowIdx++;
    }
  } else if (moduleId === 'departments') {
    let rowIdx = 2;
    for (const row of data) {
      const name = row['Department Name'];
      if (name === 'Engineering' && rowIdx === 2) {
        skipped++;
        rowIdx++;
        continue;
      }
      if (!name) {
        errors.push({ row: rowIdx, error: 'Missing Department Name' });
        failedCount++;
        rowIdx++;
        continue;
      }

      const deptRef = doc(collection(db, 'departments'));
      batch.set(deptRef, {
        id: deptRef.id,
        organization_id: orgId,
        name: String(name),
        description: row['Description'] ? String(row['Description']) : null,
        created_at: new Date().toISOString(),
      });
      opCount++;
      successCount++;
      if (opCount > 450) {
        await batch.commit();
        opCount = 0;
      }
      rowIdx++;
    }
  } else if (moduleId === 'leave_types') {
    let rowIdx = 2;
    for (const row of data) {
      const name = row['Leave Name'];
      if (name === 'Sick Leave' && rowIdx === 2) {
        skipped++;
        rowIdx++;
        continue;
      }
      if (!name) {
        errors.push({ row: rowIdx, error: 'Missing Leave Name' });
        failedCount++;
        rowIdx++;
        continue;
      }

      const ltRef = doc(collection(db, 'leave_types'));
      batch.set(ltRef, {
        id: ltRef.id,
        organization_id: orgId,
        name: String(name),
        annual_days: Number(row['Annual Days']) || 0,
        is_paid: String(row['Is Paid']).toUpperCase() === 'TRUE',
        description: row['Description'] ? String(row['Description']) : null,
        created_at: new Date().toISOString(),
      });
      opCount++;
      successCount++;
      if (opCount > 450) {
        await batch.commit();
        opCount = 0;
      }
      rowIdx++;
    }
  }
  
  await commitBatch();

  return {
    total: data.length,
    success: successCount,
    failed: failedCount,
    skipped: skipped,
    duplicates: duplicates,
    errors: errors
  };
}
