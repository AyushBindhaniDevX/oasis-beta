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

const app = initializeApp(firebaseConfig, 'LINK_UNITS_APP');
const db = getFirestore(app);
const auth = getAuth(app);

async function linkUnits() {
  await signInWithEmailAndPassword(auth, 'clara.schmidt@oasis.io', 'Password@123');

  console.log('1. Updating organizations/shanti-memorial-hospital units array...');
  const units = [
    'Shanti Memorial Hospital',
    'Chikitsa',
    'Gopal Trust',
    'Home Health Care (HHC) Unit',
    'Main Branch',
  ];
  await updateDoc(doc(db, 'organizations', 'shanti-memorial-hospital'), {
    units,
    updated_at: new Date().toISOString(),
  });
  console.log('✓ Updated organizations/shanti-memorial-hospital units to:', units);

  // 2. Ensure all 3 workplaces have organization_id: 'shanti-memorial-hospital'
  const smhWps = ['wp-smh-main', 'wp-1793201564704', 'wp-1793201579968'];
  for (const wpId of smhWps) {
    const wpRef = doc(db, 'workplaces', wpId);
    const snap = await getDoc(wpRef);
    if (snap.exists()) {
      await updateDoc(wpRef, {
        organization_id: 'shanti-memorial-hospital',
        is_active: true,
        updated_at: new Date().toISOString(),
      });
      console.log(`✓ Verified & updated workplace ${wpId} (${snap.data().name}) -> org: shanti-memorial-hospital`);
    }
  }

  // 3. Link all employees of Shanti Memorial Hospital, Chikitsa, Gopal Trust to shanti-memorial-hospital
  const empSnap = await getDocs(collection(db, 'employees'));
  let updatedEmps = 0;
  for (const d of empSnap.docs) {
    const data = d.data();
    const u = (data.hospital_unit || '').trim();
    const isShantiUnit = u.includes('Shanti') || u.includes('Chikitsa') || u.includes('Gopal');
    if (isShantiUnit && data.organization_id !== 'shanti-memorial-hospital') {
      await updateDoc(doc(db, 'employees', d.id), {
        organization_id: 'shanti-memorial-hospital',
        updated_at: new Date().toISOString(),
      });
      updatedEmps++;
    }
  }
  console.log(`✓ Checked employees. Updated ${updatedEmps} employee(s) to organization_id: 'shanti-memorial-hospital'.`);

  // 4. Also check profiles
  const profSnap = await getDocs(collection(db, 'profiles'));
  let updatedProfs = 0;
  for (const d of profSnap.docs) {
    const data = d.data();
    // If user is Ayush or Jyotirani, ensure organization_id is shanti-memorial-hospital
    if (data.email === 'ayushbindhani001@gmail.com' || data.email === 'jyotirani.rout@gmail.com') {
      if (data.organization_id !== 'shanti-memorial-hospital') {
        await updateDoc(doc(db, 'profiles', d.id), {
          organization_id: 'shanti-memorial-hospital',
          updated_at: new Date().toISOString(),
        });
        updatedProfs++;
        console.log(`✓ Set ${data.email} profile organization_id to shanti-memorial-hospital`);
      }
    }
  }

  console.log('✓ Done!');
  process.exit(0);
}

linkUnits().catch(err => {
  console.error(err);
  process.exit(1);
});

