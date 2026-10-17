/**
 * Hospital Initial Master Data Configuration & Transition Service
 * Shanti Memorial Hospital & Chikitsa Unit of Shanti Memorial Hospital
 * Requirement 13: Seed sample master staff, support transition, and facilitate HR operations
 */

import { db } from '@/lib/firebase';
import { collection, doc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import type { Employee, Profile, Department } from '@/types';

export interface HospitalMasterStaffRecord {
  employee_code: string;
  full_name: string;
  email: string;
  phone: string;
  department_name: string;
  designation: string;
  hospital_unit: 'Shanti Memorial Hospital' | 'Chikitsa Unit of Shanti Memorial Hospital';
  joining_date: string;
  date_of_birth: string;
  gross_salary: number;
  basic_salary: number;
  is_pf_eligible: boolean;
  is_overtime_eligible: boolean;
  uan_number?: string;
  pf_number?: string;
  esi_number?: string;
}

export const SAMPLE_HOSPITAL_STAFF: HospitalMasterStaffRecord[] = [
  // PF Salary Sheet Employees (Image 1)
  {
    employee_code: 'SMH-1502',
    full_name: 'Abhiram Hatua',
    email: 'abhiram.hatua@shantimemorial.in',
    phone: '9861015021',
    department_name: 'Security & Safety',
    designation: 'Security Guard',
    hospital_unit: 'Shanti Memorial Hospital',
    joining_date: '2021-04-01',
    date_of_birth: '1988-05-15',
    gross_salary: 13000,
    basic_salary: 6500,
    is_pf_eligible: true,
    is_overtime_eligible: true,
    uan_number: '101502100001',
    pf_number: 'OR/CTC/1502',
    esi_number: '2100015021',
  },
  {
    employee_code: 'SMH-023',
    full_name: 'Ajay Swain',
    email: 'ajay.swain@shantimemorial.in',
    phone: '9861002301',
    department_name: 'Housekeeping & Support',
    designation: 'Hospital Attendant',
    hospital_unit: 'Shanti Memorial Hospital',
    joining_date: '2019-06-15',
    date_of_birth: '1992-10-20',
    gross_salary: 12000,
    basic_salary: 6000,
    is_pf_eligible: true,
    is_overtime_eligible: false,
    uan_number: '100023100002',
    pf_number: 'OR/CTC/0023',
    esi_number: '2100002301',
  },
  {
    employee_code: 'SMH-1473',
    full_name: 'Ajit Kumar Seth',
    email: 'ajit.seth@shantimemorial.in',
    phone: '9861014731',
    department_name: 'Nursing & Patient Care',
    designation: 'Staff Nurse',
    hospital_unit: 'Shanti Memorial Hospital',
    joining_date: '2020-08-01',
    date_of_birth: '1994-03-12',
    gross_salary: 15000,
    basic_salary: 7500,
    is_pf_eligible: true,
    is_overtime_eligible: true,
    uan_number: '101473100003',
    pf_number: 'OR/CTC/1473',
    esi_number: '2100014731',
  },
  {
    employee_code: 'SMH-1289',
    full_name: 'Akash Behera',
    email: 'akash.behera@shantimemorial.in',
    phone: '9861012891',
    department_name: 'Laboratory & Diagnostics',
    designation: 'Lab Technician',
    hospital_unit: 'Shanti Memorial Hospital',
    joining_date: '2022-01-10',
    date_of_birth: '1995-07-25',
    gross_salary: 16000,
    basic_salary: 8000,
    is_pf_eligible: true,
    is_overtime_eligible: true,
    uan_number: '101289100004',
    pf_number: 'OR/CTC/1289',
    esi_number: '2100012891',
  },
  {
    employee_code: 'SMH-1510',
    full_name: 'Akhila Kumar Das',
    email: 'akhila.das@shantimemorial.in',
    phone: '9861015101',
    department_name: 'Housekeeping & Support',
    designation: 'Ward Boy / Attendant',
    hospital_unit: 'Shanti Memorial Hospital',
    joining_date: '2021-09-01',
    date_of_birth: '1990-12-05',
    gross_salary: 12000,
    basic_salary: 6000,
    is_pf_eligible: true,
    is_overtime_eligible: false,
    uan_number: '101510100005',
    pf_number: 'OR/CTC/1510',
    esi_number: '2100015101',
  },
  {
    employee_code: 'SMH-1498',
    full_name: 'Ananda Chandra Sahoo',
    email: 'ananda.sahoo@shantimemorial.in',
    phone: '9861014981',
    department_name: 'Pharmacy',
    designation: 'Pharmacist',
    hospital_unit: 'Shanti Memorial Hospital',
    joining_date: '2020-11-15',
    date_of_birth: '1991-04-18',
    gross_salary: 18000,
    basic_salary: 9000,
    is_pf_eligible: true,
    is_overtime_eligible: true,
    uan_number: '101498100006',
    pf_number: 'OR/CTC/1498',
    esi_number: '2100014981',
  },
  {
    employee_code: 'SMH-1481',
    full_name: 'Anita Behera',
    email: 'anita.behera@shantimemorial.in',
    phone: '9861014811',
    department_name: 'Nursing & Patient Care',
    designation: 'Senior Staff Nurse',
    hospital_unit: 'Shanti Memorial Hospital',
    joining_date: '2019-03-01',
    date_of_birth: '1989-08-22',
    gross_salary: 17000,
    basic_salary: 8500,
    is_pf_eligible: true,
    is_overtime_eligible: true,
    uan_number: '101481100007',
    pf_number: 'OR/CTC/1481',
    esi_number: '2100014811',
  },
  {
    employee_code: 'SMH-1505',
    full_name: 'Ashok Kumar Bhadra',
    email: 'ashok.bhadra@shantimemorial.in',
    phone: '9861015051',
    department_name: 'Administration & Billing',
    designation: 'Billing Executive',
    hospital_unit: 'Shanti Memorial Hospital',
    joining_date: '2021-05-10',
    date_of_birth: '1993-01-30',
    gross_salary: 16000,
    basic_salary: 8000,
    is_pf_eligible: true,
    is_overtime_eligible: false,
    uan_number: '101505100008',
    pf_number: 'OR/CTC/1505',
    esi_number: '2100015051',
  },
  {
    employee_code: 'SMH-1490',
    full_name: 'Ashok Kumar Satpathy',
    email: 'ashok.satpathy@shantimemorial.in',
    phone: '9861014901',
    department_name: 'Security & Safety',
    designation: 'Security Supervisor',
    hospital_unit: 'Shanti Memorial Hospital',
    joining_date: '2020-02-15',
    date_of_birth: '1986-11-14',
    gross_salary: 13000,
    basic_salary: 6500,
    is_pf_eligible: true,
    is_overtime_eligible: true,
    uan_number: '101490100009',
    pf_number: 'OR/CTC/1490',
    esi_number: '2100014901',
  },
  // Non-PF Salary Sheet Staff (Image 2)
  {
    employee_code: 'SMH-1021',
    full_name: 'Abhijit Chakrabarty',
    email: 'abhijit.c@shantimemorial.in',
    phone: '9861010211',
    department_name: 'Medical Consulting & Surgery',
    designation: 'Consultant Surgeon',
    hospital_unit: 'Chikitsa Unit of Shanti Memorial Hospital',
    joining_date: '2018-01-01',
    date_of_birth: '1978-06-25',
    gross_salary: 29000,
    basic_salary: 14500,
    is_pf_eligible: false,
    is_overtime_eligible: true,
    uan_number: undefined,
    pf_number: undefined,
    esi_number: undefined,
  },
];

export async function seedHospitalInitialMasterData(orgId: string): Promise<{
  totalProcessed: number;
  insertedCount: number;
  skippedCount: number;
}> {
  // 1. Fetch or create hospital departments
  const deptSnap = await getDocs(query(collection(db, 'departments'), where('organization_id', '==', orgId)));
  const deptMap = new Map<string, string>();
  deptSnap.forEach((d) => deptMap.set(d.data().name.toLowerCase(), d.id));

  const neededDepts = [
    'Security & Safety',
    'Housekeeping & Support',
    'Nursing & Patient Care',
    'Laboratory & Diagnostics',
    'Pharmacy',
    'Administration & Billing',
    'Medical Consulting & Surgery',
  ];

  const deptBatch = writeBatch(db);
  let deptBatchCount = 0;
  for (const deptName of neededDepts) {
    if (!deptMap.has(deptName.toLowerCase())) {
      const newDeptRef = doc(collection(db, 'departments'));
      deptBatch.set(newDeptRef, {
        id: newDeptRef.id,
        organization_id: orgId,
        name: deptName,
        code: deptName.slice(0, 3).toUpperCase(),
        created_at: new Date().toISOString(),
      });
      deptMap.set(deptName.toLowerCase(), newDeptRef.id);
      deptBatchCount++;
    }
  }
  if (deptBatchCount > 0) {
    await deptBatch.commit();
  }

  // 2. Check existing employee codes
  const empSnap = await getDocs(query(collection(db, 'employees'), where('organization_id', '==', orgId)));
  const existingCodes = new Set<string>();
  empSnap.forEach((d) => {
    const data = d.data();
    if (data.employee_code) existingCodes.add(data.employee_code);
  });

  const empBatch = writeBatch(db);
  let inserted = 0;
  let skipped = 0;

  for (const staff of SAMPLE_HOSPITAL_STAFF) {
    if (existingCodes.has(staff.employee_code)) {
      skipped++;
      continue;
    }

    const empRef = doc(collection(db, 'employees'));
    const profileRef = doc(db, 'profiles', empRef.id);
    const deptId = deptMap.get(staff.department_name.toLowerCase()) || null;

    empBatch.set(profileRef, {
      id: empRef.id,
      organization_id: orgId,
      full_name: staff.full_name,
      email: staff.email,
      phone: staff.phone,
      role: 'employee',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    empBatch.set(empRef, {
      id: empRef.id,
      organization_id: orgId,
      profile_id: empRef.id,
      employee_code: staff.employee_code,
      department_id: deptId,
      designation: staff.designation,
      hospital_unit: staff.hospital_unit,
      joining_date: staff.joining_date,
      date_of_birth: staff.date_of_birth,
      basic_salary: staff.gross_salary,
      is_pf_eligible: staff.is_pf_eligible,
      is_overtime_eligible: staff.is_overtime_eligible,
      employment_status: 'active',
      employment_type: staff.is_pf_eligible ? 'full_time' : 'contract',
      onboarding_completed: true,
      tax_config: {
        uan_number: staff.uan_number || null,
        pf_number: staff.pf_number || null,
        esi_number: staff.esi_number || null,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    inserted++;
  }

  if (inserted > 0) {
    await empBatch.commit();
  }

  return {
    totalProcessed: SAMPLE_HOSPITAL_STAFF.length,
    insertedCount: inserted,
    skippedCount: skipped,
  };
}
