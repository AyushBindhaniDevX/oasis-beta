import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  writeBatch,
  getDocs,
  collection,
  query,
  where,
  setDoc,
} from 'firebase/firestore';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import xlsx from 'xlsx';

const firebaseConfig = {
  apiKey: "AIzaSyDfm6Y3LjDzeeK7a7hg6FvaE5rL4FgBIh8",
  authDomain: "project-9d1aa.firebaseapp.com",
  databaseURL: "https://project-9d1aa-default-rtdb.firebaseio.com",
  projectId: "project-9d1aa",
  storageBucket: "project-9d1aa.firebasestorage.app",
  messagingSenderId: "970423945867",
  appId: "1:970423945867:web:41cde39590eed383a1e28e",
  measurementId: "G-WD23318M8K"
};

const adminApp = initializeApp(firebaseConfig, 'ADMIN_SMH_MASTER_APP');
const adminDb = getFirestore(adminApp);
const adminAuth = getAuth(adminApp);

const provApp = initializeApp(firebaseConfig, 'PROVISION_SMH_MASTER_APP');
const provAuth = getAuth(provApp);

const ORG_ID = 'shanti-memorial-hospital';
const WORKPLACE_ID = 'wp-smh-main';
const UNIT_NAME = 'Shanti Memorial Hospital';
const DEFAULT_PASSWORD = 'Password@123';

const f = 'C:/Users/HP/.gemini/antigravity/brain/f4df549b-a603-41a2-8c68-2f4468cf983f/.user_uploaded/media_1793691136791_db1792ad.xlsx';

const DEPARTMENTS = [
  { id: 'dept-smh-admin', name: 'Hospital Administration & Directorate', description: 'Executive, General Administration & Management' },
  { id: 'dept-smh-cardio', name: 'Cardiology & Cath Lab', description: 'Invasive & Non-invasive Cardiology & Cath Lab' },
  { id: 'dept-smh-diagnostics', name: 'Radiology & Central Pathology Lab', description: 'Diagnostic Imaging, X-Ray, CT, MRI & Pathology' },
  { id: 'dept-smh-emergency', name: 'Emergency & Trauma Care (24x7)', description: 'Accident, Emergency & Critical Care' },
  { id: 'dept-smh-hr', name: 'Human Resources & Hospital Operations', description: 'People Operations, Compliance & Staffing' },
  { id: 'dept-smh-icu', name: 'Intensive Care Unit (ICU)', description: 'Critical Care & Ventilator Support' },
  { id: 'dept-smh-nursing', name: 'In-Patient Nursing Services', description: 'Ward, ICU & Day-care Nursing' },
  { id: 'dept-smh-ortho', name: 'Orthopedics & Joint Replacement', description: 'Orthopedic Surgery & Trauma' },
  { id: 'dept-smh-pharmacy', name: 'Central Pharmacy & Supplies', description: 'Hospital Pharmacy & Drug Dispensary' },
  { id: 'dept-smh-surgery', name: 'General & Laparoscopic Surgery', description: 'Surgical Services' },
  { id: 'dept-smh-billing', name: 'Billing & Accounts', description: 'Patient Billing, Invoicing, TPA Insurance & Cashier' },
  { id: 'dept-smh-canteen', name: 'Canteen & Dietary Services', description: 'Hospital Canteen, Kitchen, Cooking & Dietary Services' },
  { id: 'dept-smh-clinical', name: 'Medical & Clinical Specialists', description: 'Doctors, Consultants, DNB & Resident Medical Officers (RMO)' },
  { id: 'dept-smh-front-office', name: 'Front Office & Patient Registration', description: 'Reception, PRO, OPD Registration & Helpdesk' },
  { id: 'dept-smh-housekeeping', name: 'Housekeeping & Sanitation', description: 'Sanitation, Hospital Cleaning & Housekeeping' },
  { id: 'dept-smh-hospitality', name: 'Hospitality & Guest Relations', description: 'Patient Care Services & Hospitality' },
  { id: 'dept-smh-it', name: 'Information Technology & Systems', description: 'Hospital Information Systems (HIS), IT Infrastructure & Data Entry' },
  { id: 'dept-smh-maintenance', name: 'Maintenance & Facility Engineering', description: 'Biomedical, Electrical & Civil Maintenance' },
  { id: 'dept-smh-mrd', name: 'Medical Records Department (MRD)', description: 'Medical Records, Patient Archival & Documentation' },
  { id: 'dept-smh-ot', name: 'Operation Theatre (OT) & Anesthesia', description: 'Surgical Theatres, CSSD & OT Technicians' },
  { id: 'dept-smh-patient-service', name: 'Patient Care & Support Services', description: 'Patient Care Attendants (PCA), Dressors & Ward Boys' },
  { id: 'dept-smh-security', name: 'Hospital Security & Vigilance', description: 'Premises Security, Guards & Surveillance' },
  { id: 'dept-smh-store', name: 'Central Store & Inventory', description: 'Materials Management, Medical & General Stores' },
  { id: 'dept-smh-laundry', name: 'Linen & Laundry Services', description: 'Washing, Linen Disinfection & Laundry Services' },
  { id: 'dept-smh-dialysis', name: 'Dialysis & Nephrology Unit', description: 'Hemodialysis, Renal Care & Dialysis Technicians' },
  { id: 'dept-smh-transport', name: 'Ambulance & Transport Services', description: 'Patient Transport, Ambulance & Drivers' },
  { id: 'dept-smh-marketing', name: 'Hospital Marketing & Public Relations', description: 'Hospital Outreach, Marketing & Corporate Tie-ups' },
];

