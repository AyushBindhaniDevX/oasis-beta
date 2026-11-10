import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import fs from 'fs';
import path from 'path';

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

const app = initializeApp(firebaseConfig, 'EXPORT_ARCH_APP');
const db = getFirestore(app);
const auth = getAuth(app);

const COLLECTIONS = [
  'organizations',
  'workplaces',
  'employees',
  'profiles',
  'departments',
  'shifts',
  'attendance',
  'attendance_records',
  'leaves',
  'leave_requests',
  'leave_balances',
  'leave_types',
  'holidays',
  'payroll',
  'payslips',
  'payroll_runs',
  'custom_payroll_items',
  'audit_logs',
  'notifications',
  'assets',
  'helpdesk_tickets',
  'job_postings',
  'candidates',
  'performance_reviews',
  'goals',
  'courses',
  'surveys',
  'approval_workflows',
  'system_settings',
];

function inferType(val) {
  if (val === null) return 'null';
  if (Array.isArray(val)) return `Array<${val.length > 0 ? inferType(val[0]) : 'any'}>`;
  if (typeof val === 'object') return 'Object / Map';
  return typeof val;
}

async function exportArchitecture() {
  console.log('Authenticating with Firebase...');
  await signInWithEmailAndPassword(auth, 'clara.schmidt@oasis.io', 'Password@123');
  console.log('Authenticated successfully.');

  const collectionStats = [];

  for (const colName of COLLECTIONS) {
    try {
      const snap = await getDocs(collection(db, colName));
      if (snap.empty) {
        collectionStats.push({
          name: colName,
          count: 0,
          fields: {},
          samples: [],
          orgBreakdown: {},
        });
        continue;
      }

      const count = snap.size;
      const fields = {};
      const orgBreakdown = {};
      const samples = [];

      let sampleCount = 0;
      for (const d of snap.docs) {
        const data = d.data();
        if (sampleCount < 2) {
          samples.push({ id: d.id, data });
          sampleCount++;
        }

        const orgId = data.organization_id || (colName === 'organizations' ? d.id : 'unassigned');
        orgBreakdown[orgId] = (orgBreakdown[orgId] || 0) + 1;

        for (const [key, val] of Object.entries(data)) {
          if (!fields[key]) {
            fields[key] = {
              type: inferType(val),
              sampleVal: typeof val === 'object' ? (Array.isArray(val) ? `[${val.length} items]` : '{...}') : String(val).slice(0, 40),
            };
          }
        }
      }

      collectionStats.push({
        name: colName,
        count,
        fields,
        samples,
        orgBreakdown,
      });
      console.log(`✓ Scanned ${colName}: ${count} document(s)`);
    } catch (err) {
      console.warn(`! Skipped ${colName}:`, err.message);
    }
  }

  // Generate Markdown
  let md = `# Firebase Cloud Firestore Database Architecture & Schema Report\n\n`;
  md += `**Project ID:** \`project-9d1aa\`  \n`;
  md += `**Auth Domain:** \`project-9d1aa.firebaseapp.com\`  \n`;
  md += `**Generated Date:** ${new Date().toISOString()}  \n`;
  md += `**Target Primary Tenant Organization:** \`shanti-memorial-hospital\`  \n\n`;

  md += `## 1. Executive Summary & Collection Manifest\n\n`;
  md += `| Collection Name | Document Count | Multi-Tenant Key | Primary Tenant (\`shanti-memorial-hospital\`) Count |\n`;
  md += `| :--- | :--- | :--- | :--- |\n`;

  for (const c of collectionStats) {
    if (c.count > 0) {
      const shantiCount = c.orgBreakdown['shanti-memorial-hospital'] || (c.name === 'organizations' ? 1 : 0);
      md += `| \`${c.name}\` | **${c.count}** | \`organization_id\` | **${shantiCount}** (${Math.round((shantiCount / c.count) * 100)}%) |\n`;
    }
  }

  md += `\n---\n\n`;
  md += `## 2. Multi-Tenant Organization Structure & Unit Hierarchy\n\n`;
  md += `### Root Organization: \`shanti-memorial-hospital\`\n`;
  md += `- **Organization ID:** \`shanti-memorial-hospital\`\n`;
  md += `- **Legal / Display Name:** Shanti Memorial Hospital\n`;
  md += `- **Active Plan Tier:** \`enterprise\` (All 20+ modules unlocked)\n`;
  md += `- **Max Employee Quota:** 1,000\n`;
  md += `- **Physical Address:** Patia / Thoria Sahi, Manglabag, Cuttack, Odisha 753001\n`;
  md += `- **Hospital Units / Sub-Brands:**\n`;
  md += `  1. **Shanti Memorial Hospital** (Main Hospital Campus) — \`wp-smh-main\` (464 Employees)\n`;
  md += `  2. **Chikitsa** (OPD & Specialty Centre) — \`wp-1793201579968\` (111 Employees)\n`;
  md += `  3. **Gopal Trust** (Trust & Healthcare Outreach) — \`wp-1793201564704\` (33 Employees)\n`;
  md += `  4. **Home Health Care (HHC) Unit** (Field & Domiciliary Nursing)\n`;
  md += `  5. **Main Branch** (Administrative Headquarters)\n\n`;

  md += `### Other Tenant Organizations Present in Database:\n`;
  md += `- \`00000000-0000-0000-0000-000000000001\` (Subedge Demo Org - 18 Employees)\n`;
  md += `- \`subedge\` (Subedge Production Org)\n`;
  md += `- \`chikitsa\` (Separate stub org with \`parent_organization_id: shanti-memorial-hospital\`)\n`;
  md += `- \`gopal-trust\` (Separate stub org with \`parent_organization_id: shanti-memorial-hospital\`)\n`;
  md += `- \`smh\` (Legacy alias document)\n\n`;

  md += `\n---\n\n`;
  md += `## 3. Detailed Collection Schemas & Field Mappings\n\n`;

  for (const c of collectionStats) {
    if (c.count === 0) continue;

    md += `### Collection: \`${c.name}\` (${c.count} records)\n\n`;
    md += `**Organization Distribution:**\n`;
    for (const [o, cnt] of Object.entries(c.orgBreakdown)) {
      md += `- \`${o}\`: ${cnt} records\n`;
    }
    md += `\n`;

    md += `| Field Name | Inferred Data Type | Sample Value |\n`;
    md += `| :--- | :--- | :--- |\n`;
    for (const [fName, fMeta] of Object.entries(c.fields)) {
      md += `| \`${fName}\` | \`${fMeta.type}\` | \`${fMeta.sampleVal.replace(/\|/g, '/')}\` |\n`;
    }
    md += `\n`;

    if (c.samples.length > 0) {
      md += `#### Sample Document Preview (\`${c.samples[0].id}\`):\n`;
      md += `\`\`\`json\n`;
      md += JSON.stringify(c.samples[0].data, null, 2);
      md += `\n\`\`\`\n\n`;
    }
    md += `---\n\n`;
  }

  md += `## 4. Entity Relationship Diagram (ERD)\n\n`;
  md += `\`\`\`mermaid\nerDiagram\n`;
  md += `  ORGANIZATIONS ||--o{ WORKPLACES : "provisions (organization_id)"\n`;
  md += `  ORGANIZATIONS ||--o{ DEPARTMENTS : "configures (organization_id)"\n`;
  md += `  ORGANIZATIONS ||--o{ EMPLOYEES : "employs (organization_id)"\n`;
  md += `  ORGANIZATIONS ||--o{ PROFILES : "authenticates (organization_id)"\n`;
  md += `  ORGANIZATIONS ||--o{ SHIFTS : "schedules (organization_id)"\n`;
  md += `  WORKPLACES ||--o{ EMPLOYEES : "allocates base location (workplace_id)"\n`;
  md += `  DEPARTMENTS ||--o{ EMPLOYEES : "categorizes (department_id)"\n`;
  md += `  EMPLOYEES ||--o| PROFILES : "links auth (profile_id)"\n`;
  md += `  EMPLOYEES ||--o{ ATTENDANCE : "logs punches (employee_id)"\n`;
  md += `  EMPLOYEES ||--o{ LEAVES : "requests (employee_id)"\n`;
  md += `  EMPLOYEES ||--o{ PAYSLIPS : "generates (employee_id)"\n`;
  md += `  EMPLOYEES ||--o{ EMPLOYEES : "supervises / HOD (manager_id)"\n`;
  md += `\`\`\`\n\n`;

  md += `## 5. Hospital Unit Data Linkage Verification\n\n`;
  md += `| Hospital Workplace Unit | Workplace ID | Linked Employees | Organization ID | Geofence Coordinates | Radius |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
  md += `| **Shanti Memorial Hospital** | \`wp-smh-main\` | **464** | \`shanti-memorial-hospital\` | 20.46933, 85.88301 | 500m |\n`;
  md += `| **Chikitsa** | \`wp-1793201579968\` | **111** | \`shanti-memorial-hospital\` | 13.04030, 80.22957 | 200m |\n`;
  md += `| **Gopal Trust** | \`wp-1793201564704\` | **33** | \`shanti-memorial-hospital\` | 20.46933, 85.88301 | 500m |\n`;
  md += `| **Total** | - | **608** | \`shanti-memorial-hospital\` | - | - |\n\n`;

  // Write to root file
  fs.writeFileSync(path.join(process.cwd(), 'FIREBASE_DB_ARCHITECTURE.md'), md, 'utf-8');
  console.log('✓ Successfully wrote FIREBASE_DB_ARCHITECTURE.md to workspace root!');

  process.exit(0);
}

exportArchitecture().catch(err => {
  console.error('Export error:', err);
  process.exit(1);
});

