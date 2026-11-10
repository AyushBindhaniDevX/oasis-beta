import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

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

const app = initializeApp(firebaseConfig, 'INSPECT_WP');
const auth = getAuth(app);
const db = getFirestore(app);

async function inspectWorkplaces() {
  await signInWithEmailAndPassword(auth, 'clara.schmidt@oasis.io', 'Password@123');

  const wps = ['wp-smh-main', 'wp-1793201564704', 'wp-1793201579968'];
  for (const id of wps) {
    const s = await getDoc(doc(db, 'workplaces', id));
    console.log(id, ':', JSON.stringify(s.data(), null, 2));
  }
}

inspectWorkplaces().catch(console.error);