function normalizeHeader(str) {
  if (!str) return '';
  return String(str).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseDate(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') {
    if (isNaN(val) || val <= 0 || val < 1000) return null;
    try {
      const parsed = xlsx.SSF.parse_date_code(val);
      if (parsed && parsed.y && parsed.m && parsed.d) {
        if (parsed.y < 1920 || parsed.y > 2040) return null;
        const y = String(parsed.y).padStart(4, '0');
        const m = String(parsed.m).padStart(2, '0');
        const d = String(parsed.d).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    } catch (e) {}
  }
  const str = String(val).trim();
  if (!str || str === 'NaN' || str === 'null' || str === 'undefined' || str === '0' || str === '-') return null;
  const cleanStr = str.replace(/[^\d./-]/g, ' ').trim().split(/\s+/)[0];
  if (!cleanStr) return null;
  const dmyMatch = cleanStr.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    const y = dmyMatch[3];
    if (parseInt(y, 10) < 1920 || parseInt(y, 10) > 2040) return null;
    return `${y}-${m}-${d}`;
  }
  const ymdMatch = cleanStr.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = ymdMatch[2].padStart(2, '0');
    const d = ymdMatch[3].padStart(2, '0');
    if (parseInt(y, 10) < 1920 || parseInt(y, 10) > 2040) return null;
    return `${y}-${m}-${d}`;
  }
  if (/^\d{5}$/.test(str)) {
    return parseDate(parseInt(str, 10));
  }
  return null;
}

function cleanPhone(raw) {
  if (raw === null || raw === undefined) return null;
  const str = String(raw).trim();
  if (!str || str === '0' || str === 'NaN') return null;
  const match = str.replace(/[^\d]/g, '').match(/\d{10}/);
  return match ? match[0] : (str.replace(/[^\d]/g, '') || null);
}

function cleanNum(val) {
  if (val === null || val === undefined) return 0;
  const n = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : Math.round(n * 100) / 100;
}

function cleanTitle(str) {
  if (!str) return '';
  return String(str).trim().toLowerCase().replace(/(?:^|\s)\S/g, a => a.toUpperCase());
}

