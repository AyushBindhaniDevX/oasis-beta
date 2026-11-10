import xlsx from 'xlsx';

const files = {
  'Shanti Memorial Hospital - Cuttack': 'C:/Users/HP/.gemini/antigravity/brain/7f2ae8c6-bd83-4a4b-a046-dd3de2afa988/.user_uploaded/media_1794290832520_04b3108b.xlsx',
  'Gopal Trust': 'C:/Users/HP/.gemini/antigravity/brain/7f2ae8c6-bd83-4a4b-a046-dd3de2afa988/.user_uploaded/media_1794290832523_b67ad4a8.xlsx',
  'Chikitsa': 'C:/Users/HP/.gemini/antigravity/brain/7f2ae8c6-bd83-4a4b-a046-dd3de2afa988/.user_uploaded/media_1794290832524_c86969ab.xlsx'
};

let allEmployees = [];

for (const [unitName, filePath] of Object.entries(files)) {
  const wb = xlsx.readFile(filePath);
  let unitCount = 0;
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(ws, { defval: '' });
    let sheetCount = 0;
    for (const row of rows) {
      // Find code and name
      const code = String(row['EMP CODE'] || row['Employee Code'] || '').trim();
      const name = String(row['NAME'] || row['Full Name'] || '').trim();
      if (!code && !name) continue;
      sheetCount++;
      unitCount++;
      allEmployees.push({
        unit: unitName,
        sheet: sheetName,
        code,
        name,
        dept: row['DEPARTMENT'] || row['Department'] || '',
        desig: row['DESIGNATION'] || row['Designation'] || '',
        ph: row['PH NO'] || row['Phone'] || '',
        bankAcc: row['BANK ACCOUNT NUMBER'] || '',
        ifsc: row['IFSC '] || row['IFSC'] || '',
        bankName: row['BANK NAME '] || row['BANK NAME'] || '',
        uan: row['UAN NOUMBER'] || row['UAN Number'] || '',
        esic: row['ESIC'] || row['ESI Number'] || '',
        basic: row['O.BASIC'] || row['Basic Salary'] || 0,
        gross: row['O.G. SALARY'] || row['SALARY DETAILS '] || 0,
      });
    }
    console.log(`${unitName} -> [${sheetName}]: ${sheetCount} records`);
  }
  console.log(`== Total for ${unitName}: ${unitCount} ==\n`);
}

console.log(`Grand Total Records across 3 files: ${allEmployees.length}`);

// Check uniqueness of codes
const codeMap = new Map();
let dupes = 0;
for (const emp of allEmployees) {
  if (emp.code) {
    if (codeMap.has(emp.code)) {
      dupes++;
      // console.log(`Duplicate code: ${emp.code} in ${emp.unit} vs ${codeMap.get(emp.code).unit}`);
    } else {
      codeMap.set(emp.code, emp);
    }
  }
}
console.log(`Unique employee codes: ${codeMap.size}, Duplicates/overlap: ${dupes}`);

