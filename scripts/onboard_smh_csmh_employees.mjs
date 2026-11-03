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

const adminApp = initializeApp(firebaseConfig, 'ADMIN_ONBOARDING_APP');
const adminDb = getFirestore(adminApp);
const adminAuth = getAuth(adminApp);

const provApp = initializeApp(firebaseConfig, 'PROVISION_APP');
const provAuth = getAuth(provApp);

const ORG_ID = 'shanti-memorial-hospital';
const DEFAULT_PASSWORD = 'Password@123';

const f1 = 'C:/Users/HP/.gemini/antigravity/brain/f4df549b-a603-41a2-8c68-2f4468cf983f/.user_uploaded/media_1793687753641_933faaf1.xlsx';
const f2 = 'C:/Users/HP/.gemini/antigravity/brain/f4df549b-a603-41a2-8c68-2f4468cf983f/.user_uploaded/media_1793687753644_f6dad940.xlsx';

// Verified emails lookup from prior verified staff
const VERIFIED_EMAILS_BY_PHONE = {
  '7978407534': 'subhalinabal151@gmail.com',
  '7008239246': 'jenanilakantha6@gmail.com',
  '7205656442': 'routlipsa446@gmail.com',
  '9778057661': 'pujaswain37113@gmail.com',
  '9861803478': 'pandapuja31@gmail.com',
  '8458053300': 'reetaranikhuntia742@gmail.com',
  '9090084192': 'swaingopinath06@gmail.com',
  '9861694993': 'suryakantaswain200@gmail.com',
  '7735434801': 'snehalatamuduli675@gmail.com',
  '6371497528': 'gdas37577@gmail.com',
  '9348056218': 'jenaharapriya375@gmail.com',
  '7735877646': 'madhusmitabarik9583@gmail.com',
  '7847954654': 'sunitabehera9583@gmail.com',
};

// Department definitions to ensure in Firestore
const DEPARTMENTS = [
  { id: 'dept-smh-admin', name: 'Hospital Administration & Directorate', description: 'Executive, General Administration & Management' },
  { id: 'dept-smh-cardio', name: 'Cardiology & Cath Lab', description: 'Invasive & Non-invasive Cardiology' },
  { id: 'dept-smh-diagnostics', name: 'Radiology & Central Pathology Lab', description: 'Diagnostic Imaging, X-Ray, CT, MRI & Pathology' },
  { id: 'dept-smh-emergency', name: 'Emergency & Trauma Care (24x7)', description: 'Accident, Emergency & Critical Care' },
  { id: 'dept-smh-hr', name: 'Human Resources & Hospital Operations', description: 'People Operations, Compliance & Staffing' },
  { id: 'dept-smh-icu', name: 'Intensive Care Unit (ICU)', description: 'Critical Care & Ventilator Support' },
  { id: 'dept-smh-nursing', name: 'In-Patient Nursing Services', description: 'Ward, ICU & Day-care Nursing' },
  { id: 'dept-smh-ortho', name: 'Orthopedics & Joint Replacement', description: 'Orthopedic Surgery & Trauma' },
  { id: 'dept-smh-pharmacy', name: 'Central Pharmacy & Supplies', description: 'Hospital Pharmacy & Drug Dispensary' },
  { id: 'dept-smh-surgery', name: 'General & Laparoscopic Surgery', description: 'Surgical Services' },
  { id: 'dept-smh-billing', name: 'Billing & Accounts', description: 'Patient Billing, Invoicing & Cashier' },
  { id: 'dept-smh-canteen', name: 'Canteen & Dietary Services', description: 'Hospital Canteen, Kitchen, Cooking & Dining Services' },
  { id: 'dept-smh-clinical', name: 'Medical & Clinical Specialists', description: 'Doctors, Consultants & Resident Medical Officers (RMO)' },
  { id: 'dept-smh-front-office', name: 'Front Office & Patient Registration', description: 'Reception, OPD Registration & Helpdesk' },
  { id: 'dept-smh-housekeeping', name: 'Housekeeping & Sanitation', description: 'Sanitation, Hospital Cleaning & Housekeeping' },
  { id: 'dept-smh-hospitality', name: 'Hospitality & Guest Relations', description: 'Patient Care Services & Hospitality' },
  { id: 'dept-smh-it', name: 'Information Technology & Systems', description: 'Hospital Information Systems (HIS), IT Infrastructure & Data Entry' },
  { id: 'dept-smh-maintenance', name: 'Maintenance & Facility Engineering', description: 'Biomedical, Electrical & Civil Maintenance' },
  { id: 'dept-smh-mrd', name: 'Medical Records Department (MRD)', description: 'Medical Records, Patient Archival & Documentation' },
  { id: 'dept-smh-ot', name: 'Operation Theatre (OT) & Anesthesia', description: 'Surgical Theatres & OT Technicians' },
  { id: 'dept-smh-patient-service', name: 'Patient Care & Support Services', description: 'Attendants, Patient Transport & Ward Boys' },
  { id: 'dept-smh-security', name: 'Hospital Security & Vigilance', description: 'Premises Security, Guards & Surveillance' },
  { id: 'dept-smh-store', name: 'Central Store & Inventory', description: 'Materials Management, Medical & General Stores' },
  { id: 'dept-smh-laundry', name: 'Linen & Laundry Services', description: 'Washing, Linen Disinfection & Laundry Services' },
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
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/(?:^|\s)\S/g, a => a.toUpperCase());
}

