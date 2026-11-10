import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
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

const app = initializeApp(firebaseConfig, 'CLEANUP_ORG_APP');
const db = getFirestore(app);
const auth = getAuth(app);

async function cleanOrgAndWorkplaces() {
  await signInWithEmailAndPassword(auth, 'clara.schmidt@oasis.io', 'Password@123');

  console.log('1. Updating organizations/shanti-memorial-hospital to enterprise title & modern units...');
  const enterpriseUnits = [
    'Primary HQ',
    'Regional Campus',
    'Operations Hub'
  ];

  await updateDoc(doc(db, 'organizations', 'shanti-memorial-hospital'), {
    name: 'Shanti Enterprise Group',
    units: enterpriseUnits,
    updated_at: new Date().toISOString(),
  });
  console.log('✓ Updated organizations/shanti-memorial-hospital -> Shanti Enterprise Group with units:', enterpriseUnits);

  // 2. Update workplaces to modern non-medical business locations
  const wpMap = {
    'wp-smh-main': 'Primary HQ',
    'wp-1793201564704': 'Regional Campus',
    'wp-1793201579968': 'Operations Hub'
  };

  for (const [wpId, wpName] of Object.entries(wpMap)) {
    const wpRef = doc(db, 'workplaces', wpId);
    const snap = await getDoc(wpRef);
    if (snap.exists()) {
      await updateDoc(wpRef, {
        name: wpName,
        organization_id: 'shanti-memorial-hospital',
        is_active: true,
        updated_at: new Date().toISOString(),
      });
      console.log(`✓ Updated workplace ${wpId} name -> ${wpName}`);
    }
  }

  // 3. Update any employee references to old medical unit names
  const empSnap = await getDocs(collection(db, 'employees'));
  let updatedEmps = 0;
  for (const d of empSnap.docs) {
    const data = d.data();
    let needsUpdate = false;
    const updatePayload = {};

    if (data.hospital_unit && (data.hospital_unit.includes('Hospital') || data.hospital_unit.includes('Chikitsa') || data.hospital_unit.includes('Gopal'))) {
      if (data.hospital_unit.includes('Chikitsa')) {
        updatePayload.hospital_unit = 'Regional Campus';
      } else if (data.hospital_unit.includes('Gopal')) {
        updatePayload.hospital_unit = 'Operations Hub';
      } else {
        updatePayload.hospital_unit = 'Primary HQ';
      }
      needsUpdate = true;
    }

    if (data.workplace?.name && (data.workplace.name.includes('Hospital') || data.workplace.name.includes('Chikitsa') || data.workplace.name.includes('Gopal'))) {
      updatePayload['workplace.name'] = 'Primary HQ';
      needsUpdate = true;
    }

    if (needsUpdate) {
      updatePayload.updated_at = new Date().toISOString();
      await updateDoc(doc(db, 'employees', d.id), updatePayload);
      updatedEmps++;
    }
  }
  console.log(`✓ Cleaned medical unit names across ${updatedEmps} employee record(s).`);
  console.log('✓ Successfully sanitized organization and workplaces!');
  process.exit(0);
}

cleanOrgAndWorkplaces().catch(err => {
  console.error(err);
  process.exit(1);
});

