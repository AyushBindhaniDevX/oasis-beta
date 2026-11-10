import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';

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

const app = initializeApp(firebaseConfig, 'INSPECT_APP');
const auth = getAuth(app);
const db = getFirestore(app);

async function inspect() {
  await signInWithEmailAndPassword(auth, 'clara.schmidt@oasis.io', 'Password@123');
  console.log('Authenticated as clara.schmidt@oasis.io');

  // Workplaces
  const wpSnap = await getDocs(collection(db, 'workplaces'));
  console.log('\n--- WORKPLACES ---');
  wpSnap.forEach(d => {
    console.log(d.id, '->', d.data().name, '| org:', d.data().organization_id, '| address:', d.data().address);
  });

  // Organization
  const orgDoc = await getDoc(doc(db, 'organizations', 'shanti-memorial-hospital'));
  console.log('\n--- ORGANIZATION: shanti-memorial-hospital ---');
  if (orgDoc.exists()) {
    console.log(JSON.stringify(orgDoc.data(), null, 2));
  } else {
    console.log('Not found!');
  }

  // Employees units breakdown
  const empSnap = await getDocs(collection(db, 'employees'));
  console.log(`\n--- EMPLOYEES: Total ${empSnap.size} ---`);
  const unitCounts = {};
  const wpCounts = {};
  empSnap.forEach(d => {
    const data = d.data();
    const unit = data.hospital_unit || 'UNKNOWN';
    const wp = data.workplace_id || 'NO_WP';
    unitCounts[unit] = (unitCounts[unit] || 0) + 1;
    wpCounts[wp] = (wpCounts[wp] || 0) + 1;
  });
  console.log('Unit breakdown:', unitCounts);
  console.log('Workplace breakdown:', wpCounts);
}

inspect().catch(console.error);
