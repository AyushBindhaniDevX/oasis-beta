import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';

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

const app = initializeApp(firebaseConfig, 'FIND_AYUSH');
const auth = getAuth(app);
const db = getFirestore(app);

async function findAyush() {
  await signInWithEmailAndPassword(auth, 'clara.schmidt@oasis.io', 'Password@123');

  const empSnap = await getDocs(collection(db, 'employees'));
  console.log('Searching employees for Ayush...');
  empSnap.forEach(d => {
    const data = d.data();
    if ((data.full_name && data.full_name.toLowerCase().includes('ayush')) ||
        (data.email && data.email.toLowerCase().includes('ayush'))) {
      console.log('Found employee:', d.id, JSON.stringify(data, null, 2));
    }
  });

  const profSnap = await getDocs(collection(db, 'profiles'));
  console.log('\nSearching profiles for Ayush...');
  profSnap.forEach(d => {
    const data = d.data();
    if ((data.full_name && data.full_name.toLowerCase().includes('ayush')) ||
        (data.email && data.email.toLowerCase().includes('ayush'))) {
      console.log('Found profile:', d.id, JSON.stringify(data, null, 2));
    }
  });
}

findAyush().catch(console.error);

