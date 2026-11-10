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

const app = initializeApp(firebaseConfig, 'VERIFY_AUDIT');
const auth = getAuth(app);
const db = getFirestore(app);

async function verify() {
  await signInWithEmailAndPassword(auth, 'clara.schmidt@oasis.io', 'Password@123');

  // 1. Ayush
  const ayushSnap = await getDoc(doc(db, 'employees', 'L4c4JYqYXD9yZf5SZL0s'));
  const ayush = ayushSnap.data();
  console.log('--- AYUSH EMPLOYEE ---');
  console.log('Name:', ayush.full_name);
  console.log('Hospital Unit:', ayush.hospital_unit);
  console.log('Workplace Name:', ayush.workplace?.name);
  console.log('Workplace ID:', ayush.workplace_id);

  // 2. Aggregate
  const empSnap = await getDocs(collection(db, 'employees'));
  const unitStats = {};
  let primaryHqCount = 0;
  let regionalCampusCount = 0;
  let sampleShanti = null;
  let sampleGopal = null;
  let sampleChikitsa = null;

  empSnap.forEach(d => {
    const data = d.data();
    const u = data.hospital_unit || 'UNKNOWN';
    unitStats[u] = (unitStats[u] || 0) + 1;
    if (u === 'Primary HQ') primaryHqCount++;
    if (u === 'Regional Campus') regionalCampusCount++;

    if (u === 'Shanti Memorial Hospital - Cuttack' && !sampleShanti && data.gross_salary) sampleShanti = data;
    if (u === 'Gopal Trust' && !sampleGopal && data.gross_salary) sampleGopal = data;
    if (u === 'Chikitsa' && !sampleChikitsa && data.gross_salary) sampleChikitsa = data;
  });

  console.log('\n--- UNIT DISTRIBUTION ---');
  console.log(JSON.stringify(unitStats, null, 2));
  console.log('Primary HQ count:', primaryHqCount);
  console.log('Regional Campus count:', regionalCampusCount);

  console.log('\n--- SAMPLE MAPPED RECORDS ---');
  console.log('Shanti Sample:', sampleShanti.employee_code, sampleShanti.full_name, '| Gross:', sampleShanti.gross_salary, '| Basic:', sampleShanti.basic_salary, '| Bank:', sampleShanti.bank_details?.bank_name, '| UAN:', sampleShanti.uan_number);
  console.log('Gopal Sample:', sampleGopal.employee_code, sampleGopal.full_name, '| Gross:', sampleGopal.gross_salary, '| Basic:', sampleGopal.basic_salary, '| Bank:', sampleGopal.bank_details?.bank_name, '| UAN:', sampleGopal.uan_number);
  console.log('Chikitsa Sample:', sampleChikitsa.employee_code, sampleChikitsa.full_name, '| Gross:', sampleChikitsa.gross_salary, '| Basic:', sampleChikitsa.basic_salary, '| Bank:', sampleChikitsa.bank_details?.bank_name, '| UAN:', sampleChikitsa.uan_number);
}

verify().catch(console.error);

