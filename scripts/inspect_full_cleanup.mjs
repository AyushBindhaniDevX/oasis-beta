import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDfm6Y3LjDzeeK7a7hg6FvaE5rL4FgBIh8",
  authDomain: "project-9d1aa.firebaseapp.com",
  projectId: "project-9d1aa",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function main() {
  await signInWithEmailAndPassword(auth, 'clara.schmidt@oasis.io', 'Password@123');
  console.log('--- AUTHENTICATED SUCCESSFULLY ---');

  const [profSnap, empSnap, wpSnap] = await Promise.all([
    getDocs(collection(db, 'profiles')),
    getDocs(collection(db, 'employees')),
    getDocs(collection(db, 'workplaces')),
  ]);

  const workplaces = [];
  wpSnap.forEach(d => workplaces.push({ id: d.id, ...d.data() }));

  const profiles = [];
  profSnap.forEach(d => profiles.push({ id: d.id, ...d.data() }));

  const employees = [];
  empSnap.forEach(d => employees.push({ id: d.id, ...d.data() }));

  console.log(`\n=== 1. WORKPLACES (${workplaces.length}) ===`);
  workplaces.forEach((w, i) => {
    console.log(`  [W${i+1}] ID: ${w.id} | Name: "${w.name}" | Address: "${w.address}" | Org: ${w.organization_id}`);
  });

  console.log('\n=== 2. EMPLOYEES LINKED TO "Headquarters" OR DEFAULTING TO Headquarters ===');
  employees.forEach((e, i) => {
    const rawUnit = e.hospital_unit;
    const wpObj = workplaces.find(w => w.id === e.workplace_id);
    const profObj = profiles.find(p => p.id === e.profile_id);
    if (!rawUnit || rawUnit.toLowerCase().includes('headquarter') || (!wpObj && (!rawUnit || rawUnit === 'Headquarters'))) {
      console.log(`  -> Emp ID: ${e.id} | Code: ${e.employee_code} | Name: ${profObj?.full_name || 'UNKNOWN'} | Email: ${e.email || profObj?.email} | hospital_unit: "${rawUnit}" | workplace_id: ${e.workplace_id} (matches wp: ${wpObj?.name || 'NONE'})`);
    }
  });

  console.log('\n=== 3. CHECKING ALL EMPLOYEES AND THEIR UNITS ===');
  employees.forEach((e, i) => {
    const prof = profiles.find(p => p.id === e.profile_id);
    console.log(`  [E${i+1}] ID: ${e.id} | Code: ${e.employee_code} | ProfID: ${e.profile_id} | Name: ${prof?.full_name || 'NO_PROF'} | Email: ${e.email || prof?.email} | Unit: "${e.hospital_unit}" | WP: ${e.workplace_id}`);
  });

  console.log('\n=== 4. CHECKING PROFILES TO AUTH STATUS ===');
  // From our earlier verified auth check:
  // We tested all 45 emails against Firebase Auth
  const notInAuthEmails = new Set([
    'david.kim@oasis.io',
    'vikram.m@oasis.io',
    'michael.chang@oasis.io',
    'rohan.verma@oasis.io',
    'fatima.z@oasis.io',
    'elena.r@oasis.io',
    'admin@oasis.io',
    'ananya.d@oasis.io',
    'daniel.santos@oasis.io',
    'kevin.chen@oasis.io'
  ]);

  console.log('\n=== 5. COMPLETE MAPPING & THREE-WAY LINKAGE CHECK ===');
  // For each employee:
  //  - Check if profile exists
  //  - Check if auth exists
  // For each profile:
  //  - Check if employee exists
  //  - Check if auth exists

  const fullTriplets = [];
  const incompleteRecords = [];

  // Map by profile_id and email
  for (const p of profiles) {
    const emailLower = (p.email || '').toLowerCase().trim();
    const hasAuth = emailLower && !notInAuthEmails.has(emailLower);
    
    // Find matching employee by profile_id or email
    const matchedEmp = employees.find(e => 
      e.profile_id === p.id || 
      (e.email && e.email.toLowerCase().trim() === emailLower) ||
      (e.work_email && e.work_email.toLowerCase().trim() === emailLower)
    );

    const isEmpEmpty = matchedEmp ? (!matchedEmp.employee_code && !matchedEmp.designation) : false;
    const isProfileEmpty = !p.email && !p.full_name;

    if (hasAuth && matchedEmp && !isEmpEmpty && !isProfileEmpty && p.id !== 'emp-1015' && p.id !== 'emp-1018' && p.id !== 'emp-1023' && p.id !== 'emp-1025' && p.id !== 'emp-1028') {
      fullTriplets.push({
        profile: p,
        employee: matchedEmp,
        authEmail: p.email,
      });
    } else {
      incompleteRecords.push({
        profileId: p.id,
        profileEmail: p.email,
        profileName: p.full_name,
        hasAuth,
        matchedEmployeeId: matchedEmp?.id,
        matchedEmployeeCode: matchedEmp?.employee_code,
        reason: [
          !hasAuth ? 'MISSING_FROM_FIREBASE_AUTH' : null,
          !matchedEmp ? 'NO_LINKED_EMPLOYEE' : null,
          isProfileEmpty ? 'EMPTY_PROFILE' : null,
          isEmpEmpty ? 'EMPTY_EMPLOYEE' : null,
          p.id.startsWith('emp-') ? 'DUPLICATE_PROFILE_WITH_EMP_ID' : null
        ].filter(Boolean).join(', ')
      });
    }
  }

  // Also check for employees with NO profile
  const orphanedEmployees = employees.filter(e => {
    const hasProf = profiles.some(p => p.id === e.profile_id);
    return !hasProf;
  });

  console.log(`\n>>> FULLY VALID TRIPLETS (Auth + DB Profile + Employee data all present and linked): ${fullTriplets.length}`);
  fullTriplets.forEach((t, i) => {
    console.log(`  ${i+1}. [${t.authEmail}] Name: ${t.profile.full_name} | Role: ${t.profile.role} | Prof ID: ${t.profile.id} | Emp ID: ${t.employee.id} (${t.employee.employee_code}) | Unit: ${t.employee.hospital_unit}`);
  });

  console.log(`\n>>> CANDIDATE PROFILES FOR DELETION (Missing Auth, Missing Emp, Empty, or Duplicate): ${incompleteRecords.length}`);
  incompleteRecords.forEach((r, i) => {
    console.log(`  ${i+1}. Profile ID: ${r.profileId} | Email: ${r.profileEmail} | Name: ${r.profileName} | Reason: [${r.reason}] | Emp: ${r.matchedEmployeeId || 'NONE'}`);
  });

  console.log(`\n>>> EMPLOYEES WITH NO MATCHING DB PROFILE: ${orphanedEmployees.length}`);
  orphanedEmployees.forEach((e, i) => {
    console.log(`  ${i+1}. Emp ID: ${e.id} | Code: ${e.employee_code} | ProfileID in doc: ${e.profile_id} | Unit: ${e.hospital_unit}`);
  });

}

main().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
