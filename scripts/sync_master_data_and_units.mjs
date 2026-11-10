import xlsx from 'xlsx';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  writeBatch
} from 'firebase/firestore';

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

const app = initializeApp(firebaseConfig, 'SYNC_MASTER_DATA');
const auth = getAuth(app);
const db = getFirestore(app);

const WORKPLACE_DEFS = {
  'wp-smh-main': {
    id: 'wp-smh-main',
    name: 'Shanti Memorial Hospital - Cuttack',
    address: 'Manglabag, Thoria Sahi, Cuttack, Odisha 753001',
    latitude: 20.46933,
    longitude: 85.88301,
    geofence_radius: 500,
    radius_meters: 500,
    organization_id: 'shanti-memorial-hospital',
    is_active: true
  },
  'wp-1793201564704': {
    id: 'wp-1793201564704',
    name: 'Gopal Trust',
    address: 'Manglabag, Thoria Sahi, Cuttack, Odisha 753001',
    latitude: 20.46933,
    longitude: 85.88301,
    geofence_radius: 500,
    radius_meters: 500,
    organization_id: 'shanti-memorial-hospital',
    is_active: true
  },
  'wp-1793201579968': {
    id: 'wp-1793201579968',
    name: 'Chikitsa',
    address: 'Chikitsa',
    latitude: 13.04030,
    longitude: 80.22957,
    geofence_radius: 200,
    radius_meters: 200,
    organization_id: 'shanti-memorial-hospital',
    is_active: true
  }
};

const FILES = [
  {
    path: 'C:/Users/HP/.gemini/antigravity/brain/7f2ae8c6-bd83-4a4b-a046-dd3de2afa988/.user_uploaded/media_1794290832520_04b3108b.xlsx',
    unitName: 'Shanti Memorial Hospital - Cuttack',
    wpId: 'wp-smh-main'
  },
  {
    path: 'C:/Users/HP/.gemini/antigravity/brain/7f2ae8c6-bd83-4a4b-a046-dd3de2afa988/.user_uploaded/media_1794290832523_b67ad4a8.xlsx',
    unitName: 'Gopal Trust',
    wpId: 'wp-1793201564704'
  },
  {
    path: 'C:/Users/HP/.gemini/antigravity/brain/7f2ae8c6-bd83-4a4b-a046-dd3de2afa988/.user_uploaded/media_1794290832524_c86969ab.xlsx',
    unitName: 'Chikitsa',
    wpId: 'wp-1793201579968'
  }
];

function normalizeCode(raw) {
  if (!raw) return '';
  return String(raw).replace(/[\s\-_]/g, '').toUpperCase();
}

