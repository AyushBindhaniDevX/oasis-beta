import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, deleteDoc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDfm6Y3LjDzeeK7a7hg6FvaE5rL4FgBIh8",
  authDomain: "project-9d1aa.firebaseapp.com",
  projectId: "project-9d1aa",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Complete List of Deletion Candidates based on 3-way check (Auth + Profile + Employee):
export const DELETION_PLAN = {
  // 1. Headquarters Orphan/Duplicate Employee Record
  headquartersEmployee: [
    {
      collection: 'employees',
      id: 'emp-1793203364948',
      reason: 'Assigned to nonexistent "Headquarters" unit; duplicate employee record for Amulya Bindhani (active record is emp-1792574487798 in Gopal Trust)',
      email: 'amulya.bindhani@cordeliatech.com',
      code: 'EMP-7820'
    }
  ],

  // 2. Empty Employee Records
  emptyEmployees: [
    { collection: 'employees', id: 'emp-smh-0002', reason: 'Completely empty {} document with no profile, auth or employee data' },
    { collection: 'employees', id: 'emp-smh-0006', reason: 'Completely empty {} document with no profile, auth or employee data' },
    { collection: 'employees', id: 'emp-smh-0010', reason: 'Completely empty {} document with no profile, auth or employee data' },
  ],

  // 3. Duplicate Employee Record
  duplicateEmployees: [
    {
      collection: 'employees',
      id: 'emp-1793201872333',
      reason: 'Duplicate employee record for Ayush Bin created 3ms after original emp-1793201872330',
      email: 'ab3682@srmist.edu.in',
      code: 'EMP-8503'
    }
  ],

  // 4. Duplicate Profiles (stored under employee ID instead of Auth UID)
  duplicateProfiles: [
    { collection: 'profiles', id: 'emp-1015', reason: 'Duplicate profile key using employee ID; genuine profile is RKwtUYqsZkQIWoiB4FC9ITAcNIy1', email: 'elena.r@oasis.io' },
    { collection: 'profiles', id: 'emp-1018', reason: 'Duplicate profile key using employee ID; genuine profile is nmarOw0NWLQRMmMhEA9ZLWTrU7O2', email: 'james.wilson@oasis.io' },
    { collection: 'profiles', id: 'emp-1023', reason: 'Duplicate profile key using employee ID; genuine profile is DTc7Y2HZJtcvZFp8cQutRPEdYLR2', email: 'emily.watson@oasis.io' },
    { collection: 'profiles', id: 'emp-1025', reason: 'Duplicate profile key using employee ID; genuine profile is IzD2UquDcMZbFFKntKnirQT5hyR2', email: 'fatima.z@oasis.io' },
    { collection: 'profiles', id: 'emp-1028', reason: 'Duplicate profile key using employee ID; genuine profile is mm4IfHxQRHMzqk4u01E6l3BmNx92', email: 'gabriel.costa@oasis.io' },
  ],

  // 5. Orphaned Profile with NO Employee Data
  orphanedProfiles: [
    { collection: 'profiles', id: 'mm4IfHxQRHMzqk4u01E6l3BmNx92', reason: 'Profile exists in DB but has no linked employee data in employees collection', email: 'gabriel.costa@oasis.io', name: 'Gabriel Costa' },
  ],

  // 6. Profiles & Employees with NO Account in Firebase Auth
  unauthenticatedSeedData: [
    { collection: 'profiles', id: 'gIj36N7LqzfwabCFb8zUKFFadEx2', reason: 'User not registered in Firebase Auth', email: 'admin@oasis.io', name: 'Alexander Wright' },
    { collection: 'employees', id: 'emp-1001', reason: 'Linked profile not registered in Firebase Auth', email: 'admin@oasis.io', code: 'EMP-1001' },

    { collection: 'profiles', id: '3BuFvWn7a3S7hJfl5KtanST3f7b2', reason: 'User not registered in Firebase Auth', email: 'david.kim@oasis.io', name: 'David Kim' },
    { collection: 'employees', id: 'emp-1005', reason: 'Linked profile not registered in Firebase Auth', email: 'david.kim@oasis.io', code: 'EMP-1005' },

    { collection: 'profiles', id: 'i5nz8cPjJnSwIHIEnlAhG2hbILl1', reason: 'User not registered in Firebase Auth', email: 'ananya.d@oasis.io', name: 'Ananya Deshmukh' },
    { collection: 'employees', id: 'emp-1006', reason: 'Linked profile not registered in Firebase Auth', email: 'ananya.d@oasis.io', code: 'EMP-1006' },

    { collection: 'profiles', id: '5YsualVm7RhhaWNdQGv88jBHbfj1', reason: 'User not registered in Firebase Auth', email: 'vikram.m@oasis.io', name: 'Vikram Malhotra' },
    { collection: 'employees', id: 'emp-1007', reason: 'Linked profile not registered in Firebase Auth', email: 'vikram.m@oasis.io', code: 'EMP-1007' },

    { collection: 'profiles', id: 'zGFYdwi77rduyPyUHF0rlM89Wn43', reason: 'User not registered in Firebase Auth', email: 'kevin.chen@oasis.io', name: 'Kevin Chen' },
    { collection: 'employees', id: 'emp-1011', reason: 'Linked profile not registered in Firebase Auth', email: 'kevin.chen@oasis.io', code: 'EMP-1011' },

    { collection: 'profiles', id: 'pFfhtt10ypadCVaOUzEDfVEiZwo2', reason: 'User not registered in Firebase Auth', email: 'daniel.santos@oasis.io', name: 'Daniel Santos' },
    { collection: 'employees', id: 'emp-1013', reason: 'Linked profile not registered in Firebase Auth', email: 'daniel.santos@oasis.io', code: 'EMP-1013' },

    { collection: 'profiles', id: 'HJ0JBej47cR085vuICl5frxDPct2', reason: 'User not registered in Firebase Auth', email: 'rohan.verma@oasis.io', name: 'Rohan Verma' },
    { collection: 'employees', id: 'emp-1014', reason: 'Linked profile not registered in Firebase Auth', email: 'rohan.verma@oasis.io', code: 'EMP-1014' },

    { collection: 'profiles', id: 'RKwtUYqsZkQIWoiB4FC9ITAcNIy1', reason: 'User not registered in Firebase Auth', email: 'elena.r@oasis.io', name: 'Elena Rostova' },
    { collection: 'employees', id: 'emp-1015', reason: 'Linked profile not registered in Firebase Auth', email: 'elena.r@oasis.io', code: 'EMP-1015' },

    { collection: 'profiles', id: 'B3YDxgpfEgOV8b1tL1qvbIlsPEz2', reason: 'User not registered in Firebase Auth', email: 'michael.chang@oasis.io', name: 'Michael Chang' },
    { collection: 'employees', id: 'emp-1024', reason: 'Linked profile not registered in Firebase Auth', email: 'michael.chang@oasis.io', code: 'EMP-1024' },

    { collection: 'profiles', id: 'IzD2UquDcMZbFFKntKnirQT5hyR2', reason: 'User not registered in Firebase Auth', email: 'fatima.z@oasis.io', name: 'Fatima Zahra' },
    { collection: 'employees', id: 'emp-1025', reason: 'Linked profile not registered in Firebase Auth', email: 'fatima.z@oasis.io', code: 'EMP-1025' },
  ]
};