function mapDepartment(raw) {
  const s = String(raw || '').trim().toUpperCase();
  if (s.includes('ADMIN-STORE') || s === 'STORE') return 'dept-smh-store';
  if (s.includes('ADMIN-FINANCE') || s.includes('FINANCE') || s.includes('BILLING') || s.includes('TPA')) return 'dept-smh-billing';
  if (s.includes('ADMIN-HR') || s === 'HR' || s.includes('HUMAN RESOURCE')) return 'dept-smh-hr';
  if (s.includes('ADMIN')) return 'dept-smh-admin';
  if (s.includes('CANTEEN') || s.includes('COOK') || s.includes('DINING') || s.includes('DIETICIAN')) return 'dept-smh-canteen';
  if (s.includes('CATHLAB') || s.includes('CARDIO')) return 'dept-smh-cardio';
  if (s.includes('CONSULTANT') || s.includes('DOCTOR') || s.includes('DNB') || s.includes('MD RESIDENT') || s.includes('RMO') || s.includes('CLINICAL')) return 'dept-smh-clinical';
  if (s.includes('DIALYSIS')) return 'dept-smh-dialysis';
  if (s.includes('DRIVER') || s.includes('TRANSPORT')) return 'dept-smh-transport';
  if (s.includes('FRONT') || s.includes('PRO')) return 'dept-smh-front-office';
  if (s.includes('SURGERY')) return 'dept-smh-surgery';
  if (s.includes('HK-LAUNDRY') || s.includes('LAUNDRY') || s.includes('WASH')) return 'dept-smh-laundry';
  if (s.includes('HK') || s.includes('HOUSEKEEPING')) return 'dept-smh-housekeeping';
  if (s.includes('IT') || s.includes('COMPUTER')) return 'dept-smh-it';
  if (s.includes('MAINTAINANCE') || s.includes('MAINTENANCE') || s.includes('BIOMEDICAL')) return 'dept-smh-maintenance';
  if (s.includes('MARKETING')) return 'dept-smh-marketing';
  if (s.includes('MRD')) return 'dept-smh-mrd';
  if (s.includes('NURSING') || s.includes('EPF')) return 'dept-smh-nursing';
  if (s.includes('OT')) return 'dept-smh-ot';
  if (s.includes('PATH') || s.includes('RADIO') || s.includes('DIAG')) return 'dept-smh-diagnostics';
  if (s.includes('PCA') || s.includes('DRESSOR') || s.includes('PT SERVICE') || s.includes('PATIENT')) return 'dept-smh-patient-service';
  if (s.includes('PHARMACY')) return 'dept-smh-pharmacy';
  if (s.includes('PRIEST') || s.includes('HOSPITALITY')) return 'dept-smh-hospitality';
  if (s.includes('SECURITY')) return 'dept-smh-security';
  return 'dept-smh-admin';
}

