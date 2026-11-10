import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDfm6Y3LjDzeeK7a7hg6FvaE5rL4FgBIh8",
  authDomain: "oasis-hrms-v2.firebaseapp.com",
  projectId: "oasis-hrms-v2",
  storageBucket: "oasis-hrms-v2.firebasestorage.app",
  messagingSenderId: "305260271501",
  appId: "1:305260271501:web:2120023ee459ef48fc7716"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function testAuth() {
  const users = [
    { email: 'ayushbindhani001@gmail.com', pass: 'Nanda@5152' },
    { email: 'clara.schmidt@oasis.io', pass: 'Password@123' },
    { email: 'admin@oasis.io', pass: 'Password@123' }
  ];

  for (const u of users) {
    try {
      const res = await signInWithEmailAndPassword(auth, u.email, u.pass);
      console.log(`Success login: ${u.email} (UID: ${res.user.uid})`);
      
      // try reading a doc
      try {
        const wpSnap = await getDocs(collection(db, 'workplaces'));
        console.log(`  -> Firestore read success! Found ${wpSnap.size} workplaces.`);
        wpSnap.forEach(d => console.log('    ', d.id, d.data().name));
        return; // done
      } catch (fErr) {
        console.log(`  -> Firestore read failed for ${u.email}:`, fErr.message);
      }
    } catch (err) {
      console.log(`Failed login: ${u.email}:`, err.message);
    }
  }
}

testAuth();

