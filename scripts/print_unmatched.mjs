import xlsx from 'xlsx';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

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

const app = initializeApp(firebaseConfig, 'PRINT_UNMATCHED');
const auth = getAuth(app);
const db = getFirestore(app);

const files = {
  'Shanti Memorial Hospital - Cuttack': {
    path: 'C:/Users/HP/.gemini/antigravity/brain/7f2ae8c6-bd83-4a4b-a046-dd3de2afa988/.user_uploaded/media_1794290832520_04b3108b.xlsx',
    workplaceId: 'wp-smh-main'
  },
  'Gopal Trust': {
    path: 'C:/Users/HP/.gemini/antigravity/brain/7f2ae8c6-bd83-4a4b-a046-dd3de2afa988/.user_uploaded/media_1794290832523_b67ad4a8.xlsx',
    workplaceId: 'wp-1793201564704'
  },
  'Chikitsa': {
    path: 'C:/Users/HP/.gemini/antigravity/brain/7f2ae8c6-bd83-4a4b-a046-dd3de2afa988/.user_uploaded/media_1794290832524_c86969ab.xlsx',
    workplaceId: 'wp-1793201579968'
  }
};

function normalizeCode(raw) {
  if (!raw) return '';
  return String(raw).replace(/[\s\-_]/g, '').toUpperCase();
}

async function check() {
  await signInWithEmailAndPassword(auth, 'clara.schmidt@oasis.io', 'Password@123');
  const empSnap = await getDocs(collection(db, 'employees'));
  const firestoreByNormCode = new Map();
  const firestoreByName = new Map();

  empSnap.forEach(d => {
    const data = d.data();
    const id = d.id;
    const normCode = normalizeCode(data.employee_code);
    if (normCode) firestoreByNormCode.set(normCode, { id, ...data });
    const normName = (data.full_name || '').trim().toLowerCase();
    if (normName) firestoreByName.set(normName, { id, ...data });
  });

  const unmatched = [];
  for (const [unitName, config] of Object.entries(files)) {
    const wb = xlsx.readFile(config.path);
    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const rows = xlsx.utils.sheet_to_json(ws, { defval: '' });
      for (const row of rows) {
        const code = String(row['EMP CODE'] || row['Employee Code'] || '').trim();
        const name = String(row['NAME'] || row['Full Name'] || '').trim();
        if (!code && !name) continue;
        const normCode = normalizeCode(code);
        const normName = name.trim().toLowerCase();

        if (!firestoreByNormCode.has(normCode) && !firestoreByName.has(normName)) {
          unmatched.push({ unitName, sheetName, code, name });
        }
      }
    }
  }

  console.log(`Total unmatched: ${unmatched.length}`);
  unmatched.forEach(u => console.log(`${u.unitName} [${u.sheetName}]: code="${u.code}", name="${u.name}"`));
}

check().catch(console.error);