function parseExcelDate(val) {
  if (!val) return null;
  if (typeof val === 'number') {
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    return date.toISOString().split('T')[0];
  }
  const s = String(val).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const parts = s.split(/[\/\.\-]/);
  if (parts.length === 3) {
    let [d, m, y] = parts;
    if (y.length === 2) y = (parseInt(y, 10) > 30 ? '19' : '20') + y;
    if (d.length === 4) {
      return `${d}-${m.padStart(2, '0')}-${y.padStart(2, '0')}`;
    }
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return s;
}

function parseNumber(val) {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const cleaned = String(val).replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function cleanPhone(raw) {
  if (!raw) return '';
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

async function runSync() {
  console.log('Connecting to Firebase...');
  await signInWithEmailAndPassword(auth, 'clara.schmidt@oasis.io', 'Password@123');
  console.log('✓ Admin authenticated successfully.');

  // 1. Update Workplaces
  console.log('\n1. Updating workplaces definitions in Firestore...');
  for (const [wpId, def] of Object.entries(WORKPLACE_DEFS)) {
    await setDoc(doc(db, 'workplaces', wpId), def, { merge: true });
    console.log(`  ✓ Workplace [${wpId}]: ${def.name}`);
  }

  // 2. Update Organization units
  console.log('\n2. Updating organization units in Firestore...');
  const orgRef = doc(db, 'organizations', 'shanti-memorial-hospital');
  await setDoc(orgRef, {
    units: ['Shanti Memorial Hospital - Cuttack', 'Chikitsa', 'Gopal Trust'],
    updated_at: new Date().toISOString()
  }, { merge: true });
  console.log('  ✓ Updated organizations/shanti-memorial-hospital units');

  // 3. Load existing Employees & Profiles
  console.log('\n3. Loading existing employees and profiles from Firestore...');
  const empSnap = await getDocs(collection(db, 'employees'));
  const profSnap = await getDocs(collection(db, 'profiles'));
  console.log(`  Found ${empSnap.size} employees, ${profSnap.size} profiles.`);

  const empByNormCode = new Map();
  const empByNormName = new Map();
  const empByPhone = new Map();
  const allEmpDocs = [];

  empSnap.forEach(d => {
    const data = { id: d.id, ...d.data() };
    allEmpDocs.push(data);
    const c = normalizeCode(data.employee_code);
    if (c) empByNormCode.set(c, data);
    const n = (data.full_name || '').trim().toLowerCase();
    if (n) empByNormName.set(n, data);
    const p = cleanPhone(data.phone);
    if (p && p.length === 10) empByPhone.set(p, data);
  });

  const profByNormCode = new Map();
  const profByNormName = new Map();
  const profByPhone = new Map();

  profSnap.forEach(d => {
    const data = { id: d.id, ...d.data() };
    const c = normalizeCode(data.employee_code);
    if (c) profByNormCode.set(c, data);
    const n = (data.full_name || '').trim().toLowerCase();
    if (n) profByNormName.set(n, data);
    const p = cleanPhone(data.phone);
    if (p && p.length === 10) profByPhone.set(p, data);
  });

  // 4. Process each Master Excel file
  console.log('\n4. Processing 3 Master Excel files...');
  let updatedCount = 0;
  let createdCount = 0;
  const processedEmpCodes = new Set();

  for (const fileDef of FILES) {
    const { path, unitName, wpId } = fileDef;
    const wpDef = WORKPLACE_DEFS[wpId];
    const wb = xlsx.readFile(path);

    console.log(`\nProcessing file: ${path.split('/').pop()} -> Unit: "${unitName}"`);

    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const rows = xlsx.utils.sheet_to_json(ws, { defval: '' });
      console.log(`  Sheet: [${sheetName}] with ${rows.length} raw rows`);

      const defaultEmpType = sheetName.toUpperCase().includes('CONTRACT') ? 'Contractual' : 'Regular';

      for (const row of rows) {
        const rawCode = String(row['EMP CODE'] || row['Employee Code'] || '').trim();
        const rawName = String(row['NAME'] || row['Full Name'] || '').trim();

        if (!rawCode && !rawName) continue;

        const normCode = normalizeCode(rawCode);
        const normName = rawName.trim().toLowerCase();
        const rawPhone = row['PH NO'] || row['Phone'] || '';
        const phone = cleanPhone(rawPhone);

        // Find existing employee record
        let existingEmp = null;
        if (normCode && empByNormCode.has(normCode)) {
          existingEmp = empByNormCode.get(normCode);
        } else if (normName && empByNormName.has(normName)) {
          existingEmp = empByNormName.get(normName);
        } else if (phone && phone.length === 10 && empByPhone.has(phone)) {
          existingEmp = empByPhone.get(phone);
        }

        // Build name components
        const nameParts = rawName.split(/\s+/).filter(Boolean);
        const firstName = nameParts[0] || 'Staff';
        const lastName = nameParts.slice(1).join(' ') || '';

        // Financial fields
        const basicSalary = parseNumber(row['O.BASIC'] ?? row['Basic Salary'] ?? 0);
        const hra = parseNumber(row['O.HRA'] ?? 0);
        const conveyance = parseNumber(row['O.CONV'] ?? 0);
        const wash = parseNumber(row['O.WASH.'] ?? 0);
        const spAllow = parseNumber(row['O.SP. ALLOW'] ?? 0);
        const grossSalary = parseNumber(row['O.G. SALARY'] ?? row['SALARY DETAILS '] ?? (basicSalary + hra + conveyance + wash + spAllow));

        // Banking
        const bankAcc = String(row['BANK ACCOUNT NUMBER'] || row['Account Number'] || '').trim();
        const bankIfsc = String(row['IFSC '] || row['IFSC'] || '').trim();
        const bankName = String(row['BANK NAME '] || row['BANK NAME'] || row['Bank Name'] || '').trim();

        // Tax / PF / ESIC
        const uan = String(row['UAN NOUMBER'] || row['UAN Number'] || '').trim();
        const esic = String(row['ESIC'] || row['ESI Number'] || '').trim();
        const isPfEligible = Boolean(uan && uan !== '0' && uan !== '-');
        const isEsiEligible = Boolean(esic && esic !== '0' && esic !== '-');

        // Dates & metadata
        const doj = parseExcelDate(row['DOJ'] || row['Date of Joining']);
        const dob = parseExcelDate(row['DOB'] || row['Date of Birth']);
        const offDays = String(row['OFF DAYS'] || 'Sunday').trim();
        const grade = String(row['GRADE'] || '').trim();
        const dept = String(row['DEPARTMENT'] || row['Department'] || 'General').trim();
        const desig = String(row['DESIGNATION'] || row['Designation'] || 'Staff').trim();

        // Workplace object embedded
        const embeddedWp = {
          id: wpDef.id,
          name: wpDef.name,
          address: wpDef.address,
          latitude: wpDef.latitude,
          longitude: wpDef.longitude,
          geofence_radius: wpDef.radius_meters
        };

        const empUpdateData = {
          employee_code: rawCode || (existingEmp ? existingEmp.employee_code : ''),
          full_name: rawName,
          first_name: firstName,
          last_name: lastName,
          department_id: dept,
          designation: desig,
          employment_type: defaultEmpType,
          hospital_unit: unitName,
          workplace_id: wpId,
          workplace: embeddedWp,
          basic_salary: basicSalary,
          hra: hra,
          conveyance_allowance: conveyance,
          washing_allowance: wash,
          special_allowance: spAllow,
          gross_salary: grossSalary,
          off_days: offDays,
          grade: grade || null,
          joining_date: doj || existingEmp?.joining_date || null,
          date_of_birth: dob || existingEmp?.date_of_birth || null,
          uan_number: uan || null,
          esi_number: esic || null,
          tax_config: {
            uan_number: uan || null,
            esi_number: esic || null,
            is_pf_eligible: isPfEligible,
            is_esi_eligible: isEsiEligible,
            epf_percentage: isPfEligible ? 12 : 0,
            esi_percentage: isEsiEligible ? 0.75 : 0,
            tax_regime: 'new'
          },
          bank_details: {
            account_number: bankAcc || (existingEmp?.bank_details?.account_number || ''),
            routing_number: bankIfsc || (existingEmp?.bank_details?.routing_number || ''),
            bank_name: bankName || (existingEmp?.bank_details?.bank_name || '')
          },
          organization_id: 'shanti-memorial-hospital',
          employment_status: 'active',
          updated_at: new Date().toISOString()
        };

        if (phone) {
          empUpdateData.phone = phone;
        }

        if (existingEmp) {
          await setDoc(doc(db, 'employees', existingEmp.id), empUpdateData, { merge: true });
          processedEmpCodes.add(existingEmp.id);
          updatedCount++;
        } else {
          // New employee doc
          const newDocRef = doc(collection(db, 'employees'));
          empUpdateData.id = newDocRef.id;
          empUpdateData.created_at = new Date().toISOString();
          await setDoc(newDocRef, empUpdateData);
          processedEmpCodes.add(newDocRef.id);
          createdCount++;
        }
      }
    }
  }

  console.log(`\n✓ Excel sync complete: ${updatedCount} updated, ${createdCount} created.`);

  // 5. Clean up any remaining Firestore employees that have wrong unit/workplace
  console.log('\n5. Sanitizing any remaining employee documents in Firestore...');
  let sanitizedCount = 0;
  for (const emp of allEmpDocs) {
    if (processedEmpCodes.has(emp.id)) continue;

    let targetUnit = emp.hospital_unit;
    let targetWpId = emp.workplace_id;

    // Fix legacy units
    if (targetUnit === 'Primary HQ' || targetUnit === 'Shanti Memorial Hospital' || targetUnit === 'Regional Campus' || targetWpId === 'wp-smh-main') {
      targetUnit = 'Shanti Memorial Hospital - Cuttack';
      targetWpId = 'wp-smh-main';
    } else if (targetUnit === 'Gopal Trust' || targetWpId === 'wp-1793201564704') {
      targetUnit = 'Gopal Trust';
      targetWpId = 'wp-1793201564704';
    } else if (targetUnit === 'Chikitsa' || targetWpId === 'wp-1793201579968') {
      targetUnit = 'Chikitsa';
      targetWpId = 'wp-1793201579968';
    } else {
      // Default to Shanti Memorial Hospital - Cuttack
      targetUnit = 'Shanti Memorial Hospital - Cuttack';
      targetWpId = 'wp-smh-main';
    }

    const wpDef = WORKPLACE_DEFS[targetWpId] || WORKPLACE_DEFS['wp-smh-main'];
    await updateDoc(doc(db, 'employees', emp.id), {
      hospital_unit: targetUnit,
      workplace_id: targetWpId,
      workplace: {
        id: wpDef.id,
        name: wpDef.name,
        address: wpDef.address,
        latitude: wpDef.latitude,
        longitude: wpDef.longitude,
        geofence_radius: wpDef.radius_meters
      },
      updated_at: new Date().toISOString()
    });
    sanitizedCount++;
  }
  console.log(`  ✓ Sanitized ${sanitizedCount} remaining employee records.`);

  // 6. Verify Ayush Bindhani (L4c4JYqYXD9yZf5SZL0s)
  const ayushEmpRef = doc(db, 'employees', 'L4c4JYqYXD9yZf5SZL0s');
  const ayushSnap = await getDoc(ayushEmpRef);
  if (ayushSnap.exists()) {
    const smhWp = WORKPLACE_DEFS['wp-smh-main'];
    await updateDoc(ayushEmpRef, {
      hospital_unit: 'Shanti Memorial Hospital - Cuttack',
      workplace_id: 'wp-smh-main',
      workplace: {
        id: smhWp.id,
        name: smhWp.name,
        address: smhWp.address,
        latitude: smhWp.latitude,
        longitude: smhWp.longitude,
        geofence_radius: smhWp.radius_meters
      },
      updated_at: new Date().toISOString()
    });
    console.log('✓ Verified Ayush Bindhani mapped to "Shanti Memorial Hospital - Cuttack"');
  }

  // 7. Verify Final Breakdown
  console.log('\n--- VERIFYING FINAL BREAKDOWN IN FIRESTORE ---');
  const finalSnap = await getDocs(collection(db, 'employees'));
  const finalUnits = {};
  const finalWps = {};
  finalSnap.forEach(d => {
    const data = d.data();
    const u = data.hospital_unit || 'UNKNOWN';
    const w = data.workplace_id || 'NO_WP';
    finalUnits[u] = (finalUnits[u] || 0) + 1;
    finalWps[w] = (finalWps[w] || 0) + 1;
  });
  console.log('Units Breakdown:', finalUnits);
  console.log('Workplaces Breakdown:', finalWps);
}

runSync().catch(console.error);