async function run() {
  const isApply = process.argv.includes('--apply');
  console.log(`MODE: ${isApply ? 'APPLY (EXECUTING DELETIONS)' : 'DRY-RUN (PREVIEW ONLY)'}`);

  await signInWithEmailAndPassword(auth, 'clara.schmidt@oasis.io', 'Password@123');

  const allItems = [
    ...DELETION_PLAN.headquartersEmployee,
    ...DELETION_PLAN.emptyEmployees,
    ...DELETION_PLAN.duplicateEmployees,
    ...DELETION_PLAN.duplicateProfiles,
    ...DELETION_PLAN.orphanedProfiles,
    ...DELETION_PLAN.unauthenticatedSeedData,
  ];

  console.log(`Total documents queued for deletion: ${allItems.length}`);

  let existingCount = 0;
  for (const item of allItems) {
    const docRef = doc(db, item.collection, item.id);
    const snap = await getDoc(docRef);
    const status = snap.exists() ? 'EXISTS' : 'ALREADY_DELETED';
    if (snap.exists()) existingCount++;

    console.log(`[${status}] [${item.collection.toUpperCase()}] ID: ${item.id} | Info: ${item.email || item.code || ''} | Reason: ${item.reason}`);

    if (isApply && snap.exists()) {
      await deleteDoc(docRef);
      console.log(`   -> DELETED ${item.collection}/${item.id}`);
    }
  }

  console.log(`\nSummary: ${existingCount} docs exist in DB out of ${allItems.length} queued.`);
  if (!isApply) {
    console.log('\nDRY-RUN COMPLETE. No documents were deleted. Pass --apply to execute.');
  } else {
    console.log('\nAPPLY COMPLETE. All specified documents have been deleted.');
  }
}

run().then(() => process.exit(0)).catch(err => {
  console.error('Execution error:', err);
  process.exit(1);
});
