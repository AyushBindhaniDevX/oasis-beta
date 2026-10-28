import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDfm6Y3LjDzeeK7a7hg6FvaE5rL4FgBIh8",
  authDomain: "project-9d1aa.firebaseapp.com",
  databaseURL: "https://project-9d1aa-default-rtdb.firebaseio.com",
  projectId: "project-9d1aa",
  storageBucket: "project-9d1aa.firebasestorage.app",
  messagingSenderId: "970423945867",
  appId: "1:970423945867:web:41cde39590eed383a1e28e",
  measurementId: "G-WD23318M8K",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function inspect() {
  console.log('--- Fetching Profiles ---');
  const profSnap = await getDocs(collection(db, 'profiles'));
  const profiles = [];
  profSnap.forEach((doc) => {
    profiles.push({ id: doc.id, ...doc.data() });
  });
  console.log(`Found ${profiles.length} profiles in Firestore.`);

  console.log('\n=== ALL PROFILES ===');
  profiles.forEach((p, idx) => {
    console.log(`[P${idx + 1}] ID: ${p.id} | Email: ${p.email || 'NONE'} | Name: ${p.full_name || 'NONE'} | Role: ${p.role} | Org: ${p.organization_id} | Active: ${p.is_active}`);
  });

  console.log('\n======================================================');
  console.log('LINKAGE & INTEGRITY ANALYSIS:');
  console.log('======================================================');
  
  // Group 1: Valid linked (profile <-> employee)
  const validLinked = [];
  // Group 2: Orphaned profiles (no employee record)
  const orphanedProfiles = [];
  // Group 3: Orphaned employees (no profile record or invalid profile_id)
  const orphanedEmployees = [];
  // Group 4: Incomplete / empty data
  const emptyOrIncomplete = [];

  for (const prof of profiles) {
    const linkedEmp = employees.find(e => e.profile_id === prof.id);
    const linkedByEmail = employees.find(e => (e.email && prof.email && e.email.toLowerCase() === prof.email.toLowerCase()) || (e.work_email && prof.email && e.work_email.toLowerCase() === prof.email.toLowerCase()));
    
    const isProfileEmpty = !prof.email && !prof.full_name;

    if (isProfileEmpty) {
      emptyOrIncomplete.push({ type: 'profile', id: prof.id, reason: 'Profile has no email and no full_name', data: prof });
    } else if (linkedEmp || linkedByEmail) {
      validLinked.push({
        profileId: prof.id,
        email: prof.email,
        name: prof.full_name,
        role: prof.role,
        employeeId: linkedEmp?.id || linkedByEmail?.id,
        employeeCode: linkedEmp?.employee_code || linkedByEmail?.employee_code,
        matchType: linkedEmp ? 'Direct profile_id' : 'Matched by email',
      });
    } else {
      orphanedProfiles.push({
        profileId: prof.id,
        email: prof.email,
        name: prof.full_name,
        role: prof.role,
        org: prof.organization_id,
      });
    }
  }

  for (const emp of employees) {
    const linkedProf = profiles.find(p => p.id === emp.profile_id);
    const linkedByEmail = profiles.find(p => (p.email && emp.email && p.email.toLowerCase() === emp.email.toLowerCase()) || (p.email && emp.work_email && p.email.toLowerCase() === emp.work_email.toLowerCase()));
    
    const isEmpEmpty = !emp.employee_code && !emp.designation && !emp.basic_salary;
    if (isEmpEmpty) {
      emptyOrIncomplete.push({ type: 'employee', id: emp.id, reason: 'Employee record has empty details', data: emp });
    } else if (!linkedProf && !linkedByEmail) {
      orphanedEmployees.push({
        employeeId: emp.id,
        code: emp.employee_code,
        profileId: emp.profile_id,
        email: emp.email || emp.work_email,
        designation: emp.designation,
        unit: emp.hospital_unit,
      });
    }
  }

  console.log(`\n>>> 1. PROPERLY LINKED (Profile + Employee present): ${validLinked.length}`);
  validLinked.forEach((v, i) => {
    console.log(`  ${i + 1}. ${v.email || v.name} (Role: ${v.role}) -> Profile: ${v.profileId} <-> Employee: ${v.employeeId} (${v.employeeCode}) [${v.matchType}]`);
  });

  console.log(`\n>>> 2. ORPHANED PROFILES (Profile exists in DB, but NO employee data): ${orphanedProfiles.length}`);
  orphanedProfiles.forEach((o, i) => {
    console.log(`  ${i + 1}. ProfileID: ${o.profileId} | Email: ${o.email} | Name: ${o.name} | Role: ${o.role}`);
  });

  console.log(`\n>>> 3. ORPHANED EMPLOYEES (Employee exists in DB, but NO profile/OAuth user linked): ${orphanedEmployees.length}`);
  orphanedEmployees.forEach((o, i) => {
    console.log(`  ${i + 1}. EmployeeID: ${o.employeeId} | Code: ${o.code} | Linked ProfileID: ${o.profileId} | Email: ${o.email} | Desig: ${o.designation}`);
  });

  console.log(`\n>>> 4. EMPTY / INCOMPLETE RECORDS: ${emptyOrIncomplete.length}`);
  emptyOrIncomplete.forEach((e, i) => {
    console.log(`  ${i + 1}. Type: ${e.type} | ID: ${e.id} | Reason: ${e.reason}`);
  });

  console.log('\n======================================================');
}

inspect().then(() => process.exit(0)).catch((err) => {
  console.error('Inspection error:', err);
  process.exit(1);
});