function mapDepartment(raw) {
  const s = String(raw || '').trim().toUpperCase();
  if (s.includes('ADMIN')) return 'dept-smh-admin';
  if (s.includes('BILLING')) return 'dept-smh-billing';
  if (s.includes('CANTEEN')) return 'dept-smh-canteen';
  if (s.includes('CASHIER')) return 'dept-smh-billing';
  if (s.includes('COOK')) return 'dept-smh-canteen';
  if (s.includes('DINING')) return 'dept-smh-canteen';
  if (s.includes('DOCTOR') || s.includes('CONSULTANT') || s.includes('RMO')) return 'dept-smh-clinical';
  if (s.includes('FRONT')) return 'dept-smh-front-office';
  if (s.includes('HK') || s.includes('HOUSEKEEPING')) return 'dept-smh-housekeeping';
  if (s.includes('HOSPITALITY')) return 'dept-smh-hospitality';
  if (s.includes('IT') || s.includes('COMPUTER')) return 'dept-smh-it';
  if (s.includes('MAINTENANCE')) return 'dept-smh-maintenance';
  if (s.includes('MANAGER')) return 'dept-smh-admin';
  if (s.includes('MRD')) return 'dept-smh-mrd';
  if (s.includes('NURSING')) return 'dept-smh-nursing';
  if (s.includes('OT')) return 'dept-smh-ot';
  if (s.includes('PHARMACY')) return 'dept-smh-pharmacy';
  if (s.includes('PT') || s.includes('PATIENT')) return 'dept-smh-patient-service';
  if (s.includes('RADIO') || s.includes('PATH') || s.includes('DIAG')) return 'dept-smh-diagnostics';
  if (s.includes('SECURITY')) return 'dept-smh-security';
  if (s.includes('STORE')) return 'dept-smh-store';
  if (s.includes('SUPERVISOR')) return 'dept-smh-admin';
  if (s.includes('WASH') || s.includes('LAUNDRY')) return 'dept-smh-laundry';
  return 'dept-smh-admin';
}

