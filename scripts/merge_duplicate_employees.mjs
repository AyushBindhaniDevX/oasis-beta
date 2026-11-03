import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

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

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);

// Pairs to merge: [oldDuplicateEmployeeId, primaryEmployeeId, activeAuthUid]
const MERGE_PAIRS = [
  {
    name: 'Subhalina Bal (Supervisor)',
    oldEmpId: 'emp-sha-0002',
    primaryEmpId: 'emp-smh-csmhr015',
    activeAuthUid: 'EEwqSCA72lYPpXGoLxgo6s5jGX73',
    fallbackPhone: '7978407534',
    email: 'subhalinabal151@gmail.com',
    hhcRole: 'supervisor',
  },
  {
    name: 'Lipsa Rout (Incharge)',
    oldEmpId: 'emp-sha-0013',
    primaryEmpId: 'emp-smh-csmhr017',
    activeAuthUid: 'ZnXzH7A5qPXXQ5ZJI4XQ6OAL1pK2',
    fallbackPhone: '7205656442',
    email: 'routlipsa446@gmail.com',
    hhcRole: 'field_worker',
  },
  {
    name: 'Madhusmita Barik (Staff Nurse)',
    oldEmpId: 'emp-sha-0015',
    primaryEmpId: 'emp-smh-csmh112',
    activeAuthUid: 'auth-csmh112', // or profile id
    fallbackPhone: '7735877646',
    email: 'madhusmitabarik9583@gmail.com',
    hhcRole: 'field_worker',
  },
  {
    name: 'Nilakantha Jena (Pharmacist)',
    oldEmpId: 'emp-sha-0003',
    primaryEmpId: 'emp-smh-csmhr010',
    activeAuthUid: 'NRuDPvkcAjVQoCTnjwHuxANQbw42',
    fallbackPhone: '7008239246',
    email: 'jenanilakantha6@gmail.com',
    hhcRole: 'doctor',
  },
  {
    name: 'Sunita Behera (Staff Nurse)',
    oldEmpId: 'emp-sha-0016',
    primaryEmpId: 'emp-smh-csmh034',
    activeAuthUid: 'yl2jB8rF3UTaweHUh1iFbWJ6oH12',
    fallbackPhone: '7853998339',
    secondaryPhone: '7847954654',
    email: 'sunitabehera9583@gmail.com',
    hhcRole: 'field_worker',
  },
];

async function mergeAll() {
  console.log('========================================================');
  console.log('🔄 Merging Duplicate Employees & Profiles in Firestore');
  console.log('========================================================\n');

  await signInWithEmailAndPassword(auth, 'clara.schmidt@oasis.io', 'Password@123');
  console.log('✅ Authenticated as Administrator.\n');

  const now = new Date().toISOString();

  for (const item of MERGE_PAIRS) {
    console.log(`Merging: ${item.name}`);
    console.log(`  Old Doc: [${item.oldEmpId}] ---> Primary Doc: [${item.primaryEmpId}]`);

    const oldEmpDoc = await getDoc(doc(db, 'employees', item.oldEmpId));
    const priEmpDoc = await getDoc(doc(db, 'employees', item.primaryEmpId));

    if (!priEmpDoc.exists()) {
      console.warn(`  ⚠️ Primary doc ${item.primaryEmpId} not found, skipping.`);
      continue;
    }

    const oldData = oldEmpDoc.exists() ? oldEmpDoc.data() : {};
    const priData = priEmpDoc.data();

    // Use activeAuthUid if valid, or keep primary profile_id
    let targetProfileId = priData.profile_id;
    if (item.activeAuthUid && !item.activeAuthUid.startsWith('auth-')) {
      targetProfileId = item.activeAuthUid;
    } else if (oldData.profile_id && !oldData.profile_id.startsWith('auth-')) {
      targetProfileId = oldData.profile_id;
    }

    // Merged Employee Payload
    const mergedEmpPayload = {
      ...oldData,
      ...priData,
      id: item.primaryEmpId,
      profile_id: targetProfileId,
      email: item.email,
      work_email: item.email,
      phone: priData.phone || item.fallbackPhone || oldData.phone || null,
      is_hhc_enabled: true,
      hhc_role: item.hhcRole || priData.hhc_role || oldData.hhc_role || null,
      updated_at: now,
    };

    // Merged Profile Payload
    const mergedProfPayload = {
      id: targetProfileId,
      organization_id: priData.organization_id || 'shanti-memorial-hospital',
      full_name: priData.full_name || priData.name || oldData.full_name || oldData.name || item.name,
      email: item.email,
      phone: mergedEmpPayload.phone,
      role: 'employee',
      is_active: true,
      is_hhc_enabled: true,
      hhc_role: mergedEmpPayload.hhc_role,
      needs_password_change: false,
      must_change_password: false,
      updated_at: now,
    };

    // Save to Firestore
    await setDoc(doc(db, 'employees', item.primaryEmpId), mergedEmpPayload, { merge: true });
    await setDoc(doc(db, 'profiles', targetProfileId), mergedProfPayload, { merge: true });

    // Clean up old duplicate employee document
    if (oldEmpDoc.exists()) {
      await deleteDoc(doc(db, 'employees', item.oldEmpId));
      console.log(`  🗑️ Deleted obsolete duplicate employee: ${item.oldEmpId}`);
    }

    // Clean up temporary profile doc if distinct from targetProfileId
    if (priData.profile_id && priData.profile_id !== targetProfileId && priData.profile_id.startsWith('auth-')) {
      try {
        await deleteDoc(doc(db, 'profiles', priData.profile_id));
        console.log(`  🗑️ Cleaned up placeholder profile: ${priData.profile_id}`);
      } catch (e) {}
    }

    console.log(`  ✅ Successfully merged into [${item.primaryEmpId}] (Profile: ${targetProfileId})`);
  }

  console.log('\n========================================================');
  console.log('🎉 Duplicate merging completed successfully!');
  console.log('========================================================\n');
  process.exit(0);
}

mergeAll().catch(e => {
  console.error('Merge failed:', e);
  process.exit(1);
});
