import { db } from '@/lib/firebase';
import { collection, writeBatch, doc, getDoc, getDocs, query, where, setDoc } from 'firebase/firestore';
import { exportExcel, importExcelObjects } from '@/utils/excel';
import { Employee, Department, LeaveType, Profile } from '@/types';

export const IMPORT_MODULES = [
  { id: 'employees', name: 'Employees' },
  { id: 'departments', name: 'Departments' },
  { id: 'leave_types', name: 'Leave Types' },
  { id: 'attendance', name: 'Attendance Records' }
];

export async function downloadTemplate(moduleId: string) {
  if (moduleId === 'employees') {
    const instructions = [
      ['Instructions for Employee Import - Shanti Memorial Hospital & Chikitsa Unit'],
      [''],
      ['Column', 'Required', 'Data Type', 'Description/Valid Values'],
      ['Employee Code', 'Yes', 'Text', 'Unique identifier (e.g. SMH-1502)'],
      ['Full Name', 'Yes', 'Text', 'First and Last name'],
      ['Email', 'Yes', 'Text', 'Unique valid email address'],
      ['Phone', 'No', 'Text', '10-digit mobile number'],
      ['Department', 'No', 'Text', 'Name of department (e.g. Security & Safety, Nursing, Pharmacy)'],
      ['Designation', 'No', 'Text', 'Job title'],
      ['Hospital Unit', 'No', 'Text', 'Shanti Memorial Hospital OR Chikitsa Unit of Shanti Memorial Hospital'],
      ['Date of Joining', 'Yes', 'Date', 'Format: YYYY-MM-DD or DD/MM/YYYY'],
      ['Date of Birth', 'No', 'Date', 'Format: YYYY-MM-DD or DD/MM/YYYY'],
      ['Basic Salary', 'Yes', 'Number', 'Monthly gross/basic salary in digits'],
      ['PF Eligible', 'No', 'Text', 'YES (PF sheet covered) or NO (Consultant / Non-PF)'],
      ['Overtime Eligible', 'No', 'Text', 'YES (Eligible after 8hr shift) or NO'],
      ['L1 Manager', 'No', 'Text', 'L1 Immediate Supervisor (Employee Code, e.g. SMH-023, or Email)'],
      ['L2 Manager', 'No', 'Text', 'L2 Department Head / HOD (Employee Code or Email)'],
      ['L3 Manager', 'No', 'Text', 'L3 HR Manager / Operations Head (Employee Code or Email)'],
      ['L4 Manager', 'No', 'Text', 'L4 Director / Medical Superintendent / Admin (Employee Code or Email)'],
      ['ESI Number', 'No', 'Text', '10-digit ESI Insurance Number (for Gross <= 21,000)'],
      ['UAN Number', 'No', 'Text', '12-digit EPFO Universal Account Number'],
      ['PF Number', 'No', 'Text', 'EPFO Member ID (e.g. OR/CTC/1502)']
    ];
    const headers = [
      'Employee Code', 'Full Name', 'Email', 'Phone', 'Department', 'Designation', 'Hospital Unit',
      'Date of Joining', 'Date of Birth', 'Basic Salary', 'PF Eligible', 'Overtime Eligible',
      'L1 Manager', 'L2 Manager', 'L3 Manager', 'L4 Manager',
      'ESI Number', 'UAN Number', 'PF Number'
    ];
    const rows = [
      ['SMH-1502', 'Abhiram Hatua', 'abhiram.hatua@shantimemorial.in', '9861015021', 'Security & Safety', 'Security Guard', 'Shanti Memorial Hospital', '2021-04-01', '1988-05-15', 13000, 'YES', 'YES', 'SMH-023', 'SMH-1021', 'SMH-HR', 'SMH-DIR', '2100015021', '101502100001', 'OR/CTC/1502'],
      ['SMH-023', 'Ajay Swain', 'ajay.swain@shantimemorial.in', '9861002301', 'Housekeeping & Support', 'Hospital Attendant', 'Shanti Memorial Hospital', '2019-06-15', '1992-10-20', 12000, 'YES', 'NO', 'SMH-1021', '', 'SMH-HR', 'SMH-DIR', '2100002301', '100023100002', 'OR/CTC/0023'],
      ['SMH-1021', 'Abhijit Chakrabarty', 'abhijit.c@shantimemorial.in', '9861010211', 'Medical Consulting & Surgery', 'Consultant Surgeon', 'Chikitsa Unit of Shanti Memorial Hospital', '2018-01-01', '1978-06-25', 29000, 'NO', 'YES', '', '', 'SMH-HR', 'SMH-DIR', '', '', '']
    ];
    await exportExcel('SMH_Employee_Import_Template', [
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
    // Load departments, existing employees, and profiles to resolve lookups
    const [deptSnap, allEmpsSnap, allProfsSnap] = await Promise.all([
      getDocs(query(collection(db, 'departments'), where('organization_id', '==', orgId))),
      getDocs(collection(db, 'employees')),
      getDocs(collection(db, 'profiles')),
    ]);

    const deptMap = new Map<string, string>();
    deptSnap.forEach(d => deptMap.set(d.data().name.toLowerCase(), d.id));

    const profMap = new Map<string, Profile>();
    allProfsSnap.forEach(d => profMap.set(d.id, { id: d.id, ...d.data() } as Profile));

    // Lookup map to resolve Manager Code, Email, or Name to employee.id
    const empLookup = new Map<string, string>();
    allEmpsSnap.forEach(d => {
      const empData = d.data() as Employee;
      const prof = empData.profile_id ? profMap.get(empData.profile_id) : undefined;
      const empId = d.id;
      if (empData.employee_code) empLookup.set(empData.employee_code.toLowerCase().trim(), empId);
      if (prof?.email) empLookup.set(prof.email.toLowerCase().trim(), empId);
      if (prof?.full_name) empLookup.set(prof.full_name.toLowerCase().trim(), empId);
      empLookup.set(empId.toLowerCase().trim(), empId);
    });

    const resolveMgrId = (val: any): string | null => {
      if (!val) return null;
      const s = String(val).trim().toLowerCase();
      return empLookup.get(s) || null;
    };

    let rowIdx = 2; // header is row 1
    for (const row of data) {
      const code = row['Employee Code'];
      const name = row['Full Name'];
      const email = row['Email'];
      
      // Skip sample row
      if ((email === 'john@example.com' || email === 'abhiram.hatua@shantimemorial.in') && rowIdx === 2) {
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
        
        const pfEligible = row['PF Eligible'] !== undefined 
          ? String(row['PF Eligible']).trim().toUpperCase() !== 'NO' 
          : true;
        const otEligible = row['Overtime Eligible'] !== undefined 
          ? String(row['Overtime Eligible']).trim().toUpperCase() === 'YES' 
          : false;
        const hospitalUnit = row['Hospital Unit'] 
          ? String(row['Hospital Unit']).trim() 
          : 'Shanti Memorial Hospital';

        // Resolve 4-Tier Managers
        const l1Val = row['L1 Manager'] || row['L1 Manager Code'] || row['Reporting Manager'] || row['Manager'];
        const l2Val = row['L2 Manager'] || row['L2 Manager Code'] || row['HOD'] || row['Department Head'];
        const l3Val = row['L3 Manager'] || row['L3 Manager Code'] || row['HR Manager'] || row['HR Head'];
        const l4Val = row['L4 Manager'] || row['L4 Manager Code'] || row['Director'] || row['Medical Superintendent'] || row['Admin'];

        const l1Id = resolveMgrId(l1Val);
        const l2Id = resolveMgrId(l2Val);
        const l3Id = resolveMgrId(l3Val);
        const l4Id = resolveMgrId(l4Val);

        const newEmp = {
          id: empRef.id,
          organization_id: orgId,
          profile_id: empRef.id,
          employee_code: String(code),
          department_id: deptId,
          manager_id: l1Id || null,
          l1_manager_id: l1Id || null,
          l2_manager_id: l2Id || null,
          l3_manager_id: l3Id || null,
          l4_manager_id: l4Id || null,
          designation: row['Designation'] ? String(row['Designation']) : null,
          hospital_unit: hospitalUnit,
          joining_date: row['Date of Joining'] ? String(row['Date of Joining']) : null,
          date_of_birth: row['Date of Birth'] ? String(row['Date of Birth']) : null,
          basic_salary: Number(row['Basic Salary']) || 0,
          is_pf_eligible: pfEligible,
          is_overtime_eligible: otEligible,
          employment_status: 'active',
          employment_type: pfEligible ? 'full_time' : 'contract',
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

        // Register new employee in local lookup map so subsequent rows can link to them
        empLookup.set(String(code).toLowerCase().trim(), empRef.id);
        empLookup.set(String(email).toLowerCase().trim(), empRef.id);
        empLookup.set(String(name).toLowerCase().trim(), empRef.id);
        
        // Create matching profile
        const profileRef = doc(db, 'profiles', empRef.id);
        batch.set(profileRef, {
          id: empRef.id,
          organization_id: orgId,
          full_name: name,
          email: String(email).toLowerCase(),
          phone: row['Phone'] ? String(row['Phone']) : undefined,
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
  } else if (moduleId === 'attendance') {
    let rowIdx = 2;
    for (const row of data) {
      const empCode = row['Employee Code'];
      const date = row['Date'];
      const status = row['Status'];
      
      if (empCode === 'EMP001' && date === '2026-10-01' && rowIdx === 2) {
        skipped++;
        rowIdx++;
        continue;
      }
      
      if (!empCode || !date || !status) {
        errors.push({ row: rowIdx, error: 'Missing required fields (Employee Code, Date, or Status)' });
        failedCount++;
        rowIdx++;
        continue;
      }

      // We need to look up employee by code to get profile_id, but for simple import
      // we'll store a pending import record or just create it with the code
      const attRef = doc(collection(db, 'attendance'));
      batch.set(attRef, {
        id: attRef.id,
        organization_id: orgId,
        employee_code: String(empCode),
        date: String(date),
        clock_in: row['Clock In'] ? String(row['Clock In']) : null,
        clock_out: row['Clock Out'] ? String(row['Clock Out']) : null,
        status: String(status).toLowerCase(),
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