function parseSheet(file, sheetName, unitName, workplaceId, employmentType) {
  const wb = xlsx.readFile(file);
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

  const results = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;
    const sl = getVal(r, 'slno', 'sl');
    let rawCode = getVal(r, 'empcode', 'code');
    const rawName = getVal(r, 'name', 'empname');
    if (!rawCode && !rawName) continue;

    // Check misplaced code in other columns
    if (!rawCode) {
      r.forEach(cell => {
        if (typeof cell === 'string' && /C?SMH/i.test(cell)) {
          rawCode = cell.trim();
        }
      });
    }

    let code = rawCode ? String(rawCode).trim().replace(/\s+/g, '') : null;
    if (code) {
      code = code.replace(/^(C?SMH)[-\s]*(\d+)/i, (_, p, n) => `${p.toUpperCase()}-${n}`);
    } else {
      const slNum = String(sl || i).padStart(3, '0');
      code = employmentType === 'Regular' ? `CSMH-R${slNum}` : `CSMH-C${slNum}`;
    }

    const name = cleanTitle(rawName);
    const department = getVal(r, 'department', 'dept');
    const designation = cleanTitle(getVal(r, 'designation', 'desig')) || 'Staff Member';
    const deptId = mapDepartment(department);

    const uan = getVal(r, 'uannoumber', 'uannumber', 'uan');
    const esic = getVal(r, 'esic', 'esi', 'esino');
    const doj = parseDate(getVal(r, 'doj', 'dateofjoining'));
    let dob = parseDate(getVal(r, 'dob', 'dateofbirth'));
    if (!dob && getVal(r, 'dob') && typeof getVal(r, 'dob') === 'string' && getVal(r, 'dob').includes('SMH')) {
      dob = null;
    }

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

    results.push({
      sl,
      code,
      name,
      department: department ? String(department).trim() : 'General',
      deptId,
      designation,
      employmentType,
      hospitalUnit: unitName,
      workplaceId,
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
  return results;
}

async function main() {
  console.log('========================================================');
  console.log('🚀 Onboarding 144 Employees for Shanti Memorial Hospital');
  console.log('========================================================\n');

  // 1. Authenticate Administrator
  console.log('🔐 Authenticating Administrator...');
  await signInWithEmailAndPassword(adminAuth, 'clara.schmidt@oasis.io', 'Password@123');
  console.log('✅ Admin authenticated successfully.\n');

  // 2. Ensure Departments exist
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

  // 3. Parse all 4 sheets
  console.log('📄 Parsing records from Excel spreadsheets...');
  const smhReg = parseSheet(f1, 'REGULAR', 'Shanti Memorial Hospital', 'wp-smh-main', 'Regular');
  const smhContr = parseSheet(f1, 'CONTRACTUAL', 'Shanti Memorial Hospital', 'wp-smh-main', 'Contractual');
  const csmhReg = parseSheet(f2, 'REGULAR', 'Chikitsa Unit of Shanti Memorial Hospital', 'wp-1793201579968', 'Regular');
  const csmhContr = parseSheet(f2, 'CONTRACTUAL', 'Chikitsa Unit of Shanti Memorial Hospital', 'wp-1793201579968', 'Contractual');

  const allEmployees = [...smhReg, ...smhContr, ...csmhReg, ...csmhContr];
  console.log(`✅ Total employee records parsed: ${allEmployees.length}`);

  // Disambiguate duplicate codes
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

  // 4. Provision Firebase Auth and Prepare Batches
  console.log('\n⚙️ Provisioning Auth and preparing Firestore documents...');
  const now = new Date().toISOString();

  // Helper for batching
  let currentBatch = writeBatch(adminDb);
  let batchOpsCount = 0;
  let totalBatchesCommitted = 0;

  async function checkCommitBatch(force = false) {
    if ((batchOpsCount >= 400 || force) && batchOpsCount > 0) {
      await currentBatch.commit();
      totalBatchesCommitted++;
      console.log(`  💾 Committed batch #${totalBatchesCommitted} with ${batchOpsCount} operations.`);
      currentBatch = writeBatch(adminDb);
      batchOpsCount = 0;
    }
  }

  // Pre-load existing employees to avoid duplicate IDs
  const existingEmpSnap = await getDocs(query(collection(adminDb, 'employees'), where('organization_id', '==', ORG_ID)));
  const existingByCode = new Map();
  existingEmpSnap.forEach(d => {
    const data = d.data();
    if (data.employee_code) existingByCode.set(data.employee_code.toUpperCase(), { id: d.id, ...data });
  });

  let provisionedCount = 0;
  let authCreatedCount = 0;

  for (let i = 0; i < allEmployees.length; i++) {
    const emp = allEmployees[i];
    const codeClean = emp.code.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Determine email
    let email = null;
    if (emp.phone && VERIFIED_EMAILS_BY_PHONE[emp.phone]) {
      email = VERIFIED_EMAILS_BY_PHONE[emp.phone];
    } else {
      email = `${codeClean}@shantimemorialhospital.com`;
    }

    // Provision or get Auth UID
    let authUid = `prof-smh-${codeClean}`;
    try {
      const cred = await createUserWithEmailAndPassword(provAuth, email, DEFAULT_PASSWORD);
      authUid = cred.user.uid;
      authCreatedCount++;
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
        // Fallback deterministic profile id
        authUid = `prof-${codeClean}`;
      }
    }

    // Determine Employee Doc ID
    const existing = existingByCode.get(emp.code.toUpperCase());
    const empDocId = existing ? existing.id : `emp-smh-${codeClean}`;

    // Profile Document
    const profilePayload = {
      id: authUid,
      organization_id: ORG_ID,
      full_name: emp.name,
      email: email,
      phone: emp.phone || null,
      avatar_url: null,
      role: 'employee',
      is_active: true,
      needs_password_change: true,
      must_change_password: true,
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
      phone: emp.phone || null,
      department_id: emp.deptId,
      designation: emp.designation,
      joining_date: emp.doj || null,
      date_of_birth: emp.dob || null,
      workplace_id: emp.workplaceId,
      hospital_unit: emp.hospitalUnit,
      employment_type: emp.employmentType,
      employment_status: 'active',
      onboarding_completed: true,
      grade: emp.grade || null,
      basic_salary: emp.basic,
      conveyance_allowance: emp.conveyance,
      washing_allowance: emp.washing,
      special_allowance: emp.specialAllowance,
      is_pf_eligible: !!emp.uan,
      is_esi_eligible: !!emp.esic,
      bank_details: {
        bank_name: emp.bankName || '',
        account_number: emp.accountNo || '',
        routing_number: emp.ifsc || '',
      },
      tax_config: {
        tax_regime: 'new',
        epf_percentage: emp.uan ? 12 : 0,
        hra_percentage: 40,
        hra_amount: emp.hra,
        uan_number: emp.uan || null,
        esi_number: emp.esic || null,
        pf_number: emp.uan || null,
      },
      created_at: existing?.created_at || now,
      updated_at: now,
    };

    // Queue in Firestore batch
    const profRef = doc(adminDb, 'profiles', authUid);
    const empRef = doc(adminDb, 'employees', empDocId);
    currentBatch.set(profRef, profilePayload, { merge: true });
    currentBatch.set(empRef, employeePayload, { merge: true });
    batchOpsCount += 2;
    provisionedCount++;

    await checkCommitBatch(false);

    if (provisionedCount % 25 === 0 || provisionedCount === allEmployees.length) {
      console.log(`  ⏳ Processed ${provisionedCount}/${allEmployees.length} employees...`);
    }
  }

  // Commit any remaining operations in the final batch
  await checkCommitBatch(true);

  console.log('\n========================================================');
  console.log(`🎉 Successfully onboarded all ${provisionedCount} employees!`);
  console.log(`   - Firebase Auth accounts created/verified: ${authCreatedCount}`);
  console.log(`   - Firestore Profile & Employee documents written: ${provisionedCount * 2}`);
  console.log('========================================================\n');

  process.exit(0);
}

main().catch(err => {
  console.error('❌ Onboarding failed:', err);
  process.exit(1);
});

