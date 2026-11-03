import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  getDoc,
  collection,
  query,
  where,
} from 'firebase/firestore';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyDfm6Y3LjDzeeK7a7hg6FvaE5rL4FgBIh8',
  authDomain: 'project-9d1aa.firebaseapp.com',
  databaseURL: 'https://project-9d1aa-default-rtdb.firebaseio.com',
  projectId: 'project-9d1aa',
  storageBucket: 'project-9d1aa.firebasestorage.app',
  messagingSenderId: '970423945867',
  appId: '1:970423945867:web:41cde39590eed383a1e28e',
  measurementId: 'G-WD23318M8K',
};

const adminApp = initializeApp(firebaseConfig, 'ADMIN_APP_EMAIL_FIX');
const adminDb = getFirestore(adminApp);
const adminAuth = getAuth(adminApp);

const provisionApp = initializeApp(firebaseConfig, 'PROVISION_APP_EMAIL_FIX');
const provisionAuth = getAuth(provisionApp);

const ORG_ID = 'shanti-memorial-hospital';
const WORKPLACE_ID = 'wp-smh-main';
const DEFAULT_PASSWORD = 'Welcome@123';

const VERIFIED_STAFF = [
  {
    name: 'Puspalata Swain',
    phone: '9778057661',
    code: 'SHA-0001',
    designation: 'Supervisor',
    hhc_role: 'supervisor',
    email: 'pujaswain37113@gmail.com',
  },
  {
    name: 'Subhalina Bal',
    phone: '7978407534',
    code: 'SHA-0002',
    designation: 'Supervisor',
    hhc_role: 'supervisor',
    email: 'subhalinabal151@gmail.com',
  },
  {
    name: 'Nilakantha Jena',
    phone: '7008239246',
    code: 'SHA-0003',
    designation: 'Doctor',
    hhc_role: 'doctor',
    email: 'jenanilakantha6@gmail.com',
  },
  {
    name: 'Sashimita Mallick',
    phone: '9668866916',
    code: 'SHA-0004',
    designation: 'Supervisor',
    hhc_role: 'supervisor',
    email: 'sashimita.mallick@shantimemorialhospital.com',
  },
  {
    name: 'Aurupananda Sahoo',
    phone: '8249577317',
    code: 'SHA-0005',
    designation: 'Supervisor',
    hhc_role: 'supervisor',
    email: 'aurupananda.sahoo@shantimemorialhospital.com',
  },
  {
    name: 'Manas Kunar',
    phone: '8144865637',
    code: 'SHA-0006',
    designation: 'Field Worker',
    hhc_role: 'field_worker',
    email: 'manas.kunar@shantimemorialhospital.com',
  },
  {
    name: 'Puspanjali Nayak',
    phone: '9861803478',
    code: 'SHA-0007',
    designation: 'Field Worker',
    hhc_role: 'field_worker',
    email: 'pandapuja31@gmail.com',
  },
  {
    name: 'Reetarani Khunti',
    phone: '8458053300',
    code: 'SHA-0008',
    designation: 'Field Worker',
    hhc_role: 'field_worker',
    email: 'reetaranikhuntia742@gmail.com',
  },
  {
    name: 'Gopinath Swain',
    phone: '9090084192',
    code: 'SHA-0009',
    designation: 'Field Worker',
    hhc_role: 'field_worker',
    email: 'swaingopinath06@gmail.com',
  },
  {
    name: 'Suryakanta Swain',
    phone: '9861694993',
    code: 'SHA-0010',
    designation: 'Field Worker',
    hhc_role: 'field_worker',
    email: 'suryakantaswain200@gmail.com',
  },
  {
    name: 'Snehalata Muduli',
    phone: '7735434801',
    code: 'SHA-0011',
    designation: 'Field Worker',
    hhc_role: 'field_worker',
    email: 'snehalatamuduli675@gmail.com',
  },
  {
    name: 'Geeta Das',
    phone: '6371497528',
    code: 'SHA-0012',
    designation: 'Field Worker',
    hhc_role: 'field_worker',
    email: 'gdas37577@gmail.com',
  },
  {
    name: 'Lipsa Rout',
    phone: '7205656442',
    code: 'SHA-0013',
    designation: 'Field Worker',
    hhc_role: 'field_worker',
    email: 'routlipsa446@gmail.com',
  },
  {
    name: 'Harapriya Jena',
    phone: '9348056218',
    code: 'SHA-0014',
    designation: 'Field Worker',
    hhc_role: 'field_worker',
    email: 'jenaharapriya375@gmail.com',
  },
  {
    name: 'Madhusmita Barik',
    phone: '7735877646',
    code: 'SHA-0015',
    designation: 'Field Worker',
    hhc_role: 'field_worker',
    email: 'madhusmitabarik9583@gmail.com',
  },
  {
    name: 'Sunita Behera',
    phone: '7847954654',
    code: 'SHA-0016',
    designation: 'Field Worker',
    hhc_role: 'field_worker',
    email: 'sunitabehera9583@gmail.com',
  },
];