function parseWorkbook(file) {
  const wb = xlsx.readFile(file);
  const allEmployees = [];

  // Sheet 1: Employees (Leadership / Clinical Staff)
  const sheet1Rows = xlsx.utils.sheet_to_json(wb.Sheets['Employees'], { header: 1 });
  for (let i = 1; i < sheet1Rows.length; i++) {
    const r = sheet1Rows[i];
    if (!r || !r[0]) continue;
    const rawCode = String(r[0]).trim().replace(/\s+/g, '');
    const code = rawCode.replace(/^(SMH|P|DNB)[-\s]*(\d+)/i, (_, p, n) => `${p.toUpperCase()}-${n}`);
    const name = cleanTitle(r[1]);
    const email = r[2] ? String(r[2]).trim() : null;
    const phone = cleanPhone(r[3]);
    const deptRaw = r[4] ? String(r[4]).trim() : 'Hospital Administration';
    const deptId = mapDepartment(deptRaw);
    const designation = cleanTitle(r[5]) || 'Staff';
    const doj = parseDate(r[6]);
    const dob = parseDate(r[7]);
    const basic = cleanNum(r[8]);
    const pf = r[10] ? String(r[10]).trim() : null;
    const uan = r[11] ? String(r[11]).trim() : null;
    const esi = r[12] ? String(r[12]).trim() : null;

    allEmployees.push({
      source: 'Employees',
      code,
      name,
      email,
      phone,
      department: deptRaw,
      deptId,
      designation,
      doj,
      dob,
      basic,
      hra: Math.round(basic * 0.4),
      conveyance: 0,
      washing: 0,
      specialAllowance: 0,
      gross: basic,
      employmentType: 'Regular',
      grade: null,
      accountNo: null,
      ifsc: null,
      bankName: null,
      uan: uan || pf,
      esic: esi,
    });
  }

  // Helper for REGULAR & CONTRACTUAL
  function parseSalSheet(sheetName, empType) {
    const rows = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });
    const rawHeader = rows[0] || [];
    const headerMap = {};
    rawHeader.forEach((col, idx) => {
      const key = normalizeHeader(col);
      if (key) headerMap[key] = idx;
    });

    const getVal = (row, ...keys) => {
      for (const k of keys) {
        const idx = headerMap[k];
        if (idx !== undefined && row[idx] !== undefined && row[idx] !== null) {
          const val = String(row[idx]).trim();
          if (val !== '' && val !== 'NaN' && val !== 'undefined') return row[idx];
        }
      }
      return null;
    };

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.length === 0) continue;
      const sl = getVal(r, 'slno', 'sl');
      let rawCode = getVal(r, 'empcode', 'code');
      const rawName = getVal(r, 'name', 'empname');
      if (!rawCode && !rawName) continue;

      let code = rawCode ? String(rawCode).trim().replace(/\s+/g, '') : null;
      if (code) {
        code = code.replace(/^(SMH|P|DNB)[-\s]*(\d+)/i, (_, p, n) => `${p.toUpperCase()}-${n}`);
      } else {
        const slNum = String(sl || i).padStart(3, '0');
        code = empType === 'Regular' ? `SMH-R${slNum}` : `SMH-C${slNum}`;
      }

      const name = cleanTitle(rawName);
      const deptRaw = getVal(r, 'department', 'dept');
      const deptId = mapDepartment(deptRaw);
      const designation = cleanTitle(getVal(r, 'designation', 'desig')) || 'Staff';
      const uan = getVal(r, 'uannoumber', 'uannumber', 'uan');
      const esic = getVal(r, 'esic', 'esi', 'esino');
      const doj = parseDate(getVal(r, 'doj', 'dateofjoining'));
      let dob = parseDate(getVal(r, 'dob', 'dateofbirth'));

      const grade = getVal(r, 'grade') ? String(getVal(r, 'grade')).trim().toUpperCase() : null;
      const basic = cleanNum(getVal(r, 'obasic', 'basic'));
      const hra = cleanNum(getVal(r, 'ohra', 'hra'));
      const conv = cleanNum(getVal(r, 'oconv', 'conv'));
      const wash = cleanNum(getVal(r, 'owash', 'wash'));
      const special = cleanNum(getVal(r, 'ospallow', 'spallow', 'specialallowance'));
      const gross = cleanNum(getVal(r, 'ogsalary', 'gsalary', 'salarydetails', 'salary'));

      const phone = cleanPhone(getVal(r, 'phno', 'phone', 'contact'));
      const accountNo = getVal(r, 'bankaccountnumber', 'accountnumber', 'accountno') ? String(getVal(r, 'bankaccountnumber', 'accountnumber', 'accountno')).trim() : null;
      const ifsc = getVal(r, 'ifsc', 'ifsccode') ? String(getVal(r, 'ifsc', 'ifsccode')).trim().toUpperCase() : null;
      const bankName = getVal(r, 'bankname', 'bank') ? String(getVal(r, 'bankname', 'bank')).trim().toUpperCase() : null;

      allEmployees.push({
        source: sheetName,
        sl,
        code,
        name,
        department: deptRaw || 'Hospital Administration',
        deptId,
        designation,
        employmentType: empType,
        doj,
        dob,
        grade,
        basic: basic || gross || 0,
        hra,
        conveyance: conv,
        washing: wash,
        specialAllowance: special,
        gross: gross || (basic + hra + conv + wash + special),
        phone,
        accountNo,
        ifsc,
        bankName,
        uan: uan ? String(uan).trim() : null,
        esic: esic ? String(esic).trim() : null,
      });
    }
  }

  parseSalSheet('REGULAR', 'Regular');
  parseSalSheet('CONTRACTUAL', 'Contractual');

  return allEmployees;
}