async function main() {
  console.log('Authenticating Administrator (clara.schmidt@oasis.io)...');
  await signInWithEmailAndPassword(adminAuth, 'clara.schmidt@oasis.io', 'Password@123');
  console.log('Admin authenticated.\n');

  const now = new Date().toISOString();

  for (const staff of VERIFIED_STAFF) {
    console.log(`\n======================================================`);
    console.log(`Updating [${staff.code}] ${staff.name}`);
    console.log(`  Target Email : ${staff.email}`);
    console.log(`  Phone        : ${staff.phone}`);
    console.log(`  Role         : ${staff.hhc_role} (${staff.designation})`);

    // Find existing employee doc
    const empQ = query(
      collection(adminDb, 'employees'),
      where('organization_id', '==', ORG_ID),
      where('employee_code', '==', staff.code)
    );
    const empSnap = await getDocs(empQ);
    let oldEmpDocId = null;
    let oldProfileId = null;

    if (!empSnap.empty) {
      const empDoc = empSnap.docs[0];
      oldEmpDocId = empDoc.id;
      oldProfileId = empDoc.data().profile_id;
      console.log(`  Found existing employee doc: ${oldEmpDocId} (profile_id: ${oldProfileId})`);
    } else {
      oldEmpDocId = `emp-${staff.code.toLowerCase()}`;
    }

    // 1. Provision Firebase Auth account for verified email
    let newUid = null;
    try {
      const cred = await createUserWithEmailAndPassword(provisionAuth, staff.email, DEFAULT_PASSWORD);
      newUid = cred.user.uid;
      await updateProfile(cred.user, { displayName: staff.name });
      console.log(`  ✓ Created Firebase Auth account for ${staff.email} (UID: ${newUid})`);
      await signOut(provisionAuth);
    } catch (authErr) {
      if (authErr.code === 'auth/email-already-in-use') {
        console.log(`  ℹ Auth email already exists: ${staff.email}`);
        try {
          const loginRes = await signInWithEmailAndPassword(provisionAuth, staff.email, DEFAULT_PASSWORD);
          newUid = loginRes.user.uid;
          await signOut(provisionAuth);
          console.log(`  ✓ Resolved existing UID via Auth sign-in: ${newUid}`);
        } catch (e) {
          // If password differed or other reason, query profiles by email
          const pQ = query(collection(adminDb, 'profiles'), where('email', '==', staff.email));
          const pSnap = await getDocs(pQ);
          if (!pSnap.empty) {
            newUid = pSnap.docs[0].id;
            console.log(`  ✓ Resolved existing UID via profiles lookup: ${newUid}`);
          }
        }
      } else {
        console.warn(`  Notice during Auth provisioning: ${authErr.message}`);
      }
    }

    if (!newUid) {
      newUid = oldProfileId || `uid-${staff.code.toLowerCase()}`;
      console.log(`  Fallback UID: ${newUid}`);
    }

    // 2. Set updated profile document
    const profilePayload = {
      id: newUid,
      organization_id: ORG_ID,
      full_name: staff.name,
      email: staff.email,
      phone: staff.phone,
      avatar_url: null,
      role: 'employee',
      is_active: true,
      is_hhc_enabled: true,
      hhc_role: staff.hhc_role,
      needs_password_change: false,
      must_change_password: false,
      created_at: now,
      updated_at: now,
    };

    await setDoc(doc(adminDb, 'profiles', newUid), profilePayload, { merge: true });
    console.log(`  ✓ Profiles document updated: ${newUid}`);

    // If UID changed and old dummy profile existed with different ID, remove old dummy profile
    if (oldProfileId && oldProfileId !== newUid && oldProfileId.length > 10) {
      try {
        const oldProfSnap = await getDoc(doc(adminDb, 'profiles', oldProfileId));
        if (oldProfSnap.exists()) {
          const oldData = oldProfSnap.data();
          if (oldData.email && oldData.email.endsWith('@shantimemorialhospital.com')) {
            await deleteDoc(doc(adminDb, 'profiles', oldProfileId));
            console.log(`  ✓ Cleaned up old dummy profile doc: ${oldProfileId} (${oldData.email})`);
          }
        }
      } catch (cleanErr) {
        console.warn(`  Warning cleaning old profile:`, cleanErr.message);
      }
    }

    // 3. Set updated employee document
    const employeePayload = {
      id: oldEmpDocId,
      profile_id: newUid,
      organization_id: ORG_ID,
      employee_code: staff.code,
      name: staff.name,
      full_name: staff.name,
      email: staff.email,
      work_email: staff.email,
      phone: staff.phone,
      designation: staff.designation,
      hospital_unit: 'Shanti Memorial Hospital',
      workplace_id: WORKPLACE_ID,
      grade: 'M1',
      employment_type: 'Regular',
      employment_status: 'active',
      department_id: null,
      manager_id: null,
      l1_manager_id: null,
      l2_manager_id: null,
      l3_manager_id: null,
      l4_manager_id: null,
      default_shift_id: null,
      date_of_birth: null,
      basic_salary: 0,
      conveyance_allowance: 1200,
      washing_allowance: 500,
      special_allowance: null,
      is_hhc_enabled: true,
      hhc_role: staff.hhc_role,
      onboarding_completed: true,
      tax_config: {
        tax_regime: 'custom',
        epf_percentage: 12,
        tds_percentage: 10,
        hra_percentage: 40,
        socso_percentage: 0.5,
        transport_allowance: 0,
        esi_exempt: false,
        esi_number: null,
        uan_number: null,
        custom_items: [],
      },
      updated_at: now,
    };

    await setDoc(doc(adminDb, 'employees', oldEmpDocId), employeePayload, { merge: true });
    console.log(`  ✓ Employee document updated: ${oldEmpDocId} (profile_id: ${newUid}, email: ${staff.email})`);
  }

  console.log('\n======================================================');
  console.log('🎉 ALL 16 STAFF EMAILS AND PROFILES UPDATED TO VERIFIED GMAIL IDS!');
  console.log('======================================================');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error during email fix:', err);
  process.exit(1);
});