async function main() {
  console.log('========================================================');
  console.log('🚀 Onboarding Master Staff for Shanti Memorial Hospital');
  console.log('========================================================\n');

  // 1. Authenticate Admin
  console.log('🔐 Authenticating Administrator...');
  await signInWithEmailAndPassword(adminAuth, 'clara.schmidt@oasis.io', 'Password@123');
  console.log('✅ Admin authenticated successfully.\n');

  // 2. Ensure all departments exist
  console.log('🏥 Ensuring Hospital Departments exist in Firestore...');
  const existingDeptSnap = await getDocs(query(collection(adminDb, 'departments'), where('organization_id', '==', ORG_ID)));
  const existingDeptIds = new Set();
  existingDeptSnap.forEach(d => existingDeptIds.add(d.id));

  for (const dept of DEPARTMENTS) {
    if (!existingDeptIds.has(dept.id)) {
      await setDoc(doc(adminDb, 'departments', dept.id), {
        ...dept,
        organization_id: ORG_ID,
        created_at: new Date().toISOString(),
      });
      console.log(`  ➕ Created department: [${dept.id}] ${dept.name}`);
    }
  }
  console.log('✅ Departments verified & up-to-date.\n');

  // 3. Parse all employees from workbook
  console.log('📄 Parsing records from Excel spreadsheet...');
  const allEmployees = parseWorkbook(f);
  console.log(`✅ Total parsed records from file: ${allEmployees.length}`);

  // Disambiguate duplicate codes if any
  const codeCounts = {};
  allEmployees.forEach(e => {
    codeCounts[e.code] = (codeCounts[e.code] || 0) + 1;
  });
  const seenCodes = {};
  allEmployees.forEach(e => {
    if (codeCounts[e.code] > 1) {
      seenCodes[e.code] = (seenCodes[e.code] || 0) + 1;
      if (seenCodes[e.code] > 1) {
        e.code = `${e.code}-${seenCodes[e.code]}`;
      }
    }
  });

  // 4. Load existing employees to match existing IDs & Auth UIDs
  const existingEmpSnap = await getDocs(query(collection(adminDb, 'employees'), where('organization_id', '==', ORG_ID)));
  const existingByCode = new Map();
  const existingByPhone = new Map();

  existingEmpSnap.forEach(d => {
    const data = d.data();
    if (data.employee_code) existingByCode.set(data.employee_code.toUpperCase(), { id: d.id, ...data });
    if (data.phone) {
      const p = String(data.phone).replace(/\D/g, '').slice(-10);
      if (p.length >= 10) existingByPhone.set(p, { id: d.id, ...data });
    }
  });

  console.log(`Existing employees in DB: ${existingEmpSnap.size}`);

  // 5. Batch write to Firestore
  const now = new Date().toISOString();
  let currentBatch = writeBatch(adminDb);
  let batchOpsCount = 0;
  let totalBatches = 0;

  async function checkCommit(force = false) {
    if ((batchOpsCount >= 400 || force) && batchOpsCount > 0) {
      await currentBatch.commit();
      totalBatches++;
      console.log(`  💾 Committed batch #${totalBatches} with ${batchOpsCount} operations.`);
      currentBatch = writeBatch(adminDb);
      batchOpsCount = 0;
    }
  }

  let processedCount = 0;
  let authProvisioned = 0;

  for (const emp of allEmployees) {
    const codeClean = emp.code.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Existing match
    const existing = existingByCode.get(emp.code.toUpperCase()) ||
      (emp.phone ? existingByPhone.get(emp.phone.slice(-10)) : null);

    // Determine doc ID and Profile UID
    const empDocId = existing ? existing.id : `emp-smh-${codeClean}`;
    let authUid = existing?.profile_id;

    // Determine Email
    let email = emp.email || existing?.email || `${codeClean}@shantimemorialhospital.com`;

    if (!authUid) {
      authUid = `prof-smh-${codeClean}`;
      try {
        const cred = await createUserWithEmailAndPassword(provAuth, email, DEFAULT_PASSWORD);
        authUid = cred.user.uid;
        authProvisioned++;
        await signOut(provAuth);
      } catch (authErr) {
        if (authErr.code === 'auth/email-already-in-use') {
          try {
            const loginRes = await signInWithEmailAndPassword(provAuth, email, DEFAULT_PASSWORD);
            authUid = loginRes.user.uid;
            await signOut(provAuth);
          } catch (lErr) {
            authUid = `auth-${codeClean}`;
          }
        } else {
          authUid = `prof-${codeClean}`;
        }
      }
    }

    // Profile Document
    const profilePayload = {
      id: authUid,
      organization_id: ORG_ID,
      full_name: emp.name,
      email: email,
      phone: emp.phone || existing?.phone || null,
      avatar_url: existing?.profile?.avatar_url || null,
      role: existing?.profile?.role || (emp.designation?.toLowerCase().includes('director') || emp.designation?.toLowerCase().includes('admin-ceo') ? 'admin' : 'employee'),
      is_active: true,
      needs_password_change: existing?.profile?.needs_password_change ?? true,
      must_change_password: existing?.profile?.must_change_password ?? true,
      created_at: existing?.created_at || now,
      updated_at: now,
    };

    // Employee Document
    const employeePayload = {
      id: empDocId,
      profile_id: authUid,
      organization_id: ORG_ID,
      employee_code: emp.code,
      email: email,
      work_email: email,
      phone: emp.phone || existing?.phone || null,
      department_id: emp.deptId,
      designation: emp.designation,
      joining_date: emp.doj || existing?.joining_date || null,
      date_of_birth: emp.dob || existing?.date_of_birth || null,
      workplace_id: WORKPLACE_ID,
      hospital_unit: UNIT_NAME,
      employment_type: emp.employmentType,
      employment_status: 'active',
      onboarding_completed: true,
      grade: emp.grade || existing?.grade || null,
      basic_salary: emp.basic,
      conveyance_allowance: emp.conveyance,
      washing_allowance: emp.washing,
      special_allowance: emp.specialAllowance,
      is_pf_eligible: !!emp.uan || existing?.is_pf_eligible || false,
      is_esi_eligible: !!emp.esic || existing?.is_esi_eligible || false,
      bank_details: {
        bank_name: emp.bankName || existing?.bank_details?.bank_name || '',
        account_number: emp.accountNo || existing?.bank_details?.account_number || '',
        routing_number: emp.ifsc || existing?.bank_details?.routing_number || '',
      },
      tax_config: {
        tax_regime: 'new',
        epf_percentage: (emp.uan || existing?.is_pf_eligible) ? 12 : 0,
        hra_percentage: 40,
        hra_amount: emp.hra,
        uan_number: emp.uan || existing?.tax_config?.uan_number || null,
        esi_number: emp.esic || existing?.tax_config?.esi_number || null,
        pf_number: emp.uan || existing?.tax_config?.pf_number || null,
      },
      created_at: existing?.created_at || now,
      updated_at: now,
    };

    const profRef = doc(adminDb, 'profiles', authUid);
    const empRef = doc(adminDb, 'employees', empDocId);
    currentBatch.set(profRef, profilePayload, { merge: true });
    currentBatch.set(empRef, employeePayload, { merge: true });
    batchOpsCount += 2;
    processedCount++;

    await checkCommit(false);

    if (processedCount % 50 === 0 || processedCount === allEmployees.length) {
      console.log(`  ⏳ Processed ${processedCount}/${allEmployees.length} records...`);
    }
  }

  await checkCommit(true);

  console.log('\n========================================================');
  console.log(`🎉 Successfully onboarded/updated all ${processedCount} employees for Shanti Memorial Hospital!`);
  console.log(`   - Firebase Auth accounts provisioned: ${authProvisioned}`);
  console.log(`   - Total batch commits: ${totalBatches}`);
  console.log('========================================================\n');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Failed:', err);
  process.exit(1);
});

